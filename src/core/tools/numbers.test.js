import { describe, expect, it } from 'vitest';
import { named, pdfBytes, pdfContainsText } from '../../../tests/helpers/fixtures.js';
import { optionsFor } from '../../../tests/helpers/tools.js';
import numbers, { formatLabel, labelPosition } from './numbers.js';

describe('numbers', () => {
  it('labels each page using the format and start number', async () => {
    const src = named('a.pdf', await pdfBytes({ pages: 3 }));
    const { outputs } = await numbers({ files: [src], options: optionsFor('numbers', { start: '5', format: 'p{n} of {total}' }), name: 'o.pdf' });
    for (const label of ['p5 of 7', 'p6 of 7', 'p7 of 7']) expect(await pdfContainsText(outputs[0].bytes, label)).toBe(true);
  });
});

describe('formatLabel', () => {
  it('replaces every placeholder', () => {
    expect(formatLabel('{n}/{total} ({n})', 2, 9)).toBe('2/9 (2)');
    expect(formatLabel('Page', 1, 1)).toBe('Page');
  });
});

describe('labelPosition', () => {
  const page = { width: 600, height: 800, textWidth: 50, fontSize: 10 };
  it.each([
    ['bottom-left', { x: 24, y: 24 }],
    ['bottom-center', { x: 275, y: 24 }],
    ['bottom-right', { x: 526, y: 24 }],
    ['top-left', { x: 24, y: 766 }],
    ['top-center', { x: 275, y: 766 }],
    ['top-right', { x: 526, y: 766 }],
  ])('%s', (position, expected) => {
    expect(labelPosition(position, page)).toEqual(expected);
  });
});
