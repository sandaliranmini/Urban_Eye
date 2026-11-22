import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getAllOfficers,
  createOfficer,
  updateOfficer,
  deleteOfficer,
  getAllWards,
  getAllCouncils,
} from '../../services/adminService';

const DEPARTMENTS = [
  'Road Maintenance & Pavements',
  'Public Health & Waste Management',
  'Electrical & Street Lighting',
  'Water Supply & Drainage',
  'Civil Engineering & Infrastructure',
  'General Municipal Administration',
];

const ROLE_BADGES = {
  Admin: { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
  Supervisor: { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' },
  'Field Officer': { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
};

export default function OfficerManagement({ user, onNavigate }) {
  const [officers, setOfficers] = useState([]);
  const [wards, setWards] = useState([]);
  const [councils, setCouncils] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [wardFilter, setWardFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals: 'edit' | 'delete' | null
  const [activeModal, setActiveModal] = useState(null);
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    full_name: '',
    department: '',
    role: 'Field Officer',
    ward_id: '',
    is_active: 1,
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  // Load data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [officersRes, wardsRes, councilsRes] = await Promise.all([
        getAllOfficers(),
        getAllWards(),
        getAllCouncils(),
      ]);

      setOfficers(officersRes.data || []);
      setWards(wardsRes.data || []);
      setCouncils(councilsRes.data || []);
    } catch (err) {
      console.error('Failed to load officer data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load officer directory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered officers list
  const filteredOfficers = useMemo(() => {
    return officers.filter((item) => {
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = item.FULL_NAME?.toLowerCase().includes(q);
        const matchesEmp = item.EMPLOYEE_ID?.toLowerCase().includes(q);
        const matchesEmail = item.EMAIL?.toLowerCase().includes(q);
        const matchesDept = item.DEPARTMENT?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmp && !matchesEmail && !matchesDept) return false;
      }
      // Role
      if (roleFilter !== 'all' && item.ROLE !== roleFilter) return false;
      // Ward
      if (wardFilter !== 'all' && String(item.WARD_ID) !== String(wardFilter)) return false;
      // Status
      if (statusFilter === 'active' && !item.IS_ACTIVE) return false;
      if (statusFilter === 'inactive' && item.IS_ACTIVE) return false;

      return true;
    });
  }, [officers, searchTerm, roleFilter, wardFilter, statusFilter]);

  // Metric counts
  const metrics = useMemo(() => {
    const total = officers.length;
    const fieldOfficers = officers.filter((o) => o.ROLE === 'Field Officer').length;
    const supervisors = officers.filter((o) => o.ROLE === 'Supervisor').length;
    const active = officers.filter((o) => o.IS_ACTIVE).length;
    const inactive = total - active;
    return { total, fieldOfficers, supervisors, active, inactive };
  }, [officers]);

  // Open Edit Modal
  const handleOpenEdit = (officer) => {
    setSelectedOfficer(officer);
    setEditForm({
      full_name: officer.FULL_NAME || '',
      department: officer.DEPARTMENT || DEPARTMENTS[0],
      role: officer.ROLE || 'Field Officer',
      ward_id: officer.WARD_ID ? String(officer.WARD_ID) : '',
      is_active: officer.IS_ACTIVE ? 1 : 0,
    });
    setActiveModal('edit');
  };

  // Submit Edit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOfficer) return;
    if (!editForm.full_name.trim()) {
      alert('Full name is required.');
      return;
    }

    setSubmitting(true);
    try {
      await updateOfficer(selectedOfficer.OFFICER_ID, {
        full_name: editForm.full_name.trim(),
        department: editForm.department,
        role: editForm.role,
        ward_id: editForm.ward_id ? Number(editForm.ward_id) : null,
        is_active: Number(editForm.is_active),
      });

      showToast(`Officer ${selectedOfficer.EMPLOYEE_ID} updated successfully!`);
      setActiveModal(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to update officer.');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Toggle Active Status
  const handleToggleActive = async (officer) => {
    const newStatus = officer.IS_ACTIVE ? 0 : 1;
    try {
      await updateOfficer(officer.OFFICER_ID, { is_active: newStatus });
      showToast(
        `Officer ${officer.EMPLOYEE_ID} marked as ${newStatus ? 'Active' : 'Inactive'}.`
      );
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to change officer status.');
    }
  };

  // Open Delete Modal
  const handleOpenDelete = (officer) => {
    setSelectedOfficer(officer);
    setActiveModal('delete');
  };

  // Confirm Delete / Deactivate
  const handleConfirmDelete = async (isHard) => {
    if (!selectedOfficer) return;
    setSubmitting(true);
    try {
      const res = await deleteOfficer(selectedOfficer.OFFICER_ID, { hard: isHard ? 'true' : undefined });
      showToast(res.message || 'Officer status updated.');
      setActiveModal(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to remove officer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={styles.toast}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span>{toastMessage}</span>
          </div>
          <button style={styles.closeToastBtn} onClick={() => setToastMessage('')}>✕</button>
        </div>
      )}

      {/* Header */}
      <div style={styles.headerRow}>
        <div>
          <div style={styles.badgeRow}>
            <span style={styles.headerTag}>STAFF ADMINISTRATION</span>
            <span style={styles.roleTag}>MUNICIPAL DIRECTORY</span>
          </div>
          <h1 style={styles.pageTitle}>Officer Management</h1>
          <p style={styles.pageSub}>
            Create, assign, update, and manage field officers, supervisors, and municipal administrative personnel across all wards.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            style={styles.addBtn}
            onClick={() => onNavigate && onNavigate('addOfficer')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add New Officer</span>
          </button>
          <button
            type="button"
            style={styles.refreshBtn}
            onClick={fetchData}
            title="Refresh list"
            disabled={loading}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div style={styles.metricsGrid}>
        <div style={{ ...styles.metricCard, borderLeft: '4px solid #0F172A' }}>
          <span style={styles.metricLabel}>Total Registered Personnel</span>
          <div style={styles.metricValue}>{metrics.total}</div>
          <p style={styles.metricDesc}>Active officers, supervisors & admins</p>
        </div>

        <div style={{ ...styles.metricCard, borderLeft: '4px solid #10B981' }}>
          <span style={styles.metricLabel}>Field Officers</span>
          <div style={styles.metricValue}>{metrics.fieldOfficers}</div>
          <p style={styles.metricDesc}>On-ground triage & repair execution</p>
        </div>

        <div style={{ ...styles.metricCard, borderLeft: '4px solid #0284C7' }}>
          <span style={styles.metricLabel}>Ward Supervisors</span>
          <div style={styles.metricValue}>{metrics.supervisors}</div>
          <p style={styles.metricDesc}>Verification & queue oversight</p>
        </div>

        <div style={{ ...styles.metricCard, borderLeft: '4px solid #64748B' }}>
          <span style={styles.metricLabel}>Active Staff</span>
          <div style={styles.metricValue}>
            {metrics.active}{' '}
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748B' }}>
              ({metrics.inactive} inactive)
            </span>
          </div>
          <p style={styles.metricDesc}>Current system access permitted</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by ID, name, email, department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          {searchTerm && (
            <button style={styles.clearSearchBtn} onClick={() => setSearchTerm('')}>✕</button>
          )}
        </div>

        <div style={styles.filterDropdowns}>
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={styles.selectInput}
          >
            <option value="all">All Roles</option>
            <option value="Field Officer">Field Officers</option>
            <option value="Supervisor">Supervisors</option>
            <option value="Admin">Admins</option>
          </select>

          {/* Ward Filter */}
          <select
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            style={styles.selectInput}
          >
            <option value="all">All Wards</option>
            {wards.map((w) => (
              <option key={w.WARD_ID} value={String(w.WARD_ID)}>
                {w.WARD_NAME}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.selectInput}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Officers Table */}
      {loading ? (
        <div style={styles.loadingBox}>
          <div style={styles.spinner} />
          <p style={{ marginTop: '14px', color: '#64748B', fontSize: '14px' }}>Loading officer directory...</p>
        </div>
      ) : error ? (
        <div style={styles.errorBox}>
          <p style={{ margin: 0, fontWeight: 600, color: '#B91C1C' }}>{error}</p>
          <button style={styles.retryBtn} onClick={fetchData}>Try Again</button>
        </div>
      ) : filteredOfficers.length === 0 ? (
        <div style={styles.emptyBox}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h3 style={{ margin: '14px 0 6px', color: '#0F172A', fontSize: '17px' }}>No officers found</h3>
          <p style={{ margin: 0, color: '#64748B', fontSize: '13px' }}>
            {searchTerm || roleFilter !== 'all' || wardFilter !== 'all' || statusFilter !== 'all'
              ? 'No officer records match the selected filter criteria.'
              : 'No officers currently registered in the database.'}
          </p>
        </div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                <th style={styles.th}>EMPLOYEE ID</th>
                <th style={styles.th}>OFFICER NAME & EMAIL</th>
                <th style={styles.th}>ROLE</th>
                <th style={styles.th}>DEPARTMENT</th>
                <th style={styles.th}>JURISDICTION / WARD</th>
                <th style={styles.th}>STATUS</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredOfficers.map((item) => {
                const badge = ROLE_BADGES[item.ROLE] || { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
                const initials = (item.FULL_NAME || 'OF')
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <tr key={item.OFFICER_ID} style={styles.tr}>
                    {/* Employee ID */}
                    <td style={styles.td}>
                      <span style={styles.empBadge}>{item.EMPLOYEE_ID}</span>
                    </td>

                    {/* Officer Name & Email */}
                    <td style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ ...styles.avatar, background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}>
                          {initials}
                        </div>
                        <div>
                          <div style={styles.officerName}>{item.FULL_NAME}</div>
                          <div style={styles.officerEmail}>{item.EMAIL}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.rolePill,
                          background: badge.bg,
                          color: badge.text,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        {item.ROLE}
                      </span>
                    </td>

                    {/* Department */}
                    <td style={styles.td}>
                      <span style={styles.deptText}>
                        {item.DEPARTMENT || 'General Administration'}
                      </span>
                    </td>

                    {/* Jurisdiction */}
                    <td style={styles.td}>
                      <div style={styles.wardText}>
                        {item.WARD_NAME || (item.ROLE === 'Admin' ? 'All Wards (Municipal)' : 'Unassigned')}
                      </div>
                      <div style={styles.councilSub}>{item.COUNCIL_NAME || 'Dompe Pradeshiya Sabha'}</div>
                    </td>

                    {/* Status */}
                    <td style={styles.td}>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        title="Click to toggle status"
                        style={{
                          ...styles.statusToggleBtn,
                          background: item.IS_ACTIVE ? '#ECFDF5' : '#F1F5F9',
                          color: item.IS_ACTIVE ? '#047857' : '#64748B',
                          border: `1px solid ${item.IS_ACTIVE ? '#A7F3D0' : '#CBD5E1'}`,
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: item.IS_ACTIVE ? '#10B981' : '#94A3B8',
                          }}
                        />
                        {item.IS_ACTIVE ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          type="button"
                          style={styles.actionBtnEdit}
                          onClick={() => handleOpenEdit(item)}
                          title="Edit officer details"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          style={styles.actionBtnDelete}
                          onClick={() => handleOpenDelete(item)}
                          title="Deactivate or remove officer"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* EDIT OFFICER MODAL */}
      {activeModal === 'edit' && selectedOfficer && (
        <div style={modalStyles.backdrop} onClick={() => setActiveModal(null)}>
          <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={modalStyles.editIconBadge}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </span>
                <h3 style={modalStyles.title}>Edit Officer: {selectedOfficer.EMPLOYEE_ID}</h3>
              </div>
              <button style={modalStyles.closeBtn} onClick={() => setActiveModal(null)}>✕</button>
            </div>

            <p style={modalStyles.sub}>
              Update role assignment, ward jurisdiction, department, or active status for <strong>{selectedOfficer.EMAIL}</strong>.
            </p>

            <form onSubmit={handleEditSubmit}>
              {/* Full Name */}
              <div style={{ marginBottom: '14px' }}>
                <label style={modalStyles.label}>Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  style={modalStyles.input}
                  required
                />
              </div>

              <div style={modalStyles.grid2}>
                {/* Role */}
                <div>
                  <label style={modalStyles.label}>Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    style={modalStyles.select}
                  >
                    <option value="Field Officer">Field Officer</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                {/* Assigned Ward */}
                <div>
                  <label style={modalStyles.label}>Assigned Ward</label>
                  <select
                    value={editForm.ward_id}
                    onChange={(e) => setEditForm({ ...editForm, ward_id: e.target.value })}
                    style={modalStyles.select}
                  >
                    <option value="">All Wards / General</option>
                    {wards.map((w) => (
                      <option key={w.WARD_ID} value={String(w.WARD_ID)}>
                        {w.WARD_NAME}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Department */}
              <div style={{ marginBottom: '14px' }}>
                <label style={modalStyles.label}>Department</label>
                <select
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  style={modalStyles.select}
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Active Status */}
              <div style={{ marginBottom: '20px' }}>
                <label style={modalStyles.label}>Account Status</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="is_active"
                      checked={Number(editForm.is_active) === 1}
                      onChange={() => setEditForm({ ...editForm, is_active: 1 })}
                    />
                    <span style={{ color: '#047857', fontWeight: 600 }}>Active (Can login)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="is_active"
                      checked={Number(editForm.is_active) === 0}
                      onChange={() => setEditForm({ ...editForm, is_active: 0 })}
                    />
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Inactive (Login suspended)</span>
                  </label>
                </div>
              </div>

              <div style={modalStyles.footer}>
                <button
                  type="button"
                  style={modalStyles.cancelBtn}
                  onClick={() => setActiveModal(null)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={modalStyles.submitBtn}
                  disabled={submitting}
                >
                  {submitting ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / DEACTIVATE MODAL */}
      {activeModal === 'delete' && selectedOfficer && (
        <div style={modalStyles.backdrop} onClick={() => setActiveModal(null)}>
          <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={modalStyles.deleteIconBadge}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </span>
                <h3 style={modalStyles.title}>Manage Officer Removal</h3>
              </div>
              <button style={modalStyles.closeBtn} onClick={() => setActiveModal(null)}>✕</button>
            </div>

            <p style={modalStyles.sub}>
              Select the appropriate action for <strong>{selectedOfficer.FULL_NAME}</strong> ({selectedOfficer.EMPLOYEE_ID}):
            </p>

            <div style={modalStyles.deleteOptionBox}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A', marginBottom: '4px' }}>
                Option 1: Safe Deactivation (Recommended)
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>
                Prevents the officer from logging into the portal, but preserves all historical resolution proofs, ticket assignments, and municipal audit logs intact.
              </p>
              <button
                type="button"
                style={modalStyles.deactivateBtn}
                onClick={() => handleConfirmDelete(false)}
                disabled={submitting}
              >
                {submitting ? 'Processing...' : 'Deactivate Officer Account'}
              </button>
            </div>

            <div style={{ ...modalStyles.deleteOptionBox, borderColor: '#FCA5A5', background: '#FEF2F2' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#991B1B', marginBottom: '4px' }}>
                Option 2: Permanent Database Deletion
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#7F1D1D' }}>
                Permanently wipes this officer row from the database. Note: If the officer has already resolved tickets or posted official announcements, the system will automatically safeguard integrity by deactivating instead.
              </p>
              <button
                type="button"
                style={modalStyles.hardDeleteBtn}
                onClick={() => handleConfirmDelete(true)}
                disabled={submitting}
              >
                {submitting ? 'Processing...' : 'Delete Permanently'}
              </button>
            </div>

            <div style={{ textAlign: 'right', marginTop: '16px' }}>
              <button
                type="button"
                style={modalStyles.cancelBtn}
                onClick={() => setActiveModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styling definitions
const styles = {
  container: {
    padding: '4px 0 40px',
    maxWidth: '1280px',
    margin: '0 auto',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  toast: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 9999,
    background: '#FFFFFF',
    border: '1px solid #10B981',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
    borderRadius: '8px',
    padding: '12px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    color: '#065F46',
    fontWeight: 500,
    fontSize: '14px',
  },
  closeToastBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6B7280',
    cursor: 'pointer',
    fontSize: '14px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    gap: '16px',
    flexWrap: 'wrap',
  },
  badgeRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '6px',
  },
  headerTag: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: '#0284C7',
    background: '#E0F2FE',
    padding: '3px 8px',
    borderRadius: '4px',
  },
  roleTag: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: '#475569',
    background: '#F1F5F9',
    padding: '3px 8px',
    borderRadius: '4px',
  },
  pageTitle: {
    fontSize: '26px',
    fontWeight: 800,
    color: '#0F172A',
    margin: '0 0 6px',
    letterSpacing: '-0.02em',
  },
  pageSub: {
    fontSize: '14px',
    color: '#64748B',
    margin: 0,
    maxWidth: '820px',
    lineHeight: 1.5,
  },
  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 16px',
    background: '#0F172A',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#FFFFFF',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(15, 23, 42, 0.15)',
  },
  refreshBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '9px 12px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    color: '#475569',
    cursor: 'pointer',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
    marginBottom: '24px',
  },
  metricCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
  },
  metricLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#475569',
    display: 'block',
    marginBottom: '6px',
  },
  metricValue: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#0F172A',
    lineHeight: 1.1,
    marginBottom: '4px',
  },
  metricDesc: {
    fontSize: '12px',
    color: '#64748B',
    margin: 0,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '14px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  searchWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    background: '#F8FAFC',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    padding: '0 10px',
    flex: '1 1 260px',
  },
  searchInput: {
    border: 'none',
    background: 'transparent',
    padding: '8px 10px',
    fontSize: '13px',
    color: '#0F172A',
    outline: 'none',
    width: '100%',
  },
  clearSearchBtn: {
    border: 'none',
    background: 'transparent',
    color: '#94A3B8',
    cursor: 'pointer',
    fontSize: '12px',
  },
  filterDropdowns: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  selectInput: {
    padding: '8px 12px',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    background: '#FFFFFF',
    fontSize: '13px',
    color: '#334155',
    outline: 'none',
  },
  tableWrapper: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    overflowX: 'auto',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px',
  },
  thRow: {
    background: '#F8FAFC',
    borderBottom: '1px solid #E2E8F0',
  },
  th: {
    padding: '12px 16px',
    fontWeight: 700,
    fontSize: '11px',
    color: '#475569',
    letterSpacing: '0.04em',
  },
  tr: {
    borderBottom: '1px solid #F1F5F9',
    transition: 'background 0.1s ease',
  },
  td: {
    padding: '14px 16px',
    color: '#334155',
    verticalAlign: 'middle',
  },
  empBadge: {
    fontFamily: 'monospace',
    fontWeight: 700,
    fontSize: '12px',
    background: '#F1F5F9',
    color: '#0F172A',
    padding: '3px 8px',
    borderRadius: '4px',
    border: '1px solid #E2E8F0',
  },
  avatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '12px',
  },
  officerName: {
    fontWeight: 700,
    color: '#0F172A',
    fontSize: '13px',
  },
  officerEmail: {
    color: '#64748B',
    fontSize: '12px',
  },
  rolePill: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    fontWeight: 700,
    fontSize: '11px',
    letterSpacing: '0.02em',
  },
  deptText: {
    fontSize: '12px',
    color: '#475569',
  },
  wardText: {
    fontWeight: 600,
    color: '#0F172A',
    fontSize: '13px',
  },
  councilSub: {
    fontSize: '11px',
    color: '#64748B',
  },
  statusToggleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  actionBtnEdit: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 10px',
    background: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: '6px',
    color: '#1D4ED8',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  actionBtnDelete: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 8px',
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: '6px',
    color: '#DC2626',
    cursor: 'pointer',
  },
  loadingBox: {
    padding: '60px 20px',
    textAlign: 'center',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #E2E8F0',
    borderTopColor: '#0284C7',
    borderRadius: '50%',
    margin: '0 auto',
    animation: 'spin 0.8s linear infinite',
  },
  errorBox: {
    padding: '24px',
    background: '#FEF2F2',
    border: '1px solid #FCA5A5',
    borderRadius: '8px',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: '12px',
    background: '#DC2626',
    color: '#FFFFFF',
    border: 'none',
    padding: '6px 14px',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
  },
  emptyBox: {
    padding: '60px 20px',
    textAlign: 'center',
    background: '#FFFFFF',
    border: '1px dashed #CBD5E1',
    borderRadius: '8px',
  },
};

const modalStyles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    padding: '16px',
  },
  modal: {
    background: '#FFFFFF',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '540px',
    padding: '24px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 800,
    color: '#0F172A',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: '18px',
    color: '#64748B',
    cursor: 'pointer',
  },
  sub: {
    fontSize: '13px',
    color: '#475569',
    lineHeight: 1.5,
    margin: '0 0 18px',
  },
  createIconBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#E0F2FE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIconBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#DBEAFE',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIconBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#FEE2E2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '14px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#334155',
    marginBottom: '4px',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#0F172A',
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#0F172A',
    outline: 'none',
    background: '#FFFFFF',
    boxSizing: 'border-box',
  },
  eyeBtn: {
    position: 'absolute',
    right: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'transparent',
    border: 'none',
    fontSize: '11px',
    fontWeight: 600,
    color: '#0284C7',
    cursor: 'pointer',
  },
  errText: {
    fontSize: '11px',
    color: '#DC2626',
    marginTop: '3px',
    display: 'block',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
  },
  cancelBtn: {
    padding: '8px 16px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
  },
  submitBtn: {
    padding: '8px 16px',
    background: '#0F172A',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#FFFFFF',
    cursor: 'pointer',
  },
  deleteOptionBox: {
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    padding: '14px',
    marginBottom: '12px',
    background: '#F8FAFC',
  },
  deactivateBtn: {
    marginTop: '10px',
    padding: '8px 14px',
    background: '#334155',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#FFFFFF',
    cursor: 'pointer',
  },
  hardDeleteBtn: {
    marginTop: '10px',
    padding: '8px 14px',
    background: '#DC2626',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#FFFFFF',
    cursor: 'pointer',
  },
};
