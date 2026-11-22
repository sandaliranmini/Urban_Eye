import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getVerificationQueue,
  approveVerification,
  rejectVerification,
  getAllWards,
  getAllOfficers,
} from '../../services/adminService';
import axiosInstance from '../../services/axiosInstance';

const CATEGORY_COLORS = {
  'Road Hazard': '#E05638',
  'Water Drainage': '#2A75D3',
  'Waste Management': '#2B9E66',
  'Street Lighting': '#E5A118',
  Other: '#64748B',
};

export default function VerificationQueue({ user, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    pending: 0,
    disputed: 0,
    confirmed: 0,
    auto_closed: 0,
  });

  // Filters
  const [statusTab, setStatusTab] = useState('all'); // all, pending, disputed, confirmed, auto_closed
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWard, setSelectedWard] = useState(
    user?.role === 'supervisor' && user?.ward_id ? String(user.ward_id) : 'all'
  );
  const [wards, setWards] = useState([]);
  const [officers, setOfficers] = useState([]);

  // Modals & Action State
  const [activeModal, setActiveModal] = useState(null); // 'rework' | 'approve' | 'audit' | 'photo'
  const [selectedItem, setSelectedItem] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const [reassignOfficerId, setReassignOfficerId] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Load wards & officers for dropdowns
  useEffect(() => {
    getAllWards()
      .then((res) => setWards(res.data || []))
      .catch(() => {});

    getAllOfficers()
      .then((res) => setOfficers(res.data || []))
      .catch(() => {});
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  // Fetch queue items
  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        status: statusTab,
        ward_id: selectedWard !== 'all' ? selectedWard : undefined,
        search: searchTerm.trim() || undefined,
      };

      const res = await getVerificationQueue(params);
      if (res.success && res.data) {
        setItems(res.data.items || []);
        if (res.data.counts) {
          setCounts(res.data.counts);
        }
      }
    } catch (err) {
      console.error('Failed to load verification queue:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load verification queue.');
    } finally {
      setLoading(false);
    }
  }, [statusTab, selectedWard, searchTerm]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Open Rework Modal
  const handleOpenRework = (item) => {
    setSelectedItem(item);
    setActionNotes(
      item.RESPONSE === 'Disputed'
        ? `Citizen dispute verified: ${item.CITIZEN_REMARKS || 'Issue remains unresolved.'} Please inspect site and re-work.`
        : ''
    );
    setReassignOfficerId(item.OFFICER_ID ? String(item.OFFICER_ID) : '');
    setActiveModal('rework');
  };

  // Open Approve Modal
  const handleOpenApprove = (item) => {
    setSelectedItem(item);
    setActionNotes(
      item.RESPONSE === 'Disputed'
        ? 'Supervisor reviewed photo evidence and confirmed work was completed adequately. Overruling dispute.'
        : 'Photo evidence inspected and verified by municipal supervisor.'
    );
    setActiveModal('approve');
  };

  // Open Audit Trail Modal
  const handleOpenAudit = async (item) => {
    setSelectedItem(item);
    setActiveModal('audit');
    setLoadingAudit(true);
    try {
      const res = await axiosInstance.get(`/audit-logs/issue/${item.ISSUE_ID}`);
      setAuditLogs(res.data?.data?.timeline || []);
    } catch (err) {
      console.warn('Failed to load audit logs:', err);
      setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Submit Rework
  const handleConfirmRework = async () => {
    if (!selectedItem) return;
    if (!actionNotes.trim()) {
      alert('Please provide instructions for the field officer.');
      return;
    }
    setSubmittingAction(true);
    try {
      await rejectVerification(selectedItem.VERIFICATION_ID, {
        notes: actionNotes.trim(),
        reassignOfficerId: reassignOfficerId ? Number(reassignOfficerId) : undefined,
      });
      showToast(`Issue #${selectedItem.ISSUE_ID} reopened to "In Progress" for rework.`);
      setActiveModal(null);
      fetchQueue();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to submit rework request.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Submit Approve / Overrule
  const handleConfirmApprove = async () => {
    if (!selectedItem) return;
    setSubmittingAction(true);
    try {
      await approveVerification(selectedItem.VERIFICATION_ID, {
        notes: actionNotes.trim(),
      });
      showToast(`Issue #${selectedItem.ISSUE_ID} approved and finalized as Closed.`);
      setActiveModal(null);
      fetchQueue();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to approve verification.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Format countdown
  const renderRemainingTime = (hoursRemaining) => {
    if (hoursRemaining === null || hoursRemaining === undefined) return null;
    if (hoursRemaining <= 0) {
      return <span style={{ color: '#D92D20', fontWeight: 600 }}>Deadline Expired</span>;
    }
    const days = Math.floor(hoursRemaining / 24);
    const hrs = hoursRemaining % 24;
    if (days > 0) {
      return (
        <span style={{ color: days <= 3 ? '#D92D20' : '#B54708', fontWeight: 600 }}>
          {days}d {hrs}h remaining
        </span>
      );
    }
    return (
      <span style={{ color: '#D92D20', fontWeight: 600 }}>
        {hrs} hours remaining
      </span>
    );
  };

  return (
    <div style={styles.container}>
      {/* Toast Notice */}
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

      {/* Page Header */}
      <div style={styles.headerRow}>
        <div>
          <div style={styles.badgeRow}>
            <span style={styles.headerTag}>AUDIT & VERIFICATION</span>
            {user?.role && <span style={styles.roleTag}>{user.role.toUpperCase()} OVERSIGHT</span>}
          </div>
          <h1 style={styles.pageTitle}>Verification Queue</h1>
          <p style={styles.pageSub}>
            Closed-loop audit oversight for resolved civic tasks. Inspect before & after photo evidence, review citizen feedback, and adjudicate disputed resolutions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            style={styles.refreshBtn}
            onClick={fetchQueue}
            title="Refresh queue"
            disabled={loading}
          >
            <svg
              width="16"
              height="16"
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
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div style={styles.metricsGrid}>
        <div
          style={{
            ...styles.metricCard,
            borderLeft: '4px solid #F59E0B',
            cursor: 'pointer',
            background: statusTab === 'pending' ? '#FEF9C3' : '#FFFFFF',
          }}
          onClick={() => setStatusTab('pending')}
        >
          <div style={styles.metricLabelRow}>
            <span style={styles.metricLabel}>Awaiting Verification</span>
            <span style={styles.metricIconBadgeAmber}>14-Day Clock</span>
          </div>
          <div style={styles.metricValue}>{counts.pending}</div>
          <p style={styles.metricDesc}>Tickets with photo proof under citizen review</p>
        </div>

        <div
          style={{
            ...styles.metricCard,
            borderLeft: '4px solid #EF4444',
            cursor: 'pointer',
            background: statusTab === 'disputed' ? '#FEE2E2' : '#FFFFFF',
          }}
          onClick={() => setStatusTab('disputed')}
        >
          <div style={styles.metricLabelRow}>
            <span style={styles.metricLabel}>Citizen Disputes</span>
            <span style={styles.metricIconBadgeRed}>Needs Decision</span>
          </div>
          <div style={{ ...styles.metricValue, color: counts.disputed > 0 ? '#B91C1C' : '#0F172A' }}>
            {counts.disputed}
          </div>
          <p style={styles.metricDesc}>Citizen rejected resolution with counter-proof</p>
        </div>

        <div
          style={{
            ...styles.metricCard,
            borderLeft: '4px solid #10B981',
            cursor: 'pointer',
            background: statusTab === 'confirmed' ? '#DCFCE7' : '#FFFFFF',
          }}
          onClick={() => setStatusTab('confirmed')}
        >
          <div style={styles.metricLabelRow}>
            <span style={styles.metricLabel}>Citizen Confirmed</span>
            <span style={styles.metricIconBadgeGreen}>Verified Fix</span>
          </div>
          <div style={styles.metricValue}>{counts.confirmed}</div>
          <p style={styles.metricDesc}>Citizen verified completed maintenance work</p>
        </div>

        <div
          style={{
            ...styles.metricCard,
            borderLeft: '4px solid #64748B',
            cursor: 'pointer',
            background: statusTab === 'auto_closed' ? '#F1F5F9' : '#FFFFFF',
          }}
          onClick={() => setStatusTab('auto_closed')}
        >
          <div style={styles.metricLabelRow}>
            <span style={styles.metricLabel}>Auto-Closed</span>
            <span style={styles.metricIconBadgeSlate}>14D Expired</span>
          </div>
          <div style={styles.metricValue}>{counts.auto_closed}</div>
          <p style={styles.metricDesc}>Automatically closed after 14 days without dispute</p>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div style={styles.toolbar}>
        {/* Status Tabs */}
        <div style={styles.tabGroup}>
          <button
            style={statusTab === 'all' ? styles.tabBtnActive : styles.tabBtn}
            onClick={() => setStatusTab('all')}
          >
            All Records ({counts.total})
          </button>
          <button
            style={statusTab === 'disputed' ? styles.tabBtnActiveRed : styles.tabBtn}
            onClick={() => setStatusTab('disputed')}
          >
            Disputes ({counts.disputed})
            {counts.disputed > 0 && <span style={styles.disputeDot} />}
          </button>
          <button
            style={statusTab === 'pending' ? styles.tabBtnActiveAmber : styles.tabBtn}
            onClick={() => setStatusTab('pending')}
          >
            Pending Review ({counts.pending})
          </button>
          <button
            style={statusTab === 'confirmed' ? styles.tabBtnActiveGreen : styles.tabBtn}
            onClick={() => setStatusTab('confirmed')}
          >
            Confirmed ({counts.confirmed})
          </button>
          <button
            style={statusTab === 'auto_closed' ? styles.tabBtnActive : styles.tabBtn}
            onClick={() => setStatusTab('auto_closed')}
          >
            Auto-Closed ({counts.auto_closed})
          </button>
        </div>

        {/* Search & Ward Scoping */}
        <div style={styles.filterControls}>
          <div style={styles.searchWrap}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by title, citizen, officer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
            {searchTerm && (
              <button style={styles.clearSearchBtn} onClick={() => setSearchTerm('')}>✕</button>
            )}
          </div>

          <select
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            style={styles.selectInput}
          >
            <option value="all">All Wards (Municipal)</option>
            {wards.map((w) => (
              <option key={w.WARD_ID} value={String(w.WARD_ID)}>
                {w.WARD_NAME}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Queue List */}
      {loading ? (
        <div style={styles.loadingBox}>
          <div style={styles.spinner} />
          <p style={{ marginTop: '14px', color: '#64748B', fontSize: '14px' }}>Loading verification records from database...</p>
        </div>
      ) : error ? (
        <div style={styles.errorBox}>
          <p style={{ margin: 0, fontWeight: 600, color: '#B91C1C' }}>{error}</p>
          <button style={styles.retryBtn} onClick={fetchQueue}>Try Again</button>
        </div>
      ) : items.length === 0 ? (
        <div style={styles.emptyBox}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 style={{ margin: '14px 0 6px', color: '#0F172A', fontSize: '17px' }}>No items in this queue</h3>
          <p style={{ margin: 0, color: '#64748B', fontSize: '13px' }}>
            {statusTab === 'disputed'
              ? 'Great news! There are currently no disputed resolutions requiring supervisor adjudication.'
              : 'No verification records match the selected filters.'}
          </p>
        </div>
      ) : (
        <div style={styles.listContainer}>
          {items.map((item) => {
            const isDisputed = item.RESPONSE === 'Disputed';
            const isReopened = isDisputed && item.ISSUE_STATUS === 'In Progress';
            const isPending = item.RESPONSE === 'Pending';
            const isConfirmed = item.RESPONSE === 'Confirmed';
            const isAutoClosed = item.RESPONSE === 'auto_closed';
            const catColor = CATEGORY_COLORS[item.CATEGORY] || '#64748B';

            return (
              <div
                key={item.VERIFICATION_ID}
                style={{
                  ...styles.card,
                  borderColor: isDisputed ? (isReopened ? '#FDBA74' : '#FCA5A5') : '#E2E8F0',
                  boxShadow: isDisputed
                    ? (isReopened ? '0 4px 12px rgba(234, 88, 12, 0.08)' : '0 4px 12px rgba(239, 68, 68, 0.08)')
                    : '0 1px 3px rgba(0, 0, 0, 0.04)',
                }}
              >
                {/* Top Card Meta Row */}
                <div style={styles.cardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={styles.issueIdBadge}>ISS-{String(item.ISSUE_ID).padStart(5, '0')}</span>
                    <span
                      style={{
                        ...styles.categoryBadge,
                        backgroundColor: `${catColor}15`,
                        color: catColor,
                        border: `1px solid ${catColor}30`,
                      }}
                    >
                      {item.CATEGORY}
                    </span>
                    {item.IS_EMERGENCY ? (
                      <span style={styles.emergencyBadge}>EMERGENCY</span>
                    ) : null}
                    <span style={styles.wardBadge}>Ward: {item.WARD_NAME || `Ward ${item.WARD_ID}`}</span>
                  </div>

                  {/* Status Indicator */}
                  <div>
                    {isDisputed && !isReopened && (
                      <span style={styles.disputedStatusPill}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        DISPUTED BY CITIZEN
                      </span>
                    )}
                    {isReopened && (
                      <span style={styles.reopenedStatusPill}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="1 4 1 10 7 10" />
                          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                        </svg>
                        REOPENED FOR REWORK (IN PROGRESS)
                      </span>
                    )}
                    {isPending && (
                      <span style={styles.pendingStatusPill}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        IN VERIFICATION ({renderRemainingTime(item.HOURS_REMAINING)})
                      </span>
                    )}
                    {isConfirmed && (
                      <span style={styles.confirmedStatusPill}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        CITIZEN CONFIRMED
                      </span>
                    )}
                    {isAutoClosed && (
                      <span style={styles.autoClosedStatusPill}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 14 14" />
                        </svg>
                        AUTO-CLOSED (14 DAYS)
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Description */}
                <h2 style={styles.issueTitle}>{item.ISSUE_TITLE}</h2>
                <p style={styles.issueDesc}>{item.ISSUE_DESCRIPTION}</p>

                {/* Stakeholders Info Strip */}
                <div style={styles.stakeholdersRow}>
                  <div style={styles.stakeholderCol}>
                    <span style={styles.stakeholderLabel}>Reporting Citizen</span>
                    <span style={styles.stakeholderValue}>
                      {item.REPORTER_NAME || 'Verified Resident'}
                    </span>
                    <span style={styles.stakeholderSub}>
                      {item.REPORTER_EMAIL || item.REPORTER_MOBILE || 'Contact on file'}
                    </span>
                  </div>

                  <div style={styles.stakeholderDivider} />

                  <div style={styles.stakeholderCol}>
                    <span style={styles.stakeholderLabel}>Assigned Field Officer</span>
                    <span style={styles.stakeholderValue}>
                      {item.OFFICER_NAME || 'Assigned Officer'} {item.OFFICER_EMPLOYEE_ID ? `(${item.OFFICER_EMPLOYEE_ID})` : ''}
                    </span>
                    <span style={styles.stakeholderSub}>
                      Proof submitted: {item.PROOF_SUBMITTED_AT ? new Date(item.PROOF_SUBMITTED_AT).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>

                  <div style={styles.stakeholderDivider} />

                  <div style={styles.stakeholderCol}>
                    <span style={styles.stakeholderLabel}>Verification Timeline</span>
                    <span style={styles.stakeholderValue}>
                      {isPending
                        ? '14-Day Audit Active'
                        : isDisputed
                        ? 'Citizen Disputed'
                        : isConfirmed
                        ? 'Resolved & Confirmed'
                        : 'Auto-Closed'}
                    </span>
                    <span style={styles.stakeholderSub}>
                      Opened: {item.VERIFICATION_CREATED_AT ? new Date(item.VERIFICATION_CREATED_AT).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Visual Proof Comparison Gallery */}
                <div style={styles.photoGallery}>
                  {/* Photo 1: Citizen Before Photo */}
                  <div style={styles.photoCard}>
                    <div style={styles.photoLabelBar}>
                      <span style={styles.photoTagBlue}>1. Citizen Report (Before)</span>
                    </div>
                    {item.BEFORE_PHOTO ? (
                      <div
                        style={styles.photoThumbWrap}
                        onClick={() => setLightboxImage({ url: item.BEFORE_PHOTO, title: `Before: ${item.ISSUE_TITLE}` })}
                      >
                        <img
                          src={item.BEFORE_PHOTO}
                          alt="Citizen Before Report"
                          style={styles.photoThumb}
                          onError={(e) => {
                            e.target.src = 'https://placehold.co/400x300?text=Before+Photo';
                          }}
                        />
                        <div style={styles.photoZoomOverlay}>Click to expand</div>
                      </div>
                    ) : (
                      <div style={styles.photoPlaceholder}>No initial photo provided</div>
                    )}
                    <div style={styles.photoCaption}>Reported site condition</div>
                  </div>

                  {/* Photo 2: Officer Resolution Proof */}
                  <div style={styles.photoCard}>
                    <div style={styles.photoLabelBar}>
                      <span style={styles.photoTagGreen}>2. Officer Resolution Proof (After)</span>
                    </div>
                    {item.AFTER_PHOTO ? (
                      <div
                        style={styles.photoThumbWrap}
                        onClick={() => setLightboxImage({ url: item.AFTER_PHOTO, title: `Resolution Proof: ${item.ISSUE_TITLE}` })}
                      >
                        <img
                          src={item.AFTER_PHOTO}
                          alt="Officer Resolution Proof"
                          style={styles.photoThumb}
                          onError={(e) => {
                            e.target.src = 'https://placehold.co/400x300?text=Resolution+Photo';
                          }}
                        />
                        <div style={styles.photoZoomOverlay}>Click to expand</div>
                      </div>
                    ) : (
                      <div style={styles.photoPlaceholder}>No resolution photo attached</div>
                    )}
                    <div style={styles.photoCaption}>
                      <strong>Officer Remarks:</strong> {item.OFFICER_REMARKS || 'Work completed per standards.'}
                    </div>
                  </div>

                  {/* Photo 3: Citizen Counter-Evidence (if disputed) */}
                  {isDisputed && (
                    <div style={{ ...styles.photoCard, borderColor: '#FCA5A5' }}>
                      <div style={styles.photoLabelBar}>
                        <span style={styles.photoTagRed}>3. Citizen Dispute Evidence</span>
                      </div>
                      {item.DISPUTE_PHOTO ? (
                        <div
                          style={styles.photoThumbWrap}
                          onClick={() => setLightboxImage({ url: item.DISPUTE_PHOTO, title: `Dispute Evidence: ${item.ISSUE_TITLE}` })}
                        >
                          <img
                            src={item.DISPUTE_PHOTO}
                            alt="Citizen Dispute Proof"
                            style={styles.photoThumb}
                            onError={(e) => {
                              e.target.src = 'https://placehold.co/400x300?text=Dispute+Evidence';
                            }}
                          />
                          <div style={styles.photoZoomOverlay}>Click to expand</div>
                        </div>
                      ) : (
                        <div style={styles.photoPlaceholder}>Written dispute (no photo attached)</div>
                      )}
                      <div style={styles.photoCaptionRed}>
                        <strong>Citizen Dispute Reason:</strong> {item.CITIZEN_REMARKS || 'Work is incomplete or defective.'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Citizen remarks banner for Confirmed or Disputed without photo */}
                {isConfirmed && item.CITIZEN_REMARKS && (
                  <div style={styles.citizenFeedbackBanner}>
                    <span style={{ fontWeight: 600, color: '#047857' }}>Citizen Feedback:</span> {item.CITIZEN_REMARKS}
                  </div>
                )}

                {/* Action Toolbar */}
                <div style={styles.cardActionsRow}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      type="button"
                      style={styles.auditBtn}
                      onClick={() => handleOpenAudit(item)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>Audit Trail</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {/* Disputed Actions */}
                    {isDisputed && !isReopened && (
                      <>
                        <button
                          type="button"
                          style={styles.reworkBtn}
                          onClick={() => handleOpenRework(item)}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="1 4 1 10 7 10" />
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                          </svg>
                          <span>Reopen & Send for Rework</span>
                        </button>

                        <button
                          type="button"
                          style={styles.approveBtn}
                          onClick={() => handleOpenApprove(item)}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Overrule Dispute & Close</span>
                        </button>
                      </>
                    )}

                    {isReopened && (
                      <span style={styles.reopenedInfoNotice}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        Reopened by Supervisor • In Progress in Issue Log
                      </span>
                    )}

                    {/* Pending Verification Actions */}
                    {isPending && (
                      <>
                        <button
                          type="button"
                          style={styles.reworkSecondaryBtn}
                          onClick={() => handleOpenRework(item)}
                          title="Reject resolution proof and send back for rework"
                        >
                          Reject Proof
                        </button>
                        <button
                          type="button"
                          style={styles.approveBtn}
                          onClick={() => handleOpenApprove(item)}
                          title="Verify resolution and close ticket now"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Approve & Finalize Closure</span>
                        </button>
                      </>
                    )}

                    {/* Settled Item Info */}
                    {(isConfirmed || isAutoClosed) && (
                      <span style={styles.settledBadge}>
                        Ticket Finalized: {item.CLOSURE_TYPE || (isAutoClosed ? 'Auto Closed' : 'Confirmed')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rework Modal */}
      {activeModal === 'rework' && selectedItem && (
        <div style={modalStyles.backdrop} onClick={() => setActiveModal(null)}>
          <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={modalStyles.reworkIconBadge}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                </span>
                <h3 style={modalStyles.title}>Reopen for Rework</h3>
              </div>
              <button style={modalStyles.closeBtn} onClick={() => setActiveModal(null)}>✕</button>
            </div>

            <p style={modalStyles.sub}>
              This action transitions Issue <strong>#{selectedItem.ISSUE_ID}</strong> ({selectedItem.ISSUE_TITLE}) back to <strong>In Progress</strong> and resets the resolution window.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={modalStyles.label}>
                Assign Field Officer:
              </label>
              <select
                value={reassignOfficerId}
                onChange={(e) => setReassignOfficerId(e.target.value)}
                style={modalStyles.select}
              >
                <option value="">Keep current officer ({selectedItem.OFFICER_NAME || 'Assigned'})</option>
                {officers.map((o) => (
                  <option key={o.OFFICER_ID} value={String(o.OFFICER_ID)}>
                    {o.FULL_NAME} ({o.EMPLOYEE_ID}) - Ward {o.WARD_ID || 'General'}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={modalStyles.label}>
                Rework Instructions / Citizen Dispute Reason <span style={{ color: '#DC2626' }}>*</span>:
              </label>
              <textarea
                rows={4}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Explain what work needs to be completed or corrected..."
                style={modalStyles.textarea}
              />
            </div>

            <div style={modalStyles.footer}>
              <button
                type="button"
                style={modalStyles.cancelBtn}
                onClick={() => setActiveModal(null)}
                disabled={submittingAction}
              >
                Cancel
              </button>
              <button
                type="button"
                style={modalStyles.confirmReworkBtn}
                onClick={handleConfirmRework}
                disabled={submittingAction}
              >
                {submittingAction ? 'Reopening...' : 'Confirm Rework Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {activeModal === 'approve' && selectedItem && (
        <div style={modalStyles.backdrop} onClick={() => setActiveModal(null)}>
          <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={modalStyles.approveIconBadge}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <h3 style={modalStyles.title}>
                  {selectedItem.RESPONSE === 'Disputed' ? 'Overrule Dispute & Close' : 'Approve & Close Ticket'}
                </h3>
              </div>
              <button style={modalStyles.closeBtn} onClick={() => setActiveModal(null)}>✕</button>
            </div>

            <p style={modalStyles.sub}>
              Are you sure you want to finalize Issue <strong>#{selectedItem.ISSUE_ID}</strong>? The issue status will be set to <strong>Closed</strong>.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={modalStyles.label}>Supervisor Audit Notes:</label>
              <textarea
                rows={3}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Optional supervisor approval comment..."
                style={modalStyles.textarea}
              />
            </div>

            <div style={modalStyles.footer}>
              <button
                type="button"
                style={modalStyles.cancelBtn}
                onClick={() => setActiveModal(null)}
                disabled={submittingAction}
              >
                Cancel
              </button>
              <button
                type="button"
                style={modalStyles.confirmApproveBtn}
                onClick={handleConfirmApprove}
                disabled={submittingAction}
              >
                {submittingAction ? 'Processing...' : 'Confirm Closure'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Modal */}
      {activeModal === 'audit' && selectedItem && (
        <div style={modalStyles.backdrop} onClick={() => setActiveModal(null)}>
          <div style={{ ...modalStyles.modal, maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <div>
                <h3 style={modalStyles.title}>Audit Trail: ISS-{String(selectedItem.ISSUE_ID).padStart(5, '0')}</h3>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                  {selectedItem.ISSUE_TITLE}
                </p>
              </div>
              <button style={modalStyles.closeBtn} onClick={() => setActiveModal(null)}>✕</button>
            </div>

            <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '10px 0' }}>
              {loadingAudit ? (
                <div style={{ textAlign: 'center', padding: '30px' }}>
                  <div style={styles.spinner} />
                  <p style={{ color: '#64748B', fontSize: '13px', marginTop: '10px' }}>Loading chronological events...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                  No recorded audit log events found for this issue.
                </div>
              ) : (
                <div style={timelineStyles.container}>
                  {auditLogs.map((log, idx) => {
                    const oldState = typeof log.OLD_STATE === 'string' ? (() => { try { return JSON.parse(log.OLD_STATE); } catch { return {}; } })() : (log.OLD_STATE || {});
                    const newState = typeof log.NEW_STATE === 'string' ? (() => { try { return JSON.parse(log.NEW_STATE); } catch { return {}; } })() : (log.NEW_STATE || {});
                    const details = typeof log.DETAILS === 'string' ? (() => { try { return JSON.parse(log.DETAILS); } catch { return {}; } })() : (log.DETAILS || {});

                    const isStatus = log.ACTION === 'STATUS_CHANGED';
                    const isReopened = isStatus && oldState.status === 'Disputed' && newState.status === 'In Progress';
                    const isDisputed = log.ACTION === 'VERIFICATION_DISPUTED' || (isStatus && newState.status === 'Disputed');
                    const isProof = log.ACTION === 'PROOF_SUBMITTED' || log.ACTION === 'RESOLUTION_CONFIRMED';
                    const isCreated = log.ACTION === 'ISSUE_CREATED';

                    const actionTitle = isReopened
                      ? 'Issue Reopened for Rework (Dispute Verified)'
                      : isDisputed
                        ? 'Citizen Disputed Resolution Proof'
                        : isCreated
                          ? 'Citizen Report Submitted'
                          : isStatus
                            ? `Status Changed: ${oldState.status || ''} → ${newState.status || ''}`
                            : isProof
                              ? 'Submitted Resolution Proof'
                              : log.ACTION
                                ? log.ACTION.replace(/_/g, ' ')
                                : 'System Event';

                    const noteText = details.note || details.notes || details.remarks || details.reason || null;
                    const performerName = log.PERFORMED_BY_NAME ? `${log.PERFORMED_BY_NAME} (${log.PERFORMED_BY_TYPE})` : (log.PERFORMED_BY_TYPE || 'System');
                    const dotColor = isReopened ? '#EA580C' : isDisputed ? '#DC2626' : isProof ? '#059669' : '#2563EB';

                    return (
                      <div key={log.LOG_ID || idx} style={timelineStyles.item}>
                        <div style={{ ...timelineStyles.dot, backgroundColor: dotColor }} />
                        <div style={timelineStyles.content}>
                          <div style={{ ...timelineStyles.actionName, color: isReopened ? '#C2410C' : isDisputed ? '#B91C1C' : '#0F172A' }}>
                            {actionTitle}
                          </div>
                          <div style={timelineStyles.meta}>
                            Performed by <strong>{performerName}</strong> • {new Date(log.CREATED_AT).toLocaleString()}
                          </div>
                          {noteText && (
                            <div style={{
                              ...timelineStyles.noteBox,
                              backgroundColor: isReopened ? '#FFF7ED' : isDisputed ? '#FEF2F2' : '#F8FAFC',
                              borderColor: isReopened ? '#FDBA74' : isDisputed ? '#FCA5A5' : '#E2E8F0',
                              color: isReopened ? '#9A3412' : isDisputed ? '#991B1B' : '#334155',
                            }}>
                              {noteText}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ textAlign: 'right', marginTop: '16px' }}>
              <button style={modalStyles.cancelBtn} onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div style={modalStyles.backdrop} onClick={() => setLightboxImage(null)}>
          <div style={lightboxStyles.container} onClick={(e) => e.stopPropagation()}>
            <div style={lightboxStyles.header}>
              <span style={lightboxStyles.title}>{lightboxImage.title}</span>
              <button style={modalStyles.closeBtn} onClick={() => setLightboxImage(null)}>✕</button>
            </div>
            <img src={lightboxImage.url} alt="Full resolution view" style={lightboxStyles.image} />
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
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
  refreshBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#334155',
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
    transition: 'all 0.15s ease',
  },
  metricLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  metricLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#475569',
  },
  metricIconBadgeAmber: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#B45309',
    background: '#FEF3C7',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  metricIconBadgeRed: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#B91C1C',
    background: '#FEE2E2',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  metricIconBadgeGreen: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#047857',
    background: '#D1FAE5',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  metricIconBadgeSlate: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#475569',
    background: '#F1F5F9',
    padding: '2px 6px',
    borderRadius: '4px',
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
    gap: '16px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '10px 14px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  tabGroup: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  tabBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid transparent',
    background: 'transparent',
    fontSize: '13px',
    fontWeight: 600,
    color: '#64748B',
    cursor: 'pointer',
    position: 'relative',
  },
  tabBtnActive: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #CBD5E1',
    background: '#0F172A',
    fontSize: '13px',
    fontWeight: 600,
    color: '#FFFFFF',
    cursor: 'pointer',
  },
  tabBtnActiveRed: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #FCA5A5',
    background: '#DC2626',
    fontSize: '13px',
    fontWeight: 600,
    color: '#FFFFFF',
    cursor: 'pointer',
    position: 'relative',
  },
  tabBtnActiveAmber: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #FCD34D',
    background: '#D97706',
    fontSize: '13px',
    fontWeight: 600,
    color: '#FFFFFF',
    cursor: 'pointer',
  },
  tabBtnActiveGreen: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #6EE7B7',
    background: '#059669',
    fontSize: '13px',
    fontWeight: 600,
    color: '#FFFFFF',
    cursor: 'pointer',
  },
  disputeDot: {
    position: 'absolute',
    top: '3px',
    right: '3px',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#EF4444',
  },
  filterControls: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    background: '#F8FAFC',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    padding: '0 8px',
  },
  searchInput: {
    border: 'none',
    background: 'transparent',
    padding: '7px 8px',
    fontSize: '13px',
    color: '#0F172A',
    outline: 'none',
    width: '210px',
  },
  clearSearchBtn: {
    border: 'none',
    background: 'transparent',
    color: '#94A3B8',
    cursor: 'pointer',
    fontSize: '12px',
  },
  selectInput: {
    padding: '7px 10px',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    background: '#FFFFFF',
    fontSize: '13px',
    color: '#334155',
    outline: 'none',
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    padding: '20px',
    transition: 'all 0.15s ease',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    flexWrap: 'wrap',
    gap: '10px',
  },
  issueIdBadge: {
    fontFamily: 'monospace',
    fontWeight: 700,
    fontSize: '12px',
    background: '#0F172A',
    color: '#FFFFFF',
    padding: '3px 7px',
    borderRadius: '4px',
  },
  categoryBadge: {
    fontSize: '11px',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '12px',
    letterSpacing: '0.02em',
  },
  emergencyBadge: {
    fontSize: '11px',
    fontWeight: 800,
    background: '#FEE2E2',
    color: '#DC2626',
    border: '1px solid #FCA5A5',
    padding: '2px 7px',
    borderRadius: '4px',
  },
  wardBadge: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#475569',
    background: '#F1F5F9',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  disputedStatusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#B91C1C',
    background: '#FEE2E2',
    border: '1px solid #FCA5A5',
    padding: '4px 10px',
    borderRadius: '16px',
  },
  pendingStatusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#92400E',
    background: '#FEF3C7',
    border: '1px solid #FCD34D',
    padding: '4px 10px',
    borderRadius: '16px',
  },
  confirmedStatusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#065F46',
    background: '#D1FAE5',
    border: '1px solid #6EE7B7',
    padding: '4px 10px',
    borderRadius: '16px',
  },
  autoClosedStatusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#334155',
    background: '#E2E8F0',
    border: '1px solid #CBD5E1',
    padding: '4px 10px',
    borderRadius: '16px',
  },
  reopenedStatusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#C2410C',
    background: '#FFF7ED',
    border: '1px solid #FDBA74',
    padding: '4px 10px',
    borderRadius: '16px',
  },
  reopenedInfoNotice: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#2563EB',
    background: '#EFF6FF',
    border: '1px solid #BFDBFE',
    padding: '6px 12px',
    borderRadius: '6px',
  },
  issueTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 6px',
  },
  issueDesc: {
    fontSize: '13px',
    color: '#475569',
    lineHeight: 1.5,
    margin: '0 0 16px',
  },
  stakeholdersRow: {
    display: 'flex',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '18px',
    gap: '16px',
    flexWrap: 'wrap',
  },
  stakeholderCol: {
    flex: '1 1 200px',
    display: 'flex',
    flexDirection: 'column',
  },
  stakeholderDivider: {
    width: '1px',
    background: '#E2E8F0',
  },
  stakeholderLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '2px',
  },
  stakeholderValue: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#0F172A',
  },
  stakeholderSub: {
    fontSize: '12px',
    color: '#64748B',
  },
  photoGallery: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '14px',
    marginBottom: '16px',
  },
  photoCard: {
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    overflow: 'hidden',
    background: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
  },
  photoLabelBar: {
    padding: '8px 10px',
    borderBottom: '1px solid #F1F5F9',
    background: '#FAFBFD',
  },
  photoTagBlue: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#1D4ED8',
    background: '#DBEAFE',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  photoTagGreen: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#047857',
    background: '#D1FAE5',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  photoTagRed: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#B91C1C',
    background: '#FEE2E2',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  photoThumbWrap: {
    position: 'relative',
    height: '180px',
    cursor: 'pointer',
    overflow: 'hidden',
    background: '#0F172A',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  photoZoomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '6px',
    background: 'rgba(15, 23, 42, 0.75)',
    color: '#FFFFFF',
    fontSize: '11px',
    fontWeight: 600,
    textAlign: 'center',
  },
  photoPlaceholder: {
    height: '180px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F8FAFC',
    color: '#94A3B8',
    fontSize: '12px',
    padding: '16px',
    textAlign: 'center',
  },
  photoCaption: {
    padding: '10px',
    fontSize: '12px',
    color: '#334155',
    background: '#FFFFFF',
    borderTop: '1px solid #F1F5F9',
    lineHeight: 1.4,
  },
  photoCaptionRed: {
    padding: '10px',
    fontSize: '12px',
    color: '#7F1D1D',
    background: '#FEF2F2',
    borderTop: '1px solid #FEE2E2',
    lineHeight: 1.4,
  },
  citizenFeedbackBanner: {
    background: '#ECFDF5',
    border: '1px solid #A7F3D0',
    borderRadius: '6px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#065F46',
    marginBottom: '16px',
  },
  cardActionsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid #F1F5F9',
    paddingTop: '16px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  auditBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: '#F1F5F9',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
  },
  reworkBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: '#DC2626',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#FFFFFF',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)',
  },
  reworkSecondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: '#FFFFFF',
    border: '1px solid #DC2626',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#DC2626',
    cursor: 'pointer',
  },
  approveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: '#059669',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#FFFFFF',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(5, 150, 105, 0.2)',
  },
  settledBadge: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#475569',
    background: '#F1F5F9',
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #E2E8F0',
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

// Modal & Lightbox Styles
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
    maxWidth: '520px',
    padding: '24px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
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
    margin: '0 0 16px',
  },
  reworkIconBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#FEE2E2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveIconBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#D1FAE5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#334155',
    marginBottom: '6px',
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
  },
  textarea: {
    width: '100%',
    padding: '10px',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#0F172A',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
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
  confirmReworkBtn: {
    padding: '8px 16px',
    background: '#DC2626',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#FFFFFF',
    cursor: 'pointer',
  },
  confirmApproveBtn: {
    padding: '8px 16px',
    background: '#059669',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#FFFFFF',
    cursor: 'pointer',
  },
};

const timelineStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    paddingLeft: '24px',
    borderLeft: '2px solid #E2E8F0',
    marginLeft: '12px',
    gap: '20px',
  },
  item: {
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    left: '-31px',
    top: '3px',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#0284C7',
    border: '2px solid #FFFFFF',
    boxShadow: '0 0 0 2px #BAE6FD',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
  },
  actionName: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#0F172A',
  },
  meta: {
    fontSize: '12px',
    color: '#64748B',
    marginTop: '2px',
  },
  noteBox: {
    marginTop: '6px',
    padding: '8px 10px',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#334155',
    lineHeight: 1.4,
  },
};

const lightboxStyles = {
  container: {
    maxWidth: '90vw',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#0F172A',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  header: {
    padding: '12px 16px',
    background: 'rgba(15, 23, 42, 0.9)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 600,
  },
  image: {
    maxWidth: '90vw',
    maxHeight: '80vh',
    objectFit: 'contain',
  },
};
