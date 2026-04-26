const Enrollment = require('../models/Enrollment');
const Section = require('../models/Section');
const AcademicSession = require('../models/AcademicSession');
const Program = require('../models/Program');
const User = require('../models/User');

const deriveEnrollmentSemester = (sectionDoc) => {
  if (sectionDoc?.studyYear) return `Year ${sectionDoc.studyYear}`;
  return '';
};

const applyUserSectionSnapshot = async (studentId, sectionDoc) => {
  await User.findByIdAndUpdate(studentId, {
    collegeId: sectionDoc.department?.college?._id || null,
    departmentId: sectionDoc.department?._id || null,
    department: sectionDoc.department?.name || '',
    programId: sectionDoc.program?._id || null,
    sectionId: sectionDoc._id,
    section: sectionDoc.name || '',
    year: sectionDoc.studyYear ? String(sectionDoc.studyYear) : '',
  });
};

const clearUserSectionSnapshot = async (studentId) => {
  await User.findByIdAndUpdate(studentId, {
    sectionId: null,
    section: '',
    year: '',
  });
};

const findNextSection = async (currentSection) => {
  if (!currentSection?.studyYear) return null;

  const activeSessionIds = await AcademicSession.find({
    program: currentSection.program?._id || currentSection.program,
    isActive: true,
  }).distinct('_id');

  if (!activeSessionIds.length) return null;

  return Section.findOne({
    isActive: true,
    program: currentSection.program?._id || currentSection.program,
    course: currentSection.course?._id || currentSection.course || null,
    department: currentSection.department?._id || currentSection.department,
    studyYear: Number(currentSection.studyYear) + 1,
    academicSession: { $in: activeSessionIds },
    name: currentSection.name,
  })
    .populate({
      path: 'department',
      select: 'name college',
      populate: { path: 'college', select: 'name code' },
    })
    .populate('program', 'name code durationYears')
    .populate('course', 'name code')
    .populate('academicSession', 'label yearNumber isActive')
    .sort({ updatedAt: -1, createdAt: -1 });
};

const promoteEnrollment = async (enrollment, nextSection) => {
  enrollment.status = 'inactive';
  await enrollment.save({ validateBeforeSave: false });

  await Enrollment.updateMany(
    { student: enrollment.student, status: 'active' },
    { $set: { status: 'inactive' } }
  );

  const reusableEnrollment = await Enrollment.findOne({
    student: enrollment.student,
    section: nextSection._id,
    status: 'inactive',
  }).sort({ updatedAt: -1 });

  if (reusableEnrollment) {
    reusableEnrollment.status = 'active';
    reusableEnrollment.academicSession = nextSection.academicSession?._id || null;
    reusableEnrollment.semester = deriveEnrollmentSemester(nextSection);
    await reusableEnrollment.save({ validateBeforeSave: false });
  } else {
    await Enrollment.create({
      student: enrollment.student,
      section: nextSection._id,
      academicSession: nextSection.academicSession?._id || null,
      semester: deriveEnrollmentSemester(nextSection),
      status: 'active',
    });
  }

  await applyUserSectionSnapshot(enrollment.student, nextSection);
};

const graduateEnrollment = async (enrollment) => {
  enrollment.status = 'completed';
  await enrollment.save({ validateBeforeSave: false });
  await clearUserSectionSnapshot(enrollment.student);
};

const runAutomaticStudentPromotions = async () => {
  const activeEnrollments = await Enrollment.find({ status: 'active' })
    .populate({
      path: 'section',
      populate: [
        {
          path: 'department',
          select: 'name college',
          populate: { path: 'college', select: 'name code' },
        },
        { path: 'program', select: 'name code durationYears' },
        { path: 'course', select: 'name code' },
        { path: 'academicSession', select: 'label yearNumber isActive' },
      ],
    });

  let promoted = 0;
  let completed = 0;

  for (const enrollment of activeEnrollments) {
    const section = enrollment.section;
    if (!section?.academicSession || section.academicSession.isActive) continue;

    const program = section.program || await Program.findById(section.program).select('durationYears');
    const maxStudyYear = Number(program?.durationYears || 0);

    if (maxStudyYear && Number(section.studyYear || 0) >= maxStudyYear) {
      await graduateEnrollment(enrollment);
      completed += 1;
      continue;
    }

    const nextSection = await findNextSection(section);
    if (!nextSection) continue;

    await promoteEnrollment(enrollment, nextSection);
    promoted += 1;
  }

  return { promoted, completed };
};

module.exports = {
  runAutomaticStudentPromotions,
};
