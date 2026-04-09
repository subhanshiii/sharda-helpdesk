const mongoose = require('mongoose');

const academicYearSchema = new mongoose.Schema(
  {
    program: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program',
      required: true,
      index: true,
    },
    yearNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

academicYearSchema.index({ program: 1, yearNumber: 1 }, { unique: true });

module.exports = mongoose.model('AcademicYear', academicYearSchema);
