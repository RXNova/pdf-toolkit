import { PDFDocument } from 'pdf-lib';
import { loadPdf, savePdf } from '../pdf.js';

/** @type {import('./index.js').ToolHandler} */
export default async function merge({ files, name }) {
  const doc = await PDFDocument.create();
  for (const file of files) {
    const src = await loadPdf(file);
    for (const page of await doc.copyPages(src, src.getPageIndices())) doc.addPage(page);
  }
  return { outputs: [{ name, bytes: await savePdf(doc) }] };
}
