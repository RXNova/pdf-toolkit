import { stem } from '../names.js';
import { parseRanges } from '../page-ranges.js';
import { loadPdf, pagesToNewPdf, savePdf } from '../pdf.js';

/** @type {import('./index.js').ToolHandler} */
export default async function split({ files: [file], options }) {
  const src = await loadPdf(file);
  const groups =
    options.mode === 'every'
      ? src.getPageIndices().map((i) => [i])
      : parseRanges(options.ranges, src.getPageCount());

  const base = stem(file.name);
  const outputs = [];
  for (const group of groups) {
    outputs.push({ name: splitName(base, group), bytes: await savePdf(await pagesToNewPdf(src, group)) });
  }
  return { outputs };
}

/** "report_p3.pdf" for one page, "report_p1-4.pdf" for a range. */
export function splitName(base, group) {
  const first = group[0] + 1;
  const last = group[group.length - 1] + 1;
  return first === last ? `${base}_p${first}.pdf` : `${base}_p${first}-${last}.pdf`;
}
