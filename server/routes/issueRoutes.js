const express = require('express');
const router = express.Router();
// Notice we are importing from the models folder
const Issue = require('../models/Issue');

// CREATE
router.post('/', async (req, res) => {
  try {
    const issueId = await Issue.create(req.body);
    res.status(201).json({ message: 'Issue reported successfully', issueId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ ALL
router.get('/', async (req, res) => {
  try {
    const issues = await Issue.findAll();
    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ ONE
router.get('/:id', async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    res.json(issue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE
router.put('/:id', async (req, res) => {
  try {
    await Issue.update(req.params.id, req.body);
    res.json({ message: 'Issue updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await Issue.delete(req.params.id);
    res.json({ message: 'Issue deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;