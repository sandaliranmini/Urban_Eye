const db = require('../config/db');

/**
 * AuditLog Model
 * --------------
 * Data-access layer for the AUDIT_LOG table.
 * Tracks every state change, administrative action, verification response,
 * reminder dispatch, and automated background operation (cron).
 */

const ENTITY_TYPE = Object.freeze({
  ISSUE: 'ISSUE',
  REPORT_VERIFICATION: 'REPORT_VERIFICATION',
  RESOLUTION_PROOF: 'RESOLUTION_PROOF',
  CITIZEN: 'CITIZEN',
  OFFICER: 'OFFICER',
  EMERGENCY_ALERT: 'EMERGENCY_ALERT',
  COMMENT: 'COMMENT',
  VOTE: 'VOTE',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  SYSTEM: 'SYSTEM',
});

const PERFORMED_BY_TYPE = Object.freeze({
  CITIZEN: 'CITIZEN',
  OFFICER: 'OFFICER',
  ADMIN: 'ADMIN',
  SYSTEM: 'SYSTEM',
});

const ACTION = Object.freeze({
  // Issues
  ISSUE_CREATED: 'ISSUE_CREATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  ISSUE_AUTO_CLOSED: 'ISSUE_AUTO_CLOSED',
  ISSUE_CLOSED: 'ISSUE_CLOSED',

  // Proof & Verification
  PROOF_SUBMITTED: 'PROOF_SUBMITTED',
  VERIFICATION_OPENED: 'VERIFICATION_OPENED',
  VERIFICATION_CONFIRMED: 'VERIFICATION_CONFIRMED',
  VERIFICATION_DISPUTED: 'VERIFICATION_DISPUTED',
  VERIFICATION_AUTO_CLOSED: 'VERIFICATION_AUTO_CLOSED',

  // Reminders
  REMINDER_7D_SENT: 'REMINDER_7D_SENT',
  REMINDER_13D_SENT: 'REMINDER_13D_SENT',

  // Emergency
  EMERGENCY_ALERT_RAISED: 'EMERGENCY_ALERT_RAISED',
  EMERGENCY_ALERT_ACKNOWLEDGED: 'EMERGENCY_ALERT_ACKNOWLEDGED',
  EMERGENCY_ALERT_CONFIRMED: 'EMERGENCY_ALERT_CONFIRMED',
  EMERGENCY_ALERT_DECLASSIFIED: 'EMERGENCY_ALERT_DECLASSIFIED',

  // Announcements
  ANNOUNCEMENT_CREATED: 'ANNOUNCEMENT_CREATED',

  // Auth / Accounts
  CITIZEN_REGISTERED: 'CITIZEN_REGISTERED',
  OFFICER_CREATED: 'OFFICER_CREATED',
  USER_LOGIN: 'USER_LOGIN',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
});

const exec = (conn) => conn || db;

const safeJson = (val) => {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(val);
  } catch (err) {
    return null;
  }
};

class AuditLog {
  /**
   * Insert a new audit log record.
   * Takes an optional `conn` to execute inside a parent transaction.
   *
   * @param {Object} entry
   * @param {string} entry.entityType - ENTITY_TYPE enum value
   * @param {number|null} entry.entityId - ID of the entity affected
   * @param {string} entry.action - ACTION enum or string
   * @param {string} entry.performedByType - 'CITIZEN' | 'OFFICER' | 'ADMIN' | 'SYSTEM'
   * @param {number|null} entry.performedById - User ID or null for system
   * @param {Object|null} [entry.oldState] - Previous state
   * @param {Object|null} [entry.newState] - New state
   * @param {Object|null} [entry.details] - Additional contextual data / metadata
   * @param {string|null} [entry.ipAddress] - Request IP
   * @param {string|null} [entry.userAgent] - Client User Agent
   * @param {Object|null} [conn] - Database connection (inside transaction)
   * @returns {Promise<number>} the new LOG_ID
   */
  static async log(
    {
      entityType,
      entityId = null,
      action,
      performedByType = PERFORMED_BY_TYPE.SYSTEM,
      performedById = null,
      oldState = null,
      newState = null,
      details = null,
      ipAddress = null,
      userAgent = null,
    },
    conn = null
  ) {
    try {
      const [result] = await exec(conn).query(
        `INSERT INTO AUDIT_LOG
           (ENTITY_TYPE, ENTITY_ID, ACTION, PERFORMED_BY_TYPE, PERFORMED_BY_ID,
            OLD_STATE, NEW_STATE, DETAILS, IP_ADDRESS, USER_AGENT)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entityType,
          entityId,
          action,
          performedByType,
          performedById,
          safeJson(oldState),
          safeJson(newState),
          safeJson(details),
          ipAddress ? String(ipAddress).slice(0, 45) : null,
          userAgent ? String(userAgent).slice(0, 255) : null,
        ]
      );
      return result.insertId;
    } catch (err) {
      // In non-transactional contexts, don't crash the main operation on logging error
      if (!conn) {
        console.error('[AuditLog] Error writing audit log:', err.message);
        return null;
      }
      throw err;
    }
  }

  /**
   * Fetch audit logs for a specific entity (e.g. ISSUE, CITIZEN, etc.).
   */
  static async findByEntity(entityType, entityId, { limit = 50, offset = 0, sort = 'desc' } = {}, conn) {
    const direction = String(sort).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const [rows] = await exec(conn).query(
      `SELECT * FROM AUDIT_LOG
        WHERE ENTITY_TYPE = ? AND ENTITY_ID = ?
        ORDER BY CREATED_AT ${direction}, LOG_ID ${direction}
        LIMIT ? OFFSET ?`,
      [entityType, entityId, limit, offset]
    );
    return rows;
  }

  /**
   * Fetch complete audit trail history for an issue:
   * Combines direct ISSUE records, RESOLUTION_PROOF records, and REPORT_VERIFICATION records.
   */
  static async findByIssue(issueId, { limit = 50, offset = 0 } = {}, conn) {
    const [rows] = await exec(conn).query(
      `SELECT a.*,
              CASE
                WHEN a.PERFORMED_BY_TYPE = 'CITIZEN' THEN (SELECT FULL_NAME FROM CITIZEN WHERE CITIZEN_ID = a.PERFORMED_BY_ID)
                WHEN a.PERFORMED_BY_TYPE IN ('OFFICER', 'ADMIN') THEN (SELECT FULL_NAME FROM OFFICER WHERE OFFICER_ID = a.PERFORMED_BY_ID)
                ELSE 'Automated System'
              END AS PERFORMED_BY_NAME
         FROM AUDIT_LOG a
        WHERE (a.ENTITY_TYPE = 'ISSUE' AND a.ENTITY_ID = ?)
           OR (a.ENTITY_TYPE = 'REPORT_VERIFICATION' AND JSON_UNQUOTE(JSON_EXTRACT(a.DETAILS, '$.issueId')) = ?)
           OR (a.ENTITY_TYPE = 'RESOLUTION_PROOF' AND JSON_UNQUOTE(JSON_EXTRACT(a.DETAILS, '$.issueId')) = ?)
        ORDER BY a.CREATED_AT DESC, a.LOG_ID DESC
        LIMIT ? OFFSET ?`,
      [issueId, String(issueId), String(issueId), limit, offset]
    );
    return rows;
  }

  /**
   * Paginated and filtered query for administration & audit dashboards.
   */
  static async findAll(
    {
      entityType,
      entityId,
      action,
      performedByType,
      performedById,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sort = 'desc',
    } = {},
    conn
  ) {
    const where = [];
    const params = [];

    if (entityType) {
      where.push('ENTITY_TYPE = ?');
      params.push(entityType);
    }
    if (entityId) {
      where.push('ENTITY_ID = ?');
      params.push(entityId);
    }
    if (action) {
      where.push('ACTION = ?');
      params.push(action);
    }
    if (performedByType) {
      where.push('PERFORMED_BY_TYPE = ?');
      params.push(performedByType);
    }
    if (performedById) {
      where.push('PERFORMED_BY_ID = ?');
      params.push(performedById);
    }
    if (startDate) {
      where.push('CREATED_AT >= ?');
      params.push(startDate);
    }
    if (endDate) {
      where.push('CREATED_AT <= ?');
      params.push(endDate);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const direction = String(sort).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const offset = Math.max(0, (Number(page) - 1) * Number(limit));

    const [rows] = await exec(conn).query(
      `SELECT a.*,
              CASE
                WHEN a.PERFORMED_BY_TYPE = 'CITIZEN' THEN (SELECT FULL_NAME FROM CITIZEN WHERE CITIZEN_ID = a.PERFORMED_BY_ID)
                WHEN a.PERFORMED_BY_TYPE IN ('OFFICER', 'ADMIN') THEN (SELECT FULL_NAME FROM OFFICER WHERE OFFICER_ID = a.PERFORMED_BY_ID)
                ELSE 'Automated System'
              END AS PERFORMED_BY_NAME
         FROM AUDIT_LOG a
        ${whereSql}
        ORDER BY a.CREATED_AT ${direction}, a.LOG_ID ${direction}
        LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    return rows;
  }

  /**
   * Count total logs for pagination.
   */
  static async countAll(filters = {}, conn) {
    const where = [];
    const params = [];

    if (filters.entityType) {
      where.push('ENTITY_TYPE = ?');
      params.push(filters.entityType);
    }
    if (filters.entityId) {
      where.push('ENTITY_ID = ?');
      params.push(filters.entityId);
    }
    if (filters.action) {
      where.push('ACTION = ?');
      params.push(filters.action);
    }
    if (filters.performedByType) {
      where.push('PERFORMED_BY_TYPE = ?');
      params.push(filters.performedByType);
    }
    if (filters.performedById) {
      where.push('PERFORMED_BY_ID = ?');
      params.push(filters.performedById);
    }
    if (filters.startDate) {
      where.push('CREATED_AT >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      where.push('CREATED_AT <= ?');
      params.push(filters.endDate);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[row]] = await exec(conn).query(
      `SELECT COUNT(*) AS total FROM AUDIT_LOG ${whereSql}`,
      params
    );
    return row.total;
  }

  /**
   * Get activity statistics (actions breakdown).
   */
  static async getStats({ startDate, endDate } = {}, conn) {
    const where = [];
    const params = [];
    if (startDate) {
      where.push('CREATED_AT >= ?');
      params.push(startDate);
    }
    if (endDate) {
      where.push('CREATED_AT <= ?');
      params.push(endDate);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await exec(conn).query(
      `SELECT ACTION, COUNT(*) AS count
         FROM AUDIT_LOG
        ${whereSql}
        GROUP BY ACTION
        ORDER BY count DESC`,
      params
    );
    return rows;
  }
}

AuditLog.ENTITY_TYPE = ENTITY_TYPE;
AuditLog.PERFORMED_BY_TYPE = PERFORMED_BY_TYPE;
AuditLog.ACTION = ACTION;

module.exports = AuditLog;
