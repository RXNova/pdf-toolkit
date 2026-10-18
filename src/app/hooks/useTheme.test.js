import { afterEach, expect, it } from 'vitest';
import { applyTheme, THEMES } from './useTheme.js';

afterEach(() => document.documentElement.removeAttribute('data-theme'));

it('lists the three choices', () => {
  expect(THEMES).toEqual(['system', 'dark', 'light']);
});

it('sets data-theme for explicit themes and removes it for system', () => {
  applyTheme('dark');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  applyTheme('system');
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
});
