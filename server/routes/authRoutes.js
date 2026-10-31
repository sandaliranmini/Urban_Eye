// server/routes/authRoutes.js
// POST /api/auth/register: citizen registration (NIC-verified, one account per NIC, ward selected)

const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../config/db');
const { validateNic, normalizeNic } = require('../utils/nicValidator');

if (!process.env.NIC_HASH_SECRET) {
  throw new Error('NIC_HASH_SECRET is not set in .env');
}

const router = express.Router();
const SALT_ROUNDS = 12;

// NIC is never stored in plain text: keyed HMAC-SHA256 (64 hex chars) fits CITIZEN.NIC_HASH CHAR(64)
const hashNIC = (nic) =>
  crypto.createHmac('sha256', process.env.NIC_HASH_SECRET).update(nic).digest('hex');

// Adjust to match what validateNic actually returns
const isValidNic = (r) => r === true || (r && r.valid === true);

const isStr = (v) => typeof v === 'string';

router.post('/register', async (req, res) => {
  try {
    const { full_name, nic, email, mobile_number, address, password, ward_id } = req.body || {};

    if (![full_name, nic, mobile_number, password].every(isStr) || !ward_id) {
      return res.status(400).json({
        message: 'full_name, nic, mobile_number, password and ward_id are required',
      });
    }

    const name = full_name.trim();
    const mobile = mobile_number.trim();
    const wardId = Number(ward_id);
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanAddress = address ? String(address).trim() : null;

    if (!name) {
      return res.status(400).json({ message: 'full_name cannot be empty' });
    }
    if (!Number.isInteger(wardId) || wardId <= 0) {
      return res.status(400).json({ message: 'Invalid ward_id' });
    }
    if (password.length < 8 || Buffer.byteLength(password) > 72) {
      return res.status(400).json({ message: 'Password must be 8 to 72 characters' });
    }
    if (!/^(?:\+94|0)7\d{8}$/.test(mobile)) {
      return res.status(400).json({ message: 'Invalid mobile number' });
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }
    if (!isValidNic(validateNic(nic))) {
      return res.status(400).json({ message: 'Invalid NIC number' });
    }

    const nicHash = hashNIC(normalizeNic(nic));

    const [wards] = await pool.query('SELECT WARD_ID FROM WARD WHERE WARD_ID = ?', [wardId]);
    if (wards.length === 0) {
      return res.status(400).json({ message: 'Selected ward does not exist' });
    }

    const [existing] = await pool.query(
      'SELECT CITIZEN_ID FROM CITIZEN WHERE NIC_HASH = ? OR (EMAIL IS NOT NULL AND EMAIL = ?)',
      [nicHash, cleanEmail]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'An account with this NIC or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await pool.query(
      `INSERT INTO CITIZEN (WARD_ID, NIC_HASH, FULL_NAME, EMAIL, MOBILE_NUMBER, ADDRESS, PASSWORD_HASH)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [wardId, nicHash, name, cleanEmail, mobile, cleanAddress, passwordHash]
    );

    return res.status(201).json({
      message: 'Registration successful',
      citizen: { citizen_id: result.insertId, full_name: name, ward_id: wardId },
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