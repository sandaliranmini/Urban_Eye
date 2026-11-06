const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

const MESSAGES = {
  Open: 'Your report is open and visible to your community.',
  'In Progress': 'An officer has started working on your report.',
  Resolved:
    'The council has marked your report as resolved and uploaded a photo of the finished work. ' +
    'Please check it and confirm or dispute the fix within 14 days. ' +
    'If you do not respond, the report will be closed automatically.',
  Closed: 'Your report is now closed. Thank you for helping improve your ward.',
  Disputed: 'Your dispute has been recorded. The report has been reopened and sent for review.',
};

function buildStatusEmail({ name, title, oldStatus, newStatus, note, link }) {
  const message = MESSAGES[newStatus] || `The status of your report changed to ${newStatus}.`;
  // user-written text (title, note) is kept out of the subject line on purpose
  const subject = `Urban Eye: your report is now "${newStatus}"`;

  const text = [
    `Hello ${name || 'citizen'},`,
    '',
    message,
    '',
    `Report: ${title}`,
    `Status: ${oldStatus} -> ${newStatus}`,
    note ? `Note from the council: ${note}` : null,
    '',
    `View your report: ${link}`,
    '',
    'Urban Eye - transparent, verified civic issue management',
  ].filter((line) => line !== null).join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #222;">
      <h2 style="margin-bottom: 4px;">Update on your report</h2>
      <p>Hello ${escapeHtml(name || 'citizen')},</p>
      <p>${escapeHtml(message)}</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr><td style="padding: 6px 0; color: #666;">Report</td><td style="padding: 6px 0;"><strong>${escapeHtml(title)}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Status</td><td style="padding: 6px 0;">${escapeHtml(oldStatus)} &rarr; <strong>${escapeHtml(newStatus)}</strong></td></tr>
        ${note ? `<tr><td style="padding: 6px 0; color: #666;">Note</td><td style="padding: 6px 0;">${escapeHtml(note)}</td></tr>` : ''}
      </table>
      <p><a href="${escapeHtml(link)}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">View your report</a></p>
      <p style="color: #888; font-size: 12px;">Urban Eye - transparent, verified civic issue management</p>
    </div>`;

  return { subject, text, html };
}

module.exports = { buildStatusEmail };