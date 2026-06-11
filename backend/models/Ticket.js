const mongoose = require('mongoose');

const replySchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: [true, 'Reply message is required'],
      trim: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorRole: {
      type: String,
      enum: ['student', 'faculty', 'staff', 'admin', 'agent'],
    },
    attachments: [
      {
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        url: String,
      },
    ],
    isInternal: {
      type: Boolean,
      default: false, // Internal notes visible only to support staff/admins
    },
  },
  {
    timestamps: true,
  }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      unique: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide a ticket title'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please provide a description'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Please select a category'],
      enum: ['IT Support', 'Administration', 'Hostel', 'Library', 'Finance', 'Academic', 'Infrastructure', 'Other'],
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
      default: 'Open',
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    routingDepartment: {
      type: String,
      trim: true,
      default: '',
    },
    replies: [replySchema],
    attachments: [
      {
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        url: String,
      },
    ],
    resolvedAt: {
      type: Date,
    },
    firstResponseAt: {
      type: Date,
      default: null,
    },
    slaDueAt: {
      type: Date,
      default: null,
    },
    escalatedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
    },
    tags: [String],
    // AI suggested fields
    aiSuggestedCategory: String,
    aiSuggestedPriority: String,
  },
  {
    timestamps: true,
  }
);

const Counter = require('./Counter');

// Auto-generate ticketId before saving
ticketSchema.pre('save', async function (next) {
  if (!this.ticketId) {
    const year = new Date().getFullYear();
    const counterName = `ticket_${year}`;

    // Atomic increment — safe under concurrent ticket creation
    const counter = await Counter.findOneAndUpdate(
      { name: counterName },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    this.ticketId = `SU-${year}-${String(counter.seq).padStart(4, '0')}`;
  }

  // Set resolvedAt / closedAt timestamps
  if (this.isModified('status')) {
    if (this.status === 'Resolved' && !this.resolvedAt) {
      this.resolvedAt = new Date();
    }
    if (this.status === 'Closed' && !this.closedAt) {
      this.closedAt = new Date();
    }
  }
  next();
});

// Index for faster queries
ticketSchema.index({ user: 1, status: 1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ slaDueAt: 1, status: 1 });
ticketSchema.index({ category: 1, priority: 1 });
ticketSchema.index({ createdAt: -1 });

// Soft-delete support — tickets are never permanently destroyed
const softDeletePlugin = require('../utils/softDeletePlugin');
ticketSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Ticket', ticketSchema);
