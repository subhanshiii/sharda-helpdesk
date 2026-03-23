const express = require('express');
const router = express.Router();
const {
  getOpportunities, getOpportunity, createOpportunity,
  updateOpportunity, deleteOpportunity, toggleBookmark, getBookmarked,
} = require('../controllers/opportunityController');
const { protect, authorize } = require('../middleware/auth');

router.get('/bookmarked', protect, getBookmarked);

router.route('/')
  .get(protect, getOpportunities)
  .post(protect, authorize('admin', 'clubhead'), createOpportunity);

router.route('/:id')
  .get(protect, getOpportunity)
  .put(protect, authorize('admin', 'clubhead'), updateOpportunity)
  .delete(protect, authorize('admin', 'clubhead'), deleteOpportunity);

router.put('/:id/bookmark', protect, toggleBookmark);

module.exports = router;
