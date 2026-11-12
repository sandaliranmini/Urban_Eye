import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../../services/announcementService';
import axiosInstance from '../../services/axiosInstance';

const CATEGORY_STYLES = {
  Safety: {
    bg: 'bg-red-50 text-red-700 border-red-200',
    badge: 'bg-red-100 text-red-800',
    accent: 'border-l-4 border-l-red-500',
  },
  Maintenance: {
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    accent: 'border-l-4 border-l-amber-500',
  },
  Utility: {
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
    badge: 'bg-blue-100 text-blue-800',
    accent: 'border-l-4 border-l-blue-500',
  },
};

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function WardAnnouncements({ user, canManage = false }) {
  const [announcements, setAnnouncements] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [wardFilter, setWardFilter] = useState('ALL');
  const [showExpired, setShowExpired] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete confirm state
  const [deleteId, setDeleteId] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Form inputs
  const initialForm = {
    title: '',
    body: '',
    category: 'Maintenance',
    ward_id: '',
    is_pinned: false,
    expires_at: '',
  };
  const [formData, setFormData] = useState(initialForm);

  // Determine if current user can manage
  const isOfficerOrAdmin = canManage || ['admin', 'supervisor', 'field_officer'].includes(user?.role);

  // Fetch wards for dropdown
  useEffect(() => {
    axiosInstance
      .get('/wards')
      .then((res) => setWards(res.data || []))
      .catch(() => {});
  }, []);

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (wardFilter !== 'ALL') params.ward_id = wardFilter;
      if (!showExpired) params.active_only = '1';
      if (search.trim()) params.search = search.trim();

      const res = await getAllAnnouncements(params);
      setAnnouncements(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, wardFilter, showExpired, search]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Handle open modal for create
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      ...initialForm,
      ward_id: user?.ward_id ? String(user.ward_id) : '',
    });
    setFormError('');
    setModalOpen(true);
  };

  // Handle open modal for edit
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      title: item.TITLE || '',
      body: item.BODY || '',
      category: item.CATEGORY || 'Maintenance',
      ward_id: item.WARD_ID ? String(item.WARD_ID) : '',
      is_pinned: Boolean(item.IS_PINNED),
      expires_at: item.EXPIRES_AT ? item.EXPIRES_AT.slice(0, 16) : '',
    });
    setFormError('');
    setModalOpen(true);
  };

  // Submit create or edit
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.title.trim()) {
      setFormError('Title is required');
      return;
    }
    if (formData.title.trim().length < 3 || formData.title.trim().length > 150) {
      setFormError('Title must be between 3 and 150 characters');
      return;
    }
    if (!formData.body.trim()) {
      setFormError('Body text is required');
      return;
    }
    if (formData.body.trim().length < 5) {
      setFormError('Body text must be at least 5 characters');
      return;
    }

    setFormBusy(true);
    try {
      const payload = {
        title: formData.title.trim(),
        body: formData.body.trim(),
        category: formData.category,
        ward_id: formData.ward_id ? Number(formData.ward_id) : null,
        is_pinned: formData.is_pinned,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
      };

      if (editingItem) {
        await updateAnnouncement(editingItem.ANNOUNCEMENT_ID, payload);
        setSuccessMsg('Announcement updated successfully');
      } else {
        await createAnnouncement(payload);
        setSuccessMsg('Announcement published successfully');
      }

      setModalOpen(false);
      fetchAnnouncements();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save announcement');
    } finally {
      setFormBusy(false);
    }
  };

  // Delete announcement
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteBusy(true);
    try {
      await deleteAnnouncement(deleteId);
      setSuccessMsg('Announcement deleted successfully');
      setDeleteId(null);
      fetchAnnouncements();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to delete announcement');
    } finally {
      setDeleteBusy(false);
    }
  };

  // Filtered in-memory by search term
  const displayedAnnouncements = useMemo(() => {
    if (!search.trim()) return announcements;
    const term = search.toLowerCase();
    return announcements.filter(
      (a) =>
        a.TITLE?.toLowerCase().includes(term) ||
        a.BODY?.toLowerCase().includes(term) ||
        a.WARD_NAME?.toLowerCase().includes(term)
    );
  }, [announcements, search]);

  const pinnedList = displayedAnnouncements.filter((a) => a.IS_PINNED);
  const regularList = displayedAnnouncements.filter((a) => !a.IS_PINNED);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner / Actions Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </span>
            <h1 className="text-2xl font-bold text-gray-900">Ward Announcements</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Official municipal notices, utility schedules, and safety advisories for your community.
          </p>
        </div>

        {isOfficerOrAdmin && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#17324D] hover:bg-[#1f4367] text-white font-medium rounded-xl shadow-xs transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Post Announcement
          </button>
        )}
      </div>

      {/* Success Notice */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900 text-sm">✕</button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input
              type="text"
              placeholder="Search announcements…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#17324D] focus:border-transparent"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#17324D]"
          >
            <option value="ALL">All Categories</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Safety">Safety</option>
            <option value="Utility">Utility</option>
          </select>

          {/* Ward Filter */}
          <select
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#17324D]"
          >
            <option value="ALL">All Wards / Scopes</option>
            <option value="null">Council-wide Only</option>
            {wards.map((w) => (
              <option key={w.WARD_ID} value={w.WARD_ID}>
                {w.WARD_NAME}
              </option>
            ))}
          </select>
        </div>

        {/* Toggle Expired (Officer/Admin only) */}
        {isOfficerOrAdmin && (
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showExpired}
              onChange={(e) => setShowExpired(e.target.checked)}
              className="rounded text-[#17324D] focus:ring-[#17324D]"
            />
            Show Expired Announcements
          </label>
        )}
      </div>

      {/* Loading & Error States */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-gray-200">
          <div className="w-8 h-8 border-4 border-[#17324D] border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm text-gray-500">Loading announcements…</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <p className="font-medium">Error loading announcements</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchAnnouncements}
            className="mt-3 text-sm underline font-semibold text-red-800"
          >
            Try Again
          </button>
        </div>
      ) : displayedAnnouncements.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <h3 className="text-base font-semibold text-gray-800">No announcements found</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            {search || categoryFilter !== 'ALL' || wardFilter !== 'ALL'
              ? 'Try adjusting your search criteria or category filters.'
              : 'There are currently no active announcements for this selection.'}
          </p>
          {isOfficerOrAdmin && (
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 bg-[#17324D] text-white text-sm font-medium rounded-lg hover:bg-[#1f4367] transition"
            >
              Post the First Announcement
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pinned Announcements Section */}
          {pinnedList.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700">
                <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                </svg>
                Pinned Notices ({pinnedList.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pinnedList.map((item) => (
                  <AnnouncementCard
                    key={item.ANNOUNCEMENT_ID}
                    item={item}
                    isOfficerOrAdmin={isOfficerOrAdmin}
                    currentUserId={user?.officer_id ?? user?.id}
                    currentUserRole={user?.role}
                    onEdit={() => handleOpenEdit(item)}
                    onDelete={() => setDeleteId(item.ANNOUNCEMENT_ID)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Regular Announcements Section */}
          {regularList.length > 0 && (
            <div className="space-y-3">
              {pinnedList.length > 0 && (
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 pt-2">
                  Recent Announcements ({regularList.length})
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {regularList.map((item) => (
                  <AnnouncementCard
                    key={item.ANNOUNCEMENT_ID}
                    item={item}
                    isOfficerOrAdmin={isOfficerOrAdmin}
                    currentUserId={user?.officer_id ?? user?.id}
                    currentUserRole={user?.role}
                    onEdit={() => handleOpenEdit(item)}
                    onDelete={() => setDeleteId(item.ANNOUNCEMENT_ID)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingItem ? 'Edit Announcement' : 'Post New Announcement'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={150}
                  placeholder="e.g. Scheduled Water Supply Interruption"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#17324D] focus:border-transparent"
                  required
                />
                <div className="text-right text-xs text-gray-400 mt-0.5">
                  {formData.title.length}/150
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#17324D]"
                  >
                    <option value="Maintenance">Maintenance</option>
                    <option value="Safety">Safety</option>
                    <option value="Utility">Utility</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Target Scope
                  </label>
                  <select
                    value={formData.ward_id}
                    onChange={(e) => setFormData({ ...formData, ward_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#17324D]"
                  >
                    <option value="">All Wards (Council-wide)</option>
                    {wards.map((w) => (
                      <option key={w.WARD_ID} value={w.WARD_ID}>
                        {w.WARD_NAME}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Announcement Details <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={5}
                  placeholder="Provide detailed instructions, affected areas, timings, and contact numbers…"
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#17324D] focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Expiry Date (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#17324D]"
                  />
                  <span className="text-xs text-gray-400">Notice automatically hides after this time</span>
                </div>

                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.is_pinned}
                      onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                      className="w-4 h-4 rounded text-[#17324D] focus:ring-[#17324D]"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Pin to top of feed
                    </span>
                  </label>
                  <span className="text-xs text-gray-400 block ml-6">
                    Highlighted prominently for citizens
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                  disabled={formBusy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formBusy}
                  className="px-5 py-2 bg-[#17324D] text-white text-sm font-medium rounded-lg hover:bg-[#1f4367] transition disabled:opacity-50 flex items-center gap-2"
                >
                  {formBusy ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving…
                    </>
                  ) : editingItem ? (
                    'Update Announcement'
                  ) : (
                    'Publish Announcement'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center">Delete Announcement?</h3>
            <p className="text-sm text-gray-500 text-center mt-2">
              Are you sure you want to delete this announcement? This action is recorded in the municipal audit trail.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 flex-1"
                disabled={deleteBusy}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteBusy}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition flex-1"
              >
                {deleteBusy ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Single Announcement Card Component
function AnnouncementCard({
  item,
  isOfficerOrAdmin,
  currentUserId,
  currentUserRole,
  onEdit,
  onDelete,
}) {
  const catTheme = CATEGORY_STYLES[item.CATEGORY] || CATEGORY_STYLES.Maintenance;
  const isAuthorOrAdmin =
    currentUserRole === 'admin' ||
    currentUserRole === 'supervisor' ||
    item.OFFICER_ID === currentUserId;

  const isExpired = Boolean(item.IS_EXPIRED);

  return (
    <div
      className={`bg-white rounded-xl p-5 border border-gray-200 shadow-xs hover:shadow-md transition flex flex-col justify-between ${
        item.IS_PINNED ? 'border-amber-300 ring-1 ring-amber-200 bg-amber-50/20' : ''
      }`}
    >
      <div>
        {/* Badges row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${catTheme.badge}`}>
              {item.CATEGORY}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {item.WARD_NAME ? `Ward: ${item.WARD_NAME}` : 'Council-wide'}
            </span>
            {item.IS_PINNED === 1 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 flex items-center gap-1">
                📌 Pinned
              </span>
            )}
            {isExpired && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-600">
                Expired
              </span>
            )}
          </div>

          {/* Edit / Delete actions for authorized officer/admin */}
          {isOfficerOrAdmin && isAuthorOrAdmin && (
            <div className="flex items-center gap-1">
              <button
                onClick={onEdit}
                title="Edit Announcement"
                className="p-1.5 text-gray-400 hover:text-[#17324D] rounded-md hover:bg-gray-100 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={onDelete}
                title="Delete Announcement"
                className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-gray-900 leading-snug mb-2">
          {item.TITLE}
        </h3>

        {/* Body content */}
        <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed mb-4">
          {item.BODY}
        </p>
      </div>

      {/* Footer metadata */}
      <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between text-xs text-gray-400 gap-2">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>{item.OFFICER_NAME || 'Municipal Council Officer'}</span>
        </div>

        <div className="flex items-center gap-3">
          <span>Posted: {formatDate(item.CREATED_AT)}</span>
          {item.EXPIRES_AT && (
            <span className={isExpired ? 'text-red-500 font-medium' : 'text-gray-400'}>
              Expires: {formatDate(item.EXPIRES_AT)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
