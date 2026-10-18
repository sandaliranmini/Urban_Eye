const cron = require('node-cron');
const db = require('../config/db');

const AUTO_CLOSE_DAYS = parseInt(process.env.AUTO_CLOSE_DAYS, 10) || 14;
const REMINDER_DAY_1 = parseInt(process.env.REMINDER_DAY_1, 10) || 7;
const REMINDER_DAY_2 = parseInt(process.env.REMINDER_DAY_2, 10) || 13;

// NOTE: table/column/status names below are ASSUMPTIONS because
// database/schema.sql is empty. Adjust them to match your real schema.
const TABLE = 'issues';
const WAITING_STATUS = 'pending_confirmation'; // officer uploaded proof, reporter hasn't responded
const CLOSED_STATUS = 'auto_closed';

async function autoCloseStaleTickets() {
  const [result] = await db.query(
    `UPDATE ${TABLE}
        SET status = ?, closed_at = NOW()
      WHERE status = ?
        AND resolved_at <= NOW() - INTERVAL ? DAY`,
    [CLOSED_STATUS, WAITING_STATUS, AUTO_CLOSE_DAYS]
  );
  console.log(`[cron] Auto-closed ${result.affectedRows} ticket(s)`);
}

async function sendReminders(day) {
  // Tickets that hit exactly `day` days of waiting today
  const [rows] = await db.query(
    `SELECT id, reporter_id
       FROM ${TABLE}
      WHERE status = ?
        AND DATEDIFF(NOW(), resolved_at) = ?`,
    [WAITING_STATUS, day]
  );
  for (const issue of rows) {
    // TODO: replace with your real notification (Socket.IO / email / DB notification row)
    console.log(`[cron] Reminder (day ${day}) -> reporter ${issue.reporter_id}, issue ${issue.id}`);
  }
}

async function runDailyJob() {
  console.log(`[cron] Daily job started at ${new Date().toISOString()}`);
  try {
    await sendReminders(REMINDER_DAY_1);
    await sendReminders(REMINDER_DAY_2);
    await autoCloseStaleTickets();
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

module.exports = { startAutoCloseJob, runDailyJob };