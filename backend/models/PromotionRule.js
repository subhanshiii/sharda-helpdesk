const mongoose = require('mongoose');

const promotionRuleSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    minCreditsPerSemester: {
      type: Number,
      required: true,
      default: 0,
    },
    minCGPA: {
      type: Number,
      required: true,
      default: 0.0,
      min: 0,
      max: 10,
    },
    maxActiveBacklogs: {
      type: Number,
      required: true,
      default: 0,
    },
    minAttendancePercentage: {
      type: Number,
      required: true,
      default: 75,
      min: 0,
      max: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true, strict: true }
);

module.exports = mongoose.model('PromotionRule', promotionRuleSchema);
