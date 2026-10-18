import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockPdfPreview, makeFile, setupBrowserTestEnv } from '../test-utils.js';
import FileList, { moveItem } from './FileList.jsx';

const mock = vi.hoisted(() => ({ pdfPreview: null }));
vi.mock('../services.js', () => ({ get pdfPreview() { return mock.pdfPreview; } }));

setupBrowserTestEnv();
beforeEach(() => (mock.pdfPreview = createMockPdfPreview(3)));

const items = ['a.pdf', 'b.pdf', 'c.pdf'].map((name, id) => ({ id, file: makeFile(name, 'x'.repeat(2048)) }));
const names = (list) => list.map((i) => i.file.name);

describe('FileList', () => {
  it('shows names and sizes, numbered when reorderable', () => {
    render(<FileList items={items} reorderable onChange={vi.fn()} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText('b.pdf')).toBeInTheDocument();
    expect(within(rows[1]).getByText('2 KB')).toBeInTheDocument();
    expect(within(rows[1]).getByText('02')).toBeInTheDocument();
  });

  it('moves files up and down, with buttons disabled at the ends', async () => {
    const onChange = vi.fn();
    render(<FileList items={items} reorderable onChange={onChange} />);
    expect(screen.getByLabelText('Move a.pdf up')).toBeDisabled();
    expect(screen.getByLabelText('Move c.pdf down')).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Move b.pdf up'));
    expect(names(onChange.mock.lastCall[0])).toEqual(['b.pdf', 'a.pdf', 'c.pdf']);
    await userEvent.click(screen.getByLabelText('Move b.pdf down'));
    expect(names(onChange.mock.lastCall[0])).toEqual(['a.pdf', 'c.pdf', 'b.pdf']);
  });

  it('removes a file', async () => {
    const onChange = vi.fn();
    render(<FileList items={items} reorderable={false} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Remove a.pdf'));
    expect(names(onChange.mock.lastCall[0])).toEqual(['b.pdf', 'c.pdf']);
  });

  it('hides reorder controls for single-file tools', () => {
    render(<FileList items={items.slice(0, 1)} reorderable={false} onChange={vi.fn()} />);
    expect(screen.queryByLabelText(/Move/)).not.toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveAttribute('draggable', 'false');
  });

  it('reorders by drag and drop', () => {
    const onChange = vi.fn();
    render(<FileList items={items} reorderable onChange={onChange} />);
    const [first, , third] = screen.getAllByRole('listitem');
    fireEvent.dragStart(first, { dataTransfer: {} });
    expect(first).toHaveClass('dragging');
    fireEvent.dragOver(third);
    fireEvent.drop(third);
    expect(names(onChange.mock.lastCall[0])).toEqual(['b.pdf', 'c.pdf', 'a.pdf']);
    fireEvent.dragEnd(first);
  });

  it('ignores drops that did not start in the list', () => {
    const onChange = vi.fn();
    render(<FileList items={items} reorderable onChange={onChange} />);
    fireEvent.dragOver(screen.getAllByRole('listitem')[0]);
    fireEvent.drop(screen.getAllByRole('listitem')[0]);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('FileList grid view', () => {
  const renderGrid = (props = {}) => render(<FileList items={items} reorderable onChange={vi.fn()} view="grid" {...props} />);

  it('shows a preview card per file with its name, size and page counter', async () => {
    renderGrid();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(await screen.findAllByText('1 / 3')).toHaveLength(3);
    expect(screen.getByText('a.pdf')).toBeInTheDocument();
    expect(screen.getAllByText('2 KB')).toHaveLength(3);
    await waitFor(() => expect(mock.pdfPreview.doc.render).toHaveBeenCalledWith(1, expect.any(HTMLCanvasElement), expect.any(Number)));
  });

  it('flips pages with previous/next, disabled at the ends', async () => {
    renderGrid({ items: items.slice(0, 1) });
    await screen.findByText('1 / 3');
    const prev = screen.getByLabelText('Previous page of a.pdf');
    const next = screen.getByLabelText('Next page of a.pdf');
    expect(prev).toBeDisabled();
    await userEvent.click(next);
    await userEvent.click(next);
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(next).toBeDisabled();
    expect(mock.pdfPreview.doc.render).toHaveBeenLastCalledWith(3, expect.any(HTMLCanvasElement), expect.any(Number));
    await userEvent.click(prev);
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('moves cards left and right', async () => {
    const onChange = vi.fn();
    renderGrid({ onChange });
    expect(screen.getByLabelText('Move a.pdf left')).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Move a.pdf right'));
    expect(names(onChange.mock.lastCall[0])).toEqual(['b.pdf', 'a.pdf', 'c.pdf']);
  });

  it('says when a PDF is password-protected or unreadable', async () => {
    mock.pdfPreview.open
      .mockRejectedValueOnce(Object.assign(new Error('pw'), { name: 'PasswordException' }))
      .mockRejectedValueOnce(new Error('bad'));
    renderGrid({ items: items.slice(0, 2) });
    expect(await screen.findByText('Locked')).toBeInTheDocument();
    expect(await screen.findByText('No preview')).toBeInTheDocument();
  });

  it('frees the preview when a card goes away', async () => {
    const { unmount } = renderGrid({ items: items.slice(0, 1) });
    await screen.findByText('1 / 3');
    unmount();
    expect(mock.pdfPreview.doc.close).toHaveBeenCalled();
  });

  it('shows images as themselves, without a pager', () => {
    renderGrid({ items: [{ id: 9, file: makeFile('photo.png', 'x', 'image/png') }], reorderable: true });
    expect(document.querySelector('.preview img')).toHaveAttribute('src', 'blob:test/1');
    expect(screen.queryByLabelText(/page of/)).not.toBeInTheDocument();
    expect(mock.pdfPreview.open).not.toHaveBeenCalled();
  });
});

describe('moveItem', () => {
  it('returns a new array with the item moved', () => {
    const list = [1, 2, 3];
    expect(moveItem(list, 0, 2)).toEqual([2, 3, 1]);
    expect(list).toEqual([1, 2, 3]);
  });
});
