import { TOOL_CATALOG } from '../../catalog.js';

export default function Footer() {
  return (
    <footer className="statusbar">
      <div className="column">
        <span>Processed locally · Nothing is uploaded</span>
        <span className="statusbar-meta">{TOOL_CATALOG.length} tools · pdf-lib · qpdf wasm</span>
      </div>
    </footer>
  );
}
