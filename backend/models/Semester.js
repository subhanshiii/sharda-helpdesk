const mongoose = require('mongoose');

const semesterSchema = new mongoose.Schema(
  {
    curriculum: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Curriculum',
      required: true,
      index: true,
    },
    semesterNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
    },
    totalCredits: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true, strict: true }
);

semesterSchema.index({ curriculum: 1, semesterNumber: 1 }, { unique: true });

module.exports = mongoose.model('Semester', semesterSchema);
