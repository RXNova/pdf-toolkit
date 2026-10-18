import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPdfPreview, makeFile, setupBrowserTestEnv } from '../test-utils.js';
import { usePdfDoc } from './usePdfDoc.js';

const mock = vi.hoisted(() => ({ pdfPreview: null }));
vi.mock('../services.js', () => ({ get pdfPreview() { return mock.pdfPreview; } }));

setupBrowserTestEnv();
beforeEach(() => (mock.pdfPreview = createMockPdfPreview()));

describe('usePdfDoc', () => {
  it('opens the file and closes it on unmount', async () => {
    const file = makeFile('a.pdf');
    const { result, unmount } = renderHook(() => usePdfDoc(file));
    expect(result.current).toEqual({ doc: null, failure: null });
    await waitFor(() => expect(result.current.doc).toBe(mock.pdfPreview.doc));
    unmount();
    expect(mock.pdfPreview.doc.close).toHaveBeenCalled();
  });

  it('closes a document that finishes opening after unmount', async () => {
    let finish;
    mock.pdfPreview.open.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const { unmount } = renderHook(() => usePdfDoc(makeFile('a.pdf')));
    unmount();
    finish(mock.pdfPreview.doc);
    await waitFor(() => expect(mock.pdfPreview.doc.close).toHaveBeenCalled());
  });

  it('keeps the previous document until the new file is open, then closes it', async () => {
    const first = mock.pdfPreview.doc;
    const { result, rerender } = renderHook(({ file }) => usePdfDoc(file), { initialProps: { file: makeFile('a.pdf') } });
    await waitFor(() => expect(result.current.doc).toBe(first));
    const second = { pageCount: 1, render: vi.fn(), close: vi.fn() };
    let finish;
    mock.pdfPreview.open.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    rerender({ file: makeFile('b.pdf') });
    expect(result.current.doc).toBe(first);
    expect(first.close).not.toHaveBeenCalled();
    finish(second);
    await waitFor(() => expect(result.current.doc).toBe(second));
    expect(first.close).toHaveBeenCalled();
  });
});
