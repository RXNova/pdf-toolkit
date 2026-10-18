import { UserError } from '../core/errors.js';

/**
 * Worker message protocol.
 *   request:  { id: number, request: RunRequest }
 *   response: { id, ok: true, result: ToolResult } | { id, ok: false, error: string }
 * Output buffers are transferred, not copied, so large PDFs don't double memory use.
 */

/**
 * Turn a toolkit into a message handler. Pure, so it's testable without a real Worker.
 * @param {ReturnType<typeof import('../core/toolkit.js').createToolkit>} toolkit
 * @param {Pick<Console, 'error'>} [logger]
 * @returns {(data: { id: number, request: unknown }) => Promise<{ message: object, transfer: ArrayBuffer[] }>}
 */
export function createMessageHandler(toolkit, logger = console) {
  return async ({ id, request }) => {
    try {
      const result = await toolkit.run(request);
      // A Set because the same buffer can't be listed twice (e.g. compress returning the input).
      const transfer = [...new Set(result.outputs.map((o) => o.bytes.buffer))];
      return { message: { id, ok: true, result }, transfer };
    } catch (err) {
      if (err instanceof UserError) return { message: { id, ok: false, error: err.message }, transfer: [] };
      logger.error(`[${request?.toolId}]`, err);
      return { message: { id, ok: false, error: `Unexpected error: ${err?.message ?? err}` }, transfer: [] };
    }
  };
}
