import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { usePageFocus } from './usePageFocus.js';

function list(pageTop) {
  const el = document.createElement('ol');
  el.getBoundingClientRect = () => ({ top: 0, bottom: 400 });
  const li = document.createElement('li');
  li.dataset.page = '7';
  li.getBoundingClientRect = () => ({ top: pageTop, bottom: pageTop + 100 });
  li.scrollIntoView = vi.fn();
  el.append(li);
  return { el, li };
}

it('scrolls the focused page into view only when it is hidden', () => {
  const { result, rerender } = renderHook(({ page }) => usePageFocus(page, vi.fn()), { initialProps: { page: 1 } });
  const hidden = list(600);
  result.current.listRef.current = hidden.el;
  rerender({ page: 7 });
  expect(hidden.li.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });

  const shown = list(100);
  result.current.listRef.current = shown.el;
  rerender({ page: 1 });
  rerender({ page: 7 });
  expect(shown.li.scrollIntoView).not.toHaveBeenCalled();
});

it('gives pages focus handlers and marks the focused one', () => {
  const onFocusPage = vi.fn();
  const { result } = renderHook(() => usePageFocus(2, onFocusPage));
  const props = result.current.focusProps(5);
  props.onClick();
  props.onFocus();
  expect(onFocusPage).toHaveBeenCalledTimes(2);
  expect(result.current.pageClass(2, ' on')).toBe('page on focused');
  expect(result.current.pageClass(3)).toBe('page');
});
