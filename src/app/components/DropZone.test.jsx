import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { getToolDef } from '../../catalog.js';
import { fileDrag, makeFile, setupBrowserTestEnv } from '../test-utils.js';
import DropZone, { dropLabel, FilePicker } from './DropZone.jsx';

setupBrowserTestEnv();

const setup = (toolId = 'merge') => {
  const onFiles = vi.fn();
  render(<DropZone tool={getToolDef(toolId)} onFiles={onFiles} />);
  return { onFiles, zone: screen.getByTestId('dropzone'), input: screen.getByTestId('file-input') };
};

describe('DropZone', () => {
  it('passes dropped files to onFiles', () => {
    const { zone, onFiles } = setup();
    const files = [makeFile('a.pdf'), makeFile('b.pdf')];
    fireEvent.drop(zone, fileDrag(files));
    expect(onFiles).toHaveBeenCalledWith(files);
  });

  it('highlights while files are dragged over', () => {
    const { zone } = setup();
    fireEvent.dragEnter(zone, fileDrag([]));
    expect(zone).toHaveClass('over');
    fireEvent.dragLeave(zone);
    expect(zone).not.toHaveClass('over');
  });

  it('ignores drags that are not files (e.g. list reordering)', () => {
    const { zone, onFiles } = setup();
    const notFiles = { dataTransfer: { types: ['text/plain'], files: [] } };
    fireEvent.dragOver(zone, notFiles);
    expect(zone).not.toHaveClass('over');
    fireEvent.drop(zone, notFiles);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('configures the hidden picker for the tool', () => {
    const { input } = setup('images');
    expect(input).toHaveAttribute('accept', '.jpg,.jpeg,.png,image/jpeg,image/png');
    expect(input).toHaveAttribute('multiple');
  });

  it('opens the picker from the button and passes chosen files on', async () => {
    const { input, onFiles } = setup('rotate');
    expect(input).not.toHaveAttribute('multiple');
    const click = vi.spyOn(input, 'click');
    await userEvent.click(screen.getByRole('button', { name: 'Choose file' }));
    expect(click).toHaveBeenCalled();

    const file = makeFile('a.pdf');
    await userEvent.upload(input, file);
    expect(onFiles).toHaveBeenCalledWith([file]);
    expect(input.value).toBe('');
  });

  it('labels the picker for adding to or replacing what is already there', () => {
    const { rerender } = render(<FilePicker tool={getToolDef('merge')} onFiles={vi.fn()} adding />);
    expect(screen.getByRole('button', { name: 'Add files' })).toHaveClass('outline');
    rerender(<FilePicker tool={getToolDef('rotate')} onFiles={vi.fn()} adding />);
    expect(screen.getByRole('button', { name: 'Replace file' })).toBeInTheDocument();
  });
});

describe('dropLabel', () => {
  it.each([['merge', 'Drop PDFs here'], ['rotate', 'Drop a PDF here'], ['images', 'Drop JPG or PNG images here']])(
    '%s → %s', (id, label) => expect(dropLabel(getToolDef(id))).toBe(label),
  );
});
