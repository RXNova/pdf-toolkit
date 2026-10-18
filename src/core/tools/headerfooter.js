import { StandardFonts } from 'pdf-lib';
import { UserError } from '../errors.js';
import { stem } from '../names.js';
import { selectPages } from '../page-ranges.js';
import { checkEncodable, hexToRgb, loadPdf, savePdf } from '../pdf.js';

/** @type {import('./index.js').ToolHandler} */
export default async function headerfooter({ files: [file], options, name }) {
  const { header, footer, align, size, margin } = options;
  if (!header && !footer) throw new UserError('Add header or footer text.');
  const doc = await loadPdf(file);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const chosen = new Set(selectPages(options.ranges, pages.length));
  const vars = { total: pages.length, date: today(), file: stem(file.name) };
  const color = hexToRgb(options.color);

  pages.forEach((page, i) => {
    if (!chosen.has(i)) return;
    const { width, height } = page.getSize();
    for (const [text, y] of [[header, height - margin - size], [footer, margin]]) {
      if (!text) continue;
      const line = fillPlaceholders(text, { ...vars, n: i + 1 });
      checkEncodable(font, line, 'Header and footer text');
      const textWidth = font.widthOfTextAtSize(line, size);
      const x = align === 'left' ? margin : align === 'right' ? width - margin - textWidth : (width - textWidth) / 2;
      page.drawText(line, { x, y, size, font, color });
    }
  });
  return { outputs: [{ name, bytes: await savePdf(doc) }] };
}

/** "{n} of {total} · {file} · {date}" → "3 of 12 · report · 2026-10-18" */
export const fillPlaceholders = (text, vars) => text.replace(/\{(n|total|date|file)\}/g, (_, k) => String(vars[k]));

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
