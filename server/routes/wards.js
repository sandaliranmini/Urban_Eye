const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET all wards
router.get('/', async (req, res) => {
  try {
    // Using uppercase WARD because your schema.sql uses uppercase table names
    const [rows] = await db.query('SELECT * FROM WARD');
    res.json(rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;