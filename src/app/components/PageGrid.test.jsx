import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { setupBrowserTestEnv } from '../test-utils.js';
import PageGrid, { readSpec } from './PageGrid.jsx';

setupBrowserTestEnv();

const doc = (pageCount = 6) => ({ pageCount, render: vi.fn(async () => {}), close: vi.fn() });

/** Renders the grid wired to real state, like ToolView's options, and exposes the spec. */
function setup(edit, initial = '', pageCount = 6) {
  let spec = initial;
  function Harness() {
    const [value, setValue] = useState(initial);
    spec = value;
    return <PageGrid doc={doc(pageCount)} fileName="doc.pdf" edit={edit} value={value} onChange={setValue} />;
  }
  render(<Harness />);
  return { spec: () => spec };
}

const pageNums = () => within(screen.getByRole('list', { name: 'Pages of doc.pdf' }))
  .getAllByRole('listitem').map((li) => li.querySelector('.page-num').textContent);

describe('readSpec', () => {
  it('returns 1-based pages, or null when the spec does not fit the document', () => {
    expect(readSpec('3-1, 5', 6)).toEqual([3, 2, 1, 5]);
    expect(readSpec('9', 6)).toBeNull();
    expect(readSpec('1-', 3)).toEqual([1, 2, 3]);
  });
});

describe('PageGrid preview (no editing)', () => {
  it('lists every page with its number and no controls', () => {
    render(<PageGrid doc={doc(3)} fileName="doc.pdf" />);
    expect(pageNums()).toEqual(['1', '2', '3']);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('PageGrid keep / remove', () => {
  it('toggles pages into the spec, sorted and compacted', async () => {
    const { spec } = setup('keep');
    await userEvent.click(screen.getByRole('button', { name: 'Keep page 4' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep page 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep page 2' }));
    expect(spec()).toBe('1-2, 4');
    expect(screen.getByRole('button', { name: 'Keep page 4' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Keep page 4' }));
    expect(spec()).toBe('1-2');
    expect(screen.getByText('2 of 6')).toBeInTheDocument();
  });

  it('shift-click selects (or clears) the run from the last clicked page', async () => {
    const { spec } = setup('remove');
    const user = userEvent.setup();
    const shiftClick = async (name) => {
      await user.keyboard('{Shift>}');
      await user.click(screen.getByRole('button', { name }));
      await user.keyboard('{/Shift}');
    };
    await user.click(screen.getByRole('button', { name: 'Remove page 2' }));
    await shiftClick('Remove page 5');
    expect(spec()).toBe('2-5');
    await shiftClick('Remove page 3'); // 3 is already on, so the run 5→3 turns off
    expect(spec()).toBe('2');
  });

  it('offers no "All" when removing (that would remove every page)', () => {
    setup('remove');
    expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invert' })).toBeInTheDocument();
  });

  it('All, Invert and Clear', async () => {
    const { spec } = setup('keep', '2, 4');
    await userEvent.click(screen.getByRole('button', { name: 'Invert' }));
    expect(spec()).toBe('1, 3, 5-6');
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(spec()).toBe('1-6');
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(spec()).toBe('');
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  it('follows the typed spec, and says when it cannot be shown yet', () => {
    setup('keep', '9');
    expect(screen.getByText('Can’t show that page list yet')).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
  });
});

describe('PageGrid arrange', () => {
  it('starts in document order and writes the new order on change', async () => {
    const { spec } = setup('arrange', '', 4);
    expect(pageNums()).toEqual(['1', '2', '3', '4']);
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Move page 1 right' }));
    expect(spec()).toBe('2, 1, 3-4');
    expect(pageNums()).toEqual(['2', '1', '3', '4']);
  });

  it('copies and drops pages, but never the last one', async () => {
    const { spec } = setup('arrange', '1-2', 4);
    await userEvent.click(screen.getByRole('button', { name: 'Copy page 2' }));
    expect(spec()).toBe('1-2, 2');
    await userEvent.click(screen.getAllByRole('button', { name: 'Drop page 2' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Drop page 2' }));
    expect(spec()).toBe('1');
    expect(screen.getByRole('button', { name: 'Drop page 1' })).toBeDisabled();
  });

  it('reorders by drag and drop, and Reset restores document order', async () => {
    const { spec } = setup('arrange', '', 4);
    const items = screen.getAllByRole('listitem');
    fireEvent.dragStart(items[3], { dataTransfer: {} });
    fireEvent.dragOver(items[0]);
    fireEvent.drop(items[0]);
    expect(spec()).toBe('4, 1-3');
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(spec()).toBe('');
    expect(pageNums()).toEqual(['1', '2', '3', '4']);
  });

  it('ignores drops that did not start on a page', () => {
    const { spec } = setup('arrange', '', 3);
    fireEvent.drop(screen.getAllByRole('listitem')[0]);
    expect(spec()).toBe('');
  });
});
