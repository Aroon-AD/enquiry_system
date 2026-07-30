const rateLimit = require('express-rate-limit');

// Strict limiter for the public enquiry submission endpoint — mitigates spam/abuse
const publicSubmissionLimiter = rateLimit({
  windowMs: (Number(process.env.PUBLIC_RATE_LIMIT_WINDOW_MIN) || 15) * 60 * 1000,
  max: Number(process.env.PUBLIC_RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many enquiries submitted from this address. Please try again later.',
  },
});

// Looser limiter for authenticated admin API traffic
const apiLimiter = rateLimit({
  windowMs: (Number(process.env.API_RATE_LIMIT_WINDOW_MIN) || 15) * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
  },
});

// Very strict limiter specifically for login, to blunt brute-force attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
});

module.exports = { publicSubmissionLimiter, apiLimiter, loginLimiter };
