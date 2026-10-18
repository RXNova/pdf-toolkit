// Web Worker entry point: composes the toolkit with browser implementations of its deps.
// All PDF processing happens here, off the UI thread. Nothing is sent over the network.
import wasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url';
import { createQpdf } from '../core/qpdf.js';
import { createToolkit } from '../core/toolkit.js';
import { createCanvasImageCodec } from './image-codec.js';
import { createMessageHandler } from './protocol.js';

// qpdf (~1.3 MB of wasm) loads on first use of Protect/Unlock, from this app's own origin.
const loadQpdf = async () => {
  const { default: createModule } = await import('@neslinesli93/qpdf-wasm');
  return createModule({ locateFile: () => wasmUrl, noInitialRun: true });
};

const handle = createMessageHandler(
  createToolkit({ qpdf: createQpdf(loadQpdf), imageCodec: createCanvasImageCodec() }),
);

self.onmessage = async (event) => {
  const { message, transfer } = await handle(event.data);
  self.postMessage(message, transfer);
};
