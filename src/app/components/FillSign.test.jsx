import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pdfBytes } from '../../../tests/helpers/fixtures.js';
import { setupBrowserTestEnv } from '../test-utils.js';
import { fillSignOverlay, FillSignPanel, parseItems, textAspect } from './FillSign.jsx';

setupBrowserTestEnv();

// Images "load" immediately with a 2:1 shape.
beforeEach(() => {
  vi.stubGlobal('Image', class {
    set src(_) { Object.assign(this, { naturalWidth: 200, naturalHeight: 100 }); queueMicrotask(() => this.onload?.()); }
  });
});
afterEach(() => vi.unstubAllGlobals());

async function setup({ page = 2, initial = [] } = {}) {
  const file = new File([await pdfBytes({ pages: 3 })], 'doc.pdf', { type: 'application/pdf' });
  const state = { items: initial, selected: null, shown: null, hasForm: null };
  function Harness() {
    const [items, setItems] = useState(initial);
    const [selected, setSelected] = useState(null);
    Object.assign(state, { items, selected });
    return (
      <FillSignPanel file={file} items={items} onItems={setItems} values="{}" onValues={() => {}}
        onHasForm={(v) => (state.hasForm = v)} page={page} selected={selected} onSelect={setSelected}
        onShowPage={(p) => (state.shown = p)} />
    );
  }
  render(<Harness />);
  return state;
}

describe('FillSignPanel', () => {
  it('adds text and a date to the page being viewed, and edits the selected text', async () => {
    const state = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Text' }));
    expect(state.items).toEqual([expect.objectContaining({ kind: 'text', text: 'Your text', page: 2, color: '#111827' })]);
    const field = screen.getByRole('textbox', { name: 'Text' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Approved');
    await userEvent.click(screen.getByRole('radio', { name: 'Blue' }));
    expect(state.items[0]).toEqual(expect.objectContaining({ text: 'Approved', color: '#1d3fbf' }));
    await userEvent.click(screen.getByRole('button', { name: 'Date' }));
    expect(state.items[1].text).toMatch(/\d{4}$/);
    expect(state.selected).toBe(state.items[1].id);
  });

  it('adds an image with its aspect ratio', async () => {
    const state = await setup();
    await userEvent.upload(screen.getByTestId('image-input'), new File(['png'], 'logo.png', { type: 'image/png' }));
    await waitFor(() => expect(state.items).toHaveLength(1));
    expect(state.items[0]).toEqual(expect.objectContaining({ kind: 'image', label: 'logo.png', aspect: 0.5, page: 2 }));
    expect(state.items[0].src).toMatch(/^data:image\/png;base64,/);
  });

  it('lists items: select (and show their page), repeat on every page, remove', async () => {
    const text = { id: 'a', kind: 'text', text: 'Hi', color: '#111827', page: 3, x: 0.1, y: 0.1, w: 0.2, allPages: false };
    const state = await setup({ initial: [text] });
    const list = screen.getByRole('list');
    await userEvent.click(within(list).getByRole('button', { name: /^“Hi”/ }));
    expect(state.selected).toBe('a');
    expect(state.shown).toBe(3);
    await userEvent.click(screen.getByRole('button', { name: 'Repeat “Hi” on every page' }));
    expect(state.items[0].allPages).toBe(true);
    expect(within(list).getByText('All pages')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove “Hi”' }));
    expect(state.items).toEqual([]);
    expect(state.selected).toBeNull();
  });

  it('reports that a PDF without fields has no form, and keeps quiet about it', async () => {
    const state = await setup();
    await waitFor(() => expect(state.hasForm).toBe(false));
    expect(screen.queryByText('This PDF has no fillable fields.')).not.toBeInTheDocument();
  });

  it('opens the signature pad, with Place disabled until there is a signature', async () => {
    await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Signature' }));
    expect(screen.getByRole('button', { name: 'Place on page 2' })).toBeDisabled();
  });
});

describe('fillSignOverlay', () => {
  const items = [
    { id: 'a', kind: 'text', text: 'Hi', color: '#111827', page: 1, x: 0.1, y: 0.1, w: 0.2, aspect: 0.5 },
    { id: 'b', kind: 'image', src: 'data:image/png;base64,AA', label: 'Signature', page: 2, x: 0.5, y: 0.5, w: 0.3, aspect: 0.5 },
    { id: 'c', kind: 'image', src: 'data:image/png;base64,AA', label: 'Logo', page: 3, allPages: true, x: 0, y: 0, w: 0.1, aspect: 1 },
  ];
  const frame = { width: 400, height: 600 };

  it('shows the items on the viewed page (and repeated ones), and moves or deletes them', () => {
    const onItems = vi.fn();
    const onSelect = vi.fn();
    const overlay = fillSignOverlay({ items, page: 1, selected: 'a', onSelect, onItems });
    render(<div>{overlay(frame)}</div>);
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label').split(':')[0])).toEqual(['Text “Hi”', 'Logo']);
    const text = screen.getByRole('group', { name: /Text “Hi”/ });
    expect(text).toHaveClass('selected');
    fireEvent.keyDown(text, { key: 'ArrowRight' });
    expect(onItems.mock.lastCall[0][0]).toEqual(expect.objectContaining({ x: 0.11 }));
    fireEvent.keyDown(text, { key: 'Delete' });
    expect(onItems.mock.lastCall[0].map((i) => i.id)).toEqual(['b', 'c']);
  });

  it('is null when nothing is on the page', () => {
    expect(fillSignOverlay({ items: items.slice(0, 2), page: 3, onItems: vi.fn(), onSelect: vi.fn() })).toBeNull();
  });
});

it('parseItems and textAspect', () => {
  expect(parseItems('[{"id":1}]')).toEqual([{ id: 1 }]);
  expect(parseItems('{')).toEqual([]);
  expect(parseItems('{}')).toEqual([]);
  expect(textAspect('abcd')).toBeGreaterThan(0);
});
