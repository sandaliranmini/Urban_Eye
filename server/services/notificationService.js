const Issue = require('../models/Issue');
const { sendEmail } = require('./emailService');
const { buildStatusEmail } = require('../templates/statusEmail');
const { buildReminderEmail } = require('../templates/reminderEmail');
const { buildAutoCloseEmail } = require('../templates/autoCloseEmail');

function tryEmit(room, event, payload) {
  try {
    const { getIO } = require('../config/socket');
    getIO().to(room).emit(event, payload);
  } catch (err) {
    // Socket.IO not initialized or not in web context; safe to suppress
  }
}

// Emails the reporter about a status change. Never throws, so callers can fire and forget.
async function notifyStatusChange(issueId, oldStatus, newStatus, { note } = {}) {
  try {
    if (oldStatus === newStatus) return;

    const contact = await Issue.findReporterContact(issueId);
    if (!contact) return;
    if (!contact.IS_ACTIVE) return;

    // Real-time notification over Socket.IO if citizen or ward is listening
    tryEmit(`ward:${contact.WARD_ID}`, 'issue:status_changed', {
      issueId,
      oldStatus,
      newStatus,
      note,
    });

    if (!contact.EMAIL) {
      console.log(`[notify] issue ${issueId}: reporter has no email, skipped`);
      return;
    }

    const link = `${process.env.CLIENT_URL || 'http://localhost:3000'}/issue/${issueId}`;
    const { subject, text, html } = buildStatusEmail({
      name: contact.FULL_NAME,
      title: contact.TITLE,
      oldStatus,
      newStatus,
      note,
      link,
    });

    await sendEmail({ to: contact.EMAIL, subject, text, html });
    console.log(`[notify] issue ${issueId}: "${oldStatus}" -> "${newStatus}" email sent`);
  } catch (err) {
    console.error(`[notify] issue ${issueId} failed:`, err.message);
  }
}

/**
 * Sends a reminder notification (Day 7 or Day 13) to a citizen awaiting verification.
 */
async function notifyVerificationReminder({
  verificationId,
  issueId,
  reporterName,
  reporterEmail,
  issueTitle,
  wardName,
  wardId,
  day,
  deadlineAt,
  afterPhoto,
  officerRemarks,
}) {
  try {
    // Real-time socket notification
    if (wardId) {
      tryEmit(`ward:${wardId}`, 'notification:reminder', {
        verificationId,
        issueId,
        day,
        deadlineAt,
      });
    }

    if (!reporterEmail) {
      console.log(`[notify:reminder] verification ${verificationId}: reporter has no email, skipped`);
      return;
    }

    const link = `${process.env.CLIENT_URL || 'http://localhost:3000'}/issue/${issueId}`;
    const { subject, text, html } = buildReminderEmail({
      name: reporterName,
      title: issueTitle,
      wardName,
      day,
      deadlineAt,
      afterPhoto,
      officerRemarks,
      link,
    });

    await sendEmail({ to: reporterEmail, subject, text, html });
    console.log(`[notify:reminder] Day ${day} reminder sent to ${reporterEmail} for issue ${issueId}`);
  } catch (err) {
    console.error(`[notify:reminder] verification ${verificationId} failed:`, err.message);
    throw err; // Re-throw so caller knows email failed and doesn't prematurely mark as sent
  }
}

/**
 * Sends notification when an issue is auto-closed after 14 days of inactivity.
 */
async function notifyAutoClose({ issueId, reporterName, reporterEmail, issueTitle, wardName, wardId }) {
  try {
    if (wardId) {
      tryEmit(`ward:${wardId}`, 'issue:auto_closed', { issueId });
    }

    if (!reporterEmail) return;

    const link = `${process.env.CLIENT_URL || 'http://localhost:3000'}/issue/${issueId}`;
    const { subject, text, html } = buildAutoCloseEmail({
      name: reporterName,
      title: issueTitle,
      wardName,
      link,
    });

    await sendEmail({ to: reporterEmail, subject, text, html });
    console.log(`[notify:autoclose] Auto-close notification sent to ${reporterEmail} for issue ${issueId}`);
  } catch (err) {
    console.error(`[notify:autoclose] issue ${issueId} failed:`, err.message);
  }
}

module.exports = { notifyStatusChange, notifyVerificationReminder, notifyAutoClose };
