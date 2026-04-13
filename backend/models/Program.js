const mongoose = require('mongoose');

const programSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    durationYears: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    degreeType: {
      type: String,
      trim: true,
      default: 'UG',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true, strict: true }
);

programSchema.index({ department: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Program', programSchema);
