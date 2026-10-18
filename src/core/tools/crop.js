import { PDFDocument } from 'pdf-lib';
import { UserError } from '../errors.js';
import { selectPages } from '../page-ranges.js';
import { loadPdf, savePdf } from '../pdf.js';

const MM = 72 / 25.4;
const MIN_SIDE = 36; // pt: a cropped page must keep at least half an inch each way

/** Portrait page sizes in PDF points. */
export const SIZES = Object.freeze({ a4: [595.28, 841.89], letter: [612, 792], a5: [419.53, 595.28], legal: [612, 1008] });

/** @type {import('./index.js').ToolHandler} */
export default async function crop({ files: [file], options, name }) {
  const src = await loadPdf(file);
  const chosen = new Set(selectPages(options.ranges, src.getPageCount()));
  const doc = options.mode === 'resize' ? await resizePages(src, chosen, options) : trimPages(src, chosen, options);
  return { outputs: [{ name, bytes: await savePdf(doc) }] };
}

function trimPages(doc, chosen, { top, right, bottom, left }) {
  doc.getPages().forEach((page, i) => {
    if (!chosen.has(i)) return;
    const box = page.getCropBox();
    const next = {
      x: box.x + left * MM,
      y: box.y + bottom * MM,
      width: box.width - (left + right) * MM,
      height: box.height - (top + bottom) * MM,
    };
    if (next.width < MIN_SIDE || next.height < MIN_SIDE) {
      throw new UserError(`Those margins leave almost nothing of page ${i + 1}. Use smaller margins.`);
    }
    page.setMediaBox(next.x, next.y, next.width, next.height);
    page.setCropBox(next.x, next.y, next.width, next.height);
  });
  return doc;
}

/** Target page size for a page, honouring the orientation choice ("auto" follows the page). */
export function targetSize(size, orientation, { width, height }) {
  const [w, h] = SIZES[size];
  const landscape = orientation === 'landscape' || (orientation === 'auto' && width > height);
  return landscape ? [h, w] : [w, h];
}

/** Scale and center content of size `inner` inside `outer`, keeping its proportions. */
export function fitInside([iw, ih], [ow, oh]) {
  const scale = Math.min(ow / iw, oh / ih);
  return { scale, x: (ow - iw * scale) / 2, y: (oh - ih * scale) / 2 };
}

async function resizePages(src, chosen, { size, orientation }) {
  const out = await PDFDocument.create();
  const pages = src.getPages();
  for (let i = 0; i < pages.length; i++) {
    if (!chosen.has(i)) {
      const [copy] = await out.copyPages(src, [i]);
      out.addPage(copy);
      continue;
    }
    const { width, height } = pages[i].getSize();
    const target = targetSize(size, orientation, { width, height });
    if (!pages[i].node.Contents()) {
      out.addPage(target); // a blank page: nothing to scale
      continue;
    }
    const [embedded] = await out.embedPages([pages[i]]);
    const fit = fitInside([width, height], target);
    out.addPage(target).drawPage(embedded, { x: fit.x, y: fit.y, xScale: fit.scale, yScale: fit.scale });
  }
  return out;
}
