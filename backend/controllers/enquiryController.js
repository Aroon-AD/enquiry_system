const path = require('path');
const fs = require('fs');
const asyncHandler = require('express-async-handler');
const Enquiry = require('../models/Enquiry');
const AuditLog = require('../models/AuditLog');

// @desc    Submit a new enquiry (public form)
// @route   POST /api/enquiries
// @access  Public (rate limited)
const createEnquiry = asyncHandler(async (req, res) => {
  const { fullName, email, phone, company, projectType, budgetRange, subject, message } = req.body;

  const attachments = (req.files || []).map((f) => ({
    originalName: f.originalname,
    storedName: f.filename,
    mimeType: f.mimetype,
    sizeBytes: f.size,
  }));

  const enquiry = await Enquiry.create({
    fullName,
    email,
    phone,
    company,
    projectType,
    budgetRange,
    subject,
    message,
    attachments,
    submittedIp: req.ip,
    submittedUserAgent: req.headers['user-agent'],
  });

  await AuditLog.create({
    enquiry: enquiry._id,
    action: 'ENQUIRY_CREATED',
    ipAddress: req.ip,
    metadata: { referenceCode: enquiry.referenceCode },
  });

  res.status(201).json({
    success: true,
    message: 'Your enquiry has been submitted successfully.',
    referenceCode: enquiry.referenceCode,
  });
});

// @desc    List enquiries with search, filtering, sorting, pagination
// @route   GET /api/enquiries
// @access  Private (admin)
const getEnquiries = asyncHandler(async (req, res) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const skip = (page - 1) * limit;

  const filter = { isDeleted: false };

  if (req.query.status) filter.status = req.query.status;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.projectType) filter.projectType = req.query.projectType;
  if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;

  if (req.query.dateFrom || req.query.dateTo) {
    filter.createdAt = {};
    if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom);
    if (req.query.dateTo) filter.createdAt.$lte = new Date(req.query.dateTo);
  }

  if (req.query.search) {
    filter.$text = { $search: req.query.search };
  }

  const sortBy = req.query.sortBy || 'createdAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
  const sort = { [sortBy]: sortOrder };

  // Run count and find in parallel for performance
  const [total, enquiries] = await Promise.all([
    Enquiry.countDocuments(filter),
    Enquiry.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('assignedTo', 'name email')
      .lean(), // lean() for faster read-only queries
  ]);

  res.json({
    success: true,
    data: enquiries,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      hasNextPage: skip + enquiries.length < total,
      hasPrevPage: page > 1,
    },
  });
});

// @desc    Get a single enquiry by id
// @route   GET /api/enquiries/:id
// @access  Private (admin)
const getEnquiryById = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findOne({ _id: req.params.id, isDeleted: false }).populate(
    'assignedTo',
    'name email'
  );

  if (!enquiry) {
    res.status(404);
    throw new Error('Enquiry not found');
  }

  await AuditLog.create({
    enquiry: enquiry._id,
    actor: req.admin._id,
    actorName: req.admin.name,
    action: 'ENQUIRY_VIEWED',
    ipAddress: req.ip,
  });

  res.json({ success: true, data: enquiry });
});

// @desc    Update enquiry status (core workflow action)
// @route   PATCH /api/enquiries/:id/status
// @access  Private (admin)
const updateStatus = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findOne({ _id: req.params.id, isDeleted: false });
  if (!enquiry) {
    res.status(404);
    throw new Error('Enquiry not found');
  }

  const fromValue = enquiry.status;
  const toValue = req.body.status;

  if (fromValue === toValue) {
    return res.json({ success: true, data: enquiry, message: 'No change (status already set).' });
  }

  enquiry.status = toValue;
  await enquiry.save();

  await AuditLog.create({
    enquiry: enquiry._id,
    actor: req.admin._id,
    actorName: req.admin.name,
    action: 'STATUS_CHANGED',
    fromValue,
    toValue,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: enquiry });
});

// @desc    Update enquiry priority
// @route   PATCH /api/enquiries/:id/priority
// @access  Private (admin)
const updatePriority = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findOne({ _id: req.params.id, isDeleted: false });
  if (!enquiry) {
    res.status(404);
    throw new Error('Enquiry not found');
  }

  const fromValue = enquiry.priority;
  const toValue = req.body.priority;

  enquiry.priority = toValue;
  await enquiry.save();

  await AuditLog.create({
    enquiry: enquiry._id,
    actor: req.admin._id,
    actorName: req.admin.name,
    action: 'PRIORITY_CHANGED',
    fromValue,
    toValue,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: enquiry });
});

// @desc    Assign enquiry to an admin (or unassign with null)
// @route   PATCH /api/enquiries/:id/assign
// @access  Private (admin)
const assignEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findOne({ _id: req.params.id, isDeleted: false });
  if (!enquiry) {
    res.status(404);
    throw new Error('Enquiry not found');
  }

  const fromValue = enquiry.assignedTo ? String(enquiry.assignedTo) : 'unassigned';
  enquiry.assignedTo = req.body.adminId || null;
  await enquiry.save();

  await AuditLog.create({
    enquiry: enquiry._id,
    actor: req.admin._id,
    actorName: req.admin.name,
    action: 'ASSIGNED',
    fromValue,
    toValue: req.body.adminId || 'unassigned',
    ipAddress: req.ip,
  });

  res.json({ success: true, data: enquiry });
});

// @desc    Update internal notes
// @route   PATCH /api/enquiries/:id/notes
// @access  Private (admin)
const updateNotes = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findOne({ _id: req.params.id, isDeleted: false });
  if (!enquiry) {
    res.status(404);
    throw new Error('Enquiry not found');
  }

  enquiry.internalNotes = req.body.internalNotes || '';
  await enquiry.save();

  await AuditLog.create({
    enquiry: enquiry._id,
    actor: req.admin._id,
    actorName: req.admin.name,
    action: 'NOTE_UPDATED',
    ipAddress: req.ip,
  });

  res.json({ success: true, data: enquiry });
});

// @desc    Soft-delete an enquiry
// @route   DELETE /api/enquiries/:id
// @access  Private (admin, superadmin only enforced in route)
const deleteEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findOne({ _id: req.params.id, isDeleted: false });
  if (!enquiry) {
    res.status(404);
    throw new Error('Enquiry not found');
  }

  enquiry.isDeleted = true;
  await enquiry.save();

  await AuditLog.create({
    enquiry: enquiry._id,
    actor: req.admin._id,
    actorName: req.admin.name,
    action: 'ENQUIRY_DELETED',
    ipAddress: req.ip,
  });

  res.json({ success: true, message: 'Enquiry deleted' });
});

// @desc    Securely download an attachment (auth required — prevents unauthorized access)
// @route   GET /api/enquiries/:id/attachments/:storedName
// @access  Private (admin)
const downloadAttachment = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findOne({ _id: req.params.id, isDeleted: false });
  if (!enquiry) {
    res.status(404);
    throw new Error('Enquiry not found');
  }

  const attachment = enquiry.attachments.find((a) => a.storedName === req.params.storedName);
  if (!attachment) {
    res.status(404);
    throw new Error('Attachment not found');
  }

  const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
  const filePath = path.join(uploadDir, attachment.storedName);

  // Guard against path traversal outside the uploads directory
  if (!filePath.startsWith(uploadDir)) {
    res.status(400);
    throw new Error('Invalid file path');
  }

  if (!fs.existsSync(filePath)) {
    res.status(404);
    throw new Error('File no longer exists on server');
  }

  await AuditLog.create({
    enquiry: enquiry._id,
    actor: req.admin._id,
    actorName: req.admin.name,
    action: 'ATTACHMENT_DOWNLOADED',
    ipAddress: req.ip,
    metadata: { fileName: attachment.originalName },
  });

  res.download(filePath, attachment.originalName);
});

// @desc    Dashboard summary stats (counts by status/priority)
// @route   GET /api/enquiries/stats/summary
// @access  Private (admin)
const getSummaryStats = asyncHandler(async (req, res) => {
  const [statusCounts, priorityCounts, total, last7Days] = await Promise.all([
    Enquiry.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Enquiry.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
    Enquiry.countDocuments({ isDeleted: false }),
    Enquiry.countDocuments({
      isDeleted: false,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }),
  ]);

  res.json({
    success: true,
    data: {
      total,
      last7Days,
      byStatus: statusCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      byPriority: priorityCounts.reduce((acc, p) => ({ ...acc, [p._id]: p.count }), {}),
    },
  });
});

module.exports = {
  createEnquiry,
  getEnquiries,
  getEnquiryById,
  updateStatus,
  updatePriority,
  assignEnquiry,
  updateNotes,
  deleteEnquiry,
  downloadAttachment,
  getSummaryStats,
};
