const db = require('../config/db');

const CATEGORIES = ['Maintenance', 'Safety', 'Utility'];

class Announcement {
  static get CATEGORIES() {
    return CATEGORIES;
  }

  /**
   * Create a new announcement
   */
  static async create({ council_id, ward_id = null, officer_id, title, body, category, is_pinned = 0, expires_at = null }, conn = null) {
    const exec = conn || db;
    const [result] = await exec.query(
      `INSERT INTO ANNOUNCEMENT
        (COUNCIL_ID, WARD_ID, OFFICER_ID, TITLE, BODY, CATEGORY, IS_PINNED, EXPIRES_AT)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        council_id,
        ward_id ? Number(ward_id) : null,
        officer_id,
        title.trim(),
        body.trim(),
        category,
        is_pinned ? 1 : 0,
        expires_at ? new Date(expires_at) : null,
      ]
    );
    return result.insertId;
  }

  /**
   * Find announcement by ID with joined details
   */
  static async findById(id, conn = null) {
    const exec = conn || db;
    const [rows] = await exec.query(
      `SELECT
         a.ANNOUNCEMENT_ID,
         a.COUNCIL_ID,
         c.COUNCIL_NAME,
         a.WARD_ID,
         w.WARD_NAME,
         a.OFFICER_ID,
         o.FULL_NAME AS OFFICER_NAME,
         o.ROLE AS OFFICER_ROLE,
         a.TITLE,
         a.BODY,
         a.CATEGORY,
         a.IS_PINNED,
         a.CREATED_AT,
         a.EXPIRES_AT,
         CASE
           WHEN a.EXPIRES_AT IS NOT NULL AND a.EXPIRES_AT < NOW() THEN 1
           ELSE 0
         END AS IS_EXPIRED
       FROM ANNOUNCEMENT a
       JOIN COUNCIL c ON c.COUNCIL_ID = a.COUNCIL_ID
       LEFT JOIN WARD w ON w.WARD_ID = a.WARD_ID
       JOIN OFFICER o ON o.OFFICER_ID = a.OFFICER_ID
       WHERE a.ANNOUNCEMENT_ID = ?`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find announcements matching filters
   */
  static async findAll(
    {
      council_id,
      ward_id,
      category,
      is_pinned,
      active_only = false,
      search,
      page = 1,
      limit = 20,
      sort = 'pinned',
    } = {},
    conn = null
  ) {
    const exec = conn || db;
    const where = [];
    const params = [];

    if (council_id) {
      where.push('a.COUNCIL_ID = ?');
      params.push(council_id);
    }

    if (ward_id !== undefined && ward_id !== null && ward_id !== '') {
      if (ward_id === 'null' || ward_id === 0) {
        where.push('a.WARD_ID IS NULL');
      } else {
        where.push('(a.WARD_ID = ? OR a.WARD_ID IS NULL)');
        params.push(ward_id);
      }
    }

    if (category && CATEGORIES.includes(category)) {
      where.push('a.CATEGORY = ?');
      params.push(category);
    }

    if (is_pinned !== undefined && is_pinned !== null && is_pinned !== '') {
      where.push('a.IS_PINNED = ?');
      params.push(is_pinned ? 1 : 0);
    }

    if (active_only) {
      where.push('(a.EXPIRES_AT IS NULL OR a.EXPIRES_AT > NOW())');
    }

    if (search && String(search).trim()) {
      where.push('(a.TITLE LIKE ? OR a.BODY LIKE ?)');
      const term = `%${String(search).trim()}%`;
      params.push(term, term);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Count total
    const [countRows] = await exec.query(
      `SELECT COUNT(*) AS total
       FROM ANNOUNCEMENT a
       ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    let orderBy = 'a.IS_PINNED DESC, a.CREATED_AT DESC';
    if (sort === 'newest') orderBy = 'a.CREATED_AT DESC';
    if (sort === 'oldest') orderBy = 'a.CREATED_AT ASC';

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const [rows] = await exec.query(
      `SELECT
         a.ANNOUNCEMENT_ID,
         a.COUNCIL_ID,
         c.COUNCIL_NAME,
         a.WARD_ID,
         w.WARD_NAME,
         a.OFFICER_ID,
         o.FULL_NAME AS OFFICER_NAME,
         o.ROLE AS OFFICER_ROLE,
         a.TITLE,
         a.BODY,
         a.CATEGORY,
         a.IS_PINNED,
         a.CREATED_AT,
         a.EXPIRES_AT,
         CASE
           WHEN a.EXPIRES_AT IS NOT NULL AND a.EXPIRES_AT < NOW() THEN 1
           ELSE 0
         END AS IS_EXPIRED
       FROM ANNOUNCEMENT a
       JOIN COUNCIL c ON c.COUNCIL_ID = a.COUNCIL_ID
       LEFT JOIN WARD w ON w.WARD_ID = a.WARD_ID
       JOIN OFFICER o ON o.OFFICER_ID = a.OFFICER_ID
       ${whereSql}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    return {
      announcements: rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  /**
   * Find active announcements for a specific ward (including council-wide notices)
   */
  static async findByWard(wardId, { council_id = null, active_only = true, limit = 50 } = {}, conn = null) {
    const exec = conn || db;
    const where = [];
    const params = [];

    if (wardId) {
      if (council_id) {
        where.push('(a.WARD_ID = ? OR (a.WARD_ID IS NULL AND a.COUNCIL_ID = ?))');
        params.push(wardId, council_id);
      } else {
        where.push('(a.WARD_ID = ? OR a.WARD_ID IS NULL)');
        params.push(wardId);
      }
    } else if (council_id) {
      where.push('a.COUNCIL_ID = ?');
      params.push(council_id);
    }

    if (active_only) {
      where.push('(a.EXPIRES_AT IS NULL OR a.EXPIRES_AT > NOW())');
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limitNum = Math.max(1, Math.min(100, Number(limit) || 50));

    const [rows] = await exec.query(
      `SELECT
         a.ANNOUNCEMENT_ID,
         a.COUNCIL_ID,
         c.COUNCIL_NAME,
         a.WARD_ID,
         w.WARD_NAME,
         a.OFFICER_ID,
         o.FULL_NAME AS OFFICER_NAME,
         o.ROLE AS OFFICER_ROLE,
         a.TITLE,
         a.BODY,
         a.CATEGORY,
         a.IS_PINNED,
         a.CREATED_AT,
         a.EXPIRES_AT
       FROM ANNOUNCEMENT a
       JOIN COUNCIL c ON c.COUNCIL_ID = a.COUNCIL_ID
       LEFT JOIN WARD w ON w.WARD_ID = a.WARD_ID
       JOIN OFFICER o ON o.OFFICER_ID = a.OFFICER_ID
       ${whereSql}
       ORDER BY a.IS_PINNED DESC, a.CREATED_AT DESC
       LIMIT ?`,
      [...params, limitNum]
    );

    return rows;
  }

  /**
   * Update announcement
   */
  static async update(id, updates, conn = null) {
    const exec = conn || db;
    const allowed = {
      title: 'TITLE',
      body: 'BODY',
      category: 'CATEGORY',
      ward_id: 'WARD_ID',
      is_pinned: 'IS_PINNED',
      expires_at: 'EXPIRES_AT',
    };

    const sets = [];
    const params = [];

    for (const [key, col] of Object.entries(allowed)) {
      if (updates[key] !== undefined) {
        sets.push(`${col} = ?`);
        if (key === 'ward_id') {
          params.push(updates[key] ? Number(updates[key]) : null);
        } else if (key === 'is_pinned') {
          params.push(updates[key] ? 1 : 0);
        } else if (key === 'expires_at') {
          params.push(updates[key] ? new Date(updates[key]) : null);
        } else if (typeof updates[key] === 'string') {
          params.push(updates[key].trim());
        } else {
          params.push(updates[key]);
        }
      }
    }

    if (!sets.length) return false;

    params.push(id);
    const [result] = await exec.query(
      `UPDATE ANNOUNCEMENT SET ${sets.join(', ')} WHERE ANNOUNCEMENT_ID = ?`,
      params
    );
    return result.affectedRows > 0;
  }

  /**
   * Delete announcement
   */
  static async delete(id, conn = null) {
    const exec = conn || db;
    const [result] = await exec.query(
      'DELETE FROM ANNOUNCEMENT WHERE ANNOUNCEMENT_ID = ?',
      [id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = Announcement;
