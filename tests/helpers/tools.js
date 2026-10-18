import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { getToolDef } from '../../src/catalog.js';
import { parseOptions } from '../../src/core/options.js';
import { createQpdf } from '../../src/core/qpdf.js';

const require = createRequire(import.meta.url);

/** Options for a tool as the toolkit would pass them: catalog defaults + overrides, parsed. */
export const optionsFor = (toolId, overrides = {}) => parseOptions(getToolDef(toolId).options, overrides);

/** Deps whose qpdf/codec fail loudly, for tools that shouldn't touch them. */
export const unusedDeps = () => ({
  qpdf: () => Promise.reject(new Error('qpdf should not be called')),
  imageCodec: { recompress: () => Promise.reject(new Error('imageCodec should not be called')) },
});

let wasmBinary;
/** The real qpdf WebAssembly build, loaded from node_modules (same binary the browser uses). */
export function realQpdf() {
  wasmBinary ??= readFileSync(require.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm'));
  const createModule = require('@neslinesli93/qpdf-wasm');
  return createQpdf(() => createModule({ wasmBinary, noInitialRun: true }));
}
