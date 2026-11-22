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

// Ward & Council listings and CRUD for administrative use
router.get('/wards', requireRole('admin', 'supervisor'), admin.getAllWards);
router.post('/wards', requireRole('admin'), admin.createWard);
router.put('/wards/:id', requireRole('admin'), admin.updateWard);
router.delete('/wards/:id', requireRole('admin'), admin.deleteWard);

router.get('/councils', requireRole('admin', 'supervisor'), admin.getAllCouncils);
router.post('/councils', requireRole('admin'), admin.createCouncil);
router.put('/councils/:id', requireRole('admin'), admin.updateCouncil);
router.delete('/councils/:id', requireRole('admin'), admin.deleteCouncil);

// Verification Queue endpoints (Admin & Supervisor)
router.get('/verifications', requireRole('admin', 'supervisor'), admin.getVerificationQueue);
router.post('/verifications/:id/approve', requireRole('admin', 'supervisor'), admin.approveVerification);
router.post('/verifications/:id/reject', requireRole('admin', 'supervisor'), admin.rejectVerification);

// Officer management endpoints (Admin only)
router.get('/officers', requireRole('admin'), admin.getAllOfficers);
router.post('/officers', requireRole('admin'), admin.createOfficer);
router.put('/officers/:id', requireRole('admin'), admin.updateOfficer);
router.delete('/officers/:id', requireRole('admin'), admin.deleteOfficer);

module.exports = router;
