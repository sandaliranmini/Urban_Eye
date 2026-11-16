const test = require('node:test');
const assert = require('node:assert');
const Announcement = require('../models/Announcement');
const announcementController = require('../controllers/announcementController');
const AuditService = require('../services/auditService');

test('announcementController.listAnnouncements returns paginated list', async () => {
  const origFindAll = Announcement.findAll;
  Announcement.findAll = async () => ({
    announcements: [
      { ANNOUNCEMENT_ID: 1, TITLE: 'Water Outage Notice', CATEGORY: 'Utility', IS_PINNED: 1 },
      { ANNOUNCEMENT_ID: 2, TITLE: 'Road Resurfacing', CATEGORY: 'Maintenance', IS_PINNED: 0 },
    ],
    pagination: { total: 2, page: 1, limit: 20, totalPages: 1 },
  });

  const req = { query: { page: '1', limit: '20' } };
  let jsonResult = null;
  const res = {
    json: (data) => {
      jsonResult = data;
      return res;
    },
  };

  await announcementController.listAnnouncements(req, res, (err) => {
    if (err) throw err;
  });

  assert.ok(jsonResult.success);
  assert.strictEqual(jsonResult.data.length, 2);
  assert.strictEqual(jsonResult.data[0].TITLE, 'Water Outage Notice');
  assert.strictEqual(jsonResult.pagination.total, 2);

  Announcement.findAll = origFindAll;
});

test('announcementController.getAnnouncementsByWard returns ward-specific announcements', async () => {
  const origFindByWard = Announcement.findByWard;
  Announcement.findByWard = async (wardId) => [
    { ANNOUNCEMENT_ID: 5, WARD_ID: wardId, TITLE: 'Waste Collection Schedule', CATEGORY: 'Maintenance' },
  ];

  const req = { params: { wardId: '3' }, query: {}, user: { council_id: 1 } };
  let jsonResult = null;
  const res = {
    json: (data) => {
      jsonResult = data;
      return res;
    },
  };

  await announcementController.getAnnouncementsByWard(req, res, (err) => {
    if (err) throw err;
  });

  assert.ok(jsonResult.success);
  assert.strictEqual(jsonResult.data.length, 1);
  assert.strictEqual(jsonResult.data[0].WARD_ID, 3);

  // Invalid ward ID rejects with 400
  const reqInvalid = { params: { wardId: 'abc' }, query: {} };
  await assert.rejects(
    async () => {
      await announcementController.getAnnouncementsByWard(reqInvalid, res, (err) => {
        if (err) throw err;
      });
    },
    { message: /Valid ward ID/ }
  );

  Announcement.findByWard = origFindByWard;
});

test('announcementController.createAnnouncement validates inputs and creates row', async () => {
  const origCreate = Announcement.create;
  const origFindById = Announcement.findById;
  const origLog = AuditService.logAnnouncementCreated;

  let logged = false;
  AuditService.logAnnouncementCreated = async () => {
    logged = true;
  };

  Announcement.create = async () => 10;
  Announcement.findById = async (id) => ({
    ANNOUNCEMENT_ID: id,
    TITLE: 'Power Interruption Warning',
    BODY: 'Emergency power cutoff planned for maintenance on transformers.',
    CATEGORY: 'Utility',
    WARD_ID: 1,
    IS_PINNED: 1,
  });

  const reqValid = {
    body: {
      title: 'Power Interruption Warning',
      body: 'Emergency power cutoff planned for maintenance on transformers.',
      category: 'Utility',
      ward_id: 1,
      is_pinned: true,
    },
    user: { id: 2, officer_id: 2, role: 'field_officer', kind: 'officer', council_id: 1 },
  };

  let jsonResult = null;
  let statusCode = 200;
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      jsonResult = data;
      return res;
    },
  };

  await announcementController.createAnnouncement(reqValid, res, (err) => {
    if (err) throw err;
  });

  assert.strictEqual(statusCode, 201);
  assert.ok(jsonResult.success);
  assert.strictEqual(jsonResult.data.ANNOUNCEMENT_ID, 10);
  assert.strictEqual(logged, true);

  // Invalid category validation
  const reqInvalidCat = {
    body: {
      title: 'Valid Title',
      body: 'Valid long body content here',
      category: 'NonExistentCategory',
    },
    user: { id: 2, officer_id: 2, role: 'admin' },
  };

  await assert.rejects(
    async () => {
      await announcementController.createAnnouncement(reqInvalidCat, res, (err) => {
        if (err) throw err;
      });
    },
    { message: /Category must be one of/ }
  );

  Announcement.create = origCreate;
  Announcement.findById = origFindById;
  AuditService.logAnnouncementCreated = origLog;
});

test('announcementController.updateAnnouncement enforces permissions and updates', async () => {
  const origFindById = Announcement.findById;
  const origUpdate = Announcement.update;
  const origLog = AuditService.logAnnouncementUpdated;

  AuditService.logAnnouncementUpdated = async () => {};

  Announcement.findById = async () => ({
    ANNOUNCEMENT_ID: 20,
    OFFICER_ID: 5,
    TITLE: 'Old Title',
    BODY: 'Old description body',
    CATEGORY: 'Safety',
  });

  let updateCalled = false;
  Announcement.update = async () => {
    updateCalled = true;
    return true;
  };

  // Unauthorized officer (not author and not admin)
  const reqForbidden = {
    params: { id: '20' },
    body: { title: 'Updated Title' },
    user: { id: 99, officer_id: 99, role: 'field_officer' },
  };
  const res = { json: () => {} };

  await assert.rejects(
    async () => {
      await announcementController.updateAnnouncement(reqForbidden, res, (err) => {
        if (err) throw err;
      });
    },
    { message: /Forbidden/ }
  );

  // Authorized Admin
  const reqAdmin = {
    params: { id: '20' },
    body: { title: 'Updated Title by Admin' },
    user: { id: 1, officer_id: 1, role: 'admin' },
  };

  let jsonResult = null;
  const resAdmin = {
    json: (data) => {
      jsonResult = data;
      return resAdmin;
    },
  };

  await announcementController.updateAnnouncement(reqAdmin, resAdmin, (err) => {
    if (err) throw err;
  });

  assert.ok(jsonResult.success);
  assert.strictEqual(updateCalled, true);

  Announcement.findById = origFindById;
  Announcement.update = origUpdate;
  AuditService.logAnnouncementUpdated = origLog;
});

test('announcementController.deleteAnnouncement removes record with audit log', async () => {
  const origFindById = Announcement.findById;
  const origDelete = Announcement.delete;
  const origLog = AuditService.logAnnouncementDeleted;

  let logged = false;
  AuditService.logAnnouncementDeleted = async () => {
    logged = true;
  };

  Announcement.findById = async () => ({
    ANNOUNCEMENT_ID: 30,
    OFFICER_ID: 2,
    TITLE: 'Announcement To Delete',
  });

  let deleteCalled = false;
  Announcement.delete = async () => {
    deleteCalled = true;
    return true;
  };

  const req = {
    params: { id: '30' },
    user: { id: 1, officer_id: 1, role: 'admin' },
  };

  let jsonResult = null;
  const res = {
    json: (data) => {
      jsonResult = data;
      return res;
    },
  };

  await announcementController.deleteAnnouncement(req, res, (err) => {
    if (err) throw err;
  });

  assert.ok(jsonResult.success);
  assert.strictEqual(deleteCalled, true);
  assert.strictEqual(logged, true);

  Announcement.findById = origFindById;
  Announcement.delete = origDelete;
  AuditService.logAnnouncementDeleted = origLog;
});
