// Runs the real qpdf WebAssembly build (the same binary the browser loads).
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { named, pageCount, pdfBytes, readPdf } from '../../../tests/helpers/fixtures.js';
import { optionsFor, realQpdf } from '../../../tests/helpers/tools.js';
import { UserError } from '../errors.js';
import { loadPdf } from '../pdf.js';
import protect from './protect.js';
import unlock from './unlock.js';

let src;
const deps = { qpdf: realQpdf() };
beforeAll(async () => (src = named('a.pdf', await pdfBytes({ pages: 2 }))));

const lock = async (password = 'pw') =>
  (await protect({ files: [src], options: optionsFor('protect', { password, confirm: password }), name: 'a_protected.pdf', deps })).outputs[0];

describe('protect', () => {
  it('encrypts so the PDF needs a password', async () => {
    const locked = await lock();
    expect(locked.name).toBe('a_protected.pdf');
    await expect(readPdf(locked.bytes)).rejects.toThrow(/encrypted/);
    await expect(loadPdf(locked)).rejects.toThrow(UserError);
  });

  it('refuses to re-encrypt an already protected PDF', async () => {
    const locked = await lock();
    await expect(protect({ files: [locked], options: optionsFor('protect', { password: 'x', confirm: 'x' }), name: 'o', deps }))
      .rejects.toThrow(/a_protected\.pdf is already password-protected/);
  });

  it('rejects files that are not PDFs', async () => {
    await expect(protect({ files: [named('fake.pdf', new Uint8Array([1]))], options: optionsFor('protect', { password: 'x', confirm: 'x' }), name: 'o', deps }))
      .rejects.toThrow(new UserError('fake.pdf is not a valid PDF.'));
  });

  it('rejects mismatched passwords before running qpdf', async () => {
    const qpdf = vi.fn();
    await expect(protect({ files: [src], options: optionsFor('protect', { password: 'a', confirm: 'b' }), name: 'o', deps: { qpdf } }))
      .rejects.toThrow('Passwords do not match.');
    expect(qpdf).not.toHaveBeenCalled();
  });
});

describe('unlock', () => {
  it('decrypts with the right password', async () => {
    const locked = await lock('s3cret');
    const { outputs } = await unlock({ files: [locked], options: optionsFor('unlock', { password: 's3cret' }), name: 'o.pdf', deps });
    expect(await pageCount(outputs[0].bytes)).toBe(2);
  });

  it('reports a wrong password', async () => {
    const locked = await lock('s3cret');
    await expect(unlock({ files: [locked], options: optionsFor('unlock', { password: 'nope' }), name: 'o', deps }))
      .rejects.toThrow(new UserError('Wrong password.'));
  });

  it('reports a file that is not a PDF', async () => {
    await expect(unlock({ files: [named('fake.pdf', new Uint8Array([1, 2, 3]))], options: optionsFor('unlock'), name: 'o', deps }))
      .rejects.toThrow(new UserError('fake.pdf is not a valid PDF.'));
  });

  it('passes crashes (not qpdf exit codes) through', async () => {
    const locked = await lock();
    const qpdf = async () => {
      throw new RangeError('out of memory');
    };
    await expect(unlock({ files: [locked], options: optionsFor('unlock'), name: 'o', deps: { qpdf } })).rejects.toThrow(RangeError);
  });

  it('returns unencrypted files unchanged, with a note, without running qpdf', async () => {
    const qpdf = vi.fn();
    const result = await unlock({ files: [src], options: optionsFor('unlock'), name: 'o.pdf', deps: { qpdf } });
    expect(result.outputs[0].bytes).toBe(src.bytes);
    expect(result.note).toBe('a.pdf isn’t password-protected, so it was left as is.');
    expect(qpdf).not.toHaveBeenCalled();
  });
});
