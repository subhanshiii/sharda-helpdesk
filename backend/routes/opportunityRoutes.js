const express = require('express');
const router = express.Router();
const {
  getOpportunities, getOpportunity, createOpportunity,
  updateOpportunity, deleteOpportunity, toggleBookmark, getBookmarked,
} = require('../controllers/opportunityController');
const { verifyAuth, checkPermission } = require('../middleware/auth');

router.get('/bookmarked', verifyAuth, getBookmarked);

router.route('/')
  .get(verifyAuth, getOpportunities)
  .post(verifyAuth, checkPermission('create', 'opportunities'), createOpportunity);

router.route('/:id')
  .get(verifyAuth, getOpportunity)
  .put(verifyAuth, checkPermission('edit', 'opportunities'), updateOpportunity)
  .delete(verifyAuth, checkPermission('delete', 'opportunities'), deleteOpportunity);

router.put('/:id/bookmark', verifyAuth, toggleBookmark);

module.exports = router;
