const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const devAuth = require('../middleware/devAuth');
const issues = require('../controllers/issueController');

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
// TODO: replace devAuth with authMiddleware when Peiris merges auth
router.get('/my-reports', devAuth, issues.myReports);
router.get('/ward/:wardId', issues.issuesByWard);

// TODO: replace devAuth with authMiddleware when Peiris merges auth
router.post('/check-duplicates', devAuth, issues.checkDuplicates);

router.get('/:id', issues.getIssue);

// TODO: replace devAuth with authMiddleware when Peiris merges auth
router.post('/', devAuth, uploadPhoto, issues.createIssue);

// TODO: replace devAuth with authMiddleware + an officer role check when Peiris merges auth
router.put('/:id/status', devAuth, issues.updateStatus);

// Other cards add their routes below this line, for example:
// router.post('/:id/resolution', ...);

module.exports = router;