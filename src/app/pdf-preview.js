// Page previews with pdf.js. The library (~1 MB with its worker) loads on first use, and all
// documents share one pdf.js worker. Separate from the toolkit worker: rendering is UI work.

let loaded;
function loadPdfjs() {
  loaded ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(
    ([pdfjs, { default: workerSrc }]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      return { pdfjs, worker: new pdfjs.PDFWorker() };
    },
  );
  return loaded;
}

/**
 * @typedef {object} PreviewDoc
 * @property {number} pageCount
 * @property {(page: number, canvas: HTMLCanvasElement, cssWidth: number) => Promise<void>} render
 *   draws a page (1-based); a newer render into the same canvas cancels the previous one
 * @property {() => void} close  frees the document in the worker
 */

/** @returns {{ open(file: Blob): Promise<PreviewDoc> }} open() rejects with name 'PasswordException' for locked files */
export function createPdfPreview() {
  return {
    async open(file) {
      const { pdfjs, worker } = await loadPdfjs();
      const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), worker, isEvalSupported: false });
      let doc;
      try {
        doc = await task.promise;
      } catch (err) {
        task.destroy();
        throw err;
      }
      const latest = new WeakMap(); // canvas → token of the newest render request
      const rendering = new WeakMap(); // canvas → its render in progress
      return {
        pageCount: doc.numPages,
        async render(n, canvas, cssWidth) {
          const token = {};
          latest.set(canvas, token);
          rendering.get(canvas)?.cancel();
          const page = await doc.getPage(n);
          if (latest.get(canvas) !== token) return; // superseded while the page loaded
          const scale = (cssWidth * (globalThis.devicePixelRatio || 1)) / page.getViewport({ scale: 1 }).width;
          const viewport = page.getViewport({ scale });
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          const job = page.render({ canvas, viewport });
          rendering.set(canvas, job);
          try {
            await job.promise;
          } catch (err) {
            if (err?.name !== 'RenderingCancelledException') throw err;
          }
        },
        /** Title, author, subject and keywords from the document properties. */
        async info() {
          const { info = {} } = await doc.getMetadata();
          return { title: info.Title ?? '', author: info.Author ?? '', subject: info.Subject ?? '', keywords: info.Keywords ?? '' };
        },
        close: () => task.destroy(),
      };
    },

    /** Rasterizer for "PDF to JPG / PNG" (see core/tools/toimage.js). Pages render one at a time. */
    rasterize: {
      async info(bytes) {
        const { pdfjs, worker } = await loadPdfjs();
        const task = pdfjs.getDocument({ data: bytes.slice(), worker, isEvalSupported: false });
        try {
          return { pageCount: (await task.promise).numPages };
        } finally {
          task.destroy();
        }
      },
      async pages(bytes, { pages, scale, type, quality }) {
        const { pdfjs, worker } = await loadPdfjs();
        const task = pdfjs.getDocument({ data: bytes.slice(), worker, isEvalSupported: false });
        try {
          const doc = await task.promise;
          const out = [];
          for (const n of pages) {
            const page = await doc.getPage(n);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff'; // JPG has no transparency; PNGs look like the page too
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvas, viewport }).promise;
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
            out.push(new Uint8Array(await blob.arrayBuffer()));
            page.cleanup();
          }
          return out;
        } finally {
          task.destroy();
        }
      },
    },
  };
}
