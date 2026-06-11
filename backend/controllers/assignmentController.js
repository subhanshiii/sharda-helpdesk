const assignmentService = require('../services/assignmentService');

exports.getAssignments = async (req, res, next) => {
  try {
    const assignments = await assignmentService.listAssignments(req.user, {
      status: req.query.status,
      search: req.query.search,
      limit: req.query.limit,
      visibilityTier: req.query.visibilityTier,
      visibilityRole: req.query.visibilityRole,
      collegeId: req.query.collegeId,
      departmentId: req.query.departmentId,
      programId: req.query.programId,
      courseId: req.query.courseId,
      studyYear: req.query.studyYear,
      sectionId: req.query.sectionId,
      subjectId: req.query.subjectId,
    });
    res.status(200).json({ success: true, count: assignments.length, data: assignments });
  } catch (error) {
    next(error);
  }
};

exports.getAssignment = async (req, res, next) => {
  try {
    const assignment = await assignmentService.getAssignmentById(req.params.id, req.user);
    res.status(200).json({ success: true, data: assignment });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

exports.createAssignment = async (req, res, next) => {
  try {
    const assignment = await assignmentService.createAssignment(req.body, req.user, req.files);
    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    next(error);
  }
};

exports.updateAssignment = async (req, res, next) => {
  try {
    const assignment = await assignmentService.updateAssignment(req.params.id, req.body, req.user, req.files);
    res.status(200).json({ success: true, data: assignment });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

exports.deleteAssignment = async (req, res, next) => {
  try {
    await assignmentService.deleteAssignment(req.params.id, req.user);
    res.status(200).json({ success: true, message: 'Assignment deleted' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

exports.submitAssignment = async (req, res, next) => {
  try {
    const submission = await assignmentService.submitAssignment(req.params.id, req.body, req.user, req.files);
    res.status(200).json({ success: true, data: submission });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

exports.gradeSubmission = async (req, res, next) => {
  try {
    const submission = await assignmentService.gradeSubmission(req.params.id, req.params.submissionId, req.body, req.user);
    res.status(200).json({ success: true, data: submission });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};
