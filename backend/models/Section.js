const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema(
  {
    program: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program',
      required: true,
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true, // Now required in new arch
      index: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      default: null, // Make optional for backwards compatibility during migration
      index: true,
    },
    academicSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicSession',
      default: null, // Legacy, transitioning to Batch
      index: true,
    },
    studyYear: {
      type: Number,
      min: 1,
      max: 10,
      default: null,
      index: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    capacity: {
      type: Number,
      default: 60,
      min: 1,
    },
    advisorFaculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true, strict: true }
);

// We relax the index because academicSession is now optional
sectionSchema.index({ program: 1, course: 1, name: 1, batch: 1 }, { unique: true, partialFilterExpression: { batch: { $type: "objectId" } } });

module.exports = mongoose.model('Section', sectionSchema);
