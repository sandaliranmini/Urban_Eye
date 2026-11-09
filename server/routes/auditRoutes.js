const express = require('express');
const router = express.Router();
const audit = require('../controllers/auditController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Administrative audit trails
router.get('/', authenticate, requireRole('admin', 'supervisor'), audit.getAuditLogs);
router.get('/stats', authenticate, requireRole('admin', 'supervisor'), audit.getAuditStats);

// Issue history timeline (accessible to reporter + officers/admins)
router.get('/issue/:id', authenticate, audit.getIssueAuditLogs);

module.exports = router;
