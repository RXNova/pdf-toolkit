import { PDFDocument, rgb } from 'pdf-lib';
import { UserError } from './errors.js';

/**
 * @typedef {{ name: string, bytes: Uint8Array }} NamedBytes
 */

/**
 * @param {NamedBytes} file
 * @returns {Promise<PDFDocument>}
 * @throws {UserError} when the file is encrypted or not a readable PDF
 */
export async function loadPdf({ name, bytes }, loadOptions) {
  try {
    return await PDFDocument.load(bytes, loadOptions);
  } catch (err) {
    if (/encrypt/i.test(err.message)) {
      throw new UserError(`${name} is password-protected. Use “Unlock PDF” first.`, { cause: err });
    }
    throw new UserError(`${name} is not a valid PDF.`, { cause: err });
  }
}

/**
 * Check that a file is a PDF without decrypting it.
 * @param {NamedBytes} file
 * @returns {Promise<{ encrypted: boolean }>}
 * @throws {UserError} when the file isn't a readable PDF
 */
export async function inspectPdf({ name, bytes }) {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    return { encrypted: doc.isEncrypted };
  } catch (err) {
    throw new UserError(`${name} is not a valid PDF.`, { cause: err });
  }
}

/** @param {PDFDocument} doc @returns {Promise<Uint8Array>} */
export const savePdf = (doc) => doc.save({ useObjectStreams: true });

/**
 * New document containing the given pages of `src`, in order.
 * @param {PDFDocument} src
 * @param {number[]} indices 0-based
 */
export async function pagesToNewPdf(src, indices) {
  const doc = await PDFDocument.create();
  for (const page of await doc.copyPages(src, indices)) doc.addPage(page);
  return doc;
}

/** "#rrggbb" → pdf-lib color. Input is already validated by the option schema. */
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** "data:image/png;base64,…" → { kind, bytes }. The option schema has already checked the format. */
export function decodeDataUrl(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  return { kind: head.includes('image/png') ? 'png' : 'jpeg', bytes: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) };
}

/** Embed a PNG/JPEG data: URL into `doc`. */
export async function embedDataUrlImage(doc, dataUrl, label = 'The image') {
  const { kind, bytes } = decodeDataUrl(dataUrl);
  try {
    return kind === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch (err) {
    throw new UserError(`${label} couldn’t be read as a ${kind.toUpperCase()}.`, { cause: err });
  }
}

/**
 * Where an image goes on a page, from a placement given as fractions of the page:
 * x, y = the image's top-left corner from the page's top-left; w = its width.
 * Height follows the image's aspect ratio. Returns pdf-lib coordinates (origin bottom-left).
 */
export function placementRect({ x, y, w }, { width, height }, image) {
  const dw = w * width;
  const dh = (dw * image.height) / image.width;
  return { x: x * width, y: height - y * height - dh, width: dw, height: dh };
}

/** Throws a UserError when the standard font can't draw `text` (it only covers Latin text). */
export function checkEncodable(font, text, what = 'The text') {
  try {
    font.widthOfTextAtSize(text, 10);
  } catch (err) {
    throw new UserError(`${what} can only use Latin letters, digits and common symbols (the standard PDF fonts).`, { cause: err });
  }
}
