const express = require('express');
const router  = express.Router();
const { getQueueStats, emailQueue } = require('../queues/emailQueue');
const { protect, authorize }       = require('../middleware/auth');

// @desc    Get queue statistics — admin only
// @route   GET /api/queue/stats
// @access  Private (admin)
router.get('/stats', protect, authorize('admin'), async (req, res, next) => {
  try {
    const stats = await getQueueStats();
    res.json({ success: true, data: stats });
  } catch (error) { next(error); }
});

// @desc    Get failed jobs — for debugging
// @route   GET /api/queue/failed
// @access  Private (admin)
router.get('/failed', protect, authorize('admin'), async (req, res, next) => {
  try {
    const failedJobs = await emailQueue.getFailed(0, 20);
    const jobs = failedJobs.map(job => ({
      id:          job.id,
      name:        job.name,
      data:        { ...job.data, toEmail: job.data.toEmail }, // don't expose sensitive data
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp:   job.timestamp,
    }));
    res.json({ success: true, data: jobs });
  } catch (error) { next(error); }
});

// @desc    Retry failed jobs
// @route   POST /api/queue/retry-failed
// @access  Private (admin)
router.post('/retry-failed', protect, authorize('admin'), async (req, res, next) => {
  try {
    const failedJobs = await emailQueue.getFailed();
    await Promise.all(failedJobs.map(job => job.retry()));
    res.json({ success: true, message: `Retrying ${failedJobs.length} failed jobs` });
  } catch (error) { next(error); }
});

module.exports = router;
