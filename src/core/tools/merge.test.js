import { expect, it } from 'vitest';
import { named, pageLabels, pdfBytes } from '../../../tests/helpers/fixtures.js';
import merge from './merge.js';

it('concatenates PDFs in the given order under the given name', async () => {
  const a = named('a.pdf', await pdfBytes({ pages: 2 }));
  const b = named('b.pdf', await pdfBytes({ pages: 3 }));
  const { outputs } = await merge({ files: [b, a], options: {}, name: 'b_merged.pdf' });
  expect(outputs.map((o) => o.name)).toEqual(['b_merged.pdf']);
  expect(await pageLabels(outputs[0].bytes)).toEqual([1, 2, 3, 1, 2]);
});
