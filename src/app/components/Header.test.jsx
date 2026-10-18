import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { TOOL_CATALOG } from '../../catalog.js';
import { setupBrowserTestEnv } from '../test-utils.js';
import Footer from './Footer.jsx';
import Header from './Header.jsx';

setupBrowserTestEnv();
afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

it('goes home from the wordmark and the Tools tab', async () => {
  const onHome = vi.fn();
  render(<Header onHome={onHome} view="grid" onViewChange={vi.fn()} showViewToggle />);
  await userEvent.click(screen.getByRole('button', { name: 'PDF Toolkit home' }));
  await userEvent.click(screen.getByRole('button', { name: 'Tools' }));
  expect(onHome).toHaveBeenCalledTimes(2);
});

it('switches between grid and list layouts', async () => {
  const onViewChange = vi.fn();
  render(<Header onHome={vi.fn()} view="grid" onViewChange={onViewChange} showViewToggle />);
  expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'List' }));
  expect(onViewChange).toHaveBeenCalledWith('list');
});

it('hides the layout toggle on tool pages', () => {
  render(<Header onHome={vi.fn()} view="grid" onViewChange={vi.fn()} showViewToggle={false} />);
  expect(screen.queryByRole('group', { name: 'Layout' })).not.toBeInTheDocument();
});

it('renders the status bar', () => {
  render(<Footer />);
  expect(screen.getByRole('contentinfo')).toHaveTextContent('Nothing is uploaded');
  expect(screen.getByRole('contentinfo')).toHaveTextContent(`${TOOL_CATALOG.length} tools`);
});

it('offers Auto / Dark / Light themes, like craft-launcher, defaulting to the system', async () => {
  render(<Header onHome={vi.fn()} view="grid" onViewChange={vi.fn()} showViewToggle />);
  expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
  expect(document.documentElement).not.toHaveAttribute('data-theme');
  await userEvent.click(screen.getByRole('button', { name: 'Light' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  expect(localStorage.getItem('pdf-toolkit:theme')).toBe('light');
  await userEvent.click(screen.getByRole('button', { name: 'Auto' }));
  expect(document.documentElement).not.toHaveAttribute('data-theme');
});
