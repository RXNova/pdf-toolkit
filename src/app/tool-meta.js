import { TOOL_CATALOG } from '../catalog.js';

/** Two-digit number shown on a tool's badge: its position in the catalog ("01"…"12"). */
export const toolNumber = (tool) => String(TOOL_CATALOG.findIndex((t) => t.id === tool.id) + 1).padStart(2, '0');

/** Split a title so its last word can take the accent colour: "Merge PDF" → ["Merge", "PDF"]. */
export function splitTitle(title) {
  const i = title.lastIndexOf(' ');
  return i === -1 ? ['', title] : [title.slice(0, i), title.slice(i + 1)];
}

/** What goes in and what comes out, e.g. "PDF → PDF", "PDF ×N → PDF", "PDF → ZIP". */
export function ioLabel(tool) {
  const input = tool.accept === 'image' ? 'JPG/PNG' : 'PDF';
  const output = tool.id === 'split' ? 'ZIP' : 'PDF';
  return `${input}${tool.multi ? ' ×N' : ''} → ${output}`;
}

/** Status-tag text for a tool card, in the launcher's "INSTALLED · UP TO DATE" style. */
export const toolTag = (tool) => `${tool.multi ? 'Multi-file' : 'Single file'} · Local`;

/** CSS variables for a tool: its tile colour and its accent ink for light and dark themes. */
export const toolStyle = (tool) => ({ '--tile': tool.color, '--ink-light': tool.ink[0], '--ink-dark': tool.ink[1] });
