import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { getToolDef } from '../catalog.js';
import { acceptAttribute, formatBytes, isAccepted, readFiles, zipNameFor, zipOutputs } from './files.js';
import { makeFile, setupBrowserTestEnv } from './test-utils.js';

setupBrowserTestEnv();

describe('files', () => {
  it('builds accept attributes from the catalog', () => {
    expect(acceptAttribute('pdf')).toBe('.pdf,application/pdf');
    expect(acceptAttribute('image')).toBe('.jpg,.jpeg,.png,image/jpeg,image/png');
  });

  it('accepts files by extension, case-insensitively', () => {
    expect(isAccepted('pdf', makeFile('A.PDF'))).toBe(true);
    expect(isAccepted('pdf', makeFile('a.png'))).toBe(false);
    expect(isAccepted('image', makeFile('a.jpeg'))).toBe(true);
  });

  it('reads Files into { name, bytes }', async () => {
    expect(await readFiles([makeFile('a.pdf', 'hi')])).toEqual([{ name: 'a.pdf', bytes: new Uint8Array([104, 105]) }]);
  });

  it('zips outputs so they round-trip', () => {
    const zip = zipOutputs([{ name: 'a.pdf', bytes: new Uint8Array([1, 2]) }, { name: 'b.pdf', bytes: new Uint8Array([3]) }], 'x.zip');
    expect(zip.name).toBe('x.zip');
    expect(unzipSync(zip.bytes)).toEqual({ 'a.pdf': new Uint8Array([1, 2]), 'b.pdf': new Uint8Array([3]) });
  });

  it('names zips after the first input and the tool', () => {
    expect(zipNameFor(getToolDef('split'), 'report.pdf')).toBe('report_split.zip');
  });

  it.each([[500, '500 B'], [2048, '2 KB'], [5 * 1024 * 1024, '5.0 MB']])('formatBytes(%i) = %s', (n, s) => expect(formatBytes(n)).toBe(s));
});
