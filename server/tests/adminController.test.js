const test = require('node:test');
const assert = require('node:assert');
const db = require('../config/db');
const adminController = require('../controllers/adminController');

test('adminController.getAdminStats calculates KPIs correctly', async () => {
  const origQuery = db.query;

  // Mock responses for queries in order:
  // 1. ISSUE stats
  // 2. CITIZEN stats
  // 3. OFFICER stats
  // 4. ANNOUNCEMENT stats
  let callCount = 0;
  db.query = async (sql) => {
    callCount++;
    if (sql.includes('FROM ISSUE')) {
      return [[{
        total_issues: 10,
        open_issues: 4,
        in_progress_issues: 2,
        resolved_issues: 3,
        closed_issues: 1,
        disputed_issues: 0,
        emergency_issues: 2,
        avg_resolution_hours: 48.5,
      }]];
    }
    if (sql.includes('FROM CITIZEN')) {
      return [[{ total_citizens: 50, active_citizens: 48 }]];
    }
    if (sql.includes('FROM OFFICER')) {
      return [[{ total_officers: 6, active_officers: 6, field_officers: 4, supervisors: 1, admins: 1 }]];
    }
    if (sql.includes('FROM ANNOUNCEMENT')) {
      return [[{ total_announcements: 5, active_announcements: 4, pinned_announcements: 2 }]];
    }
    return [[]];
  };

  const req = {};
  let jsonResult = null;
  const res = {
    json: (data) => {
      jsonResult = data;
      return res;
    },
  };

  await adminController.getAdminStats(req, res, (err) => {
    if (err) throw err;
  });

  assert.ok(jsonResult.success);
  assert.strictEqual(jsonResult.data.issues.total, 10);
  assert.strictEqual(jsonResult.data.issues.resolution_rate, 40); // (3 resolved + 1 closed) / 10 = 40%
  assert.strictEqual(jsonResult.data.issues.avg_resolution_hours, 48.5);
  assert.strictEqual(jsonResult.data.citizens.total, 50);
  assert.strictEqual(jsonResult.data.officers.total, 6);
  assert.strictEqual(jsonResult.data.announcements.total, 5);

  db.query = origQuery;
});

test('adminController.getIssueAnalytics groups by category, status, and ward', async () => {
  const origQuery = db.query;

  db.query = async (sql) => {
    if (sql.includes('GROUP BY i.CATEGORY')) {
      return [[
        { CATEGORY: 'Road Hazard', count: 10, resolved_count: 5, open_count: 2, emergency_count: 1 },
        { CATEGORY: 'Water Drainage', count: 6, resolved_count: 3, open_count: 2, emergency_count: 2 },
        { CATEGORY: 'Waste Management', count: 4, resolved_count: 2, open_count: 1, emergency_count: 0 },
      ]];
    }
    if (sql.includes('GROUP BY i.STATUS')) {
      return [[
        { STATUS: 'Resolved', count: 7 },
        { STATUS: 'Open', count: 5 },
        { STATUS: 'In Progress', count: 5 },
        { STATUS: 'Closed', count: 3 },
      ]];
    }
    if (sql.includes('GROUP BY w.WARD_ID')) {
      return [[
        { WARD_ID: 1, WARD_NAME: 'Ward A', COUNCIL_NAME: 'Council X', total_issues: 12, open_issues: 3, resolved_issues: 7, emergency_issues: 2, avg_resolution_hours: 20.5 },
        { WARD_ID: 2, WARD_NAME: 'Ward B', COUNCIL_NAME: 'Council X', total_issues: 8, open_issues: 2, resolved_issues: 3, emergency_issues: 1, avg_resolution_hours: 28.0 },
      ]];
    }
    if (sql.includes('GROUP BY DATE(i.CREATED_AT)')) {
      return [[
        { date: '2026-11-01', created_count: 5, resolved_count: 2 },
        { date: '2026-11-02', created_count: 4, resolved_count: 3 },
      ]];
    }
    if (sql.includes('FROM REPORT_VERIFICATION')) {
      return [[{ total_verifications: 10, confirmed: 7, disputed: 1, auto_closed: 2, pending: 0 }]];
    }
    if (sql.includes('AVG(CASE WHEN i.RESOLVED_AT')) {
      return [[{
        total: 20,
        open: 5,
        in_progress: 5,
        resolved: 7,
        closed: 3,
        disputed: 0,
        emergency_count: 3,
        avg_resolution_hours: 24.0,
      }]];
    }
    return [[]];
  };

  const req = { query: { period: '30d' } };
  let jsonResult = null;
  const res = {
    json: (data) => {
      jsonResult = data;
      return res;
    },
  };

  await adminController.getIssueAnalytics(req, res, (err) => {
    if (err) throw err;
  });

  assert.ok(jsonResult.success);
  assert.strictEqual(jsonResult.data.summary.total, 20);
  assert.strictEqual(jsonResult.data.byCategory.length, 3);
  assert.strictEqual(jsonResult.data.byCategory[0].category, 'Road Hazard');
  assert.strictEqual(jsonResult.data.byCategory[0].percentage, 50); // 10/20 = 50%
  assert.strictEqual(jsonResult.data.byWard.length, 2);
  assert.strictEqual(jsonResult.data.timeline.length, 2);
  assert.strictEqual(jsonResult.data.verification.confirm_rate, 70);

  db.query = origQuery;
});

test('adminController.exportAnalytics exports RFC 4180 compliant CSV', async () => {
  const origQuery = db.query;

  db.query = async (sql) => {
    if (sql.includes('FROM ISSUE i')) {
      return [[
        {
          ISSUE_ID: 101,
          TITLE: 'Pothole on Main St, near "Clock Tower"',
          CATEGORY: 'Road Hazard',
          STATUS: 'Resolved',
          IS_EMERGENCY: 1,
          PRIORITY_SCORE: 85,
          WARD_NAME: 'Central Ward',
          COUNCIL_NAME: 'Metro Council',
          REPORTER_NAME: 'Kasun Perera',
          REPORTER_EMAIL: 'kasun@test.com',
          ASSIGNED_OFFICER: 'Officer Silva',
          CLOSURE_TYPE: 'Reporter Confirmed',
          CREATED_AT: new Date('2026-11-01T10:00:00Z'),
          RESOLVED_AT: new Date('2026-11-02T14:00:00Z'),
          CLOSED_AT: new Date('2026-11-03T09:00:00Z'),
          RESOLUTION_HOURS: 28,
        },
      ]];
    }
    return [[]];
  };

  const req = { query: { type: 'issues', format: 'csv' } };
  const headers = {};
  let sentData = '';
  const res = {
    setHeader: (name, val) => {
      headers[name] = val;
      return res;
    },
    send: (body) => {
      sentData = body;
      return res;
    },
  };

  await adminController.exportAnalytics(req, res, (err) => {
    if (err) throw err;
  });

  assert.strictEqual(headers['Content-Type'], 'text/csv; charset=utf-8');
  assert.ok(headers['Content-Disposition'].includes('urban_eye_issues_export_'));
  assert.ok(sentData.includes('Issue ID'));
  assert.ok(sentData.includes('Pothole on Main St, near ""Clock Tower""')); // Escaped quotes
  assert.ok(sentData.includes('Kasun Perera'));

  db.query = origQuery;
});
