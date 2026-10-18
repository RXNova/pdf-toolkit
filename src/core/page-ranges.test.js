import { describe, expect, it } from 'vitest';
import { UserError } from './errors.js';
import { formatRanges, parseRanges, selectPages } from './page-ranges.js';

describe('parseRanges', () => {
  it.each([
    ['', 4, [[0, 1, 2, 3]]],
    ['   ', 2, [[0, 1]]],
    ['2', 4, [[1]]],
    ['1-3', 4, [[0, 1, 2]]],
    ['1-2, 4', 4, [[0, 1], [3]]],
    ['3-', 5, [[2, 3, 4]]],
    ['-2', 5, [[0, 1]]],
    ['4-2', 5, [[3, 2, 1]]],
    [' 1 - 2 ,, 3 ', 3, [[0, 1], [2]]],
    ['2,2', 3, [[1], [1]]],
  ])('parses %j with %i pages', (spec, count, expected) => {
    expect(parseRanges(spec, count)).toEqual(expected);
  });

  it.each([
    ['0', /out of range/],
    ['6', /out of range \(the document has 5 pages\)/],
    ['2-9', /Page 9 is out of range/],
    ['abc', /"abc" is not a page number/],
    ['1.5', /not a page number/],
    ['1-2-3', /not a page number/],
  ])('rejects %j', (spec, message) => {
    expect(() => parseRanges(spec, 5)).toThrow(UserError);
    expect(() => parseRanges(spec, 5)).toThrow(message);
  });

  it('uses singular "page" for one-page documents', () => {
    expect(() => parseRanges('2', 1)).toThrow('the document has 1 page)');
  });

  it('treats null/undefined as empty', () => {
    expect(parseRanges(undefined, 2)).toEqual([[0, 1]]);
  });
});

describe('selectPages', () => {
  it('flattens groups and keeps duplicates', () => {
    expect(selectPages('3, 1-2, 1', 3)).toEqual([2, 0, 1, 0]);
  });
});

describe('formatRanges', () => {
  it.each([
    [[], ''],
    [[4], '4'],
    [[1, 2, 3, 7], '1-3, 7'],
    [[3, 1, 2, 4, 5], '3, 1-2, 4-5'],
    [[5, 4, 3], '5, 4, 3'],
    [[2, 2], '2, 2'],
  ])('%j → "%s"', (pages, spec) => expect(formatRanges(pages)).toBe(spec));

  it('round-trips through selectPages', () => {
    const pages = [3, 4, 5, 1, 9, 9, 2];
    expect(selectPages(formatRanges(pages), 9).map((i) => i + 1)).toEqual(pages);
  });
});
