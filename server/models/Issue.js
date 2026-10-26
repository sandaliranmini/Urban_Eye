const db = require('../config/db');

const NET_VOTES =
  '(SELECT CAST(COALESCE(SUM(V.VOTE_TYPE), 0) AS SIGNED) FROM VOTE V WHERE V.ISSUE_ID = I.ISSUE_ID)';
  
// ORDER BY comes from this whitelist, never from user input
const SORTS = {
  votes: 'I.IS_EMERGENCY DESC, NET_VOTES DESC, I.CREATED_AT DESC',
  newest: 'I.CREATED_AT DESC',
  oldest: 'I.CREATED_AT ASC',
};

// Only these fields can be changed by update(); keys are input names, values are column names
const EDITABLE = { title: 'TITLE', description: 'DESCRIPTION', category: 'CATEGORY', status: 'STATUS' };

const LIST_COLUMNS = `
  I.ISSUE_ID, I.TITLE, I.DESCRIPTION, I.CATEGORY, I.STATUS, I.IS_EMERGENCY,
  I.PRIORITY_SCORE, I.BEFORE_PHOTO, I.WARD_ID, W.WARD_NAME, I.CREATED_AT,
  ${NET_VOTES} AS NET_VOTES`;

function buildWhere({ ward_id, citizen_id, category, status, search } = {}) {
  const where = [];
  const params = [];
  if (ward_id) { where.push('I.WARD_ID = ?'); params.push(ward_id); }
  if (citizen_id) { where.push('I.CITIZEN_ID = ?'); params.push(citizen_id); }
  if (category) { where.push('I.CATEGORY = ?'); params.push(category); }
  if (status) { where.push('I.STATUS = ?'); params.push(status); }
  if (search) {
    where.push('(I.TITLE LIKE ? OR I.DESCRIPTION LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

const Issue = {
  // 1. Create a new issue (and its emergency alert row, in one transaction)
  async create(data) {
    const { citizen_id, ward_id, title, description, category, before_photo, is_emergency } = data;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `INSERT INTO ISSUE (CITIZEN_ID, WARD_ID, TITLE, DESCRIPTION, CATEGORY, BEFORE_PHOTO, IS_EMERGENCY, STATUS)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Open')`,
        [citizen_id, ward_id, title, description, category, before_photo || null, is_emergency ? 1 : 0]
      );
      const issueId = result.insertId;
      if (is_emergency) {
        // Pending alert; the Socket.IO push is added in the emergency card
        await conn.query(
          'INSERT INTO EMERGENCY_ALERT (ISSUE_ID, MESSAGE) VALUES (?, ?)',
          [issueId, `EMERGENCY: ${title}`.slice(0, 255)]
        );
      }
      await conn.commit();
      return issueId; // the new ISSUE_ID
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  // 2. Get issues (filters + pagination). Returns an array.
  async findAll({ sort = 'votes', page = 1, limit = 10, ...filters } = {}) {
    const { whereSql, params } = buildWhere(filters);
    const [rows] = await db.query(
      `SELECT ${LIST_COLUMNS}
       FROM ISSUE I JOIN WARD W ON W.WARD_ID = I.WARD_ID
       ${whereSql}
       ORDER BY ${SORTS[sort] || SORTS.votes}
       LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );
    return rows;
  },

  // Total for pagination (same filters as findAll)
  async countAll(filters = {}) {
    const { whereSql, params } = buildWhere(filters);
    const [[row]] = await db.query(`SELECT COUNT(*) AS total FROM ISSUE I ${whereSql}`, params);
    return row.total;
  },

  // 3. Get one issue by ID (with ward name, reporter name, latest after-photo)
  async findById(id) {
    const [rows] = await db.query(
      `SELECT ${LIST_COLUMNS}, I.CITIZEN_ID, C.FULL_NAME AS REPORTER_NAME,
              I.OFFICER_ID, I.RESOLVED_AT, I.CLOSED_AT, I.CLOSURE_TYPE,
              (SELECT P.AFTER_PHOTO FROM RESOLUTION_PROOF P
                WHERE P.ISSUE_ID = I.ISSUE_ID ORDER BY P.SUBMITTED_AT DESC LIMIT 1) AS AFTER_PHOTO
       FROM ISSUE I
       JOIN WARD W ON W.WARD_ID = I.WARD_ID
       JOIN CITIZEN C ON C.CITIZEN_ID = I.CITIZEN_ID
       WHERE I.ISSUE_ID = ?`,
      [id]
    );
    return rows[0] || null;
  },

  // 4. Update only the fields that were provided
  async update(id, data) {
    const sets = [];
    const params = [];
    for (const [key, column] of Object.entries(EDITABLE)) {
      if (data[key] !== undefined) {
        sets.push(`${column} = ?`);
        params.push(data[key]);
      }
    }
    if (!sets.length) return 0;
    // UPDATED_AT is handled by the database (ON UPDATE CURRENT_TIMESTAMP)
    const [result] = await db.query(
      `UPDATE ISSUE SET ${sets.join(', ')} WHERE ISSUE_ID = ?`,
      [...params, id]
    );
    return result.affectedRows;
  },

  // 5. Hard delete. NOT exposed by any route: issues are closed, not deleted,
  // because this cascades to votes, comments, alerts, proofs and verifications.
  async delete(id) {
    await db.query('DELETE FROM ISSUE WHERE ISSUE_ID = ?', [id]);
  },

  async findDuplicate(ward_id, category) {
    const [rows] = await db.query(
      `SELECT I.ISSUE_ID, I.TITLE, I.CREATED_AT 
       FROM ISSUE I 
       WHERE I.WARD_ID = ? 
         AND I.CATEGORY = ? 
         AND I.CREATED_AT >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         AND I.STATUS != 'Closed'
       LIMIT 1`,
      [ward_id, category]
    );
    return rows[0] || null;
  },
  
};


module.exports = Issue;