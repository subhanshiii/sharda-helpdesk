const mongoose = require('mongoose');

const curriculumSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
      unique: true,
    },
    durationYears: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    totalSemesters: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
    },
    totalCreditsRequired: {
      type: Number,
      required: true,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true, strict: true }
);

module.exports = mongoose.model('Curriculum', curriculumSchema);
