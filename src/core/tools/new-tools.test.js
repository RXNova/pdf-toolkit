import { PDFDocument, PDFName } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { formPdfBytes, named, pageCount, pdfBytes, pdfContainsText, pngDataUrl } from '../../../tests/helpers/fixtures.js';
import { optionsFor } from '../../../tests/helpers/tools.js';
import { UserError } from '../errors.js';
import { parseOptions } from '../options.js';
import { decodeDataUrl, placementRect } from '../pdf.js';
import crop, { fitInside, targetSize } from './crop.js';
import fillsign, { checkItem, textPlacement } from './fillsign.js';
import { listFormFields, setValue } from './form-fields.js';
import headerfooter, { fillPlaceholders } from './headerfooter.js';
import metadata from './metadata.js';
import toimage from './toimage.js';

const pdf = async (pages = 2, size = [300, 400]) => named('doc.pdf', await pdfBytes({ pages, size }));
const run = async (handler, id, file, overrides = {}, deps = {}) =>
  handler({ files: [file], options: optionsFor(id, overrides), name: 'out.pdf', deps });
const load = (bytes) => PDFDocument.load(bytes);

describe('option types', () => {
  it('accepts PNG/JPEG data URLs as images and rejects anything else', () => {
    const schema = [{ key: 'img', label: 'Image', type: 'image', required: true }];
    expect(parseOptions(schema, { img: pngDataUrl() }).img).toMatch(/^data:image\/png/);
    expect(() => parseOptions(schema, { img: 'data:text/html;base64,AAAA' })).toThrow('Image must be a PNG or JPEG image.');
    expect(() => parseOptions(schema, { img: '' })).toThrow('Image is required.');
  });

  it('parses JSON arrays when the option says so', () => {
    const schema = [{ key: 'v', label: 'Items', type: 'json', array: true, default: '[]' }];
    expect(parseOptions(schema, { v: '[1]' }).v).toEqual([1]);
    expect(parseOptions(schema, {}).v).toEqual([]);
    expect(() => parseOptions(schema, { v: '{}' })).toThrow('Items isn’t valid.');
  });

  it('parses JSON objects', () => {
    const schema = [{ key: 'v', label: 'Values', type: 'json', default: '{}' }];
    expect(parseOptions(schema, { v: '{"a":1}' }).v).toEqual({ a: 1 });
    expect(parseOptions(schema, {}).v).toEqual({});
    expect(() => parseOptions(schema, { v: '[1]' })).toThrow('Values isn’t valid.');
    expect(() => parseOptions(schema, { v: '{' })).toThrow(UserError);
  });
});

describe('placement helpers', () => {
  it('decodes data URLs', () => {
    expect(decodeDataUrl('data:image/jpeg;base64,AQID')).toEqual({ kind: 'jpeg', bytes: new Uint8Array([1, 2, 3]) });
  });

  it('turns a top-left fraction placement into pdf coordinates, keeping the aspect ratio', () => {
    expect(placementRect({ x: 0.5, y: 0.25, w: 0.5 }, { width: 400, height: 800 }, { width: 100, height: 50 }))
      .toEqual({ x: 200, y: 800 - 200 - 100, width: 200, height: 100 });
  });
});

describe('crop', () => {
  it('trims margins in millimetres from the chosen pages', async () => {
    const { outputs } = await run(crop, 'crop', await pdf(2, [300, 400]), { top: 10, bottom: 0, left: 5, right: 5, ranges: '1' });
    const doc = await load(outputs[0].bytes);
    const box = doc.getPage(0).getCropBox();
    expect(box.width).toBeCloseTo(300 - 10 * 72 / 25.4);
    expect(box.height).toBeCloseTo(400 - 10 * 72 / 25.4);
    expect(doc.getPage(1).getSize()).toEqual({ width: 300, height: 400 });
  });

  it('refuses margins that leave almost nothing', async () => {
    await expect(run(crop, 'crop', await pdf(1), { top: 70, bottom: 70 })).rejects.toThrow(/leave almost nothing of page 1/);
  });

  it('resizes pages to a paper size, matching each page’s orientation', async () => {
    const src = named('mix.pdf', await (async () => {
      const d = await PDFDocument.create();
      d.addPage([300, 400]);
      d.addPage([500, 300]);
      return d.save();
    })());
    const { outputs } = await run(crop, 'crop', src, { mode: 'resize', size: 'a4' });
    const doc = await load(outputs[0].bytes);
    expect(doc.getPage(0).getSize().width).toBeCloseTo(595.28);
    expect(doc.getPage(1).getSize().width).toBeCloseTo(841.89);
  });

  it('keeps blank pages blank when resizing, and leaves unchosen pages alone', async () => {
    const src = named('b.pdf', await (async () => {
      const d = await PDFDocument.create();
      d.addPage([300, 400]);
      d.addPage([300, 400]);
      return d.save();
    })());
    const { outputs } = await run(crop, 'crop', src, { mode: 'resize', size: 'letter', orientation: 'landscape', ranges: '1' });
    const doc = await load(outputs[0].bytes);
    expect(doc.getPage(0).getSize()).toEqual({ width: 792, height: 612 });
    expect(doc.getPage(1).getSize()).toEqual({ width: 300, height: 400 });
  });

  it('targetSize and fitInside', () => {
    expect(targetSize('letter', 'landscape', { width: 1, height: 2 })).toEqual([792, 612]);
    expect(targetSize('a5', 'auto', { width: 1, height: 2 })).toEqual([419.53, 595.28]);
    expect(fitInside([100, 200], [400, 400])).toEqual({ scale: 2, x: 100, y: 0 });
  });
});

describe('fillsign', () => {
  const image = (extra = {}) => ({ kind: 'image', src: pngDataUrl(), page: 1, x: 0.5, y: 0.7, w: 0.3, ...extra });
  const text = (extra = {}) => ({ kind: 'text', text: 'Asha Rao', color: '#111111', page: 1, x: 0.1, y: 0.1, w: 0.4, ...extra });
  const go = async (file, opts) => run(fillsign, 'fillsign', file, { items: JSON.stringify(opts.items ?? []), values: JSON.stringify(opts.values ?? {}), ...opts.rest });
  const imagesOn = async (bytes) => {
    const doc = await load(bytes);
    return doc.getPages().map((p) => p.node.Resources().lookup(PDFName.of('XObject'))?.keys().length ?? 0);
  };

  it('places images on their page, or on every page, embedding each image once', async () => {
    const { outputs, summary } = await go(await pdf(3), { items: [image({ page: 2 }), image({ page: 3 })] });
    expect(await imagesOn(outputs[0].bytes)).toEqual([0, 1, 1]);
    expect(summary).toBe('Added 2 items.');
    const all = await go(await pdf(3), { items: [image({ allPages: true })] });
    expect(await imagesOn(all.outputs[0].bytes)).toEqual([1, 1, 1]);
  });

  it('writes text sized to its box', async () => {
    const { outputs } = await go(await pdf(1), { items: [text()] });
    expect(await pdfContainsText(outputs[0].bytes, 'Asha Rao')).toBe(true);
  });

  it('fills the form and flattens it, alongside placed items', async () => {
    const { outputs, summary } = await go(named('f.pdf', await formPdfBytes()), {
      values: { name: 'Asha', plan: 'pro' }, items: [image()],
    });
    expect((await load(outputs[0].bytes)).getForm().getFields()).toHaveLength(0);
    expect(summary).toBe('Filled 2 fields and added 1 item, and locked the form.');
  });

  it('keeps the form editable when asked', async () => {
    const { outputs, summary } = await go(named('f.pdf', await formPdfBytes()), { values: { name: 'Asha' }, rest: { flatten: 'no' } });
    expect((await load(outputs[0].bytes)).getForm().getTextField('name').getText()).toBe('Asha');
    expect(summary).toBe('Filled 1 field.');
  });

  it('needs something to do, and rejects bad items and pages', async () => {
    await expect(go(await pdf(1), {})).rejects.toThrow('Add a signature, text or image, or fill in the form.');
    await expect(go(await pdf(1), { items: [image({ page: 3 })] })).rejects.toThrow('Page 3 is out of range');
    await expect(go(await pdf(1), { items: [text({ text: '  ' })] })).rejects.toThrow('A text box on the page is empty.');
    await expect(go(await pdf(1), { items: [text({ text: '署名' })] })).rejects.toThrow(/only use Latin letters/);
    await expect(go(named('f.pdf', await formPdfBytes()), { values: { country: 'Mars' } })).rejects.toThrow(/“country” couldn’t take that value/);
  });

  it('checkItem validates shape and ranges', () => {
    expect(() => checkItem({ ...image(), src: 'data:text/html;base64,AA' })).toThrow(UserError);
    expect(() => checkItem({ ...image(), x: 2 })).toThrow(UserError);
    expect(() => checkItem({ ...text(), color: 'red' })).toThrow(UserError);
    expect(() => checkItem({ ...image(), page: 1.5 })).toThrow(UserError);
    expect(checkItem(text())).toEqual(text());
  });

  it('textPlacement makes the text span the box width', () => {
    const font = { widthOfTextAtSize: (t, size) => t.length * size * 0.5 };
    const at = textPlacement({ x: 0.1, y: 0.2, w: 0.5, text: 'abcd' }, { width: 400, height: 800 }, font);
    expect(at.size).toBe(100); // 4 chars × 0.5 × 100 = 200 pt = 0.5 × 400
    expect(at.x).toBe(40);
    expect(at.y).toBeCloseTo(800 - 160 - 78);
  });

  it('lists the form’s fields with their types, values and options', async () => {
    expect(await listFormFields(named('f.pdf', await formPdfBytes()))).toEqual([
      { name: 'name', readOnly: false, type: 'text', value: '', multiline: false },
      { name: 'agree', readOnly: false, type: 'checkbox', value: false },
      { name: 'country', readOnly: false, type: 'select', value: '', options: ['India', 'Germany'] },
      { name: 'plan', readOnly: false, type: 'radio', value: '', options: ['free', 'pro'] },
    ]);
  });
});

describe('forms setValue', () => {
  it('clears text, radios and dropdowns, and handles option lists', async () => {
    const doc = await PDFDocument.load(await formPdfBytes());
    const form = doc.getForm();
    setValue(form.getTextField('name'), 'x');
    setValue(form.getTextField('name'), '');
    expect(form.getTextField('name').getText()).toBeUndefined();
    setValue(form.getRadioGroup('plan'), 'pro');
    setValue(form.getRadioGroup('plan'), '');
    expect(form.getRadioGroup('plan').getSelected()).toBeUndefined();
    setValue(form.getCheckBox('agree'), 'true');
    expect(form.getCheckBox('agree').isChecked()).toBe(true);
    setValue(form.getCheckBox('agree'), false);
    expect(form.getCheckBox('agree').isChecked()).toBe(false);
    const list = form.createOptionList('tags');
    list.addOptions(['a', 'b']);
    list.addToPage(doc.getPage(0), { x: 200, y: 200, width: 80, height: 40 });
    setValue(list, ['a', '']);
    expect(list.getSelected()).toEqual(['a']);
    setValue(list, '');
    expect(list.getSelected()).toEqual([]);
  });
});

describe('headerfooter', () => {
  it('writes header and footer lines with placeholders filled in', async () => {
    const { outputs } = await run(headerfooter, 'headerfooter', await pdf(2), { header: '{file}', footer: 'Page {n} of {total}', align: 'right' });
    expect(await pdfContainsText(outputs[0].bytes, 'doc')).toBe(true);
    expect(await pdfContainsText(outputs[0].bytes, 'Page 2 of 2')).toBe(true);
    expect(await pageCount(outputs[0].bytes)).toBe(2);
  });

  it('needs some text, in characters the standard font can draw', async () => {
    await expect(run(headerfooter, 'headerfooter', await pdf(1), { header: '', footer: '' })).rejects.toThrow('Add header or footer text.');
    await expect(run(headerfooter, 'headerfooter', await pdf(1), { footer: '日本' })).rejects.toThrow(/only use Latin letters/);
  });

  it('fillPlaceholders', () => {
    expect(fillPlaceholders('{n}/{total} {file} {date} {x}', { n: 3, total: 9, file: 'a', date: 'today' })).toBe('3/9 a today {x}');
  });
});

describe('metadata', () => {
  const withInfo = async () => {
    const d = await PDFDocument.create();
    d.addPage();
    d.setTitle('Old');
    d.setAuthor('Someone');
    d.setProducer('Some app');
    return named('m.pdf', await d.save());
  };

  it('sets the given fields and clears blank ones', async () => {
    const { outputs } = await run(metadata, 'metadata', await withInfo(), { title: 'Q3 report', author: '', keywords: 'finance, q3' });
    const doc = await PDFDocument.load(outputs[0].bytes, { updateMetadata: false });
    expect(doc.getTitle()).toBe('Q3 report');
    expect(doc.getAuthor()).toBeUndefined();
    expect(doc.getKeywords()).toBe('finance q3');
  });

  it('removes every document property', async () => {
    const { outputs, summary } = await run(metadata, 'metadata', await withInfo(), { action: 'strip' });
    const doc = await PDFDocument.load(outputs[0].bytes, { updateMetadata: false });
    expect([doc.getTitle(), doc.getAuthor(), doc.getProducer()]).toEqual([undefined, undefined, undefined]);
    expect(summary).toBe('Removed all document properties.');
  });
});

describe('toimage', () => {
  const rasterize = () => ({
    info: vi.fn(async () => ({ pageCount: 12 })),
    pages: vi.fn(async (_bytes, { pages }) => pages.map((p) => new Uint8Array([p]))),
  });

  it('asks the renderer for the chosen pages and names the images by page', async () => {
    const r = rasterize();
    const { outputs } = await run(toimage, 'toimage', await pdf(1), { ranges: '2, 10', format: 'jpg', dpi: '300', quality: 0.7 }, { rasterize: r });
    expect(r.pages).toHaveBeenCalledWith(expect.any(Uint8Array), { pages: [2, 10], scale: 300 / 72, type: 'image/jpeg', quality: 0.7 });
    expect(outputs.map((o) => o.name)).toEqual(['doc_p02.jpg', 'doc_p10.jpg']);
  });

  it('exports every page as PNG by default', async () => {
    const r = rasterize();
    const { outputs } = await run(toimage, 'toimage', await pdf(1), {}, { rasterize: r });
    expect(outputs).toHaveLength(12);
    expect(outputs[0].name).toBe('doc_p01.png');
  });
});
