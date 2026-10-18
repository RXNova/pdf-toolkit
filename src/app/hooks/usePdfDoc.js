import { useEffect, useState } from 'react';
import { pdfPreview } from '../services.js';

/**
 * Opens a PDF for previewing. When `file` changes, the previous document stays on screen
 * until the new one is open (so a live preview swaps without flashing), then it is closed.
 * @returns {{ doc: import('../pdf-preview.js').PreviewDoc | null, failure: string | null }}
 *   failure is 'Locked' (password-protected) or 'No preview' (unreadable)
 */
export function usePdfDoc(file) {
  const [state, setState] = useState({ doc: null, failure: null });

  useEffect(() => {
    let gone = false;
    pdfPreview.open(file).then(
      (doc) => (gone ? doc.close() : setState({ doc, failure: null })),
      (err) => !gone && setState({ doc: null, failure: err?.name === 'PasswordException' ? 'Locked' : 'No preview' }),
    );
    return () => {
      gone = true;
    };
  }, [file]);

  // Each document is closed once it's replaced or the component goes away. This runs after
  // pages drawing the old document have been told to stop, so no draw lands on a closed doc.
  useEffect(() => {
    const { doc } = state;
    return () => doc?.close();
  }, [state]);

  return state;
}
