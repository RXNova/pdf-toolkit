import { describe, expect, it, vi } from 'vitest';
import { named, pageCount, pdfBytes } from '../../tests/helpers/fixtures.js';
import { unusedDeps } from '../../tests/helpers/tools.js';
import { TOOL_CATALOG } from '../catalog.js';
import { UserError } from './errors.js';
import { createToolkit, validateRequest } from './toolkit.js';
import { HANDLERS } from './tools/index.js';

const file = (name, size = 1) => ({ name, bytes: new Uint8Array(size) });

describe('catalog ↔ handlers contract', () => {
  it('every catalog tool has a handler and vice versa', () => {
    expect(Object.keys(HANDLERS).sort()).toEqual(TOOL_CATALOG.map((t) => t.id).sort());
  });
});

describe('validateRequest', () => {
  const valid = { toolId: 'rotate', files: [file('in.pdf')] };

  it('accepts a valid request', () => {
    expect(validateRequest(valid).tool.id).toBe('rotate');
  });

  it.each([
    [null, TypeError, 'Request must be an object.'],
    [{ ...valid, toolId: 'nope' }, TypeError, 'Unknown tool: nope'],
    [{ ...valid, files: 'x' }, TypeError, /files must be/],
    [{ ...valid, files: [{ name: 'a.pdf', bytes: [1] }] }, TypeError, /files must be/],
    [{ ...valid, files: [{ name: '', bytes: new Uint8Array(1) }] }, TypeError, /files must be/],
    [{ ...valid, files: [null] }, TypeError, /files must be/],
    [{ ...valid, files: [] }, UserError, 'Add a file first.'],
    [{ toolId: 'merge', files: [file('a.pdf')] }, UserError, 'Add at least 2 files.'],
    [{ ...valid, files: [file('a.pdf'), file('b.pdf')] }, UserError, 'Rotate PDF works on one file at a time.'],
    [{ ...valid, files: [file('photo.png')] }, UserError, /photo\.png isn’t a supported file. Expected PDF/],
    [{ toolId: 'images', files: [file('doc.pdf')] }, UserError, /Expected JPG\/JPEG\/PNG/],
    [{ ...valid, files: [file('empty.pdf', 0)] }, UserError, 'empty.pdf is empty.'],
  ])('rejects %j', (request, ErrorType, message) => {
    expect(() => validateRequest(request)).toThrow(ErrorType);
    expect(() => validateRequest(request)).toThrow(message);
  });

  it('accepts upper-case extensions', () => {
    expect(() => validateRequest({ ...valid, files: [file('IN.PDF')] })).not.toThrow();
  });
});

describe('createToolkit', () => {
  it('validates, parses options, names the output and dispatches', async () => {
    const toolkit = createToolkit(unusedDeps());
    const result = await toolkit.run({ toolId: 'extract', files: [named('report.pdf', await pdfBytes({ pages: 4 }))], options: { ranges: '1-2' } });
    expect(result.outputs[0].name).toBe('report_extracted.pdf');
    expect(await pageCount(result.outputs[0].bytes)).toBe(2);
  });

  it('passes deps through to handlers', async () => {
    const qpdf = vi.fn(async () => new Uint8Array([7]));
    const result = await createToolkit({ ...unusedDeps(), qpdf })
      .run({ toolId: 'protect', files: [named('a.pdf', await pdfBytes())], options: { password: 'x', confirm: 'x' } });
    expect(qpdf).toHaveBeenCalled();
    expect(result.outputs[0]).toEqual({ name: 'a_protected.pdf', bytes: new Uint8Array([7]) });
  });

  it('rejects invalid options before parsing files', async () => {
    await expect(createToolkit(unusedDeps()).run({ toolId: 'extract', files: [file('a.pdf')] }))
      .rejects.toThrow(new UserError('Pages to keep is required.'));
  });
});
