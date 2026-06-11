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
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Semester',
      default: null,
      index: true,
    },
    academicSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicSession',
      default: null, // Legacy, moving to Semester-based
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
    theoryCredits: {
      type: Number,
      default: 0,
      min: 0,
    },
    practicalCredits: {
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

// We need to relax the unique index since academicSession is now optional
subjectSchema.index({ program: 1, code: 1, semester: 1 }, { unique: true, partialFilterExpression: { semester: { $type: "objectId" } } });

module.exports = mongoose.model('Subject', subjectSchema);
