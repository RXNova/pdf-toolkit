import { ArrowLeft, Info } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { ACCEPT, defaultFormValues, isOptionVisible } from '../../catalog.js';
import { isAccepted } from '../files.js';
import { useLivePreview } from '../hooks/useLivePreview.js';
import { usePrefillMetadata } from '../hooks/usePrefillMetadata.js';
import { useStoredState } from '../hooks/useStoredState.js';
import { useToolRunner } from '../hooks/useToolRunner.js';
import { ToolIcon } from '../icons.jsx';
import { ioLabel, splitTitle, toolNumber, toolStyle } from '../tool-meta.js';
import Cells from './Cells.jsx';
import DropZone, { FilePicker, useFileDrop } from './DropZone.jsx';
import ToolSwitch, { fromFiles } from './ContinueWith.jsx';
import FileList from './FileList.jsx';
import { FillSignPanel, fillSignOverlay, parseItems } from './FillSign.jsx';
import { PdfPages, PdfViewer, SidePreview } from './FilePreview.jsx';
import OptionsForm from './OptionsForm.jsx';
import ScrollArea from './ScrollArea.jsx';
import Status from './Status.jsx';

/**
 * One tool's page. `initialFiles` preloads files (e.g. the output of the previous tool);
 * `onContinue(tool, files)` opens another tool with this run's output.
 */
export default function ToolView({ tool, onBack, initialFiles = [], onContinue }) {
  // { id, file }: ids keep list keys stable across reorders
  const [items, setItems] = useState(() => (tool.multi ? initialFiles : initialFiles.slice(0, 1)).map((file, id) => ({ id, file })));
  const nextId = useRef(initialFiles.length);
  const [options, setOptions] = useState(() => defaultFormValues(tool));
  const { status, run, showError, clear } = useToolRunner(tool);
  // What the side preview shows: a file (multi-file tools) and a page in it.
  const [focus, setFocus] = useState({ id: null, page: 1 });
  const [filesView, setFilesView] = useStoredState('pdf-toolkit:files-view', 'grid', ['grid', 'list']);
  const [head, tail] = splitTitle(tool.title);

  function addFiles(files) {
    const accepted = files.filter((f) => isAccepted(tool.accept, f));
    if (accepted.length < files.length) {
      showError(`Skipped files that aren’t ${ACCEPT[tool.accept].join('/').toUpperCase()}.`);
    } else clear();
    if (!accepted.length) return;
    const added = accepted.map((file) => ({ id: nextId.current++, file }));
    setItems((prev) => (tool.multi ? [...prev, ...added] : [added[0]]));
    if (!tool.multi) setFocus({ id: null, page: 1 }); // a replaced file starts at page 1
  }

  const hasFiles = items.length > 0;
  const busy = status.kind === 'busy';
  // Required fields still empty: Run waits for them and says what is missing.
  const missing = tool.options.find((o) => o.required && isOptionVisible(o, options) && !String(options[o.key] ?? '').trim());
  // Fill & sign: the items placed on pages, and whether anything has been added or filled yet.
  const placed = tool.fillSign ? parseItems(options.items) : [];
  const [selected, setSelected] = useState(null);
  const nothingYet = tool.fillSign && !placed.length && (options.values ?? '{}') === '{}';
  const canRun = items.length >= tool.minFiles && !busy && !missing && !nothingYet;
  const [shown, setShown] = useState('result');
  const submit = () => {
    if (!canRun) return;
    setShown('result');
    run(items.map((i) => i.file), options);
  };

  // Viewer tools preview their result once it's ready, with a switch back to the original.
  const output = status.kind === 'ok' && !status.zip && tool.preview === 'viewer' ? status.outputs[0] : null;
  const resultFile = useMemo(() => output && new File([output.bytes], output.name, { type: 'application/pdf' }), [output]);
  // Live-preview tools show the real output as options change; others show it after Run.
  // Fill & sign previews the filled form only; placed items are shown as draggable boxes instead.
  const liveFile = tool.preview === 'viewer' && !nothingYet && !(tool.fillSign && options.values === '{}') ? items[0]?.file : null;
  const live = useLivePreview(tool, liveFile, tool.fillSign ? { ...options, items: '[]' } : options);
  const after = tool.livePreview ? live.file : resultFile;
  const viewing = after && shown === 'result' ? after : items[0]?.file;
  const liveBadge = !tool.livePreview || viewing !== after ? null
    : live.pending ? 'Updating…' : live.error ? 'Out of date' : 'Live preview';
  const focused = items.find((i) => i.id === focus.id) ?? items[0];

  const setPlaced = (next) => setOption('items', JSON.stringify(next));
  const overlay = tool.fillSign && viewing !== resultFile
    ? fillSignOverlay({ items: placed, page: focus.page, selected, onSelect: setSelected, onItems: setPlaced })
    : null;

  usePrefillMetadata(tool, items[0]?.file, setOptions);
  const selectFile = (id) => setFocus((f) => (f.id === id ? f : { id, page: 1 }));
  const showPage = (page) => setFocus((f) => ({ ...f, page }));
  const pageKey = tool.options.find((o) => o.type === 'ranges')?.key; // the page spec the page grid reads or writes
  const setOption = (key, value) => setOptions((o) => ({ ...o, [key]: value }));
  // Once files are in, the whole files pane takes drops; the picker moves up beside the title.
  const { over, dropProps } = useFileDrop(addFiles);
  const startOver = () => {
    setItems([]);
    clear();
  };

  return (
    <section className="tool-page column" aria-labelledby="tool-title" style={toolStyle(tool)}>
      <div className="panelgrid">
        <div className={`pane work${over ? ' over' : ''}`} {...(hasFiles ? dropProps : {})}>
          <div className="pane-top">
            <nav className="crumbs" aria-label="Back">
              <button type="button" className="tab" onClick={onBack}>
                <ArrowLeft size={14} aria-hidden="true" /> All tools
              </button>
            </nav>
            <span className="badge">{toolNumber(tool)}</span>
            <span className="pane-top-end">
              {hasFiles && tool.preview === 'files' ? (
                <Cells label="File view" options={[['grid', 'Grid'], ['list', 'List']]} value={filesView} onChange={setFilesView} />
              ) : after ? (
                <Cells label="Preview" options={[['original', 'Original'], ['result', tool.livePreview ? 'Preview' : 'Result']]}
                  value={shown} onChange={setShown} />
              ) : (
                <span className="mono-label">{ioLabel(tool)}</span>
              )}
            </span>
          </div>
          <div className="pane-body">
            <div className="cell-id tool-head">
              <span className="app-icon"><ToolIcon name={tool.icon} size={30} /></span>
              <div>
                <h2 className="app-name" id="tool-title">{head && <>{head} </>}<span className="accent">{tail}</span></h2>
                <p className="app-desc">{tool.desc}</p>
              </div>
              {hasFiles && (
                <span className="tool-head-end">
                  {onContinue && <ToolSwitch tool={tool} sources={fromFiles(items.map((i) => i.file))} onPick={onContinue} variant="menu" label="Switch tool" />}
                  <span title="Or drop files anywhere here"><FilePicker tool={tool} onFiles={addFiles} adding /></span>
                </span>
              )}
            </div>
            {!hasFiles && <DropZone tool={tool} onFiles={addFiles} />}
            <FileList items={items} reorderable={tool.multi} onChange={setItems} view={tool.preview === 'files' ? filesView : 'list'}
              selectedId={tool.preview === 'files' ? focused?.id : undefined} onSelect={tool.preview === 'files' ? selectFile : undefined} />
            {hasFiles && tool.preview === 'pages' && (
              <PdfPages key={items[0].id} file={items[0].file} edit={tool.pageEdit}
                value={tool.pageEdit && options[pageKey]} onChange={(v) => setOption(pageKey, v)}
                optional={!tool.options.find((o) => o.key === pageKey)?.required}
                everyPage={options.mode === 'every'} focusPage={focus.page} onFocusPage={showPage} />
            )}
            {hasFiles && tool.preview === 'viewer' && (
              <PdfViewer key={items[0].id} file={viewing} page={focus.page} onPageChange={showPage} badge={liveBadge} overlay={overlay} />
            )}
            {hasFiles && live.error && <p className="hint"><Info size={14} aria-hidden="true" />Preview paused: {live.error}</p>}
            {tool.minFiles > 1 && items.length > 0 && items.length < tool.minFiles && (
              <p className="hint"><Info size={14} aria-hidden="true" />Add at least {tool.minFiles} files.</p>
            )}
          </div>
        </div>

        <aside className="pane panel" aria-label="Options">
          <div className="pane-top">
            <span className="mono-label">Options</span>
          </div>
          <ScrollArea className="pane-body">
            {tool.fillSign && hasFiles && (
              <FillSignPanel file={items[0].file} items={placed} onItems={setPlaced} values={options.values}
                onValues={(v) => setOption('values', v)} onHasForm={(yes) => setOption('hasForm', yes ? 'yes' : 'no')}
                page={focus.page} selected={selected} onSelect={setSelected} onShowPage={showPage} />
            )}
            <OptionsForm
              tool={tool}
              values={options}
              onChange={setOption}
              onSubmit={submit}
            />
            <button className="btn primary block lg" disabled={!canRun} onClick={submit}>
              {busy ? 'Working…' : tool.title}
            </button>
            {hasFiles && missing && <p className="run-hint">{missingHint(tool, missing)}</p>}
            {hasFiles && nothingYet && <p className="run-hint">Add a signature, text, a date or an image, or fill in the form.</p>}
            {tool.hint && <p className="run-hint">{tool.hint}</p>}
            <Status status={status} onStartOver={startOver} tool={tool} onContinue={onContinue} />
            {focused && tool.preview !== 'viewer' && (
              <SidePreview key={focused.id} file={focused.file} page={focus.page} onPageChange={showPage} />
            )}
          </ScrollArea>
        </aside>
      </div>
    </section>
  );
}

/** What to do before Run is available. Page tools point at the page grid too. */
export function missingHint(tool, option) {
  if (tool.pageEdit === 'keep') return 'Click the pages to keep, or type them above.';
  if (tool.pageEdit === 'remove') return 'Click the pages to remove, or type them above.';
  if (tool.pageEdit === 'split') return 'Drag across pages to make files, or type ranges above.';
  return `Fill in ${option.label.replace(/\s*\(.*\)$/, '').toLowerCase()} first.`;
}
