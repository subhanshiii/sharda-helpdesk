const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp          = require('hpp');

// ── Helmet: sets secure HTTP headers ──────────────────
// Prevents clickjacking, XSS, MIME sniffing, and more
exports.helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:', 'https:'],
      scriptSrc:  ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // needed for file uploads
});

// ── Rate limiting: general API ─────────────────────────
// 100 requests per 15 minutes per IP
exports.generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Rate limiting: auth routes (stricter) ──────────────
// 10 login attempts per 15 minutes per IP
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // don't count successful logins
});

// ── Rate limiting: forgot password ────────────────────
// 5 reset attempts per hour per IP
exports.passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many password reset attempts. Please try again in 1 hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── MongoDB injection sanitizer ───────────────────────
// Removes $ and . from user input to prevent NoSQL injection
exports.mongoSanitize = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`⚠️  Sanitized suspicious input from ${req.ip} in field: ${key}`);
  },
});

// ── HTTP Parameter Pollution prevention ───────────────
exports.hppProtection = hpp({
  whitelist: ['status', 'category', 'priority', 'type'], // allow arrays for these
});
