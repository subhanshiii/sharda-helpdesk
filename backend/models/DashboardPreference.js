const mongoose = require('mongoose');

const personalTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    note: {
      type: String,
      trim: true,
      default: '',
      maxlength: 400,
    },
    status: {
      type: String,
      enum: ['todo', 'done'],
      default: 'todo',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const dashboardPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    personalTasks: [personalTaskSchema],
    widgetPreferences: {
      hidden: [{ type: String, trim: true }],
      pinned: [{ type: String, trim: true }],
    },
    dailyInsight: {
      key: { type: String, default: '' },
      message: { type: String, default: '' },
      source: { type: String, default: 'fallback' },
      generatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

dashboardPreferenceSchema.index({ user: 1 }, { unique: true });

module.exports = mongoose.model('DashboardPreference', dashboardPreferenceSchema);
