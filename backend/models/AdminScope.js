const mongoose = require('mongoose');

const adminScopeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    scopeType: {
      type: String,
      enum: ['college', 'department', 'program', 'section'],
      required: true,
      index: true,
    },
    scopeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

adminScopeSchema.index({ userId: 1, scopeType: 1, scopeId: 1 }, { unique: true });

module.exports = mongoose.model('AdminScope', adminScopeSchema);
