import { degrees, StandardFonts } from 'pdf-lib';
import { UserError } from '../errors.js';
import { selectPages } from '../page-ranges.js';
import { hexToRgb, loadPdf, savePdf } from '../pdf.js';

const FONTS = {
  'sans-bold': StandardFonts.HelveticaBold,
  sans: StandardFonts.Helvetica,
  'serif-bold': StandardFonts.TimesRomanBold,
  'serif-italic': StandardFonts.TimesRomanItalic,
  'mono-bold': StandardFonts.CourierBold,
};

/** Gaps between tiles, as multiples of the text width (along) and font size (across). */
const DENSITY = { sparse: [1, 5], normal: [0.6, 3.5], dense: [0.25, 2.2] };
const MARGIN = 36; // pt from the page edge for top/bottom placement

/** @type {import('./index.js').ToolHandler} */
export default async function watermark({ files: [file], options, name }) {
  const doc = await loadPdf(file);
  const font = await doc.embedFont(FONTS[options.font] ?? StandardFonts.HelveticaBold);
  const { text, size } = options;
  const angle = Number(options.angle);
  let textWidth;
  try {
    textWidth = font.widthOfTextAtSize(text, size); // also checks the font can encode every character
  } catch {
    throw new UserError('The watermark can only use Latin letters, digits and common symbols (the standard PDF fonts).');
  }
  const style = { size, font, color: hexToRgb(options.color), opacity: options.opacity, rotate: degrees(angle) };
  const pages = doc.getPages();
  const chosen = new Set(selectPages(options.ranges, pages.length));

  pages.forEach((page, i) => {
    if (!chosen.has(i)) return;
    const { width, height } = page.getSize();
    const centers = options.layout === 'tile'
      ? tileCenters({ width, height, textWidth, fontSize: size, angleDeg: angle, density: options.density })
      : [{ x: width / 2, y: singleY(options.position, height, textWidth, size, angle) }];
    for (const c of centers) {
      page.drawText(text, { ...centeredRotatedOrigin({ cx: c.x, cy: c.y, textWidth, fontSize: size, angleDeg: angle }), ...style });
    }
    if (options.layer === 'under') sendDrawingBehind(page);
  });
  return { outputs: [{ name, bytes: await savePdf(doc) }] };
}

/**
 * pdf-lib rotates text around its baseline start, so shift that start point back along
 * the text direction (half the width) and down across it (≈ a third of the font size,
 * the visual middle of capitals) to center the text on (cx, cy).
 */
export function centeredRotatedOrigin({ cx, cy, textWidth, fontSize, angleDeg }) {
  const th = (angleDeg * Math.PI) / 180;
  const half = textWidth / 2;
  const mid = fontSize / 3;
  return {
    x: cx - half * Math.cos(th) + mid * Math.sin(th),
    y: cy - half * Math.sin(th) - mid * Math.cos(th),
  };
}

/** Half the height the rotated text takes up, for keeping it clear of the top or bottom edge. */
const halfExtentY = (textWidth, fontSize, angleDeg) => {
  const th = (angleDeg * Math.PI) / 180;
  return (Math.abs(Math.sin(th)) * textWidth + Math.abs(Math.cos(th)) * fontSize) / 2;
};

export function singleY(position, height, textWidth, fontSize, angleDeg) {
  const ext = Math.min(halfExtentY(textWidth, fontSize, angleDeg), height / 2);
  if (position === 'top') return height - MARGIN - ext;
  if (position === 'bottom') return MARGIN + ext;
  return height / 2;
}

/**
 * Centers of a staggered grid of stamps, laid out along the text direction and covering the
 * whole page whatever the angle. Every other row shifts half a step, like brickwork.
 */
export function tileCenters({ width, height, textWidth, fontSize, angleDeg, density = 'normal' }) {
  const [gapAlong, gapAcross] = DENSITY[density] ?? DENSITY.normal;
  const stepU = textWidth * (1 + gapAlong);
  const stepV = fontSize * gapAcross;
  const th = (angleDeg * Math.PI) / 180;
  const [cos, sin] = [Math.cos(th), Math.sin(th)];
  const reach = Math.hypot(width, height) / 2 + textWidth; // far enough to cover the corners
  const out = [];
  for (let row = -Math.ceil(reach / stepV); row <= Math.ceil(reach / stepV); row++) {
    const v = row * stepV;
    const shift = (row & 1) * stepU / 2;
    for (let col = -Math.ceil(reach / stepU) - 1; col <= Math.ceil(reach / stepU) + 1; col++) {
      const u = col * stepU + shift;
      const x = width / 2 + u * cos - v * sin;
      const y = height / 2 + u * sin + v * cos;
      const pad = textWidth / 2 + fontSize; // keep stamps that still overlap the page
      if (x > -pad && x < width + pad && y > -pad && y < height + pad) out.push({ x, y });
    }
  }
  return out;
}

/**
 * Move what we just drew on this page underneath the existing content. pdf-lib appends our
 * drawing as the page's last content stream; putting it first means the page paints over it.
 */
function sendDrawingBehind(page) {
  const ref = page.contentStreamRef;
  const contents = page.node.Contents();
  if (!ref || !contents?.indexOf) return; // single stream or unknown layout: leave it on top
  const at = contents.indexOf(ref);
  if (at <= 0) return;
  contents.remove(at);
  contents.insert(0, ref);
  page.contentStream = undefined; // later drawing (if any) starts a fresh stream on top
  page.contentStreamRef = undefined;
}
