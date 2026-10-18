import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useInstallPrompt } from './useInstallPrompt.js';

const offer = () => {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = vi.fn(async () => {});
  act(() => window.dispatchEvent(event));
  return event;
};

it('is null until the browser offers installing, then shows its prompt once', async () => {
  const { result } = renderHook(() => useInstallPrompt());
  expect(result.current).toBeNull();
  const event = offer();
  expect(event.defaultPrevented).toBe(true);
  await act(() => result.current());
  expect(event.prompt).toHaveBeenCalled();
  expect(result.current).toBeNull();
});

it('goes away once the app is installed', () => {
  const { result } = renderHook(() => useInstallPrompt());
  offer();
  expect(result.current).toBeInstanceOf(Function);
  act(() => window.dispatchEvent(new Event('appinstalled')));
  expect(result.current).toBeNull();
});
