const mongoose = require('mongoose');

const assessmentRecordSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    marks: {
      type: Number,
      default: null,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'graded', 'absent', 'exempt'],
      default: 'pending',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    gradedAt: {
      type: Date,
      default: null,
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: false }
);

const assessmentSessionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Assessment title is required'],
      trim: true,
      maxlength: 160,
    },
    assessmentType: {
      type: String,
      enum: ['mse', 'ese', 'assignment', 'ca', 'practical', 'quiz', 'viva', 'internal', 'project', 'other'],
      required: true,
      index: true,
    },
    subject: {
      type: String,
      trim: true,
      default: '',
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true,
    },
    teachingAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeachingAssignment',
      default: null,
      index: true,
    },
    academicSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicSession',
      required: true,
      index: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    program: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program',
      default: null,
      index: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true,
    },
    section: {
      type: String,
      trim: true,
      default: '',
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    topic: {
      type: String,
      trim: true,
      default: '',
    },
    maxMarks: {
      type: Number,
      required: true,
      default: 100,
      min: 1,
    },
    passingMarks: {
      type: Number,
      default: 40,
      min: 0,
    },
    weightage: {
      type: Number,
      default: null,
      min: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
      index: true,
    },
    records: [assessmentRecordSchema],
    publishedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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

assessmentSessionSchema.index({ sectionId: 1, subjectId: 1, date: -1 });
assessmentSessionSchema.index({ academicSessionId: 1, assessmentType: 1, date: -1 });
assessmentSessionSchema.index({ faculty: 1, date: -1 });
assessmentSessionSchema.index({ createdBy: 1, date: -1 });

module.exports = mongoose.model('AssessmentSession', assessmentSessionSchema);
