import compress from './compress.js';
import crop from './crop.js';
import extract from './extract.js';
import fillsign from './fillsign.js';
import headerfooter from './headerfooter.js';
import images from './images.js';
import merge from './merge.js';
import metadata from './metadata.js';
import numbers from './numbers.js';
import protect from './protect.js';
import remove from './remove.js';
import reorder from './reorder.js';
import rotate from './rotate.js';
import split from './split.js';
import toimage from './toimage.js';
import unlock from './unlock.js';
import watermark from './watermark.js';

/**
 * @typedef {import('../pdf.js').NamedBytes} NamedBytes
 *
 * @typedef {object} ImageCodec
 * @property {(image: { kind: 'jpeg', bytes: Uint8Array }
 *   | { kind: 'raw', pixels: Uint8Array, width: number, height: number, components: 1 | 3 },
 *   settings: { maxDimension: number, quality: number }) => Promise<{ bytes: Uint8Array, width: number, height: number } | null>} recompress
 *
 * @typedef {object} ToolDeps
 * @property {(args: string[], input: Uint8Array) => Promise<Uint8Array>} qpdf  see createQpdf
 * @property {ImageCodec} imageCodec
 * @property {Rasterizer} [rasterize]  only on the UI thread (see toimage)
 *
 * @typedef {object} Rasterizer
 * @property {(pdf: Uint8Array) => Promise<{ pageCount: number }>} info
 * @property {(pdf: Uint8Array, settings: { pages: number[], scale: number, type: string, quality: number }) => Promise<Uint8Array[]>} pages
 *
 * @typedef {object} ToolRequest   already validated by the toolkit
 * @property {NamedBytes[]} files
 * @property {Record<string, any>} options  typed values from parseOptions
 * @property {string} name         default output name, "<first input>_<suffix>.pdf"
 * @property {ToolDeps} deps
 *
 * @typedef {object} ToolResult
 * @property {NamedBytes[]} outputs
 * @property {string} [summary]    short result line, e.g. size savings
 * @property {string} [note]       caveat worth telling the user
 *
 * @typedef {(req: ToolRequest) => Promise<ToolResult>} ToolHandler
 */

/** @type {Readonly<Record<string, ToolHandler>>} */
export const HANDLERS = Object.freeze({
  merge, split, extract, remove, reorder, crop, rotate, compress, images, toimage, watermark, numbers,
  headerfooter, fillsign, protect, unlock, metadata,
});
