import { describe, expect, it, vi } from 'vitest';
import { createQpdf, QPDF_INPUT, QPDF_OUTPUT, QpdfError } from './qpdf.js';

function fakeModule({ exit = 0, throws, output = new Uint8Array([9]) } = {}) {
  return vi.fn(async () => ({
    FS: { writeFile: vi.fn(), readFile: vi.fn(() => output) },
    callMain: vi.fn(() => {
      if (throws) throw throws;
      return exit;
    }),
  }));
}

describe('createQpdf', () => {
  it('writes the input, runs qpdf and returns the output file', async () => {
    const factory = fakeModule();
    const input = new Uint8Array([1]);
    await expect(createQpdf(factory)(['--decrypt', QPDF_INPUT, QPDF_OUTPUT], input)).resolves.toEqual(new Uint8Array([9]));
    const module = await factory.mock.results[0].value;
    expect(module.FS.writeFile).toHaveBeenCalledWith(QPDF_INPUT, input);
    expect(module.callMain).toHaveBeenCalledWith(['--decrypt', QPDF_INPUT, QPDF_OUTPUT]);
    expect(module.FS.readFile).toHaveBeenCalledWith(QPDF_OUTPUT);
  });

  it('creates a fresh module per call', async () => {
    const factory = fakeModule();
    const qpdf = createQpdf(factory);
    await qpdf([], new Uint8Array());
    await qpdf([], new Uint8Array());
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('treats exit code 3 (warnings) as success', async () => {
    await expect(createQpdf(fakeModule({ exit: 3 }))([], new Uint8Array())).resolves.toBeInstanceOf(Uint8Array);
  });

  it('rejects with a QpdfError carrying the exit code', async () => {
    const error = await createQpdf(fakeModule({ exit: 2 }))([], new Uint8Array()).catch((e) => e);
    expect(error).toBeInstanceOf(QpdfError);
    expect(error).toMatchObject({ code: 2, message: 'qpdf failed with exit code 2' });
  });

  it('handles Emscripten ExitStatus throws', async () => {
    await expect(createQpdf(fakeModule({ throws: { status: 3 } }))([], new Uint8Array())).resolves.toBeInstanceOf(Uint8Array);
    await expect(createQpdf(fakeModule({ throws: { status: 2 } }))([], new Uint8Array())).rejects.toThrow(QpdfError);
  });

  it('rethrows crashes as-is', async () => {
    const crash = new Error('RuntimeError: unreachable');
    await expect(createQpdf(fakeModule({ throws: crash }))([], new Uint8Array())).rejects.toBe(crash);
  });
});
