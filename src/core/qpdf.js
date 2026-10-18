/**
 * Adapter around qpdf compiled to WebAssembly (used for encryption, which pdf-lib lacks).
 * The module factory is injected: the worker loads the .wasm by URL, Node tests load it from disk.
 *
 * This qpdf build writes diagnostics straight to `console` (it ignores Emscripten's print hooks),
 * so callers must decide what went wrong from the exit code and their own checks, not from text.
 *
 * @typedef {object} QpdfModule  the parts of the Emscripten module we use
 * @property {{ writeFile(path: string, data: Uint8Array): void, readFile(path: string): Uint8Array }} FS
 * @property {(args: string[]) => number} callMain
 *
 * @typedef {() => Promise<QpdfModule>} QpdfFactory
 */

export const QPDF_INPUT = '/input.pdf';
export const QPDF_OUTPUT = '/output.pdf';
/** qpdf exits 3 when it succeeded with warnings. */
const OK_CODES = [0, 3];

/** qpdf exited with a failure code. */
export class QpdfError extends Error {
  constructor(code) {
    super(`qpdf failed with exit code ${code}`);
    this.name = 'QpdfError';
    this.code = code;
  }
}

/**
 * @param {QpdfFactory} createModule  must return a fresh instance: callMain can only run once per instance
 * @returns {(args: string[], input: Uint8Array) => Promise<Uint8Array>}
 *   Runs qpdf with `args` (which should reference QPDF_INPUT / QPDF_OUTPUT) and returns the output file.
 */
export function createQpdf(createModule) {
  return async (args, input) => {
    const qpdf = await createModule();
    qpdf.FS.writeFile(QPDF_INPUT, input);
    let code;
    try {
      code = qpdf.callMain(args);
    } catch (err) {
      // Emscripten throws ExitStatus for exit() calls; anything else is a crash.
      if (typeof err?.status !== 'number') throw err;
      code = err.status;
    }
    if (!OK_CODES.includes(code)) throw new QpdfError(code);
    return qpdf.FS.readFile(QPDF_OUTPUT);
  };
}
