const express  = require('express');
const router   = express.Router();
const { chat, categorize, preTicket, summarize, getFAQs, getSuggestions, createFAQ, updateFAQ, deleteFAQ, copilot } = require('../controllers/chatController');
const { protect, permissionMiddleware, checkPermission } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Stricter rate limit for AI endpoint — 30 requests per hour per user
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      30,
  keyGenerator: (req) => req.user?.id || req.ip, // per-user limit
  message:  { success: false, message: 'AI chat limit reached. Try again in 1 hour.' },
});

router.post('/',                    protect, aiLimiter, chat);
router.post('/copilot',             protect, aiLimiter, copilot);
router.post('/categorize',          protect, categorize);
router.post('/pre-ticket',          protect, aiLimiter, preTicket);
router.get('/summarize/:ticketId',  protect, permissionMiddleware('canHandleTickets'), summarize);
router.get('/faqs',                 protect, checkPermission('view', 'faq'), getFAQs);
router.post('/faqs',                protect, checkPermission('create', 'faq'), createFAQ);
router.put('/faqs/:id',             protect, checkPermission('edit', 'faq'), updateFAQ);
router.delete('/faqs/:id',          protect, checkPermission('delete', 'faq'), deleteFAQ);
router.get('/suggestions',          protect, getSuggestions);

module.exports = router;
