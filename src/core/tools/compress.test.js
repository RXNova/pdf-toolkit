import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { jpgBytes, named, pageCount, pdfBytes, pdfWithImage, pngBytes, readPdf } from '../../../tests/helpers/fixtures.js';
import { optionsFor } from '../../../tests/helpers/tools.js';
import compress, { formatSize, LEVELS, readImage } from './compress.js';

const N = PDFName.of;
const images = (doc) => [...doc.context.enumerateIndirectObjects()].filter(([, o]) => o instanceof PDFRawStream && o.dict.get(N('Subtype')) === N('Image'));
const tinyJpegCodec = () => ({ recompress: vi.fn(async () => ({ bytes: new Uint8Array(100), width: 10, height: 5 })) });
const run = (file, deps, level = 'recommended') => compress({ files: [file], options: optionsFor('compress', { level }), name: 'o.pdf', deps });

describe('compress', () => {
  it('re-encodes raw images through the codec and rewrites the image dictionary', async () => {
    const src = named('scan.pdf', await pdfWithImage(pngBytes(300, 200, { noise: true })));
    const codec = tinyJpegCodec();
    const result = await run(src, { imageCodec: codec }, 'strong');

    expect(codec.recompress).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'raw', width: 300, height: 200, components: 3 }), LEVELS.strong,
    );
    const [[, image]] = images(await readPdf(result.outputs[0].bytes));
    expect(image.dict.get(N('Filter'))).toBe(N('DCTDecode'));
    expect(image.dict.get(N('ColorSpace'))).toBe(N('DeviceRGB'));
    expect(image.dict.lookup(N('Width')).asNumber()).toBe(10);
    expect(result.outputs[0].bytes.length).toBeLessThan(src.bytes.length);
    expect(result.summary).toMatch(/KB → \d+ KB \(\d+% smaller\)/);
    expect(result.note).toBeUndefined();
  });

  it('passes JPEG images through to the codec as-is', async () => {
    const doc = await PDFDocument.create();
    const jpg = await doc.embedJpg(jpgBytes());
    doc.addPage([10, 10]).drawImage(jpg, { x: 0, y: 0, width: 10, height: 10 });
    const codec = { recompress: vi.fn(async () => null) };
    await run(named('a.pdf', await doc.save()), { imageCodec: codec });
    expect(codec.recompress).toHaveBeenCalledWith({ kind: 'jpeg', bytes: expect.any(Uint8Array) }, LEVELS.recommended);
  });

  it('keeps images when re-encoding saves less than 10%', async () => {
    const src = named('a.pdf', await pdfWithImage(pngBytes(50, 50, { noise: true })));
    const codec = { recompress: async () => ({ bytes: new Uint8Array(50 * 50 * 3), width: 50, height: 50 }) };
    const result = await run(src, { imageCodec: codec });
    expect(result.note).toMatch(/No images could be compressed further/);
  });

  it('returns the original when nothing helps', async () => {
    const src = named('text.pdf', await pdfBytes({ pages: 2 }));
    const result = await run(src, { imageCodec: tinyJpegCodec() });
    expect(result.outputs[0].bytes).toBe(src.bytes);
    expect(result.note).toBe('No images could be compressed further. The file was already well optimized, so the original was kept.');
    expect(result.summary).toMatch(/\(0% smaller\)/);
    expect(await pageCount(result.outputs[0].bytes)).toBe(2);
  });
});

describe('readImage', () => {
  const context = PDFDocument.create().then((d) => d.context);
  const stream = async (dict, contents = new Uint8Array(12)) => PDFRawStream.of((await context).obj(dict), contents);
  const base = { Subtype: 'Image', Width: 2, Height: 2, BitsPerComponent: 8, ColorSpace: 'DeviceRGB', Filter: 'DCTDecode' };

  it('accepts JPEGs in RGB, gray and ICC color spaces', async () => {
    const ctx = await context;
    expect(readImage(ctx, await stream(base))).toMatchObject({ kind: 'jpeg' });
    expect(readImage(ctx, await stream({ ...base, ColorSpace: 'DeviceGray' }))).toMatchObject({ kind: 'jpeg' });
    expect(readImage(ctx, await stream({ ...base, Filter: ['DCTDecode'] }))).toMatchObject({ kind: 'jpeg' });
    const icc = ctx.register(PDFRawStream.of(ctx.obj({ N: 3 }), new Uint8Array(0)));
    expect(readImage(ctx, await stream({ ...base, ColorSpace: ['ICCBased', icc] }))).toMatchObject({ kind: 'jpeg' });
  });

  it.each([
    ['non-images', { ...base, Subtype: 'Form' }],
    ['image masks', { ...base, ImageMask: true }],
    ['Decode arrays', { ...base, Decode: [1, 0, 1, 0, 1, 0] }],
    ['16-bit images', { ...base, BitsPerComponent: 16 }],
    ['CMYK', { ...base, ColorSpace: 'DeviceCMYK' }],
    ['indexed color', { ...base, ColorSpace: ['Indexed', 'DeviceRGB', 1, 'x'] }],
    ['filter chains', { ...base, Filter: ['FlateDecode', 'DCTDecode'] }],
    ['predictors', { ...base, Filter: 'FlateDecode', DecodeParms: { Predictor: 15 } }],
    ['other filters', { ...base, Filter: 'JPXDecode' }],
  ])('skips %s', async (_label, dict) => {
    expect(readImage(await context, await stream(dict))).toBeNull();
  });

  it('skips ICC profiles with 4 components and non-stream objects', async () => {
    const ctx = await context;
    const icc = ctx.register(PDFRawStream.of(ctx.obj({ N: 4 }), new Uint8Array(0)));
    expect(readImage(ctx, await stream({ ...base, ColorSpace: ['ICCBased', icc] }))).toBeNull();
    expect(readImage(ctx, ctx.obj({}))).toBeNull();
  });

  it('skips Flate images that are corrupt or the wrong size', async () => {
    const ctx = await context;
    const flate = { ...base, Filter: 'FlateDecode' };
    expect(readImage(ctx, await stream(flate, new Uint8Array([1, 2, 3])))).toBeNull();
    const { zlibSync } = await import('fflate');
    expect(readImage(ctx, await stream(flate, zlibSync(new Uint8Array(5))))).toBeNull();
    expect(readImage(ctx, await stream(flate, zlibSync(new Uint8Array(12))))).toMatchObject({ kind: 'raw', components: 3 });
  });
});

describe('formatSize', () => {
  it.each([[100, '1 KB'], [1536, '2 KB'], [3 * 1024 * 1024, '3.0 MB']])('%i → %s', (n, s) => expect(formatSize(n)).toBe(s));
});
