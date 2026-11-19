const test = require('node:test');
const assert = require('node:assert');
const ReporterVerification = require('../models/ReporterVerification');
const AuditService = require('../services/auditService');
const notificationService = require('../services/notificationService');
const db = require('../config/db');
const { sendReminders, autoCloseExpired, runDailyJob } = require('../cron/autoCloseTickets');

test('Cron Execution - sendReminders sends notification and marks flag', async () => {
  const origFindDue = ReporterVerification.findDueForReminder;
  const origMarkSent = ReporterVerification.markReminderSent;
  const origLogReminder = AuditService.logReminderSent;
  const origNotifyReminder = notificationService.notifyVerificationReminder;

  let reminderNotified = false;
  let markedVerificationId = null;
  let auditLogged = false;

  ReporterVerification.findDueForReminder = async (day) => [
    {
      VERIFICATION_ID: 88,
      ISSUE_ID: 108,
      REPORTER_ID: 7,
      DEADLINE_AT: new Date(),
      ISSUE_TITLE: 'Leaking pipe',
      WARD_NAME: 'Ward 5',
      REPORTER_NAME: 'Anura',
      REPORTER_EMAIL: 'anura@example.com',
    },
  ];

  notificationService.notifyVerificationReminder = async (params) => {
    reminderNotified = true;
    assert.strictEqual(params.verificationId, 88);
    assert.strictEqual(params.day, 7);
  };

  ReporterVerification.markReminderSent = async (id, day) => {
    markedVerificationId = id;
    assert.strictEqual(day, 7);
  };

  AuditService.logReminderSent = async (params) => {
    auditLogged = true;
    assert.strictEqual(params.verificationId, 88);
  };

  const count = await sendReminders(7);
  assert.strictEqual(count, 1);
  assert.ok(reminderNotified);
  assert.strictEqual(markedVerificationId, 88);
  assert.ok(auditLogged);

  // Restore
  ReporterVerification.findDueForReminder = origFindDue;
  ReporterVerification.markReminderSent = origMarkSent;
  AuditService.logReminderSent = origLogReminder;
  notificationService.notifyVerificationReminder = origNotifyReminder;
});

test('Cron Execution - autoCloseExpired handles atomic transaction and notifications', async () => {
  const origFindExpired = ReporterVerification.findExpired;
  const origAutoClose = ReporterVerification.autoClose;
  const origGetConnection = db.getConnection;
  const origLogAutoClose = AuditService.logAutoClose;
  const origNotifyAutoClose = notificationService.notifyAutoClose;

  ReporterVerification.findExpired = async () => [
    {
      VERIFICATION_ID: 55,
      ISSUE_ID: 205,
      REPORTER_ID: 9,
      DEADLINE_AT: new Date(),
      ISSUE_TITLE: 'Broken Bench in Park',
      WARD_NAME: 'Ward 3',
      REPORTER_NAME: 'Sunil',
      REPORTER_EMAIL: 'sunil@example.com',
    },
  ];

  let txCommitted = false;
  let updateIssueExecuted = false;
  let autoClosedLogged = false;
  let autoCloseNotified = false;

  const mockConn = {
    beginTransaction: async () => {},
    commit: async () => {
      txCommitted = true;
    },
    rollback: async () => {},
    release: () => {},
    query: async (sql, params) => {
      if (sql.includes('UPDATE ISSUE')) {
        updateIssueExecuted = true;
        assert.ok(sql.includes("STATUS = 'Closed'"));
        assert.ok(sql.includes("CLOSURE_TYPE = 'Auto Closed'"));
        assert.strictEqual(params[0], 205);
      }
      return [{ affectedRows: 1 }];
    },
  };

  db.getConnection = async () => mockConn;
  ReporterVerification.autoClose = async (id, conn) => true;

  AuditService.logAutoClose = async (params) => {
    autoClosedLogged = true;
    assert.strictEqual(params.issueId, 205);
    assert.strictEqual(params.verificationId, 55);
  };

  notificationService.notifyAutoClose = async (params) => {
    autoCloseNotified = true;
    assert.strictEqual(params.issueId, 205);
  };

  const closed = await autoCloseExpired();
  assert.strictEqual(closed, 1);
  assert.ok(txCommitted);
  assert.ok(updateIssueExecuted);
  assert.ok(autoClosedLogged);
  assert.ok(autoCloseNotified);

  // Restore
  ReporterVerification.findExpired = origFindExpired;
  ReporterVerification.autoClose = origAutoClose;
  db.getConnection = origGetConnection;
  AuditService.logAutoClose = origLogAutoClose;
  notificationService.notifyAutoClose = origNotifyAutoClose;
});

test('Cron Execution - runDailyJob returns summary', async () => {
  const origFindDue = ReporterVerification.findDueForReminder;
  const origFindExpired = ReporterVerification.findExpired;

  ReporterVerification.findDueForReminder = async () => [];
  ReporterVerification.findExpired = async () => [];

  const summary = await runDailyJob();
  assert.ok(summary);
  assert.strictEqual(summary.autoClosed, 0);
  assert.deepStrictEqual(summary.reminders, { 7: 0, 13: 0 });

  ReporterVerification.findDueForReminder = origFindDue;
  ReporterVerification.findExpired = origFindExpired;
});
