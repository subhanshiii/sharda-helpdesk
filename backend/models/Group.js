const mongoose = require('mongoose');

/**
 * Group Model
 * Represents a department/year/section group (e.g., CSE-2B, MBA-1A)
 */
const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      maxlength: [100, 'Group name cannot exceed 100 characters'],
    },

    // e.g. "CSE", "MBA", "ECE" — used for filtering
    department: {
      type: String,
      trim: true,
    },

    // e.g. "1", "2", "3", "4"
    year: {
      type: String,
      trim: true,
    },

    // e.g. "A", "B", "C"
    section: {
      type: String,
      trim: true,
    },

    // Optional description shown in group info
    description: {
      type: String,
      trim: true,
      maxlength: 300,
    },

    // Group avatar/icon
    avatar: {
      type: String,
      default: null,
    },

    // Who created this group (admin)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Members array — each member has a role within the group
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        // Role within this group: admin, staff, faculty, or student
        // Keep "teacher" for backward compatibility with older records.
        role: {
          type: String,
          enum: ['admin', 'staff', 'faculty', 'agent', 'teacher', 'student'],
          default: 'student',
        },
        // When they joined the group
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Reference to last message for preview in sidebar
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },

    // Is the group active?
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes for faster queries ─────────────────────────
groupSchema.index({ 'members.user': 1 });        // Find groups for a user
groupSchema.index({ department: 1, year: 1 });   // Filter by dept + year
groupSchema.index({ createdBy: 1 });              // Find groups by creator
groupSchema.index( // FIXED: prevent duplicate active groups with the same name from the same creator at the database level.
  { name: 1, createdBy: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

// ── Virtual: member count ──────────────────────────────
groupSchema.virtual('memberCount').get(function () {
  return this.members.length;
});

module.exports = mongoose.model('Group', groupSchema);
