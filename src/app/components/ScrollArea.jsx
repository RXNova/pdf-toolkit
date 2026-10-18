import { useEffect, useRef } from 'react';

/** Marks the frame with data-more-above / data-more-below while content is hidden that way. */
export function updateEdges(el) {
  const frame = el.parentElement;
  const above = el.scrollTop > 1;
  const below = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
  frame.toggleAttribute('data-more-above', above);
  frame.toggleAttribute('data-more-below', below);
}

/**
 * A scrolling element inside a frame that fades the content out at an edge while there is
 * more to scroll that way. The fades are overlays on the frame, so they read the same in
 * light and dark themes. Edges are written straight to the DOM: scrolling never re-renders.
 */
export default function ScrollArea({ as: Tag = 'div', ref: outerRef, children, ...props }) {
  const ref = useRef(null);
  const setRef = (el) => {
    ref.current = el;
    if (outerRef) outerRef.current = el; // callers get the scrolling element too
  };

  // Re-attach when the element is replaced (a different `as` mounts a new one).
  useEffect(() => {
    const el = ref.current;
    const update = () => updateEdges(el);
    el.addEventListener('scroll', update, { passive: true });
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    resize?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      resize?.disconnect();
    };
  }, [Tag]);

  // Content changes (files added, filter changed) come from renders, so re-check after each.
  useEffect(() => updateEdges(ref.current));

  return (
    <div className="scroll-area">
      <Tag ref={setRef} {...props}>{children}</Tag>
    </div>
  );
}
