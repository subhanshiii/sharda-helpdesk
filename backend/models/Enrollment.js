const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true,
    },
    academicSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AcademicSession',
      required: true,
      index: true,
    },
    semester: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'completed', 'withdrawn'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true }
);

enrollmentSchema.index({ student: 1, status: 1 });
enrollmentSchema.index({ section: 1, status: 1 });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
