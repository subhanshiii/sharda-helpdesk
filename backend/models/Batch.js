const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    enrollmentYear: {
      type: Number,
      required: true,
      index: true,
    },
    expectedGraduationYear: {
      type: Number,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true, strict: true }
);

batchSchema.index({ course: 1, enrollmentYear: 1 }, { unique: true });

module.exports = mongoose.model('Batch', batchSchema);
