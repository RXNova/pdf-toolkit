import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { getToolDef, TOOL_CATALOG } from '../../catalog.js';
import { setupBrowserTestEnv } from '../test-utils.js';
import ToolSwitch, { fromFiles, fromOutputs, usableBy } from './ContinueWith.jsx';

setupBrowserTestEnv();

const pdf = (name) => ({ name, bytes: new Uint8Array([1, 2, 3]) });
const png = (name) => ({ name, bytes: new Uint8Array([4]) });
const setup = (toolId, outputs) => {
  const onContinue = vi.fn();
  render(<ToolSwitch tool={getToolDef(toolId)} sources={fromOutputs(outputs)} onPick={onContinue} />);
  return onContinue;
};
const open = () => userEvent.click(screen.getByRole('button', { name: /Continue with…/ }));

describe('ContinueWith', () => {
  it('lists every other tool that takes PDFs', async () => {
    setup('split', [pdf('a_p1.pdf')]);
    await open();
    const names = within(screen.getByRole('list')).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    const expected = TOOL_CATALOG.filter((t) => t.id !== 'split' && t.accept === 'pdf').map((t) => `Continue with ${t.title}`);
    expect(names).toEqual(expected);
  });

  it('sends every usable output to a tool that takes several files', async () => {
    const onContinue = setup('split', [pdf('a_p1-2.pdf'), pdf('a_p3.pdf')]);
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Merge PDF' }));
    const [tool, files] = onContinue.mock.lastCall;
    expect(tool.id).toBe('merge');
    expect(files.map((f) => [f.name, f.type])).toEqual([['a_p1-2.pdf', 'application/pdf'], ['a_p3.pdf', 'application/pdf']]);
  });

  it('asks which output to take when a one-file tool gets several', async () => {
    const onContinue = setup('split', [pdf('a_p1-2.pdf'), pdf('a_p3.pdf')]);
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Rotate PDF' }));
    expect(screen.getByText('Rotate PDF takes one file. Which one?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /a_p3\.pdf/ }));
    expect(onContinue.mock.lastCall[0].id).toBe('rotate');
    expect(onContinue.mock.lastCall[1].map((f) => f.name)).toEqual(['a_p3.pdf']);
  });

  it('goes straight on with a single output, and can back out of the picker', async () => {
    const onContinue = setup('merge', [pdf('m.pdf')]);
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Compress PDF' }));
    expect(onContinue.mock.lastCall[1].map((f) => f.name)).toEqual(['m.pdf']);
  });

  it('offers images only to the tool that takes images', async () => {
    const onContinue = setup('toimage', [png('d_p1.png'), png('d_p2.png')]);
    await open();
    expect(within(screen.getByRole('list')).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Continue with JPG / PNG to PDF']);
    await userEvent.click(screen.getByRole('button', { name: 'Continue with JPG / PNG to PDF' }));
    expect(onContinue.mock.lastCall[1].map((f) => f.type)).toEqual(['image/png', 'image/png']);
  });

  it('backs out of the file picker', async () => {
    setup('split', [pdf('a.pdf'), pdf('b.pdf')]);
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Rotate PDF' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back to the tool list' }));
    expect(screen.getByRole('button', { name: /Continue with…/ })).toBeInTheDocument();
  });

  it('usableBy and the source adapters', () => {
    expect(usableBy(getToolDef('images'), fromOutputs([pdf('a.pdf'), png('b.png')])).map((o) => o.name)).toEqual(['b.png']);
    expect(fromOutputs([png('x.jpg')])[0].toFile().type).toBe('image/jpeg');
    const f = new File(['abc'], 'in.pdf');
    expect(fromFiles([f])[0]).toEqual(expect.objectContaining({ name: 'in.pdf', size: 3 }));
    expect(fromFiles([f])[0].toFile()).toBe(f);
  });

  it('as a menu: switches tools with the loaded files, and closes on Escape or an outside click', async () => {
    const onPick = vi.fn();
    const files = [new File(['a'], 'a.pdf'), new File(['b'], 'b.pdf')];
    render(<><button type="button">outside</button><ToolSwitch tool={getToolDef('split')} sources={fromFiles(files)} onPick={onPick} variant="menu" label="Switch tool" /></>);
    const toggle = screen.getByRole('button', { name: /Switch tool/ });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('button', { name: 'Switch to Compress PDF' }));
    await userEvent.click(screen.getByRole('button', { name: /b\.pdf/ }));
    expect(onPick).toHaveBeenCalledWith(getToolDef('compress'), [files[1]]);
  });
});
