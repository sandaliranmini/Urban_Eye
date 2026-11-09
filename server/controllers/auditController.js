const AuditLog = require('../models/AuditLog');
const Issue = require('../models/Issue');
const { AppError } = require('../middleware/errorMiddleware');

function parseId(value, label) {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1) {
    throw new AppError(`Invalid ${label}`, 400);
  }
  return Number(value);
}

/**
 * GET /api/audit-logs
 * Admin/Supervisor view of system-wide audit logs.
 */
exports.getAuditLogs = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const {
    entityType,
    entityId,
    action,
    performedByType,
    performedById,
    startDate,
    endDate,
    sort,
  } = req.query;

  const filters = {
    entityType: entityType ? String(entityType).trim().toUpperCase() : undefined,
    entityId: entityId ? parseId(entityId, 'entityId') : undefined,
    action: action ? String(action).trim().toUpperCase() : undefined,
    performedByType: performedByType ? String(performedByType).trim().toUpperCase() : undefined,
    performedById: performedById ? parseId(performedById, 'performedById') : undefined,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    page,
    limit,
    sort: sort === 'asc' ? 'asc' : 'desc',
  };

  const [logs, total] = await Promise.all([
    AuditLog.findAll(filters),
    AuditLog.countAll(filters),
  ]);

  res.json({
    success: true,
    data: logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
};

/**
 * GET /api/audit-logs/issue/:id
 * Full chronological history of an issue (including status updates, proof uploads,
 * verification responses, reminders, and auto-closures).
 */
exports.getIssueAuditLogs = async (req, res) => {
  const issueId = parseId(req.params.id, 'issue id');
  const issue = await Issue.findById(issueId);
  if (!issue) throw new AppError('Issue not found', 404);

  // Authorization check: Citizen can only see their own issue's history
  const isStaff = ['officer', 'field_officer', 'supervisor', 'admin'].includes(req.user?.role) ||
                  req.user?.kind === 'officer';
  const isReporter = (req.user?.citizen_id ?? req.user?.id) === issue.CITIZEN_ID;

  if (!isStaff && !isReporter) {
    throw new AppError('You do not have permission to view the audit history of this report', 403);
  }

  const logs = await AuditLog.findByIssue(issueId);

  res.json({
    success: true,
    data: {
      issueId,
      issueTitle: issue.TITLE,
      currentStatus: issue.STATUS,
      timeline: logs,
    },
  });
};

/**
 * GET /api/audit-logs/stats
 * Aggregated statistics on system actions (e.g. auto-closures, reminders, disputes).
 */
exports.getAuditStats = async (req, res) => {
  const { startDate, endDate } = req.query;
  const stats = await AuditLog.getStats({
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  });

  res.json({
    success: true,
    data: stats,
  });
};
