require('dotenv').config();
const mongoose = require('mongoose');

const Course = require('../models/Course');
const Curriculum = require('../models/Curriculum');
const Semester = require('../models/Semester');
const Subject = require('../models/Subject');
const Section = require('../models/Section');
const Enrollment = require('../models/Enrollment');
const Batch = require('../models/Batch');
const StudentProgress = require('../models/StudentProgress');
const PromotionRule = require('../models/PromotionRule');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('MongoDB Connected');
};

const migrate = async () => {
  try {
    await connectDB();
    console.log('Starting migration to Curriculum-Driven Architecture...');

    // 1. Migrate Courses to Curriculum
    const courses = await Course.find();
    console.log(`Found ${courses.length} courses to migrate.`);

    for (const course of courses) {
      let curriculum = await Curriculum.findOne({ course: course._id });
      if (!curriculum) {
        // Create default curriculum
        curriculum = await Curriculum.create({
          course: course._id,
          durationYears: 4, // Default assumption
          totalSemesters: 8,
          totalCreditsRequired: 160,
        });
        console.log(`Created Curriculum for course ${course.code}`);
      }

      // Create Semesters for Curriculum
      for (let i = 1; i <= curriculum.totalSemesters; i++) {
        await Semester.findOneAndUpdate(
          { curriculum: curriculum._id, semesterNumber: i },
          { totalCredits: 20 },
          { upsert: true, new: true }
        );
      }

      // Create default Promotion Rule
      await PromotionRule.findOneAndUpdate(
        { course: course._id },
        { minCreditsPerSemester: 15, minCGPA: 5.0, maxActiveBacklogs: 4, minAttendancePercentage: 75 },
        { upsert: true }
      );
    }

    // 2. Migrate Subjects (Map to Semesters based on 'term')
    const subjects = await Subject.find({ course: { $ne: null } });
    console.log(`Migrating ${subjects.length} subjects to Semesters...`);
    for (const subject of subjects) {
      const curriculum = await Curriculum.findOne({ course: subject.course });
      if (curriculum) {
        const semester = await Semester.findOne({ curriculum: curriculum._id, semesterNumber: subject.term || 1 });
        if (semester) {
          subject.semester = semester._id;
          await subject.save();
        }
      }
    }

    // 3. Migrate Enrollments and create Batches & StudentProgress
    const enrollments = await Enrollment.find({ status: 'active' }).populate('section');
    console.log(`Migrating ${enrollments.length} active enrollments to Batches & StudentProgress...`);
    
    for (const enrollment of enrollments) {
      const section = enrollment.section;
      if (!section || !section.course) continue;

      const enrollmentYear = new Date(enrollment.enrolledAt).getFullYear() || new Date().getFullYear();
      
      // Find or create batch
      let batch = await Batch.findOne({ course: section.course, enrollmentYear });
      if (!batch) {
        const curriculum = await Curriculum.findOne({ course: section.course });
        batch = await Batch.create({
          course: section.course,
          enrollmentYear,
          expectedGraduationYear: enrollmentYear + (curriculum ? curriculum.durationYears : 4),
        });
      }

      // Update section to link to batch
      if (!section.batch) {
        section.batch = batch._id;
        await section.save();
      }

      // Update enrollment to link to batch
      if (!enrollment.batch) {
        enrollment.batch = batch._id;
        await enrollment.save();
      }

      // Create StudentProgress
      const curriculum = await Curriculum.findOne({ course: section.course });
      await StudentProgress.findOneAndUpdate(
        { student: enrollment.student },
        {
          batch: batch._id,
          totalCreditsRequired: curriculum ? curriculum.totalCreditsRequired : 160,
          currentSemester: section.studyYear ? (section.studyYear * 2) - 1 : 1 // Guessing semester based on year
        },
        { upsert: true }
      );
    }

    console.log('Migration Complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
