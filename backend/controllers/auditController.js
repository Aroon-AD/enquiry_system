const asyncHandler = require('express-async-handler');
const AuditLog = require('../models/AuditLog');

// @desc    List audit logs, optionally filtered by enquiry, with pagination
// @route   GET /api/audit-logs
// @access  Private (admin)
const getAuditLogs = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.enquiryId) filter.enquiry = req.query.enquiryId;
  if (req.query.action) filter.action = req.query.action;

  const [total, logs] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('actor', 'name email')
      .populate('enquiry', 'referenceCode subject')
      .lean(),
  ]);

  res.json({
    success: true,
    data: logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

module.exports = { getAuditLogs };
