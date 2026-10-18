/**
 * ImageCodec backed by the browser's own decoders/encoders (createImageBitmap + OffscreenCanvas),
 * available inside Web Workers. Globals are injectable for unit tests.
 *
 * @returns {import('../core/tools/index.js').ImageCodec}
 */
export function createCanvasImageCodec({
  createImageBitmap = globalThis.createImageBitmap,
  OffscreenCanvas = globalThis.OffscreenCanvas,
} = {}) {
  return {
    async recompress(image, { maxDimension, quality }) {
      let source;
      try {
        source = image.kind === 'jpeg'
          ? await createImageBitmap(new Blob([image.bytes], { type: 'image/jpeg' }))
          : rawToCanvas(image, OffscreenCanvas);
      } catch {
        return null; // e.g. CMYK or corrupt JPEG the browser can't decode: leave it as is
      }
      const { width, height } = fitWithin(source.width, source.height, maxDimension);
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; // JPEG has no alpha; transparency comes from the image's SMask
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(source, 0, 0, width, height);
      source.close?.();
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
      return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
    },
  };
}

/** Scale (w, h) down to fit within `max` on its longest side, never up. */
export function fitWithin(w, h, max) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** Raw 8-bit gray/RGB pixels → canvas, via RGBA ImageData. */
export function rawToCanvas({ pixels, width, height, components }, OffscreenCanvas) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const data = ctx.createImageData(width, height);
  const rgba = data.data;
  for (let i = 0, j = 0; i < width * height; i++, j += components) {
    rgba[i * 4] = pixels[j];
    rgba[i * 4 + 1] = pixels[components === 3 ? j + 1 : j];
    rgba[i * 4 + 2] = pixels[components === 3 ? j + 2 : j];
    rgba[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}
