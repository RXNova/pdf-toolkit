import { beforeAll, describe, expect, it } from 'vitest';
import { named, pdfBytes, readPdf } from '../../../tests/helpers/fixtures.js';
import { optionsFor } from '../../../tests/helpers/tools.js';
import rotate, { normalizeAngle } from './rotate.js';

let src;
beforeAll(async () => (src = named('a.pdf', await pdfBytes({ pages: 3 }))));

const rotations = async (bytes) => (await readPdf(bytes)).getPages().map((p) => p.getRotation().angle);
const run = async (file, opts) => (await rotate({ files: [file], options: optionsFor('rotate', opts), name: 'o.pdf' })).outputs[0];

describe('rotate', () => {
  it('rotates all pages by default', async () => {
    expect(await rotations((await run(src, { angle: '180' })).bytes)).toEqual([180, 180, 180]);
  });

  it('rotates only selected pages, once each even if listed twice', async () => {
    expect(await rotations((await run(src, { angle: '90', ranges: '2, 2' })).bytes)).toEqual([0, 90, 0]);
  });

  it('adds to existing rotation and wraps at 360', async () => {
    const once = await run(src, { angle: '270' });
    const twice = await run(once, { angle: '180' });
    expect(await rotations(twice.bytes)).toEqual([90, 90, 90]);
  });
});

describe('normalizeAngle', () => {
  it.each([[0, 0], [360, 0], [450, 90], [-90, 270]])('%i → %i', (input, expected) => {
    expect(normalizeAngle(input)).toBe(expected);
  });
});
