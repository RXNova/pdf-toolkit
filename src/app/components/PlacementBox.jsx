import { useEffect, useRef, useState } from 'react';

const MIN_W = 0.03;
const round = (n) => Math.round(n * 10000) / 10000;
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), Math.max(lo, hi));

/**
 * Keeps an overlay exactly over the canvas inside `previewRef` (the page as drawn), so
 * children can be positioned in page fractions. Follows the canvas as it resizes.
 */
export function OverlayFrame({ previewRef, children }) {
  const [box, setBox] = useState(null);
  useEffect(() => {
    const host = previewRef.current;
    const measure = () => {
      const canvas = host?.querySelector('canvas');
      if (!canvas || !canvas.offsetWidth) return setBox(null);
      setBox({ left: canvas.offsetLeft, top: canvas.offsetTop, width: canvas.offsetWidth, height: canvas.offsetHeight });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    const canvas = host?.querySelector('canvas');
    if (canvas) ro.observe(canvas);
    const mo = new MutationObserver(measure); // the canvas appears once the page is open
    mo.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['width', 'height'] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [previewRef]);
  if (!box) return null;
  return <div className="overlay-frame" style={box}>{typeof children === 'function' ? children(box) : children}</div>;
}

/**
 * A draggable, resizable box on the page (an image, or text via `children`). `value` is
 * { x, y, w } in page fractions (top-left corner and width); height is width × `aspect`.
 * Arrow keys move it (Shift for bigger steps), + and − resize it, Delete removes it.
 */
export default function PlacementBox({ frame, src, aspect, value, onChange, label, selected = false, onSelect, onDelete, children }) {
  const drag = useRef(null);
  const hFrac = (w) => (w * frame.width * aspect) / frame.height;
  const w = clamp(value.w, MIN_W, 1);
  const x = clamp(value.x, 0, 1 - w);
  const y = clamp(value.y, 0, 1 - hFrac(w));
  const commit = (next) => onChange({ x: round(next.x), y: round(next.y), w: round(next.w) });

  const begin = (mode, e) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect?.();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, x, y, w };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / frame.width;
    const dy = (e.clientY - d.sy) / frame.height;
    if (d.mode === 'move') commit({ w: d.w, x: clamp(d.x + dx, 0, 1 - d.w), y: clamp(d.y + dy, 0, 1 - hFrac(d.w)) });
    else {
      const nw = clamp(d.w + dx, MIN_W, Math.min(1 - d.x, ((1 - d.y) * frame.height) / (frame.width * aspect)));
      commit({ x: d.x, y: d.y, w: nw });
    }
  };
  const end = () => {
    drag.current = null;
  };

  function onKeyDown(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && onDelete) {
      e.preventDefault();
      return onDelete();
    }
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      const [dx, dy] = moves[e.key];
      commit({ w, x: clamp(x + dx, 0, 1 - w), y: clamp(y + dy, 0, 1 - hFrac(w)) });
    } else if (e.key === '+' || e.key === '=' || e.key === '-') {
      const nw = clamp(w + (e.key === '-' ? -step : step), MIN_W, Math.min(1 - x, ((1 - y) * frame.height) / (frame.width * aspect)));
      commit({ x, y, w: nw });
    } else return;
    e.preventDefault();
  }

  return (
    <div
      className={`placement${selected ? ' selected' : ''}`}
      style={{ left: x * frame.width, top: y * frame.height, width: w * frame.width, height: w * frame.width * aspect }}
      tabIndex={0}
      role="group"
      aria-label={`${label}: drag to move, drag the corner to resize; arrow keys move, + and − resize${onDelete ? ', Delete removes' : ''}`}
      onPointerDown={(e) => begin('move', e)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
      onFocus={onSelect}
    >
      {src ? <img src={src} alt="" draggable={false} /> : children}
      <span className="placement-handle" aria-hidden="true" onPointerDown={(e) => begin('resize', e)} onPointerMove={move} onPointerUp={end} />
    </div>
  );
}

/** Natural aspect ratio (height / width) of an image URL, or null until it has loaded. */
export function useImageAspect(src) {
  const [state, setState] = useState({ src: null, aspect: null });
  useEffect(() => {
    if (!src) return undefined;
    let live = true;
    const img = new Image();
    img.onload = () => live && setState({ src, aspect: img.naturalHeight / img.naturalWidth || 1 });
    img.src = src;
    return () => {
      live = false;
    };
  }, [src]);
  return state.src === src ? state.aspect : null;
}
