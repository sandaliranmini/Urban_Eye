const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const issues = require('../controllers/issueController');
const resolution = require('../controllers/resolutionController');

// Turns multer errors (file too big, wrong type) into clean 400 JSON responses
const uploadPhoto = (req, res, next) =>
  upload.single('photo')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Photo must be smaller than 5 MB' : err.message;
    res.status(400).json({ success: false, message });
  });

// Public
router.get('/', issues.listIssues);

// These two MUST stay above '/:id', otherwise Express treats "my-reports" and "ward" as an id
router.get('/my-reports', authenticate, issues.myReports);
router.get('/ward/:wardId', issues.issuesByWard);

router.post('/check-duplicates', authenticate, issues.checkDuplicates);

router.get('/:id', issues.getIssue);
router.post('/', authenticate, uploadPhoto, issues.createIssue);
router.put('/:id/status', authenticate, requireRole('officer', 'field_officer', 'supervisor', 'admin'), issues.updateStatus);

// Resolution proof submission (Officers move In Progress -> Resolved, starts 14-day timer)
router.post(
  '/:id/resolution',
  authenticate,
  requireRole('officer', 'field_officer', 'supervisor', 'admin'),
  uploadPhoto,
  resolution.submitProof
);

// Reporter verification endpoints (Confirm or Dispute)
router.post('/:id/verify/confirm', authenticate, resolution.confirmResolution);
router.post('/:id/verify/dispute', authenticate, uploadPhoto, resolution.disputeResolution);
router.get('/:id/verification', authenticate, resolution.getVerification);

module.exports = router;
