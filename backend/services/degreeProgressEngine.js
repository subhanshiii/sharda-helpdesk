const StudentProgress = require('../models/StudentProgress');
const PromotionRule = require('../models/PromotionRule');
const AcademicAuditLog = require('../models/AcademicAuditLog');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Subject = require('../models/Subject');
const Curriculum = require('../models/Curriculum');

class DegreeProgressEngine {
  /**
   * Recalculates the credits earned and backlogs for a student based on their completed subjects.
   * In a real implementation, this would aggregate data from Assessment marks.
   */
  static async calculateStudentProgress(studentId) {
    const progress = await StudentProgress.findOne({ student: studentId }).populate('batch');
    if (!progress) throw new Error('Student progress record not found');

    // For this simulation, we assume `Enrollment` status='completed' means the subject/semester was passed
    // In a full implementation, you'd check Subject pass/fail from Assessment/Marks models
    const completedEnrollments = await Enrollment.find({
      student: studentId,
      status: 'completed',
      semester: { $ne: null }
    }).populate('semester');

    // Calculate credits from semester completion or specific subject completion
    // Assuming each semester has a totalCredits field
    let earnedCredits = 0;
    const completedSemesterIds = new Set();

    for (const enrollment of completedEnrollments) {
      if (enrollment.semester && !completedSemesterIds.has(String(enrollment.semester._id))) {
        earnedCredits += enrollment.semester.totalCredits || 0;
        completedSemesterIds.add(String(enrollment.semester._id));
      }
    }

    progress.creditsEarned = earnedCredits;
    await progress.save();

    await AcademicAuditLog.create({
      student: studentId,
      action: 'CreditUpdate',
      reason: `Credits recalculated to ${earnedCredits}`,
    });

    return progress;
  }

  /**
   * Evaluates if a student can be promoted based on the course rules.
   */
  static async evaluatePromotion(studentId) {
    const progress = await StudentProgress.findOne({ student: studentId }).populate('batch');
    if (!progress) throw new Error('Student progress record not found');
    
    if (progress.status === 'Graduated') return progress;

    const rules = await PromotionRule.findOne({ course: progress.batch.course, isActive: true });
    if (!rules) throw new Error('No promotion rules configured for this course');

    const hasSufficientCredits = progress.creditsEarned >= rules.minCreditsPerSemester * progress.currentSemester;
    const hasAllowedBacklogs = progress.backlogs.length <= rules.maxActiveBacklogs;
    const hasMinCGPA = progress.cgpa >= rules.minCGPA;

    let newStatus = progress.status;
    let actionLabel = '';
    let reason = '';

    // Graduation Check
    if (progress.creditsEarned >= progress.totalCreditsRequired && progress.totalCreditsRequired > 0) {
      newStatus = 'Graduated';
      actionLabel = 'Graduated';
      reason = 'Fulfilled all degree credit requirements.';
    } else if (hasSufficientCredits && hasAllowedBacklogs && hasMinCGPA) {
      // Promotion Check
      progress.currentSemester += 1;
      newStatus = 'Active';
      actionLabel = 'Promoted';
      reason = `Promoted to semester ${progress.currentSemester}. Met all criteria.`;
    } else if (progress.backlogs.length > rules.maxActiveBacklogs * 2) {
      // Detained Check (e.g., severe backlogs)
      newStatus = 'Detained';
      actionLabel = 'Detained';
      reason = 'Failed to meet minimum progression criteria. Too many backlogs.';
    } else {
      // Probation Check
      newStatus = 'Probation';
      actionLabel = 'Probation';
      reason = 'Failed to meet criteria but within grace limits. Placed on academic probation.';
      progress.currentSemester += 1; // Sometimes allowed to promote with probation
    }

    progress.status = newStatus;
    await progress.save();

    await AcademicAuditLog.create({
      student: studentId,
      action: actionLabel,
      reason: reason,
      metadata: {
        cgpa: progress.cgpa,
        creditsEarned: progress.creditsEarned,
        backlogs: progress.backlogs.length
      }
    });

    return progress;
  }
}

module.exports = DegreeProgressEngine;
