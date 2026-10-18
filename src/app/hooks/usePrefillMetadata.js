import { useEffect } from 'react';
import { pdfPreview } from '../services.js';

/** For Edit metadata: fill the title/author/subject/keywords options from the file once it's added. */
export function usePrefillMetadata(tool, file, setOptions) {
  useEffect(() => {
    if (!tool.prefillMetadata || !file) return undefined;
    let live = true;
    let doc = null;
    pdfPreview.open(file).then(async (d) => {
      doc = d;
      const info = await d.info();
      if (live) setOptions((o) => ({ ...o, ...info }));
      d.close();
    }).catch(() => {}); // unreadable or locked: the viewer says so; fields stay empty
    return () => {
      live = false;
      if (doc) doc.close();
    };
  }, [tool, file, setOptions]);
}
