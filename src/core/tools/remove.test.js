import { beforeAll, expect, it } from 'vitest';
import { named, pageLabels, pdfBytes } from '../../../tests/helpers/fixtures.js';
import { optionsFor } from '../../../tests/helpers/tools.js';
import remove from './remove.js';

let src;
beforeAll(async () => (src = named('a.pdf', await pdfBytes({ pages: 5 }))));

it('drops the selected pages', async () => {
  const { outputs } = await remove({ files: [src], options: optionsFor('remove', { ranges: '2, 4-5' }), name: 'o.pdf' });
  expect(await pageLabels(outputs[0].bytes)).toEqual([1, 3]);
});

it('refuses to remove every page', async () => {
  await expect(remove({ files: [src], options: optionsFor('remove', { ranges: '1-' }), name: 'o.pdf' }))
    .rejects.toThrow('That would remove every page.');
});
