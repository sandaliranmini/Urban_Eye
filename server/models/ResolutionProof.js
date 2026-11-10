const db = require('../config/db');

const exec = (conn) => conn || db;

class ResolutionProof {
  /**
   * Save an officer's proof of resolution (after-photo and remarks).
   *
   * @param {Object} data
   * @param {number} data.issueId
   * @param {number} data.officerId
   * @param {string} data.afterPhoto
   * @param {string} [data.remarks]
   * @param {Object} [conn]
   * @returns {Promise<number>} PROOF_ID
   */
  static async create({ issueId, officerId, afterPhoto, remarks = null }, conn) {
    const [result] = await exec(conn).query(
      `INSERT INTO RESOLUTION_PROOF (ISSUE_ID, OFFICER_ID, AFTER_PHOTO, REMARKS)
       VALUES (?, ?, ?, ?)`,
      [issueId, officerId, afterPhoto, remarks]
    );
    return result.insertId;
  }

  static async findById(id, conn) {
    const [rows] = await exec(conn).query(
      `SELECT p.*, o.FULL_NAME AS OFFICER_NAME, o.EMPLOYEE_ID
         FROM RESOLUTION_PROOF p
         JOIN OFFICER o ON o.OFFICER_ID = p.OFFICER_ID
        WHERE p.PROOF_ID = ?`,
      [id]
    );
    return rows[0] || null;
  }

  static async findByIssue(issueId, conn) {
    const [rows] = await exec(conn).query(
      `SELECT p.*, o.FULL_NAME AS OFFICER_NAME, o.EMPLOYEE_ID
         FROM RESOLUTION_PROOF p
         JOIN OFFICER o ON o.OFFICER_ID = p.OFFICER_ID
        WHERE p.ISSUE_ID = ?
        ORDER BY p.SUBMITTED_AT DESC, p.PROOF_ID DESC`,
      [issueId]
    );
    return rows;
  }
}

module.exports = ResolutionProof;
