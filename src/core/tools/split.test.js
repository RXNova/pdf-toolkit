import { beforeAll, describe, expect, it } from 'vitest';
import { named, pageLabels, pdfBytes } from '../../../tests/helpers/fixtures.js';
import { optionsFor } from '../../../tests/helpers/tools.js';
import split, { splitName } from './split.js';

let src;
beforeAll(async () => (src = named('report.pdf', await pdfBytes({ pages: 5 }))));

describe('split', () => {
  it('produces one file per range group', async () => {
    const { outputs } = await split({ files: [src], options: optionsFor('split', { ranges: '1-2, 4, 5-3' }) });
    expect(outputs.map((o) => o.name)).toEqual(['report_p1-2.pdf', 'report_p4.pdf', 'report_p5-3.pdf']);
    expect(await pageLabels(outputs[0].bytes)).toEqual([1, 2]);
    expect(await pageLabels(outputs[2].bytes)).toEqual([5, 4, 3]);
  });

  it('produces one file per page in "every" mode', async () => {
    const { outputs } = await split({ files: [src], options: optionsFor('split', { mode: 'every' }) });
    expect(outputs).toHaveLength(5);
    expect(await pageLabels(outputs[4].bytes)).toEqual([5]);
  });
});

describe('splitName', () => {
  it('names single pages and ranges', () => {
    expect(splitName('doc', [2])).toBe('doc_p3.pdf');
    expect(splitName('doc', [0, 1, 2])).toBe('doc_p1-3.pdf');
  });
});
