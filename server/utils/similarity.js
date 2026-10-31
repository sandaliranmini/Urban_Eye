// Common words that carry no meaning for matching (English only)
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'in', 'on', 'at', 'of', 'to',
  'and', 'or', 'for', 'from', 'with', 'by', 'it', 'its', 'this', 'that', 'there', 'near',
  'has', 'have', 'had', 'very', 'please', 'since', 'not', 'no', 'my', 'our',
]);

function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ') // keeps Sinhala and Tamil letters and marks
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)); // potholes -> pothole
}

// Jaccard similarity: shared words / all distinct words (0 to 1)
function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const word of A) if (B.has(word)) shared += 1;
  return shared / (A.size + B.size - shared);
}

// Returns the most similar candidates, each with a SIMILARITY percentage
function findSimilar(report, candidates, { threshold = 0.35, max = 3 } = {}) {
  const reportTitle = tokens(report.title);
  const reportAll = tokens(`${report.title} ${report.description}`);

  return candidates
    .map((c) => {
      const titleScore = jaccard(reportTitle, tokens(c.TITLE));
      const allScore = jaccard(reportAll, tokens(`${c.TITLE} ${c.DESCRIPTION}`));
      const score = Math.max(titleScore, allScore);
      return { ...c, SIMILARITY: Math.round(score * 100), _score: score };
    })
    .filter((c) => c._score >= threshold)
    .sort((x, y) => y._score - x._score)
    .slice(0, max)
    .map(({ _score, ...rest }) => rest);
}

module.exports = { findSimilar, tokens, jaccard };
