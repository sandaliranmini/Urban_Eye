const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

/**
 * Builds email notification sent when a ticket is auto-closed after 14 days.
 *
 * @param {Object} params
 * @param {string} params.name - Reporter name
 * @param {string} params.title - Issue title
 * @param {string} [params.wardName] - Ward name
 * @param {string} params.link - Issue view link
 */
function buildAutoCloseEmail({ name, title, wardName, link }) {
  const subject = `Urban Eye: Issue "${title.slice(0, 40)}..." has been automatically closed`;

  const text = [
    `Hello ${name || 'Citizen'},`,
    '',
    'Notice: Your reported issue has been automatically closed.',
    '',
    `Report: ${title}`,
    wardName ? `Ward: ${wardName}` : null,
    'Status: Closed (Auto Closed)',
    '',
    'Explanation: The municipal council completed work on this issue and submitted resolution proof 14 days ago. As no confirmation or dispute was recorded within the 14-day verification window, the system has automatically archived and closed this report.',
    '',
    'Thank you for contributing to your community with Urban Eye.',
    '',
    `View report details: ${link}`,
    '',
    'Urban Eye - transparent, verified civic issue management',
  ]
    .filter((line) => line !== null)
    .join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937; line-height: 1.6; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background: #4b5563; color: #ffffff; padding: 20px 24px;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 700;">Report Automatically Closed</h2>
        <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.95;">14-Day Verification Window Expired</p>
      </div>

      <div style="padding: 24px;">
        <p style="font-size: 16px; margin-top: 0;">Hello <strong>${escapeHtml(name || 'Citizen')}</strong>,</p>
        <p style="font-size: 15px; color: #374151;">
          Your report titled <strong>"${escapeHtml(title)}"</strong> has been marked as <strong>Closed</strong>.
        </p>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #6b7280; width: 140px;">Report:</td>
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
              <td style="padding: 6px 0; color: #6b7280;">Closure Type:</td>
              <td style="padding: 6px 0;"><span style="background: #e5e7eb; color: #374151; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Auto Closed (14 Days)</span></td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; color: #4b5563;">
          The municipal council completed work on this issue and submitted proof of resolution. Since no response was received within the 14-day review period, the ticket has now been officially closed and archived.
        </p>

        <div style="margin: 24px 0; text-align: center;">
          <a href="${escapeHtml(link)}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 10px 24px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 6px;">
            View Closed Report
          </a>
        </div>

        <p style="font-size: 13px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 16px; margin-bottom: 0;">
          Thank you for taking an active role in keeping your community safe and clean.
        </p>
      </div>

      <div style="background: #f3f4f6; padding: 12px 24px; text-align: center; font-size: 12px; color: #9ca3af;">
        Urban Eye - Transparent civic issue management for Sri Lankan Municipal Councils
      </div>
    </div>
  `;

  return { subject, text, html };
}

module.exports = { buildAutoCloseEmail };
