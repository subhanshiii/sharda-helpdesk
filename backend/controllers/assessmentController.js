const assessmentService = require('../services/assessmentService');

exports.listAssessments = async (req, res, next) => {
  try {
    const result = await assessmentService.listAssessments(req.user, req.query);
    res.status(200).json({ success: true, count: result.rows.length, total: result.total, data: result.rows, page: result.page, limit: result.limit });
  } catch (error) {
    next(error);
  }
};

exports.getAssessment = async (req, res, next) => {
  try {
    const assessment = await assessmentService.getAssessmentById(req.user, req.params.id);
    res.status(200).json({ success: true, data: assessment });
  } catch (error) {
    next(error);
  }
};

exports.createAssessment = async (req, res, next) => {
  try {
    const assessment = await assessmentService.createAssessment(req.user, req.body, req);
    res.status(201).json({ success: true, data: assessment });
  } catch (error) {
    next(error);
  }
};

exports.updateAssessment = async (req, res, next) => {
  try {
    const assessment = await assessmentService.updateAssessment(req.user, req.params.id, req.body, req);
    res.status(200).json({ success: true, data: assessment });
  } catch (error) {
    next(error);
  }
};

exports.deleteAssessment = async (req, res, next) => {
  try {
    await assessmentService.deleteAssessment(req.user, req.params.id, req);
    res.status(200).json({ success: true, message: 'Assessment deleted' });
  } catch (error) {
    next(error);
  }
};

exports.getStudentAssessmentOverview = async (req, res, next) => {
  try {
    const studentId = req.params.studentId || req.user.id;
    const data = await assessmentService.getStudentAssessmentOverview(studentId, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getAssessmentSummary = async (req, res, next) => {
  try {
    const data = await assessmentService.getAssessmentDashboardSummary(req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
