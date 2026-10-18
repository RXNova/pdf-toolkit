import { Download, FileArchive } from 'lucide-react';
import { formatBytes, mimeFor } from '../files.js';
import { useObjectUrl } from '../hooks/useObjectUrl.js';

/**
 * A real <a download> link, so the browser treats the click as a user-initiated download.
 * `label` is the visible text; the accessible name always includes the file name.
 */
export default function DownloadLink({ file, label, primary = false, showSize = true }) {
  const isZip = file.name.endsWith('.zip');
  const url = useObjectUrl(file.bytes, mimeFor(file.name));
  if (!url) return null;
  const Icon = isZip ? FileArchive : Download;
  const accessibleName = !label || label === 'Download' || label === file.name ? `Download ${file.name}` : `${label} ${file.name}`;
  return (
    <a className={`btn download${primary ? ' primary' : ' outline'}`} href={url} download={file.name}
      aria-label={accessibleName}>
      <Icon size={16} aria-hidden="true" />
      <span className="label">{label ?? `Download ${file.name}`}</span>
      {showSize && <span className="size">{formatBytes(file.bytes.length)}</span>}
    </a>
  );
}
