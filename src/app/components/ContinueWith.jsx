import { ArrowRight, ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ACCEPT, TOOL_CATALOG } from '../../catalog.js';
import { extname } from '../../core/names.js';
import { formatBytes, mimeFor } from '../files.js';
import { ToolIcon } from '../icons.jsx';
import { toolNumber, toolStyle } from '../tool-meta.js';

/**
 * @typedef {{ name: string, size: number, toFile: () => File }} Source
 *   a file that can be handed to another tool: a run's output, or a file already loaded
 */

/** The sources a tool can take as input (by file type). */
export const usableBy = (tool, sources) => sources.filter((s) => ACCEPT[tool.accept].includes(extname(s.name)));

/** A run's outputs ({ name, bytes }) as sources. */
export const fromOutputs = (outputs) =>
  outputs.map((o) => ({ name: o.name, size: o.bytes.length, toFile: () => new File([o.bytes], o.name, { type: mimeFor(o.name) }) }));

/** Files already loaded in a tool, as sources. */
export const fromFiles = (files) => files.map((f) => ({ name: f.name, size: f.size, toFile: () => f }));

/**
 * Pick another tool and take files into it. Tools that take several files get every usable
 * source; a one-file tool asks which one when there are several.
 *   variant "inline": an expanding list (results panel, "Continue with…")
 *   variant "menu":   a dropdown from a button (tool header, "Switch tool")
 */
export default function ToolSwitch({ tool: current, sources, onPick, variant = 'inline', label = 'Continue with…' }) {
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState(null); // a one-file tool waiting for the user to pick a source
  const ref = useRef(null);
  const targets = TOOL_CATALOG.filter((t) => t.id !== current.id && usableBy(t, sources).length > 0);

  // Inline: bring the list into view in the scrolling options panel. Menu: close on outside click or Escape.
  useEffect(() => {
    if (!open && !choosing) return undefined;
    if (variant === 'inline') {
      ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      return undefined;
    }
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) {
        setOpen(false);
        setChoosing(null);
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open, choosing, variant]);

  if (!targets.length) return null;

  function pick(target) {
    const usable = usableBy(target, sources);
    if (target.multi || usable.length === 1) onPick(target, (target.multi ? usable : usable.slice(0, 1)).map((s) => s.toFile()));
    else setChoosing(target);
  }

  const body = choosing ? (
    <div className="continue-choose" role="group" aria-label={`Choose a file for ${choosing.title}`}>
      <div className="continue-head">
        <span className="field-label">{choosing.title} takes one file. Which one?</span>
        <button type="button" className="icon-btn" aria-label="Back to the tool list" onClick={() => setChoosing(null)}>
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <ul className="continue-files">
        {usableBy(choosing, sources).map((s) => (
          <li key={s.name}>
            <button type="button" className="continue-file" onClick={() => onPick(choosing, [s.toFile()])}>
              <span className="doc" aria-hidden="true">{extname(s.name).toUpperCase()}</span>
              <span className="fname">{s.name}</span>
              <span className="fsize">{formatBytes(s.size)}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  ) : open ? (
    <ul className="continue-tools">
      {targets.map((t) => (
        <li key={t.id} style={toolStyle(t)}>
          <button type="button" className="continue-tool" onClick={() => pick(t)} aria-label={`${variant === 'menu' ? 'Switch to' : 'Continue with'} ${t.title}`}>
            <span className="badge">{toolNumber(t)}</span>
            <span className="app-icon sm"><ToolIcon name={t.icon} size={14} /></span>
            <span className="continue-title">{t.title}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <section ref={ref} className={`continue ${variant}`} aria-label={variant === 'menu' ? 'Switch to another tool' : 'Continue with another tool'}>
      <button type="button" className={`btn outline${variant === 'inline' ? ' block' : ''} continue-toggle`} aria-expanded={open || Boolean(choosing)}
        onClick={() => { setOpen(!(open || choosing)); setChoosing(null); }}>
        {label} <ChevronDown size={14} aria-hidden="true" className={open || choosing ? 'flip' : undefined} />
      </button>
      {body && <div className="continue-body">{body}</div>}
    </section>
  );
}
