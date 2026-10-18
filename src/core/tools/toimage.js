import { stem } from '../names.js';
import { selectPages } from '../page-ranges.js';
import { inspectPdf } from '../pdf.js';
import { UserError } from '../errors.js';

/**
 * Pages as images. Drawing pages needs a PDF renderer, which the core doesn't have, so it
 * comes in as `deps.rasterize` (pdf.js in the browser). Runs on the UI thread for that reason.
 * @type {import('./index.js').ToolHandler}
 */
export default async function toimage({ files: [file], options, deps }) {
  if ((await inspectPdf(file)).encrypted) throw new UserError(`${file.name} is password-protected. Use “Unlock PDF” first.`);
  const ext = options.format === 'jpg' ? 'jpg' : 'png';
  const { pageCount } = await deps.rasterize.info(file.bytes);
  const pages = [...new Set(selectPages(options.ranges, pageCount))];
  const images = await deps.rasterize.pages(file.bytes, {
    pages: pages.map((i) => i + 1),
    scale: Number(options.dpi) / 72,
    type: ext === 'jpg' ? 'image/jpeg' : 'image/png',
    quality: options.quality,
  });
  const width = String(pageCount).length;
  return {
    outputs: images.map((bytes, i) => ({ name: `${stem(file.name)}_p${String(pages[i] + 1).padStart(width, '0')}.${ext}`, bytes })),
  };
}
