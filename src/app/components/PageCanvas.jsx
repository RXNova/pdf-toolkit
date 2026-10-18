import { useEffect, useRef, useState } from 'react';

export const THUMB_WIDTH = 120; // CSS px drawn per page thumbnail

/**
 * One page of an open PDF drawn into a canvas. With `lazy`, drawing waits until the
 * canvas is near the viewport, so a 300-page grid only draws what is on screen.
 */
export default function PageCanvas({ doc, page, width, label, lazy = false }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(!lazy || typeof IntersectionObserver === 'undefined');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (visible) return undefined;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { rootMargin: '300px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;
    let live = true; // a render of a replaced document may fail as it's closed; that's not a failure here
    doc.render(page, ref.current, width).catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [doc, page, width, visible]);

  return failed ? <span className="preview-note">No preview</span> : <canvas ref={ref} role="img" aria-label={label} />;
}
