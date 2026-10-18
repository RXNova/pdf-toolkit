import { PDFDocument } from 'pdf-lib';
import { UserError } from '../errors.js';
import { extname } from '../names.js';
import { savePdf } from '../pdf.js';

/** Portrait page sizes in PDF points. */
export const PAGE_SIZES = Object.freeze({ a4: [595.28, 841.89], letter: [612, 792] });

/** @type {import('./index.js').ToolHandler} */
export default async function images({ files, options, name }) {
  const doc = await PDFDocument.create();
  for (const file of files) {
    const image = await embedImage(doc, file);
    const layout = layoutImage({ width: image.width, height: image.height }, options.pageSize, options.margin);
    doc.addPage([layout.pageWidth, layout.pageHeight]).drawImage(image, layout.image);
  }
  return { outputs: [{ name, bytes: await savePdf(doc) }] };
}

async function embedImage(doc, { name, bytes }) {
  const ext = extname(name);
  try {
    if (ext === 'png') return await doc.embedPng(bytes);
    if (ext === 'jpg' || ext === 'jpeg') return await doc.embedJpg(bytes);
  } catch (err) {
    throw new UserError(`${name} is not a valid ${ext.toUpperCase()} image.`, { cause: err });
  }
  throw new UserError(`${name}: only JPG and PNG images are supported.`);
}

/**
 * Where to put an image on its page.
 * "fit" makes the page the image's size plus margins; fixed sizes scale the image
 * to fit inside the margins, turning the page landscape for landscape images.
 *
 * @param {{ width: number, height: number }} img
 * @param {'fit' | keyof typeof PAGE_SIZES} pageSize
 * @param {number} margin
 */
export function layoutImage(img, pageSize, margin) {
  let pageWidth;
  let pageHeight;
  let scale;
  if (pageSize === 'fit') {
    pageWidth = img.width + 2 * margin;
    pageHeight = img.height + 2 * margin;
    scale = 1;
  } else {
    [pageWidth, pageHeight] = PAGE_SIZES[pageSize];
    if (img.width > img.height) [pageWidth, pageHeight] = [pageHeight, pageWidth];
    scale = Math.min((pageWidth - 2 * margin) / img.width, (pageHeight - 2 * margin) / img.height);
  }
  const width = img.width * scale;
  const height = img.height * scale;
  return {
    pageWidth,
    pageHeight,
    image: { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height },
  };
}
