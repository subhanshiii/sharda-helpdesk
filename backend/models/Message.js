const mongoose = require('mongoose');

/**
 * Message Model
 * Stores all chat messages for all groups
 */
const messageSchema = new mongoose.Schema(
  {
    // Which group this message belongs to
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: [true, 'Group is required'],
      index: true, // Critical for fast message fetching
    },

    // Who sent this message
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required'],
    },

    // Text content (optional if file is attached)
    content: {
      type: String,
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },

    // Message type: text, image, document, system
    type: {
      type: String,
      enum: ['text', 'image', 'document', 'system'],
      default: 'text',
    },

    // File attachment details
    file: {
      originalName: String,   // "assignment.pdf"
      url:          String,   // "/uploads/chat/abc123.pdf" or Cloudinary URL
      mimeType:     String,   // "application/pdf", "image/jpeg"
      size:         Number,   // bytes
      filename:     String,   // stored filename
    },

    // System messages: "John joined the group", "Group was created"
    systemMessage: {
      type: String,
    },

    // Users who have read this message
    readBy: [
      {
        user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now },
      },
    ],

    // Is this message deleted?
    isDeleted: {
      type: Boolean,
      default: false,
    },

    // If deleted, show "This message was deleted" instead of content
    deletedAt: Date,
  },
  {
    timestamps: true, // createdAt = message sent time
  }
);

// ── Compound index for efficient chat history loading ──
// Most common query: get messages for group X, sorted by time
messageSchema.index({ group: 1, createdAt: -1 });

// ── Validate: must have either content or file ─────────
messageSchema.pre('save', function (next) {
  if (!this.content && !this.file?.url && !this.systemMessage) {
    return next(new Error('Message must have content, a file, or be a system message'));
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);
