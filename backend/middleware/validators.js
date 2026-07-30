const { body, param, query, validationResult } = require('express-validator');

// Runs after a validation chain; returns 422 with field-level errors if any failed
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

const createEnquiryRules = [
  body('fullName').trim().notEmpty().withMessage('Full name is required').isLength({ max: 120 }),
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('company').optional({ checkFalsy: true }).trim().isLength({ max: 160 }),
  body('projectType')
    .optional({ checkFalsy: true })
    .isIn(['Web Development', 'Mobile App', 'Consulting', 'Design', 'Support', 'Other']),
  body('budgetRange')
    .optional({ checkFalsy: true })
    .isIn(['Under $5k', '$5k - $20k', '$20k - $50k', '$50k+', 'Not sure']),
  body('subject').trim().notEmpty().withMessage('Subject is required').isLength({ max: 200 }),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Message must be between 10 and 5000 characters'),
];

const loginRules = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const updateStatusRules = [
  param('id').isMongoId().withMessage('Invalid enquiry id'),
  body('status').isIn(['New', 'In Progress', 'On Hold', 'Resolved', 'Closed']),
];

const updatePriorityRules = [
  param('id').isMongoId().withMessage('Invalid enquiry id'),
  body('priority').isIn(['Low', 'Medium', 'High', 'Urgent']),
];

const assignRules = [
  param('id').isMongoId().withMessage('Invalid enquiry id'),
  body('adminId').optional({ nullable: true }).isMongoId().withMessage('Invalid admin id'),
];

const listQueryRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['New', 'In Progress', 'On Hold', 'Resolved', 'Closed']),
  query('priority').optional().isIn(['Low', 'Medium', 'High', 'Urgent']),
  query('search').optional().trim().isLength({ max: 200 }),
  query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'priority', 'status']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

const mongoIdParamRule = [param('id').isMongoId().withMessage('Invalid id')];

module.exports = {
  validate,
  createEnquiryRules,
  loginRules,
  updateStatusRules,
  updatePriorityRules,
  assignRules,
  listQueryRules,
  mongoIdParamRule,
};
