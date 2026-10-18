import { useEffect, useState } from 'react';
import { MIME } from '../files.js';

/**
 * A blob: URL for the given bytes, revoked when they change or the component unmounts.
 * `bytes` must be referentially stable (e.g. from state); a new array each render would loop.
 */
export function useObjectUrl(bytes, type = MIME.pdf) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!bytes) return undefined;
    const next = URL.createObjectURL(new Blob([bytes], { type }));
    // The URL is an external resource that must live exactly as long as this effect
    // (useMemo would be revoked by StrictMode's simulated unmount and never recreated).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [bytes, type]);
  return url;
}
