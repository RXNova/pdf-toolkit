import { describe, expect, it, vi } from 'vitest';
import { UserError } from '../core/errors.js';
import { createMessageHandler } from './protocol.js';

const toolkitReturning = (impl) => ({ run: vi.fn(impl) });

describe('createMessageHandler', () => {
  it('returns results with their buffers listed for transfer', async () => {
    const a = new Uint8Array([1]);
    const b = new Uint8Array([2]);
    const result = { outputs: [{ name: 'a.pdf', bytes: a }, { name: 'b.pdf', bytes: b }], summary: 's' };
    const toolkit = toolkitReturning(async () => result);
    const request = { toolId: 'split' };
    const { message, transfer } = await createMessageHandler(toolkit)({ id: 7, request });
    expect(toolkit.run).toHaveBeenCalledWith(request);
    expect(message).toEqual({ id: 7, ok: true, result });
    expect(transfer).toEqual([a.buffer, b.buffer]);
  });

  it('lists a shared buffer only once', async () => {
    const buffer = new ArrayBuffer(4);
    const outputs = [{ name: 'a', bytes: new Uint8Array(buffer, 0, 2) }, { name: 'b', bytes: new Uint8Array(buffer, 2, 2) }];
    const { transfer } = await createMessageHandler(toolkitReturning(async () => ({ outputs })))({ id: 1, request: {} });
    expect(transfer).toEqual([buffer]);
  });

  it('returns UserError messages verbatim without logging', async () => {
    const logger = { error: vi.fn() };
    const handle = createMessageHandler(toolkitReturning(async () => { throw new UserError('Wrong password.'); }), logger);
    expect(await handle({ id: 2, request: { toolId: 'unlock' } })).toEqual({ message: { id: 2, ok: false, error: 'Wrong password.' }, transfer: [] });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs and labels unexpected errors', async () => {
    const logger = { error: vi.fn() };
    const bug = new TypeError('x is undefined');
    const handle = createMessageHandler(toolkitReturning(async () => { throw bug; }), logger);
    const { message } = await handle({ id: 3, request: { toolId: 'merge' } });
    expect(message).toEqual({ id: 3, ok: false, error: 'Unexpected error: x is undefined' });
    expect(logger.error).toHaveBeenCalledWith('[merge]', bug);
  });

  it('copes with non-Error throws and missing requests, logging to console by default', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { message } = await createMessageHandler(toolkitReturning(async () => { throw 'boom'; }))({ id: 4 });
    expect(message.error).toBe('Unexpected error: boom');
    expect(spy).toHaveBeenCalledWith('[undefined]', 'boom');
    spy.mockRestore();
  });
});
