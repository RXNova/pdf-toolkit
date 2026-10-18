import { unzlibSync } from 'fflate';
import { PDFArray, PDFBool, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import { loadPdf, savePdf } from '../pdf.js';

/** Re-encoding settings per compression level. */
export const LEVELS = Object.freeze({
  strong: { maxDimension: 1200, quality: 0.5 },
  recommended: { maxDimension: 2000, quality: 0.7 },
  light: { maxDimension: 3000, quality: 0.85 },
});

/** Keep a re-encoded image only if it saves at least this fraction of its size. */
const MIN_SAVING = 0.1;

const N = (name) => PDFName.of(name);

/**
 * Shrinks a PDF by re-encoding its 8-bit RGB/gray images as JPEG at a capped resolution,
 * then re-saving with object streams. Images are decoded and encoded by the injected
 * `deps.imageCodec` (the browser's canvas in production), so this module stays testable in Node.
 *
 * @type {import('./index.js').ToolHandler}
 */
export default async function compress({ files: [file], options, name, deps }) {
  const doc = await loadPdf(file);
  const settings = LEVELS[options.level];

  let replaced = 0;
  for (const [ref, stream] of doc.context.enumerateIndirectObjects()) {
    const image = readImage(doc.context, stream);
    if (!image) continue;
    const encoded = await deps.imageCodec.recompress(image, settings);
    if (!encoded || encoded.bytes.length > stream.contents.length * (1 - MIN_SAVING)) continue;
    doc.context.assign(ref, jpegStream(doc.context, stream.dict, encoded));
    replaced++;
  }

  const before = file.bytes.length;
  let bytes = await savePdf(doc);
  const notes = [];
  if (replaced === 0) notes.push('No images could be compressed further.');
  if (bytes.length >= before) {
    bytes = file.bytes;
    notes.push('The file was already well optimized, so the original was kept.');
  }

  return {
    outputs: [{ name, bytes }],
    summary: `${formatSize(before)} → ${formatSize(bytes.length)} (${Math.round(((before - bytes.length) / before) * 100)}% smaller)`,
    ...(notes.length && { note: notes.join(' ') }),
  };
}

/**
 * Describe an image XObject we know how to re-encode, or return null to leave it alone.
 * Supported: 8 bits per component, DeviceRGB/DeviceGray (or ICCBased with 1 or 3 components),
 * JPEG-encoded, or Flate-encoded without a predictor. Masks and Decode arrays are skipped,
 * since re-encoding would change how they render.
 *
 * @returns {null | { kind: 'jpeg', bytes: Uint8Array } | { kind: 'raw', pixels: Uint8Array, width: number, height: number, components: 1 | 3 }}
 */
export function readImage(context, stream) {
  if (!(stream instanceof PDFRawStream)) return null;
  const { dict } = stream;
  if (dict.get(N('Subtype')) !== N('Image')) return null;
  if (dict.lookup(N('ImageMask')) === PDFBool.True || dict.has(N('Decode'))) return null;
  if (numberOf(dict.lookup(N('BitsPerComponent'))) !== 8) return null;

  const components = colorComponents(context, dict.lookup(N('ColorSpace')));
  if (!components) return null;

  const filter = singleFilter(dict.lookup(N('Filter')));
  if (filter === N('DCTDecode')) return { kind: 'jpeg', bytes: stream.contents };
  if (filter !== N('FlateDecode') || dict.has(N('DecodeParms'))) return null;

  const width = numberOf(dict.lookup(N('Width')));
  const height = numberOf(dict.lookup(N('Height')));
  let pixels;
  try {
    pixels = unzlibSync(stream.contents);
  } catch {
    return null;
  }
  if (pixels.length !== width * height * components) return null;
  return { kind: 'raw', pixels, width, height, components };
}

function colorComponents(context, colorSpace) {
  if (colorSpace === N('DeviceRGB')) return 3;
  if (colorSpace === N('DeviceGray')) return 1;
  if (colorSpace instanceof PDFArray && colorSpace.lookup(0) === N('ICCBased')) {
    const profile = colorSpace.lookup(1);
    const n = numberOf(profile?.dict?.lookup(N('N')));
    return n === 1 || n === 3 ? n : null;
  }
  return null;
}

function singleFilter(filter) {
  if (filter instanceof PDFArray) return filter.size() === 1 ? filter.lookup(0) : null;
  return filter;
}

const numberOf = (value) => (value instanceof PDFNumber ? value.asNumber() : NaN);

/** A JPEG image stream that keeps the original's soft mask (PDF allows mask and image sizes to differ). */
function jpegStream(context, oldDict, { bytes, width, height }) {
  const dict = context.obj({
    Type: 'XObject',
    Subtype: 'Image',
    Width: width,
    Height: height,
    ColorSpace: 'DeviceRGB',
    BitsPerComponent: 8,
    Filter: 'DCTDecode',
  });
  const smask = oldDict.get(N('SMask'));
  if (smask) dict.set(N('SMask'), smask);
  return PDFRawStream.of(dict, bytes);
}

export function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
