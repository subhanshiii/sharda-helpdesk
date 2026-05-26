const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    program: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program',
      required: true,
      index: true,
    },
    // DEPRECATED: kept for backward compatibility only. CourseSubject is the source of truth.
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
      index: true,
    },
    academicSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicSession',
      required: true,
      index: true,
    },
    term: {
      type: Number,
      min: 1,
      max: 12,
      default: 1,
      index: true,
    },
    credits: {
      type: Number,
      default: 0,
      min: 0,
    },
    type: {
      type: String,
      enum: ['core', 'elective', 'common'],
      default: 'core',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true, strict: true }
);

subjectSchema.index({ program: 1, academicSession: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Subject', subjectSchema);
