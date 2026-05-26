/* eslint-disable no-console */
/**
 * Academic Planning Foundation migration (idempotent, dry-run capable).
 *
 * Goals:
 *  1. Backfill `term` on Subject documents (default 1 if missing).
 *  2. For every legacy Subject.course value, ensure a CourseSubject row exists.
 *  3. Sync TeachingAssignment.term from Subject.term where missing.
 *  4. Audit Sections that do not have a `course` linked (so the controller-level
 *     "course is required" enforcement can surface manual fixes).
 *
 * Usage:
 *   node backend/scripts/migrateAcademicPlanningFoundation.js [--dry-run] [--default-term=1]
 *
 * The script never deletes data. It is safe to run repeatedly.
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Subject = require('../models/Subject');
const CourseSubject = require('../models/CourseSubject');
const Section = require('../models/Section');
const TeachingAssignment = require('../models/TeachingAssignment');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const defaultTermArg = args.find((arg) => arg.startsWith('--default-term='));
  const defaultTerm = defaultTermArg ? Number(defaultTermArg.split('=')[1]) : 1;
  return {
    dryRun,
    defaultTerm: Number.isFinite(defaultTerm) && defaultTerm >= 1 && defaultTerm <= 12 ? defaultTerm : 1,
  };
};

const backfillSubjectTerms = async ({ dryRun, defaultTerm }) => {
  const filter = { $or: [{ term: { $exists: false } }, { term: null }] };
  const candidates = await Subject.find(filter).select('_id term').lean();
  if (!candidates.length) {
    console.log('✓ Subject.term: all subjects already have a term');
    return { updated: 0 };
  }

  console.log(`Subject.term: ${candidates.length} subjects missing term (will set to ${defaultTerm})`);
  if (dryRun) return { updated: 0, candidates: candidates.length };

  const result = await Subject.updateMany(filter, { $set: { term: defaultTerm } });
  return { updated: result.modifiedCount || 0 };
};

const backfillCourseSubjectFromLegacy = async ({ dryRun }) => {
  const subjectsWithLegacyCourse = await Subject.find({
    course: { $ne: null },
  }).select('_id course').lean();

  if (!subjectsWithLegacyCourse.length) {
    console.log('✓ CourseSubject: no legacy Subject.course rows to backfill');
    return { upserts: 0 };
  }

  let upserts = 0;
  let alreadyMapped = 0;
  for (const subject of subjectsWithLegacyCourse) {
    const exists = await CourseSubject.findOne({
      course: subject.course,
      subject: subject._id,
    }).lean();
    if (exists) {
      if (!exists.isActive && !dryRun) {
        await CourseSubject.updateOne({ _id: exists._id }, { $set: { isActive: true } });
      }
      alreadyMapped += 1;
      continue;
    }
    if (dryRun) {
      upserts += 1;
      continue;
    }
    await CourseSubject.create({
      course: subject.course,
      subject: subject._id,
      isActive: true,
    });
    upserts += 1;
  }

  console.log(`CourseSubject: ${upserts} new mappings created, ${alreadyMapped} already mapped`);
  return { upserts, alreadyMapped };
};

const syncTeachingAssignmentTerms = async ({ dryRun }) => {
  const candidates = await TeachingAssignment.find({
    $or: [{ term: { $exists: false } }, { term: null }],
    isActive: true,
  })
    .select('_id subject term')
    .lean();

  if (!candidates.length) {
    console.log('✓ TeachingAssignment.term: all active assignments already have term');
    return { updated: 0 };
  }

  const subjectIds = [...new Set(candidates.map((entry) => String(entry.subject)).filter(Boolean))];
  const subjects = await Subject.find({ _id: { $in: subjectIds } }).select('_id term').lean();
  const termBySubjectId = new Map(subjects.map((entry) => [String(entry._id), entry.term]));

  let updated = 0;
  for (const candidate of candidates) {
    const subjectKey = String(candidate.subject);
    const subjectTerm = termBySubjectId.get(subjectKey);
    if (!Number.isFinite(subjectTerm)) continue;
    if (dryRun) {
      updated += 1;
      continue;
    }
    await TeachingAssignment.updateOne(
      { _id: candidate._id },
      { $set: { term: subjectTerm } }
    );
    updated += 1;
  }

  console.log(`TeachingAssignment.term: ${updated} rows updated to match Subject.term`);
  return { updated };
};

const auditSectionsWithoutCourse = async () => {
  const sectionsWithoutCourse = await Section.find({
    $or: [{ course: { $exists: false } }, { course: null }],
  })
    .select('_id name program academicSession')
    .populate('program', 'name code')
    .populate('academicSession', 'label yearNumber')
    .lean();

  if (!sectionsWithoutCourse.length) {
    console.log('✓ Section audit: every section has a course');
    return { gaps: 0 };
  }

  console.warn(`⚠ Section audit: ${sectionsWithoutCourse.length} sections missing course (manual fix required)`);
  sectionsWithoutCourse.forEach((section) => {
    console.warn(
      ` - sectionId=${section._id} name="${section.name || ''}" program="${section.program?.name || section.program?._id || ''}" session="${section.academicSession?.label || ''}"`
    );
  });
  return { gaps: sectionsWithoutCourse.length };
};

const run = async () => {
  const options = parseArgs();
  console.log(`Running academic planning migration (dry-run=${options.dryRun}, defaultTerm=${options.defaultTerm})`);

  await connectDB();

  try {
    const subjectResult = await backfillSubjectTerms(options);
    const courseSubjectResult = await backfillCourseSubjectFromLegacy(options);
    const teachingAssignmentResult = await syncTeachingAssignmentTerms(options);
    const sectionAudit = await auditSectionsWithoutCourse();

    console.log('\nSummary:');
    console.log(JSON.stringify({
      subjectResult,
      courseSubjectResult,
      teachingAssignmentResult,
      sectionAudit,
      dryRun: options.dryRun,
    }, null, 2));
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

if (require.main === module) {
  run();
}

module.exports = { run };
