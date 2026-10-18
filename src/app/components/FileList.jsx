import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react';
import { useState } from 'react';
import { extname } from '../../core/names.js';
import { formatBytes } from '../files.js';
import FilePreview from './FilePreview.jsx';
import ScrollArea from './ScrollArea.jsx';

/** Move an item within a list, returning a new list. */
export function moveItem(list, from, to) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * The selected files, as rows ('list') or preview cards ('grid'). Both reorder by drag or buttons.
 * Clicking or tabbing into a file selects it for the side preview.
 * @param {{ items: { id: number, file: File }[], reorderable: boolean, onChange: (items) => void, view?: 'list' | 'grid',
 *   selectedId?: number, onSelect?: (id: number) => void }} props
 */
export default function FileList({ items, reorderable, onChange, view = 'list', selectedId, onSelect }) {
  const [dragIndex, setDragIndex] = useState(null);
  const grid = view === 'grid';
  // Grid cards move with arrows, so they don't look like the page pager's chevrons.
  const [Back, Forward, back, forward] = grid ? [ArrowLeft, ArrowRight, 'left', 'right'] : [ChevronUp, ChevronDown, 'up', 'down'];

  return (
    <ScrollArea as="ul" className={`files${grid ? ' grid-view' : ''}`} aria-label="Selected files">
      {items.map(({ id, file }, i) => {
        const num = reorderable && <span className="num">{String(i + 1).padStart(2, '0')}</span>;
        const meta = (
          <span className="meta">
            <span className="fname" title={file.name}>{file.name}</span>
            <span className="fsize">{formatBytes(file.size)}</span>
          </span>
        );
        const move = reorderable && (
          <>
            <button className="icon-btn" aria-label={`Move ${file.name} ${back}`} disabled={i === 0}
              onClick={() => onChange(moveItem(items, i, i - 1))}><Back size={16} aria-hidden="true" /></button>
            <button className="icon-btn" aria-label={`Move ${file.name} ${forward}`} disabled={i === items.length - 1}
              onClick={() => onChange(moveItem(items, i, i + 1))}><Forward size={16} aria-hidden="true" /></button>
          </>
        );
        const remove = (
          <button className="icon-btn danger" aria-label={`Remove ${file.name}`}
            onClick={() => onChange(items.filter((_, j) => j !== i))}><X size={16} aria-hidden="true" /></button>
        );
        return (
          <li
            key={id}
            className={`file${dragIndex === i ? ' dragging' : ''}${onSelect && id === selectedId ? ' selected' : ''}`}
            draggable={reorderable}
            onClick={() => onSelect?.(id)}
            onFocus={() => onSelect?.(id)}
            onDragStart={(e) => {
              setDragIndex(i);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => setDragIndex(null)}
            onDragOver={(e) => dragIndex !== null && e.preventDefault()}
            onDrop={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              e.stopPropagation();
              onChange(moveItem(items, dragIndex, i));
              setDragIndex(null);
            }}
          >
            {grid ? (
              <>
                <div className="file-top">
                  {reorderable && <GripVertical className="handle" size={14} aria-hidden="true" />}
                  {num}
                  <span className="file-actions">{move}{remove}</span>
                </div>
                <FilePreview file={file} />
                {meta}
              </>
            ) : (
              <>
                {reorderable && <GripVertical className="handle" size={16} aria-hidden="true" />}
                {num}
                <span className="doc" aria-hidden="true">{(extname(file.name) || 'file').toUpperCase().slice(0, 4)}</span>
                {meta}
                {move}
                {remove}
              </>
            )}
          </li>
        );
      })}
    </ScrollArea>
  );
}
