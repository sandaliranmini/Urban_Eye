const db = require('../config/db');
const bcrypt = require('bcrypt');
const EmergencyAlert = require('../models/EmergencyAlert');
const AuditService = require('../services/auditService');
const { notifyStatusChange } = require('../services/notificationService');
const { AppError } = require('../middleware/errorMiddleware');

/**
 * Helper to escape CSV cell contents according to RFC 4180
 * Also sanitizes against CSV formula injection (=, +, -, @, tab, CR)
 */
function escapeCsvCell(value) {
  if (value === null || value === undefined) return '""';
  let str = String(value);

  // Prevent formula injection in spreadsheet software (Excel, LibreOffice)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Double up quotes and wrap in quotes
  return `"${str.replace(/"/g, '""')}"`;
}

function arrayToCsvRow(arr) {
  return arr.map(escapeCsvCell).join(',');
}

/**
 * Build dynamic WHERE clause for issues analytics
 */
function buildIssueAnalyticsWhere({ ward_id, category, status, from_date, to_date, period } = {}) {
  const where = [];
  const params = [];

  if (ward_id && ward_id !== 'all') {
    where.push('i.WARD_ID = ?');
    params.push(Number(ward_id));
  }

  if (category && category !== 'all') {
    where.push('i.CATEGORY = ?');
    params.push(category);
  }

  if (status && status !== 'all') {
    where.push('i.STATUS = ?');
    params.push(status);
  }

  if (from_date) {
    where.push('i.CREATED_AT >= ?');
    params.push(new Date(from_date));
  }

  if (to_date) {
    where.push('i.CREATED_AT <= ?');
    // Set to end of day if just a date string (YYYY-MM-DD)
    const d = new Date(to_date);
    if (String(to_date).length === 10) {
      d.setHours(23, 59, 59, 999);
    }
    params.push(d);
  }

  if (!from_date && period && period !== 'all') {
    let days = 30;
    if (period === '7d') days = 7;
    else if (period === '30d') days = 30;
    else if (period === '90d') days = 90;
    else if (period === '1y') days = 365;
    where.push('i.CREATED_AT >= DATE_SUB(NOW(), INTERVAL ? DAY)');
    params.push(days);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return { whereSql, params };
}

/**
 * Get top-level Admin KPIs & summary stats
 * GET /api/admin/stats
 */
exports.getAdminStats = async (req, res, next) => {
  try {
    const [issueStatsRows] = await db.query(
      `SELECT
         COUNT(*) AS total_issues,
         SUM(STATUS = 'Open') AS open_issues,
         SUM(STATUS = 'In Progress') AS in_progress_issues,
         SUM(STATUS = 'Resolved') AS resolved_issues,
         SUM(STATUS = 'Closed') AS closed_issues,
         SUM(STATUS = 'Disputed') AS disputed_issues,
         SUM(IS_EMERGENCY = 1) AS emergency_issues,
         AVG(CASE WHEN RESOLVED_AT IS NOT NULL THEN TIMESTAMPDIFF(HOUR, CREATED_AT, RESOLVED_AT) END) AS avg_resolution_hours
       FROM ISSUE`
    );

    const [citizenRows] = await db.query(
      `SELECT
         COUNT(*) AS total_citizens,
         SUM(IS_ACTIVE = 1) AS active_citizens
       FROM CITIZEN`
    );

    const [officerRows] = await db.query(
      `SELECT
         COUNT(*) AS total_officers,
         SUM(IS_ACTIVE = 1) AS active_officers,
         SUM(ROLE = 'Field Officer') AS field_officers,
         SUM(ROLE = 'Supervisor') AS supervisors,
         SUM(ROLE = 'Admin') AS admins
       FROM OFFICER`
    );

    const [announcementRows] = await db.query(
      `SELECT
         COUNT(*) AS total_announcements,
         SUM(EXPIRES_AT IS NULL OR EXPIRES_AT > NOW()) AS active_announcements,
         SUM(IS_PINNED = 1) AS pinned_announcements
       FROM ANNOUNCEMENT`
    );

    let emergencyStats = [];
    try {
      emergencyStats = await EmergencyAlert.getResponseStats();
    } catch {
      emergencyStats = [];
    }

    const issues = issueStatsRows[0] || {};
    const citizens = citizenRows[0] || {};
    const officers = officerRows[0] || {};
    const announcements = announcementRows[0] || {};

    const totalIssues = Number(issues.total_issues) || 0;
    const resolvedCount = (Number(issues.resolved_issues) || 0) + (Number(issues.closed_issues) || 0);
    const resolutionRate = totalIssues > 0 ? Number(((resolvedCount / totalIssues) * 100).toFixed(1)) : 0;
    const avgHours = issues.avg_resolution_hours !== null ? Number(Number(issues.avg_resolution_hours).toFixed(1)) : null;

    res.json({
      success: true,
      data: {
        issues: {
          total: totalIssues,
          open: Number(issues.open_issues) || 0,
          in_progress: Number(issues.in_progress_issues) || 0,
          resolved: Number(issues.resolved_issues) || 0,
          closed: Number(issues.closed_issues) || 0,
          disputed: Number(issues.disputed_issues) || 0,
          emergency: Number(issues.emergency_issues) || 0,
          resolution_rate: resolutionRate,
          avg_resolution_hours: avgHours,
          avg_resolution_days: avgHours !== null ? Number((avgHours / 24).toFixed(1)) : null,
        },
        citizens: {
          total: Number(citizens.total_citizens) || 0,
          active: Number(citizens.active_citizens) || 0,
        },
        officers: {
          total: Number(officers.total_officers) || 0,
          active: Number(officers.active_officers) || 0,
          field_officers: Number(officers.field_officers) || 0,
          supervisors: Number(officers.supervisors) || 0,
          admins: Number(officers.admins) || 0,
        },
        announcements: {
          total: Number(announcements.total_announcements) || 0,
          active: Number(announcements.active_announcements) || 0,
          pinned: Number(announcements.pinned_announcements) || 0,
        },
        emergencyAlerts: emergencyStats,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Detailed filtered analytics on issues, categories, wards, and SLA metrics
 * GET /api/admin/analytics/issues
 */
exports.getIssueAnalytics = async (req, res, next) => {
  try {
    const filters = req.query || {};
    const { whereSql, params } = buildIssueAnalyticsWhere(filters);

    // 1. Overall Summary
    const [summaryRows] = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(i.STATUS = 'Open') AS open,
         SUM(i.STATUS = 'In Progress') AS in_progress,
         SUM(i.STATUS = 'Resolved') AS resolved,
         SUM(i.STATUS = 'Closed') AS closed,
         SUM(i.STATUS = 'Disputed') AS disputed,
         SUM(i.IS_EMERGENCY = 1) AS emergency_count,
         AVG(CASE WHEN i.RESOLVED_AT IS NOT NULL THEN TIMESTAMPDIFF(HOUR, i.CREATED_AT, i.RESOLVED_AT) END) AS avg_resolution_hours
       FROM ISSUE i
       ${whereSql}`,
      params
    );

    const summaryData = summaryRows[0] || {};
    const total = Number(summaryData.total) || 0;
    const resolvedTotal = (Number(summaryData.resolved) || 0) + (Number(summaryData.closed) || 0);
    const resolutionRate = total > 0 ? Number(((resolvedTotal / total) * 100).toFixed(1)) : 0;
    const avgResHours = summaryData.avg_resolution_hours !== null ? Number(Number(summaryData.avg_resolution_hours).toFixed(1)) : null;

    // 2. Breakdown by Category
    const [categoryRows] = await db.query(
      `SELECT
         i.CATEGORY,
         COUNT(*) AS count,
         SUM(i.STATUS IN ('Resolved', 'Closed')) AS resolved_count,
         SUM(i.STATUS = 'Open') AS open_count,
         SUM(i.IS_EMERGENCY = 1) AS emergency_count
       FROM ISSUE i
       ${whereSql}
       GROUP BY i.CATEGORY
       ORDER BY count DESC`,
      params
    );

    const byCategory = categoryRows.map((c) => {
      const count = Number(c.count) || 0;
      return {
        category: c.CATEGORY,
        count,
        percentage: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
        resolved_count: Number(c.resolved_count) || 0,
        open_count: Number(c.open_count) || 0,
        emergency_count: Number(c.emergency_count) || 0,
      };
    });

    // 3. Breakdown by Status
    const [statusRows] = await db.query(
      `SELECT
         i.STATUS,
         COUNT(*) AS count
       FROM ISSUE i
       ${whereSql}
       GROUP BY i.STATUS
       ORDER BY count DESC`,
      params
    );

    const byStatus = statusRows.map((s) => {
      const count = Number(s.count) || 0;
      return {
        status: s.STATUS,
        count,
        percentage: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
      };
    });

    // 4. Breakdown by Ward
    const [wardRows] = await db.query(
      `SELECT
         w.WARD_ID,
         w.WARD_NAME,
         c.COUNCIL_NAME,
         COUNT(i.ISSUE_ID) AS total_issues,
         SUM(i.STATUS = 'Open') AS open_issues,
         SUM(i.STATUS IN ('Resolved', 'Closed')) AS resolved_issues,
         SUM(i.IS_EMERGENCY = 1) AS emergency_issues,
         AVG(CASE WHEN i.RESOLVED_AT IS NOT NULL THEN TIMESTAMPDIFF(HOUR, i.CREATED_AT, i.RESOLVED_AT) END) AS avg_resolution_hours
       FROM WARD w
       JOIN COUNCIL c ON c.COUNCIL_ID = w.COUNCIL_ID
       LEFT JOIN ISSUE i ON i.WARD_ID = w.WARD_ID ${whereSql ? `AND ${whereSql.replace(/^WHERE\s+/i, '')}` : ''}
       GROUP BY w.WARD_ID, w.WARD_NAME, c.COUNCIL_NAME
       ORDER BY total_issues DESC`,
      params
    );

    const byWard = wardRows.map((w) => {
      const totalIssues = Number(w.total_issues) || 0;
      const resCount = Number(w.resolved_issues) || 0;
      return {
        ward_id: w.WARD_ID,
        ward_name: w.WARD_NAME,
        council_name: w.COUNCIL_NAME,
        total: totalIssues,
        open: Number(w.open_issues) || 0,
        resolved: resCount,
        resolution_rate: totalIssues > 0 ? Number(((resCount / totalIssues) * 100).toFixed(1)) : 0,
        emergency_count: Number(w.emergency_issues) || 0,
        avg_resolution_hours: w.avg_resolution_hours !== null ? Number(Number(w.avg_resolution_hours).toFixed(1)) : null,
      };
    });

    // 5. Timeline trends (Daily creation & resolution over matching period)
    const [timelineRows] = await db.query(
      `SELECT
         DATE(i.CREATED_AT) AS date,
         COUNT(*) AS created_count,
         SUM(i.RESOLVED_AT IS NOT NULL AND DATE(i.RESOLVED_AT) = DATE(i.CREATED_AT)) AS resolved_count
       FROM ISSUE i
       ${whereSql}
       GROUP BY DATE(i.CREATED_AT)
       ORDER BY date ASC
       LIMIT 60`,
      params
    );

    // 6. Verification and Resolution Flow stats
    const [verificationRows] = await db.query(
      `SELECT
         COUNT(*) AS total_verifications,
         SUM(RESPONSE = 'Confirmed') AS confirmed,
         SUM(RESPONSE = 'Disputed') AS disputed,
         SUM(RESPONSE = 'auto_closed') AS auto_closed,
         SUM(RESPONSE = 'Pending') AS pending
       FROM REPORT_VERIFICATION`
    );

    const ver = verificationRows[0] || {};
    const totalVer = Number(ver.total_verifications) || 0;
    const confirmedCount = Number(ver.confirmed) || 0;
    const disputedCount = Number(ver.disputed) || 0;
    const autoClosedCount = Number(ver.auto_closed) || 0;
    const pendingCount = Number(ver.pending) || 0;

    // 7. Emergency Alert Performance
    let emergencyStats = [];
    try {
      emergencyStats = await EmergencyAlert.getResponseStats();
    } catch {
      emergencyStats = [];
    }

    res.json({
      success: true,
      data: {
        summary: {
          total,
          open: Number(summaryData.open) || 0,
          in_progress: Number(summaryData.in_progress) || 0,
          resolved: Number(summaryData.resolved) || 0,
          closed: Number(summaryData.closed) || 0,
          disputed: Number(summaryData.disputed) || 0,
          emergency_count: Number(summaryData.emergency_count) || 0,
          resolution_rate: resolutionRate,
          avg_resolution_hours: avgResHours,
          avg_resolution_days: avgResHours !== null ? Number((avgResHours / 24).toFixed(1)) : null,
        },
        byCategory,
        byStatus,
        byWard,
        timeline: timelineRows.map((t) => ({
          date: t.date,
          created_count: Number(t.created_count) || 0,
          resolved_count: Number(t.resolved_count) || 0,
        })),
        verification: {
          total: totalVer,
          confirmed: confirmedCount,
          disputed: disputedCount,
          auto_closed: autoClosedCount,
          pending: pendingCount,
          dispute_rate: totalVer > 0 ? Number(((disputedCount / totalVer) * 100).toFixed(1)) : 0,
          auto_close_rate: totalVer > 0 ? Number(((autoClosedCount / totalVer) * 100).toFixed(1)) : 0,
          confirm_rate: totalVer > 0 ? Number(((confirmedCount / totalVer) * 100).toFixed(1)) : 0,
        },
        emergencyAlerts: emergencyStats,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Export analytics data as downloadable CSV or JSON
 * GET /api/admin/analytics/export
 */
exports.exportAnalytics = async (req, res, next) => {
  try {
    const format = String(req.query.format || 'csv').toLowerCase();
    const type = String(req.query.type || 'issues').toLowerCase(); // 'issues' or 'summary'
    const filters = req.query || {};

    if (format === 'json') {
      if (type === 'summary') {
        return exports.getIssueAnalytics(req, res, next);
      }
      // Export issues list as JSON
      const { whereSql, params } = buildIssueAnalyticsWhere(filters);
      const [issues] = await db.query(
        `SELECT
           i.ISSUE_ID,
           i.TITLE,
           i.DESCRIPTION,
           i.CATEGORY,
           i.STATUS,
           i.IS_EMERGENCY,
           i.PRIORITY_SCORE,
           w.WARD_NAME,
           c.COUNCIL_NAME,
           cit.FULL_NAME AS REPORTER_NAME,
           cit.EMAIL AS REPORTER_EMAIL,
           off.FULL_NAME AS ASSIGNED_OFFICER,
           i.CLOSURE_TYPE,
           i.CREATED_AT,
           i.RESOLVED_AT,
           i.CLOSED_AT,
           TIMESTAMPDIFF(HOUR, i.CREATED_AT, i.RESOLVED_AT) AS RESOLUTION_HOURS
         FROM ISSUE i
         JOIN WARD w ON w.WARD_ID = i.WARD_ID
         JOIN COUNCIL c ON c.COUNCIL_ID = w.COUNCIL_ID
         LEFT JOIN CITIZEN cit ON cit.CITIZEN_ID = i.CITIZEN_ID
         LEFT JOIN OFFICER off ON off.OFFICER_ID = i.OFFICER_ID
         ${whereSql}
         ORDER BY i.CREATED_AT DESC`,
        params
      );

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="urban_eye_issues_${Date.now()}.json"`);
      return res.send(JSON.stringify(issues, null, 2));
    }

    // CSV EXPORT
    if (type === 'summary') {
      // Multi-section summary CSV
      const { whereSql, params } = buildIssueAnalyticsWhere(filters);

      const [summaryRows] = await db.query(
        `SELECT
           COUNT(*) AS total,
           SUM(i.STATUS = 'Open') AS open,
           SUM(i.STATUS = 'In Progress') AS in_progress,
           SUM(i.STATUS = 'Resolved') AS resolved,
           SUM(i.STATUS = 'Closed') AS closed,
           SUM(i.STATUS = 'Disputed') AS disputed,
           SUM(i.IS_EMERGENCY = 1) AS emergency_count,
           AVG(CASE WHEN i.RESOLVED_AT IS NOT NULL THEN TIMESTAMPDIFF(HOUR, i.CREATED_AT, i.RESOLVED_AT) END) AS avg_resolution_hours
         FROM ISSUE i
         ${whereSql}`,
        params
      );

      const [categoryRows] = await db.query(
        `SELECT
           i.CATEGORY,
           COUNT(*) AS count,
           SUM(i.STATUS IN ('Resolved', 'Closed')) AS resolved_count,
           SUM(i.STATUS = 'Open') AS open_count,
           SUM(i.IS_EMERGENCY = 1) AS emergency_count
         FROM ISSUE i
         ${whereSql}
         GROUP BY i.CATEGORY
         ORDER BY count DESC`,
        params
      );

      const [wardRows] = await db.query(
        `SELECT
           w.WARD_NAME,
           c.COUNCIL_NAME,
           COUNT(i.ISSUE_ID) AS total_issues,
           SUM(i.STATUS = 'Open') AS open_issues,
           SUM(i.STATUS IN ('Resolved', 'Closed')) AS resolved_issues,
           SUM(i.IS_EMERGENCY = 1) AS emergency_issues,
           AVG(CASE WHEN i.RESOLVED_AT IS NOT NULL THEN TIMESTAMPDIFF(HOUR, i.CREATED_AT, i.RESOLVED_AT) END) AS avg_resolution_hours
         FROM WARD w
         JOIN COUNCIL c ON c.COUNCIL_ID = w.COUNCIL_ID
         LEFT JOIN ISSUE i ON i.WARD_ID = w.WARD_ID ${whereSql ? `AND ${whereSql.replace(/^WHERE\s+/i, '')}` : ''}
         GROUP BY w.WARD_ID, w.WARD_NAME, c.COUNCIL_NAME
         ORDER BY total_issues DESC`,
        params
      );

      const sum = summaryRows[0] || {};
      const totalIssues = Number(sum.total) || 0;
      const resolvedCount = (Number(sum.resolved) || 0) + (Number(sum.closed) || 0);
      const resRate = totalIssues > 0 ? ((resolvedCount / totalIssues) * 100).toFixed(1) : '0.0';
      const avgHours = sum.avg_resolution_hours !== null ? Number(sum.avg_resolution_hours).toFixed(1) : 'N/A';

      const csvLines = [
        '--- URBAN EYE ANALYTICS SUMMARY REPORT ---',
        `Generated At: ${new Date().toISOString()}`,
        '',
        '--- OVERVIEW KPIS ---',
        arrayToCsvRow(['Metric', 'Value']),
        arrayToCsvRow(['Total Issues', totalIssues]),
        arrayToCsvRow(['Open Issues', Number(sum.open) || 0]),
        arrayToCsvRow(['In Progress Issues', Number(sum.in_progress) || 0]),
        arrayToCsvRow(['Resolved Issues', Number(sum.resolved) || 0]),
        arrayToCsvRow(['Closed Issues', Number(sum.closed) || 0]),
        arrayToCsvRow(['Disputed Issues', Number(sum.disputed) || 0]),
        arrayToCsvRow(['Emergency Issues', Number(sum.emergency_count) || 0]),
        arrayToCsvRow(['Resolution Rate (%)', `${resRate}%`]),
        arrayToCsvRow(['Avg Resolution Time (Hours)', avgHours]),
        '',
        '--- CATEGORY BREAKDOWN ---',
        arrayToCsvRow(['Category', 'Total Issues', 'Open', 'Resolved/Closed', 'Emergency Count', 'Share (%)']),
        ...categoryRows.map((cat) => {
          const cCount = Number(cat.count) || 0;
          const share = totalIssues > 0 ? ((cCount / totalIssues) * 100).toFixed(1) : '0.0';
          return arrayToCsvRow([
            cat.CATEGORY,
            cCount,
            Number(cat.open_count) || 0,
            Number(cat.resolved_count) || 0,
            Number(cat.emergency_count) || 0,
            `${share}%`,
          ]);
        }),
        '',
        '--- WARD PERFORMANCE BREAKDOWN ---',
        arrayToCsvRow(['Ward Name', 'Council', 'Total Issues', 'Open', 'Resolved', 'Emergency Count', 'Avg Resolution (Hours)']),
        ...wardRows.map((w) =>
          arrayToCsvRow([
            w.WARD_NAME,
            w.COUNCIL_NAME,
            Number(w.total_issues) || 0,
            Number(w.open_issues) || 0,
            Number(w.resolved_issues) || 0,
            Number(w.emergency_issues) || 0,
            w.avg_resolution_hours !== null ? Number(w.avg_resolution_hours).toFixed(1) : 'N/A',
          ])
        ),
      ];

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="urban_eye_analytics_summary_${Date.now()}.csv"`);
      return res.send(csvLines.join('\r\n'));
    }

    // Default: Detailed Issues CSV Export
    const { whereSql, params } = buildIssueAnalyticsWhere(filters);
    const [rows] = await db.query(
      `SELECT
         i.ISSUE_ID,
         i.TITLE,
         i.CATEGORY,
         i.STATUS,
         i.IS_EMERGENCY,
         i.PRIORITY_SCORE,
         w.WARD_NAME,
         c.COUNCIL_NAME,
         cit.FULL_NAME AS REPORTER_NAME,
         cit.EMAIL AS REPORTER_EMAIL,
         off.FULL_NAME AS ASSIGNED_OFFICER,
         i.CLOSURE_TYPE,
         i.CREATED_AT,
         i.RESOLVED_AT,
         i.CLOSED_AT,
         TIMESTAMPDIFF(HOUR, i.CREATED_AT, i.RESOLVED_AT) AS RESOLUTION_HOURS
       FROM ISSUE i
       JOIN WARD w ON w.WARD_ID = i.WARD_ID
       JOIN COUNCIL c ON c.COUNCIL_ID = w.COUNCIL_ID
       LEFT JOIN CITIZEN cit ON cit.CITIZEN_ID = i.CITIZEN_ID
       LEFT JOIN OFFICER off ON off.OFFICER_ID = i.OFFICER_ID
       ${whereSql}
       ORDER BY i.CREATED_AT DESC`,
      params
    );

    const headers = [
      'Issue ID',
      'Title',
      'Category',
      'Status',
      'Is Emergency',
      'Priority Score',
      'Ward',
      'Council',
      'Reporter Name',
      'Reporter Email',
      'Assigned Officer',
      'Closure Type',
      'Created At',
      'Resolved At',
      'Closed At',
      'Resolution Time (Hours)',
    ];

    const lines = [arrayToCsvRow(headers)];

    for (const r of rows) {
      lines.push(
        arrayToCsvRow([
          r.ISSUE_ID,
          r.TITLE,
          r.CATEGORY,
          r.STATUS,
          r.IS_EMERGENCY ? 'Yes' : 'No',
          r.PRIORITY_SCORE,
          r.WARD_NAME,
          r.COUNCIL_NAME,
          r.REPORTER_NAME || 'Anonymous / Unlinked',
          r.REPORTER_EMAIL || '',
          r.ASSIGNED_OFFICER || 'Unassigned',
          r.CLOSURE_TYPE || 'N/A',
          r.CREATED_AT ? new Date(r.CREATED_AT).toISOString() : '',
          r.RESOLVED_AT ? new Date(r.RESOLVED_AT).toISOString() : '',
          r.CLOSED_AT ? new Date(r.CLOSED_AT).toISOString() : '',
          r.RESOLUTION_HOURS !== null ? r.RESOLUTION_HOURS : 'N/A',
        ])
      );
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="urban_eye_issues_export_${Date.now()}.csv"`);
    res.send(lines.join('\r\n'));
  } catch (err) {
    next(err);
  }
};

/**
 * Get all officers (admin management)
 * GET /api/admin/officers
 */
exports.getAllOfficers = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT
         o.OFFICER_ID,
         o.COUNCIL_ID,
         c.COUNCIL_NAME,
         o.WARD_ID,
         w.WARD_NAME,
         o.EMPLOYEE_ID,
         o.FULL_NAME,
         o.EMAIL,
         o.DEPARTMENT,
         o.ROLE,
         o.IS_ACTIVE,
         o.CREATED_AT
       FROM OFFICER o
       JOIN COUNCIL c ON c.COUNCIL_ID = o.COUNCIL_ID
       LEFT JOIN WARD w ON w.WARD_ID = o.WARD_ID
       ORDER BY o.CREATED_AT DESC`
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

/**
 * Create new officer (Admin only)
 * POST /api/admin/officers
 */
exports.createOfficer = async (req, res, next) => {
  try {
    const { employee_id, full_name, email, password, role, council_id, ward_id, department } =
      req.body || {};

    if (!employee_id || !full_name || !email || !password || !role) {
      throw new AppError('Employee ID, full name, email, password, and role are required', 400);
    }

    const validRoles = ['Field Officer', 'Supervisor', 'Admin'];
    if (!validRoles.includes(role)) {
      throw new AppError(`Role must be one of: ${validRoles.join(', ')}`, 400);
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new AppError('Invalid email address format', 400);
    }

    if (String(password).length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    // Default council if not provided: Council 1 or user's council
    const effectiveCouncilId = council_id ? Number(council_id) : req.user?.council_id || 1;
    const effectiveWardId = ward_id ? Number(ward_id) : null;

    const passwordHash = await bcrypt.hash(String(password), 10);

    const [result] = await db.query(
      `INSERT INTO OFFICER (COUNCIL_ID, WARD_ID, EMPLOYEE_ID, FULL_NAME, EMAIL, PASSWORD_HASH, DEPARTMENT, ROLE, IS_ACTIVE)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        effectiveCouncilId,
        effectiveWardId,
        String(employee_id).trim(),
        String(full_name).trim(),
        cleanEmail,
        passwordHash,
        department ? String(department).trim() : null,
        role,
      ]
    );

    const [newOfficer] = await db.query(
      `SELECT o.OFFICER_ID, o.EMPLOYEE_ID, o.FULL_NAME, o.EMAIL, o.DEPARTMENT, o.ROLE, o.IS_ACTIVE, o.WARD_ID, w.WARD_NAME, c.COUNCIL_NAME
         FROM OFFICER o
         JOIN COUNCIL c ON c.COUNCIL_ID = o.COUNCIL_ID
         LEFT JOIN WARD w ON w.WARD_ID = o.WARD_ID
        WHERE o.OFFICER_ID = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Officer created successfully',
      data: newOfficer[0],
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return next(new AppError('An officer with this employee ID or email already exists', 409));
    }
    next(err);
  }
};

/**
 * Update officer
 * PUT /api/admin/officers/:id
 */
exports.updateOfficer = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new AppError('Valid officer ID required', 400);
    }

    const { full_name, department, role, ward_id, is_active } = req.body || {};
    const sets = [];
    const params = [];

    if (full_name !== undefined) {
      sets.push('FULL_NAME = ?');
      params.push(String(full_name).trim());
    }
    if (department !== undefined) {
      sets.push('DEPARTMENT = ?');
      params.push(String(department).trim());
    }
    if (role !== undefined) {
      sets.push('ROLE = ?');
      params.push(role);
    }
    if (ward_id !== undefined) {
      sets.push('WARD_ID = ?');
      params.push(ward_id ? Number(ward_id) : null);
    }
    if (is_active !== undefined) {
      sets.push('IS_ACTIVE = ?');
      params.push(is_active ? 1 : 0);
    }

    if (!sets.length) {
      throw new AppError('No valid update fields provided', 400);
    }

    params.push(id);
    const [result] = await db.query(`UPDATE OFFICER SET ${sets.join(', ')} WHERE OFFICER_ID = ?`, params);
    if (result.affectedRows === 0) {
      throw new AppError('Officer not found', 404);
    }

    const [updated] = await db.query(
      `SELECT o.OFFICER_ID, o.EMPLOYEE_ID, o.FULL_NAME, o.EMAIL, o.DEPARTMENT, o.ROLE, o.IS_ACTIVE, o.WARD_ID, w.WARD_NAME
         FROM OFFICER o
         LEFT JOIN WARD w ON w.WARD_ID = o.WARD_ID
        WHERE o.OFFICER_ID = ?`,
      [id]
    );
    res.json({ success: true, message: 'Officer updated successfully', data: updated[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * Deactivate / delete officer
 * DELETE /api/admin/officers/:id
 */
exports.deleteOfficer = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new AppError('Valid officer ID required', 400);
    }

    const { hard } = req.query || {};

    if (hard === 'true') {
      try {
        const [delResult] = await db.query('DELETE FROM OFFICER WHERE OFFICER_ID = ?', [id]);
        if (delResult.affectedRows === 0) {
          throw new AppError('Officer not found', 404);
        }
        return res.json({ success: true, message: 'Officer record permanently deleted.' });
      } catch (delErr) {
        if (delErr.code === 'ER_ROW_IS_REFERENCED_2') {
          // Fall back to deactivation to protect referential integrity
          await db.query('UPDATE OFFICER SET IS_ACTIVE = 0 WHERE OFFICER_ID = ?', [id]);
          return res.json({
            success: true,
            message:
              'Officer has historical task assignments or audit records and was deactivated instead of permanently deleted to preserve data integrity.',
            deactivated: true,
          });
        }
        throw delErr;
      }
    }

    // Default: Soft-deactivate officer to preserve referential integrity
    const [result] = await db.query('UPDATE OFFICER SET IS_ACTIVE = 0 WHERE OFFICER_ID = ?', [id]);
    if (result.affectedRows === 0) {
      throw new AppError('Officer not found', 404);
    }

    res.json({ success: true, message: 'Officer deactivated successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all wards with council info and live counts
 * GET /api/admin/wards
 */
exports.getAllWards = async (req, res, next) => {
  try {
    const { council_id } = req.query;
    let whereSql = '';
    const params = [];

    if (council_id && council_id !== 'all') {
      whereSql = 'WHERE w.COUNCIL_ID = ?';
      params.push(Number(council_id));
    }

    const [rows] = await db.query(
      `SELECT
         w.WARD_ID,
         w.WARD_NAME,
         w.DESCRIPTION,
         w.COUNCIL_ID,
         c.COUNCIL_NAME,
         c.COUNCIL_TYPE,
         c.DISTRICT,
         c.PROVINCE,
         (SELECT COUNT(*) FROM ISSUE i WHERE i.WARD_ID = w.WARD_ID) AS issue_count,
         (SELECT COUNT(*) FROM OFFICER o WHERE o.WARD_ID = w.WARD_ID) AS officer_count,
         (SELECT COUNT(*) FROM CITIZEN ct WHERE ct.WARD_ID = w.WARD_ID) AS citizen_count
       FROM WARD w
       JOIN COUNCIL c ON c.COUNCIL_ID = w.COUNCIL_ID
       ${whereSql}
       ORDER BY w.WARD_ID ASC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new ward under a council
 * POST /api/admin/wards
 */
exports.createWard = async (req, res, next) => {
  try {
    const { council_id, ward_name, description } = req.body || {};

    if (!ward_name || !String(ward_name).trim()) {
      return res.status(400).json({ success: false, message: 'Ward name is required.' });
    }

    const councilId = Number(council_id) || 1; // Default to Dompe Pradeshiya Sabha (1)

    // Check council exists
    const [cRows] = await db.query('SELECT COUNCIL_ID, COUNCIL_NAME FROM COUNCIL WHERE COUNCIL_ID = ?', [councilId]);
    if (!cRows.length) {
      return res.status(404).json({ success: false, message: 'Selected council does not exist.' });
    }

    // Check for duplicate ward name in the same council
    const [existing] = await db.query(
      'SELECT WARD_ID FROM WARD WHERE COUNCIL_ID = ? AND LOWER(WARD_NAME) = LOWER(?)',
      [councilId, String(ward_name).trim()]
    );
    if (existing.length) {
      return res.status(409).json({
        success: false,
        message: `A ward named "${ward_name.trim()}" already exists in ${cRows[0].COUNCIL_NAME}.`,
      });
    }

    const [result] = await db.query(
      'INSERT INTO WARD (COUNCIL_ID, WARD_NAME, DESCRIPTION) VALUES (?, ?, ?)',
      [councilId, String(ward_name).trim(), description ? String(description).trim() : null]
    );

    // Audit log
    await AuditService.logAction({
      entityType: 'WARD',
      entityId: result.insertId,
      action: 'WARD_CREATED',
      user: req.user,
      req,
      newState: { council_id: councilId, ward_name: ward_name.trim(), description },
      details: { ward_name: ward_name.trim(), council_name: cRows[0].COUNCIL_NAME },
    });

    const [newWardRows] = await db.query(
      `SELECT w.*, c.COUNCIL_NAME, c.COUNCIL_TYPE, c.DISTRICT, c.PROVINCE,
              0 AS issue_count, 0 AS officer_count, 0 AS citizen_count
         FROM WARD w
         JOIN COUNCIL c ON c.COUNCIL_ID = w.COUNCIL_ID
        WHERE w.WARD_ID = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: `Ward "${ward_name.trim()}" created successfully.`,
      data: newWardRows[0],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update an existing ward
 * PUT /api/admin/wards/:id
 */
exports.updateWard = async (req, res, next) => {
  try {
    const wardId = parseInt(req.params.id, 10);
    const { council_id, ward_name, description } = req.body || {};

    const [wRows] = await db.query('SELECT * FROM WARD WHERE WARD_ID = ?', [wardId]);
    if (!wRows.length) {
      return res.status(404).json({ success: false, message: 'Ward not found.' });
    }
    const currentWard = wRows[0];

    const targetCouncilId = council_id !== undefined ? Number(council_id) : currentWard.COUNCIL_ID;
    const targetWardName = ward_name !== undefined ? String(ward_name).trim() : currentWard.WARD_NAME;
    const targetDesc = description !== undefined ? (description ? String(description).trim() : null) : currentWard.DESCRIPTION;

    if (!targetWardName) {
      return res.status(400).json({ success: false, message: 'Ward name cannot be empty.' });
    }

    // Check duplicate name in same council (excluding this ward)
    const [dup] = await db.query(
      'SELECT WARD_ID FROM WARD WHERE COUNCIL_ID = ? AND LOWER(WARD_NAME) = LOWER(?) AND WARD_ID <> ?',
      [targetCouncilId, targetWardName, wardId]
    );
    if (dup.length) {
      return res.status(409).json({
        success: false,
        message: `Another ward named "${targetWardName}" already exists in this council.`,
      });
    }

    await db.query(
      'UPDATE WARD SET COUNCIL_ID = ?, WARD_NAME = ?, DESCRIPTION = ? WHERE WARD_ID = ?',
      [targetCouncilId, targetWardName, targetDesc, wardId]
    );

    // Audit log
    await AuditService.logAction({
      entityType: 'WARD',
      entityId: wardId,
      action: 'WARD_UPDATED',
      user: req.user,
      req,
      oldState: {
        council_id: currentWard.COUNCIL_ID,
        ward_name: currentWard.WARD_NAME,
        description: currentWard.DESCRIPTION,
      },
      newState: {
        council_id: targetCouncilId,
        ward_name: targetWardName,
        description: targetDesc,
      },
      details: { ward_id: wardId, ward_name: targetWardName },
    });

    const [updatedRows] = await db.query(
      `SELECT w.*, c.COUNCIL_NAME, c.COUNCIL_TYPE, c.DISTRICT, c.PROVINCE,
              (SELECT COUNT(*) FROM ISSUE i WHERE i.WARD_ID = w.WARD_ID) AS issue_count,
              (SELECT COUNT(*) FROM OFFICER o WHERE o.WARD_ID = w.WARD_ID) AS officer_count,
              (SELECT COUNT(*) FROM CITIZEN ct WHERE ct.WARD_ID = w.WARD_ID) AS citizen_count
         FROM WARD w
         JOIN COUNCIL c ON c.COUNCIL_ID = w.COUNCIL_ID
        WHERE w.WARD_ID = ?`,
      [wardId]
    );

    res.json({
      success: true,
      message: `Ward "${targetWardName}" updated successfully.`,
      data: updatedRows[0],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a ward with foreign-key dependency protection
 * DELETE /api/admin/wards/:id
 */
exports.deleteWard = async (req, res, next) => {
  try {
    const wardId = parseInt(req.params.id, 10);

    const [wRows] = await db.query('SELECT * FROM WARD WHERE WARD_ID = ?', [wardId]);
    if (!wRows.length) {
      return res.status(404).json({ success: false, message: 'Ward not found.' });
    }
    const ward = wRows[0];

    // Check if issues, citizens, or officers reference this ward
    const [counts] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM ISSUE WHERE WARD_ID = ?) AS issue_count,
         (SELECT COUNT(*) FROM CITIZEN WHERE WARD_ID = ?) AS citizen_count,
         (SELECT COUNT(*) FROM OFFICER WHERE WARD_ID = ?) AS officer_count,
         (SELECT COUNT(*) FROM ANNOUNCEMENT WHERE WARD_ID = ?) AS announcement_count`,
      [wardId, wardId, wardId, wardId]
    );

    const dep = counts[0] || {};
    const issues = Number(dep.issue_count) || 0;
    const citizens = Number(dep.citizen_count) || 0;
    const officers = Number(dep.officer_count) || 0;
    const announcements = Number(dep.announcement_count) || 0;

    if (issues > 0 || citizens > 0 || officers > 0) {
      const blockers = [];
      if (issues > 0) blockers.push(`${issues} issue report(s)`);
      if (citizens > 0) blockers.push(`${citizens} registered citizen(s)`);
      if (officers > 0) blockers.push(`${officers} assigned officer(s)`);

      return res.status(400).json({
        success: false,
        message: `Cannot delete ward "${ward.WARD_NAME}" because it is currently linked to ${blockers.join(', ')}. Please reassign or close these records before deleting.`,
      });
    }

    if (announcements > 0) {
      await db.query('UPDATE ANNOUNCEMENT SET WARD_ID = NULL WHERE WARD_ID = ?', [wardId]);
    }

    await db.query('DELETE FROM WARD WHERE WARD_ID = ?', [wardId]);

    // Audit log
    await AuditService.logAction({
      entityType: 'WARD',
      entityId: wardId,
      action: 'WARD_DELETED',
      user: req.user,
      req,
      oldState: {
        ward_id: wardId,
        ward_name: ward.WARD_NAME,
        council_id: ward.COUNCIL_ID,
      },
      details: { ward_name: ward.WARD_NAME },
    });

    res.json({
      success: true,
      message: `Ward "${ward.WARD_NAME}" has been permanently removed.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all councils with live counts
 * GET /api/admin/councils
 */
exports.getAllCouncils = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT
         c.COUNCIL_ID,
         c.COUNCIL_NAME,
         c.COUNCIL_TYPE,
         c.DISTRICT,
         c.PROVINCE,
         c.CREATED_AT,
         (SELECT COUNT(*) FROM WARD w WHERE w.COUNCIL_ID = c.COUNCIL_ID) AS ward_count,
         (SELECT COUNT(*) FROM OFFICER o WHERE o.COUNCIL_ID = c.COUNCIL_ID) AS officer_count,
         (SELECT COUNT(*) FROM ISSUE i JOIN WARD w ON w.WARD_ID = i.WARD_ID WHERE w.COUNCIL_ID = c.COUNCIL_ID) AS issue_count
       FROM COUNCIL c
       ORDER BY c.COUNCIL_ID ASC`
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new municipal council
 * POST /api/admin/councils
 */
exports.createCouncil = async (req, res, next) => {
  try {
    const { council_name, council_type, district, province } = req.body || {};
    if (!council_name || !String(council_name).trim()) {
      return res.status(400).json({ success: false, message: 'Council name is required.' });
    }
    const validTypes = ['Pradeshiya Sabha', 'Urban Council', 'Municipal Council'];
    const type = validTypes.includes(council_type) ? council_type : 'Pradeshiya Sabha';

    const [dup] = await db.query(
      'SELECT COUNCIL_ID FROM COUNCIL WHERE LOWER(COUNCIL_NAME) = LOWER(?)',
      [String(council_name).trim()]
    );
    if (dup.length) {
      return res.status(409).json({ success: false, message: `Council "${council_name.trim()}" already exists.` });
    }

    const [result] = await db.query(
      'INSERT INTO COUNCIL (COUNCIL_NAME, COUNCIL_TYPE, DISTRICT, PROVINCE) VALUES (?, ?, ?, ?)',
      [String(council_name).trim(), type, String(district || 'Gampaha').trim(), String(province || 'Western').trim()]
    );

    await AuditService.logAction({
      entityType: 'COUNCIL',
      entityId: result.insertId,
      action: 'COUNCIL_CREATED',
      user: req.user,
      req,
      newState: { council_name: council_name.trim(), council_type: type, district, province },
      details: { council_name: council_name.trim() },
    });

    const [newCouncil] = await db.query(
      `SELECT c.*, 0 AS ward_count, 0 AS officer_count, 0 AS issue_count
         FROM COUNCIL c WHERE c.COUNCIL_ID = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: `Council "${council_name.trim()}" created successfully.`,
      data: newCouncil[0],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update municipal council details
 * PUT /api/admin/councils/:id
 */
exports.updateCouncil = async (req, res, next) => {
  try {
    const councilId = parseInt(req.params.id, 10);
    const { council_name, council_type, district, province } = req.body || {};

    const [cRows] = await db.query('SELECT * FROM COUNCIL WHERE COUNCIL_ID = ?', [councilId]);
    if (!cRows.length) {
      return res.status(404).json({ success: false, message: 'Council not found.' });
    }
    const current = cRows[0];

    const targetName = council_name !== undefined ? String(council_name).trim() : current.COUNCIL_NAME;
    const targetType = council_type !== undefined ? council_type : current.COUNCIL_TYPE;
    const targetDistrict = district !== undefined ? String(district).trim() : current.DISTRICT;
    const targetProvince = province !== undefined ? String(province).trim() : current.PROVINCE;

    if (!targetName) {
      return res.status(400).json({ success: false, message: 'Council name cannot be empty.' });
    }

    // Check duplicate name
    const [dup] = await db.query(
      'SELECT COUNCIL_ID FROM COUNCIL WHERE LOWER(COUNCIL_NAME) = LOWER(?) AND COUNCIL_ID <> ?',
      [targetName, councilId]
    );
    if (dup.length) {
      return res.status(409).json({ success: false, message: `Another council named "${targetName}" already exists.` });
    }

    await db.query(
      'UPDATE COUNCIL SET COUNCIL_NAME = ?, COUNCIL_TYPE = ?, DISTRICT = ?, PROVINCE = ? WHERE COUNCIL_ID = ?',
      [targetName, targetType, targetDistrict, targetProvince, councilId]
    );

    await AuditService.logAction({
      entityType: 'COUNCIL',
      entityId: councilId,
      action: 'COUNCIL_UPDATED',
      user: req.user,
      req,
      oldState: current,
      newState: { council_name: targetName, council_type: targetType, district: targetDistrict, province: targetProvince },
      details: { council_name: targetName },
    });

    const [updated] = await db.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM WARD w WHERE w.COUNCIL_ID = c.COUNCIL_ID) AS ward_count,
              (SELECT COUNT(*) FROM OFFICER o WHERE o.COUNCIL_ID = c.COUNCIL_ID) AS officer_count,
              (SELECT COUNT(*) FROM ISSUE i JOIN WARD w ON w.WARD_ID = i.WARD_ID WHERE w.COUNCIL_ID = c.COUNCIL_ID) AS issue_count
         FROM COUNCIL c WHERE c.COUNCIL_ID = ?`,
      [councilId]
    );

    res.json({
      success: true,
      message: `Council "${targetName}" updated successfully.`,
      data: updated[0],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a council
 * DELETE /api/admin/councils/:id
 */
exports.deleteCouncil = async (req, res, next) => {
  try {
    const councilId = parseInt(req.params.id, 10);
    const [cRows] = await db.query('SELECT * FROM COUNCIL WHERE COUNCIL_ID = ?', [councilId]);
    if (!cRows.length) {
      return res.status(404).json({ success: false, message: 'Council not found.' });
    }
    const council = cRows[0];

    const [depRows] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM WARD WHERE COUNCIL_ID = ?) AS ward_count,
         (SELECT COUNT(*) FROM OFFICER WHERE COUNCIL_ID = ?) AS officer_count`,
      [councilId, councilId]
    );
    const dep = depRows[0] || {};
    const wards = Number(dep.ward_count) || 0;
    const officers = Number(dep.officer_count) || 0;

    if (wards > 0 || officers > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete council "${council.COUNCIL_NAME}" because it contains ${wards} ward(s) and ${officers} officer(s). Delete or reassign the wards and officers first.`,
      });
    }

    await db.query('DELETE FROM COUNCIL WHERE COUNCIL_ID = ?', [councilId]);

    await AuditService.logAction({
      entityType: 'COUNCIL',
      entityId: councilId,
      action: 'COUNCIL_DELETED',
      user: req.user,
      req,
      oldState: council,
      details: { council_name: council.COUNCIL_NAME },
    });

    res.json({ success: true, message: `Council "${council.COUNCIL_NAME}" deleted successfully.` });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Verification Queue with filters, counts, and joined details
 * GET /api/admin/verifications
 */
exports.getVerificationQueue = async (req, res, next) => {
  try {
    const {
      status = 'all',
      ward_id,
      search = '',
      page = 1,
      limit = 20,
    } = req.query;

    const offset = Math.max(0, (parseInt(page, 10) - 1) * parseInt(limit, 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const whereClauses = [];
    const params = [];

    // Filter by verification response
    if (status === 'pending') {
      whereClauses.push("v.RESPONSE = 'Pending'");
    } else if (status === 'disputed') {
      whereClauses.push("v.RESPONSE = 'Disputed'");
    } else if (status === 'confirmed') {
      whereClauses.push("v.RESPONSE = 'Confirmed'");
    } else if (status === 'auto_closed') {
      whereClauses.push("v.RESPONSE = 'auto_closed'");
    }

    // Ward scoping
    const effectiveWardId =
      ward_id && ward_id !== 'all'
        ? ward_id
        : req.user?.role === 'supervisor' && req.user?.ward_id
        ? req.user.ward_id
        : null;

    if (effectiveWardId && effectiveWardId !== 'all') {
      whereClauses.push('i.WARD_ID = ?');
      params.push(Number(effectiveWardId));
    }

    // Search query
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClauses.push(
        '(i.TITLE LIKE ? OR i.DESCRIPTION LIKE ? OR c.FULL_NAME LIKE ? OR o.FULL_NAME LIKE ? OR o.EMPLOYEE_ID LIKE ?)'
      );
      params.push(term, term, term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Summary counts query (unfiltered by status tab, scoped to ward)
    const countWhereClauses = [];
    const countParams = [];
    if (effectiveWardId && effectiveWardId !== 'all') {
      countWhereClauses.push('i.WARD_ID = ?');
      countParams.push(Number(effectiveWardId));
    }
    const countWhereSql = countWhereClauses.length > 0 ? `WHERE ${countWhereClauses.join(' AND ')}` : '';

    const countQuery = `
      SELECT
        COUNT(*) AS total_count,
        SUM(v.RESPONSE = 'Pending') AS pending_count,
        SUM(v.RESPONSE = 'Disputed' AND i.STATUS = 'Disputed') AS disputed_count,
        SUM(v.RESPONSE = 'Confirmed') AS confirmed_count,
        SUM(v.RESPONSE = 'auto_closed') AS auto_closed_count
      FROM REPORT_VERIFICATION v
      JOIN ISSUE i ON i.ISSUE_ID = v.ISSUE_ID
      ${countWhereSql}
    `;

    const [countRows] = await db.query(countQuery, countParams);
    const counts = countRows[0] || {};

    // Main records query
    const dataQuery = `
      SELECT
        v.VERIFICATION_ID,
        v.ISSUE_ID,
        v.PROOF_ID,
        v.REPORTER_ID,
        v.RESPONSE,
        v.DISPUTE_PHOTO,
        v.REMARKS AS CITIZEN_REMARKS,
        v.DEADLINE_AT,
        v.RESPONDED_AT,
        v.CREATED_AT AS VERIFICATION_CREATED_AT,
        TIMESTAMPDIFF(HOUR, NOW(), v.DEADLINE_AT) AS HOURS_REMAINING,
        i.TITLE AS ISSUE_TITLE,
        i.DESCRIPTION AS ISSUE_DESCRIPTION,
        i.CATEGORY,
        i.STATUS AS ISSUE_STATUS,
        i.IS_EMERGENCY,
        i.PRIORITY_SCORE,
        i.BEFORE_PHOTO,
        i.CLOSURE_TYPE,
        i.CREATED_AT AS ISSUE_CREATED_AT,
        i.RESOLVED_AT,
        i.CLOSED_AT,
        w.WARD_ID,
        w.WARD_NAME,
        c.FULL_NAME AS REPORTER_NAME,
        c.EMAIL AS REPORTER_EMAIL,
        c.MOBILE_NUMBER AS REPORTER_MOBILE,
        p.AFTER_PHOTO,
        p.REMARKS AS OFFICER_REMARKS,
        p.SUBMITTED_AT AS PROOF_SUBMITTED_AT,
        o.OFFICER_ID,
        o.FULL_NAME AS OFFICER_NAME,
        o.EMPLOYEE_ID AS OFFICER_EMPLOYEE_ID
      FROM REPORT_VERIFICATION v
      JOIN ISSUE i ON i.ISSUE_ID = v.ISSUE_ID
      LEFT JOIN WARD w ON w.WARD_ID = i.WARD_ID
      LEFT JOIN CITIZEN c ON c.CITIZEN_ID = v.REPORTER_ID
      LEFT JOIN RESOLUTION_PROOF p ON p.PROOF_ID = v.PROOF_ID
      LEFT JOIN OFFICER o ON o.OFFICER_ID = p.OFFICER_ID
      ${whereSql}
      ORDER BY
        CASE
          WHEN v.RESPONSE = 'Disputed' AND i.STATUS = 'Disputed' THEN 1
          WHEN v.RESPONSE = 'Pending' THEN 2
          WHEN v.RESPONSE = 'Disputed' AND i.STATUS = 'In Progress' THEN 3
          ELSE 4
        END ASC,
        v.CREATED_AT DESC
      LIMIT ? OFFSET ?
    `;

    params.push(pageSize, offset);
    const [rows] = await db.query(dataQuery, params);

    res.json({
      success: true,
      data: {
        items: rows,
        counts: {
          total: Number(counts.total_count) || 0,
          pending: Number(counts.pending_count) || 0,
          disputed: Number(counts.disputed_count) || 0,
          confirmed: Number(counts.confirmed_count) || 0,
          auto_closed: Number(counts.auto_closed_count) || 0,
        },
        pagination: {
          page: parseInt(page, 10),
          limit: pageSize,
          total: rows.length,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Approve verification and close ticket
 * POST /api/admin/verifications/:id/approve
 */
exports.approveVerification = async (req, res, next) => {
  const verificationId = parseInt(req.params.id, 10);
  const { notes } = req.body || {};

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [vRows] = await conn.query(
      `SELECT v.*, i.STATUS AS CURRENT_ISSUE_STATUS
         FROM REPORT_VERIFICATION v
         JOIN ISSUE i ON i.ISSUE_ID = v.ISSUE_ID
        WHERE v.VERIFICATION_ID = ?`,
      [verificationId]
    );

    if (!vRows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Verification record not found' });
    }

    const verification = vRows[0];
    const closureType = verification.RESPONSE === 'Disputed' ? 'Supervisor Overruled' : 'Supervisor Approved';

    // Update verification record
    await conn.query(
      `UPDATE REPORT_VERIFICATION
          SET RESPONSE = 'Confirmed',
              REMARKS = COALESCE(?, REMARKS),
              RESPONDED_AT = NOW()
        WHERE VERIFICATION_ID = ?`,
      [notes || `Approved by ${req.user.role}: ${req.user.full_name || 'Admin'}`, verificationId]
    );

    // Close issue
    await conn.query(
      `UPDATE ISSUE
          SET STATUS = 'Closed',
              CLOSURE_TYPE = ?,
              CLOSED_AT = NOW()
        WHERE ISSUE_ID = ?`,
      [closureType, verification.ISSUE_ID]
    );

    // Audit log
    await AuditService.logStatusChange({
      issueId: verification.ISSUE_ID,
      oldStatus: verification.CURRENT_ISSUE_STATUS,
      newStatus: 'Closed',
      user: req.user,
      req,
      note: notes || `Verification approved and closed by supervisor/admin (${closureType})`,
      conn,
    });

    await conn.commit();
    res.json({
      success: true,
      message: `Issue #${verification.ISSUE_ID} successfully approved and closed.`,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/**
 * Reject verification and reopen ticket for rework
 * POST /api/admin/verifications/:id/reject
 */
exports.rejectVerification = async (req, res, next) => {
  const verificationId = parseInt(req.params.id, 10);
  const { notes, reassignOfficerId } = req.body || {};

  if (!notes || !notes.trim()) {
    return res.status(400).json({ success: false, message: 'Reason / rework instructions are required.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [vRows] = await conn.query(
      `SELECT v.*, i.STATUS AS CURRENT_ISSUE_STATUS, i.OFFICER_ID AS CURRENT_OFFICER_ID
         FROM REPORT_VERIFICATION v
         JOIN ISSUE i ON i.ISSUE_ID = v.ISSUE_ID
        WHERE v.VERIFICATION_ID = ?`,
      [verificationId]
    );

    if (!vRows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Verification record not found' });
    }

    const verification = vRows[0];
    const newOfficerId = reassignOfficerId ? parseInt(reassignOfficerId, 10) : verification.CURRENT_OFFICER_ID;

    // Update issue: Reopen to 'In Progress' and reset RESOLVED_AT and CLOSURE_TYPE
    await conn.query(
      `UPDATE ISSUE
          SET STATUS = 'In Progress',
              OFFICER_ID = ?,
              RESOLVED_AT = NULL,
              CLOSURE_TYPE = NULL,
              UPDATED_AT = NOW()
        WHERE ISSUE_ID = ?`,
      [newOfficerId, verification.ISSUE_ID]
    );

    // Update verification record remarks with rejection audit note
    await conn.query(
      `UPDATE REPORT_VERIFICATION
          SET REMARKS = CONCAT(COALESCE(REMARKS, ''), '\n[Supervisor Rework Request]: ', ?),
              RESPONDED_AT = NOW()
        WHERE VERIFICATION_ID = ?`,
      [notes.trim(), verificationId]
    );

    // Audit log
    await AuditService.logStatusChange({
      issueId: verification.ISSUE_ID,
      oldStatus: verification.CURRENT_ISSUE_STATUS,
      newStatus: 'In Progress',
      user: req.user,
      req,
      note: `Rework requested: ${notes.trim()}`,
      conn,
    });

    await conn.commit();

    notifyStatusChange(verification.ISSUE_ID, verification.CURRENT_ISSUE_STATUS, 'In Progress', {
      note: `Supervisor rework requested: ${notes.trim()}`,
    });

    res.json({
      success: true,
      message: `Issue #${verification.ISSUE_ID} reopened to "In Progress" for rework.`,
      data: {
        issueId: verification.ISSUE_ID,
        status: 'In Progress',
        officerId: newOfficerId,
      },
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};
