const Issue = require('../models/Issue');
const { sendEmail } = require('./emailService');
const { buildStatusEmail } = require('../templates/statusEmail');

// Emails the reporter about a status change. Never throws, so callers can fire and forget.
async function notifyStatusChange(issueId, oldStatus, newStatus, { note } = {}) {
  try {
    if (oldStatus === newStatus) return;

    const contact = await Issue.findReporterContact(issueId);
    if (!contact) return;
    if (!contact.IS_ACTIVE) return;
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

module.exports = { notifyStatusChange };
