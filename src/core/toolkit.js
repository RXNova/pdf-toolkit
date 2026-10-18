import { ACCEPT, getToolDef } from '../catalog.js';
import { UserError } from './errors.js';
import { extname, outputName } from './names.js';
import { parseOptions } from './options.js';
import { HANDLERS } from './tools/index.js';

/**
 * @typedef {object} RunRequest  untrusted: built by the UI and passed through postMessage
 * @property {string} toolId
 * @property {import('./pdf.js').NamedBytes[]} files
 * @property {Record<string, unknown>} [options]
 */

/**
 * The public entry point of the core: validates requests and dispatches to tool handlers.
 * Has no DOM or Node dependencies, so it runs in a Web Worker and under Node tests alike.
 *
 * @param {import('./tools/index.js').ToolDeps} deps
 */
export function createToolkit(deps) {
  return {
    /**
     * @param {RunRequest} request
     * @returns {Promise<import('./tools/index.js').ToolResult>}
     * @throws {UserError} for invalid input; anything else is a bug
     */
    async run(request) {
      const { tool, files } = validateRequest(request);
      const options = parseOptions(tool.options, request.options ?? {});
      const name = outputName(files[0].name, tool.suffix);
      return HANDLERS[tool.id]({ files, options, name, deps });
    },
  };
}

/**
 * Structural validation that doesn't need to parse any file.
 * @param {unknown} request
 */
export function validateRequest(request) {
  if (!request || typeof request !== 'object') throw new TypeError('Request must be an object.');
  const { toolId, files } = /** @type {RunRequest} */ (request);

  const tool = getToolDef(toolId);
  if (!tool || !HANDLERS[toolId]) throw new TypeError(`Unknown tool: ${toolId}`);

  const wellFormed = (f) => f && typeof f.name === 'string' && f.name !== '' && f.bytes instanceof Uint8Array;
  if (!Array.isArray(files) || !files.every(wellFormed)) {
    throw new TypeError('files must be an array of { name, bytes: Uint8Array }.');
  }

  if (files.length === 0) throw new UserError('Add a file first.');
  if (files.length < tool.minFiles) throw new UserError(`Add at least ${tool.minFiles} files.`);
  if (!tool.multi && files.length > 1) throw new UserError(`${tool.title} works on one file at a time.`);

  const allowed = ACCEPT[tool.accept];
  const wrong = files.find((f) => !allowed.includes(extname(f.name)));
  if (wrong) throw new UserError(`${wrong.name} isn’t a supported file. Expected ${allowed.join('/').toUpperCase()}.`);

  const empty = files.find((f) => f.bytes.length === 0);
  if (empty) throw new UserError(`${empty.name} is empty.`);

  return { tool, files };
}
