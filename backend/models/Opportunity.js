const mongoose = require('mongoose');

const opportunitySchema = new mongoose.Schema(
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
    type: {
      type: String,
      required: [true, 'Type is required'],
      enum: ['Internship', 'Hackathon', 'Competition', 'Workshop', 'Job', 'Scholarship'],
    },
    company: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
      default: 'Remote',
    },
    externalLink: {
      type: String,
      trim: true,
    },
    deadline: {
      type: Date,
    },
    stipend: {
      type: String,
      trim: true,
    },
    eligibility: {
      type: String,
      trim: true,
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
    bookmarks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

opportunitySchema.index({ type: 1, isActive: 1 });
opportunitySchema.index({ deadline: 1 });
opportunitySchema.index({ createdAt: -1 });
opportunitySchema.index({ 'targetAudience.collegeId': 1 });
opportunitySchema.index({ 'targetAudience.departmentId': 1 });
opportunitySchema.index({ 'targetAudience.programId': 1 });
opportunitySchema.index({ 'targetAudience.courseId': 1 });
opportunitySchema.index({ 'targetAudience.sectionId': 1 });

module.exports = mongoose.model('Opportunity', opportunitySchema);
