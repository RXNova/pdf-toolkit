import { ArrowLeft, ArrowRight, Check, Copy, GripVertical, X } from 'lucide-react';
import { useState } from 'react';
import { formatRanges, selectPages } from '../../core/page-ranges.js';
import { usePageFocus } from '../hooks/usePageFocus.js';
import { moveItem } from './FileList.jsx';
import PageCanvas, { THUMB_WIDTH as PAGE_WIDTH } from './PageCanvas.jsx';
import ScrollArea from './ScrollArea.jsx';
import SplitPages from './SplitPages.jsx';

const HINTS = {
  keep: 'Click pages to keep · Shift-click for a run',
  remove: 'Click pages to remove · Shift-click for a run',
  arrange: 'Drag pages into order · Copy or drop pages',
};

/** 1-based pages a spec selects, or null while it can't be read (e.g. mid-typing "9" in a 4-page file). */
export function readSpec(spec, pageCount) {
  try {
    return selectPages(spec, pageCount).map((i) => i + 1);
  } catch {
    return null;
  }
}

/**
 * Every page of an open PDF as a numbered grid. With `edit`, the grid edits `value`, the
 * tool's page spec, so it stays in step with the text field in the options panel:
 *   keep / remove: click pages to select them; arrange: drag, copy and drop pages;
 *   split: drag across pages to group them into files (see SplitPages).
 * Without `edit`, the grid is just a preview.
 */
export default function PageGrid(props) {
  return props.edit === 'split' ? <SplitPages {...props} /> : <Pages {...props} />;
}

function Pages({ doc, fileName, edit, value = '', onChange, focusPage, onFocusPage, optional = false }) {
  const count = doc.pageCount;
  const all = Array.from({ length: count }, (_, i) => i + 1);
  // An empty spec means "all pages" to the core; for selecting, it means nothing picked yet.
  const read = value.trim() ? readSpec(value, count) : edit === 'arrange' ? all : [];
  const unreadable = read === null;
  const picked = new Set(read ?? []);
  const order = edit === 'arrange' ? (read ?? all) : all;
  const [anchor, setAnchor] = useState(null); // last clicked page, for shift-click runs
  const [dragIndex, setDragIndex] = useState(null);

  const { listRef, focusProps, pageClass } = usePageFocus(focusPage, onFocusPage);

  const setPicked = (pages) => onChange(formatRanges([...pages].sort((a, b) => a - b)));
  const setOrder = (pages) => onChange(formatRanges(pages));

  function toggle(page, shift) {
    const next = new Set(picked);
    if (shift && anchor !== null) {
      const on = !picked.has(page);
      for (let p = Math.min(anchor, page); p <= Math.max(anchor, page); p++) {
        if (on) next.add(p);
        else next.delete(p);
      }
    } else if (next.has(page)) next.delete(page);
    else next.add(page);
    setAnchor(page);
    setPicked(next);
  }

  return (
    <div className="page-editor">
      {edit && (
        <div className="page-bar">
          <span className="mono-label">
            {unreadable ? 'Can’t show that page list yet' : optional && edit === 'keep' ? 'Click pages to pick some · None picked = all' : HINTS[edit]}
          </span>
          <span className="page-bar-end">
            {edit === 'arrange' ? (
              <>
                <span className="mono-label">{order.length} pages</span>
                <button type="button" className="tab" onClick={() => onChange('')} disabled={!value}>Reset</button>
              </>
            ) : (
              <>
                <span className="mono-label">{optional && !picked.size ? `All ${count}` : `${picked.size} of ${count}`}</span>
                {edit === 'keep' && <button type="button" className="tab" onClick={() => setPicked(all)}>All</button>}
                <button type="button" className="tab" onClick={() => setPicked(all.filter((p) => !picked.has(p)))}>Invert</button>
                <button type="button" className="tab" onClick={() => onChange('')} disabled={!picked.size}>Clear</button>
              </>
            )}
          </span>
        </div>
      )}
      <ScrollArea ref={listRef} as="ol" className={`pages${edit ? ` ${edit}` : ''}`} aria-label={`Pages of ${fileName}`}>
        {edit === 'arrange'
          ? order.map((page, i) => (
            <li
              key={`${i}-${page}`}
              className={pageClass(page, dragIndex === i ? ' dragging' : '')}
              {...focusProps(page)}
              draggable
              onDragStart={(e) => {
                setDragIndex(i);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(e) => dragIndex !== null && e.preventDefault()}
              onDrop={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                e.stopPropagation(); // not a file drop for the pane
                setOrder(moveItem(order, dragIndex, i));
                setDragIndex(null);
              }}
            >
              <div className="page-top">
                <GripVertical className="handle" size={14} aria-hidden="true" />
                <span className="page-actions">
                  <button type="button" className="icon-btn" aria-label={`Move page ${page} left`} disabled={i === 0}
                    onClick={() => setOrder(moveItem(order, i, i - 1))}><ArrowLeft size={14} aria-hidden="true" /></button>
                  <button type="button" className="icon-btn" aria-label={`Move page ${page} right`} disabled={i === order.length - 1}
                    onClick={() => setOrder(moveItem(order, i, i + 1))}><ArrowRight size={14} aria-hidden="true" /></button>
                  <button type="button" className="icon-btn" aria-label={`Copy page ${page}`}
                    onClick={() => setOrder(order.toSpliced(i + 1, 0, page))}><Copy size={14} aria-hidden="true" /></button>
                  <button type="button" className="icon-btn danger" aria-label={`Drop page ${page}`} disabled={order.length === 1}
                    onClick={() => setOrder(order.toSpliced(i, 1))}><X size={14} aria-hidden="true" /></button>
                </span>
              </div>
              <div className="preview"><PageCanvas doc={doc} page={page} width={PAGE_WIDTH} label={`Page ${page}`} lazy /></div>
              <span className="page-num">{page}</span>
            </li>
          ))
          : order.map((page) => {
            const thumb = <div className="preview"><PageCanvas doc={doc} page={page} width={PAGE_WIDTH} label={`Page ${page}`} lazy /></div>;
            // Read-only pages become buttons only when there is a preview to show them in.
            const show = (inner) => (onFocusPage
              ? <button type="button" className="page-pick" aria-label={`Show page ${page}`}>{inner}</button>
              : inner);
            if (!edit) return <li key={page} className={pageClass(page)} {...focusProps(page)}>{show(<>{thumb}<span className="page-num">{page}</span></>)}</li>;
            const on = picked.has(page);
            return (
              <li key={page} className={pageClass(page, on ? ' on' : '')} {...focusProps(page)}>
                <button type="button" className="page-pick" aria-pressed={on}
                  aria-label={`${edit === 'keep' ? 'Keep' : 'Remove'} page ${page}`}
                  onClick={(e) => toggle(page, e.shiftKey)}>
                  {thumb}
                  {on && <span className="page-mark" aria-hidden="true">{edit === 'keep' ? <Check size={14} /> : <X size={14} />}</span>}
                  <span className="page-num">{page}</span>
                </button>
              </li>
            );
          })}
      </ScrollArea>
    </div>
  );
}
