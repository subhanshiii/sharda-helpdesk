const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
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
    category: {
      type: String,
      required: true,
      enum: ['Technical', 'Cultural', 'Sports', 'Academic', 'Workshop', 'Seminar', 'Other'],
      default: 'Other',
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    endDate: {
      type: Date,
    },
    venue: {
      type: String,
      trim: true,
      default: 'Sharda University Campus',
    },
    poster: {
      filename: String,
      url: String,
    },
    videoLink: {
      type: String,
      trim: true,
    },
    registrationLink: {
      type: String,
      trim: true,
    },
    organizer: {
      type: String,
      trim: true,
    },
    maxParticipants: {
      type: Number,
    },
    tags: [String],
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
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    interestedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

eventSchema.index({ date: 1, isActive: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ 'targetAudience.collegeId': 1 });
eventSchema.index({ 'targetAudience.departmentId': 1 });
eventSchema.index({ 'targetAudience.programId': 1 });
eventSchema.index({ 'targetAudience.courseId': 1 });
eventSchema.index({ 'targetAudience.sectionId': 1 });

module.exports = mongoose.model('Event', eventSchema);
