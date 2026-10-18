import { expect, it } from 'vitest';
import { named, pageLabels, pdfBytes } from '../../../tests/helpers/fixtures.js';
import { optionsFor } from '../../../tests/helpers/tools.js';
import reorder from './reorder.js';

it('reorders, repeats and omits pages as specified', async () => {
  const src = named('a.pdf', await pdfBytes({ pages: 4 }));
  const { outputs } = await reorder({ files: [src], options: optionsFor('reorder', { order: '3, 1, 1, 4-' }), name: 'o.pdf' });
  expect(await pageLabels(outputs[0].bytes)).toEqual([3, 1, 1, 4]);
});
