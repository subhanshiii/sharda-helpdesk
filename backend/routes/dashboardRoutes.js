const express = require('express');
const router = express.Router();
const {
  getDashboardWorkspace,
  createPersonalTask,
  updatePersonalTask,
  deletePersonalTask,
  updateWidgetPreferences,
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getDashboardWorkspace);
router.post('/tasks', createPersonalTask);
router.put('/tasks/:taskId', updatePersonalTask);
router.delete('/tasks/:taskId', deletePersonalTask);
router.put('/preferences', updateWidgetPreferences);

module.exports = router;
