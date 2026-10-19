// server/routes/auth.routes.js
// POST /api/auth/register - citizen registration (NIC-verified, one account per NIC, ward selected)

const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');            // mysql2/promise pool  (adjust path)
const { validateNIC } = require('../utils/nicValidator'); // adjust export name/path to match yours

const router = express.Router();
const SALT_ROUNDS = 12;

router.post('/register', async (req, res) => {
  try {
    const { full_name, nic, email, phone, password, ward_id } = req.body || {};

    // 1 Required fields
    if (!full_name || !nic || !password || !ward_id) {
      return res.status(400).json({ message: 'full_name, nic, password and ward_id are required' });
    }

    // 2 Password rules
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // 3 NIC format + date validation (old 9-digit+V/X and new 12-digit)
    const nicResult = validateNIC(nic);
    if (!nicResult || nicResult.valid === false) {
      return res.status(400).json({ message: 'Invalid NIC number' });
    }
    const nicNormalized = String(nic).trim().toUpperCase();

    // 4 Ward must exist
    const [wards] = await pool.query('SELECT ward_id FROM WARDS WHERE ward_id = ?', [ward_id]);
    if (wards.length === 0) {
      return res.status(400).json({ message: 'Selected ward does not exist' });
    }

    // 5 One account per NIC (and per email, if given)
    const [existing] = await pool.query(
      'SELECT user_id FROM USERS WHERE nic = ? OR (email IS NOT NULL AND email = ?)',
      [nicNormalized, email || null]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'An account with this NIC or email already exists' });
    }

    // 6 Hash + insert
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await pool.query(
      `INSERT INTO USERS (full_name, nic, email, phone, password_hash, ward_id, role)
       VALUES (?, ?, ?, ?, ?, ?, 'CITIZEN')`,
      [full_name.trim(), nicNormalized, email || null, phone || null, password_hash, ward_id]
    );

    return res.status(201).json({
      message: 'Registration successful',
      user: { user_id: result.insertId, full_name: full_name.trim(), ward_id, role: 'CITIZEN' },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'An account with this NIC or email already exists' });
    }
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

// In server/app.js:  app.use('/api/auth', require('./routes/auth.routes'));