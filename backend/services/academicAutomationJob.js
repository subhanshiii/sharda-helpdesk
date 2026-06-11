const StudentProgress = require('../models/StudentProgress');
const DegreeProgressEngine = require('./degreeProgressEngine');

class AcademicAutomationJob {
  /**
   * Run end of semester automation for a specific batch.
   */
  static async runSemesterEvaluation(batchId) {
    const studentsInProgress = await StudentProgress.find({ batch: batchId, status: { $ne: 'Graduated' } });
    
    let promoted = 0;
    let detained = 0;
    let graduated = 0;
    let probation = 0;

    for (const progress of studentsInProgress) {
      try {
        await DegreeProgressEngine.calculateStudentProgress(progress.student);
        const result = await DegreeProgressEngine.evaluatePromotion(progress.student);
        
        if (result.status === 'Active') promoted++;
        if (result.status === 'Detained') detained++;
        if (result.status === 'Probation') probation++;
        if (result.status === 'Graduated') graduated++;
      } catch (err) {
        console.error(`Failed to evaluate student ${progress.student}:`, err.message);
      }
    }

    return {
      totalEvaluated: studentsInProgress.length,
      promoted,
      detained,
      probation,
      graduated
    };
  }
}

module.exports = AcademicAutomationJob;
