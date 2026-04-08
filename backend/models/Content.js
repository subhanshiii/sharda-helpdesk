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
      roles: [{ type: String, trim: true }],
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
      legacyModel: { type: String, trim: true, default: null },
      legacyId: { type: String, trim: true, default: null },
    },
  },
  { timestamps: true }
);

contentSchema.index({ contentType: 1, status: 1, publishAt: -1 });
contentSchema.index({ startsAt: 1, endsAt: 1 });
contentSchema.index({ category: 1, priority: 1 });
contentSchema.index({ 'source.legacyModel': 1, 'source.legacyId': 1 }, { unique: true, sparse: true });
contentSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Content', contentSchema);
