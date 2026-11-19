const cron = require('node-cron');
const db = require('../config/db');
const ReporterVerification = require('../models/ReporterVerification');
const AuditService = require('../services/auditService');
const notificationService = require('../services/notificationService');

const REMINDER_DAYS = [
  parseInt(process.env.REMINDER_DAY_1, 10) || 7,
  parseInt(process.env.REMINDER_DAY_2, 10) || 13,
];

// Whitelist supported reminder days matching database columns
const SUPPORTED_REMINDER_DAYS = [7, 13];

/**
 * Send reminders to reporters who haven't responded yet.
 * The sent-flag is only set after the notification succeeds, so a failure
 * is retried on the next run instead of being silently lost.
 *
 * @param {number} day - 7 or 13
 * @returns {Promise<number>} count of reminders successfully sent
 */
async function sendReminders(day) {
  if (!SUPPORTED_REMINDER_DAYS.includes(day)) {
    console.warn(`[cron] Skipping unsupported reminder day ${day} (schema has 7 and 13 only)`);
    return 0;
  }

  const due = await ReporterVerification.findDueForReminder(day);
  let sentCount = 0;

  for (const v of due) {
    try {
      console.log(
        `[cron] Sending Day ${day} reminder -> reporter ${v.REPORTER_ID} (${v.REPORTER_EMAIL || 'no-email'}), issue ${v.ISSUE_ID}, deadline ${v.DEADLINE_AT}`
      );

      // 1. Dispatch real email & websocket notification
      await notificationService.notifyVerificationReminder({
        verificationId: v.VERIFICATION_ID,
        issueId: v.ISSUE_ID,
        reporterName: v.REPORTER_NAME,
        reporterEmail: v.REPORTER_EMAIL,
        issueTitle: v.ISSUE_TITLE,
        wardName: v.WARD_NAME,
        wardId: v.WARD_ID,
        day,
        deadlineAt: v.DEADLINE_AT,
        afterPhoto: v.AFTER_PHOTO,
        officerRemarks: v.OFFICER_REMARKS,
      });

      // 2. Mark reminder flag in database
      await ReporterVerification.markReminderSent(v.VERIFICATION_ID, day);

      // 3. Record in Audit Trail
      await AuditService.logReminderSent({
        day,
        verificationId: v.VERIFICATION_ID,
        issueId: v.ISSUE_ID,
        reporterId: v.REPORTER_ID,
        deadlineAt: v.DEADLINE_AT,
      });

      sentCount++;
    } catch (err) {
      console.error(
        `[cron] Reminder failed for verification ${v.VERIFICATION_ID} (day ${day}):`,
        err.message
      );
    }
  }

  console.log(`[cron] Successfully dispatched ${sentCount} Day ${day} reminder(s)`);
  return sentCount;
}

/**
 * Auto-close issues whose reporter never responded before the 14-day deadline.
 * Each verification is closed in its own atomic transaction (verification row +
 * issue row + audit trail records together).
 *
 * @returns {Promise<number>} count of issues auto-closed
 */
async function autoCloseExpired() {
  const expired = await ReporterVerification.findExpired();
  let closed = 0;

  for (const v of expired) {
    const conn = await db.getConnection();
    let shouldNotify = false;

    try {
      await conn.beginTransaction();

      // Atomic guard: returns false if reporter responded right before cron
      const won = await ReporterVerification.autoClose(v.VERIFICATION_ID, conn);
      if (won) {
        // Update Issue Status to Closed with CLOSURE_TYPE = 'Auto Closed'
        await conn.query(
          `UPDATE ISSUE
              SET STATUS = 'Closed', CLOSURE_TYPE = 'Auto Closed', CLOSED_AT = NOW()
            WHERE ISSUE_ID = ? AND STATUS = 'Resolved'`,
          [v.ISSUE_ID]
        );

        // Record Audit Trail for both Issue and Verification entities
        await AuditService.logAutoClose({
          issueId: v.ISSUE_ID,
          verificationId: v.VERIFICATION_ID,
          conn,
        });

        closed++;
        shouldNotify = true;
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      console.error(
        `[cron] Auto-close transaction failed for verification ${v.VERIFICATION_ID}:`,
        err.message
      );
    } finally {
      conn.release();
    }

    // Post-commit notification (cannot roll back the transaction if mail server fails)
    if (shouldNotify) {
      try {
        await notificationService.notifyAutoClose({
          issueId: v.ISSUE_ID,
          reporterName: v.REPORTER_NAME,
          reporterEmail: v.REPORTER_EMAIL,
          issueTitle: v.ISSUE_TITLE,
          wardName: v.WARD_NAME,
          wardId: v.WARD_ID,
        });
      } catch (notifyErr) {
        console.error(
          `[cron] Post auto-close notification failed for issue ${v.ISSUE_ID}:`,
          notifyErr.message
        );
      }
    }
  }

  console.log(`[cron] Auto-closed ${closed} ticket(s)`);
  return closed;
}

/**
 * Executes the daily job: reminders followed by auto-closing expired tickets.
 */
async function runDailyJob() {
  const startTime = new Date();
  console.log(`[cron] Daily job started at ${startTime.toISOString()}`);
  const summary = { reminders: {}, autoClosed: 0 };

  try {
    for (const day of REMINDER_DAYS) {
      summary.reminders[day] = await sendReminders(day);
    }
    summary.autoClosed = await autoCloseExpired();
    console.log(
      `[cron] Daily job finished in ${Date.now() - startTime.getTime()}ms. Summary:`,
      JSON.stringify(summary)
    );
  } catch (err) {
    // Cron errors should be logged and never crash the server
    console.error('[cron] Daily job encountered unexpected error:', err);
  }

  return summary;
}

/**
 * Schedules the recurring background cron job.
 */
function startAutoCloseJob() {
  const schedule = process.env.CRON_SCHEDULE || '5 0 * * *';
  const timezone = process.env.CRON_TIMEZONE || 'Asia/Colombo';

  cron.schedule(schedule, runDailyJob, { timezone });
  console.log(`[cron] autoCloseTickets scheduled (${schedule} in ${timezone})`);
}

// Support running directly from CLI: node server/cron/autoCloseTickets.js
if (require.main === module) {
  require('dotenv').config();
  (async () => {
    try {
      console.log('Running autoCloseTickets job manually from CLI...');
      const summary = await runDailyJob();
      console.log('CLI execution result:', summary);
      await db.end();
      process.exit(0);
    } catch (e) {
      console.error('CLI execution failed:', e);
      process.exit(1);
    }
  })();
}

module.exports = {
  startAutoCloseJob,
  runDailyJob,
  sendReminders,
  autoCloseExpired,
  SUPPORTED_REMINDER_DAYS,
};
