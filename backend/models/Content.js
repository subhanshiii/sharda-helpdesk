const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    fileName: String,
    fileUrl: String,
    fileType: String,
    size: Number,
  },
  { _id: false }
);

const contentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    contentType: {
      type: String,
      enum: ['notice', 'calendar'],
      required: true,
      default: 'notice',
    },
    category: {
      type: String,
      trim: true,
      default: 'academic',
    },
    type: {
      type: String,
      trim: true,
      default: 'info',
    },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
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
    attachments: [attachmentSchema],
    startsAt: {
      type: Date,
      default: null,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    publishAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    source: {
      legacyModel: { type: String, trim: true },
      legacyId: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

contentSchema.index({ contentType: 1, status: 1, publishAt: -1 });
contentSchema.index({ startsAt: 1, endsAt: 1 });
contentSchema.index({ category: 1, priority: 1 });
contentSchema.index({ 'targetAudience.collegeId': 1 });
contentSchema.index({ 'targetAudience.departmentId': 1 });
contentSchema.index({ 'targetAudience.programId': 1 });
contentSchema.index({ 'targetAudience.courseId': 1 });
contentSchema.index({ 'targetAudience.sectionId': 1 });
contentSchema.index(
  { 'source.legacyModel': 1, 'source.legacyId': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'source.legacyModel': { $exists: true, $type: 'string' },
      'source.legacyId': { $exists: true, $type: 'string' },
    },
  }
);
contentSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Content', contentSchema);
