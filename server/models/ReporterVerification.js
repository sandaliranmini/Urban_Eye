const db = require('../config/db');

/**
 * ReporterVerification
 * --------------------
 * Data-access layer for the REPORT_VERIFICATION table.
 *
 * Flow:
 *   1. Officer uploads RESOLUTION_PROOF  -> create() opens a 'Pending' verification
 *   2. Reporter responds                 -> confirm() or dispute()
 *   3. Reporter stays silent             -> cron sends reminders, then autoClose()
 *
 * Every method takes an optional `conn` as its last argument. Pass a connection
 * from `db.getConnection()` (inside a transaction) when the call must succeed or
 * fail together with other writes, e.g. updating ISSUE.STATUS. Without it, the
 * shared pool is used.
 *
 * NOTE: this model only touches REPORT_VERIFICATION. Changing ISSUE.STATUS,
 * CLOSURE_TYPE, CLOSED_AT or the reporter's CREDIBILITY_SCORE is the caller's
 * job (controller / cron), ideally in the same transaction.
 */

const RESPONSE = Object.freeze({
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  DISPUTED: 'Disputed',
  AUTO_CLOSED: 'auto_closed', // lower-case in schema.sql
});

const DEFAULT_DEADLINE_DAYS = parseInt(process.env.AUTO_CLOSE_DAYS, 10) || 14;

// Maps the reminder "day" to its flag column. Whitelisted so a column name can
// never come from user input.
const REMINDER_COLUMNS = Object.freeze({
  7: 'REMINDER_7D_SENT',
  13: 'REMINDER_13D_SENT',
});

const exec = (conn) => conn || db;

class ReporterVerification {
  // ---------------------------------------------------------------- create

  /**
   * Open a verification request after an officer submits resolution proof.
   * The deadline is computed by MySQL (NOW() + N days) so it stays consistent
   * with the cron queries below, regardless of the Node server's timezone.
   *
   * @returns {Promise<number>} the new VERIFICATION_ID
   * @throws  ER_DUP_ENTRY if a verification already exists for this proof
   */
  static async create({ issueId, proofId, reporterId, deadlineDays = DEFAULT_DEADLINE_DAYS }, conn) {
    const [result] = await exec(conn).query(
      `INSERT INTO REPORT_VERIFICATION
         (ISSUE_ID, PROOF_ID, REPORTER_ID, DEADLINE_AT)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
      [issueId, proofId, reporterId, deadlineDays]
    );
    return result.insertId;
  }

  // ------------------------------------------------------------------ read

  static async findById(id, conn) {
    const [rows] = await exec(conn).query(
      'SELECT * FROM REPORT_VERIFICATION WHERE VERIFICATION_ID = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async findByProofId(proofId, conn) {
    const [rows] = await exec(conn).query(
      'SELECT * FROM REPORT_VERIFICATION WHERE PROOF_ID = ?',
      [proofId]
    );
    return rows[0] || null;
  }

  /** All verification rounds for an issue, newest first (an issue can be disputed and re-resolved). */
  static async findByIssue(issueId, conn) {
    const [rows] = await exec(conn).query(
      `SELECT * FROM REPORT_VERIFICATION
        WHERE ISSUE_ID = ?
        ORDER BY CREATED_AT DESC, VERIFICATION_ID DESC`,
      [issueId]
    );
    return rows;
  }

  /** The currently open verification for an issue, if any. */
  static async findPendingByIssue(issueId, conn) {
    const [rows] = await exec(conn).query(
      `SELECT * FROM REPORT_VERIFICATION
        WHERE ISSUE_ID = ? AND RESPONSE = 'Pending'
        ORDER BY CREATED_AT DESC, VERIFICATION_ID DESC
        LIMIT 1`,
      [issueId]
    );
    return rows[0] || null;
  }

  /**
   * Verifications waiting on a reporter, joined with issue + proof so the
   * "needs your confirmation" screen can render from a single query.
   */
  static async findPendingForReporter(reporterId, conn) {
    const [rows] = await exec(conn).query(
      `SELECT v.*,
              i.TITLE        AS ISSUE_TITLE,
              i.BEFORE_PHOTO AS BEFORE_PHOTO,
              p.AFTER_PHOTO  AS AFTER_PHOTO,
              p.REMARKS      AS OFFICER_REMARKS,
              p.SUBMITTED_AT AS PROOF_SUBMITTED_AT
         FROM REPORT_VERIFICATION v
         JOIN ISSUE i            ON i.ISSUE_ID = v.ISSUE_ID
         JOIN RESOLUTION_PROOF p ON p.PROOF_ID = v.PROOF_ID
        WHERE v.REPORTER_ID = ? AND v.RESPONSE = 'Pending'
        ORDER BY v.DEADLINE_AT ASC`,
      [reporterId]
    );
    return rows;
  }

  // ------------------------------------------------------ reporter response

  /**
   * Reporter confirms the fix.
   * The `RESPONSE = 'Pending'` guard makes this atomic: a double-click or a
   * race with the auto-close cron cannot flip an already-settled row.
   *
   * @returns {Promise<boolean>} true if this call settled the row
   */
  static async confirm(id, remarks = null, conn) {
    const [result] = await exec(conn).query(
      `UPDATE REPORT_VERIFICATION
          SET RESPONSE = 'Confirmed', REMARKS = ?, RESPONDED_AT = NOW()
        WHERE VERIFICATION_ID = ? AND RESPONSE = 'Pending'`,
      [remarks, id]
    );
    return result.affectedRows === 1;
  }

  /**
   * Reporter disputes the fix, optionally attaching a photo as counter-evidence.
   * @returns {Promise<boolean>} true if this call settled the row
   */
  static async dispute(id, { disputePhoto = null, remarks = null } = {}, conn) {
    const [result] = await exec(conn).query(
      `UPDATE REPORT_VERIFICATION
          SET RESPONSE = 'Disputed', DISPUTE_PHOTO = ?, REMARKS = ?, RESPONDED_AT = NOW()
        WHERE VERIFICATION_ID = ? AND RESPONSE = 'Pending'`,
      [disputePhoto, remarks, id]
    );
    return result.affectedRows === 1;
  }

  // ------------------------------------------------------------------ cron

  /**
   * Pending verifications whose deadline has passed.
   * Uses IDX_VERIFICATION_CRON (RESPONSE, DEADLINE_AT).
   * Returns ISSUE_ID/REPORTER_ID so the caller can close each issue.
   */
  static async findExpired(conn) {
    const [rows] = await exec(conn).query(
      `SELECT VERIFICATION_ID, ISSUE_ID, PROOF_ID, REPORTER_ID, DEADLINE_AT
         FROM REPORT_VERIFICATION
        WHERE RESPONSE = 'Pending' AND DEADLINE_AT <= NOW()`
    );
    return rows;
  }

  /**
   * Mark one verification auto-closed (reporter never responded).
   * Guarded on 'Pending' so a reporter who responds at the last second wins.
   * @returns {Promise<boolean>} true if this call closed the row
   */
  static async autoClose(id, conn) {
    const [result] = await exec(conn).query(
      `UPDATE REPORT_VERIFICATION
          SET RESPONSE = 'auto_closed', RESPONDED_AT = NOW()
        WHERE VERIFICATION_ID = ? AND RESPONSE = 'Pending'`,
      [id]
    );
    return result.affectedRows === 1;
  }

  /**
   * Pending verifications that are due a reminder and haven't had it yet.
   * `day` must be 7 or 13 (matches REMINDER_7D_SENT / REMINDER_13D_SENT).
   * Reminders are keyed off the age of the request, so a missed cron run is
   * caught up on the next run instead of being skipped (the sent-flag prevents
   * duplicates). Rows past their deadline are excluded; autoClose handles those.
   */
  static async findDueForReminder(day, conn) {
    const column = REMINDER_COLUMNS[day];
    if (!column) throw new Error(`Unsupported reminder day: ${day} (use 7 or 13)`);

    const [rows] = await exec(conn).query(
      `SELECT VERIFICATION_ID, ISSUE_ID, REPORTER_ID, DEADLINE_AT
         FROM REPORT_VERIFICATION
        WHERE RESPONSE = 'Pending'
          AND ${column} = 0
          AND CREATED_AT <= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND DEADLINE_AT > NOW()`,
      [day]
    );
    return rows;
  }

  /** Record that a reminder went out so it is never sent twice. */
  static async markReminderSent(id, day, conn) {
    const column = REMINDER_COLUMNS[day];
    if (!column) throw new Error(`Unsupported reminder day: ${day} (use 7 or 13)`);

    const [result] = await exec(conn).query(
      `UPDATE REPORT_VERIFICATION SET ${column} = 1 WHERE VERIFICATION_ID = ?`,
      [id]
    );
    return result.affectedRows === 1;
  }
}

ReporterVerification.RESPONSE = RESPONSE;

module.exports = ReporterVerification;