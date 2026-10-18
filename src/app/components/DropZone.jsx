import { Plus, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { acceptAttribute } from '../files.js';

const isFileDrag = (e) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

export function dropLabel(tool) {
  if (tool.accept === 'image') return 'Drop JPG or PNG images here';
  return tool.multi ? 'Drop PDFs here' : 'Drop a PDF here';
}

/** Makes any element accept files dragged from the OS. List-reorder drags are left alone. */
export function useFileDrop(onFiles) {
  const [over, setOver] = useState(false);
  const onDrag = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setOver(true);
  };
  return {
    over,
    dropProps: {
      'data-testid': 'dropzone',
      onDragEnter: onDrag,
      onDragOver: onDrag,
      onDragLeave: () => setOver(false),
      onDrop: (e) => {
        setOver(false);
        if (!isFileDrag(e)) return;
        e.preventDefault();
        onFiles(Array.from(e.dataTransfer.files));
      },
    },
  };
}

/** The "Choose files" button and its hidden file input. */
export function FilePicker({ tool, onFiles, primary = false, adding = false }) {
  const input = useRef(null);
  const label = adding ? (tool.multi ? 'Add files' : 'Replace file') : tool.multi ? 'Choose files' : 'Choose file';
  return (
    <>
      <button className={`btn${primary ? ' primary' : ' outline'}`} type="button" onClick={() => input.current.click()}>
        {adding && tool.multi && <Plus size={14} aria-hidden="true" />}{label}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        data-testid="file-input"
        accept={acceptAttribute(tool.accept)}
        multiple={tool.multi}
        onChange={(e) => {
          onFiles(Array.from(e.target.files));
          e.target.value = ''; // allow choosing the same file again
        }}
      />
    </>
  );
}

/** The large drop target shown before any file is added. */
export default function DropZone({ tool, onFiles }) {
  const { over, dropProps } = useFileDrop(onFiles);
  return (
    <div className={`drop${over ? ' over' : ''}`} {...dropProps}>
      <span className="drop-icon"><Upload size={22} aria-hidden="true" /></span>
      <p className="drop-main">{dropLabel(tool)}</p>
      <p className="drop-sub">Files stay on this device</p>
      <FilePicker tool={tool} onFiles={onFiles} primary />
    </div>
  );
}
