const mongoose = require('mongoose');

const academicCalendarSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    endDate: { type: Date },
    type: {
      type: String,
      enum: ['Exam', 'Holiday', 'Event', 'Deadline', 'Result', 'Registration', 'Other'],
      default: 'Other',
    },
    description: { type: String, trim: true },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

academicCalendarSchema.index({ date: 1 });
module.exports = mongoose.model('AcademicCalendar', academicCalendarSchema);
