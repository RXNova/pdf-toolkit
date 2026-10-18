import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { setupBrowserTestEnv } from '../test-utils.js';
import { useStoredState } from './useStoredState.js';

setupBrowserTestEnv();
afterEach(() => localStorage.clear());

it('starts from the saved value when it is allowed, else the initial value', () => {
  localStorage.setItem('k', 'list');
  expect(renderHook(() => useStoredState('k', 'grid', ['grid', 'list'])).result.current[0]).toBe('list');
  localStorage.setItem('k', 'bogus');
  expect(renderHook(() => useStoredState('k', 'grid', ['grid', 'list'])).result.current[0]).toBe('grid');
  expect(renderHook(() => useStoredState('other', 'x')).result.current[0]).toBe('x');
});

it('persists changes', () => {
  const { result } = renderHook(() => useStoredState('k', 'grid'));
  act(() => result.current[1]('list'));
  expect(result.current[0]).toBe('list');
  expect(localStorage.getItem('k')).toBe('list');
});

it('works when storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
  const { result } = renderHook(() => useStoredState('k', 'grid'));
  expect(result.current[0]).toBe('grid');
  act(() => result.current[1]('list'));
  expect(result.current[0]).toBe('list');
});
