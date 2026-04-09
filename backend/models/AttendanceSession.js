const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused'],
      default: 'present',
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const attendanceSessionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Attendance title is required'],
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
    date: {
      type: Date,
      required: true,
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    topic: {
      type: String,
      trim: true,
      default: '',
    },
    records: [attendanceRecordSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

attendanceSessionSchema.index({ department: 1, year: 1, section: 1, date: -1 });
attendanceSessionSchema.index({ faculty: 1, date: -1 });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
