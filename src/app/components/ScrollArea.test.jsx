import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setupBrowserTestEnv } from '../test-utils.js';
import ScrollArea from './ScrollArea.jsx';

setupBrowserTestEnv();

// jsdom has no layout, so give the scroller the geometry a browser would.
function setGeometry(el, { scrollTop, clientHeight = 100, scrollHeight = 300 }) {
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
  el.scrollTop = scrollTop;
  fireEvent.scroll(el);
}

describe('ScrollArea', () => {
  it('renders the given element with its props inside a frame', () => {
    render(<ScrollArea as="ul" className="files" aria-label="Things"><li>one</li></ScrollArea>);
    const list = screen.getByRole('list', { name: 'Things' });
    expect(list).toHaveClass('files');
    expect(list.parentElement).toHaveClass('scroll-area');
  });

  it('marks the frame with the edges that have more content', () => {
    render(<ScrollArea aria-label="Box">content</ScrollArea>);
    const box = screen.getByLabelText('Box');
    const frame = box.parentElement;

    setGeometry(box, { scrollTop: 0 });
    expect(frame).not.toHaveAttribute('data-more-above');
    expect(frame).toHaveAttribute('data-more-below');

    setGeometry(box, { scrollTop: 100 });
    expect(frame).toHaveAttribute('data-more-above');
    expect(frame).toHaveAttribute('data-more-below');

    setGeometry(box, { scrollTop: 200 });
    expect(frame).toHaveAttribute('data-more-above');
    expect(frame).not.toHaveAttribute('data-more-below');
  });

  it('follows the element when `as` changes', () => {
    const { rerender } = render(<ScrollArea aria-label="Box">content</ScrollArea>);
    rerender(<ScrollArea as="ul" aria-label="Box"><li>one</li></ScrollArea>);
    const list = screen.getByLabelText('Box');
    setGeometry(list, { scrollTop: 50 });
    expect(list.parentElement).toHaveAttribute('data-more-above');
  });

  it('shows no fades when nothing overflows', () => {
    render(<ScrollArea aria-label="Box">content</ScrollArea>);
    const frame = screen.getByLabelText('Box').parentElement;
    expect(frame).not.toHaveAttribute('data-more-above');
    expect(frame).not.toHaveAttribute('data-more-below');
  });
});
