import { UserError } from '../errors.js';
import { inspectPdf } from '../pdf.js';
import { QPDF_INPUT, QPDF_OUTPUT } from '../qpdf.js';

/** @type {import('./index.js').ToolHandler} */
export default async function protect({ files: [file], options, name, deps }) {
  if (options.password !== options.confirm) throw new UserError('Passwords do not match.');
  if ((await inspectPdf(file)).encrypted) {
    throw new UserError(`${file.name} is already password-protected. Unlock it first to change the password.`);
  }
  // Same user and owner password; AES-256.
  const args = ['--encrypt', options.password, options.password, '256', '--', QPDF_INPUT, QPDF_OUTPUT];
  return { outputs: [{ name, bytes: await deps.qpdf(args, file.bytes) }] };
}
