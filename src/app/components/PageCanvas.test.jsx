import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { setupBrowserTestEnv } from '../test-utils.js';
import PageCanvas from './PageCanvas.jsx';

setupBrowserTestEnv();
afterEach(() => vi.unstubAllGlobals());

const doc = () => ({ render: vi.fn(async () => {}) });

it('waits until it is near the viewport before drawing (lazy)', () => {
  let callback;
  const observer = { observe: vi.fn(), disconnect: vi.fn() };
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb) { callback = cb; return observer; }
  });
  const d = doc();
  render(<PageCanvas doc={d} page={3} width={100} label="Page 3" lazy />);
  expect(d.render).not.toHaveBeenCalled();
  act(() => callback([{ isIntersecting: true }]));
  expect(d.render).toHaveBeenCalledWith(3, expect.any(HTMLCanvasElement), 100);
  expect(observer.disconnect).toHaveBeenCalled();
});

it('says when a page can’t be drawn', async () => {
  const d = { render: vi.fn(async () => { throw new Error('bad'); }) };
  render(<PageCanvas doc={d} page={1} width={100} label="Page 1" />);
  expect(await screen.findByText('No preview')).toBeInTheDocument();
});
