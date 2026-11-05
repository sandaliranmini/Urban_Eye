const db = require('../config/db');

/**
 * EmergencyAlert
 * --------------
 * Data-access layer for the EMERGENCY_ALERT table (one alert per emergency issue).
 *
 * Lifecycle (OUTCOME column):
 *   Pending  --acknowledge()-->  Pending (OFFICER_ID + ACKNOWLEDGE_AT now set)
 *   Pending  --confirm()-->      Confirmed     (dispatch the field team)
 *   Pending  --declassify()-->   Declassified  (false alarm or downgraded to routine)
 *
 * "Acknowledged" is not its own OUTCOME value in schema.sql; it is derived from
 * ACKNOWLEDGE_AT IS NOT NULL while OUTCOME is still 'Pending'.
 *
 * Every method takes an optional `conn` as its last argument. Pass a connection
 * from `db.getConnection()` when the call must succeed or fail together with
 * other writes (e.g. creating the ISSUE row in the same transaction). Without it,
 * the shared pool is used.
 *
 * NOTE: this model only touches EMERGENCY_ALERT. Updating ISSUE.STATUS,
 * notifying people, and changing the reporter's CREDIBILITY_SCORE is the
 * caller's job (controller / service), ideally in the same transaction.
 */

const OUTCOME = Object.freeze({
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  DECLASSIFIED: 'Declassified',
});

const exec = (conn) => conn || db;

class EmergencyAlert {
  // ---------------------------------------------------------------- create

  /**
   * Raise an alert for an emergency issue.
   * Call this in the same transaction as the ISSUE insert (pass `conn`).
   *
   * @returns {Promise<number>} the new ALERT_ID
   * @throws  ER_DUP_ENTRY if the issue already has an alert (ISSUE_ID is UNIQUE)
   */
  static async create({ issueId, message = null }, conn) {
    const [result] = await exec(conn).query(
      'INSERT INTO EMERGENCY_ALERT (ISSUE_ID, MESSAGE) VALUES (?, ?)',
      [issueId, message]
    );
    return result.insertId;
  }

  // ------------------------------------------------------------------ read

  static async findById(id, conn) {
    const [rows] = await exec(conn).query(
      'SELECT * FROM EMERGENCY_ALERT WHERE ALERT_ID = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async findByIssueId(issueId, conn) {
    const [rows] = await exec(conn).query(
      'SELECT * FROM EMERGENCY_ALERT WHERE ISSUE_ID = ?',
      [issueId]
    );
    return rows[0] || null;
  }

  /**
   * Alerts still waiting on a decision (OUTCOME = 'Pending'), joined with the
   * issue, ward and reporter credibility so the emergency queue renders from one
   * query. Unacknowledged first, then oldest first.
   *
   * @param {object}  [opts]
   * @param {number}  [opts.wardId]  limit to one ward (officers); omit for all (admins)
   */
  static async findActive({ wardId = null } = {}, conn) {
    const params = [];
    let wardFilter = '';
    if (wardId !== null) {
      wardFilter = 'AND i.WARD_ID = ?';
      params.push(wardId);
    }
    const [rows] = await exec(conn).query(
      `SELECT a.*,
              (a.ACKNOWLEDGE_AT IS NOT NULL) AS IS_ACKNOWLEDGED,
              i.TITLE             AS ISSUE_TITLE,
              i.CATEGORY          AS ISSUE_CATEGORY,
              i.BEFORE_PHOTO      AS BEFORE_PHOTO,
              i.WARD_ID           AS WARD_ID,
              w.WARD_NAME         AS WARD_NAME,
              c.CREDIBILITY_SCORE AS REPORTER_CREDIBILITY
         FROM EMERGENCY_ALERT a
         JOIN ISSUE   i ON i.ISSUE_ID   = a.ISSUE_ID
         JOIN WARD    w ON w.WARD_ID    = i.WARD_ID
         JOIN CITIZEN c ON c.CITIZEN_ID = i.CITIZEN_ID
        WHERE a.OUTCOME = 'Pending' ${wardFilter}
        ORDER BY (a.ACKNOWLEDGE_AT IS NOT NULL) ASC, a.SENT_AT ASC`,
      params
    );
    return rows;
  }

  /**
   * Pending alerts nobody has acknowledged within `minutes`. Used by the
   * escalation cron job to find alerts to push up to supervisors/admins.
   */
  static async findOverdueUnacknowledged(minutes, conn) {
    const [rows] = await exec(conn).query(
      `SELECT * FROM EMERGENCY_ALERT
        WHERE OUTCOME = 'Pending'
          AND ACKNOWLEDGE_AT IS NULL
          AND SENT_AT <= DATE_SUB(NOW(), INTERVAL ? MINUTE)
        ORDER BY SENT_AT ASC`,
      [minutes]
    );
    return rows;
  }

  // ------------------------------------------------------------ officer actions
  // Each UPDATE guards on the current state, so a double-click or two officers
  // acting at once cannot overwrite each other. They return true if this call
  // changed the row, false if the alert was already settled.

  /** First officer to acknowledge wins; later calls return false. */
  static async acknowledge(id, officerId, conn) {
    const [result] = await exec(conn).query(
      `UPDATE EMERGENCY_ALERT
          SET OFFICER_ID = ?, ACKNOWLEDGE_AT = NOW()
        WHERE ALERT_ID = ? AND OUTCOME = 'Pending' AND ACKNOWLEDGE_AT IS NULL`,
      [officerId, id]
    );
    return result.affectedRows === 1;
  }

  /** Confirm for dispatch. Also records the acknowledgement if it was skipped. */
  static async confirm(id, officerId, conn) {
    const [result] = await exec(conn).query(
      `UPDATE EMERGENCY_ALERT
          SET OUTCOME = 'Confirmed',
              OFFICER_ID = COALESCE(OFFICER_ID, ?),
              ACKNOWLEDGE_AT = COALESCE(ACKNOWLEDGE_AT, NOW())
        WHERE ALERT_ID = ? AND OUTCOME = 'Pending'`,
      [officerId, id]
    );
    return result.affectedRows === 1;
  }

  /**
   * Mark as false alarm / downgrade to a routine issue.
   * There is no reason column in EMERGENCY_ALERT, so the caller must store the
   * required reason elsewhere (status history, notification, credibility log).
   */
  static async declassify(id, officerId, conn) {
    const [result] = await exec(conn).query(
      `UPDATE EMERGENCY_ALERT
          SET OUTCOME = 'Declassified',
              OFFICER_ID = COALESCE(OFFICER_ID, ?),
              ACKNOWLEDGE_AT = COALESCE(ACKNOWLEDGE_AT, NOW())
        WHERE ALERT_ID = ? AND OUTCOME = 'Pending'`,
      [officerId, id]
    );
    return result.affectedRows === 1;
  }

  // ----------------------------------------------------------------- stats

  /** Average seconds from alert to acknowledgement, per ward (admin analytics). */
  static async getResponseStats(conn) {
    const [rows] = await exec(conn).query(
      `SELECT i.WARD_ID,
              w.WARD_NAME,
              COUNT(*) AS TOTAL_ALERTS,
              SUM(a.ACKNOWLEDGE_AT IS NOT NULL) AS ACKNOWLEDGED,
              AVG(TIMESTAMPDIFF(SECOND, a.SENT_AT, a.ACKNOWLEDGE_AT)) AS AVG_SECONDS_TO_ACK
         FROM EMERGENCY_ALERT a
         JOIN ISSUE i ON i.ISSUE_ID = a.ISSUE_ID
         JOIN WARD  w ON w.WARD_ID  = i.WARD_ID
        GROUP BY i.WARD_ID, w.WARD_NAME`
    );
    return rows;
  }
}

EmergencyAlert.OUTCOME = OUTCOME;

module.exports = EmergencyAlert;