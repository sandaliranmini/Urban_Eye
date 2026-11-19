const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
  const councilId = Number.parseInt(process.env.COUNCIL_ID, 10) || Number.parseInt(req.query.council_id, 10) || null;

  const [rows] = councilId
    ? await db.query('SELECT * FROM WARD WHERE COUNCIL_ID = ? ORDER BY WARD_ID', [councilId])
    : await db.query('SELECT * FROM WARD ORDER BY WARD_ID');

  res.json(rows);
});

module.exports = router;