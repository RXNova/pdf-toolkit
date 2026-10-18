import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Status from './Status.jsx';
import { setupBrowserTestEnv } from '../test-utils.js';

setupBrowserTestEnv();

const out = (name) => ({ name, bytes: new Uint8Array([1]) });

describe('Status', () => {
  it('renders nothing when idle', () => {
    const { container } = render(<Status status={{ kind: 'idle' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows progress while busy', () => {
    render(<Status status={{ kind: 'busy' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Working on your device…');
  });

  it('shows errors as alerts', () => {
    render(<Status status={{ kind: 'error', message: 'Bad range' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Bad range');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows the output file and one download for a single output', () => {
    render(<Status status={{ kind: 'ok', message: 'Done!', outputs: [out('a.pdf')], zip: null }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Done!');
    expect(screen.getByTitle('a.pdf')).toHaveTextContent('a.pdf');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Download a.pdf' })).toHaveAttribute('download', 'a.pdf');
  });

  it('offers "Start over" after a result when a handler is given', async () => {
    const onStartOver = vi.fn();
    render(<Status status={{ kind: 'ok', message: 'Ready', outputs: [out('a.pdf')], zip: null }} onStartOver={onStartOver} />);
    await userEvent.click(screen.getByRole('button', { name: /Start over/ }));
    expect(onStartOver).toHaveBeenCalled();
  });

  it('offers the zip plus each file for multiple outputs', () => {
    render(<Status status={{ kind: 'ok', message: 'Done!', outputs: [out('p1.pdf'), out('p2.pdf')], zip: out('all.zip') }} />);
    expect(screen.getByRole('link', { name: 'Download all all.zip' })).toHaveAttribute('download', 'all.zip');
    expect(screen.getByTitle('all.zip')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Output files' });
    expect(within(list).getAllByRole('link').map((a) => a.getAttribute('download'))).toEqual(['p1.pdf', 'p2.pdf']);
  });
});
