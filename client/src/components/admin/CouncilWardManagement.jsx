import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getAllCouncils,
  getAllWards,
  createWard,
  updateWard,
  deleteWard,
  createCouncil,
  updateCouncil,
  deleteCouncil,
} from '../../services/adminService';

export default function CouncilWardManagement({ user, onNavigate }) {
  const [councils, setCouncils] = useState([]);
  const [selectedCouncilId, setSelectedCouncilId] = useState('1'); // Dompe Pradeshiya Sabha by default
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state: 'addWard' | 'editWard' | 'deleteWard' | 'editCouncil' | 'addCouncil' | null
  const [activeModal, setActiveModal] = useState(null);
  const [selectedWard, setSelectedWard] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [wardForm, setWardForm] = useState({
    ward_name: '',
    description: '',
    council_id: '1',
  });

  const [councilForm, setCouncilForm] = useState({
    council_name: '',
    council_type: 'Pradeshiya Sabha',
    district: 'Gampaha',
    province: 'Western',
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  // Load councils and wards
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cRes, wRes] = await Promise.all([
        getAllCouncils(),
        getAllWards(),
      ]);

      const councilList = cRes.data || [];
      setCouncils(councilList);

      // Default to Dompe Pradeshiya Sabha if present, else first council
      if (councilList.length > 0) {
        const dompe = councilList.find(c => c.COUNCIL_NAME.toLowerCase().includes('dompe'));
        if (dompe) {
          setSelectedCouncilId(String(dompe.COUNCIL_ID));
        } else {
          setSelectedCouncilId(String(councilList[0].COUNCIL_ID));
        }
      }

      setWards(wRes.data || []);
    } catch (err) {
      console.error('Failed to load council/ward records:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load councils and wards.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Selected council object
  const activeCouncil = useMemo(() => {
    return councils.find(c => String(c.COUNCIL_ID) === String(selectedCouncilId)) || councils[0] || null;
  }, [councils, selectedCouncilId]);

  // Filtered wards for the selected council
  const councilWards = useMemo(() => {
    return wards.filter(w => String(w.COUNCIL_ID) === String(selectedCouncilId));
  }, [wards, selectedCouncilId]);

  // Search filtered wards
  const displayedWards = useMemo(() => {
    if (!searchTerm.trim()) return councilWards;
    const q = searchTerm.toLowerCase();
    return councilWards.filter(
      w =>
        w.WARD_NAME.toLowerCase().includes(q) ||
        (w.DESCRIPTION && w.DESCRIPTION.toLowerCase().includes(q)) ||
        String(w.WARD_ID).includes(q)
    );
  }, [councilWards, searchTerm]);

  // Open Create Ward modal
  const handleOpenAddWard = () => {
    setWardForm({
      ward_name: '',
      description: '',
      council_id: selectedCouncilId || '1',
    });
    setActiveModal('addWard');
  };

  // Open Edit Ward modal
  const handleOpenEditWard = (w) => {
    setSelectedWard(w);
    setWardForm({
      ward_name: w.WARD_NAME,
      description: w.DESCRIPTION || '',
      council_id: String(w.COUNCIL_ID),
    });
    setActiveModal('editWard');
  };

  // Open Delete Ward modal
  const handleOpenDeleteWard = (w) => {
    setSelectedWard(w);
    setActiveModal('deleteWard');
  };

  // Open Edit Council modal
  const handleOpenEditCouncil = (c) => {
    setCouncilForm({
      council_name: c.COUNCIL_NAME,
      council_type: c.COUNCIL_TYPE,
      district: c.DISTRICT,
      province: c.PROVINCE,
    });
    setActiveModal('editCouncil');
  };

  // Open Add Council modal
  const handleOpenAddCouncil = () => {
    setCouncilForm({
      council_name: '',
      council_type: 'Pradeshiya Sabha',
      district: 'Gampaha',
      province: 'Western',
    });
    setActiveModal('addCouncil');
  };

  // Submit Create Ward
  const handleSubmitAddWard = async (e) => {
    e.preventDefault();
    if (!wardForm.ward_name.trim()) {
      alert('Ward name is required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createWard({
        council_id: Number(selectedCouncilId),
        ward_name: wardForm.ward_name.trim(),
        description: wardForm.description.trim() || undefined,
      });
      showToast(res.message || `Ward "${wardForm.ward_name}" created successfully.`);
      setActiveModal(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to create ward.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Ward
  const handleSubmitEditWard = async (e) => {
    e.preventDefault();
    if (!selectedWard) return;
    if (!wardForm.ward_name.trim()) {
      alert('Ward name is required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await updateWard(selectedWard.WARD_ID, {
        council_id: Number(wardForm.council_id),
        ward_name: wardForm.ward_name.trim(),
        description: wardForm.description.trim() || null,
      });
      showToast(res.message || `Ward "${wardForm.ward_name}" updated successfully.`);
      setActiveModal(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to update ward.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Delete Ward
  const handleConfirmDeleteWard = async () => {
    if (!selectedWard) return;
    setSubmitting(true);
    try {
      const res = await deleteWard(selectedWard.WARD_ID);
      showToast(res.message || `Ward "${selectedWard.WARD_NAME}" deleted successfully.`);
      setActiveModal(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete ward.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Council
  const handleSubmitEditCouncil = async (e) => {
    e.preventDefault();
    if (!activeCouncil) return;
    if (!councilForm.council_name.trim()) {
      alert('Council name is required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await updateCouncil(activeCouncil.COUNCIL_ID, councilForm);
      showToast(res.message || 'Council updated successfully.');
      setActiveModal(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to update council.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Add Council
  const handleSubmitAddCouncil = async (e) => {
    e.preventDefault();
    if (!councilForm.council_name.trim()) {
      alert('Council name is required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createCouncil(councilForm);
      showToast(res.message || 'Council created successfully.');
      setActiveModal(null);
      fetchData();
      if (res.data?.COUNCIL_ID) {
        setSelectedCouncilId(String(res.data.COUNCIL_ID));
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to create council.');
    } finally {
      setSubmitting(false);
    }
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
            <span style={styles.headerTag}>LOCAL GOVERNANCE</span>
            <span style={styles.roleTag}>MUNICIPAL JURISDICTIONS</span>
          </div>
          <h1 style={styles.pageTitle}>Council & Ward Management</h1>
          <p style={styles.pageSub}>
            Administrative oversight for local municipal councils and their constituent electoral wards. Create, configure, and inspect ward boundaries, reported civic issues, and assigned field officers.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            style={styles.refreshBtn}
            onClick={fetchData}
            title="Refresh database records"
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
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Council Selector & Overview Card */}
      <div style={styles.councilOverviewCard}>
        <div style={styles.councilSelectorRow}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <label style={styles.councilDropdownLabel}>
              <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>SELECT MUNICIPAL COUNCIL</span>
              <span style={{ fontSize: '12px', color: '#64748B', marginLeft: '6px' }}>(Dompe Pradeshiya Sabha)</span>
            </label>
            <div style={styles.selectWrap}>
              <select
                value={selectedCouncilId}
                onChange={(e) => setSelectedCouncilId(e.target.value)}
                style={styles.councilSelect}
              >
                {councils.map((c) => (
                  <option key={c.COUNCIL_ID} value={String(c.COUNCIL_ID)}>
                    {c.COUNCIL_NAME} ({c.COUNCIL_TYPE} - {c.DISTRICT})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeCouncil && (
            <div style={styles.councilActionGroup}>
              <button
                type="button"
                style={styles.editCouncilBtn}
                onClick={() => handleOpenEditCouncil(activeCouncil)}
                title="Edit council profile"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span>Edit Council</span>
              </button>

              <button
                type="button"
                style={styles.addCouncilBtn}
                onClick={handleOpenAddCouncil}
                title="Register additional council"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>New Council</span>
              </button>
            </div>
          )}
        </div>

        {/* Selected Council Meta Strip */}
        {activeCouncil && (
          <div style={styles.councilDetailsRow}>
            <div style={styles.councilDetailItem}>
              <span style={styles.councilMetaLabel}>COUNCIL TYPE</span>
              <span style={styles.councilTypeBadge}>{activeCouncil.COUNCIL_TYPE}</span>
            </div>

            <div style={styles.councilDetailItem}>
              <span style={styles.councilMetaLabel}>DISTRICT & PROVINCE</span>
              <span style={styles.councilMetaVal}>
                {activeCouncil.DISTRICT} District • {activeCouncil.PROVINCE} Province
              </span>
            </div>

            <div style={styles.councilDetailItem}>
              <span style={styles.councilMetaLabel}>ELECTORAL WARDS</span>
              <span style={styles.councilMetricNum}>{councilWards.length} Wards</span>
            </div>

            <div style={styles.councilDetailItem}>
              <span style={styles.councilMetaLabel}>OFFICERS & ISSUES</span>
              <span style={styles.councilMetaVal}>
                {activeCouncil.officer_count ?? 6} Officers • {activeCouncil.issue_count ?? 11} Civic Reports
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Wards Section Header & Action Toolbar */}
      <div style={styles.wardsToolbar}>
        <div>
          <h2 style={styles.sectionHeading}>
            Electoral Wards in {activeCouncil?.COUNCIL_NAME || 'Selected Council'}
          </h2>
          <p style={styles.sectionSub}>
            Displaying {displayedWards.length} of {councilWards.length} wards registered under {activeCouncil?.COUNCIL_NAME}.
          </p>
        </div>

        <div style={styles.toolbarRight}>
          {/* Search Box */}
          <div style={styles.searchWrap}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search wards by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
            {searchTerm && (
              <button style={styles.clearSearchBtn} onClick={() => setSearchTerm('')}>✕</button>
            )}
          </div>

          {/* Add Ward Button */}
          <button
            type="button"
            style={styles.addWardBtn}
            onClick={handleOpenAddWard}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add New Ward</span>
          </button>
        </div>
      </div>

      {/* Main Wards List / Grid */}
      {loading ? (
        <div style={styles.loadingBox}>
          <div style={styles.spinner} />
          <p style={{ marginTop: '14px', color: '#64748B', fontSize: '14px' }}>Loading ward records from database...</p>
        </div>
      ) : error ? (
        <div style={styles.errorBox}>
          <p style={{ margin: 0, fontWeight: 600, color: '#B91C1C' }}>{error}</p>
          <button style={styles.retryBtn} onClick={fetchData}>Try Again</button>
        </div>
      ) : displayedWards.length === 0 ? (
        <div style={styles.emptyBox}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
            <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h3 style={{ margin: '14px 0 6px', color: '#0F172A', fontSize: '17px' }}>No wards found</h3>
          <p style={{ margin: 0, color: '#64748B', fontSize: '13px' }}>
            {searchTerm
              ? `No wards matching "${searchTerm}" in this council.`
              : 'There are currently no electoral wards recorded under this council.'}
          </p>
          <button
            type="button"
            style={{ ...styles.addWardBtn, marginTop: '16px' }}
            onClick={handleOpenAddWard}
          >
            + Add First Ward
          </button>
        </div>
      ) : (
        <div style={styles.wardsGrid}>
          {displayedWards.map((w) => {
            const issueCount = Number(w.issue_count) || 0;
            const officerCount = Number(w.officer_count) || 0;
            const citizenCount = Number(w.citizen_count) || 0;

            return (
              <div key={w.WARD_ID} style={styles.wardCard}>
                <div style={styles.wardCardTop}>
                  <div style={styles.wardIdBadge}>WARD #{String(w.WARD_ID).padStart(2, '0')}</div>
                  <div style={styles.wardActions}>
                    <button
                      type="button"
                      style={styles.cardEditBtn}
                      onClick={() => handleOpenEditWard(w)}
                      title={`Edit Ward ${w.WARD_NAME}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      style={styles.cardDeleteBtn}
                      onClick={() => handleOpenDeleteWard(w)}
                      title={`Delete Ward ${w.WARD_NAME}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                <h3 style={styles.wardTitle}>{w.WARD_NAME}</h3>
                <p style={styles.wardDesc}>
                  {w.DESCRIPTION || `Constituent electoral ward of ${activeCouncil?.COUNCIL_NAME || 'Dompe PS'}.`}
                </p>

                {/* Ward Stats Metrics Strip */}
                <div style={styles.wardStatsRow}>
                  <div style={styles.wardStatPill}>
                    <span style={styles.statLabel}>Issues</span>
                    <span style={{ ...styles.statVal, color: issueCount > 0 ? '#E05638' : '#64748B' }}>
                      {issueCount}
                    </span>
                  </div>

                  <div style={styles.wardStatPill}>
                    <span style={styles.statLabel}>Officers</span>
                    <span style={{ ...styles.statVal, color: officerCount > 0 ? '#059669' : '#64748B' }}>
                      {officerCount}
                    </span>
                  </div>

                  <div style={styles.wardStatPill}>
                    <span style={styles.statLabel}>Citizens</span>
                    <span style={{ ...styles.statVal, color: citizenCount > 0 ? '#2563EB' : '#64748B' }}>
                      {citizenCount}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add New Ward */}
      {activeModal === 'addWard' && (
        <div style={modalStyles.backdrop} onClick={() => setActiveModal(null)}>
          <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={modalStyles.iconBadge}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </span>
                <h3 style={modalStyles.title}>Add New Ward</h3>
              </div>
              <button style={modalStyles.closeBtn} onClick={() => setActiveModal(null)}>✕</button>
            </div>

            <p style={modalStyles.sub}>
              Create a new electoral ward under <strong>{activeCouncil?.COUNCIL_NAME || 'Dompe Pradeshiya Sabha'}</strong>.
            </p>

            <form onSubmit={handleSubmitAddWard}>
              <div style={{ marginBottom: '14px' }}>
                <label style={modalStyles.label}>
                  Council:
                </label>
                <input
                  type="text"
                  disabled
                  value={`${activeCouncil?.COUNCIL_NAME || 'Dompe Pradeshiya Sabha'} (${activeCouncil?.DISTRICT || 'Gampaha'})`}
                  style={{ ...modalStyles.input, background: '#F8FAFC', color: '#64748B' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={modalStyles.label}>
                  Ward Name <span style={{ color: '#DC2626' }}>*</span>:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wathurugama East, Kirindiwela North"
                  value={wardForm.ward_name}
                  onChange={(e) => setWardForm((prev) => ({ ...prev, ward_name: e.target.value }))}
                  style={modalStyles.input}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={modalStyles.label}>
                  Description / Boundaries (Optional):
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Northern boundary borders Pugoda road, covers agricultural and residential sectors..."
                  value={wardForm.description}
                  onChange={(e) => setWardForm((prev) => ({ ...prev, description: e.target.value }))}
                  style={modalStyles.textarea}
                />
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
                  style={modalStyles.primaryBtn}
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Ward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Ward */}
      {activeModal === 'editWard' && selectedWard && (
        <div style={modalStyles.backdrop} onClick={() => setActiveModal(null)}>
          <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={modalStyles.iconBadge}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </span>
                <h3 style={modalStyles.title}>Edit Ward #{selectedWard.WARD_ID}</h3>
              </div>
              <button style={modalStyles.closeBtn} onClick={() => setActiveModal(null)}>✕</button>
            </div>

            <form onSubmit={handleSubmitEditWard}>
              <div style={{ marginBottom: '14px' }}>
                <label style={modalStyles.label}>Council Jurisdiction:</label>
                <select
                  value={wardForm.council_id}
                  onChange={(e) => setWardForm((prev) => ({ ...prev, council_id: e.target.value }))}
                  style={modalStyles.select}
                >
                  {councils.map((c) => (
                    <option key={c.COUNCIL_ID} value={String(c.COUNCIL_ID)}>
                      {c.COUNCIL_NAME} ({c.DISTRICT})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={modalStyles.label}>
                  Ward Name <span style={{ color: '#DC2626' }}>*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={wardForm.ward_name}
                  onChange={(e) => setWardForm((prev) => ({ ...prev, ward_name: e.target.value }))}
                  style={modalStyles.input}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={modalStyles.label}>
                  Description / Boundaries:
                </label>
                <textarea
                  rows={3}
                  value={wardForm.description}
                  onChange={(e) => setWardForm((prev) => ({ ...prev, description: e.target.value }))}
                  style={modalStyles.textarea}
                />
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
                  style={modalStyles.primaryBtn}
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Ward Confirmation */}
      {activeModal === 'deleteWard' && selectedWard && (
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
                <h3 style={modalStyles.title}>Delete Ward</h3>
              </div>
              <button style={modalStyles.closeBtn} onClick={() => setActiveModal(null)}>✕</button>
            </div>

            <p style={modalStyles.sub}>
              Are you sure you want to permanently delete <strong>Ward #{selectedWard.WARD_ID}: {selectedWard.WARD_NAME}</strong>?
            </p>

            {/* Dependency Warning */}
            <div style={modalStyles.warningBox}>
              <div style={{ fontWeight: 600, color: '#B91C1C', marginBottom: '6px' }}>Dependency Integrity Check:</div>
              <ul style={{ margin: 0, paddingLeft: '18px', color: '#475569', fontSize: '13px' }}>
                <li>Associated Issues: <strong>{selectedWard.issue_count || 0}</strong></li>
                <li>Assigned Officers: <strong>{selectedWard.officer_count || 0}</strong></li>
                <li>Registered Citizens: <strong>{selectedWard.citizen_count || 0}</strong></li>
              </ul>
              {(selectedWard.issue_count > 0 || selectedWard.officer_count > 0 || selectedWard.citizen_count > 0) && (
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#B91C1C', fontWeight: 600 }}>
                  ⚠️ This ward cannot be deleted while active issues, officers, or citizens are attached to it.
                </p>
              )}
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
                type="button"
                style={modalStyles.deleteBtn}
                onClick={handleConfirmDeleteWard}
                disabled={
                  submitting ||
                  Number(selectedWard.issue_count) > 0 ||
                  Number(selectedWard.officer_count) > 0 ||
                  Number(selectedWard.citizen_count) > 0
                }
              >
                {submitting ? 'Deleting...' : 'Confirm Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Council */}
      {activeModal === 'editCouncil' && activeCouncil && (
        <div style={modalStyles.backdrop} onClick={() => setActiveModal(null)}>
          <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={modalStyles.iconBadge}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </span>
                <h3 style={modalStyles.title}>Edit Council Profile</h3>
              </div>
              <button style={modalStyles.closeBtn} onClick={() => setActiveModal(null)}>✕</button>
            </div>

            <form onSubmit={handleSubmitEditCouncil}>
              <div style={{ marginBottom: '14px' }}>
                <label style={modalStyles.label}>
                  Council Name <span style={{ color: '#DC2626' }}>*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={councilForm.council_name}
                  onChange={(e) => setCouncilForm((prev) => ({ ...prev, council_name: e.target.value }))}
                  style={modalStyles.input}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={modalStyles.label}>Council Type:</label>
                <select
                  value={councilForm.council_type}
                  onChange={(e) => setCouncilForm((prev) => ({ ...prev, council_type: e.target.value }))}
                  style={modalStyles.select}
                >
                  <option value="Pradeshiya Sabha">Pradeshiya Sabha</option>
                  <option value="Urban Council">Urban Council</option>
                  <option value="Municipal Council">Municipal Council</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={modalStyles.label}>District:</label>
                  <input
                    type="text"
                    required
                    value={councilForm.district}
                    onChange={(e) => setCouncilForm((prev) => ({ ...prev, district: e.target.value }))}
                    style={modalStyles.input}
                  />
                </div>
                <div>
                  <label style={modalStyles.label}>Province:</label>
                  <input
                    type="text"
                    required
                    value={councilForm.province}
                    onChange={(e) => setCouncilForm((prev) => ({ ...prev, province: e.target.value }))}
                    style={modalStyles.input}
                  />
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
                  style={modalStyles.primaryBtn}
                  disabled={submitting}
                >
                  {submitting ? 'Updating...' : 'Update Council'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Council */}
      {activeModal === 'addCouncil' && (
        <div style={modalStyles.backdrop} onClick={() => setActiveModal(null)}>
          <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={modalStyles.iconBadge}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </span>
                <h3 style={modalStyles.title}>Register Municipal Council</h3>
              </div>
              <button style={modalStyles.closeBtn} onClick={() => setActiveModal(null)}>✕</button>
            </div>

            <form onSubmit={handleSubmitAddCouncil}>
              <div style={{ marginBottom: '14px' }}>
                <label style={modalStyles.label}>
                  Council Name <span style={{ color: '#DC2626' }}>*</span>:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gampaha Municipal Council"
                  value={councilForm.council_name}
                  onChange={(e) => setCouncilForm((prev) => ({ ...prev, council_name: e.target.value }))}
                  style={modalStyles.input}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={modalStyles.label}>Council Type:</label>
                <select
                  value={councilForm.council_type}
                  onChange={(e) => setCouncilForm((prev) => ({ ...prev, council_type: e.target.value }))}
                  style={modalStyles.select}
                >
                  <option value="Pradeshiya Sabha">Pradeshiya Sabha</option>
                  <option value="Urban Council">Urban Council</option>
                  <option value="Municipal Council">Municipal Council</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={modalStyles.label}>District:</label>
                  <input
                    type="text"
                    required
                    value={councilForm.district}
                    onChange={(e) => setCouncilForm((prev) => ({ ...prev, district: e.target.value }))}
                    style={modalStyles.input}
                  />
                </div>
                <div>
                  <label style={modalStyles.label}>Province:</label>
                  <input
                    type="text"
                    required
                    value={councilForm.province}
                    onChange={(e) => setCouncilForm((prev) => ({ ...prev, province: e.target.value }))}
                    style={modalStyles.input}
                  />
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
                  style={modalStyles.primaryBtn}
                  disabled={submitting}
                >
                  {submitting ? 'Registering...' : 'Register Council'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '28px 32px',
    maxWidth: '1360px',
    margin: '0 auto',
    fontFamily: 'inherit',
    position: 'relative',
  },
  toast: {
    position: 'fixed',
    top: '24px',
    right: '24px',
    background: '#ECFDF5',
    border: '1px solid #6EE7B7',
    color: '#065F46',
    padding: '12px 18px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    zIndex: 9999,
    fontSize: '14px',
    fontWeight: 500,
    animation: 'slideIn 0.2s ease',
  },
  closeToastBtn: {
    background: 'none',
    border: 'none',
    color: '#047857',
    cursor: 'pointer',
    fontSize: '14px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
    gap: '20px',
    flexWrap: 'wrap',
  },
  badgeRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '8px',
  },
  headerTag: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    color: '#1D4ED8',
    background: '#EFF6FF',
    padding: '3px 8px',
    borderRadius: '4px',
    border: '1px solid #BFDBFE',
  },
  roleTag: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#475569',
    background: '#F1F5F9',
    padding: '3px 8px',
    borderRadius: '4px',
  },
  pageTitle: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#0F172A',
    margin: '0 0 6px 0',
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
  councilOverviewCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    padding: '20px 24px',
    marginBottom: '28px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
  },
  councilSelectorRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '16px',
    paddingBottom: '18px',
    borderBottom: '1px solid #F1F5F9',
    flexWrap: 'wrap',
  },
  councilDropdownLabel: {
    display: 'block',
    marginBottom: '8px',
  },
  selectWrap: {
    position: 'relative',
    maxWidth: '560px',
  },
  councilSelect: {
    width: '100%',
    padding: '10px 14px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#0F172A',
    background: '#F8FAFC',
    border: '1.5px solid #CBD5E1',
    borderRadius: '8px',
    outline: 'none',
    cursor: 'pointer',
  },
  councilActionGroup: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  editCouncilBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 14px',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#1E293B',
    cursor: 'pointer',
  },
  addCouncilBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 14px',
    background: '#F1F5F9',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
  },
  councilDetailsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    paddingTop: '16px',
  },
  councilDetailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  councilMetaLabel: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: '#94A3B8',
  },
  councilTypeBadge: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#0284C7',
    background: '#E0F2FE',
    padding: '2px 8px',
    borderRadius: '4px',
    alignSelf: 'flex-start',
  },
  councilMetaVal: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#334155',
  },
  councilMetricNum: {
    fontSize: '16px',
    fontWeight: 800,
    color: '#0F172A',
  },
  wardsToolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '16px',
    marginBottom: '18px',
    flexWrap: 'wrap',
  },
  sectionHeading: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 4px 0',
  },
  sectionSub: {
    fontSize: '13px',
    color: '#64748B',
    margin: 0,
  },
  toolbarRight: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    padding: '0 10px',
  },
  searchInput: {
    border: 'none',
    padding: '8px 8px',
    fontSize: '13px',
    color: '#0F172A',
    outline: 'none',
    width: '260px',
  },
  clearSearchBtn: {
    border: 'none',
    background: 'transparent',
    color: '#94A3B8',
    cursor: 'pointer',
    fontSize: '12px',
  },
  addWardBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: '#1D4ED8',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#FFFFFF',
    cursor: 'pointer',
  },
  wardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
    gap: '16px',
  },
  wardCard: {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    padding: '18px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'all 0.15s ease',
  },
  wardCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  wardIdBadge: {
    fontSize: '11px',
    fontFamily: 'monospace',
    fontWeight: 700,
    background: '#F1F5F9',
    color: '#475569',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  wardActions: {
    display: 'flex',
    gap: '4px',
  },
  cardEditBtn: {
    background: 'none',
    border: 'none',
    color: '#64748B',
    padding: '4px 6px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  cardDeleteBtn: {
    background: 'none',
    border: 'none',
    color: '#EF4444',
    padding: '4px 6px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  wardTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 6px 0',
  },
  wardDesc: {
    fontSize: '13px',
    color: '#64748B',
    lineHeight: 1.45,
    margin: '0 0 16px 0',
    minHeight: '38px',
  },
  wardStatsRow: {
    display: 'flex',
    gap: '8px',
    paddingTop: '12px',
    borderTop: '1px solid #F1F5F9',
  },
  wardStatPill: {
    flex: 1,
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    padding: '6px 8px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  statLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  statVal: {
    fontSize: '13px',
    fontWeight: 800,
  },
  loadingBox: {
    textAlign: 'center',
    padding: '60px 20px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #E2E8F0',
    borderTopColor: '#1D4ED8',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto',
  },
  errorBox: {
    background: '#FEF2F2',
    border: '1px solid #FCA5A5',
    padding: '24px',
    borderRadius: '10px',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: '12px',
    padding: '6px 14px',
    background: '#DC2626',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  emptyBox: {
    textAlign: 'center',
    padding: '60px 20px',
    background: '#FFFFFF',
    border: '1px dashed #CBD5E1',
    borderRadius: '10px',
  },
};

const modalStyles = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modal: {
    background: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    width: '100%',
    maxWidth: '520px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  iconBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIconBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: '#FEF2F2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#0F172A',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    color: '#94A3B8',
    cursor: 'pointer',
  },
  sub: {
    fontSize: '13px',
    color: '#64748B',
    marginTop: 0,
    marginBottom: '18px',
    lineHeight: 1.45,
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#334155',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    fontSize: '14px',
    color: '#0F172A',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '9px 12px',
    fontSize: '14px',
    color: '#0F172A',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#FFFFFF',
  },
  textarea: {
    width: '100%',
    padding: '9px 12px',
    fontSize: '14px',
    color: '#0F172A',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
  },
  warningBox: {
    background: '#FEF2F2',
    border: '1px solid #FCA5A5',
    borderRadius: '8px',
    padding: '12px 14px',
    marginBottom: '20px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
  },
  cancelBtn: {
    padding: '9px 16px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#475569',
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  primaryBtn: {
    padding: '9px 18px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#FFFFFF',
    background: '#1D4ED8',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  deleteBtn: {
    padding: '9px 18px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#FFFFFF',
    background: '#DC2626',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};
