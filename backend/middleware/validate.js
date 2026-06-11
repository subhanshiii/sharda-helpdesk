const { body, param, validationResult } = require('express-validator');

// ── Generic validation runner ──────────────────────────
// Usage: router.post('/route', validate(rules), handler)
const validate = (validations) => async (req, res, next) => {
  for (const validation of validations) {
    const result = await validation.run(req);
    if (result.errors.length) break;
  }

  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const formatted = errors.array().map((err) => ({
    field: err.path,
    message: err.msg,
  }));

  return res.status(400).json({
    success: false,
    message: formatted[0]?.message || 'Validation failed',
    errors: formatted,
  });
};

// ── Shared param rules ─────────────────────────────────
const mongoIdParam = (paramName = 'id') =>
  param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName} format`);

// ── Ticket creation rules ──────────────────────────────
const createTicketRules = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title must be 200 characters or less')
    .escape(),
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ max: 5000 }).withMessage('Description must be 5000 characters or less'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Category must be 100 characters or less'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be low, medium, high, or urgent'),
];

// ── User creation rules ────────────────────────────────
const createUserRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must be 100 characters or less'),
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role')
    .optional()
    .isIn(['student', 'faculty', 'staff', 'admin'])
    .withMessage('Role must be student, faculty, staff, or admin'),
];

// ── Academic record rules (generic for CRUD resources) ──
const academicNameCodeRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 200 }).withMessage('Name must be 200 characters or less'),
  body('code')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Code must be 50 characters or less')
    .customSanitizer((value) => (value ? value.toUpperCase() : value)),
];

// ── Org unit rules ─────────────────────────────────────
const orgUnitRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Unit name is required')
    .isLength({ max: 200 }).withMessage('Name must be 200 characters or less'),
  body('code')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Code must be 50 characters or less'),
  body('type')
    .isIn(['academic', 'operational'])
    .withMessage('Type must be academic or operational'),
  body('collegeId')
    .optional({ values: 'null' })
    .isMongoId().withMessage('Invalid college ID'),
  body('linkedDepartmentId')
    .optional({ values: 'null' })
    .isMongoId().withMessage('Invalid department ID'),
];

// ── Announcement rules ─────────────────────────────────
const announcementRules = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 300 }).withMessage('Title must be 300 characters or less'),
  body('content')
    .trim()
    .notEmpty().withMessage('Content is required')
    .isLength({ max: 10000 }).withMessage('Content must be 10000 characters or less'),
];

// ── Section rules ──────────────────────────────────────
const sectionRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Section name is required')
    .isLength({ max: 50 }).withMessage('Section name must be 50 characters or less'),
  body('program')
    .notEmpty().withMessage('Program is required')
    .isMongoId().withMessage('Invalid program ID'),
  body('department')
    .notEmpty().withMessage('Department is required')
    .isMongoId().withMessage('Invalid department ID'),
  body('capacity')
    .optional()
    .isInt({ min: 1, max: 1000 }).withMessage('Capacity must be between 1 and 1000'),
];

// ── Subject rules ──────────────────────────────────────
const subjectRules = [
  body('code')
    .trim()
    .notEmpty().withMessage('Subject code is required')
    .isLength({ max: 50 }).withMessage('Code must be 50 characters or less'),
  body('name')
    .trim()
    .notEmpty().withMessage('Subject name is required')
    .isLength({ max: 200 }).withMessage('Name must be 200 characters or less'),
  body('department')
    .notEmpty().withMessage('Department is required')
    .isMongoId().withMessage('Invalid department ID'),
  body('program')
    .notEmpty().withMessage('Program is required')
    .isMongoId().withMessage('Invalid program ID'),
  body('credits')
    .optional()
    .isInt({ min: 0, max: 30 }).withMessage('Credits must be between 0 and 30'),
  body('term')
    .optional()
    .isInt({ min: 1, max: 12 }).withMessage('Term must be between 1 and 12'),
  body('type')
    .optional()
    .isIn(['core', 'elective', 'common'])
    .withMessage('Type must be core, elective, or common'),
];

module.exports = {
  validate,
  mongoIdParam,
  createTicketRules,
  createUserRules,
  academicNameCodeRules,
  orgUnitRules,
  announcementRules,
  sectionRules,
  subjectRules,
};
