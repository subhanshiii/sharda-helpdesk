const express = require('express');
const { protect } = require('../middleware/auth');
const { getTodaysThought } = require('../controllers/motivationController');

const router = express.Router();

router.get('/today', protect, getTodaysThought);

module.exports = router;
