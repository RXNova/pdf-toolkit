import { useEffect, useState } from 'react';
import { readFiles } from '../files.js';
import { toolClient } from '../services.js';

const DELAY = 300; // ms after the last change before re-running

/**
 * For tools with `livePreview`: re-run the tool in the worker shortly after the file or any
 * option changes, so the viewer can show the real output (exactly what Run will produce).
 * @returns {{ file: File | null, pending: boolean, error: string | null }}
 */
export function useLivePreview(tool, file, options) {
  const [state, setState] = useState({ source: null, file: null, error: null, key: null });
  const key = JSON.stringify(options);
  const enabled = Boolean(tool.livePreview && file);

  useEffect(() => {
    if (!enabled) return undefined;
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const res = await toolClient.run({ toolId: tool.id, files: await readFiles([file]), options: JSON.parse(key) });
        if (stale) return;
        if (res.ok) {
          const [out] = res.outputs;
          setState({ source: file, key, error: null, file: new File([out.bytes], out.name, { type: 'application/pdf' }) });
        } else setState((s) => ({ ...s, source: file, key, error: res.error })); // keep the last good preview
      } catch (err) {
        if (!stale) setState((s) => ({ ...s, source: file, key, error: err.message }));
      }
    }, DELAY);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [enabled, tool, file, key]);

  const current = enabled && state.source === file;
  return {
    file: current ? state.file : null,
    error: current ? state.error : null,
    pending: enabled && (state.source !== file || state.key !== key),
  };
}
