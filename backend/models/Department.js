const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    college: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true,
    },
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
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true, strict: true }
);

departmentSchema.index({ code: 1 }, { unique: true });
departmentSchema.index({ college: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Department', departmentSchema);
