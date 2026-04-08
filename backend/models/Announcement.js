const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    // Keep message for backward compatibility with older announcement documents.
    message: {
      type: String,
      trim: true,
      default: '',
    },
    type: {
      type: String,
      enum: ['info', 'warning', 'urgent', 'success'],
      default: 'info',
    },
    category: {
      type: String,
      enum: ['event', 'academic', 'opportunity'],
      default: 'academic',
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
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        fileType: String,
        size: Number,
      },
    ],
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

announcementSchema.pre('validate', function (next) {
  if (!this.description && this.message) this.description = this.message;
  if (!this.message && this.description) this.message = this.description;
  next();
});

module.exports = mongoose.model('Announcement', announcementSchema);
