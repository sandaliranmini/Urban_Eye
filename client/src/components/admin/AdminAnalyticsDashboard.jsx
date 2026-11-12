import { useState, useEffect, useCallback } from 'react';
import { getIssueAnalytics, getAdminStats, exportAnalytics } from '../../services/adminService';
import axiosInstance from '../../services/axiosInstance';

const CATEGORY_COLORS = {
  'Road Hazard': '#E05638',
  'Water Drainage': '#2A75D3',
  'Waste Management': '#2B9E66',
  'Street Lighting': '#E5A118',
  Other: '#7E8B9B',
};

const STATUS_COLORS = {
  Open: '#2A75D3',
  'In Progress': '#E5A118',
  Resolved: '#2B9E66',
  Closed: '#4B5B70',
  Disputed: '#D92D20',
};

export default function AdminAnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [topStats, setTopStats] = useState(null);
  const [wards, setWards] = useState([]);

  // Filters
  const [period, setPeriod] = useState('30d'); // 7d, 30d, 90d, 1y, all, custom
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedWard, setSelectedWard] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Export State
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Load wards for filter dropdown
  useEffect(() => {
    axiosInstance
      .get('/wards')
      .then((res) => setWards(res.data || []))
      .catch(() => {});
  }, []);

  // Fetch Analytics & Stats
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = {};
      if (period !== 'custom') {
        filters.period = period;
      } else {
        if (fromDate) filters.from_date = fromDate;
        if (toDate) filters.to_date = toDate;
      }
      if (selectedWard !== 'all') filters.ward_id = selectedWard;
      if (selectedCategory !== 'all') filters.category = selectedCategory;
      if (selectedStatus !== 'all') filters.status = selectedStatus;

      const [analyticsRes, statsRes] = await Promise.all([
        getIssueAnalytics(filters),
        getAdminStats(),
      ]);

      setAnalyticsData(analyticsRes.data || null);
      setTopStats(statsRes.data || null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [period, fromDate, toDate, selectedWard, selectedCategory, selectedStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Export
  const handleExport = async (type = 'issues', format = 'csv') => {
    setExporting(true);
    setExportMenuOpen(false);
    setExportNotice('');
    try {
      const filters = {};
      if (period !== 'custom') {
        filters.period = period;
      } else {
        if (fromDate) filters.from_date = fromDate;
        if (toDate) filters.to_date = toDate;
      }
      if (selectedWard !== 'all') filters.ward_id = selectedWard;
      if (selectedCategory !== 'all') filters.category = selectedCategory;
      if (selectedStatus !== 'all') filters.status = selectedStatus;

      await exportAnalytics(filters, format, type);
      setExportNotice(`Exported ${type} (${format.toUpperCase()}) successfully.`);
      setTimeout(() => setExportNotice(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const summary = analyticsData?.summary || {};
  const byCategory = analyticsData?.byCategory || [];
  const byStatus = analyticsData?.byStatus || [];
  const byWard = analyticsData?.byWard || [];
  const verification = analyticsData?.verification || {};
  const timeline = analyticsData?.timeline || [];
  const emergencyAlerts = analyticsData?.emergencyAlerts || [];

  // Compute SVG Donut segments purely functionally
  const statusSegments = byStatus.map((st, idx, arr) => {
    const prevSum = arr.slice(0, idx).reduce((acc, curr) => acc + (curr.percentage || 0), 0);
    return {
      ...st,
      dasharray: `${st.percentage} ${Math.max(0, 100 - st.percentage)}`,
      dashoffset: -prevSum,
      strokeColor: STATUS_COLORS[st.status] || '#7E8B9B',
    };
  });

  // Max value in timeline for scaling
  const maxTimelineCount = Math.max(
    1,
    ...timeline.map((t) => Math.max(t.created_count, t.resolved_count))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with Title and Export Actions */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#17324D]/10 text-[#17324D] rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            <h1 className="text-2xl font-bold text-gray-900">Admin Analytics & Reports</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Real-time municipal performance KPIs, issue resolution SLA, and ward-by-ward data export.
          </p>
        </div>

        {/* Export & Refresh Buttons */}
        <div className="flex items-center gap-2 relative">
          <button
            onClick={fetchData}
            title="Refresh Data"
            className="p-2.5 border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-600 transition"
          >
            <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#17324D] hover:bg-[#1f4367] text-white text-sm font-medium rounded-xl shadow-xs transition disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{exporting ? 'Exporting…' : 'Export Reports'}</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-30 py-1 overflow-hidden">
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Spreadsheet (CSV)
                </div>
                <button
                  onClick={() => handleExport('issues', 'csv')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className="text-emerald-600 font-bold">📄</span>
                  Export Filtered Issues (CSV)
                </button>
                <button
                  onClick={() => handleExport('summary', 'csv')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className="text-blue-600 font-bold">📊</span>
                  Export Analytics Summary (CSV)
                </button>
                <div className="border-t border-gray-100 my-1"></div>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Raw Data (JSON)
                </div>
                <button
                  onClick={() => handleExport('issues', 'json')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className="text-amber-600 font-bold">{"{ }"}</span>
                  Export Issues (JSON)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center justify-between text-sm">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-red-700 font-bold">✕</button>
        </div>
      )}

      {/* Export feedback alert */}
      {exportNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between text-sm">
          <span>✓ {exportNotice}</span>
          <button onClick={() => setExportNotice('')} className="text-emerald-700 hover:text-emerald-900 font-bold">✕</button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Period presets */}
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-medium text-gray-600">
            {[
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: '90d', label: '90 Days' },
              { id: '1y', label: '1 Year' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  period === p.id
                    ? 'bg-white text-gray-900 font-semibold shadow-xs'
                    : 'hover:text-gray-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Ward Select */}
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-[#17324D]"
            >
              <option value="all">All Wards</option>
              {wards.map((w) => (
                <option key={w.WARD_ID} value={w.WARD_ID}>
                  {w.WARD_NAME}
                </option>
              ))}
            </select>

            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-[#17324D]"
            >
              <option value="all">All Categories</option>
              <option value="Road Hazard">Road Hazard</option>
              <option value="Water Drainage">Water Drainage</option>
              <option value="Waste Management">Waste Management</option>
              <option value="Street Lighting">Street Lighting</option>
              <option value="Other">Other</option>
            </select>

            {/* Status Select */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-[#17324D]"
            >
              <option value="all">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
              <option value="Disputed">Disputed</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {period === 'custom' && (
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100 text-xs">
            <span className="font-medium text-gray-600">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2.5 py-1 border border-gray-300 rounded-md"
            />
            <span className="font-medium text-gray-600">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2.5 py-1 border border-gray-300 rounded-md"
            />
            <button
              onClick={fetchData}
              className="px-3 py-1 bg-[#17324D] text-white rounded-md hover:bg-[#1f4367]"
            >
              Apply Dates
            </button>
          </div>
        )}
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Issues Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Issues</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">📋</span>
          </div>
          <div className="text-3xl font-extrabold text-gray-900">
            {summary.total ?? 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span className="text-blue-600 font-semibold">{summary.open ?? 0} open</span>
            <span>•</span>
            <span className="text-amber-600 font-semibold">{summary.in_progress ?? 0} in progress</span>
          </div>
        </div>

        {/* Resolution Rate Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Resolution Rate</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">✓</span>
          </div>
          <div className="text-3xl font-extrabold text-emerald-600">
            {summary.resolution_rate ?? 0}%
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full"
              style={{ width: `${Math.min(100, summary.resolution_rate || 0)}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {(summary.resolved ?? 0) + (summary.closed ?? 0)} resolved or confirmed closed
          </div>
        </div>

        {/* Average Resolution Time Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Resolution SLA</span>
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">⏱</span>
          </div>
          <div className="text-3xl font-extrabold text-gray-900">
            {summary.avg_resolution_hours !== null && summary.avg_resolution_hours !== undefined
              ? `${summary.avg_resolution_hours} hrs`
              : 'N/A'}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {summary.avg_resolution_days
              ? `≈ ${summary.avg_resolution_days} days to full resolution`
              : 'No resolved tickets in this range'}
          </div>
        </div>

        {/* Emergency Incidents Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Emergency Alerts</span>
            <span className="p-1.5 bg-red-50 text-red-600 rounded-lg">🚨</span>
          </div>
          <div className="text-3xl font-extrabold text-red-600">
            {summary.emergency_count ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {topStats?.citizens?.total
              ? `Serving ${topStats.citizens.total} citizens across ${wards.length} wards`
              : 'High priority alerts'}
          </div>
        </div>
      </div>

      {/* VISUALIZATION SECTION: GRID OF 2 COLUMNS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Category Distribution Bar Chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">Issues by Category</h2>
              <span className="text-xs text-gray-400">Total: {summary.total ?? 0}</span>
            </div>

            {byCategory.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No category data for current filter.</p>
            ) : (
              <div className="space-y-3.5">
                {byCategory.map((cat) => {
                  const color = CATEGORY_COLORS[cat.category] || '#7E8B9B';
                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                          {cat.category}
                        </span>
                        <span className="text-gray-500">
                          <strong>{cat.count}</strong> ({cat.percentage}%) •{' '}
                          <span className="text-emerald-600 font-medium">{cat.resolved_count} res</span>
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-2.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, cat.percentage)}%`,
                            backgroundColor: color,
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>Sorted by frequency</span>
            <span>Includes emergency tickets</span>
          </div>
        </div>

        {/* 2. Status Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">Lifecycle Status Breakdown</h2>
              <span className="text-xs text-gray-400">Active vs Closed</span>
            </div>

            {byStatus.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No status data available.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* Visual Donut representation in SVG */}
                <div className="flex justify-center p-2">
                  <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 36 36">
                    {/* Background circle */}
                    <path
                      className="text-gray-100"
                      strokeWidth="3.8"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    {/* Computed Segments */}
                    {statusSegments.map((seg) => (
                      <circle
                        key={seg.status}
                        stroke={seg.strokeColor}
                        strokeWidth="3.8"
                        strokeDasharray={seg.dasharray}
                        strokeDashoffset={seg.dashoffset}
                        fill="none"
                        cx="18"
                        cy="18"
                        r="15.9155"
                      />
                    ))}
                  </svg>
                </div>

                {/* Legend */}
                <div className="space-y-2 text-xs">
                  {byStatus.map((st) => (
                    <div key={st.status} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-medium text-gray-700">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: STATUS_COLORS[st.status] || '#7E8B9B' }}
                        ></span>
                        {st.status}
                      </span>
                      <span className="text-gray-500 font-semibold">
                        {st.count} ({st.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>Disputed issues require supervisor verification</span>
            <span className="text-emerald-600 font-medium">{summary.resolution_rate ?? 0}% closed rate</span>
          </div>
        </div>
      </div>

      {/* WARD BREAKDOWN & VERIFICATION SLA SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ward Breakdown Table (2 cols on large screen) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Ward Performance Comparison</h2>
              <p className="text-xs text-gray-500">Distribution of municipal tickets and resolution efficiency per ward</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md">
              {byWard.length} Wards
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Ward</th>
                  <th className="py-2.5 px-3">Total Issues</th>
                  <th className="py-2.5 px-3">Open</th>
                  <th className="py-2.5 px-3">Resolved</th>
                  <th className="py-2.5 px-3">Emergency</th>
                  <th className="py-2.5 px-3">Resolution Rate</th>
                  <th className="py-2.5 px-3 rounded-r-lg">Avg SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {byWard.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-gray-400">
                      No ward records found.
                    </td>
                  </tr>
                ) : (
                  byWard.map((w) => (
                    <tr key={w.ward_id} className="hover:bg-gray-50/80 transition">
                      <td className="py-3 px-3 font-semibold text-gray-800">
                        {w.ward_name}
                      </td>
                      <td className="py-3 px-3 font-bold text-gray-900">{w.total}</td>
                      <td className="py-3 px-3 text-blue-600 font-medium">{w.open}</td>
                      <td className="py-3 px-3 text-emerald-600 font-medium">{w.resolved}</td>
                      <td className="py-3 px-3">
                        {w.emergency_count > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">
                            {w.emergency_count}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-700">{w.resolution_rate}%</span>
                          <div className="w-12 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, w.resolution_rate)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-500 font-medium">
                        {w.avg_resolution_hours !== null ? `${w.avg_resolution_hours}h` : 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Verification & Emergency SLA Flow (1 col) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-gray-900">14-Day Resolution Audit</h2>
            <p className="text-xs text-gray-500 mt-0.5">Citizen confirmation and auto-closure flow</p>

            <div className="mt-4 space-y-3">
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-emerald-800">Reporter Confirmed</div>
                  <div className="text-xs text-emerald-600">Citizen verified solution</div>
                </div>
                <div className="text-xl font-extrabold text-emerald-700">
                  {verification.confirmed ?? 0}
                </div>
              </div>

              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-gray-800">Auto-Closed (14 Days)</div>
                  <div className="text-xs text-gray-500">Timer elapsed without dispute</div>
                </div>
                <div className="text-xl font-extrabold text-gray-700">
                  {verification.auto_closed ?? 0}
                </div>
              </div>

              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-red-800">Citizen Disputed</div>
                  <div className="text-xs text-red-600">Reopened for officer review</div>
                </div>
                <div className="text-xl font-extrabold text-red-700">
                  {verification.disputed ?? 0}
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-amber-800">Pending Verification</div>
                  <div className="text-xs text-amber-600">Within active 14-day window</div>
                </div>
                <div className="text-xl font-extrabold text-amber-700">
                  {verification.pending ?? 0}
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Alert Performance */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Emergency Alert SLA</h3>
            {emergencyAlerts.length === 0 ? (
              <p className="text-xs text-gray-400">No emergency alert metrics logged yet.</p>
            ) : (
              <div className="space-y-2">
                {emergencyAlerts.slice(0, 3).map((em) => (
                  <div key={em.WARD_ID} className="flex items-center justify-between text-xs py-1">
                    <span className="text-gray-700 font-medium">{em.WARD_NAME}</span>
                    <span className="text-gray-500">
                      {em.AVG_SECONDS_TO_ACK ? `${Math.round(em.AVG_SECONDS_TO_ACK)}s avg ack` : 'Pending ack'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DAILY ISSUE ACTIVITY TRENDS */}
      {timeline.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Issue Activity Trends</h2>
              <p className="text-xs text-gray-500">Daily creation vs resolution count across selected window</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-gray-700">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500"></span>
                Created
              </span>
              <span className="flex items-center gap-1.5 font-medium text-gray-700">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                Resolved
              </span>
            </div>
          </div>

          <div className="h-40 flex items-end gap-1.5 pt-6 pb-2 overflow-x-auto">
            {timeline.map((point) => {
              const createdHeight = (point.created_count / maxTimelineCount) * 100;
              const resolvedHeight = (point.resolved_count / maxTimelineCount) * 100;
              const dateStr = point.date ? String(point.date).slice(5, 10) : '';

              return (
                <div key={point.date} className="flex-1 min-w-[28px] flex flex-col items-center gap-1 h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-0.5 h-full">
                    {/* Created bar */}
                    <div
                      title={`${point.date}: ${point.created_count} created`}
                      style={{ height: `${Math.max(6, createdHeight)}%` }}
                      className="w-2.5 bg-blue-400 group-hover:bg-blue-600 rounded-t-sm transition"
                    ></div>
                    {/* Resolved bar */}
                    <div
                      title={`${point.date}: ${point.resolved_count} resolved`}
                      style={{ height: `${Math.max(6, resolvedHeight)}%` }}
                      className="w-2.5 bg-emerald-400 group-hover:bg-emerald-600 rounded-t-sm transition"
                    ></div>
                  </div>
                  <span className="text-[10px] text-gray-400 group-hover:text-gray-700 truncate w-full text-center">
                    {dateStr}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
