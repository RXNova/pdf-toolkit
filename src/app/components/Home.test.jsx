import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { getToolDef, TOOL_CATALOG } from '../../catalog.js';
import { setupBrowserTestEnv } from '../test-utils.js';
import Home, { matchesQuery } from './Home.jsx';

setupBrowserTestEnv();

const renderHome = (view = 'grid', onOpen = vi.fn()) => {
  render(<Home tools={TOOL_CATALOG} onOpen={onOpen} view={view} />);
  return { onOpen };
};
const openButtons = () => screen.queryAllByRole('button', { name: /^Open / }).map((b) => b.getAttribute('aria-label').slice(5));

describe('Home', () => {
  it('shows every tool straight away as numbered cells, in catalog order', () => {
    renderHome();
    expect(openButtons()).toEqual(TOOL_CATALOG.map((t) => t.title));
    const first = screen.getAllByRole('article')[0];
    expect(within(first).getByText('01')).toHaveClass('badge');
    expect(within(first).getByRole('heading', { name: 'Merge PDF' })).toBeInTheDocument();
    expect(within(first).getByText('PDF ×N → PDF')).toBeInTheDocument();
    expect(within(first).getByText('Multi-file · Local')).toHaveClass('tag');
  });

  it('opens a tool from its OPEN button', async () => {
    const { onOpen } = renderHome();
    await userEvent.click(screen.getByRole('button', { name: 'Open Split PDF' }));
    expect(onOpen).toHaveBeenCalledWith(getToolDef('split'));
  });

  it('filters by category, with counts on each tab', async () => {
    renderHome();
    const inSecurity = TOOL_CATALOG.filter((t) => t.category === 'security').map((t) => t.title);
    const security = screen.getByRole('button', { name: `Security ${inSecurity.length}` });
    expect(screen.getByRole('button', { name: `All ${TOOL_CATALOG.length}` })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(security);
    expect(security).toHaveAttribute('aria-pressed', 'true');
    expect(openButtons()).toEqual(inSecurity);
    expect(openButtons()).toContain('Protect PDF');
  });

  it('searches within the selected category and shows an empty state', async () => {
    renderHome();
    const search = screen.getByRole('searchbox', { name: 'Search tools' });
    const titles = (pred) => TOOL_CATALOG.filter(pred).map((t) => t.title);
    const edit = titles((t) => t.category === 'edit');
    await userEvent.type(search, 'pages');
    expect(openButtons()).toEqual(titles((t) => matchesQuery(t, 'pages')));
    expect(openButtons()).toEqual(expect.arrayContaining(['Extract pages', 'Remove pages', 'Organize pages']));
    await userEvent.click(screen.getByRole('button', { name: `Edit ${edit.length}` }));
    expect(openButtons()).toEqual(titles((t) => t.category === 'edit' && matchesQuery(t, 'pages')));
    expect(openButtons()).not.toContain('Extract pages');
    await userEvent.clear(search);
    await userEvent.type(search, 'zzz');
    expect(screen.getByRole('status')).toHaveTextContent('No tools match “zzz”');
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(openButtons()).toHaveLength(edit.length);
    await userEvent.type(search, 'rot{Escape}');
    expect(search).toHaveValue('');
  });

  it('renders a compact table in list view', () => {
    renderHome('list');
    const rows = within(screen.getByRole('list', { name: 'Tools' })).getAllByRole('listitem');
    expect(rows).toHaveLength(TOOL_CATALOG.length);
    const images = TOOL_CATALOG.findIndex((t) => t.id === 'images');
    expect(within(rows[images]).getByText('JPG/PNG ×N → PDF')).toBeInTheDocument();
  });
});

describe('matchesQuery', () => {
  it('matches title and description, case-insensitively and trimmed', () => {
    const tool = getToolDef('compress');
    expect(matchesQuery(tool, '  COMPRESS ')).toBe(true);
    expect(matchesQuery(tool, 'scans')).toBe(true);
    expect(matchesQuery(tool, 'rotate')).toBe(false);
  });
});
