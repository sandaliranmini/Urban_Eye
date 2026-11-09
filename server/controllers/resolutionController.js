const db = require('../config/db');
const Issue = require('../models/Issue');
const ResolutionProof = require('../models/ResolutionProof');
const ReporterVerification = require('../models/ReporterVerification');
const AuditService = require('../services/auditService');
const { uploadImage } = require('../services/storageService');
const { notifyStatusChange } = require('../services/notificationService');
const { AppError } = require('../middleware/errorMiddleware');

const currentUserId = (req) => req.user.officer_id ?? req.user.citizen_id ?? req.user.id;

function parseId(value, label) {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1) {
    throw new AppError(`Invalid ${label}`, 400);
  }
  return Number(value);
}

/**
 * 1. Officer submits resolution proof (moves issue In Progress -> Resolved, opens 14d verification)
 * POST /api/issues/:id/resolution
 */
exports.submitProof = async (req, res) => {
  const issueId = parseId(req.params.id, 'issue id');
  const body = req.body || {};
  const remarks = body.remarks ? String(body.remarks).trim().slice(0, 1000) : null;
  const officerId = currentUserId(req);

  const issue = await Issue.findById(issueId);
  if (!issue) throw new AppError('Issue not found', 404);

  if (issue.STATUS !== 'In Progress') {
    throw new AppError(
      `Only issues currently "In Progress" can be marked as Resolved (current status: ${issue.STATUS})`,
      409
    );
  }

  let afterPhoto;
  if (req.file) {
    afterPhoto = await uploadImage(req.file, 'resolutions');
  } else if (process.env.NODE_ENV !== 'production' && /^https?:\/\/\S+$/.test(body.after_photo || '')) {
    afterPhoto = body.after_photo;
  } else {
    throw new AppError('Proof photo is required to mark an issue as Resolved', 400);
  }

  const conn = await db.getConnection();
  let proofId;
  let verificationId;

  try {
    await conn.beginTransaction();

    // 1. Create RESOLUTION_PROOF record
    proofId = await ResolutionProof.create(
      {
        issueId,
        officerId,
        afterPhoto,
        remarks,
      },
      conn
    );

    // 2. Update ISSUE to Resolved
    await conn.query(
      `UPDATE ISSUE
          SET STATUS = 'Resolved', RESOLVED_AT = NOW(), OFFICER_ID = ?
        WHERE ISSUE_ID = ?`,
      [officerId, issueId]
    );

    // 3. Create REPORT_VERIFICATION record with 14-day deadline
    verificationId = await ReporterVerification.create(
      {
        issueId,
        proofId,
        reporterId: issue.CITIZEN_ID,
        deadlineDays: 14,
      },
      conn
    );

    // 4. Audit Trail records
    await AuditService.logProofSubmitted({
      proofId,
      issueId,
      officerId,
      afterPhoto,
      remarks,
      req,
      conn,
    });

    await AuditService.logStatusChange({
      issueId,
      oldStatus: 'In Progress',
      newStatus: 'Resolved',
      user: req.user,
      req,
      note: remarks,
      conn,
    });

    await AuditService.logVerificationOpened({
      verificationId,
      issueId,
      reporterId: issue.CITIZEN_ID,
      deadlineAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      conn,
    });

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // Fire-and-forget notification to the citizen
  notifyStatusChange(issueId, 'In Progress', 'Resolved', { note: remarks });

  const updatedIssue = await Issue.findById(issueId);
  const verification = await ReporterVerification.findById(verificationId);

  res.status(201).json({
    success: true,
    message: 'Resolution proof submitted. 14-day verification window opened.',
    data: {
      issue: updatedIssue,
      proofId,
      verification,
    },
  });
};

/**
 * 2. Citizen confirms resolution (closes the issue: Status = Closed, Closure Type = Reporter Confirmed)
 * POST /api/issues/:id/verify/confirm
 */
exports.confirmResolution = async (req, res) => {
  const issueId = parseId(req.params.id, 'issue id');
  const body = req.body || {};
  const remarks = body.remarks ? String(body.remarks).trim().slice(0, 500) : null;
  const userId = currentUserId(req);

  const verification = await ReporterVerification.findPendingByIssue(issueId);
  if (!verification) {
    throw new AppError('No pending verification found for this issue', 404);
  }

  // Verification must belong to current citizen unless admin/supervisor
  if (
    req.user.role !== 'admin' &&
    req.user.role !== 'supervisor' &&
    verification.REPORTER_ID !== userId
  ) {
    throw new AppError('Only the reporting citizen can confirm this resolution', 403);
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const won = await ReporterVerification.confirm(verification.VERIFICATION_ID, remarks, conn);
    if (!won) {
      throw new AppError('Verification has already been settled or auto-closed', 409);
    }

    await conn.query(
      `UPDATE ISSUE
          SET STATUS = 'Closed', CLOSURE_TYPE = 'Reporter Confirmed', CLOSED_AT = NOW()
        WHERE ISSUE_ID = ?`,
      [issueId]
    );

    // Audit Trail
    await AuditService.logVerificationConfirmed({
      verificationId: verification.VERIFICATION_ID,
      issueId,
      reporterId: userId,
      remarks,
      req,
      conn,
    });

    await AuditService.logStatusChange({
      issueId,
      oldStatus: 'Resolved',
      newStatus: 'Closed',
      user: req.user,
      req,
      closureType: 'Reporter Confirmed',
      note: remarks,
      conn,
    });

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  notifyStatusChange(issueId, 'Resolved', 'Closed', { note: remarks });

  res.json({
    success: true,
    message: 'Resolution confirmed by reporter. Issue is now closed.',
    data: await Issue.findById(issueId),
  });
};

/**
 * 3. Citizen disputes resolution (sets issue Status = Disputed)
 * POST /api/issues/:id/verify/dispute
 */
exports.disputeResolution = async (req, res) => {
  const issueId = parseId(req.params.id, 'issue id');
  const body = req.body || {};
  const remarks = body.remarks ? String(body.remarks).trim().slice(0, 500) : null;
  const userId = currentUserId(req);

  const verification = await ReporterVerification.findPendingByIssue(issueId);
  if (!verification) {
    throw new AppError('No pending verification found for this issue', 404);
  }

  if (
    req.user.role !== 'admin' &&
    req.user.role !== 'supervisor' &&
    verification.REPORTER_ID !== userId
  ) {
    throw new AppError('Only the reporting citizen can dispute this resolution', 403);
  }

  let disputePhoto = null;
  if (req.file) {
    disputePhoto = await uploadImage(req.file, 'disputes');
  } else if (process.env.NODE_ENV !== 'production' && /^https?:\/\/\S+$/.test(body.dispute_photo || '')) {
    disputePhoto = body.dispute_photo;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const won = await ReporterVerification.dispute(
      verification.VERIFICATION_ID,
      { disputePhoto, remarks },
      conn
    );
    if (!won) {
      throw new AppError('Verification has already been settled or auto-closed', 409);
    }

    await conn.query(
      `UPDATE ISSUE
          SET STATUS = 'Disputed'
        WHERE ISSUE_ID = ?`,
      [issueId]
    );

    // Audit Trail
    await AuditService.logVerificationDisputed({
      verificationId: verification.VERIFICATION_ID,
      issueId,
      reporterId: userId,
      remarks,
      disputePhoto,
      req,
      conn,
    });

    await AuditService.logStatusChange({
      issueId,
      oldStatus: 'Resolved',
      newStatus: 'Disputed',
      user: req.user,
      req,
      note: remarks,
      conn,
    });

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  notifyStatusChange(issueId, 'Resolved', 'Disputed', { note: remarks });

  res.json({
    success: true,
    message: 'Resolution disputed by reporter. Issue is marked as Disputed for review.',
    data: await Issue.findById(issueId),
  });
};

/**
 * 4. Get verification details and timeline for an issue
 * GET /api/issues/:id/verification
 */
exports.getVerification = async (req, res) => {
  const issueId = parseId(req.params.id, 'issue id');
  const verifications = await ReporterVerification.findByIssue(issueId);
  const pending = verifications.find((v) => v.RESPONSE === 'Pending') || null;

  res.json({
    success: true,
    data: {
      pending,
      history: verifications,
    },
  });
};
