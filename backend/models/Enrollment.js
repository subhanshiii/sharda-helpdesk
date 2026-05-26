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
    academicSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicSession',
      required: true,
      index: true,
    },
    semester: {
      type: String,
      default: '',
      trim: true,
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

module.exports = mongoose.model('Enrollment', enrollmentSchema);
