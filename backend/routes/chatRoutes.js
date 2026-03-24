const express = require('express');
const router  = express.Router();
const { chat, getFAQs, getSuggestions } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

router.post('/',            protect, chat);
router.get('/faqs',         protect, getFAQs);
router.get('/suggestions',  protect, getSuggestions);

module.exports = router;
