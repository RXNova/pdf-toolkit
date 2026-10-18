import { useEffect } from 'react';
import { useStoredState } from './useStoredState.js';

export const THEMES = ['system', 'dark', 'light'];

/** Reflect the preference on <html data-theme>; 'system' defers to prefers-color-scheme. */
export function applyTheme(theme, root = document.documentElement) {
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

/** System / dark / light, as in craft-launcher's settings. Persisted per browser. */
export function useTheme() {
  const [theme, setTheme] = useStoredState('pdf-toolkit:theme', 'system', THEMES);
  useEffect(() => applyTheme(theme), [theme]);
  return { theme, setTheme };
}
