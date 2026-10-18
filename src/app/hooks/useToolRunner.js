import { useCallback, useState } from 'react';
import { readFiles, zipNameFor, zipOutputs } from '../files.js';
import { clientFor } from '../services.js';

/**
 * @typedef {{ name: string, bytes: Uint8Array }} Output
 * @typedef {{ kind: 'idle' }
 *   | { kind: 'busy' }
 *   | { kind: 'ok', message: string, detail: string, outputs: Output[], zip: Output | null }
 *   | { kind: 'error', message: string }} RunStatus
 */

/** Read the files, run the tool in the worker, and track the result. */
export function useToolRunner(tool) {
  const [status, setStatus] = useState(/** @type {RunStatus} */ ({ kind: 'idle' }));

  const run = useCallback(
    async (files, options) => {
      setStatus({ kind: 'busy' });
      try {
        const res = await clientFor(tool).run({ toolId: tool.id, files: await readFiles(files), options });
        if (!res.ok) return setStatus({ kind: 'error', message: res.error });
        setStatus({
          kind: 'ok',
          ...successMessage(res),
          outputs: res.outputs,
          zip: res.outputs.length > 1 ? zipOutputs(res.outputs, zipNameFor(tool, files[0].name)) : null,
        });
      } catch (err) {
        setStatus({ kind: 'error', message: `Unexpected error: ${err.message}` });
      }
    },
    [tool],
  );

  const showError = useCallback((message) => setStatus({ kind: 'error', message }), []);
  const clear = useCallback(() => setStatus({ kind: 'idle' }), []);

  return { status, run, showError, clear };
}

/** A short headline, plus any summary or note from the tool as plain-sentence detail. */
export function successMessage({ outputs, summary, note }) {
  return {
    message: outputs.length === 1 ? 'Your file is ready.' : `Created ${outputs.length} files.`,
    detail: [summary, note].filter(Boolean).join(' '),
  };
}
