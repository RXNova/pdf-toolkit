/**
 * Promise-based client for the PDF worker. The worker starts lazily on the first request
 * and is restarted if it crashes. Input buffers are transferred to the worker (zero-copy),
 * so callers must not reuse them.
 *
 * @param {() => Worker} [createWorker]  injectable for tests
 */
export function createToolClient(
  createWorker = () => new Worker(new URL('../worker/pdf.worker.js', import.meta.url), { type: 'module' }),
) {
  let worker = null;
  let nextId = 0;
  const pending = new Map();

  function start() {
    worker = createWorker();
    worker.onmessage = ({ data }) => {
      const entry = pending.get(data.id);
      if (!entry) return;
      pending.delete(data.id);
      entry.resolve(data.ok ? { ok: true, ...data.result } : { ok: false, error: data.error });
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      const error = new Error(event.message || 'The PDF worker crashed.');
      for (const { reject } of pending.values()) reject(error);
      pending.clear();
      worker.terminate();
      worker = null;
    };
    return worker;
  }

  return {
    /**
     * @param {import('../core/toolkit.js').RunRequest} request
     * @returns {Promise<({ ok: true } & import('../core/tools/index.js').ToolResult) | { ok: false, error: string }>}
     */
    run(request) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        (worker ?? start()).postMessage({ id, request }, request.files.map((f) => f.bytes.buffer));
      });
    },

    terminate() {
      worker?.terminate();
      worker = null;
    },
  };
}
