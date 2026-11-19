const express = require('express');
const router = express.Router();
const admin = require('../controllers/adminController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// All admin routes require authentication and admin or supervisor privileges
router.use(authenticate);

// Analytics endpoints
router.get('/stats', requireRole('admin', 'supervisor'), admin.getAdminStats);
router.get('/analytics/issues', requireRole('admin', 'supervisor'), admin.getIssueAnalytics);
router.get('/analytics/export', requireRole('admin', 'supervisor'), admin.exportAnalytics);

// Ward & Council listings for administrative use
router.get('/wards', requireRole('admin', 'supervisor'), admin.getAllWards);
router.get('/councils', requireRole('admin', 'supervisor'), admin.getAllCouncils);

// Officer management endpoints (Admin only)
router.get('/officers', requireRole('admin'), admin.getAllOfficers);
router.put('/officers/:id', requireRole('admin'), admin.updateOfficer);
router.delete('/officers/:id', requireRole('admin'), admin.deleteOfficer);

module.exports = router;
