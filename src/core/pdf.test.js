import { describe, expect, it } from 'vitest';
import { encryptedMarkerPdfBytes, named, pageCount, pdfBytes } from '../../tests/helpers/fixtures.js';
import { UserError } from './errors.js';
import { hexToRgb, loadPdf, pagesToNewPdf, savePdf } from './pdf.js';

describe('loadPdf', () => {
  it('loads a valid PDF', async () => {
    expect((await loadPdf(named('a.pdf', await pdfBytes({ pages: 2 })))).getPageCount()).toBe(2);
  });

  it('reports a file that is not a PDF', async () => {
    await expect(loadPdf(named('fake.pdf', new TextEncoder().encode('hello')))).rejects.toThrow(new UserError('fake.pdf is not a valid PDF.'));
  });

  it('points encrypted PDFs at the unlock tool', async () => {
    await expect(loadPdf(named('locked.pdf', await encryptedMarkerPdfBytes()))).rejects.toThrow(/locked\.pdf is password-protected/);
  });
});

describe('savePdf / pagesToNewPdf', () => {
  it('copies selected pages in order', async () => {
    const src = await loadPdf(named('a.pdf', await pdfBytes({ pages: 4 })));
    expect(await pageCount(await savePdf(await pagesToNewPdf(src, [3, 0])))).toBe(2);
  });
});

describe('hexToRgb', () => {
  it('converts hex colors to 0..1 channels', () => {
    expect(hexToRgb('#ff8000')).toMatchObject({ red: 1, green: 128 / 255, blue: 0 });
  });
});
