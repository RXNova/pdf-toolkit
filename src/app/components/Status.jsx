import { CircleAlert, CircleCheck, RotateCcw } from 'lucide-react';
import { extname } from '../../core/names.js';
import { formatBytes } from '../files.js';
import ToolSwitch, { fromOutputs } from './ContinueWith.jsx';
import DownloadLink from './DownloadLink.jsx';

function OutputFile({ file }) {
  return (
    <div className="output-file">
      <span className="doc" aria-hidden="true">{extname(file.name).toUpperCase()}</span>
      <span className="meta">
        <span className="fname" title={file.name}>{file.name}</span>
        <span className="fsize">{formatBytes(file.bytes.length)}</span>
      </span>
    </div>
  );
}

/**
 * @param {{ status: import('../hooks/useToolRunner.js').RunStatus, onStartOver?: () => void,
 *   tool?: object, onContinue?: (tool: object, files: File[]) => void }} props
 */
export default function Status({ status, onStartOver, tool, onContinue }) {
  if (status.kind === 'idle') return null;
  if (status.kind === 'busy') {
    return (
      <div className="status busy" role="status">
        <span>Working on your device…</span>
        <div className="progress" aria-hidden="true" />
      </div>
    );
  }
  if (status.kind === 'error') {
    return (
      <div className="status error" role="alert">
        <div className="status-line"><CircleAlert size={16} aria-hidden="true" /><span>{status.message}</span></div>
      </div>
    );
  }

  const { outputs, zip } = status;
  return (
    <div className="status ok" role="status">
      <div className="status-line"><CircleCheck size={18} aria-hidden="true" /><span>{status.message}</span></div>
      {status.detail && <p className="status-detail">{status.detail}</p>}
      <div className="actions">
        {zip ? (
          <>
            <OutputFile file={zip} />
            <DownloadLink file={zip} label="Download all" primary showSize={false} />
            <ul className="output-list" aria-label="Output files">
              {outputs.map((o) => (
                <li key={o.name}><DownloadLink file={o} label={o.name} /></li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <OutputFile file={outputs[0]} />
            <DownloadLink file={outputs[0]} label="Download" primary showSize={false} />
          </>
        )}
        {tool && onContinue && <ToolSwitch tool={tool} sources={fromOutputs(outputs)} onPick={onContinue} />}
        {onStartOver && (
          <button type="button" className="btn outline block" onClick={onStartOver}>
            <RotateCcw size={14} aria-hidden="true" /> Start over
          </button>
        )}
      </div>
    </div>
  );
}
