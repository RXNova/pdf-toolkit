import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { getToolDef } from '../../catalog.js';
import { createMockPdfPreview, makeFile, setupBrowserTestEnv } from '../test-utils.js';
import { usePrefillMetadata } from './usePrefillMetadata.js';

const mock = vi.hoisted(() => ({ pdfPreview: null }));
vi.mock('../services.js', () => ({ get pdfPreview() { return mock.pdfPreview; } }));

setupBrowserTestEnv();
beforeEach(() => (mock.pdfPreview = createMockPdfPreview()));

it('fills the options from the document properties, then closes the file', async () => {
  mock.pdfPreview.doc.info.mockResolvedValue({ title: 'Q3', author: 'Asha', subject: '', keywords: 'x' });
  const setOptions = vi.fn();
  renderHook(() => usePrefillMetadata(getToolDef('metadata'), makeFile('a.pdf'), setOptions));
  await waitFor(() => expect(setOptions).toHaveBeenCalled());
  expect(setOptions.mock.calls[0][0]({ action: 'edit', title: '' })).toEqual({ action: 'edit', title: 'Q3', author: 'Asha', subject: '', keywords: 'x' });
  expect(mock.pdfPreview.doc.close).toHaveBeenCalled();
});

it('does nothing for other tools, without a file, or when the file can’t be read', async () => {
  const setOptions = vi.fn();
  renderHook(() => usePrefillMetadata(getToolDef('rotate'), makeFile('a.pdf'), setOptions));
  renderHook(() => usePrefillMetadata(getToolDef('metadata'), undefined, setOptions));
  mock.pdfPreview.open.mockRejectedValueOnce(new Error('locked'));
  renderHook(() => usePrefillMetadata(getToolDef('metadata'), makeFile('b.pdf'), setOptions));
  await new Promise((r) => setTimeout(r, 20));
  expect(setOptions).not.toHaveBeenCalled();
});
