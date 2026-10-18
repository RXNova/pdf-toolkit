import { describe, expect, it, vi } from 'vitest';
import { createToolClient } from './client.js';
import { setupBrowserTestEnv } from './test-utils.js';

setupBrowserTestEnv();

class FakeWorker {
  static instances = [];
  constructor() {
    this.posted = [];
    this.terminate = vi.fn();
    FakeWorker.instances.push(this);
  }
  postMessage(message, transfer) {
    this.posted.push({ message, transfer });
  }
  reply(data) {
    this.onmessage({ data });
  }
}

const setup = () => {
  FakeWorker.instances = [];
  const client = createToolClient(() => new FakeWorker());
  return { client, workers: FakeWorker.instances };
};
const request = (n = 1) => ({ toolId: 'merge', files: Array.from({ length: n }, (_, i) => ({ name: `${i}.pdf`, bytes: new Uint8Array([i]) })), options: {} });

describe('createToolClient', () => {
  it('starts the worker lazily, once', async () => {
    const { client, workers } = setup();
    expect(workers).toHaveLength(0);
    client.run(request());
    client.run(request());
    expect(workers).toHaveLength(1);
  });

  it('posts requests with input buffers transferred and resolves matching responses', async () => {
    const { client, workers } = setup();
    const req = request(2);
    const promise = client.run(req);
    const [{ message, transfer }] = workers[0].posted;
    expect(message).toEqual({ id: 1, request: req });
    expect(transfer).toEqual(req.files.map((f) => f.bytes.buffer));

    workers[0].reply({ id: 1, ok: true, result: { outputs: [], summary: 's' } });
    await expect(promise).resolves.toEqual({ ok: true, outputs: [], summary: 's' });
  });

  it('resolves tool errors as { ok: false }', async () => {
    const { client, workers } = setup();
    const promise = client.run(request());
    workers[0].reply({ id: 1, ok: false, error: 'Wrong password.' });
    await expect(promise).resolves.toEqual({ ok: false, error: 'Wrong password.' });
  });

  it('matches out-of-order responses and ignores unknown ids', async () => {
    const { client, workers } = setup();
    const first = client.run(request());
    const second = client.run(request());
    workers[0].reply({ id: 99, ok: true, result: {} });
    workers[0].reply({ id: 2, ok: true, result: { n: 2 } });
    workers[0].reply({ id: 1, ok: true, result: { n: 1 } });
    await expect(first).resolves.toEqual({ ok: true, n: 1 });
    await expect(second).resolves.toEqual({ ok: true, n: 2 });
  });

  it('rejects pending requests when the worker crashes, then starts a new worker', async () => {
    const { client, workers } = setup();
    const pending = client.run(request());
    const event = { message: 'Out of memory', preventDefault: vi.fn() };
    workers[0].onerror(event);
    await expect(pending).rejects.toThrow('Out of memory');
    expect(event.preventDefault).toHaveBeenCalled();
    expect(workers[0].terminate).toHaveBeenCalled();

    client.run(request());
    expect(workers).toHaveLength(2);
  });

  it('uses a generic message when the crash has none', async () => {
    const { client, workers } = setup();
    const pending = client.run(request());
    workers[0].onerror({});
    await expect(pending).rejects.toThrow('The PDF worker crashed.');
  });

  it('terminates the worker on request', () => {
    const { client, workers } = setup();
    client.terminate();
    client.run(request());
    client.terminate();
    expect(workers[0].terminate).toHaveBeenCalled();
  });

  it('defaults to a module Worker for the PDF worker script', () => {
    const Worker = vi.fn();
    vi.stubGlobal('Worker', Worker);
    createToolClient().run(request()).catch(() => {});
    expect(Worker).toHaveBeenCalledWith(expect.any(URL), { type: 'module' });
    expect(String(Worker.mock.calls[0][0])).toMatch(/\/worker\/pdf\.worker\.js/);
    vi.unstubAllGlobals();
  });
});
