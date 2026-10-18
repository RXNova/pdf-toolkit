import { describe, expect, it } from 'vitest';
import { extname, outputName, stem } from './names.js';

describe('names', () => {
  it.each([
    ['report.pdf', 'report', 'pdf'],
    ['Scan.PDF', 'Scan', 'pdf'],
    ['file.tar.gz', 'file.tar', 'gz'],
    ['.hidden', '.hidden', ''],
    ['noext', 'noext', ''],
  ])('%s', (name, s, ext) => {
    expect(stem(name)).toBe(s);
    expect(extname(name)).toBe(ext);
  });

  it('builds output names', () => {
    expect(outputName('report.pdf', 'rotated')).toBe('report_rotated.pdf');
    expect(outputName('report.pdf', 'split', 'zip')).toBe('report_split.zip');
  });
});
