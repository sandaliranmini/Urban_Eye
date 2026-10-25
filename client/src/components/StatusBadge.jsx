// Colours follow the proposal: yellow Open, blue In Progress, green Resolved, red Emergency.
// The text label is always shown too, so colour is never the only signal.
const STYLES = {
  Open: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'In Progress': 'bg-blue-100 text-blue-800 border-blue-300',
  Resolved: 'bg-green-100 text-green-800 border-green-300',
  Closed: 'bg-gray-100 text-gray-700 border-gray-300',
  Disputed: 'bg-orange-100 text-orange-800 border-orange-300',
};

export default function StatusBadge({ status, emergency = false }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {emergency && (
        <span className="rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
          Emergency
        </span>
      )}
      <span
        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STYLES[status] || STYLES.Closed}`}
      >
        {status}
      </span>
    </span>
  );
}