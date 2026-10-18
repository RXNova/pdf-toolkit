import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupBrowserTestEnv } from '../test-utils.js';
import SignaturePad, { cropCanvas } from './SignaturePad.jsx';

setupBrowserTestEnv();

// jsdom has no 2D canvas: fake one whose pixels are "inked" once anything is drawn.
let inked;
beforeEach(() => {
  inked = false;
  const ctx = {
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() { inked = true; }, clearRect() { inked = false; },
    fillText() { inked = true; }, measureText: (t) => ({ width: t.length * 20 }), drawImage() {},
    getImageData: (x, y, w, h) => {
      const data = new Uint8ClampedArray(w * h * 4);
      if (inked) data[((Math.floor(h / 2) * w) + Math.floor(w / 2)) * 4 + 3] = 255; // one opaque pixel
      return { data };
    },
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,SIG');
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 280, height: 110 });
});
afterEach(() => vi.restoreAllMocks());

describe('SignaturePad', () => {
  it('reports the drawn signature, and clears it', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<SignaturePad value="" onChange={onChange} />);
    const pad = screen.getByLabelText('Draw your signature here');
    expect(screen.getByText('Sign here')).toBeInTheDocument();
    fireEvent.pointerDown(pad, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(pad, { clientX: 100, clientY: 50 });
    fireEvent.pointerUp(pad);
    expect(onChange).toHaveBeenLastCalledWith('data:image/png;base64,SIG');
    rerender(<SignaturePad value="data:image/png;base64,SIG" onChange={onChange} />);
    expect(screen.getByText('Now drag the signature into place on the page.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Clear/ }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('renders a typed name as the signature, in the chosen style and ink', async () => {
    const onChange = vi.fn();
    render(<SignaturePad value="" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Type' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Type your name' }), 'Asha');
    expect(onChange).toHaveBeenLastCalledWith('data:image/png;base64,SIG');
    await userEvent.click(screen.getByRole('button', { name: 'Serif' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Blue' }));
    expect(screen.getByRole('radio', { name: 'Blue' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.clear(screen.getByRole('textbox', { name: 'Type your name' }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('ignores pointer moves that aren’t part of a stroke', () => {
    const onChange = vi.fn();
    render(<SignaturePad value="" onChange={onChange} />);
    const pad = screen.getByLabelText('Draw your signature here');
    fireEvent.pointerMove(pad, { clientX: 5, clientY: 5 });
    fireEvent.pointerUp(pad);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('cropCanvas returns nothing for an empty canvas', () => {
    const c = document.createElement('canvas');
    expect(cropCanvas(c)).toBe('');
  });
});
