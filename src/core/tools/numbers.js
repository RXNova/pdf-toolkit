import { rgb, StandardFonts } from 'pdf-lib';
import { loadPdf, savePdf } from '../pdf.js';

const MARGIN = 24;

/** @type {import('./index.js').ToolHandler} */
export default async function numbers({ files: [file], options, name }) {
  const doc = await loadPdf(file);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = options.start + pages.length - 1;
  pages.forEach((page, i) => {
    const label = formatLabel(options.format, options.start + i, total);
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, options.size);
    const at = labelPosition(options.position, { width, height, textWidth, fontSize: options.size });
    page.drawText(label, { ...at, size: options.size, font, color: rgb(0.2, 0.2, 0.2) });
  });
  return { outputs: [{ name, bytes: await savePdf(doc) }] };
}

/** Fill "{n}" and "{total}" placeholders. */
export const formatLabel = (format, n, total) =>
  format.replaceAll('{n}', String(n)).replaceAll('{total}', String(total));

/**
 * @param {string} position e.g. "bottom-center", "top-left"
 * @returns {{ x: number, y: number }} baseline start of the label
 */
export function labelPosition(position, { width, height, textWidth, fontSize }) {
  const [vertical, horizontal] = position.split('-');
  const x =
    horizontal === 'left' ? MARGIN
    : horizontal === 'right' ? width - MARGIN - textWidth
    : (width - textWidth) / 2;
  const y = vertical === 'top' ? height - MARGIN - fontSize : MARGIN;
  return { x, y };
}
