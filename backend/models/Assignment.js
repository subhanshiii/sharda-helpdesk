const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String,
  },
  { _id: false }
);

const assignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Assignment title is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: [true, 'Assignment description is required'],
      trim: true,
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
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    maxScore: {
      type: Number,
      default: 100,
      min: 1,
    },
    allowLateSubmissions: {
      type: Boolean,
      default: false,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
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
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      default: null,
      index: true,
    },
    assignedStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    attachments: [attachmentSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

assignmentSchema.index({ createdBy: 1, dueDate: -1 });
assignmentSchema.index({ dueDate: 1, isPublished: 1 });
assignmentSchema.index({ sectionId: 1, dueDate: 1 });
assignmentSchema.index({ subjectId: 1, dueDate: 1 });
assignmentSchema.index({ createdAt: -1 });
assignmentSchema.index({ 'targetAudience.collegeId': 1 });
assignmentSchema.index({ 'targetAudience.departmentId': 1 });
assignmentSchema.index({ 'targetAudience.programId': 1 });
assignmentSchema.index({ 'targetAudience.courseId': 1 });
assignmentSchema.index({ 'targetAudience.sectionId': 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
