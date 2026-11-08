// server/routes/authRoutes.js
// PUBLIC
//   GET   /api/auth/wards            ward list for forms
//   POST  /api/auth/register         citizen registration (NIC-verified, one account per NIC)
//   POST  /api/auth/login            citizen login: email or NIC + password -> JWT
//   POST  /api/auth/officer/login    officer login: email or employee ID + password -> JWT
// PROTECTED
//   POST  /api/auth/logout           stateless logout (client discards token)
//   GET   /api/auth/me               current user with ward/council names (citizen or officer)
//   PATCH /api/auth/me               citizen edits own details (name, mobile, email, address, ward)
//   POST  /api/auth/me/password      change own password (citizen or officer)
//   POST  /api/auth/me/deactivate    citizen deactivates own account (needs password)
//   POST  /api/auth/officers         admin only: create an officer account
// Exports: router (default), router.authenticate, router.requireRole
// Roles in the token: citizen | field_officer | supervisor | admin

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

// OFFICER.ROLE enum value -> role name used in tokens and requireRole()
const ROLE_SLUG = { 'Field Officer': 'field_officer', Supervisor: 'supervisor', Admin: 'admin' };
const OFFICER_ENUMS = Object.keys(ROLE_SLUG);

// Compared against when no account is found, so response time doesn't reveal which accounts exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', SALT_ROUNDS);

// NIC is never stored in plain text: keyed HMAC-SHA256 (64 hex chars) fits CITIZEN.NIC_HASH CHAR(64)
const hashNIC = (nic) =>
  crypto.createHmac('sha256', process.env.NIC_HASH_SECRET).update(nic).digest('hex');

// Adjust to match what validateNic actually returns
const isValidNic = (r) => r === true || (r && r.valid === true);

const isStr = (v) => typeof v === 'string';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^(?:\+94|0)7\d{8}$/;
const pwOk = (p) => isStr(p) && p.length >= 8 && Buffer.byteLength(p) <= 72;

const signToken = (claims) =>
  jwt.sign(claims, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN });

const citizenToken = (c) =>
  signToken({ sub: c.CITIZEN_ID, kind: 'citizen', role: 'citizen', ward_id: c.WARD_ID });

const officerToken = (o) =>
  signToken({
    sub: o.OFFICER_ID,
    kind: 'officer',
    role: ROLE_SLUG[o.ROLE],
    ward_id: o.WARD_ID,
    council_id: o.COUNCIL_ID,
  });

// ---------- Middleware ----------
// Verifies the Bearer token and sets req.user
const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    // Tokens issued before roles existed have no "kind": treat them as citizen tokens
    const kind = p.kind || 'citizen';
    req.user = {
      id: p.sub,
      kind,
      role: p.role || 'citizen',
      ward_id: p.ward_id ?? null,
      council_id: p.council_id ?? null,
      citizen_id: kind === 'citizen' ? p.sub : undefined,
      officer_id: kind === 'officer' ? p.sub : undefined,
    };
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ message });
  }
};

// Use after authenticate: router.get('/x', authenticate, requireRole('supervisor', 'admin'), handler)
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ message: 'Forbidden' });

// ---------- GET /wards (public) ----------
router.get('/wards', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT WARD_ID, COUNCIL_ID, WARD_NAME FROM WARD ORDER BY WARD_NAME'
    );
    return res.json({
      wards: rows.map((w) => ({ ward_id: w.WARD_ID, council_id: w.COUNCIL_ID, ward_name: w.WARD_NAME })),
    });
  } catch (err) {
    console.error('Wards error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ---------- POST /register (citizens) ----------
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
    if (!pwOk(password)) {
      return res.status(400).json({ message: 'Password must be 8 to 72 characters' });
    }
    if (!MOBILE_RE.test(mobile)) {
      return res.status(400).json({ message: 'Invalid mobile number' });
    }
    if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
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

// ---------- POST /login (citizens) ----------
// Body: { identifier: "<email or NIC>", password: "..." }
router.post('/login', async (req, res) => {
  const INVALID = { message: 'Invalid credentials' };
  try {
    const { identifier, password } = req.body || {};

    if (!isStr(identifier) || !isStr(password) || !identifier.trim() || !password) {
      return res.status(400).json({ message: 'identifier and password are required' });
    }
    if (Buffer.byteLength(password) > 72) {
      return res.status(401).json(INVALID);
    }

    const id = identifier.trim();
    const cols = 'CITIZEN_ID, WARD_ID, FULL_NAME, PASSWORD_HASH, IS_ACTIVE';
    let rows;

    if (id.includes('@')) {
      [rows] = await pool.query(`SELECT ${cols} FROM CITIZEN WHERE EMAIL = ?`, [id.toLowerCase()]);
    } else {
      if (!isValidNic(validateNic(id))) {
        await bcrypt.compare(password, DUMMY_HASH); // keep timing similar
        return res.status(401).json(INVALID);
      }
      [rows] = await pool.query(`SELECT ${cols} FROM CITIZEN WHERE NIC_HASH = ?`, [
        hashNIC(normalizeNic(id)),
      ]);
    }

    const citizen = rows[0];
    const ok = await bcrypt.compare(password, citizen ? citizen.PASSWORD_HASH : DUMMY_HASH);
    if (!citizen || !ok || !citizen.IS_ACTIVE) {
      return res.status(401).json(INVALID);
    }

    return res.json({
      message: 'Login successful',
      token: citizenToken(citizen),
      token_type: 'Bearer',
      expires_in: JWT_EXPIRES_IN,
      user: {
        id: citizen.CITIZEN_ID,
        kind: 'citizen',
        role: 'citizen',
        full_name: citizen.FULL_NAME,
        ward_id: citizen.WARD_ID,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ---------- POST /officer/login ----------
// Body: { identifier: "<email or employee ID>", password: "..." }
router.post('/officer/login', async (req, res) => {
  const INVALID = { message: 'Invalid credentials' };
  try {
    const { identifier, password } = req.body || {};

    if (!isStr(identifier) || !isStr(password) || !identifier.trim() || !password) {
      return res.status(400).json({ message: 'identifier and password are required' });
    }
    if (Buffer.byteLength(password) > 72) {
      return res.status(401).json(INVALID);
    }

    const id = identifier.trim();
    const [rows] = await pool.query(
      `SELECT OFFICER_ID, COUNCIL_ID, WARD_ID, FULL_NAME, PASSWORD_HASH, ROLE, IS_ACTIVE
         FROM OFFICER WHERE LOWER(EMAIL) = ? OR EMPLOYEE_ID = ?`,
      [id.toLowerCase(), id]
    );

    const officer = rows[0];
    const ok = await bcrypt.compare(password, officer ? officer.PASSWORD_HASH : DUMMY_HASH);
    if (!officer || !ok || !officer.IS_ACTIVE) {
      return res.status(401).json(INVALID);
    }

    return res.json({
      message: 'Login successful',
      token: officerToken(officer),
      token_type: 'Bearer',
      expires_in: JWT_EXPIRES_IN,
      user: {
        id: officer.OFFICER_ID,
        kind: 'officer',
        role: ROLE_SLUG[officer.ROLE],
        full_name: officer.FULL_NAME,
        ward_id: officer.WARD_ID,
        council_id: officer.COUNCIL_ID,
      },
    });
  } catch (err) {
    console.error('Officer login error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ---------- POST /logout ----------
// JWTs are stateless: the client must delete its stored token.
router.post('/logout', authenticate, (req, res) => {
  return res.json({ message: 'Logged out. Please discard your token on the client.' });
});

// ---------- GET /me ----------
router.get('/me', authenticate, async (req, res) => {
  try {
    if (req.user.kind === 'officer') {
      const [rows] = await pool.query(
        `SELECT o.OFFICER_ID, o.WARD_ID, o.COUNCIL_ID, o.EMPLOYEE_ID, o.FULL_NAME, o.EMAIL,
                o.DEPARTMENT, o.ROLE, o.IS_ACTIVE, c.COUNCIL_NAME, w.WARD_NAME
           FROM OFFICER o
           JOIN COUNCIL c ON c.COUNCIL_ID = o.COUNCIL_ID
           LEFT JOIN WARD w ON w.WARD_ID = o.WARD_ID
          WHERE o.OFFICER_ID = ?`,
        [req.user.id]
      );
      const o = rows[0];
      if (!o || !o.IS_ACTIVE) {
        return res.status(401).json({ message: 'Account no longer active' });
      }
      return res.json({
        user: {
          id: o.OFFICER_ID,
          kind: 'officer',
          role: ROLE_SLUG[o.ROLE],
          full_name: o.FULL_NAME,
          email: o.EMAIL,
          employee_id: o.EMPLOYEE_ID,
          department: o.DEPARTMENT,
          ward_id: o.WARD_ID,
          ward_name: o.WARD_NAME,
          council_id: o.COUNCIL_ID,
          council_name: o.COUNCIL_NAME,
        },
      });
    }

    const [rows] = await pool.query(
      `SELECT c.CITIZEN_ID, c.WARD_ID, c.FULL_NAME, c.EMAIL, c.MOBILE_NUMBER, c.ADDRESS,
              c.CREDIBILITY_SCORE, c.CREATED_AT, c.IS_ACTIVE, w.WARD_NAME, w.COUNCIL_ID, co.COUNCIL_NAME
         FROM CITIZEN c
         JOIN WARD w ON w.WARD_ID = c.WARD_ID
         JOIN COUNCIL co ON co.COUNCIL_ID = w.COUNCIL_ID
        WHERE c.CITIZEN_ID = ?`,
      [req.user.id]
    );
    const c = rows[0];
    if (!c || !c.IS_ACTIVE) {
      return res.status(401).json({ message: 'Account no longer active' });
    }
    return res.json({
      user: {
        id: c.CITIZEN_ID,
        kind: 'citizen',
        role: 'citizen',
        full_name: c.FULL_NAME,
        email: c.EMAIL,
        mobile_number: c.MOBILE_NUMBER,
        address: c.ADDRESS,
        credibility_score: c.CREDIBILITY_SCORE,
        created_at: c.CREATED_AT,
        ward_id: c.WARD_ID,
        ward_name: c.WARD_NAME,
        council_name: c.COUNCIL_NAME,
      },
    });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ---------- PATCH /me (citizens edit their own details) ----------
router.patch('/me', authenticate, requireRole('citizen'), async (req, res) => {
  try {
    const { full_name, mobile_number, email, address, ward_id } = req.body || {};

    if (!isStr(full_name) || !full_name.trim()) {
      return res.status(400).json({ message: 'full_name is required' });
    }
    if (!isStr(mobile_number) || !MOBILE_RE.test(mobile_number.trim())) {
      return res.status(400).json({ message: 'Invalid mobile number' });
    }
    const cleanEmail = isStr(email) && email.trim() ? email.trim().toLowerCase() : null;
    if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }
    const cleanAddress = isStr(address) && address.trim() ? address.trim() : null;

    const [cur] = await pool.query('SELECT WARD_ID, IS_ACTIVE FROM CITIZEN WHERE CITIZEN_ID = ?', [req.user.id]);
    if (!cur[0] || !cur[0].IS_ACTIVE) {
      return res.status(403).json({ message: 'Account is not active' });
    }

    let wardId = cur[0].WARD_ID;
    if (ward_id !== undefined && ward_id !== null && ward_id !== '') {
      wardId = Number(ward_id);
      if (!Number.isInteger(wardId) || wardId <= 0) {
        return res.status(400).json({ message: 'Invalid ward_id' });
      }
      const [w] = await pool.query('SELECT WARD_ID FROM WARD WHERE WARD_ID = ?', [wardId]);
      if (w.length === 0) {
        return res.status(400).json({ message: 'Selected ward does not exist' });
      }
    }

    const name = full_name.trim();
    await pool.query(
      `UPDATE CITIZEN SET FULL_NAME = ?, MOBILE_NUMBER = ?, EMAIL = ?, ADDRESS = ?, WARD_ID = ?
        WHERE CITIZEN_ID = ?`,
      [name, mobile_number.trim(), cleanEmail, cleanAddress, wardId, req.user.id]
    );

    // The token carries ward_id, so issue a fresh one
    return res.json({
      message: 'Profile updated',
      token: citizenToken({ CITIZEN_ID: req.user.id, WARD_ID: wardId }),
      user: { id: req.user.id, kind: 'citizen', role: 'citizen', full_name: name, ward_id: wardId },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    console.error('Update profile error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Wrong current password returns 400 on purpose: the client treats any 401 as "session expired".
const ownerTable = (req) =>
  req.user.kind === 'officer' ? { t: 'OFFICER', id: 'OFFICER_ID' } : { t: 'CITIZEN', id: 'CITIZEN_ID' };

// ---------- POST /me/password (citizens and officers) ----------
router.post('/me/password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (!isStr(current_password) || !isStr(new_password)) {
      return res.status(400).json({ message: 'current_password and new_password are required' });
    }
    if (!pwOk(new_password)) {
      return res.status(400).json({ message: 'Password must be 8 to 72 characters' });
    }

    const { t, id } = ownerTable(req);
    const [rows] = await pool.query(`SELECT PASSWORD_HASH, IS_ACTIVE FROM ${t} WHERE ${id} = ?`, [req.user.id]);
    const u = rows[0];
    if (!u || !u.IS_ACTIVE) {
      return res.status(403).json({ message: 'Account is not active' });
    }

    const ok = Buffer.byteLength(current_password) <= 72 && (await bcrypt.compare(current_password, u.PASSWORD_HASH));
    if (!ok) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    if (current_password === new_password) {
      return res.status(400).json({ message: 'New password must be different from the current one' });
    }

    const hash = await bcrypt.hash(new_password, SALT_ROUNDS);
    await pool.query(`UPDATE ${t} SET PASSWORD_HASH = ? WHERE ${id} = ?`, [hash, req.user.id]);
    return res.json({ message: 'Password updated' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ---------- POST /me/deactivate (citizens, needs the password) ----------
router.post('/me/deactivate', authenticate, requireRole('citizen'), async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!isStr(password) || !password) {
      return res.status(400).json({ message: 'password is required' });
    }

    const [rows] = await pool.query('SELECT PASSWORD_HASH, IS_ACTIVE FROM CITIZEN WHERE CITIZEN_ID = ?', [req.user.id]);
    const u = rows[0];
    if (!u || !u.IS_ACTIVE) {
      return res.status(403).json({ message: 'Account is not active' });
    }

    const ok = Buffer.byteLength(password) <= 72 && (await bcrypt.compare(password, u.PASSWORD_HASH));
    if (!ok) {
      return res.status(400).json({ message: 'Password is incorrect' });
    }

    await pool.query('UPDATE CITIZEN SET IS_ACTIVE = 0 WHERE CITIZEN_ID = ?', [req.user.id]);
    return res.json({ message: 'Account deactivated' });
  } catch (err) {
    console.error('Deactivate error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ---------- POST /officers (admin only) ----------
// Body: { employee_id, full_name, email, password, role, council_id, ward_id?, department? }
router.post('/officers', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { employee_id, full_name, email, password, role, council_id, ward_id, department } =
      req.body || {};

    if (![employee_id, full_name, email, password, role].every(isStr) || !council_id) {
      return res.status(400).json({
        message: 'employee_id, full_name, email, password, role and council_id are required',
      });
    }
    if (!OFFICER_ENUMS.includes(role)) {
      return res.status(400).json({ message: `role must be one of: ${OFFICER_ENUMS.join(', ')}` });
    }

    const cleanEmail = email.trim().toLowerCase();
    const councilId = Number(council_id);
    const wardId = ward_id ? Number(ward_id) : null;

    if (!EMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }
    if (!Number.isInteger(councilId) || councilId <= 0 || (ward_id && !Number.isInteger(wardId))) {
      return res.status(400).json({ message: 'Invalid council_id or ward_id' });
    }
    if (!pwOk(password)) {
      return res.status(400).json({ message: 'Password must be 8 to 72 characters' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await pool.query(
      `INSERT INTO OFFICER (COUNCIL_ID, WARD_ID, EMPLOYEE_ID, FULL_NAME, EMAIL, PASSWORD_HASH, DEPARTMENT, ROLE)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        councilId,
        wardId,
        employee_id.trim(),
        full_name.trim(),
        cleanEmail,
        passwordHash,
        isStr(department) && department.trim() ? department.trim() : null,
        role,
      ]
    );

    return res.status(201).json({
      message: 'Officer created',
      officer: { officer_id: result.insertId, full_name: full_name.trim(), role: ROLE_SLUG[role] },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'An officer with this employee ID or email already exists' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ message: 'council_id or ward_id does not exist' });
    }
    console.error('Create officer error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
module.exports.authenticate = authenticate;
module.exports.requireRole = requireRole;