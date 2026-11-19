import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import WardSelect from '../components/WardSelect';
import StatusBadge from '../components/StatusBadge';
import { getAllIssues } from '../services/issueService';

const CATEGORIES = ['Road Hazard', 'Water Drainage', 'Waste Management', 'Street Lighting', 'Other'];
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed', 'Disputed'];
const SORTS = [
  { value: 'votes', label: 'Most voted' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];
const PAGE_SIZE = 9;
const EMPTY_FILTERS = { search: '', category: '', status: '', ward_id: '', sort: 'votes' };

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo',
  });

function useDebounced(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="h-40 bg-gray-200" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-1/3 rounded bg-gray-200" />
        <div className="h-5 w-3/4 rounded bg-gray-200" />
        <div className="h-4 w-full rounded bg-gray-200" />
      </div>
    </div>
  );
}

function IssueCard({ issue }) {
  return (
    <Link
      to={`/issue/${issue.ISSUE_ID}`}
      className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-600"
    >
      {issue.BEFORE_PHOTO ? (
        <img
          src={issue.BEFORE_PHOTO}
          alt={`Photo for: ${issue.TITLE}`}
          loading="lazy"
          className="h-40 w-full object-cover"
        />
      ) : (
        <div className="flex h-40 items-center justify-center bg-gray-100 text-sm text-gray-500">
          No photo
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <StatusBadge status={issue.STATUS} emergency={!!issue.IS_EMERGENCY} />
        <h2 className="text-lg font-semibold text-gray-900">{issue.TITLE}</h2>
        <p className="line-clamp-2 text-sm text-gray-600">{issue.DESCRIPTION}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-2 text-xs text-gray-500">
          <span>{issue.CATEGORY} · {issue.WARD_NAME}</span>
          <span>{formatDate(issue.CREATED_AT)}</span>
        </div>
        <div className="text-sm font-medium text-gray-700">
          Net votes: {issue.NET_VOTES}
        </div>
      </div>
    </Link>
  );
}

export default function IssueList() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [issues, setIssues] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const debouncedSearch = useDebounced(filters.search);

  const setFilter = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  };

  useEffect(() => {
    let ignore = false; // drops results from outdated requests
    setLoading(true);
    setError('');

    const params = { page, limit: PAGE_SIZE, sort: filters.sort };
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (filters.category) params.category = filters.category;
    if (filters.status) params.status = filters.status;
    if (filters.ward_id) params.ward_id = filters.ward_id;

    getAllIssues(params)
      .then((res) => {
        if (ignore) return;
        setIssues(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => {
        if (ignore) return;
        setError(err.response?.data?.message || 'Could not load issues. Check your connection and try again.');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => { ignore = true; };
  }, [page, filters.category, filters.status, filters.ward_id, filters.sort, debouncedSearch, reloadKey]);

  const hasFilters =
    filters.search || filters.category || filters.status || filters.ward_id || filters.sort !== 'votes';

  const selectClass = 'w-full min-h-11 rounded border border-gray-300 bg-white p-2';

  return (
    <main className="mx-auto max-w-6xl p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Reported issues</h1>
        <Link to="/report" className="min-h-11 rounded bg-blue-600 px-5 py-2 text-white">
          Report an issue
        </Link>
      </div>

      {/* Filters */}
      <section aria-label="Filters" className="mb-4 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label htmlFor="search" className="mb-1 block text-sm font-medium">Search</label>
          <input
            id="search"
            type="search"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            placeholder="Search by title or description"
            maxLength={100}
            className={selectClass}
          />
        </div>
        <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium">Category</label>
          <select id="category" value={filters.category} onChange={(e) => setFilter('category', e.target.value)} className={selectClass}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium">Status</label>
          <select id="status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className={selectClass}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sort" className="mb-1 block text-sm font-medium">Sort by</label>
          <select id="sort" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} className={selectClass}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          {/* choose "None" in this dropdown to show all wards */}
             <WardSelect value={filters.ward_id} onChange={(id) => setFilter('ward_id', id)} allLabel="All wards" />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            disabled={!hasFilters}
            onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}
            className="min-h-11 w-full rounded border px-4 py-2 disabled:opacity-40"
          >
            Clear filters
          </button>
        </div>
      </section>

      <p className="mb-3 text-sm text-gray-600" aria-live="polite">
        {loading ? 'Loading issues…' : `${pagination.total} issue${pagination.total === 1 ? '' : 's'} found`}
      </p>

      {/* Error */}
      {error && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded bg-red-50 p-4 text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="rounded border border-red-300 px-4 py-2">
            Try again
          </button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && issues.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-600">
          <p className="mb-3 text-lg">No issues match your filters.</p>
          {hasFilters && (
            <button type="button" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }} className="underline">
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {!loading && !error && issues.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {issues.map((issue) => <IssueCard key={issue.ISSUE_ID} issue={issue} />)}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && pagination.totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => p - 1)}
            disabled={page <= 1}
            className="min-h-11 rounded border px-5 py-2 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">Page {page} of {pagination.totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= pagination.totalPages}
            className="min-h-11 rounded border px-5 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
    </main>
  );
}