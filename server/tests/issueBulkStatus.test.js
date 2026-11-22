const test = require('node:test');
const assert = require('node:assert');
const Issue = require('../models/Issue');
const issueController = require('../controllers/issueController');

test('issueController.bulkUpdateStatus rejects invalid inputs or non-In-Progress transitions', async () => {
  // Test 1: Empty or non-array issue_ids
  let errorCaught = null;
  try {
    await issueController.bulkUpdateStatus({ body: { issue_ids: [], status: 'In Progress' } }, {});
  } catch (err) {
    errorCaught = err;
  }
  assert.strictEqual(errorCaught?.statusCode, 400);

  // Test 2: Attempting bulk resolution (must be blocked; requires proof)
  errorCaught = null;
  try {
    await issueController.bulkUpdateStatus({ body: { issue_ids: [1, 2], status: 'Resolved' } }, {});
  } catch (err) {
    errorCaught = err;
  }
  assert.strictEqual(errorCaught?.statusCode, 400);
  assert.match(errorCaught?.message, /Bulk status cannot be set to Resolved/);
});

test('issueController.bulkUpdateStatus successfully transitions eligible issues', async () => {
  const origFindById = Issue.findById;
  const origUpdate = Issue.update;

  const mockDb = {
    1: { ISSUE_ID: 1, STATUS: 'Open', WARD_ID: 4, TITLE: 'Pothole' },
    2: { ISSUE_ID: 2, STATUS: 'Disputed', WARD_ID: 4, TITLE: 'Drainage blockage' },
    3: { ISSUE_ID: 3, STATUS: 'Closed', WARD_ID: 4, TITLE: 'Old issue' },
  };

  const updatedRecords = [];

  Issue.findById = async (id) => mockDb[id] || null;
  Issue.update = async (id, fields) => {
    updatedRecords.push({ id, fields });
    return 1;
  };

  const req = {
    body: {
      issue_ids: [1, 2, 3],
      status: 'In Progress',
      notes: 'Dispatched maintenance unit',
    },
    user: { id: 10, role: 'field_officer', ward_id: 4 },
  };

  let responseData = null;
  const res = {
    json: (data) => {
      responseData = data;
      return res;
    },
  };

  try {
    await issueController.bulkUpdateStatus(req, res);

    assert.strictEqual(responseData?.success, true);
    assert.strictEqual(responseData?.updated_count, 2);
    assert.deepStrictEqual(responseData?.updated_ids, [1, 2]);
    assert.strictEqual(responseData?.skipped_count, 1);

    // Verify Disputed issue cleared resolved_at
    const disputedUpdate = updatedRecords.find((r) => r.id === 2);
    assert.strictEqual(disputedUpdate?.fields.status, 'In Progress');
    assert.strictEqual(disputedUpdate?.fields.resolved_at, null);
  } finally {
    Issue.findById = origFindById;
    Issue.update = origUpdate;
  }
});
