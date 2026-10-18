import { describe, expect, it, vi } from 'vitest';
import { createCanvasImageCodec, fitWithin, rawToCanvas } from './image-codec.js';

/** Minimal OffscreenCanvas/ImageData fakes that record what was drawn. */
function fakeCanvasApi() {
  const canvases = [];
  class FakeOffscreenCanvas {
    constructor(width, height) {
      Object.assign(this, { width, height, ops: [] });
      canvases.push(this);
    }
    getContext() {
      const ops = this.ops;
      return {
        set fillStyle(v) { ops.push(['fillStyle', v]); },
        fillRect: (...a) => ops.push(['fillRect', ...a]),
        drawImage: (src, ...a) => ops.push(['drawImage', src, ...a]),
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: (data) => ops.push(['putImageData', data]),
      };
    }
    async convertToBlob(opts) {
      this.blobOptions = opts;
      return new Blob([new Uint8Array([0xff, 0xd8, 0xff])]);
    }
  }
  return { OffscreenCanvas: FakeOffscreenCanvas, canvases };
}

describe('fitWithin', () => {
  it.each([
    [[4000, 2000, 2000], { width: 2000, height: 1000 }],
    [[1000, 3000, 1500], { width: 500, height: 1500 }],
    [[800, 600, 2000], { width: 800, height: 600 }],
    [[10000, 1, 100], { width: 100, height: 1 }],
  ])('%j', ([w, h, max], expected) => expect(fitWithin(w, h, max)).toEqual(expected));
});

describe('rawToCanvas', () => {
  it('expands gray and RGB pixels to opaque RGBA', () => {
    const { OffscreenCanvas } = fakeCanvasApi();
    const gray = rawToCanvas({ pixels: new Uint8Array([10, 20]), width: 2, height: 1, components: 1 }, OffscreenCanvas);
    expect([...gray.ops[0][1].data]).toEqual([10, 10, 10, 255, 20, 20, 20, 255]);
    const rgb = rawToCanvas({ pixels: new Uint8Array([1, 2, 3]), width: 1, height: 1, components: 3 }, OffscreenCanvas);
    expect([...rgb.ops[0][1].data]).toEqual([1, 2, 3, 255]);
  });
});

describe('createCanvasImageCodec', () => {
  it('decodes JPEGs, scales them down on a white background and re-encodes at the given quality', async () => {
    const { OffscreenCanvas, canvases } = fakeCanvasApi();
    const bitmap = { width: 4000, height: 2000, close: vi.fn() };
    const createImageBitmap = vi.fn(async () => bitmap);
    const codec = createCanvasImageCodec({ createImageBitmap, OffscreenCanvas });

    const result = await codec.recompress({ kind: 'jpeg', bytes: new Uint8Array([1]) }, { maxDimension: 1000, quality: 0.6 });

    expect(createImageBitmap.mock.calls[0][0]).toBeInstanceOf(Blob);
    const out = canvases.at(-1);
    expect([out.width, out.height]).toEqual([1000, 500]);
    expect(out.ops).toEqual([['fillStyle', '#ffffff'], ['fillRect', 0, 0, 1000, 500], ['drawImage', bitmap, 0, 0, 1000, 500]]);
    expect(out.blobOptions).toEqual({ type: 'image/jpeg', quality: 0.6 });
    expect(bitmap.close).toHaveBeenCalled();
    expect(result).toEqual({ bytes: new Uint8Array([0xff, 0xd8, 0xff]), width: 1000, height: 500 });
  });

  it('draws raw pixels via an intermediate canvas', async () => {
    const { OffscreenCanvas, canvases } = fakeCanvasApi();
    const codec = createCanvasImageCodec({ createImageBitmap: vi.fn(), OffscreenCanvas });
    const result = await codec.recompress({ kind: 'raw', pixels: new Uint8Array(3), width: 1, height: 1, components: 3 }, { maxDimension: 10, quality: 0.5 });
    expect(canvases).toHaveLength(2);
    expect(canvases[1].ops.at(-1)[1]).toBe(canvases[0]);
    expect(result.width).toBe(1);
  });

  it('returns null when the browser cannot decode the image', async () => {
    const { OffscreenCanvas } = fakeCanvasApi();
    const codec = createCanvasImageCodec({ createImageBitmap: async () => { throw new DOMException('bad'); }, OffscreenCanvas });
    expect(await codec.recompress({ kind: 'jpeg', bytes: new Uint8Array() }, { maxDimension: 10, quality: 0.5 })).toBeNull();
  });

  it('uses the global browser APIs by default', () => {
    expect(() => createCanvasImageCodec()).not.toThrow();
  });
});
