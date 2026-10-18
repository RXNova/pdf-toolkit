import { ArrowUpRight } from 'lucide-react';
import { ToolIcon } from '../icons.jsx';
import { ioLabel, splitTitle, toolNumber, toolStyle, toolTag } from '../tool-meta.js';

function TwoToneTitle({ title }) {
  const [head, tail] = splitTitle(title);
  return <>{head && <>{head} </>}<span className="accent">{tail}</span></>;
}

/** Grid cell: number badge, icon, two-tone name, description, OPEN. The whole cell opens the tool. */
export function ToolCard({ tool, onOpen }) {
  return (
    <article className="cell" style={toolStyle(tool)}>
      <div className="cell-top">
        <span className="badge">{toolNumber(tool)}</span>
        <span className="mono-label">{ioLabel(tool)}</span>
      </div>
      <div className="cell-body">
        <div className="cell-id">
          <span className="app-icon"><ToolIcon name={tool.icon} size={30} /></span>
          <div>
            <h3 className="app-name"><TwoToneTitle title={tool.title} /></h3>
            <p className="app-desc" title={tool.desc}>{tool.desc}</p>
          </div>
        </div>
        <span className="tag">{toolTag(tool)}</span>
        <button type="button" className="btn outline block" onClick={() => onOpen(tool)} aria-label={`Open ${tool.title}`}>
          Open <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

/** Compact table row for the LIST view. */
export function ToolRow({ tool, onOpen }) {
  return (
    <li className="row" style={toolStyle(tool)}>
      <span className="badge">{toolNumber(tool)}</span>
      <span className="app-icon sm"><ToolIcon name={tool.icon} size={18} /></span>
      <span className="row-name"><TwoToneTitle title={tool.title} /></span>
      <span className="row-desc">{tool.desc}</span>
      <span className="mono-label row-io">{ioLabel(tool)}</span>
      <button type="button" className="btn outline" onClick={() => onOpen(tool)} aria-label={`Open ${tool.title}`}>Open</button>
    </li>
  );
}
