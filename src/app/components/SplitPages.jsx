import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePageFocus } from '../hooks/usePageFocus.js';
import { addRest, assign, formatGroups, groupColor, readGroups, removeGroup, resize } from '../split-groups.js';
import PageCanvas, { THUMB_WIDTH } from './PageCanvas.jsx';
import ScrollArea from './ScrollArea.jsx';

const EDGE = 48; // px from the top/bottom of the grid where a drag scrolls it

/**
 * Split's page grid. Drag across pages to make them one output file; drag a group's edge
 * handles to grow or shrink it. Each group has its own colour. The groups are the Ranges
 * field (`value`), so typing there and dragging here stay in step. In "every page" mode the
 * grid only shows that each page becomes its own file.
 */
export default function SplitPages({ doc, fileName, value = '', onChange, everyPage = false, focusPage, onFocusPage }) {
  const count = doc.pageCount;
  const pages = Array.from({ length: count }, (_, i) => i + 1);
  const read = everyPage ? pages.map((p) => [p, p]) : readGroups(value, count);
  const groups = read ?? [];
  const editable = !everyPage;
  const { listRef, focusProps, pageClass } = usePageFocus(focusPage, onFocusPage);

  // A drag in progress: making a new group from `from` to `to`, or moving one edge of group `index`.
  const [drag, setDrag] = useState(null);
  const draft = !drag ? groups
    : drag.mode === 'new' ? (drag.to === drag.from ? groups : assign(groups, [drag.from, drag.to]))
      : resize(groups, drag.index, drag.edge, drag.to);
  const commit = (next) => onChange(formatGroups(next));

  useEffect(() => {
    if (!drag) return undefined;
    const list = listRef.current;
    const move = (e) => {
      const box = list.getBoundingClientRect();
      if (e.clientY < box.top + EDGE) list.scrollBy?.(0, -12);
      else if (e.clientY > box.bottom - EDGE) list.scrollBy?.(0, 12);
      const page = Number(document.elementFromPoint?.(e.clientX, e.clientY)?.closest('[data-page]')?.dataset.page);
      if (page && page !== drag.to) setDrag((d) => ({ ...d, to: page }));
    };
    const up = () => {
      if (draft !== groups) commit(draft);
      setDrag(null);
    };
    const cancel = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  });

  const startNew = (page) => (e) => {
    if (!editable || e.button !== 0 || e.pointerType === 'touch') return; // touch scrolls; use the handles or Ranges
    e.preventDefault();
    setDrag({ mode: 'new', from: page, to: page });
  };
  const startResize = (index, edge, page) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag({ mode: 'resize', index, edge, to: page });
  };

  const groupOf = (page) => draft.findIndex(([s, e]) => page >= s && page <= e);
  const unassigned = pages.some((p) => groupOf(p) === -1);
  const hint = read === null ? 'Can’t show those ranges yet'
    : everyPage ? 'Every page becomes its own file'
      : 'Drag pages to group them · Drag edges to resize';

  return (
    <div className="page-editor">
      <div className="page-bar">
        <span className="mono-label">{hint}</span>
        <span className="page-bar-end">
          <span className="mono-label">{draft.length} file{draft.length === 1 ? '' : 's'}</span>
          {editable && (
            <>
              <button type="button" className="tab" onClick={() => commit(addRest(groups, count))} disabled={!unassigned}>Add the rest</button>
              <button type="button" className="tab" onClick={() => onChange('')} disabled={!groups.length}>Clear</button>
            </>
          )}
        </span>
        {editable && groups.length > 0 && (
          <ul className="group-chips" aria-label="Files">
            {groups.map(([s, e], i) => (
              <li key={`${s}-${e}`} className="group-chip" style={{ '--g': groupColor(i) }}>
                <span className="group-swatch" aria-hidden="true" />
                File {i + 1} · {s === e ? s : `${s}–${e}`}
                <button type="button" className="icon-btn" aria-label={`Remove file ${i + 1} (pages ${formatGroups([[s, e]])})`}
                  onClick={() => commit(removeGroup(groups, i))}><X size={12} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ScrollArea ref={listRef} as="ol" className={`pages split${drag ? ' dragging' : ''}`} aria-label={`Pages of ${fileName}`}>
        {pages.map((page) => {
          const g = groupOf(page);
          const [s, e] = g === -1 ? [] : draft[g];
          return (
            <li key={page} className={pageClass(page, g === -1 ? ' out' : ' grouped')} {...focusProps(page)}
              style={g === -1 ? undefined : { '--g': groupColor(g) }} onPointerDown={startNew(page)}>
              <button type="button" className="page-pick" aria-label={`Show page ${page}`}>
                <div className="preview"><PageCanvas doc={doc} page={page} width={THUMB_WIDTH} label={`Page ${page}`} lazy /></div>
                <span className="page-num">{page}{g !== -1 && <span className="page-part"> · File {g + 1}</span>}</span>
              </button>
              {editable && g !== -1 && page === s && (
                <span className="split-handle start" aria-hidden="true" onPointerDown={startResize(g, 'start', page)} />
              )}
              {editable && g !== -1 && page === e && (
                <span className="split-handle end" aria-hidden="true" onPointerDown={startResize(g, 'end', page)} />
              )}
            </li>
          );
        })}
      </ScrollArea>
    </div>
  );
}
