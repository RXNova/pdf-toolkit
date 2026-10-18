import { UserError } from '../errors.js';
import { selectPages } from '../page-ranges.js';
import { loadPdf, pagesToNewPdf, savePdf } from '../pdf.js';

/** @type {import('./index.js').ToolHandler} */
export default async function remove({ files: [file], options, name }) {
  const src = await loadPdf(file);
  const drop = new Set(selectPages(options.ranges, src.getPageCount()));
  const keep = src.getPageIndices().filter((i) => !drop.has(i));
  if (keep.length === 0) throw new UserError('That would remove every page.');
  return { outputs: [{ name, bytes: await savePdf(await pagesToNewPdf(src, keep)) }] };
}
