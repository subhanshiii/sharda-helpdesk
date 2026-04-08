const express = require('express');
const router = express.Router();
const {
  getOpportunities, getOpportunity, createOpportunity,
  updateOpportunity, deleteOpportunity, toggleBookmark, getBookmarked,
} = require('../controllers/opportunityController');
const { protect, permissionMiddleware } = require('../middleware/auth');

router.get('/bookmarked', protect, getBookmarked);

router.route('/')
  .get(protect, getOpportunities)
  .post(protect, permissionMiddleware('canPostNotice'), createOpportunity);

router.route('/:id')
  .get(protect, getOpportunity)
  .put(protect, permissionMiddleware('canPostNotice'), updateOpportunity)
  .delete(protect, permissionMiddleware('canPostNotice'), deleteOpportunity);

router.put('/:id/bookmark', protect, toggleBookmark);

module.exports = router;
