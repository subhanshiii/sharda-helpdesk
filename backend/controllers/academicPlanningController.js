const academicPlanningService = require('../services/academicPlanningService');

// GET /academics/courses/:id/subjects?term=
exports.getSubjectsForCourse = async (req, res, next) => {
  try {
    const subjects = await academicPlanningService.listSubjectsForCourse(req.params.id, {
      term: req.query.term,
    });
    res.status(200).json({ success: true, count: subjects.length, data: subjects });
  } catch (error) {
    next(error);
  }
};

// GET /academics/sections/:id/active-subjects?term=
exports.getActiveSubjectsForSection = async (req, res, next) => {
  try {
    const data = await academicPlanningService.listActiveSubjectsForSection(req.params.id, {
      term: req.query.term,
    });
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};
