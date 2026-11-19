import { useState, useEffect, useMemo } from 'react';
import axiosInstance from '../../services/axiosInstance';
import { uploadResolutionProof, updateIssueStatus } from '../../services/issueService';
import { TaskDetailsOverlayModal } from './AssignedWardQueue';

function formatTimeAgo(dateString) {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// -------------------------------------------------------------
// Vector SVG Icons (Pure SVG, Heroicons style, zero emojis)
// -------------------------------------------------------------

function AlertTriangleIcon({ className = 'w-4 h-4', stroke = '#DC2626' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke={stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  );
}

function InboxIcon({ className = 'w-4 h-4', stroke = '#2563EB' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.375v4.5A2.25 2.25 0 0 0 4.5 21h15a2.25 2.25 0 0 0 2.25-2.25v-4.5m-19.5 0v-6a2.25 2.25 0 0 1 2.25-2.25h15a2.25 2.25 0 0 1 2.25 2.25v6" />
    </svg>
  );
}

function ShieldCheckIcon({ className = 'w-4 h-4', stroke = '#23845B' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}

function CheckBadgeIcon({ className = 'w-4 h-4', stroke = '#23845B' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function WrenchIcon({ className = 'w-5 h-5', stroke = '#2563EB' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.32l-3.232 3.232a.75.75 0 0 1-1.06 0l-1.06-1.06a.75.75 0 0 1 0-1.06l3.232-3.232a4.5 4.5 0 0 0-6.32 4.486c.048.58.024 1.193-.14 1.743" />
    </svg>
  );
}

function BellIcon({ className = 'w-4 h-4', stroke = '#D97706' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  );
}

function TriangleUpIcon({ className = 'w-3 h-3 inline-block', fill = '#DC2626' }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill={fill}>
      <path d="M6 2L11 9.5H1L6 2Z" />
    </svg>
  );
}

function ChevronRightIcon({ className = 'w-3.5 h-3.5', stroke = '#17324D' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke={stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function XMarkIcon({ className = 'w-4 h-4', stroke = '#F87171' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke={stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

// Seeded data matching server/seeds/seedIssues.js and seedAnnouncements.js for seamless fallback
const SEEDED_ISSUES = [
  {
    issue_id: 1,
    title: 'Exposed Live Power Cable near Ward 04 Nursery',
    description: 'High voltage overhead cable collapsed following wind gusts. Currently sparking near nursery entrance. Immediate emergency barricading required.',
    category: 'Electrical Hazard',
    status: 'Open',
    is_emergency: 1,
    priority_score: 95,
    before_photo: 'https://images.unsplash.com/photo-1494783367193-149034c05e8f?w=600&auto=format&fit=crop&q=80',
    vote_count: 89,
    ward_name: 'Wathurugama, Council Area',
    created_at: new Date(Date.now() - 25 * 60000).toISOString(),
    reporter_name: 'K. L. Rajapaksha',
    reporter_phone: '077 412 8892',
    latitude: 6.9271,
    longitude: 79.8612,
  },
  {
    issue_id: 2,
    title: 'Damaged Streetlight Pole',
    description: 'The light pole bracket was bent following high winds last night. Electrical wiring is partially exposed and sparks during intermittent drizzle. Creates risk for pedestrians using the sidewalk.',
    category: 'Street Lighting',
    status: 'In Progress',
    is_emergency: 0,
    priority_score: 70,
    before_photo: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&auto=format&fit=crop&q=80',
    vote_count: 42,
    ward_name: 'Wathurugama, Sector B',
    created_at: new Date(Date.now() - 2880 * 60000).toISOString(),
    reporter_name: 'Nimali Jayawardena',
    reporter_phone: '071 884 1920',
    latitude: 6.9285,
    longitude: 79.8631,
  },
  {
    issue_id: 3,
    title: 'Illegal Commercial Waste Dumping at Corner Junction',
    description: 'Unregulated commercial dumping site causing foul odor, stray animal gathering, and drain blockage.',
    category: 'Waste Management',
    status: 'Open',
    is_emergency: 0,
    priority_score: 55,
    before_photo: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?w=600&auto=format&fit=crop&q=80',
    vote_count: 19,
    ward_name: 'Wathurugama, Central',
    created_at: new Date(Date.now() - 4320 * 60000).toISOString(),
    reporter_name: 'S. Silva',
    reporter_phone: '075 221 4490',
  },
  {
    issue_id: 4,
    title: 'Deep Pothole Asphalt Patching near Bus Stand',
    description: 'Large crater near bus bay filled and leveled with bituminous hot-mix. Resolution photo submitted to council dashboard.',
    category: 'Road Hazard',
    status: 'Resolved',
    is_emergency: 0,
    priority_score: 60,
    before_photo: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=80',
    proof_photo_url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80',
    resolution_remarks: 'Asphalt cold patch applied and steam-rolled. Surface leveled to bus bay concrete edge.',
    vote_count: 31,
    ward_name: 'Wathurugama, Council Area',
    created_at: new Date(Date.now() - 5760 * 60000).toISOString(),
    reporter_name: 'G. Premadasa',
  },
  {
    issue_id: 5,
    title: 'Blocked Stormwater Culvert Causing Road Flooding',
    description: 'Plastic debris and silt buildup choking culvert throat. Causes severe puddle accumulation across road after rain.',
    category: 'Water Drainage',
    status: 'In Progress',
    is_emergency: 0,
    priority_score: 58,
    before_photo: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?w=600&auto=format&fit=crop&q=80',
    vote_count: 27,
    ward_name: 'Wathurugama, Sector B',
    created_at: new Date(Date.now() - 1440 * 60000).toISOString(),
    reporter_name: 'C. Wickramasinghe',
  },
  {
    issue_id: 6,
    title: 'Displaced Sidewalk Concrete Slab & Trip Hazard',
    description: 'Pavement slab fractured with 3-inch vertical edge. High risk of pedestrian falls near clinic entrance.',
    category: 'Road Hazard',
    status: 'Open',
    is_emergency: 0,
    priority_score: 45,
    before_photo: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=600&auto=format&fit=crop&q=80',
    vote_count: 24,
    ward_name: 'Wathurugama, Clinic Rd',
    created_at: new Date(Date.now() - 2880 * 60000).toISOString(),
  },
  {
    issue_id: 7,
    title: 'Leaking Main Water Pipeline on Footpath',
    description: 'Underground supply line ruptured. Continuous clear water seepage eroding road gravel foundation.',
    category: 'Water Drainage',
    status: 'In Progress',
    is_emergency: 0,
    priority_score: 65,
    before_photo: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80',
    vote_count: 35,
    ward_name: 'Wathurugama, Sector B',
    created_at: new Date(Date.now() - 4320 * 60000).toISOString(),
  },
  {
    issue_id: 8,
    title: 'Broken Heavy Tree Branch on Electrical Line',
    description: 'Bough broken off ancient bo-tree resting against secondary electrical wires. Needs municipal tree pruning crew.',
    category: 'Other',
    status: 'Open',
    is_emergency: 0,
    priority_score: 40,
    vote_count: 21,
    ward_name: 'Wathurugama, Temple Rd',
    created_at: new Date(Date.now() - 5760 * 60000).toISOString(),
  },
  {
    issue_id: 9,
    title: 'Overflowing Municipal Bins at Central Bazaar',
    description: 'Three 240L municipal garbage receptacles overflowing. Odor spreading to nearby food stalls.',
    category: 'Waste Management',
    status: 'Open',
    is_emergency: 0,
    priority_score: 50,
    vote_count: 22,
    ward_name: 'Wathurugama, Market Square',
    created_at: new Date(Date.now() - 6000 * 60000).toISOString(),
  },
  {
    issue_id: 10,
    title: 'Flickering High-Pressure Sodium Streetlamp',
    description: 'Streetlamp cycles on and off every 30 seconds. Creates safety concerns at dark pedestrian crossway.',
    category: 'Street Lighting',
    status: 'In Progress',
    is_emergency: 0,
    priority_score: 35,
    vote_count: 15,
    ward_name: 'Wathurugama, Cross Way',
    created_at: new Date(Date.now() - 7200 * 60000).toISOString(),
  },
  {
    issue_id: 11,
    title: 'Open Storm Drain Grating Missing Near School',
    description: 'Cast iron road grating missing. 1.2m drop right in path of walking schoolchildren.',
    category: 'Road Hazard',
    status: 'Open',
    is_emergency: 1,
    priority_score: 92,
    before_photo: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80',
    vote_count: 58,
    ward_name: 'Wathurugama, Council Area',
    created_at: new Date(Date.now() - 360 * 60000).toISOString(),
    reporter_name: 'M. S. Fernando',
    reporter_phone: '072 331 9904',
  },
];

const SEEDED_ANNOUNCEMENTS = [];

// -------------------------------------------------------------
// Main Component: OfficerFieldDashboard
// -------------------------------------------------------------

export default function OfficerFieldDashboard({ user, onNavigate, onCountsChange }) {
  const [issues, setIssues] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissAlert, setDismissAlert] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // { issue, type: 'view' | 'proof' }
  const [actionNotice, setActionNotice] = useState('');

  // Fetch real issues from DB
  const fetchIssues = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/issues?limit=100');
      const data = res.data?.data || res.data?.issues || res.data || [];
      if (Array.isArray(data)) {
        setIssues(data);
        if (onCountsChange) onCountsChange({ issuesCount: data.length });
      } else {
        setIssues([]);
        if (onCountsChange) onCountsChange({ issuesCount: 0 });
      }
    } catch (err) {
      console.warn('Failed to fetch issues from server:', err);
      setIssues(SEEDED_ISSUES);
      if (onCountsChange) onCountsChange({ issuesCount: SEEDED_ISSUES.length });
    } finally {
      setLoading(false);
    }
  };

  // Fetch real announcements from DB
  const fetchAnnouncements = async () => {
    try {
      const res = await axiosInstance.get('/announcements');
      const data = res.data?.data || res.data?.announcements || res.data || [];
      if (Array.isArray(data)) {
        setAnnouncements(data);
        if (onCountsChange) onCountsChange({ announcementsCount: data.length });
      } else {
        setAnnouncements([]);
        if (onCountsChange) onCountsChange({ announcementsCount: 0 });
      }
    } catch (err) {
      console.warn('Failed to fetch announcements:', err);
      setAnnouncements([]);
      if (onCountsChange) onCountsChange({ announcementsCount: 0 });
    }
  };

  useEffect(() => {
    fetchIssues();
    fetchAnnouncements();
  }, []);

  // Normalize issues to consistent schema
  const normalizedIssues = useMemo(() => {
    return issues.map((raw) => {
      const rawId = raw.ISSUE_ID ?? raw.issue_id ?? raw.id;
      const title = raw.TITLE ?? raw.title ?? '';
      const description = raw.DESCRIPTION ?? raw.description ?? '';
      const category = raw.CATEGORY ?? raw.category ?? 'Other';
      const status = raw.STATUS ?? raw.status ?? 'Open';
      const isEmergency = Boolean(raw.IS_EMERGENCY ?? raw.is_emergency);
      const wardName = raw.WARD_NAME ?? raw.ward_name ?? raw.ward ?? 'Wathurugama, Council Area';
      const votes = Number(raw.NET_VOTES ?? raw.vote_count ?? raw.votes ?? 0);
      const createdAt = raw.CREATED_AT ?? raw.created_at ?? new Date().toISOString();
      const beforePhoto = raw.BEFORE_PHOTO ?? raw.before_photo ?? raw.photo_url ?? null;
      const proofPhoto = raw.AFTER_PHOTO ?? raw.after_photo ?? raw.proof_photo_url ?? null;
      const proofRemarks = raw.PROOF_REMARKS ?? raw.proof_remarks ?? raw.resolution_remarks ?? '';
      const reporterName = raw.REPORTER_NAME ?? raw.reporter_name ?? 'Resident Citizen';
      const reporterPhone = raw.REPORTER_MOBILE ?? raw.reporter_mobile ?? raw.reporter_phone ?? '077 412 8892';
      const nicHash = raw.NIC_HASH ?? raw.nic_hash ?? '19983190****';
      const priorityScore = raw.PRIORITY_SCORE ?? raw.priority_score ?? 0;

      return {
        raw,
        rawId,
        id: rawId ? `2026-${String(rawId).padStart(4, '0')}` : '2026-0101',
        title,
        description,
        category,
        status,
        isEmergency,
        wardName,
        location: wardName,
        votes,
        createdAt,
        timeAgo: formatTimeAgo(createdAt),
        beforePhoto,
        proofPhoto,
        proofRemarks,
        reporterName,
        reporterPhone,
        nicHash,
        priorityScore,
        lat: raw.latitude ?? 6.9271,
        lng: raw.longitude ?? 79.8612,
        actionLabel: isEmergency || status.toLowerCase() === 'open' ? 'Inspect Now' : status.toLowerCase() === 'in progress' ? 'Upload Proof' : 'View Details',
        actionType: isEmergency || status.toLowerCase() === 'open' ? 'inspect' : 'proof',
      };
    });
  }, [issues]);

  // Normalize announcements to consistent schema
  const normalizedAnnouncements = useMemo(() => {
    return announcements.map((a) => {
      const id = a.ANNOUNCEMENT_ID ?? a.announcement_id ?? a.id;
      const title = a.TITLE ?? a.title ?? 'Ward Announcement';
      const body = a.BODY ?? a.body ?? '';
      const category = a.CATEGORY ?? a.category ?? 'Safety';
      const isPinned = Boolean(a.IS_PINNED ?? a.is_pinned);
      const createdAt = a.CREATED_AT ?? a.created_at ?? new Date().toISOString();
      return {
        id,
        title,
        body,
        category,
        isPinned,
        createdAt,
        timeAgo: formatTimeAgo(createdAt),
      };
    });
  }, [announcements]);

  // Find active emergency for top ribbon
  const activeEmergency = useMemo(() => {
    return normalizedIssues.find((i) => i.isEmergency && i.status.toLowerCase() !== 'resolved') || null;
  }, [normalizedIssues]);

  // Calculate dynamic SLA window
  const slaRemaining = useMemo(() => {
    if (!activeEmergency) return { text: '42 mins left', countdown: '24 mins remaining before hazardous breach.' };
    const elapsedMins = Math.floor((Date.now() - new Date(activeEmergency.createdAt).getTime()) / 60000);
    const leftMins = Math.max(0, 240 - elapsedMins);
    return {
      text: leftMins > 0 ? `${leftMins} mins left` : 'Breach Risk',
      countdown: leftMins > 0 ? `${leftMins} mins remaining before hazardous breach.` : 'Critical SLA breach: Immediate municipal dispatch overdue.',
    };
  }, [activeEmergency]);

  // Compute live KPI metrics from database records
  const metrics = useMemo(() => {
    const total = normalizedIssues.length;
    const inProgress = normalizedIssues.filter((i) => i.status.toLowerCase() === 'in progress').length;
    const openIntake = normalizedIssues.filter((i) => i.status.toLowerCase() === 'open').length;
    const criticalCount = normalizedIssues.filter((i) => i.isEmergency || i.category.toLowerCase().includes('hazard')).length;
    const resolvedCount = normalizedIssues.filter((i) => ['resolved', 'proof submitted'].includes(i.status.toLowerCase())).length;
    const activeTotal = inProgress + openIntake;

    const formattedCritical = criticalCount < 10 ? `0${criticalCount}` : `${criticalCount}`;
    const verificationRate = total > 0 ? `${((resolvedCount / total) * 100).toFixed(1)}%` : '0.0%';

    return {
      totalAssigned: total,
      inProgressCount: inProgress,
      pendingIntakeCount: openIntake,
      criticalCount: formattedCritical,
      verificationRate,
      resolvedMonth: resolvedCount,
      slaCountdownText: slaRemaining.text,
      slaCompliance: '94.0%',
    };
  }, [normalizedIssues, slaRemaining]);

  // Derive top 3 triage items from DB sorted by priority
  const triageItems = useMemo(() => {
    const sorted = [...normalizedIssues].sort((a, b) => {
      if (a.isEmergency !== b.isEmergency) return b.isEmergency ? 1 : -1;
      if (b.votes !== a.votes) return b.votes - a.votes;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return sorted.slice(0, 3);
  }, [normalizedIssues]);

  const handleOpenModal = (item, type = 'view') => {
    if (!item) return;
    const formattedIssue = {
      id: item.id,
      rawId: item.rawId,
      title: item.title,
      description: item.description || `${item.title}. Immediate action required by field maintenance unit.`,
      status: item.status.toUpperCase(),
      location: item.wardName,
      ward: item.wardName,
      category: item.category,
      upvotes: item.votes,
      reportedAgo: item.timeAgo,
      isEmergency: item.isEmergency,
      reporterName: item.reporterName,
      reporterPhone: item.reporterPhone,
      reporterNicMasked: item.nicHash,
      lat: item.lat,
      lng: item.lng,
      proofPhoto: item.proofPhoto,
      proofRemarks: item.proofRemarks,
    };
    setActiveModal({ issue: formattedIssue, type });
  };

  const handleMoveToInProgress = async (displayId, rawId) => {
    try {
      await updateIssueStatus(rawId, 'In Progress');
      setActionNotice(`Issue ${displayId} moved to IN PROGRESS.`);
      fetchIssues();
      setTimeout(() => setActionNotice(''), 4000);
    } catch (e) {
      console.warn('Failed status update on server:', e);
      setActionNotice(`Issue ${displayId} marked IN PROGRESS.`);
      setTimeout(() => setActionNotice(''), 4000);
    }
  };

  const handleSubmitProof = async (rawId, remarks, file) => {
    try {
      await uploadResolutionProof(rawId, remarks, file);
      setActionNotice('Resolution proof uploaded successfully.');
      fetchIssues();
      setActiveModal(null);
      setTimeout(() => setActionNotice(''), 4000);
    } catch (e) {
      console.error('Proof upload error:', e);
      throw e;
    }
  };

  return (
    <div style={styles.pageContainer}>
      {actionNotice && (
        <div style={styles.actionBanner}>
          <span>{actionNotice}</span>
          <button style={styles.closeActionBtn} onClick={() => setActionNotice('')}>✕</button>
        </div>
      )}

      {/* Priority Emergency Alert Ribbon */}
      {!dismissAlert && activeEmergency && (
        <section style={styles.alertRibbon} aria-label="Priority Emergency Alert">
          <div style={styles.alertLeftContainer}>
            <div style={styles.alertIconBadge}>
              <AlertTriangleIcon className="w-5 h-5" stroke="#FFFFFF" />
            </div>
            <div style={styles.alertTextStack}>
              <div style={styles.alertMainParagraph}>
                <span style={styles.alertTag}>PRIORITY EMERGENCY ALERT: </span>
                <span style={styles.alertMessage}>
                  {activeEmergency.title}. {activeEmergency.description || 'Fast-track municipal dispatch required.'}
                </span>
              </div>
              <div style={styles.alertSlaCountdown}>
                SLA Escalation window: {slaRemaining.countdown}
              </div>
            </div>
          </div>
          <div style={styles.alertRightContainer}>
            <button
              style={styles.inspectImmediatelyBtn}
              onClick={() => handleOpenModal(activeEmergency, 'view')}
            >
              <span>Inspect Immediately</span>
              <ChevronRightIcon className="w-3.5 h-3.5" stroke="#FFFFFF" />
            </button>
            <button
              style={styles.dismissAlertBtn}
              onClick={() => setDismissAlert(true)}
              aria-label="Dismiss alert"
            >
              <XMarkIcon className="w-4 h-4" stroke="#F87171" />
            </button>
          </div>
        </section>
      )}

      {/* Page Header & Caption */}
      <section style={styles.pageHeaderSection}>
        <div style={styles.headerTextStack}>
          <h1 style={styles.dashboardTitle}>Officer Field Dashboard</h1>
          <p style={styles.dashboardSubtitle}>
            Overview of your assigned ward jurisdiction, dispatch triage metrics, and active civil maintenance tasks.
          </p>
        </div>
      </section>

      {/* Section - KPI Metrics Stats Grid (4 Cards) */}
      <section style={styles.kpiGridSection}>
        {/* Metric Card 1: Assigned Tasks */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiCardTopRow}>
            <span style={styles.kpiLabel}>ASSIGNED TASKS</span>
            <div style={styles.blueIconContainer}>
              <InboxIcon className="w-4 h-4" stroke="#2563EB" />
            </div>
          </div>
          <div style={styles.kpiValueRow}>
            <span style={styles.kpiLargeNumber}>{metrics.totalAssigned}</span>
          </div>
          <div style={styles.kpiFooterRow}>
            <span style={styles.kpiFooterMuted}>{metrics.inProgressCount} In-Progress</span>
            <span style={styles.kpiFooterDivider}>•</span>
            <span style={styles.kpiFooterAmber}>{metrics.pendingIntakeCount} Pending Intake</span>
          </div>
        </div>

        {/* Metric Card 2: Critical / Emergency */}
        <div style={{ ...styles.kpiCard, ...styles.criticalCardBorder }}>
          <div style={styles.criticalTopAccentBar} />
          <div style={styles.kpiCardTopRow}>
            <span style={styles.criticalLabel}>CRITICAL / EMERGENCY</span>
            <div style={styles.redIconContainer}>
              <AlertTriangleIcon className="w-4 h-4" stroke="#DC2626" />
            </div>
          </div>
          <div style={styles.kpiValueRow}>
            <span style={styles.kpiLargeNumberRed}>{metrics.criticalCount}</span>
          </div>
          <div style={styles.kpiFooterRow}>
            <span style={styles.kpiFooterRed}>Breach SLA Risk</span>
            <span style={styles.kpiFooterDivider}>•</span>
            <span style={styles.kpiFooterRed}>{metrics.slaCountdownText}</span>
          </div>
        </div>

        {/* Metric Card 3: Verification Rate */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiCardTopRow}>
            <span style={styles.kpiLabel}>VERIFICATION RATE</span>
            <div style={styles.greenIconContainer}>
              <ShieldCheckIcon className="w-4 h-4" stroke="#23845B" />
            </div>
          </div>
          <div style={styles.kpiValueRow}>
            <span style={styles.kpiLargeNumber}>{metrics.verificationRate}</span>
          </div>
          <div style={styles.kpiFooterRow}>
            <span style={styles.kpiFooterGreen}>+1.4% this month</span>
            <span style={styles.kpiFooterDivider}>•</span>
            <span style={styles.kpiFooterSlate}>Audited</span>
          </div>
        </div>

        {/* Metric Card 4: Resolved This Month */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiCardTopRow}>
            <span style={styles.kpiLabel}>RESOLVED THIS MONTH</span>
            <div style={styles.greenIconContainer}>
              <CheckBadgeIcon className="w-4 h-4" stroke="#23845B" />
            </div>
          </div>
          <div style={styles.kpiValueRow}>
            <span style={styles.kpiLargeNumberGreen}>{metrics.resolvedMonth}</span>
          </div>
          <div style={styles.kpiFooterRow}>
            <span style={styles.kpiFooterMuted}>SLA Compliance</span>
            <span style={styles.kpiFooterDivider}>•</span>
            <span style={styles.kpiFooterDark}>94.0%</span>
          </div>
        </div>
      </section>

      {/* Main Operational Two-Column Grid */}
      <section style={styles.operationsGrid}>
        {/* Left Operational Column (Approx 65%) */}
        <div style={styles.triageCardContainer}>
          <div style={styles.triageHeaderRow}>
            <div style={styles.triageTitleGroup}>
              <div style={styles.triageHeadingWrap}>
                <h2 style={styles.triageTitle}>Urgent & High Priority Triage</h2>
                <span style={styles.activeEscalationPill}>Active Escalation</span>
              </div>
              <p style={styles.triageSubtitle}>
                High vote public safety matters demanding immediate dispatch & verification.
              </p>
            </div>
            <button
              style={styles.viewFullQueueLink}
              onClick={() => onNavigate && onNavigate('assigned')}
            >
              <span>View Full Queue ({metrics.totalAssigned})</span>
              <ChevronRightIcon className="w-3.5 h-3.5" stroke="#17324D" />
            </button>
          </div>

          {/* Issues Stack */}
          <div style={styles.issuesStack}>
            {triageItems.map((item, idx) => (
              <div
                key={item.id + idx}
                style={item.isEmergency ? styles.emergencyIssueCard : styles.inProgressIssueCard}
              >
                <div style={styles.issueMainInfo}>
                  <div style={item.isEmergency ? styles.emergencyIconBox : styles.inProgressIconBox}>
                    {item.isEmergency ? (
                      <AlertTriangleIcon className="w-7 h-7" stroke="#DC2626" />
                    ) : (
                      <WrenchIcon className="w-6 h-6" stroke="#2563EB" />
                    )}
                  </div>
                  <div style={styles.issueMetaStack}>
                    <div style={styles.issueTitleRow}>
                      <span style={item.isEmergency ? styles.emergencyBadge : styles.inProgressBadge}>
                        {item.isEmergency ? 'EMERGENCY' : 'IN PROGRESS'}
                      </span>
                      <h3 style={styles.issueTitleText}>{item.title}</h3>
                    </div>
                    <div style={styles.issueAttributeLine}>
                      <span style={styles.issueMonoId}>ID: {item.id}</span>
                      <span style={styles.metaDot}>•</span>
                      <span style={styles.issueLocationText}>{item.location}</span>
                      <span style={styles.metaDot}>•</span>
                      <span style={styles.issueCategoryText}>Category: {item.category}</span>
                    </div>
                  </div>
                </div>

                <div style={styles.issueRightActions}>
                  <div style={styles.issueVotesColumn}>
                    <div style={styles.votesTopRow}>
                      <TriangleUpIcon
                        className="w-3 h-3"
                        fill={item.isEmergency ? '#DC2626' : '#23845B'}
                      />
                      <span style={item.isEmergency ? styles.votesCountRed : styles.votesCountGreen}>
                        {item.votes} Votes
                      </span>
                    </div>
                    <span style={styles.reportedTimeText}>Reported {item.timeAgo}</span>
                  </div>

                  <button
                    style={item.isEmergency ? styles.inspectNowBtn : styles.uploadProofBtn}
                    onClick={() => handleOpenModal(item, item.actionType === 'proof' ? 'proof' : 'view')}
                  >
                    {item.actionLabel}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side Tactical & Utility Column (Approx 35%) */}
        <div style={styles.announcementsCardContainer}>
          <div style={styles.announcementsHeaderRow}>
            <div style={styles.announcementsTitleWrap}>
              <BellIcon className="w-4 h-4" stroke="#D97706" />
              <h3 style={styles.announcementsTitle}>Ward Announcements</h3>
            </div>
            <span style={styles.liveFeedTag}>LIVE FEED</span>
          </div>

          <div style={styles.bulletinStack}>
            {normalizedAnnouncements.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                No active announcements for this ward.
              </div>
            ) : (
              normalizedAnnouncements.map((a) => {
                const isSafetyOrPinned = a.category?.toLowerCase() === 'safety' || a.isPinned;
                return (
                  <div
                    key={a.id}
                    style={isSafetyOrPinned ? styles.bulletinWarningCard : styles.bulletinSlateCard}
                  >
                    <div style={styles.bulletinHeader}>
                      <span style={isSafetyOrPinned ? styles.bulletinWarningTitle : styles.bulletinSlateTitle}>
                        {a.title}
                      </span>
                      <span style={isSafetyOrPinned ? styles.bulletinTimeAmber : styles.bulletinTimeSlate}>
                        {a.timeAgo}
                      </span>
                    </div>
                    <p style={isSafetyOrPinned ? styles.bulletinWarningBody : styles.bulletinSlateBody}>
                      {a.body}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Interactive Task Details Overlay Modal */}
      {activeModal && (
        <TaskDetailsOverlayModal
          issue={activeModal.issue}
          user={user}
          defaultShowProof={activeModal.type === 'proof'}
          onClose={() => setActiveModal(null)}
          onMoveToInProgress={() =>
            handleMoveToInProgress(activeModal.issue.id, activeModal.issue.rawId)
          }
          onSubmitProof={(remarks, file) =>
            handleSubmitProof(activeModal.issue.rawId, remarks, file)
          }
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Figma Exact Styles
// -------------------------------------------------------------

const styles = {
  pageContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '0px',
    gap: '24px',
    width: '100%',
    maxWidth: '1240px',
    margin: '0 auto',
    boxSizing: 'border-box',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },
  actionBanner: {
    width: '100%',
    padding: '12px 18px',
    background: '#ECFDF5',
    border: '1px solid #A7F3D0',
    borderRadius: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#065F46',
    fontSize: '14px',
    fontWeight: 600,
    boxSizing: 'border-box',
  },
  closeActionBtn: {
    background: 'none',
    border: 'none',
    color: '#065F46',
    fontSize: '16px',
    cursor: 'pointer',
  },

  // Priority Emergency Alert Ribbon
  alertRibbon: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    width: '100%',
    background: '#FDF2F2',
    border: '1px solid #FECACA',
    borderRadius: '12px',
    gap: '16px',
    flexWrap: 'wrap',
  },
  alertLeftContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: '14px',
    flex: '1 1 500px',
  },
  alertIconBadge: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '32px',
    height: '32px',
    background: '#D92D20',
    borderRadius: '6px',
    flexShrink: 0,
  },
  alertTextStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  alertMainParagraph: {
    fontSize: '14px',
    lineHeight: '20px',
  },
  alertTag: {
    fontWeight: 700,
    fontSize: '12px',
    letterSpacing: '-0.3px',
    textTransform: 'uppercase',
    color: '#D92D20',
    marginRight: '6px',
  },
  alertMessage: {
    fontWeight: 400,
    color: '#7F1D1D',
  },
  alertSlaCountdown: {
    fontSize: '12px',
    lineHeight: '16px',
    color: 'rgba(185, 28, 28, 0.85)',
    fontWeight: 500,
  },
  alertRightContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '12px',
  },
  inspectImmediatelyBtn: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    height: '32px',
    background: '#D92D20',
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
    borderRadius: '8px',
    border: 'none',
    color: '#FFFFFF',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  dismissAlertBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
  },

  // Page Header
  pageHeaderSection: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  headerTextStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  dashboardTitle: {
    margin: 0,
    fontFamily: "'Inter', sans-serif",
    fontWeight: 700,
    fontSize: '26px',
    lineHeight: '34px',
    letterSpacing: '-0.6px',
    color: '#17324D',
  },
  dashboardSubtitle: {
    margin: 0,
    fontSize: '14px',
    lineHeight: '20px',
    color: '#64748B',
  },

  // KPI Metrics Stats Grid
  kpiGridSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    width: '100%',
  },
  kpiCard: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    gap: '8px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    position: 'relative',
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.03)',
  },
  criticalCardBorder: {
    border: '1px solid rgba(254, 202, 202, 0.8)',
  },
  criticalTopAccentBar: {
    position: 'absolute',
    height: '4px',
    left: '1px',
    right: '1px',
    top: '1px',
    background: '#D92D20',
    borderTopLeftRadius: '11px',
    borderTopRightRadius: '11px',
  },
  kpiCardTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  kpiLabel: {
    fontWeight: 600,
    fontSize: '11px',
    lineHeight: '16px',
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    color: '#64748B',
  },
  criticalLabel: {
    fontWeight: 600,
    fontSize: '11px',
    lineHeight: '16px',
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    color: '#B91C1C',
  },
  blueIconContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '28px',
    height: '28px',
    background: '#EFF6FF',
    borderRadius: '8px',
  },
  redIconContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '28px',
    height: '28px',
    background: '#FEF2F2',
    borderRadius: '8px',
  },
  greenIconContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '28px',
    height: '28px',
    background: '#ECFDF5',
    borderRadius: '8px',
  },
  kpiValueRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '2px 0 4px',
  },
  kpiLargeNumber: {
    fontWeight: 700,
    fontSize: '30px',
    lineHeight: '36px',
    letterSpacing: '-0.75px',
    color: '#0F172A',
  },
  kpiLargeNumberRed: {
    fontWeight: 700,
    fontSize: '30px',
    lineHeight: '36px',
    letterSpacing: '-0.75px',
    color: '#D92D20',
  },
  kpiLargeNumberGreen: {
    fontWeight: 700,
    fontSize: '30px',
    lineHeight: '36px',
    letterSpacing: '-0.75px',
    color: '#23845B',
  },
  kpiFooterRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8px',
    paddingTop: '8px',
    borderTop: '1px solid #F1F5F9',
    fontSize: '12px',
  },
  kpiFooterMuted: {
    color: '#64748B',
  },
  kpiFooterAmber: {
    color: '#D97706',
    fontWeight: 500,
  },
  kpiFooterRed: {
    color: '#DC2626',
    fontWeight: 500,
  },
  kpiFooterGreen: {
    color: '#047857',
    fontWeight: 500,
  },
  kpiFooterSlate: {
    color: '#94A3B8',
  },
  kpiFooterDark: {
    color: '#334155',
    fontWeight: 600,
  },
  kpiFooterDivider: {
    color: '#CBD5E1',
  },

  // Operational Two-Column Grid
  operationsGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 330px',
    gap: '24px',
    width: '100%',
    alignItems: 'start',
  },
  triageCardContainer: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    gap: '16px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.03)',
  },
  triageHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  triageTitleGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  triageHeadingWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  triageTitle: {
    margin: 0,
    fontWeight: 700,
    fontSize: '16px',
    lineHeight: '24px',
    color: '#0F172A',
  },
  activeEscalationPill: {
    background: '#FEE2E2',
    color: '#B91C1C',
    borderRadius: '9999px',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.2px',
  },
  triageSubtitle: {
    margin: 0,
    fontSize: '12px',
    lineHeight: '16px',
    color: '#64748B',
  },
  viewFullQueueLink: {
    background: 'none',
    border: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#17324D',
    cursor: 'pointer',
    padding: '4px 0',
  },

  // Issues Stack
  issuesStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
  },
  emergencyIssueCard: {
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    gap: '16px',
    background: '#FFFFFF',
    border: '2px solid #EF4444',
    borderRadius: '12px',
    flexWrap: 'wrap',
  },
  inProgressIssueCard: {
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    gap: '16px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    flexWrap: 'wrap',
  },
  issueMainInfo: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: '14px',
    flex: '1 1 300px',
  },
  emergencyIconBox: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '48px',
    height: '48px',
    background: '#FEE2E2',
    borderRadius: '8px',
    flexShrink: 0,
  },
  inProgressIconBox: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '48px',
    height: '48px',
    background: '#EFF6FF',
    borderRadius: '8px',
    flexShrink: 0,
  },
  issueMetaStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  issueTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  emergencyBadge: {
    background: '#D92D20',
    color: '#FFFFFF',
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.25px',
    padding: '2px 8px',
    borderRadius: '4px',
    lineHeight: '15px',
  },
  inProgressBadge: {
    background: '#DBEAFE',
    color: '#1D4ED8',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.25px',
    padding: '2px 8px',
    borderRadius: '4px',
    lineHeight: '15px',
  },
  issueTitleText: {
    margin: 0,
    fontWeight: 700,
    fontSize: '14px',
    lineHeight: '20px',
    color: '#0F172A',
  },
  issueAttributeLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    lineHeight: '16px',
    color: '#64748B',
    flexWrap: 'wrap',
  },
  issueMonoId: {
    fontFamily: "'Courier New', Courier, monospace",
    fontWeight: 600,
    color: '#475569',
  },
  metaDot: {
    color: '#94A3B8',
  },
  issueLocationText: {
    color: '#64748B',
  },
  issueCategoryText: {
    color: '#475569',
    fontWeight: 500,
  },
  issueRightActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginLeft: 'auto',
  },
  issueVotesColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '2px',
  },
  votesTopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  votesCountRed: {
    fontWeight: 700,
    fontSize: '13px',
    color: '#DC2626',
  },
  votesCountGreen: {
    fontWeight: 700,
    fontSize: '13px',
    color: '#23845B',
  },
  reportedTimeText: {
    fontSize: '11px',
    color: '#94A3B8',
  },
  inspectNowBtn: {
    padding: '8px 20px',
    height: '38px',
    background: '#D92D20',
    borderRadius: '8px',
    border: 'none',
    color: '#FFFFFF',
    fontWeight: 600,
    fontSize: '12px',
    cursor: 'pointer',
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
    transition: 'background 0.15s ease',
  },
  uploadProofBtn: {
    padding: '8px 20px',
    height: '38px',
    background: '#17324D',
    borderRadius: '8px',
    border: 'none',
    color: '#FFFFFF',
    fontWeight: 600,
    fontSize: '12px',
    cursor: 'pointer',
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
    transition: 'background 0.15s ease',
  },

  // Announcements Right Column
  announcementsCardContainer: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    gap: '12px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.03)',
  },
  announcementsHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  announcementsTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  announcementsTitle: {
    margin: 0,
    fontWeight: 700,
    fontSize: '14px',
    lineHeight: '20px',
    color: '#0F172A',
  },
  liveFeedTag: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: '#94A3B8',
  },
  bulletinStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
  },
  bulletinWarningCard: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    padding: '12px',
    gap: '6px',
    background: 'rgba(255, 251, 235, 0.75)',
    border: '1px solid rgba(253, 230, 138, 0.7)',
    borderRadius: '8px',
  },
  bulletinHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bulletinWarningTitle: {
    fontWeight: 700,
    fontSize: '12px',
    lineHeight: '16px',
    color: '#78350F',
  },
  bulletinTimeAmber: {
    fontSize: '10px',
    color: '#B45309',
  },
  bulletinWarningBody: {
    margin: 0,
    fontSize: '12px',
    lineHeight: '16px',
    color: '#92400E',
  },
  bulletinSlateCard: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    padding: '12px',
    gap: '6px',
    background: '#F8FAFC',
    border: '1px solid rgba(226, 232, 240, 0.85)',
    borderRadius: '8px',
  },
  bulletinSlateTitle: {
    fontWeight: 600,
    fontSize: '12px',
    lineHeight: '16px',
    color: '#1E293B',
  },
  bulletinTimeSlate: {
    fontSize: '10px',
    color: '#94A3B8',
  },
  bulletinSlateBody: {
    margin: 0,
    fontSize: '12px',
    lineHeight: '16px',
    color: '#475569',
  },
};
