const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { authenticate } = require('../middleware/authMiddleware');
const resolution = require('../controllers/resolutionController');

const uploadPhoto = (req, res, next) =>
  upload.single('photo')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Photo must be smaller than 5 MB' : err.message;
    res.status(400).json({ success: false, message });
  });

router.post('/:id/confirm', authenticate, resolution.confirmResolution);
router.post('/:id/dispute', authenticate, uploadPhoto, resolution.disputeResolution);
router.get('/:id', authenticate, resolution.getVerification);

module.exports = router;
