const mongoose = require('mongoose');

const academicAuditLogSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ['Promoted', 'Detained', 'Graduated', 'Probation', 'CreditUpdate'],
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, strict: true }
);

module.exports = mongoose.model('AcademicAuditLog', academicAuditLogSchema);
