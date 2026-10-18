import { useEffect, useRef } from 'react';

/**
 * The page shown in the side preview, as seen from a page grid: clicking or focusing a page
 * shows it there, and when the preview's pager moves, the grid highlights and reveals that page.
 * Pages need `{...focusProps(page)}` and `className={pageClass(page, …)}`; the list needs `ref={listRef}`.
 */
export function usePageFocus(focusPage, onFocusPage) {
  const listRef = useRef(null);
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector(`[data-page="${focusPage}"]`);
    if (!el?.scrollIntoView) return;
    const box = list.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const clear = 40; // the edge fades cover this much
    if (r.top < box.top + clear || r.bottom > box.bottom - clear) el.scrollIntoView({ block: 'center' });
  }, [focusPage]);

  return {
    listRef,
    focusProps: (page) => ({
      'data-page': page,
      onClick: () => onFocusPage?.(page),
      onFocus: () => onFocusPage?.(page),
    }),
    pageClass: (page, extra = '') => `page${extra}${onFocusPage && page === focusPage ? ' focused' : ''}`,
  };
}
