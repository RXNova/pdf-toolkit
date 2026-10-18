import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

/** A tool client double; override `run` per test. */
export const createMockToolClient = () => ({
  run: vi.fn(async () => ({ ok: true, outputs: [{ name: 'out.pdf', bytes: new Uint8Array([1]) }] })),
  terminate: vi.fn(),
});

/** A pdf.js preview double: every PDF opens with `pageCount` pages; render calls are recorded. */
export const createMockPdfPreview = (pageCount = 3) => {
  const doc = {
    pageCount,
    render: vi.fn(async () => {}),
    close: vi.fn(),
    info: vi.fn(async () => ({ title: '', author: '', subject: '', keywords: '' })),
  };
  return { doc, open: vi.fn(async () => doc), rasterize: { info: vi.fn(), pages: vi.fn() } };
};

/** A browser File with the given name and contents. */
export const makeFile = (name, contents = 'x', type = 'application/pdf') => new File([contents], name, { type });

/** A drag event payload that looks like files dragged from the OS. */
export const fileDrag = (files) => ({ dataTransfer: { types: ['Files'], files } });

/**
 * jsdom has no blob: URLs. Call at the top of a test file to get deterministic ones
 * (blob:test/1, blob:test/2, …) and RTL cleanup between tests.
 */
export function setupBrowserTestEnv() {
  beforeEach(() => {
    let n = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test/${++n}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
}
