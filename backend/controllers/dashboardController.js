const dashboardService = require('../services/dashboardService');

exports.getDashboardWorkspace = async (req, res, next) => {
  try {
    const data = await dashboardService.getDashboardWorkspace(req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.createPersonalTask = async (req, res, next) => {
  try {
    const task = await dashboardService.createPersonalTask(req.user.id, req.body);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

exports.updatePersonalTask = async (req, res, next) => {
  try {
    const task = await dashboardService.updatePersonalTask(req.user.id, req.params.taskId, req.body);
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

exports.deletePersonalTask = async (req, res, next) => {
  try {
    await dashboardService.deletePersonalTask(req.user.id, req.params.taskId);
    res.status(200).json({ success: true, message: 'Task deleted' });
  } catch (error) {
    next(error);
  }
};

exports.updateWidgetPreferences = async (req, res, next) => {
  try {
    const preferences = await dashboardService.updateWidgetPreferences(req.user.id, req.body);
    res.status(200).json({ success: true, data: preferences });
  } catch (error) {
    next(error);
  }
};
