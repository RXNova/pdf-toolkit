import { UserError } from '../errors.js';
import { inspectPdf } from '../pdf.js';
import { QPDF_INPUT, QPDF_OUTPUT, QpdfError } from '../qpdf.js';

/** @type {import('./index.js').ToolHandler} */
export default async function unlock({ files: [file], options, name, deps }) {
  if (!(await inspectPdf(file)).encrypted) {
    return { outputs: [{ name, bytes: file.bytes }], note: `${file.name} isn’t password-protected, so it was left as is.` };
  }
  try {
    const bytes = await deps.qpdf([`--password=${options.password}`, '--decrypt', QPDF_INPUT, QPDF_OUTPUT], file.bytes);
    return { outputs: [{ name, bytes }] };
  } catch (err) {
    // The file is a valid encrypted PDF (checked above), so a qpdf failure means the password was rejected.
    if (err instanceof QpdfError) throw new UserError('Wrong password.', { cause: err });
    throw err;
  }
}
