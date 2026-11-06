const cron = require('node-cron');
const db = require('../config/db');
const ReporterVerification = require('../models/ReporterVerification');

const REMINDER_DAYS = [
  parseInt(process.env.REMINDER_DAY_1, 10) || 7,
  parseInt(process.env.REMINDER_DAY_2, 10) || 13,
];

// The model only supports the two reminder flags that exist in the schema.
const SUPPORTED_REMINDER_DAYS = [7, 13];

/**
 * Send reminders to reporters who haven't responded yet.
 * The sent-flag is only set after the notification succeeds, so a failure
 * is retried on the next run instead of being silently lost.
 */
async function sendReminders(day) {
  if (!SUPPORTED_REMINDER_DAYS.includes(day)) {
    console.warn(`[cron] Skipping unsupported reminder day ${day} (schema has 7 and 13 only)`);
    return;
  }

  const due = await ReporterVerification.findDueForReminder(day);
  for (const v of due) {
    try {
      // TODO: replace with your real notification (Socket.IO / email / DB row)
      console.log(
        `[cron] Reminder (day ${day}) -> reporter ${v.REPORTER_ID}, issue ${v.ISSUE_ID}, deadline ${v.DEADLINE_AT}`
      );
      await ReporterVerification.markReminderSent(v.VERIFICATION_ID, day);
    } catch (err) {
      console.error(`[cron] Reminder failed for verification ${v.VERIFICATION_ID}:`, err.message);
    }
  }
}

/**
 * Auto-close issues whose reporter never responded before the deadline.
 * Each verification is closed in its own transaction (verification row + issue
 * row together), so one bad row can't block or half-apply the others.
 */
async function autoCloseExpired() {
  const expired = await ReporterVerification.findExpired();
  let closed = 0;

  for (const v of expired) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // false => reporter responded in the meantime; leave everything alone
      const won = await ReporterVerification.autoClose(v.VERIFICATION_ID, conn);
      if (won) {
        await conn.query(
          `UPDATE ISSUE
              SET STATUS = 'Closed', CLOSURE_TYPE = 'Auto Closed', CLOSED_AT = NOW()
            WHERE ISSUE_ID = ? AND STATUS = 'Resolved'`,
          [v.ISSUE_ID]
        );
        closed++;
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      console.error(`[cron] Auto-close failed for verification ${v.VERIFICATION_ID}:`, err.message);
    } finally {
      conn.release();
    }
  }

  console.log(`[cron] Auto-closed ${closed} ticket(s)`);
  return closed;
}

async function runDailyJob() {
  console.log(`[cron] Daily job started at ${new Date().toISOString()}`);
  try {
    for (const day of REMINDER_DAYS) await sendReminders(day);
    await autoCloseExpired();
  } catch (err) {
    // Never let a cron error crash the server
    console.error('[cron] Daily job failed:', err);
  }
}

function startAutoCloseJob() {
  // Every day at 00:05 Sri Lanka time
  cron.schedule('5 0 * * *', runDailyJob, { timezone: 'Asia/Colombo' });
  console.log('[cron] autoCloseTickets scheduled (daily 00:05 Asia/Colombo)');
}

module.exports = { startAutoCloseJob, runDailyJob, sendReminders, autoCloseExpired };