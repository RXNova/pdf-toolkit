import { zipSync } from 'fflate';
import { ACCEPT } from '../catalog.js';
import { extname, outputName } from '../core/names.js';

export const MIME = { pdf: 'application/pdf', zip: 'application/zip', png: 'image/png', jpg: 'image/jpeg' };

/** Media type for a file name, by extension (PDF when unknown). */
export const mimeFor = (name) => MIME[extname(name)] ?? MIME.pdf;

/** `accept` attribute for the file picker, e.g. ".pdf,application/pdf". */
export function acceptAttribute(kind) {
  const types = { pdf: ['application/pdf'], image: ['image/jpeg', 'image/png'] }[kind];
  return [...ACCEPT[kind].map((ext) => `.${ext}`), ...types].join(',');
}

export const isAccepted = (kind, file) => ACCEPT[kind].includes(extname(file.name));

/** Read browser Files into the { name, bytes } shape the toolkit expects. */
export const readFiles = (files) =>
  Promise.all(files.map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })));

/**
 * Bundle several outputs into one zip, stored without recompression (PDFs are already compressed).
 * @param {{ name: string, bytes: Uint8Array }[]} outputs
 * @param {string} zipName
 */
export function zipOutputs(outputs, zipName) {
  const entries = Object.fromEntries(outputs.map((o) => [o.name, [o.bytes, { level: 0 }]]));
  return { name: zipName, bytes: zipSync(entries) };
}

export const zipNameFor = (tool, firstInputName) => outputName(firstInputName, tool.suffix, 'zip');

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
