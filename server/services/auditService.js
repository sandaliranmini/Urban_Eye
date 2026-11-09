const AuditLog = require('../models/AuditLog');

/**
 * Audit Service
 * -------------
 * Provides high-level helper functions for recording business actions and audit trail entries.
 */

function extractClientInfo(req) {
  if (!req) return { ipAddress: null, userAgent: null };
  const forwarded = req.headers ? req.headers['x-forwarded-for'] : null;
  const ipAddress = forwarded
    ? forwarded.split(',')[0].trim()
    : req.ip || req.socket?.remoteAddress || null;
  const userAgent = req.headers ? req.headers['user-agent'] : null;
  return { ipAddress, userAgent };
}

function determinePerformer(user) {
  if (!user) {
    return { performedByType: AuditLog.PERFORMED_BY_TYPE.SYSTEM, performedById: null };
  }

  const role = String(user.role || '').toLowerCase();
  const kind = String(user.kind || '').toLowerCase();

  if (role === 'admin') {
    return {
      performedByType: AuditLog.PERFORMED_BY_TYPE.ADMIN,
      performedById: user.officer_id ?? user.id ?? null,
    };
  }

  if (kind === 'officer' || role === 'field_officer' || role === 'supervisor') {
    return {
      performedByType: AuditLog.PERFORMED_BY_TYPE.OFFICER,
      performedById: user.officer_id ?? user.id ?? null,
    };
  }

  if (kind === 'citizen' || role === 'citizen') {
    return {
      performedByType: AuditLog.PERFORMED_BY_TYPE.CITIZEN,
      performedById: user.citizen_id ?? user.id ?? null,
    };
  }

  return { performedByType: AuditLog.PERFORMED_BY_TYPE.SYSTEM, performedById: null };
}

class AuditService {
  /**
   * Generic logging helper.
   */
  static async logAction({
    entityType,
    entityId = null,
    action,
    user = null,
    req = null,
    oldState = null,
    newState = null,
    details = null,
    conn = null,
  }) {
    const { ipAddress, userAgent } = extractClientInfo(req);
    const performer = determinePerformer(user || (req && req.user));

    return AuditLog.log(
      {
        entityType,
        entityId,
        action,
        performedByType: performer.performedByType,
        performedById: performer.performedById,
        oldState,
        newState,
        details,
        ipAddress,
        userAgent,
      },
      conn
    );
  }

  /**
   * Log issue creation.
   */
  static async logIssueCreated({ issueId, citizenId, title, category, wardId, isEmergency, req, conn }) {
    const { ipAddress, userAgent } = extractClientInfo(req);
    return AuditLog.log(
      {
        entityType: AuditLog.ENTITY_TYPE.ISSUE,
        entityId: issueId,
        action: AuditLog.ACTION.ISSUE_CREATED,
        performedByType: AuditLog.PERFORMED_BY_TYPE.CITIZEN,
        performedById: citizenId,
        newState: { status: 'Open', category, wardId, isEmergency: !!isEmergency },
        details: { title, wardId },
        ipAddress,
        userAgent,
      },
      conn
    );
  }

  /**
   * Log issue status change (e.g. Open -> In Progress, etc.).
   */
  static async logStatusChange({
    issueId,
    oldStatus,
    newStatus,
    user,
    req,
    note = null,
    closureType = null,
    conn = null,
  }) {
    const { ipAddress, userAgent } = extractClientInfo(req);
    const performer = determinePerformer(user || (req && req.user));

    return AuditLog.log(
      {
        entityType: AuditLog.ENTITY_TYPE.ISSUE,
        entityId: issueId,
        action: AuditLog.ACTION.STATUS_CHANGED,
        performedByType: performer.performedByType,
        performedById: performer.performedById,
        oldState: { status: oldStatus },
        newState: { status: newStatus, closureType },
        details: { note, closureType },
        ipAddress,
        userAgent,
      },
      conn
    );
  }

  /**
   * Log resolution proof submission by an officer.
   */
  static async logProofSubmitted({
    proofId,
    issueId,
    officerId,
    afterPhoto,
    remarks = null,
    req,
    conn = null,
  }) {
    const { ipAddress, userAgent } = extractClientInfo(req);
    return AuditLog.log(
      {
        entityType: AuditLog.ENTITY_TYPE.RESOLUTION_PROOF,
        entityId: proofId,
        action: AuditLog.ACTION.PROOF_SUBMITTED,
        performedByType: AuditLog.PERFORMED_BY_TYPE.OFFICER,
        performedById: officerId,
        newState: { afterPhoto, remarks },
        details: { issueId, officerId },
        ipAddress,
        userAgent,
      },
      conn
    );
  }

  /**
   * Log opening of 14-day verification window.
   */
  static async logVerificationOpened({
    verificationId,
    issueId,
    reporterId,
    deadlineAt,
    conn = null,
  }) {
    return AuditLog.log(
      {
        entityType: AuditLog.ENTITY_TYPE.REPORT_VERIFICATION,
        entityId: verificationId,
        action: AuditLog.ACTION.VERIFICATION_OPENED,
        performedByType: AuditLog.PERFORMED_BY_TYPE.SYSTEM,
        performedById: null,
        newState: { response: 'Pending', deadlineAt },
        details: { issueId, reporterId, deadlineAt, windowDays: 14 },
      },
      conn
    );
  }

  /**
   * Log citizen confirming resolution.
   */
  static async logVerificationConfirmed({
    verificationId,
    issueId,
    reporterId,
    remarks = null,
    req,
    conn = null,
  }) {
    const { ipAddress, userAgent } = extractClientInfo(req);
    return AuditLog.log(
      {
        entityType: AuditLog.ENTITY_TYPE.REPORT_VERIFICATION,
        entityId: verificationId,
        action: AuditLog.ACTION.VERIFICATION_CONFIRMED,
        performedByType: AuditLog.PERFORMED_BY_TYPE.CITIZEN,
        performedById: reporterId,
        oldState: { response: 'Pending' },
        newState: { response: 'Confirmed', remarks },
        details: { issueId, reporterId, remarks },
        ipAddress,
        userAgent,
      },
      conn
    );
  }

  /**
   * Log citizen disputing resolution.
   */
  static async logVerificationDisputed({
    verificationId,
    issueId,
    reporterId,
    remarks = null,
    disputePhoto = null,
    req,
    conn = null,
  }) {
    const { ipAddress, userAgent } = extractClientInfo(req);
    return AuditLog.log(
      {
        entityType: AuditLog.ENTITY_TYPE.REPORT_VERIFICATION,
        entityId: verificationId,
        action: AuditLog.ACTION.VERIFICATION_DISPUTED,
        performedByType: AuditLog.PERFORMED_BY_TYPE.CITIZEN,
        performedById: reporterId,
        oldState: { response: 'Pending' },
        newState: { response: 'Disputed', remarks, disputePhoto },
        details: { issueId, reporterId, remarks },
        ipAddress,
        userAgent,
      },
      conn
    );
  }

  /**
   * Log automatic ticket closure (14-day timeout).
   */
  static async logAutoClose({ issueId, verificationId, conn = null }) {
    // 1. Log on ISSUE entity
    await AuditLog.log(
      {
        entityType: AuditLog.ENTITY_TYPE.ISSUE,
        entityId: issueId,
        action: AuditLog.ACTION.ISSUE_AUTO_CLOSED,
        performedByType: AuditLog.PERFORMED_BY_TYPE.SYSTEM,
        performedById: null,
        oldState: { status: 'Resolved' },
        newState: { status: 'Closed', closureType: 'Auto Closed' },
        details: {
          verificationId,
          reason: '14-day verification window elapsed without reporter response',
        },
      },
      conn
    );

    // 2. Log on REPORT_VERIFICATION entity
    await AuditLog.log(
      {
        entityType: AuditLog.ENTITY_TYPE.REPORT_VERIFICATION,
        entityId: verificationId,
        action: AuditLog.ACTION.VERIFICATION_AUTO_CLOSED,
        performedByType: AuditLog.PERFORMED_BY_TYPE.SYSTEM,
        performedById: null,
        oldState: { response: 'Pending' },
        newState: { response: 'auto_closed' },
        details: { issueId },
      },
      conn
    );
  }

  /**
   * Log reminder notification sent (7 days or 13 days).
   */
  static async logReminderSent({ day, verificationId, issueId, reporterId, deadlineAt, conn = null }) {
    const action = day === 7 ? AuditLog.ACTION.REMINDER_7D_SENT : AuditLog.ACTION.REMINDER_13D_SENT;
    return AuditLog.log(
      {
        entityType: AuditLog.ENTITY_TYPE.REPORT_VERIFICATION,
        entityId: verificationId,
        action,
        performedByType: AuditLog.PERFORMED_BY_TYPE.SYSTEM,
        performedById: null,
        details: {
          day,
          issueId,
          reporterId,
          deadlineAt,
          daysRemaining: day === 7 ? 7 : 1,
        },
      },
      conn
    );
  }
}

module.exports = AuditService;
