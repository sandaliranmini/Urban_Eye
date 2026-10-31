const Issue = require('../models/Issue');
const { uploadImage } = require('../services/storageService');
const { findSimilar } = require('../utils/similarity');
const { notifyStatusChange } = require('../services/notificationService');

const CATEGORIES = ['Road Hazard', 'Water Drainage', 'Waste Management', 'Street Lighting', 'Other'];
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed', 'Disputed'];
const DUPLICATE_WINDOW_DAYS = 30;

const fail = (res, code, message) => res.status(code).json({ success: false, message });

// One place to change when Peiris's auth middleware is merged (check which field his token uses)
const currentCitizenId = (req) => req.user.citizen_id ?? req.user.id ?? req.user.userId;

exports.createIssue = async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const { category } = req.body;
    const wardId = Number.parseInt(req.body.ward_id, 10);
    const isEmergency = ['1', 'true'].includes(String(req.body.is_emergency));

    const errors = [];
    if (title.length < 5 || title.length > 150) errors.push('Title must be 5 to 150 characters');
    if (description.length < 20 || description.length > 2000) errors.push('Description must be 20 to 2000 characters');
    if (!CATEGORIES.includes(category)) errors.push('Invalid category');
    if (!Number.isInteger(wardId) || wardId < 1) errors.push('A valid ward is required');
    if (errors.length) return fail(res, 400, errors.join('. '));

    let beforePhoto;
    if (req.file) {
      beforePhoto = await uploadImage(req.file);
    } else if (process.env.NODE_ENV !== 'production' && /^https?:\/\/\S+$/.test(req.body.before_photo || '')) {
      beforePhoto = req.body.before_photo; // dev only, remove before deployment
    } else {
      return fail(res, 400, 'A photo is required');
    }

    const issueId = await Issue.create({
      citizen_id: currentCitizenId(req),
      ward_id: wardId,
      title,
      description,
      category,
      before_photo: beforePhoto,
      is_emergency: isEmergency,
    });
    const issue = await Issue.findById(issueId);
    res.status(201).json({ success: true, data: issue });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') return fail(res, 400, 'Ward or citizen does not exist');
    console.error('createIssue error:', err);
    fail(res, 500, 'Could not create the issue');
  }
};

function parseFilters(req) {
  const { category, status, search, sort } = req.query;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
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
  try {
    const ward_id = Number.parseInt(req.query.ward_id, 10) || undefined;
    await sendList(res, { ...parseFilters(req), ward_id });
  } catch (err) { console.error(err); fail(res, 500, 'Could not load issues'); }
};

exports.issuesByWard = async (req, res) => {
  try {
    const ward_id = Number.parseInt(req.params.wardId, 10);
    if (!Number.isInteger(ward_id)) return fail(res, 400, 'Invalid ward');
    await sendList(res, { ...parseFilters(req), ward_id });
  } catch (err) { console.error(err); fail(res, 500, 'Could not load issues'); }
};

exports.myReports = async (req, res) => {
  try {
    await sendList(res, { ...parseFilters(req), citizen_id: currentCitizenId(req) });
  } catch (err) { console.error(err); fail(res, 500, 'Could not load your reports'); }
};

exports.getIssue = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return fail(res, 400, 'Invalid issue id');
    const issue = await Issue.findById(id);
    if (!issue) return fail(res, 404, 'Issue not found');
    res.json({ success: true, data: issue });
  } catch (err) { console.error(err); fail(res, 500, 'Could not load the issue'); }
};

exports.checkDuplicates = async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const { category } = req.body;
    const wardId = Number.parseInt(req.body.ward_id, 10);

    if (!title || !CATEGORIES.includes(category) || !Number.isInteger(wardId) || wardId < 1) {
      return fail(res, 400, 'Title, category and ward are required');
    }

    const candidates = await Issue.findPotentialDuplicates({
      ward_id: wardId,
      category,
      days: DUPLICATE_WINDOW_DAYS,
    });
    const matches = findSimilar({ title, description }, candidates, { threshold: 0.35, max: 3 });
    res.json({ success: true, data: matches });
  } catch (err) {
    console.error('checkDuplicates error:', err);
    fail(res, 500, 'Could not check for similar reports');
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return fail(res, 400, 'Invalid issue id');
    if (req.body.status !== 'In Progress') {
      return fail(res, 400, 'Status can only be set to "In Progress" here');
    }

    const issue = await Issue.findById(id);
    if (!issue) return fail(res, 404, 'Issue not found');
    if (issue.STATUS !== 'Open') {
      return fail(res, 409, `Only Open issues can be moved to In Progress (this one is ${issue.STATUS})`);
    }

    await Issue.update(id, { status: 'In Progress' });
    // fire and forget: an email problem must never fail the request
    notifyStatusChange(id, issue.STATUS, 'In Progress', { note: req.body.notes });

    res.json({ success: true, data: await Issue.findById(id) });
  } catch (err) {
    console.error('updateStatus error:', err);
    fail(res, 500, 'Could not update the issue status');
  }
};