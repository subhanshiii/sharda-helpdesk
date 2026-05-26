const mongoose = require('mongoose');

const orgUnitSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: ['academic', 'operational'],
      required: true,
      default: 'operational',
      index: true,
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      default: null,
      index: true,
    },
    linkedDepartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

orgUnitSchema.index({ code: 1 }, { unique: true });
orgUnitSchema.index({ type: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('OrgUnit', orgUnitSchema);
