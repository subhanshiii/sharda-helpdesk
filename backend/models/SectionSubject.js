// DEPRECATED: This model is retained only for backward-compatible reads during
// migration. New writes must use the canonical chain:
//   Course -> CourseSubject (subjects per course)
//   Subject -> SubjectTeacher / SubjectSectionTeacher (faculty mapping)
//   TeachingAssignment (derived: section + subject + teacher + academicSession + term)
// Do not introduce new references to this collection. It will be removed in
// the Phase 4 migration once a full audit confirms there are no active reads.
const mongoose = require('mongoose');

const sectionSubjectSchema = new mongoose.Schema(
  {
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true,
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    facultyMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    semester: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true, strict: true }
);

sectionSubjectSchema.index(
  { section: 1, subject: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  }
);

module.exports = mongoose.model('SectionSubject', sectionSubjectSchema);
