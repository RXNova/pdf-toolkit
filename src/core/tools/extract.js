import { selectPages } from '../page-ranges.js';
import { loadPdf, pagesToNewPdf, savePdf } from '../pdf.js';

/** @type {import('./index.js').ToolHandler} */
export default async function extract({ files: [file], options, name }) {
  const src = await loadPdf(file);
  const pages = selectPages(options.ranges, src.getPageCount());
  return { outputs: [{ name, bytes: await savePdf(await pagesToNewPdf(src, pages)) }] };
}
