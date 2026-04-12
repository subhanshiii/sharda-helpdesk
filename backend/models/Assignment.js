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

module.exports = mongoose.model('Assignment', assignmentSchema);
