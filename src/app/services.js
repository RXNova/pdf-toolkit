// App-wide singletons. Components import from here so tests can mock one module.
import { UserError } from '../core/errors.js';
import { createToolClient } from './client.js';
import { createPdfPreview } from './pdf-preview.js';

export const toolClient = createToolClient();
export const pdfPreview = createPdfPreview();

/**
 * Same API as toolClient, for tools that run on the UI thread (`thread: 'main'`) because they
 * need the browser's PDF renderer. The core loads on first use, so it costs nothing until then.
 */
export const mainThreadClient = {
  async run(request) {
    const { createToolkit } = await import('../core/toolkit.js');
    try {
      return { ok: true, ...(await createToolkit({ rasterize: pdfPreview.rasterize }).run(request)) };
    } catch (err) {
      if (err instanceof UserError) return { ok: false, error: err.message };
      throw err;
    }
  },
};

/** The client that runs a given tool. */
export const clientFor = (tool) => (tool.thread === 'main' ? mainThreadClient : toolClient);
