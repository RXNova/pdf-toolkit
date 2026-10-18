import { expect, it } from 'vitest';
import { named, pageLabels, pdfBytes } from '../../../tests/helpers/fixtures.js';
import { optionsFor } from '../../../tests/helpers/tools.js';
import { UserError } from '../errors.js';
import extract from './extract.js';

it('keeps only the selected pages, in the given order', async () => {
  const src = named('a.pdf', await pdfBytes({ pages: 5 }));
  const { outputs } = await extract({ files: [src], options: optionsFor('extract', { ranges: '4, 1-2' }), name: 'o.pdf' });
  expect(await pageLabels(outputs[0].bytes)).toEqual([4, 1, 2]);
});

it('rejects out-of-range pages', async () => {
  const src = named('a.pdf', await pdfBytes({ pages: 2 }));
  await expect(extract({ files: [src], options: optionsFor('extract', { ranges: '3' }), name: 'o.pdf' })).rejects.toThrow(UserError);
});
