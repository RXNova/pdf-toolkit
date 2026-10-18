import { Eraser } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Cells from './Cells.jsx';

const INKS = [['#111827', 'Black'], ['#1d3fbf', 'Blue'], ['#8b1a1a', 'Red']];
const STYLES = [
  ['script', 'Script', 'italic 400 56px "Snell Roundhand", "Segoe Script", "Brush Script MT", "Apple Chancery", cursive'],
  ['serif', 'Serif', 'italic 500 48px "Baskerville", "Times New Roman", serif'],
  ['plain', 'Plain', '600 44px "Inter Variable", system-ui, sans-serif'],
];

/**
 * Draw or type a signature. Reports a tightly-cropped transparent PNG as a data: URL (or '')
 * through `onChange`; the page overlay then shows it for placing.
 */
export default function SignaturePad({ value, onChange }) {
  const [mode, setMode] = useState('draw');
  const [ink, setInk] = useState(INKS[0][0]);
  const [name, setName] = useState('');
  const [style, setStyle] = useState('script');
  const canvas = useRef(null);
  const drawing = useRef(null);
  const [hasInk, setHasInk] = useState(false);

  // Typed signatures render whenever the name, style or ink changes.
  useEffect(() => {
    if (mode !== 'type') return;
    if (!name.trim()) return onChange('');
    const font = STYLES.find(([id]) => id === style)[2];
    onChange(trimmedPng((ctx) => {
      ctx.font = font;
      const width = ctx.measureText(name).width + 40;
      return [width, 110, () => {
        ctx.font = font;
        ctx.fillStyle = ink;
        ctx.textBaseline = 'middle';
        ctx.fillText(name, 20, 58);
      }];
    }));
  }, [mode, name, style, ink]); // eslint-disable-line react-hooks/exhaustive-deps

  const point = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return [((e.clientX - r.left) * canvas.current.width) / r.width, ((e.clientY - r.top) * canvas.current.height) / r.height];
  };
  const down = (e) => {
    e.preventDefault();
    canvas.current.setPointerCapture?.(e.pointerId);
    const ctx = canvas.current.getContext('2d');
    ctx.strokeStyle = ink;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(...point(e));
    drawing.current = ctx;
  };
  const move = (e) => {
    if (!drawing.current) return;
    drawing.current.lineTo(...point(e));
    drawing.current.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = null;
    setHasInk(true);
    onChange(cropCanvas(canvas.current));
  };
  const clear = () => {
    canvas.current?.getContext('2d').clearRect(0, 0, canvas.current.width, canvas.current.height);
    setHasInk(false);
    setName('');
    onChange('');
  };

  return (
    <section className="sig-pad" aria-label="Your signature">
      <div className="sig-pad-top">
        <span className="field-label">Signature</span>
        <Cells label="Signature mode" options={[['draw', 'Draw'], ['type', 'Type']]} value={mode}
          onChange={(m) => { clear(); setMode(m); }} />
      </div>
      {mode === 'draw' ? (
        <div className="sig-canvas-wrap">
          <canvas ref={canvas} className="sig-canvas" width={560} height={220} aria-label="Draw your signature here"
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          {!hasInk && <span className="sig-placeholder" aria-hidden="true">Sign here</span>}
        </div>
      ) : (
        <div className="sig-type">
          <input type="text" aria-label="Type your name" placeholder="Type your name" value={name} onChange={(e) => setName(e.target.value)} />
          <Cells label="Signature style" options={STYLES.map(([id, label]) => [id, label])} value={style} onChange={setStyle} />
        </div>
      )}
      <div className="sig-pad-bottom">
        <div className="sig-inks" role="radiogroup" aria-label="Ink colour">
          {INKS.map(([color, label]) => (
            <button key={color} type="button" role="radio" aria-checked={ink === color} aria-label={label}
              className={`sig-ink${ink === color ? ' on' : ''}`} style={{ '--ink': color }}
              onClick={() => { setInk(color); if (mode === 'draw') clear(); }} />
          ))}
        </div>
        <button type="button" className="tab" onClick={clear} disabled={!value}><Eraser size={13} aria-hidden="true" /> Clear</button>
      </div>
      <p className="sig-hint">{value ? 'Now drag the signature into place on the page.' : 'Your signature stays on this device.'}</p>
    </section>
  );
}

/** Draw into a fresh canvas sized by `setup`, then crop it to the ink. */
function trimmedPng(setup) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const [w, h, draw] = setup(ctx);
  c.width = Math.ceil(w);
  c.height = h;
  draw();
  return cropCanvas(c);
}

/** A PNG data: URL of the canvas cropped to its non-transparent pixels (plus a little padding). */
export function cropCanvas(c) {
  const { width, height } = c;
  const data = c.getContext('2d').getImageData(0, 0, width, height).data;
  let [x0, y0, x1, y1] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return '';
  const pad = 6;
  const out = document.createElement('canvas');
  [x0, y0] = [Math.max(0, x0 - pad), Math.max(0, y0 - pad)];
  out.width = Math.min(width, x1 + pad) - x0;
  out.height = Math.min(height, y1 + pad) - y0;
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}
