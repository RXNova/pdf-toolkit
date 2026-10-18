// File-name helpers. Inputs are browser File names, so there are no directories to handle.

/** "Report.Final.PDF" → "pdf". A leading dot (".hidden") is part of the name, not an extension. */
export function extname(name) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** "report.pdf" → "report" */
export function stem(name) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/** "report.pdf" + "rotated" → "report_rotated.pdf" */
export const outputName = (inputName, suffix, ext = 'pdf') => `${stem(inputName)}_${suffix}.${ext}`;
