const test = require('node:test');
const assert = require('node:assert');
const AuditLog = require('../models/AuditLog');
const auditController = require('../controllers/auditController');
const resolutionController = require('../controllers/resolutionController');

test('auditController.getAuditLogs returns paginated data', async () => {
  // Mock AuditLog.findAll and countAll
  const origFindAll = AuditLog.findAll;
  const origCountAll = AuditLog.countAll;

  AuditLog.findAll = async () => [
    { LOG_ID: 1, ACTION: 'ISSUE_AUTO_CLOSED', PERFORMED_BY_TYPE: 'SYSTEM' },
    { LOG_ID: 2, ACTION: 'REMINDER_7D_SENT', PERFORMED_BY_TYPE: 'SYSTEM' },
  ];
  AuditLog.countAll = async () => 2;

  const req = { query: { page: '1', limit: '10' } };
  let jsonResult = null;
  const res = {
    json: (data) => {
      jsonResult = data;
      return res;
    },
  };

  await auditController.getAuditLogs(req, res);

  assert.ok(jsonResult.success);
  assert.strictEqual(jsonResult.data.length, 2);
  assert.strictEqual(jsonResult.pagination.total, 2);
  assert.strictEqual(jsonResult.pagination.totalPages, 1);

  // Restore
  AuditLog.findAll = origFindAll;
  AuditLog.countAll = origCountAll;
});

test('auditController.getAuditStats returns aggregated actions', async () => {
  const origGetStats = AuditLog.getStats;
  AuditLog.getStats = async () => [
    { ACTION: 'ISSUE_AUTO_CLOSED', count: 5 },
    { ACTION: 'REMINDER_7D_SENT', count: 12 },
    { ACTION: 'REMINDER_13D_SENT', count: 8 },
  ];

  const req = { query: {} };
  let jsonResult = null;
  const res = {
    json: (data) => {
      jsonResult = data;
      return res;
    },
  };

  await auditController.getAuditStats(req, res);

  assert.ok(jsonResult.success);
  assert.strictEqual(jsonResult.data.length, 3);
  assert.strictEqual(jsonResult.data[0].ACTION, 'ISSUE_AUTO_CLOSED');
  assert.strictEqual(jsonResult.data[0].count, 5);

  AuditLog.getStats = origGetStats;
});

test('auditController.getIssueAuditLogs checks authorization', async () => {
  const Issue = require('../models/Issue');
  const origFindById = Issue.findById;

  Issue.findById = async () => ({
    ISSUE_ID: 15,
    CITIZEN_ID: 99,
    TITLE: 'Water Leak',
    STATUS: 'Resolved',
  });

  // Unauthorized user (different citizen)
  const reqUnauthorized = {
    params: { id: '15' },
    user: { id: 10, citizen_id: 10, role: 'citizen', kind: 'citizen' },
  };
  const res = { json: () => {} };

  await assert.rejects(
    async () => {
      await auditController.getIssueAuditLogs(reqUnauthorized, res);
    },
    { message: /You do not have permission/ }
  );

  // Authorized user (the reporter himself)
  const reqReporter = {
    params: { id: '15' },
    user: { id: 99, citizen_id: 99, role: 'citizen', kind: 'citizen' },
  };
  const origFindByIssue = AuditLog.findByIssue;
  AuditLog.findByIssue = async () => [
    { LOG_ID: 1, ACTION: 'ISSUE_CREATED' },
    { LOG_ID: 2, ACTION: 'REMINDER_7D_SENT' },
  ];

  let jsonResult = null;
  const resSuccess = {
    json: (data) => {
      jsonResult = data;
      return resSuccess;
    },
  };

  await auditController.getIssueAuditLogs(reqReporter, resSuccess);
  assert.ok(jsonResult.success);
  assert.strictEqual(jsonResult.data.timeline.length, 2);

  Issue.findById = origFindById;
  AuditLog.findByIssue = origFindByIssue;
});
