const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
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
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

departmentSchema.index({ code: 1 }, { unique: true });
departmentSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Department', departmentSchema);
