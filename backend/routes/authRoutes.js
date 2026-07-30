const express = require('express');
const router = express.Router();
const { login, getMe } = require('../controllers/authController');
const { loginRules, validate } = require('../middleware/validators');
const { loginLimiter } = require('../middleware/rateLimiter');
const { protect } = require('../middleware/auth');

router.post('/login', loginLimiter, loginRules, validate, login);
router.get('/me', protect, getMe);

module.exports = router;
