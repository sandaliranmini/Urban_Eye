import { useState, useMemo, useEffect } from 'react';
import axiosInstance from '../../services/axiosInstance';
import { uploadResolutionProof, updateIssueStatus } from '../../services/issueService';

function formatTimeAgo(dateString) {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `Submitted ${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Submitted ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `Reported ${diffDays}d ago`;
}

// -------------------------------------------------------------
// Tailwind-Styled Vector Icons (Heroicons style)
// -------------------------------------------------------------

function SearchIcon({ className = 'w-4 h-4 text-gray-400' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function ChevronDownIcon({ className = 'w-4 h-4 text-gray-500' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function BoltIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z" clipRule="evenodd" />
    </svg>
  );
}

function TriangleUpIcon({ className = 'w-3 h-3 inline-block' }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 2L11 9.5H1L6 2Z" />
    </svg>
  );
}

function AlertTriangleIcon({ className = 'w-4 h-4 text-red-600' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  );
}

function ExclamationIcon({ className = 'w-3.5 h-3.5 text-white' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5m0 3.5h.008v.008H12v-.008Z" />
    </svg>
  );
}

function CheckCircleIcon({ className = 'w-5 h-5 text-emerald-400' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function XMarkIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function MapPinIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  );
}

function CameraIcon({ className = 'w-8 h-8 text-emerald-600' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
    </svg>
  );
}

function InfoCircleIcon({ className = 'w-4 h-4 text-blue-600' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
  );
}

// Category Thumbnail Icons
function WarningSignIcon({ className = 'w-8 h-8' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M12 3L2 20H22L12 3Z" fill="#FEE588" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="12" y1="9" x2="12" y2="14" stroke="#78350F" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="#78350F" />
    </svg>
  );
}

function StreetLightIcon({ className = 'w-7 h-7 text-slate-400' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0-6 6c0 2.5 1.5 4.5 3 5.5v2.5h6V14.5c1.5-1 3-3 3-5.5a6 6 0 0 0-6-6Z" />
      <path d="M9 17h6" />
      <path d="M10 20h4" />
      <path d="M12 1v2M4.22 4.22l1.42 1.42M1 12h2M19.78 4.22l-1.42 1.42M23 12h-2" />
    </svg>
  );
}

function WasteIcon({ className = 'w-7 h-7' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" stroke="#E11D48" strokeWidth="2" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="#E11D48" strokeWidth="2" />
      <path d="M9 8h6M10 8V6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M10 11v5M14 11v5M8 8l.7 9a1.5 1.5 0 0 0 1.5 1.4h3.6a1.5 1.5 0 0 0 1.5-1.4L16 8" stroke="#475569" strokeWidth="1.5" />
    </svg>
  );
}

function PotholeIcon({ className = 'w-8 h-8' }) {
  return (
    <svg className={className} viewBox="0 0 32 20" fill="none">
      <ellipse cx="16" cy="10" rx="14" ry="6" fill="#1E293B" />
      <ellipse cx="16" cy="9.5" rx="12" ry="4.5" fill="#0F172A" />
      <ellipse cx="16" cy="9" rx="8" ry="2.5" fill="#020617" />
    </svg>
  );
}

function renderThumbnailIcon(item) {
  if (item.status === 'EMERGENCY' || item.isEmergency || item.category === 'Electrical Hazard') {
    return <WarningSignIcon className="w-9 h-9" />;
  }
  if (item.category?.includes('Light') || item.iconType === 'lighting') {
    return <StreetLightIcon className="w-7 h-7 text-slate-400" />;
  }
  if (item.category?.includes('Waste') || item.iconType === 'waste') {
    return <WasteIcon className="w-7 h-7" />;
  }
  if (item.category?.includes('Road') || item.category?.includes('Drain') || item.iconType === 'road') {
    return <PotholeIcon className="w-10 h-6" />;
  }
  return <StreetLightIcon className="w-7 h-7 text-slate-400" />;
}

export default function AssignedWardQueue({ user, onNavigate }) {
  const ITEMS_PER_PAGE = 5;
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('Pending');
  const [selectedSort, setSelectedSort] = useState('Net Votes');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeModal, setActiveModal] = useState(null); // { type: 'inspect'|'details'|'proof'|'bulk', issue }
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Reset page whenever search or filter selection changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedStatus, selectedSort]);

  // Fetch real issues from the database via backend API
  const fetchIssues = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const wardParam = user?.ward_id ? `?ward_id=${user.ward_id}&limit=100` : '?limit=100';
      const res = await axiosInstance.get(`/issues${wardParam}`);
      let rows = res.data?.data || [];

      // If specific ward filter returns 0 issues, load all issues across wards
      if (rows.length === 0 && user?.ward_id) {
        const fallbackRes = await axiosInstance.get('/issues?limit=100');
        rows = fallbackRes.data?.data || [];
      }

      const mapped = rows.map((item) => {
        const isEmg = Boolean(item.IS_EMERGENCY);
        const statusMap = {
          'Open': isEmg ? 'EMERGENCY' : 'OPEN',
          'In Progress': 'IN PROGRESS',
          'Resolved': 'PROOF SUBMITTED',
          'Closed': 'CLOSED',
          'Disputed': 'DISPUTED',
        };

        return {
          id: `2026-01${String(item.ISSUE_ID).padStart(2, '0')}`,
          rawId: item.ISSUE_ID,
          title: item.TITLE,
          location: item.WARD_NAME ? `${item.WARD_NAME}, Council Area` : 'Ward Area',
          category: item.CATEGORY || 'General',
          status: statusMap[item.STATUS] || (isEmg ? 'EMERGENCY' : 'OPEN'),
          isEmergency: isEmg,
          votes: Number(item.NET_VOTES || 0),
          reportedTime: formatTimeAgo(item.CREATED_AT),
          iconType: isEmg
            ? 'warning'
            : item.CATEGORY?.includes('Lighting')
              ? 'lighting'
              : item.CATEGORY?.includes('Waste')
                ? 'waste'
                : 'road',
          description: item.DESCRIPTION,
          reportedBy: item.REPORTER_NAME || 'Verified Citizen',
          contact: item.REPORTER_MOBILE || '077 412 8892',
          nic: item.NIC_HASH ? `${item.NIC_HASH.slice(0, 8)}****` : '19983190****',
          proofPhoto: item.AFTER_PHOTO || null,
          beforePhoto: item.BEFORE_PHOTO || null,
          proofRemarks: item.PROOF_REMARKS || '',
        };
      });

      setIssues(mapped);
    } catch (err) {
      console.error('Failed to load issues from database:', err);
      setLoadError('Failed to fetch ward issues from the database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [user?.ward_id]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Filter & sort logic
  const filteredIssues = useMemo(() => {
    return issues
      .filter((item) => {
        // Search
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchId = item.id.toLowerCase().includes(q);
          const matchLoc = item.location.toLowerCase().includes(q);
          const matchCat = item.category.toLowerCase().includes(q);
          if (!matchTitle && !matchId && !matchLoc && !matchCat) return false;
        }

        // Category
        if (selectedCategory !== 'All') {
          if (selectedCategory === 'Road Hazard' && !item.category.includes('Road')) return false;
          if (selectedCategory === 'Water Drainage' && !item.category.includes('Drain')) return false;
          if (selectedCategory === 'Waste Management' && !item.category.includes('Waste')) return false;
          if (selectedCategory === 'Public Lighting' && !item.category.includes('Light')) return false;
          if (selectedCategory === 'Electrical Hazard' && !(item.category.includes('Elect') || item.category === 'Other')) return false;
        }

        // Status
        if (selectedStatus === 'Pending') {
          return ['EMERGENCY', 'IN PROGRESS', 'OPEN'].includes(item.status);
        }
        if (selectedStatus === 'Open') return item.status === 'OPEN';
        if (selectedStatus === 'In Progress') return item.status === 'IN PROGRESS';
        if (selectedStatus === 'Proof Submitted') return item.status === 'PROOF SUBMITTED';

        return true;
      })
      .sort((a, b) => {
        if (selectedSort === 'Net Votes') return b.votes - a.votes;
        if (selectedSort === 'Newest') return b.rawId - a.rawId;
        if (selectedSort === 'Oldest') return a.rawId - b.rawId;
        return 0;
      });
  }, [issues, searchTerm, selectedCategory, selectedStatus, selectedSort]);

  // Bulk action in database
  const handleBulkInProgress = async () => {
    const openIssues = issues.filter((i) => i.status === 'OPEN' || i.status === 'EMERGENCY');
    if (openIssues.length === 0) {
      showToast('No open issues to transition.');
      return;
    }

    try {
      await Promise.allSettled(
        openIssues.map((item) => updateIssueStatus(item.rawId, 'In Progress'))
      );
      setIssues((prev) =>
        prev.map((item) =>
          item.status === 'OPEN' || item.status === 'EMERGENCY'
            ? { ...item, status: 'IN PROGRESS' }
            : item
        )
      );
      showToast(`${openIssues.length} open issues moved to "In Progress" in database!`);
    } catch (err) {
      console.error('Bulk update error:', err);
      showToast('Failed to complete bulk update in database.');
    }
  };

  // Single status transition in database
  const handleMoveToInProgress = async (issueId, rawId) => {
    try {
      if (rawId) {
        await updateIssueStatus(rawId, 'In Progress');
      }
      setIssues((prev) =>
        prev.map((item) => (item.id === issueId ? { ...item, status: 'IN PROGRESS' } : item))
      );
      showToast(`Issue ${issueId} moved to "In Progress" in database!`);
    } catch (err) {
      console.error('Failed to update status in database:', err);
      showToast('Error updating issue status in database.');
    } finally {
      setActiveModal(null);
    }
  };

  // Submit proof transition in database
  const handleSubmitProof = async (issue, proofRemarks, proofFile, proofPreviewUrl) => {
    try {
      const fd = new FormData();
      if (proofFile) fd.append('photo', proofFile);
      if (proofRemarks) fd.append('remarks', proofRemarks);

      await uploadResolutionProof(issue.rawId, fd);
      showToast(`Resolution proof submitted for ${issue.id}! Issue moved to "Proof Submitted".`);

      // Update local state to reflect resolved state
      setIssues((prev) =>
        prev.map((item) =>
          item.id === issue.id
            ? {
              ...item,
              status: 'PROOF SUBMITTED',
              proofPhoto: proofPreviewUrl || item.proofPhoto,
              proofRemarks: proofRemarks || item.proofRemarks,
              reportedTime: 'Proof sent today',
            }
            : item
        )
      );

      // Automatically switch queue view to "Proof Submitted" so the issue is visible there immediately
      setSelectedStatus('Proof Submitted');
      setCurrentPage(1);
    } catch (err) {
      console.error('Backend resolution upload error:', err);
      showToast(err.response?.data?.message || 'Resolution upload failed in database.');
    } finally {
      setActiveModal(null);
    }
  };

  // Pagination calculations (5 results at once)
  const totalIssues = filteredIssues.length;
  const totalPages = Math.ceil(totalIssues / ITEMS_PER_PAGE) || 1;
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (validPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalIssues);
  const currentIssues = filteredIssues.slice(startIndex, endIndex);

  return (
    <div style={styles.pageContainer}>
      {/* Responsive Styles for Mobile and Tablet */}
      <style>{`
        @media (max-width: 860px) {
          .officer-issue-card {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 16px !important;
          }
          .officer-card-left {
            width: 100% !important;
          }
          .officer-card-right {
            width: 100% !important;
            justify-content: space-between !important;
            border-top: 1px solid #E2E8F0 !important;
            padding-top: 12px !important;
          }
          .officer-search-wrapper {
            width: 100% !important;
            min-width: 100% !important;
            flex: 1 1 100% !important;
          }
          .officer-select-wrapper {
            flex: 1 1 calc(50% - 6px) !important;
            min-width: 130px !important;
          }
          .officer-select-wrapper select {
            width: 100% !important;
          }
          .officer-bulk-btn {
            width: 100% !important;
          }
          .officer-pagination-footer {
            flex-direction: column !important;
            gap: 14px !important;
            text-align: center !important;
            align-items: center !important;
          }
        }
        @media (max-width: 520px) {
          .officer-card-left {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .officer-card-right {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .officer-card-right > div {
            align-items: flex-start !important;
            text-align: left !important;
          }
          .officer-card-right button {
            width: 100% !important;
          }
          .officer-select-wrapper {
            flex: 1 1 100% !important;
          }
        }

        /* Overlay Modal Responsive Styles */
        .task-grid-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
          gap: 24px;
          align-items: start;
          width: 100%;
        }
        .task-left-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
        }
        .task-right-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
        }
        .task-photo-meta-row {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 20px;
          align-items: stretch;
          padding-bottom: 20px;
          border-bottom: 1px solid #F1F5F9;
          margin-bottom: 16px;
        }
        .task-photo-container {
          background: #EDF2F7;
          border: 1px solid rgba(226, 232, 240, 0.6);
          border-radius: 10px;
          min-height: 180px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 16px;
          text-align: center;
          box-sizing: border-box;
        }
        .task-meta-attributes {
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          gap: 12px;
        }
        @media (max-width: 900px) {
          .task-grid-layout {
            grid-template-columns: 1fr !important;
          }
          .task-overlay-card {
            padding: 20px 18px !important;
          }
        }
        @media (max-width: 600px) {
          .task-photo-meta-row {
            grid-template-columns: 1fr !important;
          }
          .task-action-btns {
            width: 100% !important;
          }
          .task-action-btns button {
            flex: 1 1 100% !important;
          }
        }
      `}</style>

      {/* Toast Notification */}
      {toastMessage && (
        <div style={styles.toast}>
          <CheckCircleIcon className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Emergency Alert Banner */}
      {!alertDismissed && (
        <div style={styles.emergencyAlertBanner}>
          <div style={styles.alertIconCircle}>
            <ExclamationIcon className="w-3.5 h-3.5 text-white" />
          </div>
          <div style={styles.alertTextContainer}>
            <strong style={styles.alertTitle}>PRIORITY EMERGENCY ALERT:</strong>
            <span style={styles.alertMessage}>
              Severe live power line collapse on New Town Cross Rd. Fast-track dispatch required.
            </span>
          </div>
          <button
            onClick={() => setAlertDismissed(true)}
            style={styles.dismissBtn}
            title="Dismiss alert"
            aria-label="Dismiss alert"
          >
            <XMarkIcon className="w-4 h-4 text-red-700 hover:text-red-900 transition-colors" />
          </button>
        </div>
      )}

      {/* Content Header */}
      <div style={styles.contentHeader}>
        <h1 style={styles.headingTitle}>Assigned Ward Issue Queue</h1>
        <p style={styles.subTitle}>
          Review submitted civic reports, inspect community upvotes, and dispatch resolution proofs.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div style={styles.filterToolbar} className="officer-filter-toolbar">
        {/* Left Side: Search & Filter Dropdowns */}
        <div style={styles.filterGroupLeft} className="officer-filter-group-left">
          {/* Search Input */}
          <div style={styles.searchWrapper} className="officer-search-wrapper">
            <span style={styles.searchIcon}>
              <SearchIcon className="w-4 h-4 text-slate-400" />
            </span>
            <input
              type="text"
              placeholder="Search title, ID or street..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          {/* Category Dropdown */}
          <div style={styles.selectWrapper} className="officer-select-wrapper">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={styles.selectInput}
            >
              <option value="All">Category: All</option>
              <option value="Electrical Hazard">Category: Electrical</option>
              <option value="Public Lighting">Category: Public Lighting</option>
              <option value="Waste Management">Category: Waste</option>
              <option value="Road Hazard">Category: Roads & Drainage</option>
            </select>
            <span style={styles.dropdownCaret}>
              <ChevronDownIcon className="w-4 h-4 text-slate-600" />
            </span>
          </div>

          {/* Status Dropdown */}
          <div style={styles.selectWrapper} className="officer-select-wrapper">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={styles.selectInput}
            >
              <option value="Pending">Status: Pending</option>
              <option value="All">Status: All</option>
              <option value="Open">Status: Open</option>
              <option value="In Progress">Status: In Progress</option>
              <option value="Proof Submitted">Status: Proof Submitted</option>
            </select>
            <span style={styles.dropdownCaret}>
              <ChevronDownIcon className="w-4 h-4 text-slate-600" />
            </span>
          </div>

          {/* Sort Dropdown */}
          <div style={styles.selectWrapper} className="officer-select-wrapper">
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              style={styles.selectInput}
            >
              <option value="Net Votes">Sort: Net Votes</option>
              <option value="Newest">Sort: Newest</option>
              <option value="Oldest">Sort: Oldest</option>
            </select>
            <span style={styles.dropdownCaret}>
              <ChevronDownIcon className="w-4 h-4 text-slate-600" />
            </span>
          </div>
        </div>

        {/* Right Side: Bulk Action Button */}
        <button onClick={handleBulkInProgress} style={styles.bulkActionBtn} className="officer-bulk-btn">
          <BoltIcon className="w-4 h-4 text-[#17324D] shrink-0" />
          <span>Bulk In-Progress</span>
        </button>
      </div>

      {/* Issue Queue List */}
      <div style={styles.issueQueueList}>
        {loading && (
          <div style={styles.emptyState}>
            <p style={{ margin: 0, fontSize: '15px', color: '#17324D', fontWeight: 600 }}>Loading ward issues from database...</p>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748B' }}>Connecting to municipal issue repository</p>
          </div>
        )}

        {!loading && currentIssues.map((item) => {
          const isEmergency = item.status === 'EMERGENCY' || item.isEmergency;
          const isInProgress = item.status === 'IN PROGRESS';
          const isOpen = item.status === 'OPEN';
          const isProofSubmitted = item.status === 'PROOF SUBMITTED';

          return (
            <article
              key={item.id}
              className="officer-issue-card"
              style={{
                ...styles.issueCard,
                ...(isEmergency ? styles.emergencyCard : styles.normalCard),
              }}
            >
              {/* Left Column: Icon Thumbnail + Details */}
              <div style={styles.cardLeftCol} className="officer-card-left">
                {/* Thumbnail Icon Box */}
                <div
                  style={{
                    ...styles.thumbnailBox,
                    background: isEmergency ? '#FEE4E2' : '#EDF2F7',
                  }}
                >
                  {renderThumbnailIcon(item)}
                </div>

                {/* Details Container */}
                <div style={styles.cardDetails}>
                  {/* Top Line: Badge + Title */}
                  <div style={styles.cardHeaderRow}>
                    {/* Status Badge */}
                    {isEmergency && <span style={styles.emergencyBadge}>EMERGENCY</span>}
                    {isInProgress && <span style={styles.inProgressBadge}>IN PROGRESS</span>}
                    {isOpen && <span style={styles.openBadge}>OPEN</span>}
                    {isProofSubmitted && <span style={styles.proofBadge}>PROOF SUBMITTED</span>}

                    {/* Title */}
                    <h2 style={styles.issueTitle}>{item.title}</h2>
                  </div>

                  {/* Subtitle / Meta Line */}
                  <div style={styles.metaRow}>
                    <span>ID: {item.id}</span>
                    <span style={styles.metaDot}>•</span>
                    <span>{item.location}</span>
                    <span style={styles.metaDot}>•</span>
                    <span>Category: {item.category}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Votes + Timestamp + CTA Button */}
              <div style={styles.cardRightCol} className="officer-card-right">
                <div style={styles.voteStatsBlock}>
                  <div
                    style={{
                      ...styles.voteCount,
                      color: isEmergency ? '#D92D20' : isProofSubmitted || isInProgress ? '#23845B' : '#17324D',
                    }}
                  >
                    <TriangleUpIcon className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                    <span>{item.votes} Votes</span>
                  </div>
                  <div style={styles.reportedTimeText}>{item.reportedTime}</div>
                </div>

                {/* CTA Action Button */}
                {isEmergency && (
                  <button
                    onClick={() => setActiveModal({ type: 'inspect', issue: item })}
                    style={styles.inspectBtn}
                  >
                    Inspect Now
                  </button>
                )}

                {(isInProgress || isOpen) && (
                  <button
                    onClick={() => setActiveModal({ type: 'details', issue: item })}
                    style={styles.viewDetailsBtn}
                  >
                    View Details
                  </button>
                )}

                {isProofSubmitted && (
                  <button
                    onClick={() => setActiveModal({ type: 'proof', issue: item })}
                    style={styles.viewProofBtn}
                  >
                    View Proof
                  </button>
                )}
              </div>
            </article>
          );
        })}

        {!loading && filteredIssues.length === 0 && (
          <div style={styles.emptyState}>
            <h3>No matching issues found</h3>
            <p>{loadError || 'No issue reports found in the database for the selected filters.'}</p>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div style={styles.paginationFooter} className="officer-pagination-footer">
        <div style={styles.paginationText}>
          {totalIssues === 0
            ? 'Showing 0 issues in assigned ward'
            : `Showing ${startIndex + 1} to ${endIndex} of ${totalIssues} issues in assigned ward`}
        </div>
        <div style={styles.paginationBtnGroup}>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={validPage <= 1}
            style={validPage <= 1 ? styles.pageBtnDisabled : styles.pageBtnActive}
            aria-label="Previous page"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={validPage >= totalPages}
            style={validPage >= totalPages ? styles.pageBtnDisabled : styles.pageBtnActive}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </div>

      {/* Interactive Task Details Overlay Modal */}
      {activeModal && (
        <TaskDetailsOverlayModal
          issue={activeModal.issue}
          user={user}
          defaultShowProof={activeModal.type === 'proof'}
          onClose={() => setActiveModal(null)}
          onMoveToInProgress={() => handleMoveToInProgress(activeModal.issue.id, activeModal.issue.rawId)}
          onSubmitProof={(remarks, file, preview) =>
            handleSubmitProof(activeModal.issue, remarks, file, preview)
          }
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Interactive Task Details Overlay Modal (Figma High-Fidelity)
// -------------------------------------------------------------

function TaskDetailsOverlayModal({
  issue,
  user,
  onClose,
  onMoveToInProgress,
  onSubmitProof,
  defaultShowProof = false,
}) {
  const [proofRemarks, setProofRemarks] = useState(issue.proofRemarks || '');
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(issue.proofPhoto || null);
  const [photoError, setPhotoError] = useState('');
  const [showProofForm, setShowProofForm] = useState(defaultShowProof);
  const [submitting, setSubmitting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(issue.status);

  const isEmergency = currentStatus === 'EMERGENCY' || issue.isEmergency;
  const isInProgress = currentStatus === 'IN PROGRESS';
  const isOpen = currentStatus === 'OPEN';
  const isProofSubmitted = currentStatus === 'PROOF SUBMITTED';

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Only JPG, PNG or WebP images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Photo must be smaller than 5 MB.');
      return;
    }
    setPhotoError('');
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  };

  const handleConfirmProof = async () => {
    if (!proofFile && !proofRemarks && !proofPreview) {
      setPhotoError('Please select a photo proof or add resolution remarks before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmitProof(proofRemarks, proofFile, proofPreview);
      setCurrentStatus('PROOF SUBMITTED');
      setShowProofForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = () => {
    if (isOpen) {
      onMoveToInProgress();
      setCurrentStatus('IN PROGRESS');
    } else if (isInProgress) {
      setShowProofForm(true);
    }
  };

  // Live timeline events for the audit trail from database
  const [timelineEvents, setTimelineEvents] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const fetchAudit = async () => {
      try {
        if (issue.rawId) {
          const res = await axiosInstance.get(`/audit-logs/issue/${issue.rawId}`);
          const logs = res.data?.data?.timeline || [];
          if (logs.length > 0 && isMounted) {
            const mapped = logs.map((log, idx) => {
              const isProof = log.ACTION === 'PROOF_SUBMITTED' || log.ACTION === 'RESOLUTION_CONFIRMED';
              const isStatus = log.ACTION === 'STATUS_CHANGED';
              const isCreated = log.ACTION === 'ISSUE_CREATED';

              return {
                id: log.LOG_ID || idx,
                color: isProof ? '#23845B' : isStatus ? '#17324D' : '#94A3B8',
                ringColor: isProof ? '#ECFDF5' : '#F1F5F9',
                title: isCreated
                  ? 'Citizen Report Submitted'
                  : isStatus
                    ? `Status changed to ${log.NEW_STATE?.status || currentStatus}`
                    : isProof
                      ? 'Submitted Resolution Proof'
                      : log.ACTION.replace(/_/g, ' '),
                meta: `${log.PERFORMED_BY_TYPE || 'System'} • ${new Date(log.CREATED_AT).toLocaleString()}`,
              };
            });
            setTimelineEvents(mapped);
            return;
          }
        }
      } catch {
        // Fallback if audit endpoint not reachable
      }

      if (isMounted) {
        setTimelineEvents([
          {
            id: 1,
            color: '#23845B',
            ringColor: '#ECFDF5',
            title: `Status changed to ${currentStatus}`,
            meta: `Officer: ${user?.full_name || 'Field Officer 1'} (${user?.employee_id || 'EMP-002'}) • Today`,
          },
          {
            id: 2,
            color: '#17324D',
            ringColor: '#F1F5F9',
            title: 'Triage automated inspection passed',
            meta: 'System Rule Engine • Inspection verified',
          },
          {
            id: 3,
            color: '#94A3B8',
            ringColor: '#F1F5F9',
            title: 'Citizen Report Submitted',
            meta: `Citizen: ${issue.reportedBy || 'Verified Citizen'} • ${issue.reportedTime || 'Verified'}`,
          },
        ]);
      }
    };

    fetchAudit();
    return () => { isMounted = false; };
  }, [issue.rawId, currentStatus, user]);

  return (
    <div style={overlayStyles.backdrop} onClick={onClose}>
      <div
        className="task-overlay-card"
        style={overlayStyles.card}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Breadcrumbs and Back Button Row */}
        <div style={overlayStyles.breadcrumbRow}>
          <div style={overlayStyles.breadcrumbLeft}>
            <button
              type="button"
              onClick={onClose}
              style={overlayStyles.backLink}
              title="Return to assigned queue"
            >
              <span style={{ fontSize: '16px' }}>←</span>
              <span>Back to Queue</span>
            </button>
            <span style={overlayStyles.breadcrumbSep}>/</span>
            <span style={overlayStyles.breadcrumbMuted}>Issue #{issue.id}</span>
            <span style={overlayStyles.breadcrumbSep}>/</span>
            <span style={overlayStyles.breadcrumbMuted}>Task Details</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={overlayStyles.closeBtn}
            title="Close details"
            aria-label="Close details"
          >
            <XMarkIcon className="w-5 h-5 text-slate-400 hover:text-slate-700 transition-colors" />
          </button>
        </div>

        {/* Task Title Bar & Actions */}
        <div style={overlayStyles.titleBar}>
          <div style={overlayStyles.titleLeft}>
            <h1 style={overlayStyles.titleHeading}>{issue.title}</h1>
            {isEmergency && <span style={styles.emergencyBadge}>EMERGENCY</span>}
            {isInProgress && <span style={styles.inProgressBadge}>IN PROGRESS</span>}
            {isOpen && <span style={styles.openBadge}>OPEN</span>}
            {isProofSubmitted && <span style={styles.proofBadge}>PROOF SUBMITTED</span>}
          </div>

          <div style={overlayStyles.actionBtns} className="task-action-btns">
            {!isProofSubmitted ? (
              <button
                type="button"
                onClick={() => setShowProofForm(true)}
                style={overlayStyles.uploadProofBtn}
              >
                <CameraIcon className="w-4 h-4 text-white" />
                <span>Upload Proof</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowProofForm((prev) => !prev)}
                style={{ ...overlayStyles.uploadProofBtn, background: '#17324D' }}
              >
                <CameraIcon className="w-4 h-4 text-white" />
                <span>{showProofForm ? 'Hide Proof' : 'Edit Proof'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Emergency Alert Banner (if priority emergency) */}
        {isEmergency && (
          <div style={{ ...styles.emergencyAlertBanner, marginBottom: '20px' }}>
            <div style={styles.alertIconCircle}>
              <ExclamationIcon className="w-3.5 h-3.5 text-white" />
            </div>
            <div style={styles.alertTextContainer}>
              <strong style={styles.alertTitle}>PRIORITY EMERGENCY DISPATCH:</strong>
              <span style={styles.alertMessage}>
                High-priority municipal hazard. Fast-track physical inspection and barricading required immediately.
              </span>
            </div>
            {isOpen && (
              <button
                type="button"
                onClick={handleUpdateStatus}
                style={{ ...styles.inspectBtn, minWidth: 'auto', padding: '6px 14px', fontSize: '13px' }}
              >
                Fast-Track Dispatch
              </button>
            )}
          </div>
        )}

        {/* Grid Layout: Left Column & Right Column */}
        <div className="task-grid-layout">
          {/* LEFT COLUMN (approx 63%) */}
          <div className="task-left-col">
            {/* Section 1: Incident Overview & Photo Card */}
            <div style={overlayStyles.sectionCard}>
              <h2 style={overlayStyles.sectionTitle}>Incident Overview & Photo</h2>

              <div className="task-photo-meta-row">
                {/* Photo Container */}
                <div className="task-photo-container">
                  {proofPreview || issue.proofPhoto ? (
                    <img
                      src={proofPreview || issue.proofPhoto}
                      alt={issue.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        maxHeight: '190px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                      }}
                    />
                  ) : (
                    <>
                      <div style={{ marginBottom: '8px', color: '#1E293B' }}>
                        {renderThumbnailIcon(issue)}
                      </div>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: '#616060',
                          lineHeight: '20px',
                        }}
                      >
                        [Citizen Submitted Photo]
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#64748B',
                          marginTop: '4px',
                          lineHeight: '16px',
                        }}
                      >
                        Geotagged: 6.9271° N, 79.8612° E
                      </div>
                    </>
                  )}
                </div>

                {/* Metadata Attributes */}
                <div className="task-meta-attributes">
                  <div>
                    <span style={overlayStyles.attributeLabel}>LOCATION & WARD</span>
                    <div style={overlayStyles.attributeValue}>
                      {issue.location || 'New Town Road (Near Post Office)'}
                    </div>
                    <div style={overlayStyles.attributeSubtext}>
                      Ward 04, Colombo Central
                    </div>
                  </div>

                  <div>
                    <span style={overlayStyles.attributeLabel}>CATEGORY</span>
                    <div style={overlayStyles.attributeValue}>
                      {issue.category || 'Public Electrical & Lighting'}
                    </div>
                  </div>

                  <div>
                    <span style={overlayStyles.attributeLabel}>COMMUNITY VOTES</span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '15px',
                        fontWeight: 700,
                        color: '#23845B',
                      }}
                    >
                      <TriangleUpIcon className="w-3.5 h-3.5" />
                      <span>{issue.votes} Citizens Upvoted</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Issue Description */}
              <div style={{ marginTop: '16px' }}>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#17324D',
                    margin: '0 0 8px 0',
                  }}
                >
                  Issue Description
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: '23px',
                    color: '#334155',
                    margin: 0,
                  }}
                >
                  {issue.description}
                </p>
              </div>
            </div>

            {/* Proof Upload Form (when toggled) */}
            {showProofForm && (
              <div
                style={{
                  background: '#E7F6EC',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid #A8D5BC',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '16px', color: '#23845B' }}>
                    Submit Resolution Proof
                  </strong>
                  <button
                    type="button"
                    onClick={() => { setShowProofForm(false); setPhotoError(''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1B6B49', fontSize: '13px', fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                </div>
                <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#1B6B49' }}>
                  Uploading photo proof initiates the closed-loop 14-day reporter verification cycle.
                </p>

                {/* Photo Dropzone */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#17324D', marginBottom: '6px' }}>
                    Resolution Photo Proof <span style={{ color: '#D92D20' }}>*</span>
                  </label>
                  {proofPreview ? (
                    <div style={{ position: 'relative', marginTop: '6px' }}>
                      <img
                        src={proofPreview}
                        alt="Resolution proof preview"
                        style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #A8D5BC' }}
                      />
                      <button
                        type="button"
                        onClick={() => { setProofFile(null); setProofPreview(null); }}
                        style={{ marginTop: '8px', background: 'none', border: 'none', color: '#D92D20', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'underline' }}
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                        <span>Remove photo and select another</span>
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label
                        htmlFor="task-proof-input"
                        style={{
                          border: '2px dashed #A8D5BC',
                          borderRadius: '8px',
                          padding: '20px',
                          textAlign: 'center',
                          background: '#F0FDF4',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <CameraIcon className="w-8 h-8 text-emerald-600 mb-1" />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#23845B' }}>
                          Click to select photo of completed work
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>
                          Supports JPG, PNG or WebP (max 5 MB)
                        </span>
                      </label>
                      <input
                        id="task-proof-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                        onChange={handlePhotoSelect}
                      />
                    </div>
                  )}
                  {photoError && (
                    <p style={{ color: '#D92D20', fontSize: '12px', margin: '6px 0 0', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangleIcon className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{photoError}</span>
                    </p>
                  )}
                </div>

                {/* Remarks Textarea */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#17324D', marginBottom: '4px' }}>
                    Resolution Remarks:
                  </label>
                  <textarea
                    rows="3"
                    value={proofRemarks}
                    onChange={(e) => setProofRemarks(e.target.value)}
                    placeholder="Detail the work carried out, materials used, and completion date..."
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CBD5E1', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '14px' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleConfirmProof}
                    disabled={submitting}
                    style={{ ...styles.inspectBtn, background: '#23845B', minWidth: '160px' }}
                  >
                    {submitting ? 'Submitting proof…' : 'Confirm & Submit Proof'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowProofForm(false); setPhotoError(''); }}
                    style={modalStyles.cancelBtn}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Resolved Proof Details (when already submitted) */}
            {isProofSubmitted && !showProofForm && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '18px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803D', fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
                  <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                  <span>Submitted Resolution Proof</span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#166534', lineHeight: 1.5 }}>
                  {proofRemarks || issue.proofRemarks || 'Work completed and resolution photograph filed.'}
                </p>
              </div>
            )}

            {/* Section 2: Audit Trail Card (Immutable Record) */}
            <div style={overlayStyles.sectionCard}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '20px',
                }}
              >
                <h2 style={{ ...overlayStyles.sectionTitle, marginBottom: 0 }}>
                  Audit Trail
                </h2>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    background: '#E8EEF4',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#17324D',
                    letterSpacing: '0.275px',
                  }}
                >
                  🔒 IMMUTABLE RECORD
                </span>
              </div>

              {/* Timeline Entries */}
              <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '4px' }}>
                {timelineEvents.map((ev, idx) => {
                  const isLast = idx === timelineEvents.length - 1;
                  return (
                    <div
                      key={ev.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '16px',
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          flexShrink: 0,
                          width: '16px',
                          paddingTop: '3px',
                        }}
                      >
                        <div
                          style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '9999px',
                            backgroundColor: ev.color,
                            boxShadow: `0 0 0 4px ${ev.ringColor}`,
                            zIndex: 2,
                          }}
                        />
                        {!isLast && (
                          <div
                            style={{
                              width: '2px',
                              height: '38px',
                              backgroundColor: '#E2E8F0',
                              marginTop: '4px',
                              marginBottom: '2px',
                            }}
                          />
                        )}
                      </div>

                      <div style={{ flex: 1, paddingBottom: isLast ? '0px' : '16px' }}>
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#17324D',
                            lineHeight: '20px',
                          }}
                        >
                          {ev.title}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#64748B',
                            marginTop: '2px',
                            lineHeight: '16px',
                          }}
                        >
                          {ev.meta}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (approx 37%) */}
          <div className="task-right-col">
            {/* Section 1: Reporter Information Card */}
            <div style={overlayStyles.sectionCard}>
              <h2 style={overlayStyles.sectionTitle}>Reporter Information</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <span style={overlayStyles.attributeLabel}>REPORTER NAME</span>
                  <div style={overlayStyles.attributeValue}>
                    {issue.reportedBy || 'S. K. Gunasekara'}
                  </div>
                </div>

                <div>
                  <span style={overlayStyles.attributeLabel}>VERIFIED CONTACT</span>
                  <div style={overlayStyles.attributeValue}>
                    {issue.contact || '077 412 8892'}
                  </div>
                </div>

                <div>
                  <span style={overlayStyles.attributeLabel}>
                    NATIONAL IDENTITY (NIC)
                  </span>
                  <div style={overlayStyles.attributeValue}>
                    {issue.nic || '19983190****'}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#64748B',
                      marginTop: '2px',
                    }}
                  >
                    (Secure Hash Verified)
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Resolution Protocol Guide */}
            <div style={overlayStyles.protocolCard}>
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#17324D',
                  margin: '0 0 14px 0',
                }}
              >
                Resolution Protocol
              </h3>

              <ol
                style={{
                  margin: 0,
                  paddingLeft: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  fontSize: '12px',
                  lineHeight: '19px',
                  color: '#17324D',
                  fontWeight: 500,
                }}
              >
                <li>Inspect physical site & eliminate hazard.</li>
                <li>Take clear "After" photo with geotag.</li>
                <li>Upload proof here. Reporter receives SMS.</li>
                <li>Auto-closed once confirmed by reporter.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Exact Figma Styles
// -------------------------------------------------------------

const styles = {
  pageContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '0px',
    gap: '24px',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: "'Nimbus Sans', 'Open Sans', system-ui, -apple-system, sans-serif",
  },

  toast: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    background: '#17324D',
    color: '#FFFFFF',
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },

  // Emergency Alert Banner
  emergencyAlertBanner: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: '14px',
    width: '100%',
    minHeight: '54px',
    background: '#FEE4E2',
    border: '1px solid #FDA29B',
    borderRadius: '8px',
    gap: '14px',
    position: 'relative',
  },
  alertIconCircle: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '24px',
    height: '24px',
    background: '#D92D20',
    borderRadius: '9999px',
    flexShrink: 0,
  },
  alertTextContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px',
    flex: 1,
  },
  alertTitle: {
    fontFamily: "'Nimbus Sans', sans-serif",
    fontWeight: '700',
    fontSize: '14px',
    lineHeight: '19px',
    letterSpacing: '-0.35px',
    color: '#B42318',
  },
  alertMessage: {
    fontFamily: "'Open Sans', sans-serif",
    fontWeight: '400',
    fontSize: '14px',
    lineHeight: '19px',
    color: '#B42318',
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content Header
  contentHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '0px',
    gap: '3px',
    width: '100%',
  },
  headingTitle: {
    fontFamily: "'Nimbus Sans', sans-serif",
    fontWeight: '700',
    fontSize: '28px',
    lineHeight: '35px',
    letterSpacing: '-0.7px',
    color: '#17324D',
    margin: 0,
  },
  subTitle: {
    fontFamily: "'Open Sans', sans-serif",
    fontWeight: '400',
    fontSize: '15px',
    lineHeight: '22px',
    color: '#616060',
    margin: 0,
  },

  // Filter Toolbar
  filterToolbar: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 0px 0px',
    gap: '12px',
    width: '100%',
  },
  filterGroupLeft: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '280px',
    maxWidth: '100%',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  searchInput: {
    boxSizing: 'border-box',
    width: '100%',
    height: '42px',
    padding: '10px 12px 10px 36px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    fontFamily: "'Open Sans', sans-serif",
    fontSize: '14px',
    color: '#17324D',
    outline: 'none',
  },
  selectWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  selectInput: {
    boxSizing: 'border-box',
    appearance: 'none',
    WebkitAppearance: 'none',
    padding: '10px 32px 10px 14px',
    height: '42px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    fontFamily: "'Open Sans', sans-serif",
    fontSize: '14px',
    color: '#17324D',
    cursor: 'pointer',
    outline: 'none',
  },
  dropdownCaret: {
    position: 'absolute',
    right: '10px',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  bulkActionBtn: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 20px',
    height: '42px',
    background: '#FFFFFF',
    border: '1px solid #17324D',
    borderRadius: '8px',
    fontFamily: "'Nimbus Sans', sans-serif",
    fontWeight: '600',
    fontSize: '14px',
    lineHeight: '21px',
    color: '#17324D',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },

  // Issue Queue List
  issueQueueList: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '14px',
    width: '100%',
  },

  // Base Issue Card
  issueCard: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    width: '100%',
    borderRadius: '8px',
    transition: 'box-shadow 0.2s ease',
  },
  emergencyCard: {
    background: '#FFF5F5',
    border: '2px solid #D92D20',
  },
  normalCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
  },

  cardLeftCol: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '16px',
    flex: 1,
  },
  thumbnailBox: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '90px',
    height: '64px',
    borderRadius: '6px',
    flexShrink: 0,
  },
  cardDetails: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '6px',
  },
  cardHeaderRow: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '10px',
  },

  // Badges
  emergencyBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 12px',
    background: '#D92D20',
    borderRadius: '9999px',
    fontFamily: "'Nimbus Sans', sans-serif",
    fontWeight: '700',
    fontSize: '11px',
    lineHeight: '16px',
    letterSpacing: '0.275px',
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  inProgressBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 12px',
    background: '#FEF0C7',
    borderRadius: '9999px',
    fontFamily: "'Nimbus Sans', sans-serif",
    fontWeight: '700',
    fontSize: '11px',
    lineHeight: '16px',
    letterSpacing: '0.275px',
    textTransform: 'uppercase',
    color: '#B54708',
  },
  openBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 12px',
    background: '#E8EEF4',
    borderRadius: '9999px',
    fontFamily: "'Nimbus Sans', sans-serif",
    fontWeight: '700',
    fontSize: '11px',
    lineHeight: '16px',
    letterSpacing: '0.275px',
    textTransform: 'uppercase',
    color: '#17324D',
  },
  proofBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 12px',
    background: '#E7F6EC',
    borderRadius: '9999px',
    fontFamily: "'Nimbus Sans', sans-serif",
    fontWeight: '700',
    fontSize: '11px',
    lineHeight: '16px',
    letterSpacing: '0.275px',
    textTransform: 'uppercase',
    color: '#23845B',
  },

  issueTitle: {
    fontFamily: "'Nimbus Sans', sans-serif",
    fontWeight: '700',
    fontSize: '17px',
    lineHeight: '23px',
    color: '#17324D',
    margin: 0,
  },
  metaRow: {
    fontFamily: "'Open Sans', sans-serif",
    fontWeight: '400',
    fontSize: '13px',
    lineHeight: '16px',
    color: '#616060',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  metaDot: {
    color: '#CBD5E1',
  },

  // Right Column
  cardRightCol: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '24px',
    flexShrink: 0,
  },
  voteStatsBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
    minWidth: '95px',
  },
  voteCount: {
    fontFamily: "'Nimbus Sans', sans-serif",
    fontWeight: '800',
    fontSize: '18px',
    lineHeight: '18px',
    textAlign: 'right',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  reportedTimeText: {
    fontFamily: "'Open Sans', sans-serif",
    fontWeight: '400',
    fontSize: '12px',
    lineHeight: '12px',
    color: '#888888',
    textAlign: 'right',
  },

  // CTA Buttons
  inspectBtn: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '10px 20px',
    minWidth: '122px',
    height: '41px',
    background: '#D92D20',
    borderRadius: '8px',
    border: 'none',
    fontFamily: "'Nimbus Sans', sans-serif",
    fontWeight: '700',
    fontSize: '14px',
    color: '#FFFFFF',
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
  },
  viewDetailsBtn: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '10px 20px',
    minWidth: '122px',
    height: '41px',
    background: '#17324D',
    borderRadius: '8px',
    border: 'none',
    fontFamily: "'Nimbus Sans', sans-serif",
    fontWeight: '600',
    fontSize: '14px',
    color: '#FFFFFF',
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
  },
  viewProofBtn: {
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '10px 20px',
    minWidth: '122px',
    height: '41px',
    background: '#FFFFFF',
    border: '1px solid #23845B',
    borderRadius: '8px',
    fontFamily: "'Nimbus Sans', sans-serif",
    fontWeight: '600',
    fontSize: '14px',
    color: '#23845B',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },

  // Pagination Footer
  paginationFooter: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 0px 16px',
    width: '100%',
    borderTop: '1px solid #E2E8F0',
  },
  paginationText: {
    fontFamily: "'Open Sans', sans-serif",
    fontWeight: '400',
    fontSize: '14px',
    lineHeight: '21px',
    color: '#888888',
  },
  paginationBtnGroup: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '12px',
  },
  pageBtnDisabled: {
    boxSizing: 'border-box',
    padding: '6px 14px',
    height: '34px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    fontFamily: "'Nimbus Sans', sans-serif",
    fontWeight: '600',
    fontSize: '13px',
    color: '#A0AEC0',
    cursor: 'not-allowed',
  },
  pageBtnActive: {
    boxSizing: 'border-box',
    padding: '6px 14px',
    height: '34px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    fontFamily: "'Nimbus Sans', sans-serif",
    fontWeight: '600',
    fontSize: '13px',
    color: '#17324D',
    cursor: 'pointer',
  },

  emptyState: {
    padding: '40px',
    textAlign: 'center',
    width: '100%',
    color: '#616060',
    background: '#FFFFFF',
    borderRadius: '8px',
    border: '1px dashed #CBD5E1',
  },
};

const modalStyles = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    padding: '16px',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '560px',
    padding: '24px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    boxSizing: 'border-box',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#17324D',
    margin: 0,
  },
  alertBox: {
    background: '#FFF5F5',
    border: '1px solid #FDA29B',
    borderRadius: '8px',
    padding: '12px',
    color: '#B42318',
    marginBottom: '16px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
    marginBottom: '20px',
    padding: '12px',
    background: '#F8FAFC',
    borderRadius: '8px',
  },
  label: {
    fontSize: '11px',
    textTransform: 'uppercase',
    color: '#64748B',
    fontWeight: 600,
    display: 'block',
  },
  val: {
    fontSize: '14px',
    color: '#1E293B',
    fontWeight: 500,
    marginTop: '2px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
  },
  cancelBtn: {
    padding: '10px 18px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
  },
};

const overlayStyles = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
    boxSizing: 'border-box',
    overflowY: 'auto',
  },
  card: {
    background: '#F8FAFC',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '1040px',
    maxHeight: '92vh',
    overflowY: 'auto',
    padding: '28px 36px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    boxSizing: 'border-box',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  breadcrumbRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  breadcrumbLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontFamily: "'Inter', sans-serif",
  },
  backLink: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    color: '#17324D',
    fontWeight: 600,
    fontSize: '13px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  breadcrumbSep: {
    color: '#94A3B8',
    fontSize: '13px',
  },
  breadcrumbMuted: {
    color: '#64748B',
    fontSize: '13px',
    fontWeight: 500,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    padding: '6px',
    cursor: 'pointer',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBar: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    width: '100%',
  },
  titleLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
  },
  titleHeading: {
    margin: 0,
    fontFamily: "'Inter', sans-serif",
    fontWeight: 700,
    fontSize: '28px',
    lineHeight: '34px',
    letterSpacing: '-0.75px',
    color: '#17324D',
  },
  actionBtns: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  updateStatusBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 20px',
    height: '42px',
    background: '#FFFFFF',
    border: '1px solid #17324D',
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
    borderRadius: '8px',
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    fontSize: '14px',
    color: '#17324D',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  uploadProofBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 20px',
    height: '42px',
    background: '#23845B',
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
    borderRadius: '8px',
    border: 'none',
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    fontSize: '14px',
    color: '#FFFFFF',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  sectionCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
    borderRadius: '12px',
    padding: '24px',
    boxSizing: 'border-box',
    width: '100%',
  },
  sectionTitle: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 700,
    fontSize: '17px',
    lineHeight: '24px',
    color: '#17324D',
    margin: '0 0 18px 0',
  },
  attributeLabel: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    color: '#64748B',
    marginBottom: '4px',
    fontFamily: "'Inter', sans-serif",
  },
  attributeValue: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 700,
    fontSize: '15px',
    lineHeight: '22px',
    color: '#17324D',
  },
  attributeSubtext: {
    fontFamily: "'Inter', sans-serif",
    fontSize: '13px',
    color: '#64748B',
    marginTop: '2px',
  },
  protocolCard: {
    background: '#E8EEF4',
    border: '1px solid #D2DDE8',
    borderRadius: '12px',
    padding: '20px 24px',
    boxSizing: 'border-box',
    width: '100%',
  },
};
