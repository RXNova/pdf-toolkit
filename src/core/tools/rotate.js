import { degrees } from 'pdf-lib';
import { selectPages } from '../page-ranges.js';
import { loadPdf, savePdf } from '../pdf.js';

/** @type {import('./index.js').ToolHandler} */
export default async function rotate({ files: [file], options, name }) {
  const doc = await loadPdf(file);
  const pages = doc.getPages();
  const delta = Number(options.angle);
  // Set, so "1, 1" doesn't rotate page 1 twice.
  for (const i of new Set(selectPages(options.ranges, pages.length))) {
    const page = pages[i];
    page.setRotation(degrees(normalizeAngle(page.getRotation().angle + delta)));
  }
  return { outputs: [{ name, bytes: await savePdf(doc) }] };
}

export const normalizeAngle = (angle) => ((angle % 360) + 360) % 360;
