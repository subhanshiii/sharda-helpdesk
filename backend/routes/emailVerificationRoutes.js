const express = require('express');
const router = express.Router();
const { verifyEmail } = require('../controllers/authController');

router.get('/', verifyEmail);

module.exports = router;
