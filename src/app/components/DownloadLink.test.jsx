import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import DownloadLink from './DownloadLink.jsx';
import { setupBrowserTestEnv } from '../test-utils.js';

setupBrowserTestEnv();

it('renders a download link with name and size', () => {
  render(<DownloadLink file={{ name: 'out.pdf', bytes: new Uint8Array(2048) }} primary />);
  const link = screen.getByRole('link', { name: 'Download out.pdf' });
  expect(link).toHaveAttribute('href', 'blob:test/1');
  expect(link).toHaveAttribute('download', 'out.pdf');
  expect(link).toHaveClass('primary');
  expect(link).toHaveTextContent('2 KB');
  expect(URL.createObjectURL.mock.calls[0][0].type).toBe('application/pdf');
});

it('uses a custom label and the zip MIME type for zips', () => {
  render(<DownloadLink file={{ name: 'all.zip', bytes: new Uint8Array(1) }} label="Download all" showSize={false} />);
  const link = screen.getByRole('link', { name: 'Download all all.zip' });
  expect(link).not.toHaveClass('primary');
  expect(link).toHaveTextContent('Download all');
  expect(link).not.toHaveTextContent('B');
  expect(URL.createObjectURL.mock.calls[0][0].type).toBe('application/zip');
});

it('names links labelled with the bare file name "Download <name>"', () => {
  render(<DownloadLink file={{ name: 'p1.pdf', bytes: new Uint8Array(1) }} label="p1.pdf" />);
  expect(screen.getByRole('link', { name: 'Download p1.pdf' })).toHaveTextContent('p1.pdf');
});
