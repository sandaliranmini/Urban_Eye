const express = require('express');
const router = express.Router();
const announcements = require('../controllers/announcementController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Public / Citizens & Officers can read announcements
router.get('/', announcements.listAnnouncements);
router.get('/ward/:wardId', announcements.getAnnouncementsByWard);
router.get('/:id', announcements.getAnnouncement);

// Officers and Admins can create, update, and delete announcements
router.post(
  '/',
  authenticate,
  requireRole('officer', 'field_officer', 'supervisor', 'admin'),
  announcements.createAnnouncement
);

router.put(
  '/:id',
  authenticate,
  requireRole('officer', 'field_officer', 'supervisor', 'admin'),
  announcements.updateAnnouncement
);

router.delete(
  '/:id',
  authenticate,
  requireRole('officer', 'field_officer', 'supervisor', 'admin'),
  announcements.deleteAnnouncement
);

module.exports = router;
