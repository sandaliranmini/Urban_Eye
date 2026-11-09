const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

/**
 * Builds email templates for 7-day and 13-day reminders.
 *
 * @param {Object} params
 * @param {string} params.name - Reporter name
 * @param {string} params.title - Issue title
 * @param {string} params.wardName - Ward name
 * @param {number} params.day - 7 or 13
 * @param {string|Date} params.deadlineAt - Verification deadline
 * @param {string} [params.afterPhoto] - Resolution proof image URL
 * @param {string} [params.officerRemarks] - Remarks from the officer
 * @param {string} params.link - Action link to view/confirm/dispute
 */
function buildReminderEmail({
  name,
  title,
  wardName,
  day,
  deadlineAt,
  afterPhoto,
  officerRemarks,
  link,
}) {
  const isUrgent = day === 13;
  const daysRemaining = isUrgent ? 1 : 7;
  const deadlineStr = new Date(deadlineAt).toLocaleDateString('en-LK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const subject = isUrgent
    ? `[URGENT - 24 Hours Left] Action needed on your report: "${title.slice(0, 40)}..."`
    : `[Reminder - 7 Days Left] Please verify resolution of: "${title.slice(0, 40)}..."`;

  const bannerColor = isUrgent ? '#dc2626' : '#2563eb';
  const bannerTitle = isUrgent
    ? 'URGENT: Final 24 Hours to Respond'
    : 'Reminder: Action Required on Your Civic Report';

  const summaryMessage = isUrgent
    ? 'This is your final reminder. The municipal council has marked your civic report as resolved. You have 24 hours remaining to confirm or dispute this work before it is automatically closed.'
    : 'The municipal council marked your civic report as resolved 7 days ago. You have 7 days remaining to review the work and either confirm it was fixed or dispute it.';

  const text = [
    `Hello ${name || 'Citizen'},`,
    '',
    bannerTitle,
    summaryMessage,
    '',
    `Report: ${title}`,
    wardName ? `Ward: ${wardName}` : null,
    `Deadline: ${deadlineStr} (${daysRemaining} day${daysRemaining > 1 ? 's' : ''} remaining)`,
    officerRemarks ? `Officer Remarks: ${officerRemarks}` : null,
    '',
    'If you do not confirm or dispute before the deadline, this ticket will be automatically closed by the system.',
    '',
    `Verify now: ${link}`,
    '',
    'Urban Eye - Civic Issue Triage and Verification System',
  ]
    .filter((line) => line !== null)
    .join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937; line-height: 1.6; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background: ${bannerColor}; color: #ffffff; padding: 20px 24px;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 700;">${escapeHtml(bannerTitle)}</h2>
        <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.95;">Urban Eye Civic Issue Verification</p>
      </div>

      <div style="padding: 24px;">
        <p style="font-size: 16px; margin-top: 0;">Hello <strong>${escapeHtml(name || 'Citizen')}</strong>,</p>
        <p style="font-size: 15px; color: #374151;">${escapeHtml(summaryMessage)}</p>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #6b7280; width: 140px;">Report Title:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #111827;">${escapeHtml(title)}</td>
            </tr>
            ${
              wardName
                ? `<tr>
                    <td style="padding: 6px 0; color: #6b7280;">Ward:</td>
                    <td style="padding: 6px 0; color: #111827;">${escapeHtml(wardName)}</td>
                  </tr>`
                : ''
            }
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Status:</td>
              <td style="padding: 6px 0;"><span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Pending Verification</span></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Auto-Close Deadline:</td>
              <td style="padding: 6px 0; font-weight: 700; color: ${isUrgent ? '#dc2626' : '#111827'};">
                ${escapeHtml(deadlineStr)} (${daysRemaining} day${daysRemaining > 1 ? 's' : ''} left)
              </td>
            </tr>
            ${
              officerRemarks
                ? `<tr>
                    <td style="padding: 6px 0; color: #6b7280;">Officer Notes:</td>
                    <td style="padding: 6px 0; color: #374151;"><em>${escapeHtml(officerRemarks)}</em></td>
                  </tr>`
                : ''
            }
          </table>
        </div>

        ${
          afterPhoto
            ? `<div style="margin: 20px 0; text-align: center;">
                <p style="font-size: 13px; color: #6b7280; margin-bottom: 8px;">Proof of Work Uploaded by Council:</p>
                <img src="${escapeHtml(afterPhoto)}" alt="Resolution Proof" style="max-width: 100%; height: auto; border-radius: 6px; border: 1px solid #d1d5db; max-height: 260px;" />
              </div>`
            : ''
        }

        <div style="margin: 28px 0; text-align: center;">
          <a href="${escapeHtml(link)}" style="display: inline-block; background: ${bannerColor}; color: #ffffff; padding: 12px 28px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            Review & Verify Resolution
          </a>
        </div>

        <p style="font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 16px; margin-bottom: 0;">
          <strong>Why is this important?</strong> If the issue has not been satisfactorily fixed, you have the right to dispute it with photo evidence. If no response is received before the deadline, the system assumes the issue is resolved and will automatically close the ticket.
        </p>
      </div>

      <div style="background: #f3f4f6; padding: 12px 24px; text-align: center; font-size: 12px; color: #9ca3af;">
        Urban Eye - Transparent civic issue management for Sri Lankan Municipal Councils
      </div>
    </div>
  `;

  return { subject, text, html };
}

module.exports = { buildReminderEmail };
