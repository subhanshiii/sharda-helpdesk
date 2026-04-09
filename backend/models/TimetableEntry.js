const mongoose = require('mongoose');

const timetableEntrySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Timetable title is required'],
      trim: true,
      maxlength: 160,
    },
    subject: {
      type: String,
      trim: true,
      default: '',
    },
    department: {
      type: String,
      trim: true,
      required: [true, 'Department is required'],
    },
    year: {
      type: String,
      trim: true,
      required: [true, 'Year is required'],
    },
    section: {
      type: String,
      trim: true,
      required: [true, 'Section is required'],
    },
    dayOfWeek: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    room: {
      type: String,
      trim: true,
      default: '',
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

timetableEntrySchema.index({ department: 1, year: 1, section: 1, dayOfWeek: 1, startTime: 1 });
timetableEntrySchema.index({ faculty: 1, dayOfWeek: 1, startTime: 1 });

module.exports = mongoose.model('TimetableEntry', timetableEntrySchema);
