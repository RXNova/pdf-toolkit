import { StandardFonts } from 'pdf-lib';
import { UserError } from '../errors.js';
import { checkEncodable, embedDataUrlImage, hexToRgb, loadPdf, placementRect, savePdf } from '../pdf.js';
import { fillForm } from './form-fields.js';

const ASCENT = 0.78; // Helvetica's baseline sits this far (in font sizes) below the top of a line
const DATA_URL = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;

/**
 * Fill & sign: fill form fields, then put signatures, images and text on pages.
 *
 * Items are { kind: 'image' | 'text', page, x, y, w, allPages?, src? (image data: URL),
 * text?, color? }, placed in page fractions: x, y = top-left corner, w = width. An image's
 * height follows its aspect ratio; text is sized so it spans exactly `w`.
 * @type {import('./index.js').ToolHandler}
 */
export default async function fillsign({ files: [file], options, name }) {
  const items = options.items.map(checkItem);
  const values = options.values;
  if (!items.length && !Object.keys(values).length) throw new UserError('Add a signature, text or image, or fill in the form.');

  const doc = await loadPdf(file);
  const pages = doc.getPages();
  const form = doc.getForm();
  const hasForm = form.getFields().length > 0;
  const filled = hasForm ? fillForm(form, values) : 0;

  const font = items.some((i) => i.kind === 'text') ? await doc.embedFont(StandardFonts.Helvetica) : null;
  const images = new Map(); // one embedded copy per distinct image
  for (const item of items) {
    if (item.page > pages.length) throw new UserError(`Page ${item.page} is out of range (the document has ${pages.length} pages).`);
    const targets = item.allPages ? pages : [pages[item.page - 1]];
    if (item.kind === 'image') {
      if (!images.has(item.src)) images.set(item.src, await embedDataUrlImage(doc, item.src));
      const image = images.get(item.src);
      for (const page of targets) page.drawImage(image, placementRect(item, page.getSize(), image));
    } else {
      checkEncodable(font, item.text, 'Text on the page');
      for (const page of targets) page.drawText(item.text, { ...textPlacement(item, page.getSize(), font), font, color: hexToRgb(item.color) });
    }
  }

  if (hasForm && options.flatten === 'yes') {
    try {
      form.flatten();
    } catch (err) {
      throw new UserError('This form couldn’t be flattened. Try “Keep editable”.', { cause: err });
    }
  }
  return { outputs: [{ name, bytes: await savePdf(doc) }], summary: summarize(items, filled, hasForm && options.flatten === 'yes') };
}

/** Text sized to span `w` of the page width, its top edge at `y`. */
export function textPlacement({ x, y, w, text }, { width, height }, font) {
  const size = (w * width) / Math.max(font.widthOfTextAtSize(text, 1), 0.01);
  return { x: x * width, y: height - y * height - size * ASCENT, size };
}

const fraction = (n) => typeof n === 'number' && n >= 0 && n <= 1;

/** Validate one item from the UI (untrusted: it came through postMessage). */
export function checkItem(item) {
  const ok = item && (item.kind === 'image' || item.kind === 'text')
    && Number.isInteger(item.page) && item.page >= 1
    && fraction(item.x) && fraction(item.y) && fraction(item.w) && item.w > 0
    && (item.kind === 'image' ? DATA_URL.test(item.src ?? '') : typeof item.text === 'string' && /^#[0-9a-f]{6}$/i.test(item.color ?? ''));
  if (!ok) throw new UserError('One of the items on the page isn’t valid. Remove it and add it again.');
  if (item.kind === 'text' && !item.text.trim()) throw new UserError('A text box on the page is empty. Type something or remove it.');
  return item;
}

function summarize(items, filled, locked) {
  const parts = [];
  if (filled) parts.push(`filled ${filled} field${filled === 1 ? '' : 's'}`);
  if (items.length) parts.push(`added ${items.length} item${items.length === 1 ? '' : 's'}`);
  const line = parts.join(' and ');
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}${locked ? ', and locked the form' : ''}.`;
}
