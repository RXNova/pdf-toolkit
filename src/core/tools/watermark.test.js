import { PDFArray, PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { named, pageCount, pdfBytes, pdfContainsText } from '../../../tests/helpers/fixtures.js';
import { optionsFor } from '../../../tests/helpers/tools.js';
import watermark, { centeredRotatedOrigin, singleY, tileCenters } from './watermark.js';

const stamp = async (overrides, pages = 2) => {
  const src = named('a.pdf', await pdfBytes({ pages }));
  const { outputs } = await watermark({ files: [src], options: optionsFor('watermark', overrides), name: 'o.pdf' });
  return { src, out: outputs[0].bytes };
};

/** How many times a page's content streams draw text (Tj operators), as a proxy for stamps. */
async function textDraws(bytes, pageIndex) {
  const { inflateSync } = await import('node:zlib');
  const doc = await PDFDocument.load(bytes);
  const contents = doc.getPage(pageIndex).node.Contents();
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  let n = 0;
  for (const ref of refs) {
    const stream = doc.context.lookup(ref);
    let data = Buffer.from(stream.contents);
    try { data = inflateSync(data); } catch { /* not compressed */ }
    n += (data.toString('latin1').match(/\bTj\b/g) ?? []).length;
  }
  return n;
}

describe('watermark', () => {
  it('stamps the text on every page by default', async () => {
    const { src, out } = await stamp({ text: 'DRAFT' });
    expect(await pageCount(out)).toBe(2);
    expect(await pdfContainsText(out, 'DRAFT')).toBe(true);
    expect(await pdfContainsText(src.bytes, 'DRAFT')).toBe(false);
  });

  it('stamps only the chosen pages', async () => {
    const { out } = await stamp({ text: 'X', ranges: '2' }, 3);
    // each test page already draws one "Page n" label
    expect(await textDraws(out, 0)).toBe(1);
    expect(await textDraws(out, 1)).toBe(2);
    expect(await textDraws(out, 2)).toBe(1);
  });

  it('tiles the text across the page', async () => {
    const { out } = await stamp({ text: 'TILE', size: 20, layout: 'tile' }, 1);
    expect(await textDraws(out, 0)).toBeGreaterThan(10);
  });

  it('accepts every font, direction, position and layer', async () => {
    for (const font of ['sans', 'serif-bold', 'serif-italic', 'mono-bold']) {
      for (const angle of ['0', '-45', '90']) {
        const { out } = await stamp({ text: 'F', font, angle, position: 'top' }, 1);
        expect(await pdfContainsText(out, 'F')).toBe(true);
      }
    }
  });

  it('explains when the text has characters the standard fonts can’t draw', async () => {
    await expect(stamp({ text: 'गोपनीय' }, 1)).rejects.toThrow(/only use Latin letters/);
  });

  it('puts the stamp behind the page content when asked', async () => {
    const { out } = await stamp({ text: 'UNDER', layer: 'under' }, 1);
    const doc = await PDFDocument.load(out);
    const first = doc.context.lookup(doc.getPage(0).node.Contents().get(0));
    const { inflateSync } = await import('node:zlib');
    let data = Buffer.from(first.contents);
    try { data = inflateSync(data); } catch { /* not compressed */ }
    expect(data.toString('latin1')).toContain(Buffer.from('UNDER').toString('hex').toUpperCase());
  });
});

describe('centeredRotatedOrigin', () => {
  it('is the plain centering offset when not rotated', () => {
    const o = centeredRotatedOrigin({ cx: 100, cy: 100, textWidth: 60, fontSize: 30, angleDeg: 0 });
    expect(o.x).toBeCloseTo(70);
    expect(o.y).toBeCloseTo(90);
  });

  it('keeps the text midpoint on the center at 45°', () => {
    const angle = Math.PI / 4;
    const o = centeredRotatedOrigin({ cx: 0, cy: 0, textWidth: 100, fontSize: 30, angleDeg: 45 });
    expect(o.x + 50 * Math.cos(angle) - 10 * Math.sin(angle)).toBeCloseTo(0);
    expect(o.y + 50 * Math.sin(angle) + 10 * Math.cos(angle)).toBeCloseTo(0);
  });
});

describe('singleY', () => {
  it('centers, or keeps the rotated text clear of the top/bottom edge', () => {
    expect(singleY('center', 800, 200, 40, 45)).toBe(400);
    expect(singleY('top', 800, 200, 40, 0)).toBe(800 - 36 - 20);
    expect(singleY('bottom', 800, 200, 40, 90)).toBe(36 + 100);
  });
});

describe('tileCenters', () => {
  const page = { width: 600, height: 800, textWidth: 120, fontSize: 30 };
  it('covers the whole page at any angle', () => {
    for (const angleDeg of [0, 45, -45, 90]) {
      const pts = tileCenters({ ...page, angleDeg });
      for (const [qx, qy] of [[0.15, 0.15], [0.85, 0.15], [0.5, 0.5], [0.15, 0.85], [0.85, 0.85]]) {
        const near = pts.some((p) => Math.hypot(p.x - qx * 600, p.y - qy * 800) < 160);
        expect(near, `${angleDeg}° near (${qx}, ${qy})`).toBe(true);
      }
    }
  });

  it('places more stamps when denser', () => {
    const n = (density) => tileCenters({ ...page, angleDeg: 45, density }).length;
    expect(n('dense')).toBeGreaterThan(n('normal'));
    expect(n('normal')).toBeGreaterThan(n('sparse'));
  });
});
