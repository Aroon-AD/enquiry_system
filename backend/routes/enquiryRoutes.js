const express = require('express');
const router = express.Router();

const {
  createEnquiry,
  getEnquiries,
  getEnquiryById,
  updateStatus,
  updatePriority,
  assignEnquiry,
  updateNotes,
  deleteEnquiry,
  downloadAttachment,
  getSummaryStats,
} = require('../controllers/enquiryController');

const { protect, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { publicSubmissionLimiter } = require('../middleware/rateLimiter');
const {
  createEnquiryRules,
  updateStatusRules,
  updatePriorityRules,
  assignRules,
  listQueryRules,
  mongoIdParamRule,
  validate,
} = require('../middleware/validators');

// ---- Public route (customer-facing form) ----
router.post(
  '/',
  publicSubmissionLimiter,
  upload.array('attachments', 3),
  createEnquiryRules,
  validate,
  createEnquiry
);

// ---- Protected admin routes ----
router.get('/stats/summary', protect, getSummaryStats);
router.get('/', protect, listQueryRules, validate, getEnquiries);
router.get('/:id', protect, mongoIdParamRule, validate, getEnquiryById);
router.get('/:id/attachments/:storedName', protect, mongoIdParamRule, validate, downloadAttachment);

router.patch('/:id/status', protect, updateStatusRules, validate, updateStatus);
router.patch('/:id/priority', protect, updatePriorityRules, validate, updatePriority);
router.patch('/:id/assign', protect, assignRules, validate, assignEnquiry);
router.patch('/:id/notes', protect, mongoIdParamRule, validate, updateNotes);

// Deleting is restricted to superadmin
router.delete('/:id', protect, requireRole('superadmin'), mongoIdParamRule, validate, deleteEnquiry);

module.exports = router;
