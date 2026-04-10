const mongoose = require('mongoose');

const yearCounterSchema = new mongoose.Schema(
  {
    year: {
      type: Number,
      required: true,
      unique: true,
      index: true,
      min: 2000,
    },
    currentSequence: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('YearCounter', yearCounterSchema);
