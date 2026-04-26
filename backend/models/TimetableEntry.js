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
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      default: null,
      index: true,
    },
    subjectCode: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    department: {
      type: String,
      trim: true,
      default: 'General',
    },
    year: {
      type: String,
      trim: true,
      default: '',
    },
    section: {
      type: String,
      trim: true,
      default: 'General',
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      default: null,
      index: true,
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
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

timetableEntrySchema.index({ department: 1, year: 1, section: 1, dayOfWeek: 1, startTime: 1 });
timetableEntrySchema.index({ sectionId: 1, dayOfWeek: 1, startTime: 1 });
timetableEntrySchema.index({ faculty: 1, dayOfWeek: 1, startTime: 1 });
timetableEntrySchema.index({ subjectCode: 1, sectionId: 1 }); // FIXED: speed up subject-code propagation lookups across sections.

module.exports = mongoose.model('TimetableEntry', timetableEntrySchema);
