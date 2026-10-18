import { useCallback, useState } from 'react';

/** useState persisted to localStorage. Storage can be unavailable (private mode), so failures fall back silently. */
export function useStoredState(key, initial, allowed) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved !== null && (!allowed || allowed.includes(saved)) ? saved : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (next) => {
      setValue(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // not persisted; still applies for this visit
      }
    },
    [key],
  );
  return [value, set];
}
