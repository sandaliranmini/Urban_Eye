const db = require('../config/db');

const Issue = {
  // 1. Create a new issue
  async create(data) {
    const { citizen_id, ward_id, title, description, category, before_photo } = data;
    
    // Insert into the exact table and columns from schema.sql
    const [result] = await db.query(
      `INSERT INTO ISSUE (CITIZEN_ID, WARD_ID, TITLE, DESCRIPTION, CATEGORY, BEFORE_PHOTO, STATUS) 
       VALUES (?, ?, ?, ?, ?, ?, 'Open')`,
      [citizen_id, ward_id, title, description, category, before_photo || null]
    );
    return result.insertId; // Return the new ISSUE_ID
  },

  // 2. Get all issues
  async findAll() {
    const [rows] = await db.query(
      'SELECT * FROM ISSUE ORDER BY CREATED_AT DESC'
    );
    return rows;
  },

  // 3. Get one issue by ID
  async findById(id) {
    const [rows] = await db.query('SELECT * FROM ISSUE WHERE ISSUE_ID = ?', [id]);
    return rows[0];
  },

  // 4. Update an issue (e.g., change status)
  async update(id, data) {
    const { title, description, category, status } = data;
    
    // UPDATED_AT is automatically handled by the database (ON UPDATE CURRENT_TIMESTAMP)
    await db.query(
      `UPDATE ISSUE 
       SET TITLE = ?, DESCRIPTION = ?, CATEGORY = ?, STATUS = ? 
       WHERE ISSUE_ID = ?`,
      [title, description, category, status, id]
    );
  },

  // 5. Delete an issue
  async delete(id) {
    await db.query('DELETE FROM ISSUE WHERE ISSUE_ID = ?', [id]);
  }
};

module.exports = Issue;