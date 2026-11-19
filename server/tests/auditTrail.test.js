const test = require('node:test');
const assert = require('node:assert');
const AuditLog = require('../models/AuditLog');
const AuditService = require('../services/auditService');

test('AuditLog Model Constants', () => {
  assert.strictEqual(AuditLog.ENTITY_TYPE.ISSUE, 'ISSUE');
  assert.strictEqual(AuditLog.ENTITY_TYPE.REPORT_VERIFICATION, 'REPORT_VERIFICATION');
  assert.strictEqual(AuditLog.ENTITY_TYPE.RESOLUTION_PROOF, 'RESOLUTION_PROOF');

  assert.strictEqual(AuditLog.ACTION.ISSUE_CREATED, 'ISSUE_CREATED');
  assert.strictEqual(AuditLog.ACTION.ISSUE_AUTO_CLOSED, 'ISSUE_AUTO_CLOSED');
  assert.strictEqual(AuditLog.ACTION.REMINDER_7D_SENT, 'REMINDER_7D_SENT');
  assert.strictEqual(AuditLog.ACTION.REMINDER_13D_SENT, 'REMINDER_13D_SENT');
  assert.strictEqual(AuditLog.ACTION.VERIFICATION_CONFIRMED, 'VERIFICATION_CONFIRMED');
  assert.strictEqual(AuditLog.ACTION.VERIFICATION_DISPUTED, 'VERIFICATION_DISPUTED');

  assert.strictEqual(AuditLog.PERFORMED_BY_TYPE.CITIZEN, 'CITIZEN');
  assert.strictEqual(AuditLog.PERFORMED_BY_TYPE.OFFICER, 'OFFICER');
  assert.strictEqual(AuditLog.PERFORMED_BY_TYPE.ADMIN, 'ADMIN');
  assert.strictEqual(AuditLog.PERFORMED_BY_TYPE.SYSTEM, 'SYSTEM');
});

test('AuditService - Performer determination and client info', async () => {
  // Mock mock-query connection
  const mockQueries = [];
  const mockConn = {
    query: async (sql, params) => {
      mockQueries.push({ sql, params });
      return [{ insertId: 999 }];
    },
  };

  const req = {
    headers: {
      'x-forwarded-for': '203.115.1.5',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },
    user: {
      id: 42,
      role: 'admin',
      officer_id: 42,
    },
  };

  // 1. Log an action as admin
  const logId = await AuditService.logAction({
    entityType: AuditLog.ENTITY_TYPE.ISSUE,
    entityId: 10,
    action: AuditLog.ACTION.STATUS_CHANGED,
    req,
    oldState: { status: 'Open' },
    newState: { status: 'In Progress' },
    details: { note: 'Team dispatched' },
    conn: mockConn,
  });

  assert.strictEqual(logId, 999);
  assert.strictEqual(mockQueries.length, 1);
  const [params] = mockQueries.map((q) => q.params);
  assert.strictEqual(params[0], 'ISSUE'); // ENTITY_TYPE
  assert.strictEqual(params[1], 10); // ENTITY_ID
  assert.strictEqual(params[2], 'STATUS_CHANGED'); // ACTION
  assert.strictEqual(params[3], 'ADMIN'); // PERFORMED_BY_TYPE
  assert.strictEqual(params[4], 42); // PERFORMED_BY_ID
  assert.strictEqual(params[5], JSON.stringify({ status: 'Open' })); // OLD_STATE
  assert.strictEqual(params[6], JSON.stringify({ status: 'In Progress' })); // NEW_STATE
  assert.strictEqual(params[7], JSON.stringify({ note: 'Team dispatched' })); // DETAILS
  assert.strictEqual(params[8], '203.115.1.5'); // IP_ADDRESS
  assert.strictEqual(params[9], 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'); // USER_AGENT
});

test('AuditService - System Performer for Auto-Close and Reminders', async () => {
  const mockQueries = [];
  const mockConn = {
    query: async (sql, params) => {
      mockQueries.push({ sql, params });
      return [{ insertId: 1001 }];
    },
  };

  await AuditService.logAutoClose({
    issueId: 77,
    verificationId: 12,
    conn: mockConn,
  });

  // Should log two records: one for ISSUE and one for REPORT_VERIFICATION
  assert.strictEqual(mockQueries.length, 2);

  const issueLog = mockQueries[0].params;
  assert.strictEqual(issueLog[0], 'ISSUE');
  assert.strictEqual(issueLog[1], 77);
  assert.strictEqual(issueLog[2], 'ISSUE_AUTO_CLOSED');
  assert.strictEqual(issueLog[3], 'SYSTEM');
  assert.strictEqual(issueLog[4], null);

  const verLog = mockQueries[1].params;
  assert.strictEqual(verLog[0], 'REPORT_VERIFICATION');
  assert.strictEqual(verLog[1], 12);
  assert.strictEqual(verLog[2], 'VERIFICATION_AUTO_CLOSED');
  assert.strictEqual(verLog[3], 'SYSTEM');
});

test('AuditService - Reminder logging (7d & 13d)', async () => {
  const mockQueries = [];
  const mockConn = {
    query: async (sql, params) => {
      mockQueries.push({ sql, params });
      return [{ insertId: 2001 }];
    },
  };

  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await AuditService.logReminderSent({
    day: 7,
    verificationId: 5,
    issueId: 10,
    reporterId: 3,
    deadlineAt: deadline,
    conn: mockConn,
  });

  assert.strictEqual(mockQueries.length, 1);
  const params = mockQueries[0].params;
  assert.strictEqual(params[0], 'REPORT_VERIFICATION');
  assert.strictEqual(params[1], 5);
  assert.strictEqual(params[2], 'REMINDER_7D_SENT');
  assert.strictEqual(params[3], 'SYSTEM');
});
