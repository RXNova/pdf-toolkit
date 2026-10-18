// Test fixtures shared by unit and e2e tests. Everything is generated in memory: no binary files in the repo.
import zlib from 'node:zlib';
import { PDFDocument, PDFName, PDFRawStream, StandardFonts } from 'pdf-lib';

/** { name, bytes } as the toolkit expects. */
export const named = (name, bytes) => ({ name, bytes });

/**
 * A PDF whose page i (1-based) says "Page i", so tests can tell pages apart.
 * @param {{ pages?: number, size?: [number, number] }} [opts]
 */
export async function pdfBytes({ pages = 3, size = [300, 400] } = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) doc.addPage(size).drawText(`Page ${i}`, { x: 40, y: 40, size: 12, font });
  return doc.save();
}

/** A PDF whose trailer declares encryption: enough for pdf-lib to refuse to load it. */
export async function encryptedMarkerPdfBytes() {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.context.trailerInfo.Encrypt = doc.context.obj({ Filter: 'Standard' });
  return doc.save({ useObjectStreams: false });
}

/**
 * An RGB PNG. `noise` fills it with random pixels so it barely compresses: useful
 * for producing PDFs that real JPEG re-encoding can shrink.
 */
export function pngBytes(width = 40, height = 20, { noise = false } = {}) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1); // first byte of each row is the filter type (0 = none)
    for (let x = 0; x < width * 3; x++) raw[row + 1 + x] = noise ? (Math.random() * 256) | 0 : 0x80;
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit, truecolor, deflate, no filter, no interlace
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

// Smallest well-formed JPEG (1×1). pdf-lib only parses its headers.
const TINY_JPEG =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
export const jpgBytes = () => new Uint8Array(Buffer.from(TINY_JPEG, 'base64'));

/** A one-page PDF that contains the given PNG as a full-page image. */
export async function pdfWithImage(png) {
  const doc = await PDFDocument.create();
  const image = await doc.embedPng(png);
  doc.addPage([image.width, image.height]).drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  return doc.save();
}

export const readPdf = (bytes) => PDFDocument.load(bytes);
export const pageCount = async (bytes) => (await readPdf(bytes)).getPageCount();

/**
 * Whether any content stream draws `text`. pdf-lib writes standard-font text as hex
 * strings, so both literal "(text)" and hex "<…>" forms are checked.
 */
export async function pdfContainsText(bytes, text) {
  const doc = await readPdf(bytes);
  const hex = Buffer.from(text, 'latin1').toString('hex').toUpperCase();
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    let data = Buffer.from(obj.contents);
    if (obj.dict.get(PDFName.of('Filter')) === PDFName.of('FlateDecode')) {
      try {
        data = zlib.inflateSync(data);
      } catch {
        continue;
      }
    }
    const content = data.toString('latin1');
    if (content.includes(`(${text})`) || content.toUpperCase().includes(`<${hex}>`)) return true;
  }
  return false;
}

/** The "Page N" label of each page, in order (null when a page has none). */
export async function pageLabels(bytes, maxPage = 50) {
  const doc = await readPdf(bytes);
  const labels = [];
  for (let i = 0; i < doc.getPageCount(); i++) {
    const single = await PDFDocument.create();
    const [page] = await single.copyPages(doc, [i]);
    single.addPage(page);
    const pageBytes = await single.save();
    let found = null;
    for (let n = 1; n <= maxPage && found === null; n++) {
      if (await pdfContainsText(pageBytes, `Page ${n}`)) found = n;
    }
    labels.push(found);
  }
  return labels;
}

/** A PNG as a data: URL, the way the UI passes signatures and logos. */
export const pngDataUrl = (w = 40, h = 20) => `data:image/png;base64,${Buffer.from(pngBytes(w, h)).toString('base64')}`;

/** A one-page PDF with a text field, a checkbox, a dropdown and a radio group. */
export async function formPdfBytes() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const form = doc.getForm();
  form.createTextField('name').addToPage(page, { x: 20, y: 340, width: 200, height: 24 });
  form.createCheckBox('agree').addToPage(page, { x: 20, y: 300, width: 16, height: 16 });
  const dd = form.createDropdown('country');
  dd.addOptions(['India', 'Germany']);
  dd.addToPage(page, { x: 20, y: 260, width: 120, height: 24 });
  const rg = form.createRadioGroup('plan');
  rg.addOptionToPage('free', page, { x: 20, y: 220, width: 16, height: 16 });
  rg.addOptionToPage('pro', page, { x: 60, y: 220, width: 16, height: 16 });
  return doc.save();
}
