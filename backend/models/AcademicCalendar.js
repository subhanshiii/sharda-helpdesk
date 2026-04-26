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
    targetAudience: {
      tiers: [{ type: String, trim: true }],
      roles: [{ type: String, trim: true }],
      collegeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'College',
        default: null,
      },
      departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        default: null,
      },
      programId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Program',
        default: null,
      },
      courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        default: null,
      },
      studyYear: {
        type: Number,
        default: null,
      },
      sectionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Section',
        default: null,
      },
      departments: [{ type: String, trim: true }],
      years: [{ type: String, trim: true }],
      sections: [{ type: String, trim: true }],
    },
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
