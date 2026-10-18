import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { setupBrowserTestEnv } from '../test-utils.js';
import PlacementBox, { OverlayFrame, useImageAspect } from './PlacementBox.jsx';

setupBrowserTestEnv();

const frame = { width: 400, height: 800 };
const setup = (value = { x: 0.1, y: 0.1, w: 0.25 }, aspect = 0.5) => {
  const onChange = vi.fn();
  render(<PlacementBox frame={frame} src="data:image/png;base64,AA" aspect={aspect} value={value} onChange={onChange} label="Signature" />);
  return { onChange, box: screen.getByRole('group', { name: /Signature: drag to move/ }) };
};

describe('PlacementBox', () => {
  it('sits at its page-fraction position, sized by width and aspect ratio', () => {
    const { box } = setup();
    expect(box.style.left).toBe('40px');
    expect(box.style.top).toBe('80px');
    expect(box.style.width).toBe('100px');
    expect(box.style.height).toBe('50px');
  });

  it('moves with the arrow keys and resizes with + and −', () => {
    const { box, onChange } = setup();
    fireEvent.keyDown(box, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith({ x: 0.11, y: 0.1, w: 0.25 });
    fireEvent.keyDown(box, { key: 'ArrowDown', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith({ x: 0.1, y: 0.15, w: 0.25 });
    fireEvent.keyDown(box, { key: '+' });
    expect(onChange).toHaveBeenLastCalledWith({ x: 0.1, y: 0.1, w: 0.26 });
    fireEvent.keyDown(box, { key: '-' });
    expect(onChange).toHaveBeenLastCalledWith({ x: 0.1, y: 0.1, w: 0.24 });
  });

  it('drags to move, staying on the page', () => {
    const { box, onChange } = setup();
    fireEvent.pointerDown(box, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(box, { clientX: 140, clientY: 180 });
    expect(onChange).toHaveBeenLastCalledWith({ x: 0.2, y: 0.2, w: 0.25 });
    fireEvent.pointerMove(box, { clientX: 2000, clientY: -500 });
    expect(onChange).toHaveBeenLastCalledWith({ x: 0.75, y: 0, w: 0.25 });
    fireEvent.pointerUp(box);
    onChange.mockClear();
    fireEvent.pointerMove(box, { clientX: 0, clientY: 0 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('drags the corner to resize', () => {
    const { box, onChange } = setup();
    const handle = box.querySelector('.placement-handle');
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 40, clientY: 0 });
    expect(onChange).toHaveBeenLastCalledWith({ x: 0.1, y: 0.1, w: 0.35 });
  });

  it('keeps a box that starts off the page inside it', () => {
    const { box } = setup({ x: 0.95, y: 0.99, w: 0.25 });
    expect(box.style.left).toBe('300px'); // x clamped to 1 − w
    expect(parseFloat(box.style.top)).toBeCloseTo(800 - 50);
  });
});

describe('OverlayFrame', () => {
  it('covers the canvas inside the preview, and nothing before it exists', () => {
    const host = document.createElement('div');
    const ref = createRef();
    ref.current = host;
    const { rerender, container } = render(<OverlayFrame previewRef={ref}>{(box) => <span>{box.width}</span>}</OverlayFrame>);
    expect(container.querySelector('.overlay-frame')).toBeNull();
    const canvas = document.createElement('canvas');
    Object.defineProperties(canvas, { offsetLeft: { value: 10 }, offsetTop: { value: 5 }, offsetWidth: { value: 300 }, offsetHeight: { value: 400 } });
    host.append(canvas);
    rerender(<OverlayFrame previewRef={{ current: host }}>{(box) => <span>{box.width}</span>}</OverlayFrame>);
    const frameEl = container.querySelector('.overlay-frame');
    expect(frameEl.style.left).toBe('10px');
    expect(frameEl).toHaveTextContent('300');
  });
});

describe('useImageAspect', () => {
  it('reports height / width once the image loads', () => {
    let img;
    vi.stubGlobal('Image', class {
      constructor() { img = this; }
    });
    const { result } = renderHook(() => useImageAspect('data:x'));
    expect(result.current).toBeNull();
    act(() => {
      Object.assign(img, { naturalWidth: 200, naturalHeight: 50 });
      img.onload();
    });
    expect(result.current).toBe(0.25);
    vi.unstubAllGlobals();
  });
});
