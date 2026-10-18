import { act, renderHook } from '@testing-library/react';
import { unzipSync } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getToolDef } from '../../catalog.js';
import { createMockToolClient, makeFile, setupBrowserTestEnv } from '../test-utils.js';
import { successMessage, useToolRunner } from './useToolRunner.js';

const mock = vi.hoisted(() => ({ toolClient: null }));
vi.mock('../services.js', () => ({ get toolClient() { return mock.toolClient; }, clientFor: () => mock.toolClient }));

setupBrowserTestEnv();

beforeEach(() => (mock.toolClient = createMockToolClient()));

const render = (id) => renderHook(() => useToolRunner(getToolDef(id)));

describe('useToolRunner', () => {
  it('reads the files and sends them to the worker with the options', async () => {
    const { result } = render('rotate');
    await act(() => result.current.run([makeFile('a.pdf', 'AB')], { angle: '90' }));
    expect(mock.toolClient.run).toHaveBeenCalledWith({
      toolId: 'rotate', files: [{ name: 'a.pdf', bytes: new Uint8Array([65, 66]) }], options: { angle: '90' },
    });
    expect(result.current.status).toEqual({ kind: 'ok', message: 'Your file is ready.', detail: '', outputs: [{ name: 'out.pdf', bytes: new Uint8Array([1]) }], zip: null });
  });

  it('bundles multiple outputs into a zip named after the first input', async () => {
    const outputs = [{ name: 'r_p1.pdf', bytes: new Uint8Array([1]) }, { name: 'r_p2.pdf', bytes: new Uint8Array([2]) }];
    mock.toolClient.run.mockResolvedValue({ ok: true, outputs });
    const { result } = render('split');
    await act(() => result.current.run([makeFile('report.pdf')], {}));
    const { status } = result.current;
    expect(status.message).toBe('Created 2 files.');
    expect(status.zip.name).toBe('report_split.zip');
    expect(Object.keys(unzipSync(status.zip.bytes))).toEqual(['r_p1.pdf', 'r_p2.pdf']);
  });

  it('is busy while the worker runs', async () => {
    let finish;
    mock.toolClient.run.mockReturnValue(new Promise((r) => (finish = r)));
    const { result } = render('rotate');
    let pending;
    await act(async () => {
      pending = result.current.run([makeFile('a.pdf')], {});
    });
    expect(result.current.status.kind).toBe('busy');
    await act(async () => {
      finish({ ok: false, error: 'nope' });
      await pending;
    });
    expect(result.current.status).toEqual({ kind: 'error', message: 'nope' });
  });

  it('reports worker crashes as unexpected errors', async () => {
    mock.toolClient.run.mockRejectedValue(new Error('The PDF worker crashed.'));
    const { result } = render('rotate');
    await act(() => result.current.run([makeFile('a.pdf')], {}));
    expect(result.current.status).toEqual({ kind: 'error', message: 'Unexpected error: The PDF worker crashed.' });
  });

  it('exposes showError and clear', () => {
    const { result } = render('rotate');
    act(() => result.current.showError('bad'));
    expect(result.current.status).toEqual({ kind: 'error', message: 'bad' });
    act(() => result.current.clear());
    expect(result.current.status).toEqual({ kind: 'idle' });
  });
});

describe('successMessage', () => {
  it('describes single and multiple outputs with summary and note', () => {
    expect(successMessage({ outputs: [{}] })).toEqual({ message: 'Your file is ready.', detail: '' });
    expect(successMessage({ outputs: [{}, {}], summary: '10 KB → 5 KB', note: 'FYI.' }))
      .toEqual({ message: 'Created 2 files.', detail: '10 KB → 5 KB FYI.' });
  });
});
