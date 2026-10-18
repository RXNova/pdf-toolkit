import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupBrowserTestEnv } from '../test-utils.js';
import SplitPages from './SplitPages.jsx';

setupBrowserTestEnv();

const doc = (pageCount) => ({ pageCount, render: vi.fn(async () => {}), close: vi.fn() });

function setup({ initial = '', pageCount = 8, everyPage = false } = {}) {
  let spec = initial;
  function Harness() {
    const [value, setValue] = useState(initial);
    spec = value;
    return <SplitPages doc={doc(pageCount)} fileName="doc.pdf" value={value} onChange={setValue} everyPage={everyPage} />;
  }
  render(<Harness />);
  return { spec: () => spec };
}

// jsdom has no layout: point elementFromPoint at whichever page a test is "over".
let over = null;
beforeEach(() => {
  document.elementFromPoint = () => over;
});
afterEach(() => {
  delete document.elementFromPoint;
  over = null;
});
const page = (n) => document.querySelector(`[data-page="${n}"]`);
const moveTo = (n) => {
  over = page(n);
  fireEvent.pointerMove(window, { clientX: 1, clientY: 1 });
};
function dragPages(from, to) {
  fireEvent.pointerDown(page(from), { button: 0, pointerType: 'mouse' });
  moveTo(to);
  fireEvent.pointerUp(window);
}
const labels = () => [...document.querySelectorAll('.page-num')].map((n) => n.textContent);

describe('SplitPages', () => {
  it('makes a file from the pages dragged across', () => {
    const { spec } = setup();
    dragPages(2, 4);
    expect(spec()).toBe('2-4');
    expect(labels().slice(0, 5)).toEqual(['1', '2 · File 1', '3 · File 1', '4 · File 1', '5']);
    expect(page(2)).toHaveClass('grouped');
    expect(page(1)).toHaveClass('out');
  });

  it('works dragging backwards, and a press without moving makes nothing', () => {
    const { spec } = setup();
    dragPages(6, 3);
    expect(spec()).toBe('3-6');
    dragPages(1, 1);
    expect(spec()).toBe('3-6');
  });

  it('shows the group while dragging, before letting go', () => {
    const { spec } = setup();
    fireEvent.pointerDown(page(1), { button: 0, pointerType: 'mouse' });
    moveTo(3);
    expect(page(3)).toHaveClass('grouped');
    expect(spec()).toBe('');
    fireEvent.pointerCancel(window);
    expect(page(3)).toHaveClass('out');
  });

  it('cuts a new group out of the ones it overlaps, each with its own colour', () => {
    const { spec } = setup({ initial: '1-8' });
    dragPages(3, 4);
    expect(spec()).toBe('1-2, 3-4, 5-8');
    const colors = [1, 3, 5].map((n) => page(n).style.getPropertyValue('--g'));
    expect(new Set(colors).size).toBe(3);
  });

  it('resizes a group by dragging its edge handles', () => {
    const { spec } = setup({ initial: '2-3, 6-7' });
    fireEvent.pointerDown(page(3).querySelector('.split-handle.end'), { button: 0 });
    moveTo(5);
    fireEvent.pointerUp(window);
    expect(spec()).toBe('2-5, 6-7');
    fireEvent.pointerDown(page(6).querySelector('.split-handle.start'), { button: 0 });
    moveTo(4);
    fireEvent.pointerUp(window);
    expect(spec()).toBe('2-3, 4-7');
  });

  it('lists the files as chips that can be removed, and adds the rest or clears', async () => {
    const { spec } = setup({ initial: '2-3, 6' });
    const chips = screen.getByRole('list', { name: 'Files' });
    expect(within(chips).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['File 1 · 2–3', 'File 2 · 6']);
    await userEvent.click(screen.getByRole('button', { name: 'Remove file 1 (pages 2-3)' }));
    expect(spec()).toBe('6');
    await userEvent.click(screen.getByRole('button', { name: 'Add the rest' }));
    expect(spec()).toBe('1-5, 6, 7-8');
    expect(screen.getByRole('button', { name: 'Add the rest' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(spec()).toBe('');
  });

  it('leaves touch presses to scrolling', () => {
    const { spec } = setup();
    fireEvent.pointerDown(page(2), { button: 0, pointerType: 'touch' });
    moveTo(4);
    fireEvent.pointerUp(window);
    expect(spec()).toBe('');
  });

  it('only shows the files in every-page mode', () => {
    setup({ everyPage: true, pageCount: 3 });
    expect(labels()).toEqual(['1 · File 1', '2 · File 2', '3 · File 3']);
    expect(screen.getByText('Every page becomes its own file')).toBeInTheDocument();
    expect(document.querySelector('.split-handle')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    dragPages(1, 2);
    expect(screen.getByText('3 files')).toBeInTheDocument();
  });

  it('says when the typed ranges do not fit yet', () => {
    setup({ initial: '20' });
    expect(screen.getByText('Can’t show those ranges yet')).toBeInTheDocument();
  });
});
