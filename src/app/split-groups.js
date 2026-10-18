// Split's page groups as ranges of 1-based pages: [start, end], start <= end, never overlapping.
// Each group becomes one output file, in ascending page order.
import { parseRanges } from '../core/page-ranges.js';

/** Distinct colours for groups (craft-launcher's app palette), reused in turn. */
export const GROUP_COLORS = ['#2f7bf5', '#e8573f', '#12a58a', '#8b5cf6', '#f2a516', '#e0368f', '#1fa5c9', '#7bb51c'];
export const groupColor = (i) => GROUP_COLORS[i % GROUP_COLORS.length];

/**
 * Groups typed as a spec ("1-3, 4-6, 7-"), or null while it can't be read. Each part spans its
 * lowest to highest page; where parts overlap, the earlier part keeps the page.
 */
export function readGroups(spec, pageCount) {
  if (!String(spec ?? '').trim()) return [];
  let parts;
  try {
    parts = parseRanges(spec, pageCount);
  } catch {
    return null;
  }
  return parts.reduce((groups, idx) => {
    const range = [Math.min(...idx) + 1, Math.max(...idx) + 1];
    return [...groups, ...groups.reduce((pieces, g) => pieces.flatMap((p) => subtract(p, g)), [range])];
  }, []);
}

/** The parts of `range` outside `cut`: none, one, or two ranges. */
export function subtract([s, e], [a, b]) {
  if (b < s || a > e) return [[s, e]];
  const out = [];
  if (s < a) out.push([s, a - 1]);
  if (e > b) out.push([b + 1, e]);
  return out;
}

const sorted = (groups) => [...groups].sort((x, y) => x[0] - y[0]);

/** Make `range` a group of its own, cutting it out of any groups it overlaps. */
export function assign(groups, range) {
  const r = [Math.min(...range), Math.max(...range)];
  return sorted([...groups.flatMap((g) => subtract(g, r)), r]);
}

/** Move one edge of group `i` to `page`. It can't cross its other edge; it takes pages from neighbours. */
export function resize(groups, i, edge, page) {
  const [s, e] = groups[i];
  const range = edge === 'start' ? [Math.min(page, e), e] : [s, Math.max(page, s)];
  return assign(groups.filter((_, j) => j !== i), range);
}

export const removeGroup = (groups, i) => groups.filter((_, j) => j !== i);

/** Every run of pages not yet in a group becomes a group. */
export function addRest(groups, pageCount) {
  let out = groups;
  let start = null;
  const taken = (p) => groups.some(([s, e]) => p >= s && p <= e);
  for (let p = 1; p <= pageCount + 1; p++) {
    if (p <= pageCount && !taken(p)) start ??= p;
    else if (start !== null) {
      out = assign(out, [start, p - 1]);
      start = null;
    }
  }
  return out;
}

/** Groups back to a spec: "1-3, 4, 5-8". */
export const formatGroups = (groups) => groups.map(([s, e]) => (s === e ? String(s) : `${s}-${e}`)).join(', ');
