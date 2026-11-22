const test = require('node:test');
const assert = require('node:assert');
const db = require('../config/db');
const adminController = require('../controllers/adminController');

test('adminController.patchOfficerStatus toggles active state', async () => {
  const origQuery = db.query;

  let updateQueryExecuted = false;
  db.query = async (sql, params) => {
    if (sql.includes('UPDATE OFFICER SET IS_ACTIVE')) {
      updateQueryExecuted = true;
      assert.strictEqual(params[0], 0);
      assert.strictEqual(params[1], 5);
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('SELECT o.OFFICER_ID')) {
      return [[{
        OFFICER_ID: 5,
        EMPLOYEE_ID: 'EMP-005',
        FULL_NAME: 'Kasun Perera',
        IS_ACTIVE: 0,
        FORCE_CHANGE_PASSWORD: 0,
      }]];
    }
    return [[]];
  };

  const req = {
    params: { id: '5' },
    body: { is_active: false },
    user: { id: 1, role: 'admin' },
  };

  let jsonResult = null;
  const res = {
    json: (d) => {
      jsonResult = d;
      return res;
    },
  };

  try {
    await adminController.patchOfficerStatus(req, res, () => {});
    assert.strictEqual(updateQueryExecuted, true);
    assert.strictEqual(jsonResult?.success, true);
    assert.strictEqual(jsonResult?.data?.IS_ACTIVE, 0);
  } finally {
    db.query = origQuery;
  }
});

test('adminController.resetOfficerPassword generates temp password and flags force change', async () => {
  const origQuery = db.query;

  let resetExecuted = false;
  db.query = async (sql, params) => {
    if (sql.startsWith('SELECT OFFICER_ID')) {
      return [[{
        OFFICER_ID: 7,
        EMPLOYEE_ID: 'EMP-007',
        FULL_NAME: 'Nimal Silva',
        EMAIL: 'nimal@example.com',
        ROLE: 'Field Officer',
        IS_ACTIVE: 1,
      }]];
    }
    if (sql.includes('UPDATE OFFICER SET PASSWORD_HASH')) {
      resetExecuted = true;
      // SQL should update PASSWORD_HASH and set FORCE_CHANGE_PASSWORD = 1
      assert.strictEqual(params[1], 7);
      return [{ affectedRows: 1 }];
    }
    return [[]];
  };

  const req = {
    params: { id: '7' },
    user: { id: 1, role: 'admin' },
  };

  let jsonResult = null;
  const res = {
    json: (d) => {
      jsonResult = d;
      return res;
    },
  };

  try {
    await adminController.resetOfficerPassword(req, res, () => {});
    assert.strictEqual(resetExecuted, true);
    assert.strictEqual(jsonResult?.success, true);
    assert.strictEqual(jsonResult?.data?.force_change_password, true);
    assert.strictEqual(typeof jsonResult?.data?.temporary_password, 'string');
    assert.match(jsonResult?.data?.temporary_password, /^Urban#\d{4}!$/);
  } finally {
    db.query = origQuery;
  }
});
