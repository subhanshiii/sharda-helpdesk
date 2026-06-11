const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
      index: true,
    },
    academicSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicSession',
      default: null, // Legacy, moving to Batch-driven enrollment
      index: true,
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
      default: null,
      index: true,
    },
    term: {
      type: Number,
      min: 1,
      max: 12,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'completed', 'withdrawn'],
      default: 'active',
      index: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true, strict: true }
);

enrollmentSchema.index({ student: 1, status: 1 });
enrollmentSchema.index({ section: 1, status: 1 });
enrollmentSchema.index(
  { student: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
  }
);

// Soft-delete support — enrollment history is preserved for academic compliance
const softDeletePlugin = require('../utils/softDeletePlugin');
enrollmentSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Enrollment', enrollmentSchema);
