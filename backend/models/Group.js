const mongoose = require('mongoose');

const OBJECT_ID = mongoose.Schema.Types.ObjectId;

/**
 * Group Model
 * Represents a collaborative chat group with optional audience-building rules.
 */
const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      maxlength: [100, 'Group name cannot exceed 100 characters'],
    },

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

    selectionRules: {
      roles: [
        {
          type: String,
          enum: ['student', 'faculty', 'staff', 'admin', 'agent'],
        },
      ],
      departmentIds: [
        {
          type: OBJECT_ID,
          ref: 'Department',
        },
      ],
      sectionIds: [
        {
          type: OBJECT_ID,
          ref: 'Section',
        },
      ],
      autoIncludeFiltered: {
        type: Boolean,
        default: false,
      },
    },

    audienceSignature: {
      type: String,
      trim: true,
      default: 'all',
      index: true,
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

    members: [
      {
        user: {
          type: OBJECT_ID,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          enum: ['admin', 'member', 'staff', 'faculty', 'agent', 'teacher', 'student'],
          default: 'member',
        },
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
groupSchema.index({ 'members.user': 1 });
groupSchema.index({ department: 1, year: 1 });
groupSchema.index({ createdBy: 1 });
groupSchema.index({ 'selectionRules.roles': 1 });
groupSchema.index({ 'selectionRules.departmentIds': 1 });
groupSchema.index({ 'selectionRules.sectionIds': 1 });
groupSchema.index(
  { name: 1, createdBy: 1, audienceSignature: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

groupSchema.virtual('memberCount').get(function () {
  return this.members.length;
});

module.exports = mongoose.model('Group', groupSchema);
