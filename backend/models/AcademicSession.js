const mongoose = require('mongoose');

// AcademicSession stores the institutional session label like "2025-26".
// Section.studyYear remains the student level number (1, 2, 3, 4) inside that session.
const academicSessionSchema = new mongoose.Schema(
  {
    program: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Program',
      required: true,
      index: true,
    },
    yearNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    label: {
      type: String,
      required: true,
      trim: true,
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
    collection: 'academicyears',
  }
);

academicSessionSchema.index({ program: 1, yearNumber: 1 }, { unique: true });

module.exports = mongoose.models.AcademicSession || mongoose.model('AcademicSession', academicSessionSchema);
