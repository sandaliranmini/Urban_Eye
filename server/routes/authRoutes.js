// server/routes/authRoutes.js
// POST /api/auth/register  citizen registration (NIC-verified, one account per NIC, ward selected)
// POST /api/auth/login     email or NIC + password -> JWT
// POST /api/auth/logout    stateless logout (client discards token)
// GET  /api/auth/me        returns the logged-in user (also a test for the middleware)
// Exports: router (default) and router.authenticate (middleware for protecting other routes)

const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { validateNic, normalizeNic } = require('../utils/nicValidator');

if (!process.env.NIC_HASH_SECRET) {
  throw new Error('NIC_HASH_SECRET is not set in .env');
}
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set in .env');
}

const router = express.Router();
const SALT_ROUNDS = 12;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Compared against when no account is found, so response time doesn't reveal which accounts exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', SALT_ROUNDS);

// NIC is never stored in plain text: keyed HMAC-SHA256 (64 hex chars) fits CITIZEN.NIC_HASH CHAR(64)
const hashNIC = (nic) =>
  crypto.createHmac('sha256', process.env.NIC_HASH_SECRET).update(nic).digest('hex');

// Adjust to match what validateNic actually returns
const isValidNic = (r) => r === true || (r && r.valid === true);

const isStr = (v) => typeof v === 'string';

const signToken = (citizen) =>
  jwt.sign(
    { sub: citizen.CITIZEN_ID, ward_id: citizen.WARD_ID, role: 'citizen' },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN }
  );

// ---------- Middleware: protects any route it is placed in front of ----------
const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = { citizen_id: payload.sub, ward_id: payload.ward_id, role: payload.role };
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ message });
  }
};

// Optional role guard for later, e.g. router.get('/x', authenticate, requireRole('officer'), handler)
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ message: 'Forbidden' });

// ---------- POST /register ----------
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

// ---------- POST /login ----------
// Body: { identifier: "<email or NIC>", password: "..." }
router.post('/login', async (req, res) => {
  const INVALID = { message: 'Invalid credentials' };
  try {
    const { identifier, password } = req.body || {};

    if (!isStr(identifier) || !isStr(password) || !identifier.trim() || !password) {
      return res.status(400).json({ message: 'identifier and password are required' });
    }
    // Same cap as registration; also stops huge inputs reaching bcrypt
    if (Buffer.byteLength(password) > 72) {
      return res.status(401).json(INVALID);
    }

    const id = identifier.trim();
    let rows;

    if (id.includes('@')) {
      [rows] = await pool.query(
        `SELECT CITIZEN_ID, WARD_ID, FULL_NAME, PASSWORD_HASH FROM CITIZEN WHERE EMAIL = ?`,
        [id.toLowerCase()]
      );
    } else {
      if (!isValidNic(validateNic(id))) {
        await bcrypt.compare(password, DUMMY_HASH); // keep timing similar
        return res.status(401).json(INVALID);
      }
      [rows] = await pool.query(
        `SELECT CITIZEN_ID, WARD_ID, FULL_NAME, PASSWORD_HASH FROM CITIZEN WHERE NIC_HASH = ?`,
        [hashNIC(normalizeNic(id))]
      );
    }

    const citizen = rows[0];
    const ok = await bcrypt.compare(password, citizen ? citizen.PASSWORD_HASH : DUMMY_HASH);
    if (!citizen || !ok) {
      return res.status(401).json(INVALID);
    }

    return res.json({
      message: 'Login successful',
      token: signToken(citizen),
      token_type: 'Bearer',
      expires_in: JWT_EXPIRES_IN,
      citizen: { citizen_id: citizen.CITIZEN_ID, full_name: citizen.FULL_NAME, ward_id: citizen.WARD_ID },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ---------- POST /logout ----------
// JWTs are stateless: the client must delete its stored token.
// For true server-side revocation, add a token blocklist table and check it in `authenticate`.
router.post('/logout', authenticate, (req, res) => {
  return res.json({ message: 'Logged out. Please discard your token on the client.' });
});

// ---------- GET /me ----------
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT CITIZEN_ID, WARD_ID, FULL_NAME, EMAIL, MOBILE_NUMBER FROM CITIZEN WHERE CITIZEN_ID = ?',
      [req.user.citizen_id]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Account no longer exists' });
    }
    const c = rows[0];
    return res.json({
      citizen: {
        citizen_id: c.CITIZEN_ID,
        full_name: c.FULL_NAME,
        email: c.EMAIL,
        mobile_number: c.MOBILE_NUMBER,
        ward_id: c.WARD_ID,
        role: req.user.role,
      },
    });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
module.exports.authenticate = authenticate;
module.exports.requireRole = requireRole;