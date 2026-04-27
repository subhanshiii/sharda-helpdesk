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
const { verifyAuth, checkPermission } = require('../middleware/auth');
const upload = require('../middleware/upload');

router
  .route('/')
  .get(verifyAuth, getAssignments)
  .post(verifyAuth, checkPermission('create', 'assignments'), upload.array('attachments', 5), createAssignment);

router
  .route('/:id')
  .get(verifyAuth, getAssignment)
  .put(verifyAuth, checkPermission('edit', 'assignments'), upload.array('attachments', 5), updateAssignment)
  .delete(verifyAuth, checkPermission('delete', 'assignments'), deleteAssignment);

router
  .route('/:id/submissions')
  .post(verifyAuth, submitAssignment);

router
  .route('/:id/submissions/:submissionId/grade')
  .put(verifyAuth, checkPermission('edit', 'assignments'), gradeSubmission);

module.exports = router;
