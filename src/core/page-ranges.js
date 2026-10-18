import { UserError } from './errors.js';

/**
 * Parse a page-range spec like "1-3, 5, 8-" into groups of 0-based page indices.
 *
 * - "8-" runs to the last page, "-3" starts at page 1.
 * - Descending ranges ("5-1") yield pages in reverse order.
 * - An empty spec selects every page as a single group.
 *
 * @param {string} spec
 * @param {number} pageCount
 * @returns {number[][]}
 * @throws {UserError} on malformed or out-of-range input
 */
export function parseRanges(spec, pageCount) {
  const trimmed = String(spec ?? '').trim();
  if (!trimmed) return [range(1, pageCount)];

  return trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const dash = part.indexOf('-');
      if (dash === -1) {
        const page = toPage(part, pageCount);
        return [page - 1];
      }
      const startText = part.slice(0, dash).trim();
      const endText = part.slice(dash + 1).trim();
      const start = startText ? toPage(startText, pageCount) : 1;
      const end = endText ? toPage(endText, pageCount) : pageCount;
      return range(start, end);
    });
}

/**
 * All pages selected by a spec, flattened and in order (duplicates kept).
 * @param {string} spec
 * @param {number} pageCount
 */
export const selectPages = (spec, pageCount) => parseRanges(spec, pageCount).flat();

/** Inclusive 1-based range → 0-based indices, ascending or descending. */
function range(start, end) {
  const step = start <= end ? 1 : -1;
  const out = [];
  for (let page = start; page !== end + step; page += step) out.push(page - 1);
  return out;
}

function toPage(text, pageCount) {
  if (!/^\d+$/.test(text)) throw new UserError(`"${text}" is not a page number.`);
  const page = Number(text);
  if (page < 1 || page > pageCount) {
    throw new UserError(`Page ${page} is out of range (the document has ${pageCount} page${pageCount === 1 ? '' : 's'}).`);
  }
  return page;
}

/**
 * The inverse of selectPages: 1-based pages, in the given order, as a compact spec.
 * Ascending runs collapse ("1, 2, 3, 7" → "1-3, 7"); everything else is kept as listed.
 * @param {number[]} pages
 */
export function formatRanges(pages) {
  const parts = [];
  for (let i = 0; i < pages.length; ) {
    let j = i;
    while (j + 1 < pages.length && pages[j + 1] === pages[j] + 1) j++;
    parts.push(j > i ? `${pages[i]}-${pages[j]}` : String(pages[i]));
    i = j + 1;
  }
  return parts.join(', ');
}
