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

module.exports = mongoose.model('Opportunity', opportunitySchema);
