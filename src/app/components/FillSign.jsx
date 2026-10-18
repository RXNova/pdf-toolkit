import { CalendarDays, ImagePlus, Repeat, Signature, Type, X } from 'lucide-react';
import { useRef, useState } from 'react';
import FormFields from './FormFields.jsx';
import PlacementBox from './PlacementBox.jsx';
import SignaturePad from './SignaturePad.jsx';

const INKS = ['#111827', '#1d3fbf', '#8b1a1a'];
let nextId = 0;
const newId = () => `i${Date.now().toString(36)}${(nextId++).toString(36)}`;

/** Items on the pages, from the `items` option (JSON). */
export function parseItems(json) {
  try {
    const v = JSON.parse(json || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Height ÷ width of a line of Helvetica text, measured with the browser (Arial is metric-compatible). */
export function textAspect(text) {
  const ctx = document.createElement('canvas').getContext?.('2d');
  if (!ctx) return 1 / Math.max(text.length * 0.55, 0.5); // no canvas (tests): a fair estimate
  ctx.font = '100px Helvetica, Arial, sans-serif';
  return 100 / Math.max(ctx.measureText(text || ' ').width, 1);
}

const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const describe = (item) => (item.kind === 'text' ? `“${item.text}”` : item.label ?? 'Image');

/**
 * The Fill & sign controls in the options panel: add a signature, text, a date or an image to
 * the page being viewed, list what's placed, edit the selected text, and fill form fields.
 */
export function FillSignPanel({ file, items, onItems, values, onValues, onHasForm, page, selected, onSelect, onShowPage }) {
  const [padOpen, setPadOpen] = useState(false);
  const [signature, setSignature] = useState('');
  const picker = useRef(null);
  const current = items.find((i) => i.id === selected);

  const add = (item) => {
    const placed = { id: newId(), page, allPages: false, ...item };
    onItems([...items, placed]);
    onSelect(placed.id);
  };
  const update = (id, patch) => onItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id) => {
    onItems(items.filter((i) => i.id !== id));
    if (selected === id) onSelect(null);
  };

  function addText(text) {
    const w = Math.min(0.5, 0.03 * text.length + 0.06);
    add({ kind: 'text', text, color: INKS[0], x: 0.1, y: 0.1, w, aspect: textAspect(text) });
  }
  function placeSignature() {
    loadAspect(signature).then((aspect) => add({ kind: 'image', label: 'Signature', src: signature, x: 0.55, y: 0.75, w: 0.3, aspect }));
    setPadOpen(false);
  }
  function addImage(f) {
    if (!f || !/^image\/(png|jpeg)$/.test(f.type)) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const src = String(reader.result);
      add({ kind: 'image', label: f.name, src, x: 0.35, y: 0.4, w: 0.3, aspect: await loadAspect(src) });
    };
    reader.readAsDataURL(f);
  }

  return (
    <div className="fill-sign">
      <section aria-label="Add to the page">
        <span className="field-label">Add to page {page}</span>
        <div className="add-grid">
          <button type="button" className={`btn outline${padOpen ? ' active' : ''}`} aria-expanded={padOpen} onClick={() => setPadOpen(!padOpen)}>
            <Signature size={14} aria-hidden="true" /> Signature
          </button>
          <button type="button" className="btn outline" onClick={() => addText('Your text')}><Type size={14} aria-hidden="true" /> Text</button>
          <button type="button" className="btn outline" onClick={() => addText(today())}><CalendarDays size={14} aria-hidden="true" /> Date</button>
          <button type="button" className="btn outline" onClick={() => picker.current.click()}><ImagePlus size={14} aria-hidden="true" /> Image</button>
        </div>
        <input ref={picker} type="file" hidden accept=".png,.jpg,.jpeg,image/png,image/jpeg" data-testid="image-input"
          onChange={(e) => { addImage(e.target.files[0]); e.target.value = ''; }} />
      </section>

      {padOpen && (
        <div className="sig-drawer">
          <SignaturePad value={signature} onChange={setSignature} />
          <button type="button" className="btn primary block" disabled={!signature} onClick={placeSignature}>Place on page {page}</button>
        </div>
      )}

      {items.length > 0 && (
        <section aria-label="On the pages">
          <span className="field-label">On the pages · {items.length}</span>
          <ul className="item-list">
            {items.map((item) => (
              <li key={item.id} className={item.id === selected ? 'selected' : undefined}>
                <button type="button" className="item-name" onClick={() => { onSelect(item.id); onShowPage(item.page); }}>
                  {item.kind === 'image' ? <img src={item.src} alt="" /> : <Type size={14} aria-hidden="true" />}
                  <span>{describe(item)}</span>
                  <span className="item-page">{item.allPages ? 'All pages' : `p. ${item.page}`}</span>
                </button>
                <button type="button" className={`icon-btn${item.allPages ? ' on' : ''}`} aria-pressed={item.allPages}
                  aria-label={`Repeat ${describe(item)} on every page`} onClick={() => update(item.id, { allPages: !item.allPages })}>
                  <Repeat size={14} aria-hidden="true" />
                </button>
                <button type="button" className="icon-btn danger" aria-label={`Remove ${describe(item)}`} onClick={() => remove(item.id)}>
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {current?.kind === 'text' && (
        <section className="text-editor" aria-label="Selected text">
          <div className="field">
            <label className="field-label" htmlFor="fs-text">Text</label>
            <input id="fs-text" type="text" value={current.text}
              onChange={(e) => update(current.id, { text: e.target.value, aspect: textAspect(e.target.value) })} />
          </div>
          <div className="sig-inks" role="radiogroup" aria-label="Text colour">
            {INKS.map((color, i) => (
              <button key={color} type="button" role="radio" aria-checked={current.color === color}
                aria-label={['Black', 'Blue', 'Red'][i]} className={`sig-ink${current.color === color ? ' on' : ''}`}
                style={{ '--ink': color }} onClick={() => update(current.id, { color })} />
            ))}
          </div>
        </section>
      )}

      <FormFields file={file} value={values} onChange={onValues} onFields={(fields) => onHasForm(fields.length > 0)} quietWhenEmpty />
    </div>
  );
}

/** The placed items on the page being viewed, as draggable boxes (for the viewer's overlay). */
export function fillSignOverlay({ items, page, selected, onSelect, onItems }) {
  const visible = items.filter((i) => i.allPages || i.page === page);
  if (!visible.length) return null;
  return (frame) => visible.map((item) => (
    <PlacementBox key={item.id} frame={frame} aspect={item.aspect || 0.3} src={item.kind === 'image' ? item.src : undefined}
      label={item.kind === 'text' ? `Text “${item.text}”` : item.label ?? 'Image'}
      value={{ x: item.x, y: item.y, w: item.w }} selected={item.id === selected} onSelect={() => onSelect(item.id)}
      onDelete={() => { onItems(items.filter((i) => i.id !== item.id)); onSelect(null); }}
      onChange={(p) => onItems(items.map((i) => (i.id === item.id ? { ...i, ...p } : i)))}>
      {item.kind === 'text' && (
        <span className="placement-text" style={{ color: item.color, fontSize: item.w * frame.width * (item.aspect || 0.3) }}>{item.text}</span>
      )}
    </PlacementBox>
  ));
}

function loadAspect(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalHeight / img.naturalWidth || 1);
    img.onerror = () => resolve(1);
    img.src = src;
  });
}
