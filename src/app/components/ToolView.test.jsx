import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getToolDef } from '../../catalog.js';
import { createMockPdfPreview, createMockToolClient, fileDrag, makeFile, setupBrowserTestEnv } from '../test-utils.js';
import ToolView from './ToolView.jsx';

const mock = vi.hoisted(() => ({ toolClient: null, pdfPreview: null }));
vi.mock('../services.js', () => ({
  get toolClient() { return mock.toolClient; },
  clientFor: () => mock.toolClient,
  get pdfPreview() { return mock.pdfPreview; },
}));

setupBrowserTestEnv();
beforeEach(() => (mock.pdfPreview = createMockPdfPreview()));

beforeEach(() => (mock.toolClient = createMockToolClient()));

const renderTool = (id, onBack = vi.fn()) => render(<ToolView tool={getToolDef(id)} onBack={onBack} />);
const runButton = (title) => screen.getByRole('button', { name: title });
const drop = (...names) => fireEvent.drop(screen.getByTestId('dropzone'), fileDrag(names.map((n) => makeFile(n))));
const rowNames = () => screen.queryAllByRole('listitem').map((li) => li.querySelector('.fname').textContent);

describe('ToolView', () => {
  it('goes back to all tools', async () => {
    const onBack = vi.fn();
    renderTool('rotate', onBack);
    await userEvent.click(screen.getByRole('button', { name: /All tools/ }));
    expect(onBack).toHaveBeenCalled();
  });

  it('trades the big drop zone for an "Add files" button and a pane-wide drop target once files are in', () => {
    renderTool('merge');
    expect(screen.getByText('Drop PDFs here')).toBeInTheDocument();
    drop('a.pdf');
    expect(screen.queryByText('Drop PDFs here')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add files' })).toBeInTheDocument();
    const pane = screen.getByTestId('dropzone');
    expect(pane).toHaveClass('pane');
    fireEvent.dragEnter(pane, fileDrag([]));
    expect(pane).toHaveClass('over');
    drop('b.pdf');
    expect(rowNames()).toEqual(['a.pdf', 'b.pdf']);
    expect(pane).not.toHaveClass('over');
  });

  it('shows the tool header and disables Run until files are added', () => {
    renderTool('rotate');
    expect(screen.getByRole('heading', { name: 'Rotate PDF' })).toBeInTheDocument();
    expect(runButton('Rotate PDF')).toBeDisabled();
  });

  it('adds files from the picker', async () => {
    renderTool('images');
    await userEvent.upload(screen.getByTestId('file-input'), [makeFile('a.png', 'x', 'image/png')]);
    expect(rowNames()).toEqual(['a.png']);
  });

  it('replaces the file for single-file tools and appends for multi-file tools', () => {
    const { unmount } = renderTool('rotate');
    drop('a.pdf');
    drop('b.pdf', 'c.pdf');
    expect(rowNames()).toEqual(['b.pdf']);
    unmount();

    renderTool('merge');
    drop('a.pdf');
    drop('b.pdf');
    expect(rowNames()).toEqual(['a.pdf', 'b.pdf']);
  });

  it('allows the same file name twice (stable ids, not names, key the list)', () => {
    renderTool('merge');
    drop('a.pdf', 'a.pdf');
    expect(rowNames()).toEqual(['a.pdf', 'a.pdf']);
  });

  it('skips files of the wrong type and says so', () => {
    renderTool('merge');
    drop('a.pdf', 'b.docx');
    expect(rowNames()).toEqual(['a.pdf']);
    expect(screen.getByRole('alert')).toHaveTextContent('Skipped files that aren’t PDF.');

    drop('c.pdf');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the error but adds nothing when every file is rejected', () => {
    renderTool('merge');
    drop('a.txt');
    expect(rowNames()).toEqual([]);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('requires minFiles before running and hints at it', () => {
    renderTool('merge');
    drop('a.pdf');
    expect(runButton('Merge PDF')).toBeDisabled();
    expect(screen.getByText('Add at least 2 files.')).toBeInTheDocument();
    drop('b.pdf');
    expect(runButton('Merge PDF')).toBeEnabled();
    expect(screen.queryByText('Add at least 2 files.')).not.toBeInTheDocument();
  });

  it('runs with the files in list order and the edited options, then offers the download', async () => {
    renderTool('merge');
    drop('a.pdf', 'b.pdf');
    await userEvent.click(screen.getByLabelText('Move b.pdf left'));
    await userEvent.click(runButton('Merge PDF'));
    const { files } = mock.toolClient.run.mock.calls[0][0];
    expect(files.map((f) => f.name)).toEqual(['b.pdf', 'a.pdf']);
    expect(await screen.findByRole('link', { name: /Download out\.pdf/ })).toBeInTheDocument();
  });

  it('switches the file list between preview cards and rows, and remembers the choice', async () => {
    localStorage.clear();
    renderTool('merge');
    expect(screen.queryByRole('group', { name: 'File view' })).not.toBeInTheDocument();
    drop('a.pdf', 'b.pdf');
    const list = screen.getByRole('list', { name: 'Selected files' });
    expect(await within(list).findAllByText('1 / 3')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByLabelText('Move b.pdf up')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Selected files' })).queryByText('1 / 3')).not.toBeInTheDocument();
    expect(localStorage.getItem('pdf-toolkit:files-view')).toBe('list');
    localStorage.clear();
  });

  it('shows every page, numbered, for page tools', async () => {
    mock.pdfPreview = createMockPdfPreview(4);
    renderTool('split');
    drop('doc.pdf');
    const pages = await screen.findByRole('list', { name: 'Pages of doc.pdf' });
    expect(within(pages).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['1', '2', '3', '4']);
    expect(screen.getByRole('img', { name: 'Page 4' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'File view' })).not.toBeInTheDocument();
  });

  it('keeps the page grid and the page field in step, both ways', async () => {
    mock.pdfPreview = createMockPdfPreview(5);
    renderTool('extract');
    drop('doc.pdf');
    await userEvent.click(await screen.findByRole('button', { name: 'Keep page 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep page 3' }));
    const field = screen.getByLabelText('Pages to keep');
    expect(field).toHaveValue('2-3');
    await userEvent.clear(field);
    await userEvent.type(field, '5');
    expect(screen.getByRole('button', { name: 'Keep page 5' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Keep page 2' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(runButton('Extract pages'));
    expect(mock.toolClient.run).toHaveBeenCalledWith(expect.objectContaining({ options: { ranges: '5' } }));
  });

  it('previews the picked file under the options (multi-file tools)', async () => {
    renderTool('merge');
    drop('a.pdf', 'b.pdf');
    const preview = await screen.findByRole('region', { name: 'Preview' });
    expect(within(preview).getByText('a.pdf')).toBeInTheDocument();
    await userEvent.click(screen.getByText('b.pdf', { selector: '.fname' }));
    expect(within(screen.getByRole('region', { name: 'Preview' })).getByText('b.pdf')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').find((li) => li.classList.contains('selected'))).toHaveTextContent('b.pdf');
  });

  it('shows the clicked page in the preview, and the preview pager moves the highlight', async () => {
    mock.pdfPreview = createMockPdfPreview(6);
    renderTool('remove');
    drop('doc.pdf');
    await userEvent.click(await screen.findByRole('button', { name: 'Remove page 4' }));
    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(within(preview).getByText('4 / 6')).toBeInTheDocument();
    expect(within(preview).getByRole('img', { name: 'Page 4 of doc.pdf' })).toBeInTheDocument();
    await userEvent.click(within(preview).getByLabelText('Next page of doc.pdf'));
    expect(document.querySelector('.page.focused .page-num')).toHaveTextContent('5');
    expect(screen.getByLabelText('Pages to remove')).toHaveValue('4'); // paging doesn't change the selection
  });

  it('live-previews watermark output as options change, staying on the current page', async () => {
    mock.pdfPreview = createMockPdfPreview(4);
    mock.toolClient.run.mockImplementation(async ({ options }) => ({
      ok: true, outputs: [{ name: `a_${options.text}.pdf`, bytes: new Uint8Array([1]) }],
    }));
    renderTool('watermark');
    drop('a.pdf');
    expect(await screen.findByRole('img', { name: 'Page 1 of a_CONFIDENTIAL.pdf' }, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText('Live preview')).toBeInTheDocument();
    await userEvent.click(screen.getAllByLabelText(/^Next page of/)[0]);
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'DRAFT' } });
    expect(await screen.findByRole('img', { name: 'Page 2 of a_DRAFT.pdf' }, { timeout: 2000 })).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('group', { name: 'Preview' })).getByRole('button', { name: 'Original' }));
    expect(screen.getByRole('img', { name: 'Page 2 of a.pdf' })).toBeInTheDocument();
  });

  it('pauses the live preview with the reason when options are invalid', async () => {
    mock.toolClient.run.mockResolvedValue({ ok: false, error: 'Font size must be between 8 and 300.' });
    renderTool('watermark');
    drop('a.pdf');
    expect(await screen.findByText(/Preview paused: Font size must be between 8 and 300\./, {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('Fill & sign waits for something to add, then sends the placed items', async () => {
    renderTool('fillsign');
    drop('a.pdf');
    expect(runButton('Fill & sign')).toBeDisabled();
    expect(screen.getByText('Add a signature, text, a date or an image, or fill in the form.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Text' }));
    expect(runButton('Fill & sign')).toBeEnabled();
    await userEvent.click(runButton('Fill & sign'));
    const { options } = mock.toolClient.run.mock.calls.at(-1)[0];
    expect(JSON.parse(options.items)).toEqual([expect.objectContaining({ kind: 'text', text: 'Your text', page: 1 })]);
  });

  it('has no side preview for tools that already show one big page', async () => {
    renderTool('rotate');
    drop('a.pdf');
    await screen.findByText('1 / 3');
    expect(screen.queryByRole('region', { name: 'Preview' })).not.toBeInTheDocument();
  });

  it('shows one page viewer with a pager for whole-file tools', async () => {
    renderTool('rotate');
    drop('doc.pdf');
    expect(await screen.findByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Page 1 of doc.pdf' })).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Next page of doc.pdf'));
    expect(screen.getByRole('img', { name: 'Page 2 of doc.pdf' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'File view' })).not.toBeInTheDocument();
  });

  it('starts the viewer at page 1 again when the file is replaced', async () => {
    renderTool('rotate');
    drop('a.pdf');
    await userEvent.click(await screen.findByLabelText('Next page of a.pdf'));
    drop('b.pdf');
    expect(await screen.findByText('1 / 3')).toBeInTheDocument();
  });

  it('passes edited options to the worker', async () => {
    renderTool('rotate');
    drop('a.pdf');
    await userEvent.click(screen.getByRole('radio', { name: '180°' }));
    await userEvent.click(runButton('Rotate PDF'));
    expect(mock.toolClient.run).toHaveBeenCalledWith(expect.objectContaining({ toolId: 'rotate', options: { angle: '180', ranges: '' } }));
  });

  it('runs when the options form is submitted with Enter, but not without files', async () => {
    renderTool('extract');
    fireEvent.submit(screen.getByLabelText('Pages to keep').closest('form'));
    expect(mock.toolClient.run).not.toHaveBeenCalled();
    drop('a.pdf');
    fireEvent.change(screen.getByLabelText('Pages to keep'), { target: { value: '1' } });
    fireEvent.submit(screen.getByLabelText('Pages to keep').closest('form'));
    await waitFor(() => expect(mock.toolClient.run).toHaveBeenCalled());
  });

  it('keeps Run disabled while a required field is empty, and says what is missing', async () => {
    renderTool('protect');
    drop('a.pdf');
    expect(runButton('Protect PDF')).toBeDisabled();
    expect(screen.getByText('Fill in password first.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Password'), 'pw');
    expect(screen.getByText('Fill in confirm password first.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Confirm password'), 'pw');
    expect(runButton('Protect PDF')).toBeEnabled();
    expect(screen.queryByText(/first\.$/)).not.toBeInTheDocument();
  });

  it('points page tools at the page grid when no pages are picked', () => {
    renderTool('remove');
    drop('a.pdf');
    expect(screen.getByText('Click the pages to remove, or type them above.')).toBeInTheDocument();
  });

  it('tells Split users they can drag to make files', () => {
    renderTool('split');
    drop('a.pdf');
    expect(screen.getByText('Drag across pages to make files, or type ranges above.')).toBeInTheDocument();
  });

  it('previews the result in the viewer, with a switch back to the original', async () => {
    mock.toolClient.run.mockResolvedValueOnce({ ok: true, outputs: [{ name: 'a_compressed.pdf', bytes: new Uint8Array([1]) }] });
    renderTool('compress');
    drop('a.pdf');
    expect(screen.queryByRole('group', { name: 'Preview' })).not.toBeInTheDocument();
    await userEvent.click(runButton('Compress PDF'));
    expect(await screen.findByRole('img', { name: 'Page 1 of a_compressed.pdf' })).toBeInTheDocument();
    const toggle = screen.getByRole('group', { name: 'Preview' });
    await userEvent.click(within(toggle).getByRole('button', { name: 'Original' }));
    expect(await screen.findByRole('img', { name: 'Page 1 of a.pdf' })).toBeInTheDocument();
  });

  it('shows the tool’s note as plain text under the headline', async () => {
    mock.toolClient.run.mockResolvedValueOnce({ ok: true, outputs: [{ name: 'a.pdf', bytes: new Uint8Array([1]) }], note: 'It was left as is.' });
    renderTool('rotate');
    drop('a.pdf');
    await userEvent.click(runButton('Rotate PDF'));
    expect(await screen.findByText('It was left as is.')).toHaveClass('status-detail');
  });

  it('labels each page with the file Split will put it in', async () => {
    mock.pdfPreview = createMockPdfPreview(5);
    renderTool('split');
    drop('a.pdf');
    await userEvent.type(screen.getByLabelText(/Ranges/), '1-2, 3-');
    const nums = () => screen.getAllByRole('listitem').filter((li) => li.classList.contains('page')).map((li) => li.textContent);
    expect(nums()).toEqual(['1 · File 1', '2 · File 1', '3 · File 2', '4 · File 2', '5 · File 2']);
    expect(screen.getByText('2 files')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Every page' }));
    expect(screen.getByText('5 files')).toBeInTheDocument();
  });

  it('starts over after a result: clears the files and the result', async () => {
    renderTool('rotate');
    drop('a.pdf');
    await userEvent.click(runButton('Rotate PDF'));
    await userEvent.click(await screen.findByRole('button', { name: /Start over/ }));
    expect(rowNames()).toEqual([]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(runButton('Rotate PDF')).toBeDisabled();
  });

  it('shows tool errors', async () => {
    mock.toolClient.run.mockResolvedValue({ ok: false, error: 'Page 9 is out of range.' });
    renderTool('rotate');
    drop('a.pdf');
    await userEvent.click(runButton('Rotate PDF'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Page 9 is out of range.');
  });

  it('disables Run and shows progress while working', async () => {
    mock.toolClient.run.mockReturnValue(new Promise(() => {}));
    renderTool('rotate');
    drop('a.pdf');
    await userEvent.click(runButton('Rotate PDF'));
    expect(await screen.findByRole('button', { name: 'Working…' })).toBeDisabled();
  });
});
