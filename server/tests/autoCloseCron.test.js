const test = require('node:test');
const assert = require('node:assert');
const { SUPPORTED_REMINDER_DAYS } = require('../cron/autoCloseTickets');
const ReporterVerification = require('../models/ReporterVerification');

test('Cron Configuration - Supported Reminder Days', () => {
  assert.deepStrictEqual(SUPPORTED_REMINDER_DAYS, [7, 13]);
  assert.strictEqual(ReporterVerification.DEFAULT_DEADLINE_DAYS, 14);
});

test('ReporterVerification - Atomic confirmation and auto-close race conditions', async () => {
  // Mock DB connection where affectedRows = 0 (simulates another process already settled it)
  const mockConn = {
    query: async (sql, params) => {
      // Simulate race condition: row was already updated from Pending
      return [{ affectedRows: 0 }];
    },
  };

  const wonConfirm = await ReporterVerification.confirm(10, 'All good', mockConn);
  assert.strictEqual(wonConfirm, false);

  const wonAutoClose = await ReporterVerification.autoClose(10, mockConn);
  assert.strictEqual(wonAutoClose, false);

  const wonDispute = await ReporterVerification.dispute(10, { remarks: 'Not fixed' }, mockConn);
  assert.strictEqual(wonDispute, false);
});

test('ReporterVerification - Successful atomic transition', async () => {
  const mockConn = {
    query: async (sql, params) => {
      // Simulate successfully finding and locking the Pending row
      return [{ affectedRows: 1 }];
    },
  };

  const wonConfirm = await ReporterVerification.confirm(10, 'All good', mockConn);
  assert.strictEqual(wonConfirm, true);

  const wonAutoClose = await ReporterVerification.autoClose(10, mockConn);
  assert.strictEqual(wonAutoClose, true);
});

test('ReporterVerification - Query generation for 7 and 13 day reminders', async () => {
  let executedSql = '';
  let executedParams = [];

  const mockConn = {
    query: async (sql, params) => {
      executedSql = sql;
      executedParams = params;
      return [
        [
          {
            VERIFICATION_ID: 1,
            ISSUE_ID: 101,
            REPORTER_ID: 5,
            DEADLINE_AT: new Date(),
            ISSUE_TITLE: 'Fallen Tree',
            WARD_NAME: 'Ward 1',
            REPORTER_NAME: 'Nimal',
            REPORTER_EMAIL: 'nimal@test.lk',
          },
        ],
      ];
    },
  };

  const due7 = await ReporterVerification.findDueForReminder(7, mockConn);
  assert.strictEqual(due7.length, 1);
  assert.ok(executedSql.includes('REMINDER_7D_SENT = 0'));
  assert.strictEqual(executedParams[0], 7);

  const due13 = await ReporterVerification.findDueForReminder(13, mockConn);
  assert.strictEqual(due13.length, 1);
  assert.ok(executedSql.includes('REMINDER_13D_SENT = 0'));
  assert.strictEqual(executedParams[0], 13);

  // Unsupported day should throw immediately
  await assert.rejects(
    async () => {
      await ReporterVerification.findDueForReminder(5, mockConn);
    },
    { message: /Unsupported reminder day: 5/ }
  );
});
