import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { TOOL_CATALOG } from '../catalog.js';
import App from './App.jsx';
import { createMockPdfPreview, createMockToolClient, fileDrag, makeFile, setupBrowserTestEnv } from './test-utils.js';

const mock = vi.hoisted(() => ({ toolClient: null, pdfPreview: null }));
vi.mock('./services.js', () => ({
  get toolClient() { return mock.toolClient; },
  clientFor: () => mock.toolClient,
  get pdfPreview() { return mock.pdfPreview; },
}));

setupBrowserTestEnv();
beforeEach(() => (mock.pdfPreview = createMockPdfPreview()));

it('navigates from the grid to a tool and back', async () => {
  mock.toolClient = createMockToolClient();
  render(<App />);
  expect(screen.queryByRole('button', { name: /All tools/ })).not.toBeInTheDocument();
  expect(within(screen.getByRole('main')).getAllByRole('button', { name: /^Open / })).toHaveLength(TOOL_CATALOG.length);
  expect(document.title).toBe('PDF Toolkit · Free PDF tools. Your files never leave your device');

  await userEvent.click(screen.getByRole('button', { name: 'Open Compress PDF' }));
  expect(screen.getByRole('heading', { name: 'Compress PDF' })).toBeInTheDocument();
  expect(document.title).toBe('Compress PDF · PDF Toolkit · Files never leave your device');

  await userEvent.click(screen.getByRole('button', { name: /All tools/ }));
  expect(screen.getByRole('searchbox', { name: 'Search tools' })).toBeInTheDocument();
});

it('resets tool state when switching tools', async () => {
  mock.toolClient = createMockToolClient();
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'Open Rotate PDF' }));
  fireEvent.drop(screen.getByTestId('dropzone'), fileDrag([makeFile('a.pdf')]));
  expect(screen.getByText('a.pdf')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /All tools/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Open Add watermark' }));
  expect(screen.queryByText('a.pdf')).not.toBeInTheDocument();
});

it('returns home from the logo', async () => {
  mock.toolClient = createMockToolClient();
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'Open Rotate PDF' }));
  await userEvent.click(screen.getByRole('button', { name: 'PDF Toolkit home' }));
  expect(screen.getByRole('searchbox', { name: 'Search tools' })).toBeInTheDocument();
});

it('offers a skip link to the main content', () => {
  mock.toolClient = createMockToolClient();
  render(<App />);
  expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
  expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
});


it('remembers the grid/list choice and hides the toggle on tool pages', async () => {
  mock.toolClient = createMockToolClient();
  localStorage.clear();
  const { unmount } = render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'List' }));
  expect(screen.getByRole('list', { name: 'Tools' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Open Rotate PDF' }));
  expect(screen.queryByRole('group', { name: 'Layout' })).not.toBeInTheDocument();
  unmount();
  render(<App />);
  expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
  localStorage.clear();
});

it('continues from one tool into another with the result, picking a file when needed', async () => {
  mock.toolClient = createMockToolClient();
  mock.toolClient.run.mockResolvedValue({
    ok: true, outputs: [{ name: 'a_p1.pdf', bytes: new Uint8Array([1]) }, { name: 'a_p2.pdf', bytes: new Uint8Array([2]) }],
  });
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'Open Split PDF' }));
  fireEvent.drop(screen.getByTestId('dropzone'), fileDrag([makeFile('a.pdf')]));
  await userEvent.type(screen.getByLabelText(/Ranges/), '1, 2');
  await userEvent.click(screen.getByRole('button', { name: 'Split PDF' }));
  await userEvent.click(await screen.findByRole('button', { name: /Continue with…/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Continue with Merge PDF' }));
  expect(screen.getByRole('heading', { name: /Merge PDF/ })).toBeInTheDocument();
  expect(screen.getAllByText(/a_p\d\.pdf/, { selector: '.fname' }).map((n) => n.textContent)).toEqual(['a_p1.pdf', 'a_p2.pdf']);

  mock.toolClient.run.mockResolvedValue({ ok: true, outputs: [{ name: 'merged.pdf', bytes: new Uint8Array([3]) }] });
  await userEvent.click(screen.getByRole('button', { name: 'Merge PDF' }));
  await userEvent.click(await screen.findByRole('button', { name: /Continue with…/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Continue with Rotate PDF' }));
  expect(screen.getByRole('heading', { name: /Rotate PDF/ })).toBeInTheDocument();
  expect(screen.getByText('merged.pdf', { selector: '.fname' })).toBeInTheDocument();
});

it('switches tools with the loaded files, without running anything', async () => {
  mock.toolClient = createMockToolClient();
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'Open Split PDF' }));
  fireEvent.drop(screen.getByTestId('dropzone'), fileDrag([makeFile('report.pdf')]));
  await userEvent.click(screen.getByRole('button', { name: /Switch tool/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Switch to Compress PDF' }));
  expect(screen.getByRole('heading', { name: /Compress PDF/ })).toBeInTheDocument();
  expect(screen.getByText('report.pdf', { selector: '.fname' })).toBeInTheDocument();
  expect(mock.toolClient.run).not.toHaveBeenCalledWith(expect.objectContaining({ toolId: 'split' }));
});
