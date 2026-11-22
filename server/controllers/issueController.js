const Issue = require('../models/Issue');
const { uploadImage } = require('../services/storageService');
const { findSimilar } = require('../utils/similarity');
const { notifyStatusChange } = require('../services/notificationService');
const AuditService = require('../services/auditService');
const { AppError } = require('../middleware/errorMiddleware');

const CATEGORIES = ['Road Hazard', 'Water Drainage', 'Waste Management', 'Street Lighting', 'Other'];
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed', 'Disputed'];
const DUPLICATE_WINDOW_DAYS = 30;
const DUPLICATE_THRESHOLD = 0.5;

// One place to change when Peiris's auth middleware is merged (check which field his token uses)
const currentCitizenId = (req) => req.user.citizen_id ?? req.user.id ?? req.user.userId;

// Strict positive integer ("12abc" is rejected)
function parseId(value, label) {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1) throw new AppError(`Invalid ${label}`, 400);
  return Number(value);
}

exports.createIssue = async (req, res) => {
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const { category } = body;
  const wardId = Number.parseInt(body.ward_id, 10);
  const isEmergency = ['1', 'true'].includes(String(body.is_emergency));

  const errors = [];
  if (title.length < 5 || title.length > 150) errors.push('Title must be 5 to 150 characters');
  if (description.length < 20 || description.length > 2000) errors.push('Description must be 20 to 2000 characters');
  if (!CATEGORIES.includes(category)) errors.push('Invalid category');
  if (!Number.isInteger(wardId) || wardId < 1) errors.push('A valid ward is required');
  if (errors.length) throw new AppError(errors.join('. '), 400);

  let beforePhoto;
  if (req.file) {
    beforePhoto = await uploadImage(req.file);
  } else if (process.env.NODE_ENV !== 'production' && /^https?:\/\/\S+$/.test(body.before_photo || '')) {
    beforePhoto = body.before_photo; // dev only, remove before deployment
  } else {
    throw new AppError('A photo is required', 400);
  }

  const citizenId = currentCitizenId(req);
  let issueId;
  try {
    issueId = await Issue.create({
      citizen_id: citizenId,
      ward_id: wardId,
      title,
      description,
      category,
      before_photo: beforePhoto,
      is_emergency: isEmergency,
    });

    // Record audit trail entry for issue creation
    await AuditService.logIssueCreated({
      issueId,
      citizenId,
      title,
      category,
      wardId,
      isEmergency,
      req,
    });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') throw new AppError('Ward or citizen does not exist', 400);
    throw err;
  }

  res.status(201).json({ success: true, data: await Issue.findById(issueId) });
};

function parseFilters(req) {
  const { category, status, search, sort } = req.query;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  return {
    category: CATEGORIES.includes(category) ? category : undefined,
    status: STATUSES.includes(status) ? status : undefined,
    search: search ? String(search).trim().slice(0, 100) : undefined,
    sort, page, limit,
  };
}

async function sendList(res, filters) {
  const [rows, total] = await Promise.all([Issue.findAll(filters), Issue.countAll(filters)]);
  res.json({
    success: true,
    data: rows,
    pagination: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) },
  });
}

exports.listIssues = async (req, res) => {
  const ward_id = Number.parseInt(req.query.ward_id, 10) || undefined;
  await sendList(res, { ...parseFilters(req), ward_id });
};

exports.issuesByWard = async (req, res) => {
  const ward_id = parseId(req.params.wardId, 'ward');
  await sendList(res, { ...parseFilters(req), ward_id });
};

exports.myReports = async (req, res) => {
  await sendList(res, { ...parseFilters(req), citizen_id: currentCitizenId(req) });
};

exports.getIssue = async (req, res) => {
  const issue = await Issue.findById(parseId(req.params.id, 'issue id'));
  if (!issue) throw new AppError('Issue not found', 404);
  res.json({ success: true, data: issue });
};

// Card 7: warns the citizen about similar reports before they submit
exports.checkDuplicates = async (req, res) => {
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const { category } = body;
  const wardId = Number.parseInt(body.ward_id, 10);

  if (!title || !CATEGORIES.includes(category) || !Number.isInteger(wardId) || wardId < 1) {
    throw new AppError('Title, category and ward are required', 400);
  }

  const candidates = await Issue.findPotentialDuplicates({
    ward_id: wardId,
    category,
    days: DUPLICATE_WINDOW_DAYS,
  });
  const matches = findSimilar({ title, description }, candidates, { threshold: DUPLICATE_THRESHOLD, max: 3 });
  res.json({ success: true, data: matches });
};

// Card 8: move an Open or Disputed issue to In Progress.
// Resolved / Closed are NOT settable here: they go through the proof-of-work flow.
exports.updateStatus = async (req, res) => {
  const id = parseId(req.params.id, 'issue id');
  const body = req.body || {};
  if (body.status !== 'In Progress') throw new AppError('Status can only be set to "In Progress" here', 400);

  const issue = await Issue.findById(id);
  if (!issue) throw new AppError('Issue not found', 404);
  if (!['Open', 'Disputed'].includes(issue.STATUS)) {
    throw new AppError(`Only Open or Disputed issues can be moved to In Progress (this one is ${issue.STATUS})`, 409);
  }

  const updateFields = { status: 'In Progress' };
  if (issue.STATUS === 'Disputed') {
    updateFields.resolved_at = null;
    updateFields.closure_type = null;
  }

  await Issue.update(id, updateFields);

  const noteText = body.notes
    ? String(body.notes).slice(0, 500)
    : issue.STATUS === 'Disputed'
    ? 'Issue reopened for rework following citizen dispute'
    : undefined;

  // Record in audit log
  await AuditService.logStatusChange({
    issueId: id,
    oldStatus: issue.STATUS,
    newStatus: 'In Progress',
    user: req.user,
    req,
    note: noteText,
  });

  // fire and forget: an email problem must never fail the request
  notifyStatusChange(id, issue.STATUS, 'In Progress', {
    note: noteText,
  });

  res.json({ success: true, data: await Issue.findById(id) });
};

// Bulk move Open or Disputed issues to In Progress
// PATCH /api/issues/bulk-status
// Resolved / Closed are NOT settable in bulk: resolution requires individual photographic proof.
exports.bulkUpdateStatus = async (req, res) => {
  const body = req.body || {};
  const { issue_ids, status, notes } = body;

  if (!Array.isArray(issue_ids) || issue_ids.length === 0) {
    throw new AppError('issue_ids must be a non-empty array of issue IDs', 400);
  }

  if (status === 'Resolved' || status === 'Closed') {
    throw new AppError('Bulk status cannot be set to Resolved or Closed. Resolution requires individual photographic proof upload.', 400);
  }

  if (status !== 'In Progress') {
    throw new AppError('Bulk status can only be set to "In Progress"', 400);
  }

  // Validate IDs are positive integers
  const cleanIds = [];
  for (const rawId of issue_ids) {
    const num = Number(rawId);
    if (Number.isInteger(num) && num > 0) {
      cleanIds.push(num);
    }
  }

  if (cleanIds.length === 0) {
    throw new AppError('No valid issue IDs provided', 400);
  }

  const userWardId = req.user?.ward_id;
  const isFieldOfficer = req.user?.role === 'field_officer' || req.user?.role === 'officer';

  const updatedIds = [];
  const skippedIds = [];

  for (const id of cleanIds) {
    try {
      const issue = await Issue.findById(id);
      if (!issue) {
        skippedIds.push({ id, reason: 'Issue not found' });
        continue;
      }

      // Check ward scoping if caller is ward-bound officer
      if (isFieldOfficer && userWardId && Number(issue.WARD_ID) !== Number(userWardId)) {
        skippedIds.push({ id, reason: 'Issue does not belong to your assigned ward' });
        continue;
      }

      // Allowed transitions: Open or Disputed -> In Progress
      if (!['Open', 'Disputed'].includes(issue.STATUS)) {
        skippedIds.push({ id, reason: `Status is ${issue.STATUS}; only Open or Disputed can be moved to In Progress` });
        continue;
      }

      const updateFields = { status: 'In Progress' };
      if (issue.STATUS === 'Disputed') {
        updateFields.resolved_at = null;
        updateFields.closure_type = null;
      }

      await Issue.update(id, updateFields);

      const noteText = notes
        ? String(notes).slice(0, 500)
        : issue.STATUS === 'Disputed'
        ? 'Issue reopened for rework following citizen dispute'
        : 'Bulk transitioned to In Progress by officer';

      await AuditService.logStatusChange({
        issueId: id,
        oldStatus: issue.STATUS,
        newStatus: 'In Progress',
        user: req.user,
        req,
        note: noteText,
      }).catch(() => {});

      notifyStatusChange(id, issue.STATUS, 'In Progress', {
        note: noteText,
      });

      updatedIds.push(id);
    } catch (err) {
      skippedIds.push({ id, reason: err.message });
    }
  }

  res.json({
    success: true,
    message: `Successfully moved ${updatedIds.length} issue(s) to In Progress`,
    updated_count: updatedIds.length,
    updated_ids: updatedIds,
    skipped_count: skippedIds.length,
    skipped: skippedIds,
  });
};
