import { renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useObjectUrl } from './useObjectUrl.js';
import { setupBrowserTestEnv } from '../test-utils.js';

setupBrowserTestEnv();

it('creates a blob URL with the right type and revokes it on change and unmount', () => {
  const first = new Uint8Array([1]);
  const { result, rerender, unmount } = renderHook(({ bytes }) => useObjectUrl(bytes, 'application/zip'), { initialProps: { bytes: first } });
  expect(result.current).toBe('blob:test/1');
  const blob = URL.createObjectURL.mock.calls[0][0];
  expect(blob.type).toBe('application/zip');

  rerender({ bytes: new Uint8Array([2]) });
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test/1');
  expect(result.current).toBe('blob:test/2');

  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test/2');
});

it('returns null without bytes and defaults to PDF', () => {
  expect(renderHook(() => useObjectUrl(null)).result.current).toBeNull();
  const bytes = new Uint8Array([1]); // must be stable across renders, as in real callers
  renderHook(() => useObjectUrl(bytes));
  expect(URL.createObjectURL.mock.calls[0][0].type).toBe('application/pdf');
});
