const mongoose = require('mongoose');

const studentProgressSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      unique: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true,
    },
    currentSemester: {
      type: Number,
      required: true,
      default: 1,
    },
    totalCreditsRequired: {
      type: Number,
      required: true,
      default: 0,
    },
    creditsEarned: {
      type: Number,
      required: true,
      default: 0,
    },
    cgpa: {
      type: Number,
      required: true,
      default: 0.0,
      min: 0,
      max: 10,
    },
    status: {
      type: String,
      enum: ['Active', 'Probation', 'Detained', 'Graduated'],
      default: 'Active',
      index: true,
    },
    backlogs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
      },
    ],
  },
  { timestamps: true, strict: true }
);

// Virtual for Degree Completion Percentage
studentProgressSchema.virtual('completionPercentage').get(function () {
  if (this.totalCreditsRequired === 0) return 0;
  const percentage = (this.creditsEarned / this.totalCreditsRequired) * 100;
  return Math.min(percentage, 100).toFixed(2);
});

module.exports = mongoose.model('StudentProgress', studentProgressSchema);
