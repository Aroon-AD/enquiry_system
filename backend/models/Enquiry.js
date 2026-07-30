const mongoose = require('mongoose');
const Counter = require('./Counter');

const attachmentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    storedName: { type: String, required: true }, // name on disk (randomized)
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
  },
  { _id: false }
);

const enquirySchema = new mongoose.Schema(
  {
    referenceCode: {
      type: String,
      unique: true,
      index: true,
    },
    // Customer-provided fields
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 30 },
    company: { type: String, trim: true, maxlength: 160 },
    projectType: {
      type: String,
      enum: ['Web Development', 'Mobile App', 'Consulting', 'Design', 'Support', 'Other'],
      default: 'Other',
    },
    budgetRange: {
      type: String,
      enum: ['Under $5k', '$5k - $20k', '$20k - $50k', '$50k+', 'Not sure'],
      default: 'Not sure',
    },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    attachments: [attachmentSchema],

    // Internal management fields
    status: {
      type: String,
      enum: ['New', 'In Progress', 'On Hold', 'Resolved', 'Closed'],
      default: 'New',
      index: true,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
      index: true,
    },
    internalNotes: { type: String, trim: true, maxlength: 3000, default: '' },

    // Security / anti-abuse metadata
    submittedIp: { type: String },
    submittedUserAgent: { type: String },

    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Compound text index for search across key fields
enquirySchema.index({
  fullName: 'text',
  email: 'text',
  subject: 'text',
  message: 'text',
  company: 'text',
  referenceCode: 'text',
});

// Compound index to speed up common dashboard filter+sort combo
enquirySchema.index({ status: 1, priority: 1, createdAt: -1 });

// Auto-generate a human-readable reference code, e.g. ENQ-2026-000042
enquirySchema.pre('save', async function (next) {
  if (this.isNew && !this.referenceCode) {
    const year = new Date().getFullYear();
    const counter = await Counter.findOneAndUpdate(
      { key: `enquiry_${year}` },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.referenceCode = `ENQ-${year}-${String(counter.seq).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Enquiry', enquirySchema);
