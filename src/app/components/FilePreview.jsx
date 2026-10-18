import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { extname } from '../../core/names.js';
import { useObjectUrl } from '../hooks/useObjectUrl.js';
import { usePdfDoc } from '../hooks/usePdfDoc.js';
import PageCanvas from './PageCanvas.jsx';
import PageGrid from './PageGrid.jsx';
import { OverlayFrame } from './PlacementBox.jsx';

const CARD_WIDTH = 140; // CSS px drawn per preview; canvases scale by devicePixelRatio
const VIEWER_WIDTH = 900;
const SIDE_WIDTH = 320;

/** A page-flippable preview card of a PDF, or the image itself for JPG/PNG. */
export default function FilePreview({ file }) {
  return extname(file.name) === 'pdf' ? <PagedPreview file={file} width={CARD_WIDTH} className="preview" /> : <ImagePreview file={file} />;
}

/** One big page with a pager, filling the space it is given. `badge` labels what is shown (e.g. "Live preview"). */
export function PdfViewer({ file, page, onPageChange, badge, overlay }) {
  return (
    <PagedPreview file={file} width={VIEWER_WIDTH} className="preview viewer" page={page} onPageChange={onPageChange}
      badge={badge} overlay={overlay} />
  );
}

/**
 * The preview under the options: the file or page picked in the files pane, larger.
 * `page`/`onPageChange` make it follow (and drive) the page picked in a page grid.
 */
export function SidePreview({ file, page, onPageChange }) {
  return (
    <section className="side-preview" aria-label="Preview">
      <div className="side-preview-top">
        <span className="mono-label">Preview</span>
        <span className="side-preview-name" title={file.name}>{file.name}</span>
      </div>
      {extname(file.name) === 'pdf'
        ? <PagedPreview file={file} width={SIDE_WIDTH} className="preview side" page={page} onPageChange={onPageChange} />
        : <ImagePreview file={file} className="preview side" />}
    </section>
  );
}

/** Every page of a PDF as a numbered grid; see PageGrid for the editing modes. */
export function PdfPages({ file, ...props }) {
  const { doc, failure } = usePdfDoc(file);
  if (!doc) return <div className="preview viewer"><span className="preview-note">{failure ?? 'Loading'}</span></div>;
  return <PageGrid doc={doc} fileName={file.name} {...props} />;
}

function ImagePreview({ file, className = 'preview' }) {
  const url = useObjectUrl(file, file.type);
  return <div className={className}>{url && <img src={url} alt="" />}</div>;
}

/** A page with a pager. Uncontrolled by default; pass `page` and `onPageChange` to control it. */
function PagedPreview({ file, width, className, page: controlled, onPageChange, badge, overlay }) {
  const box = useRef(null);
  const { doc, failure } = usePdfDoc(file);
  const [own, setOwn] = useState(1);
  const count = doc?.pageCount ?? 0;
  const page = Math.min(controlled ?? own, count || Infinity);
  const setPage = onPageChange ?? setOwn;
  return (
    <>
      <div className={className} ref={box}>
        {badge && <span className="preview-badge" role="status">{badge}</span>}
        {overlay && doc && <OverlayFrame previewRef={box}>{overlay}</OverlayFrame>}
        {doc ? <PageCanvas doc={doc} page={page} width={width} label={`Page ${page} of ${file.name}`} />
          : <span className="preview-note">{failure ?? 'Loading'}</span>}
      </div>
      <div className="pager">
        <button type="button" className="icon-btn" aria-label={`Previous page of ${file.name}`} disabled={page <= 1}
          onClick={() => setPage(page - 1)}><ChevronLeft size={16} aria-hidden="true" /></button>
        <span className="pager-count">{count ? `${page} / ${count}` : '– / –'}</span>
        <button type="button" className="icon-btn" aria-label={`Next page of ${file.name}`} disabled={page >= count}
          onClick={() => setPage(page + 1)}><ChevronRight size={16} aria-hidden="true" /></button>
      </div>
    </>
  );
}
