// Maps catalog icon names to Lucide components. The catalog stays plain data (it's also
// loaded by the worker, which has no React); icons.test.jsx keeps the two in sync.
import {
  ArrowUpDown, Crop, FileOutput, Files, Hash, Image, ImageDown, Lock, LockOpen, Minimize2, PanelTop,
  RotateCw, Scissors, Signature, Stamp, Tags, Trash2,
} from 'lucide-react';

export const TOOL_ICONS = Object.freeze({
  files: Files,
  scissors: Scissors,
  'file-output': FileOutput,
  trash: Trash2,
  'arrow-up-down': ArrowUpDown,
  rotate: RotateCw,
  minimize: Minimize2,
  image: Image,
  stamp: Stamp,
  hash: Hash,
  lock: Lock,
  'lock-open': LockOpen,
  crop: Crop,
  'image-down': ImageDown,
  'panel-top': PanelTop,
  signature: Signature,
  tags: Tags,
});

/** Decorative tool icon; the tool's title next to it carries the meaning for screen readers. */
export function ToolIcon({ name, size = 22 }) {
  const Icon = TOOL_ICONS[name];
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" />;
}
