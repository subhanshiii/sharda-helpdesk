const express = require('express');
const router = express.Router();
const {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  gradeSubmission,
} = require('../controllers/assignmentController');
const { protect, permissionMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');

router
  .route('/')
  .get(protect, getAssignments)
  .post(protect, permissionMiddleware('canManageAssignments'), upload.array('attachments', 5), createAssignment);

router
  .route('/:id')
  .get(protect, getAssignment)
  .put(protect, permissionMiddleware('canManageAssignments'), upload.array('attachments', 5), updateAssignment)
  .delete(protect, permissionMiddleware('canManageAssignments'), deleteAssignment);

router
  .route('/:id/submissions')
  .post(protect, permissionMiddleware('canSubmitAssignments'), upload.array('attachments', 5), submitAssignment);

router
  .route('/:id/submissions/:submissionId/grade')
  .put(protect, permissionMiddleware('canManageAssignments'), gradeSubmission);

module.exports = router;
