import { describe, expect, it } from 'vitest';
import { jpgBytes, named, pngBytes, readPdf } from '../../../tests/helpers/fixtures.js';
import { optionsFor } from '../../../tests/helpers/tools.js';
import { UserError } from '../errors.js';
import images, { layoutImage, PAGE_SIZES } from './images.js';

const run = (files, opts) => images({ files, options: optionsFor('images', opts), name: 'o.pdf' });
const pageSizes = async ({ outputs }) => (await readPdf(outputs[0].bytes)).getPages().map((p) => p.getSize());

describe('images', () => {
  it('makes one page per image, sized to the image in "fit" mode', async () => {
    const result = await run([named('a.png', pngBytes(40, 20)), named('b.JPG', jpgBytes())], { margin: '5' });
    expect(await pageSizes(result)).toEqual([{ width: 50, height: 30 }, { width: 11, height: 11 }]);
  });

  it('uses fixed page sizes, landscape for landscape images', async () => {
    const result = await run([named('wide.png', pngBytes(400, 200))], { pageSize: 'a4' });
    expect(await pageSizes(result)).toEqual([{ width: PAGE_SIZES.a4[1], height: PAGE_SIZES.a4[0] }]);
  });

  it('rejects unsupported formats', async () => {
    await expect(run([named('x.gif', new Uint8Array([71, 73, 70]))], {})).rejects.toThrow('x.gif: only JPG and PNG images are supported.');
  });

  it('reports corrupt images clearly', async () => {
    await expect(run([named('bad.png', new Uint8Array([1, 2, 3]))], {})).rejects.toThrow(new UserError('bad.png is not a valid PNG image.'));
  });
});

describe('layoutImage', () => {
  it('fits pages to the image plus margins without scaling', () => {
    expect(layoutImage({ width: 100, height: 50 }, 'fit', 10)).toEqual({
      pageWidth: 120, pageHeight: 70, image: { x: 10, y: 10, width: 100, height: 50 },
    });
  });

  it('scales down and centers within a portrait page', () => {
    const { pageWidth, pageHeight, image } = layoutImage({ width: 1000, height: 2000 }, 'letter', 0);
    expect([pageWidth, pageHeight]).toEqual([612, 792]);
    expect(image.height).toBeCloseTo(792);
    expect(image.width).toBeCloseTo(396);
    expect(image.x).toBeCloseTo((612 - 396) / 2);
  });

  it('scales small images up to fill fixed pages', () => {
    expect(layoutImage({ width: 10, height: 10 }, 'a4', 0).image.width).toBeCloseTo(PAGE_SIZES.a4[0]);
  });
});
