import { PDFName } from 'pdf-lib';
import { loadPdf, savePdf } from '../pdf.js';

const INFO_KEYS = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate', 'Trapped'];

/** @type {import('./index.js').ToolHandler} */
export default async function metadata({ files: [file], options, name }) {
  const doc = await loadPdf(file, { updateMetadata: false }); // don't stamp pdf-lib as the producer
  const info = doc.getInfoDict();

  if (options.action === 'strip') {
    for (const key of INFO_KEYS) info.delete(PDFName.of(key));
    doc.catalog.delete(PDFName.of('Metadata')); // XMP copy of the same details
    return { outputs: [{ name, bytes: await savePdf(doc) }], summary: 'Removed all document properties.' };
  }

  const set = (key, value, apply) => (value ? apply(value) : info.delete(PDFName.of(key)));
  set('Title', options.title, (v) => doc.setTitle(v));
  set('Author', options.author, (v) => doc.setAuthor(v));
  set('Subject', options.subject, (v) => doc.setSubject(v));
  set('Keywords', options.keywords, (v) => doc.setKeywords(v.split(',').map((k) => k.trim()).filter(Boolean)));
  doc.catalog.delete(PDFName.of('Metadata')); // a stale XMP copy would contradict the new values
  return { outputs: [{ name, bytes: await savePdf(doc) }] };
}
