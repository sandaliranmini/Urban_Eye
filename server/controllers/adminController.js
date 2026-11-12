const db = require('../config/db');
const EmergencyAlert = require('../models/EmergencyAlert');
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

    const [updated] = await db.query('SELECT OFFICER_ID, EMPLOYEE_ID, FULL_NAME, EMAIL, ROLE, IS_ACTIVE FROM OFFICER WHERE OFFICER_ID = ?', [id]);
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

    // Soft-deactivate officer to preserve referential integrity on issues/proofs
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
 * Get all wards with council info
 * GET /api/admin/wards
 */
exports.getAllWards = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT
         w.WARD_ID,
         w.WARD_NAME,
         w.DESCRIPTION,
         w.COUNCIL_ID,
         c.COUNCIL_NAME,
         c.COUNCIL_TYPE,
         c.DISTRICT,
         c.PROVINCE
       FROM WARD w
       JOIN COUNCIL c ON c.COUNCIL_ID = w.COUNCIL_ID
       ORDER BY w.WARD_ID ASC`
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all councils
 * GET /api/admin/councils
 */
exports.getAllCouncils = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT
         COUNCIL_ID,
         COUNCIL_NAME,
         COUNCIL_TYPE,
         DISTRICT,
         PROVINCE,
         CREATED_AT
       FROM COUNCIL
       ORDER BY COUNCIL_ID ASC`
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};
