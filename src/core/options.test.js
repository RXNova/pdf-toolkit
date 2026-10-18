import { describe, expect, it } from 'vitest';
import { UserError } from './errors.js';
import { parseOptions } from './options.js';

const schema = [
  { key: 'mode', label: 'Mode', type: 'select', default: 'a', choices: [['a', 'A'], ['b', 'B']] },
  { key: 'ranges', label: 'Ranges', type: 'ranges', required: true, showIf: { mode: 'a' } },
  { key: 'size', label: 'Size', type: 'number', default: 10, min: 1, max: 100 },
  { key: 'text', label: 'Text', type: 'text', default: 'hi' },
  { key: 'secret', label: 'Secret', type: 'password' },
  { key: 'color', label: 'Color', type: 'color', default: '#000000' },
];

describe('parseOptions', () => {
  it('applies defaults for missing values', () => {
    expect(parseOptions(schema, { ranges: '1' })).toEqual({
      mode: 'a', ranges: '1', size: 10, text: 'hi', secret: '', color: '#000000',
    });
  });

  it('coerces and trims', () => {
    const out = parseOptions(schema, { ranges: ' 1-2 ', size: '42', text: '  x  ', secret: ' pw ' });
    expect(out).toMatchObject({ ranges: '1-2', size: 42, text: 'x', secret: ' pw ' });
  });

  it('treats null like missing', () => {
    expect(parseOptions(schema, { ranges: '1', size: null }).size).toBe(10);
  });

  it('falls back to the default for an empty number', () => {
    expect(parseOptions(schema, { ranges: '1', size: '' }).size).toBe(10);
  });

  it('requires visible required options only', () => {
    expect(() => parseOptions(schema, { mode: 'a', ranges: '  ' })).toThrow(new UserError('Ranges is required.'));
    expect(parseOptions(schema, { mode: 'b' }).ranges).toBe('');
  });

  it.each([
    [{ size: 'big' }, 'Size must be a number.'],
    [{ size: '0' }, 'Size must be between 1 and 100.'],
    [{ size: '101' }, 'Size must be between 1 and 100.'],
    [{ size: 'Infinity' }, 'Size must be a number.'],
    [{ mode: 'z' }, '"z" is not a valid choice for Mode.'],
    [{ color: 'red' }, 'Color must be a hex color like #ff0000.'],
  ])('rejects %j', (raw, message) => {
    expect(() => parseOptions(schema, { ranges: '1', ...raw })).toThrow(new UserError(message));
  });

  it('defaults numbers without a default to 0', () => {
    expect(parseOptions([{ key: 'n', label: 'N', type: 'number' }], {}).n).toBe(0);
  });

  it('handles an empty schema and missing raw', () => {
    expect(parseOptions([])).toEqual({});
  });
});
