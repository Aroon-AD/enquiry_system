const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    enquiry: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry', index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', index: true },
    actorName: { type: String }, // denormalized for fast display even if admin is later removed
    action: {
      type: String,
      enum: [
        'ENQUIRY_CREATED',
        'STATUS_CHANGED',
        'PRIORITY_CHANGED',
        'ASSIGNED',
        'NOTE_UPDATED',
        'ENQUIRY_VIEWED',
        'ENQUIRY_DELETED',
        'ATTACHMENT_DOWNLOADED',
        'ADMIN_LOGIN',
        'ADMIN_LOGIN_FAILED',
      ],
      required: true,
      index: true,
    },
    fromValue: { type: String },
    toValue: { type: String },
    ipAddress: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
