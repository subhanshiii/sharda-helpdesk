const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema(
  {
    program: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program',
      required: true,
      index: true,
    },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
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
  { timestamps: true }
);

sectionSchema.index({ academicYear: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Section', sectionSchema);
