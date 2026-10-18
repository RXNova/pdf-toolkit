import { unzipSync } from 'fflate';
import { PDFName, PDFRawStream } from 'pdf-lib';
import { PDFDocument, PDFName as Name } from 'pdf-lib';
import {
  formPdfBytes, jpgBytes, named, pageCount, pageLabels, pdfBytes, pdfContainsText, pdfWithImage, pngBytes, readPdf,
} from '../helpers/fixtures.js';
import { expect, test, ui } from './fixtures.js';

/** Open a tool, add files, configure it, run it, wait for success. */
async function runTool(page, { title, files, configure }) {
  await ui.openTool(page, title);
  await ui.addFiles(page, files);
  await expect(page.locator('.file')).toHaveCount(files.length);
  await configure?.(page);
  await ui.run(page, title);
  await expect(ui.status(page)).toHaveClass(/ok/, { timeout: 30_000 });
}

test.describe('every tool, end to end', () => {
  test('Merge PDF combines files in the chosen order', async ({ page }) => {
    await runTool(page, {
      title: 'Merge PDF',
      files: [named('a.pdf', await pdfBytes({ pages: 2 })), named('b.pdf', await pdfBytes({ pages: 1 }))],
      configure: (p) => p.getByLabel('Move b.pdf left').click(),
    });
    const out = await ui.download(page, /Download b_merged\.pdf/);
    expect(out.name).toBe('b_merged.pdf');
    expect(await pageLabels(out.bytes)).toEqual([1, 1, 2]);
  });

  test('Split PDF downloads all parts as a zip, or one at a time', async ({ page }) => {
    await runTool(page, {
      title: 'Split PDF',
      files: [named('doc.pdf', await pdfBytes({ pages: 4 }))],
      configure: (p) => p.getByLabel(/Ranges/).fill('1-2, 3-'),
    });
    await expect(ui.status(page)).toContainText('Created 2 files');

    const zip = await ui.download(page, 'Download all doc_split.zip');
    expect(zip.name).toBe('doc_split.zip');
    const entries = unzipSync(zip.bytes);
    expect(Object.keys(entries)).toEqual(['doc_p1-2.pdf', 'doc_p3-4.pdf']);
    expect(await pageLabels(entries['doc_p3-4.pdf'])).toEqual([3, 4]);

    const single = await ui.download(page, 'Download doc_p1-2.pdf');
    expect(await pageLabels(single.bytes)).toEqual([1, 2]);
  });

  test('Split PDF can split every page', async ({ page }) => {
    await runTool(page, {
      title: 'Split PDF',
      files: [named('doc.pdf', await pdfBytes({ pages: 3 }))],
      configure: (p) => ui.choose(p, 'Split mode', 'Every page'),
    });
    expect(Object.keys(unzipSync((await ui.download(page, /^Download all/)).bytes))).toHaveLength(3);
  });

  test('Extract pages keeps the selected pages', async ({ page }) => {
    await runTool(page, {
      title: 'Extract pages',
      files: [named('doc.pdf', await pdfBytes({ pages: 5 }))],
      configure: (p) => p.getByLabel('Pages to keep').fill('5, 2'),
    });
    expect(await pageLabels((await ui.download(page, /Download doc_extracted\.pdf/)).bytes)).toEqual([5, 2]);
  });

  test('Remove pages drops the selected pages', async ({ page }) => {
    await runTool(page, {
      title: 'Remove pages',
      files: [named('doc.pdf', await pdfBytes({ pages: 4 }))],
      configure: (p) => p.getByLabel('Pages to remove').fill('1, 3'),
    });
    expect(await pageLabels((await ui.download(page, /Download doc_trimmed\.pdf/)).bytes)).toEqual([2, 4]);
  });

  test('Organize pages reorders pages', async ({ page }) => {
    await runTool(page, {
      title: 'Organize pages',
      files: [named('doc.pdf', await pdfBytes({ pages: 3 }))],
      configure: (p) => p.getByLabel('New page order').fill('3-1'),
    });
    expect(await pageLabels((await ui.download(page, /Download doc_reordered\.pdf/)).bytes)).toEqual([3, 2, 1]);
  });

  test('Rotate PDF rotates only the chosen pages', async ({ page }) => {
    await runTool(page, {
      title: 'Rotate PDF',
      files: [named('doc.pdf', await pdfBytes({ pages: 3 }))],
      configure: async (p) => {
        await ui.choose(p, 'Rotation', '90° left');
        await p.getByLabel(/Pages/).fill('2-3');
      },
    });
    const doc = await readPdf((await ui.download(page, /Download doc_rotated\.pdf/)).bytes);
    expect(doc.getPages().map((pg) => pg.getRotation().angle)).toEqual([0, 270, 270]);
  });

  test('Compress PDF re-encodes images with the browser’s JPEG encoder', async ({ page }) => {
    const src = named('scan.pdf', await pdfWithImage(pngBytes(900, 700, { noise: true })));
    await runTool(page, {
      title: 'Compress PDF',
      files: [src],
      configure: (p) => ui.choose(p, 'Compression', 'Strong'),
    });
    await expect(ui.status(page)).toContainText(/MB → .* \(\d+% smaller\)/);

    const out = await ui.download(page, /Download scan_compressed\.pdf/);
    expect(out.bytes.length).toBeLessThan(src.bytes.length * 0.7);
    const doc = await readPdf(out.bytes);
    const images = [...doc.context.enumerateIndirectObjects()]
      .map(([, o]) => o)
      .filter((o) => o instanceof PDFRawStream && o.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'));
    expect(images).toHaveLength(1);
    expect(images[0].dict.get(PDFName.of('Filter'))).toBe(PDFName.of('DCTDecode'));
    expect([...images[0].contents.slice(0, 2)]).toEqual([0xff, 0xd8]); // a real JPEG
  });

  test('Compress PDF keeps text-only PDFs unchanged', async ({ page }) => {
    const src = named('text.pdf', await pdfBytes({ pages: 2 }));
    await runTool(page, { title: 'Compress PDF', files: [src] });
    await expect(ui.status(page)).toContainText('the original was kept');
    expect((await ui.download(page, /Download text_compressed\.pdf/)).bytes).toEqual(src.bytes);
  });

  test('JPG / PNG to PDF makes one page per image', async ({ page }) => {
    await runTool(page, {
      title: 'JPG / PNG to PDF',
      files: [named('a.png', pngBytes(60, 30)), named('b.jpg', jpgBytes())],
      configure: (p) => ui.choose(p, 'Page size', 'US Letter'),
    });
    const doc = await readPdf((await ui.download(page, /Download a_images\.pdf/)).bytes);
    expect(doc.getPages().map((pg) => pg.getSize())).toEqual([{ width: 792, height: 612 }, { width: 612, height: 792 }]);
  });

  test('Add watermark stamps the text', async ({ page }) => {
    await runTool(page, {
      title: 'Add watermark',
      files: [named('doc.pdf', await pdfBytes({ pages: 2 }))],
      configure: (p) => p.getByLabel('Text').fill('E2E MARK'),
    });
    expect(await pdfContainsText((await ui.download(page, /Download doc_watermarked\.pdf/)).bytes, 'E2E MARK')).toBe(true);
  });

  test('Page numbers labels every page', async ({ page }) => {
    await runTool(page, {
      title: 'Page numbers',
      files: [named('doc.pdf', await pdfBytes({ pages: 2 }))],
      configure: async (p) => {
        await p.getByLabel('Format').fill('Seite {n}');
        await p.getByLabel('First number').fill('10');
      },
    });
    const out = (await ui.download(page, /Download doc_numbered\.pdf/)).bytes;
    expect(await pdfContainsText(out, 'Seite 10')).toBe(true);
    expect(await pdfContainsText(out, 'Seite 11')).toBe(true);
  });

  test('Protect and Unlock round-trip a password with qpdf WebAssembly', async ({ page }) => {
    await runTool(page, {
      title: 'Protect PDF',
      files: [named('doc.pdf', await pdfBytes({ pages: 2 }))],
      configure: async (p) => {
        await p.getByLabel('Password', { exact: true }).fill('hunter2');
        await p.getByLabel('Confirm password').fill('hunter2');
      },
    });
    const locked = await ui.download(page, /Download doc_protected\.pdf/);
    await expect(readPdf(locked.bytes)).rejects.toThrow(/encrypted/);

    await ui.backHome(page);
    await ui.openTool(page, 'Unlock PDF');
    await ui.addFiles(page, [locked]);
    await page.getByLabel('Current password').fill('wrong');
    await ui.run(page, 'Unlock PDF');
    await expect(page.getByRole('alert')).toHaveText('Wrong password.');

    await page.getByLabel('Current password').fill('hunter2');
    await ui.run(page, 'Unlock PDF');
    const unlocked = await ui.download(page, /Download doc_protected_unlocked\.pdf/);
    expect(await pageCount(unlocked.bytes)).toBe(2);
  });
});

test.describe('new tools, end to end', () => {
  const imagesOn = async (bytes) => {
    const doc = await PDFDocument.load(bytes);
    return doc.getPages().map((p) => p.node.Resources().lookup(Name.of('XObject'))?.keys().length ?? 0);
  };

  test('PDF to JPG / PNG saves the picked pages as images', async ({ page }) => {
    await runTool(page, {
      title: 'PDF to JPG / PNG',
      files: [named('doc.pdf', await pdfBytes({ pages: 4 }))],
      configure: async (p) => {
        await p.getByRole('button', { name: 'Keep page 2' }).click();
        await p.getByRole('button', { name: 'Keep page 4' }).click();
      },
    });
    const zip = unzipSync((await ui.download(page, /^Download all/)).bytes);
    expect(Object.keys(zip)).toEqual(['doc_p2.png', 'doc_p4.png']);
    expect([...zip['doc_p2.png'].slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]); // PNG signature
  });

  test('PDF to JPG exports one JPEG when one page is picked', async ({ page }) => {
    await runTool(page, {
      title: 'PDF to JPG / PNG',
      files: [named('doc.pdf', await pdfBytes({ pages: 3 }))],
      configure: async (p) => {
        await p.getByRole('button', { name: 'Keep page 3' }).click();
        await ui.choose(p, 'Format', 'JPG');
      },
    });
    const img = await ui.download(page, /Download doc_p3\.jpg/);
    expect([...img.bytes.slice(0, 2)]).toEqual([0xff, 0xd8]); // JPEG signature
  });

  test('Fill & sign: draw a signature, add a date and a logo on chosen pages, drag them', async ({ page }) => {
    await runTool(page, {
      title: 'Fill & sign',
      files: [named('doc.pdf', await pdfBytes({ pages: 3 }))],
      configure: async (p) => {
        await p.locator('.viewer + .pager button').last().click(); // page 2
        await p.getByRole('button', { name: 'Signature' }).click();
        const c = await p.locator('.sig-canvas').boundingBox();
        await p.mouse.move(c.x + 20, c.y + 40);
        await p.mouse.down();
        for (let i = 1; i <= 12; i++) await p.mouse.move(c.x + 20 + i * 15, c.y + 40 + (i % 2) * 30);
        await p.mouse.up();
        await p.getByRole('button', { name: 'Place on page 2' }).click();
        await p.getByRole('button', { name: 'Date' }).click();
        await p.getByTestId('image-input').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(pngBytes(60, 30)) });
        await expect(p.locator('.placement')).toHaveCount(3);
        await p.getByRole('button', { name: 'Repeat logo.png on every page' }).click();
        const box = await p.locator('.placement').first().boundingBox();
        await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await p.mouse.down();
        await p.mouse.move(box.x - 80, box.y - 150, { steps: 5 });
        await p.mouse.up();
      },
    });
    const out = (await ui.download(page, /Download doc_signed\.pdf/)).bytes;
    expect(await imagesOn(out)).toEqual([1, 2, 1]); // logo everywhere, signature on page 2
  });

  test('Fill & sign: type a signature and write text', async ({ page }) => {
    await ui.openTool(page, 'Fill & sign');
    await ui.addFiles(page, [named('doc.pdf', await pdfBytes({ pages: 1 }))]);
    await page.getByRole('button', { name: 'Signature' }).click();
    await page.getByRole('group', { name: 'Signature mode' }).getByRole('button', { name: 'Type' }).click();
    await page.getByRole('textbox', { name: 'Type your name' }).fill('Asha Rao');
    await page.getByRole('button', { name: 'Place on page 1' }).click();
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Text', exact: true }).fill('APPROVED');
    await ui.run(page, 'Fill & sign');
    await expect(ui.status(page)).toHaveClass(/ok/);
    const out = (await ui.download(page, /Download doc_signed\.pdf/)).bytes;
    expect(await pdfContainsText(out, 'APPROVED')).toBe(true);
    expect(await imagesOn(out)).toEqual([1]);
  });

  test('Fill & sign: fill form fields and keep them editable', async ({ page }) => {
    await runTool(page, {
      title: 'Fill & sign',
      files: [named('form.pdf', await formPdfBytes())],
      configure: async (p) => {
        await p.getByRole('textbox', { name: 'name' }).fill('Asha Rao');
        await p.getByRole('combobox', { name: 'plan' }).selectOption('pro');
        await expect(p.locator('.preview-badge')).toHaveText('Live preview');
        await ui.choose(p, 'After filling', 'Keep editable');
      },
    });
    const form = (await readPdf((await ui.download(page, /Download form_signed\.pdf/)).bytes)).getForm();
    expect(form.getTextField('name').getText()).toBe('Asha Rao');
    expect(form.getRadioGroup('plan').getSelected()).toBe('pro');
  });

  test('Crop & resize trims margins and changes page size', async ({ page }) => {
    await runTool(page, {
      title: 'Crop & resize',
      files: [named('doc.pdf', await pdfBytes({ pages: 1, size: [300, 400] }))],
      configure: async (p) => {
        for (const side of ['Top', 'Bottom', 'Left', 'Right']) await p.getByLabel(`${side} (mm)`).fill('0');
        await p.getByLabel('Top (mm)').fill('25.4'); // one inch = 72 pt
      },
    });
    const trimmed = await readPdf((await ui.download(page, /Download doc_cropped\.pdf/)).bytes);
    expect(trimmed.getPage(0).getCropBox().height).toBeCloseTo(400 - 72);

    await ui.backHome(page);
    await runTool(page, {
      title: 'Crop & resize',
      files: [named('doc.pdf', await pdfBytes({ pages: 1, size: [300, 400] }))],
      configure: (p) => ui.choose(p, 'Mode', 'Change page size'),
    });
    const resized = await readPdf((await ui.download(page, /Download doc_cropped\.pdf/)).bytes);
    expect(resized.getPage(0).getSize().width).toBeCloseTo(595.28);
  });

  test('Header & footer writes the lines with placeholders filled in', async ({ page }) => {
    await runTool(page, {
      title: 'Header & footer',
      files: [named('report.pdf', await pdfBytes({ pages: 2 }))],
      configure: (p) => p.getByRole('textbox', { name: 'Header' }).fill('File {file}'),
    });
    const out = (await ui.download(page, /Download report_header\.pdf/)).bytes;
    expect(await pdfContainsText(out, 'File report')).toBe(true);
    expect(await pdfContainsText(out, 'Page 2 of 2')).toBe(true);
  });

  test('Edit metadata sets the title, or removes everything', async ({ page }) => {
    await runTool(page, {
      title: 'Edit metadata',
      files: [named('doc.pdf', await pdfBytes({ pages: 1 }))],
      configure: (p) => p.getByRole('textbox', { name: 'Title' }).fill('Service contract'),
    });
    const doc = await PDFDocument.load((await ui.download(page, /Download doc_metadata\.pdf/)).bytes, { updateMetadata: false });
    expect(doc.getTitle()).toBe('Service contract');
  });
});

test.describe('user flows', () => {
  test('picks pages to keep and to remove by clicking them', async ({ page }) => {
    const doc = named('doc.pdf', await pdfBytes({ pages: 6 }));
    await runTool(page, {
      title: 'Extract pages',
      files: [doc],
      configure: async (p) => {
        await p.getByRole('button', { name: 'Keep page 2' }).click();
        await p.getByRole('button', { name: 'Keep page 4' }).click({ modifiers: ['Shift'] });
        await p.getByRole('button', { name: 'Keep page 6' }).click();
        await expect(p.getByLabel('Pages to keep')).toHaveValue('2-4, 6');
      },
    });
    expect(await pageLabels((await ui.download(page, /Download doc_extracted\.pdf/)).bytes)).toEqual([2, 3, 4, 6]);

    await ui.backHome(page);
    await runTool(page, {
      title: 'Remove pages',
      files: [doc],
      configure: async (p) => {
        await p.getByRole('button', { name: 'Remove page 1' }).click();
        await p.getByRole('button', { name: 'Remove page 5' }).click();
      },
    });
    expect(await pageLabels((await ui.download(page, /Download doc_trimmed\.pdf/)).bytes)).toEqual([2, 3, 4, 6]);
  });

  test('groups pages into split files by dragging, and resizes groups by their handles', async ({ page }) => {
    const center = async (n) => {
      const r = await page.locator(`.split [data-page="${n}"]`).boundingBox();
      return [r.x + r.width / 2, r.y + r.height / 3];
    };
    const dragFrom = async ([x1, y1], to) => {
      const [x2, y2] = await center(to);
      await page.mouse.move(x1, y1);
      await page.mouse.down();
      await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 });
      await page.mouse.move(x2, y2, { steps: 4 });
      await page.mouse.up();
    };
    await runTool(page, {
      title: 'Split PDF',
      files: [named('doc.pdf', await pdfBytes({ pages: 6 }))],
      configure: async (p) => {
        await dragFrom(await center(1), 2);
        await dragFrom(await center(4), 6);
        const handle = await p.locator('.split [data-page="2"] .split-handle.end').boundingBox();
        await dragFrom([handle.x + handle.width / 2, handle.y + handle.height / 2], 3);
        await expect(p.getByLabel(/Ranges/)).toHaveValue('1-3, 4-6');
        await expect(p.getByRole('list', { name: 'Files', exact: true }).getByRole('listitem')).toHaveText(['File 1 · 1–3', 'File 2 · 4–6']);
      },
    });
    const zip = unzipSync((await ui.download(page, /^Download all/)).bytes);
    expect(Object.keys(zip)).toEqual(['doc_p1-3.pdf', 'doc_p4-6.pdf']);
    expect(await pageLabels(zip['doc_p4-6.pdf'])).toEqual([4, 5, 6]);
  });

  test('arranges pages by dragging, copying and dropping them', async ({ page }) => {
    await runTool(page, {
      title: 'Organize pages',
      files: [named('doc.pdf', await pdfBytes({ pages: 4 }))],
      configure: async (p) => {
        const pages = p.locator('.arrange .page');
        await pages.nth(3).dragTo(pages.nth(0)); // 4, 1, 2, 3
        await p.getByRole('button', { name: 'Copy page 1' }).click(); // 4, 1, 1, 2, 3
        await p.getByRole('button', { name: 'Drop page 3' }).click(); // 4, 1, 1, 2
        await expect(p.getByLabel(/New page order/)).toHaveValue('4, 1, 1-2');
      },
    });
    expect(await pageLabels((await ui.download(page, /Download doc_reordered\.pdf/)).bytes)).toEqual([4, 1, 1, 2]);
  });

  test('live-previews a tiled watermark behind the content, then downloads it', async ({ page }) => {
    await ui.openTool(page, 'Add watermark');
    await ui.addFiles(page, [named('doc.pdf', await pdfBytes({ pages: 2 }))]);
    await ui.choose(page, 'Pattern', 'Tiled');
    await ui.choose(page, 'Layer', 'Behind content');
    await page.getByLabel('Text').fill('TILED');
    await expect(page.locator('.preview-badge')).toHaveText('Live preview');
    await expect(page.getByRole('img', { name: 'Page 1 of doc_watermarked.pdf' })).toBeVisible();
    await ui.run(page, 'Add watermark');
    await expect(ui.status(page)).toHaveClass(/ok/);
    const out = await ui.download(page, /Download doc_watermarked\.pdf/);
    expect(await pdfContainsText(out.bytes, 'TILED')).toBe(true);
    expect(await pageLabels(out.bytes)).toEqual([1, 2]);
  });

  test('previews the result after running, and switches back to the original', async ({ page }) => {
    await runTool(page, {
      title: 'Add watermark',
      files: [named('doc.pdf', await pdfBytes({ pages: 2 }))],
      configure: async (p) => {
        await p.getByLabel('Opacity').fill('0.5');
        await expect(p.getByText('50%')).toBeVisible();
      },
    });
    await expect(page.getByRole('img', { name: 'Page 1 of doc_watermarked.pdf' })).toBeVisible();
    await page.getByRole('group', { name: 'Preview' }).getByRole('button', { name: 'Original' }).click();
    await expect(page.getByRole('img', { name: 'Page 1 of doc.pdf' })).toBeVisible();
  });

  test('previews the picked file or page under the options', async ({ page }) => {
    await ui.openTool(page, 'Merge PDF');
    await ui.addFiles(page, [named('a.pdf', await pdfBytes({ pages: 2 })), named('b.pdf', await pdfBytes({ pages: 3 }))]);
    const preview = page.getByRole('region', { name: 'Preview' });
    await expect(preview.locator('.pager-count')).toHaveText('1 / 2');
    await page.locator('.file').nth(1).locator('.meta').click();
    await expect(preview.locator('.pager-count')).toHaveText('1 / 3');
    await expect(preview.getByRole('img', { name: 'Page 1 of b.pdf' })).toBeVisible();

    await ui.backHome(page);
    await ui.openTool(page, 'Split PDF');
    await ui.addFiles(page, [named('doc.pdf', await pdfBytes({ pages: 5 }))]);
    await page.getByRole('button', { name: 'Show page 3' }).click();
    await expect(preview.locator('.pager-count')).toHaveText('3 / 5');
    await preview.getByLabel('Next page of doc.pdf').click();
    await expect(page.locator('.page.focused .page-num')).toHaveText('4');
  });

  test('shows every page of the file in page tools, and one big page elsewhere', async ({ page }) => {
    const doc = named('doc.pdf', await pdfBytes({ pages: 4 }));
    await ui.openTool(page, 'Remove pages');
    await ui.addFiles(page, [doc]);
    const pages = page.getByRole('list', { name: 'Pages of doc.pdf' });
    await expect(pages.getByRole('listitem')).toHaveText(['1', '2', '3', '4']);
    await expect.poll(() => pages.locator('canvas').first().evaluate((c) => c.width)).toBeGreaterThan(100);

    await ui.backHome(page);
    await ui.openTool(page, 'Rotate PDF');
    await ui.addFiles(page, [doc]);
    await expect(page.locator('.pager-count')).toHaveText('1 / 4');
    await page.getByLabel('Next page of doc.pdf').click();
    await expect(page.getByRole('img', { name: 'Page 2 of doc.pdf' })).toBeVisible();
  });

  test('continues from Split into Merge with every part, and into Rotate with the part you pick', async ({ page }) => {
    await runTool(page, {
      title: 'Split PDF',
      files: [named('doc.pdf', await pdfBytes({ pages: 4 }))],
      configure: (p) => p.getByLabel(/Ranges/).fill('1-2, 3-4'),
    });
    await page.getByRole('button', { name: /Continue with…/ }).click();
    await page.getByRole('button', { name: 'Continue with Merge PDF' }).click();
    await expect(page.locator('#tool-title')).toHaveText('Merge PDF');
    await expect(page.locator('.file .fname')).toHaveText(['doc_p1-2.pdf', 'doc_p3-4.pdf']);
    await page.getByLabel('Move doc_p3-4.pdf left').click();
    await ui.run(page, 'Merge PDF');
    await expect(ui.status(page)).toHaveClass(/ok/);
    const merged = await ui.download(page, /Download doc_p3-4_merged\.pdf/);
    expect(await pageLabels(merged.bytes)).toEqual([3, 4, 1, 2]);

    await page.getByRole('button', { name: /Continue with…/ }).click();
    await page.getByRole('button', { name: 'Continue with Split PDF' }).click();
    await expect(page.locator('#tool-title')).toHaveText('Split PDF');
    await page.getByRole('radio', { name: 'Every page' }).check();
    await ui.run(page, 'Split PDF');
    await expect(ui.status(page)).toHaveClass(/ok/);
    await page.getByRole('button', { name: /Continue with…/ }).click();
    await page.getByRole('button', { name: 'Continue with Rotate PDF' }).click();
    await expect(page.getByText('Rotate PDF takes one file. Which one?')).toBeVisible();
    await page.getByRole('button', { name: /doc_p3-4_merged_p2\.pdf/ }).click();
    await expect(page.locator('#tool-title')).toHaveText('Rotate PDF');
    await expect(page.locator('.file .fname')).toHaveText(['doc_p3-4_merged_p2.pdf']);
  });

  test('switches tools with the loaded files before running anything', async ({ page }) => {
    await ui.openTool(page, 'Merge PDF');
    await ui.addFiles(page, [named('a.pdf', await pdfBytes({ pages: 2 })), named('b.pdf', await pdfBytes({ pages: 3 }))]);
    await page.getByRole('button', { name: /Switch tool/ }).click();
    await page.getByRole('button', { name: 'Switch to Remove pages' }).click();
    const picker = page.getByRole('group', { name: 'Choose a file for Remove pages' });
    await expect(picker.getByText('Remove pages takes one file. Which one?')).toBeVisible();
    await picker.getByRole('button', { name: /b\.pdf/ }).click();
    await expect(page.locator('#tool-title')).toHaveText('Remove pages');
    await expect(page.locator('.file .fname')).toHaveText(['b.pdf']);
    await page.getByRole('button', { name: 'Remove page 3' }).click();
    await ui.run(page, 'Remove pages');
    await expect(ui.status(page)).toHaveClass(/ok/);
    expect(await pageLabels((await ui.download(page, /Download b_trimmed\.pdf/)).bytes)).toEqual([1, 2]);
  });

  test('previews each PDF page by page, and switches to rows', async ({ page }) => {
    await ui.openTool(page, 'Merge PDF');
    await ui.addFiles(page, [named('a.pdf', await pdfBytes({ pages: 3 })), named('b.pdf', await pdfBytes({ pages: 1 }))]);
    const card = page.locator('.file').first();
    await expect(card.locator('.pager-count')).toHaveText('1 / 3');
    await expect(page.locator('.file').nth(1).locator('.pager-count')).toHaveText('1 / 1');

    // pdf.js really drew the page: the canvas has the page size and isn't blank.
    const drawn = () => card.locator('canvas').evaluate((c) => {
      const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let dark = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i] < 128) dark++;
      return { portrait: c.height > c.width, dark };
    });
    await expect.poll(async () => (await drawn()).dark).toBeGreaterThan(0);
    expect((await drawn()).portrait).toBe(true);

    await card.getByLabel('Next page of a.pdf').click();
    await expect(card.locator('.pager-count')).toHaveText('2 / 3');
    await expect(card.getByLabel('Previous page of a.pdf')).toBeEnabled();

    await page.getByRole('group', { name: 'File view' }).getByRole('button', { name: 'List' }).click();
    await expect(page.locator('.files .pager-count')).toHaveCount(0);
    await expect(page.getByLabel('Move b.pdf up')).toBeVisible();
  });

  test('accepts files dropped onto the page', async ({ page }) => {
    await ui.openTool(page, 'Merge PDF');
    await ui.dropFiles(page, [named('x.pdf', await pdfBytes({ pages: 1 })), named('notes.txt', new Uint8Array([1]))]);
    await expect(page.locator('.file')).toHaveCount(1);
    await expect(page.getByRole('alert')).toHaveText('Skipped files that aren’t PDF.');
  });

  test('shows validation errors from the core', async ({ page }) => {
    await ui.openTool(page, 'Remove pages');
    await ui.addFiles(page, [named('doc.pdf', await pdfBytes({ pages: 2 }))]);

    await expect(page.getByRole('button', { name: 'Remove pages', exact: true })).toBeDisabled();
    await expect(page.getByText('Click the pages to remove, or type them above.')).toBeVisible();

    await page.getByLabel('Pages to remove').fill('1-2');
    await ui.run(page, 'Remove pages');
    await expect(page.getByRole('alert')).toHaveText('That would remove every page.');

    await page.getByLabel('Pages to remove').fill('7');
    await ui.run(page, 'Remove pages');
    await expect(page.getByRole('alert')).toContainText('Page 7 is out of range');
  });

  test('reports a corrupt input file', async ({ page }) => {
    await ui.openTool(page, 'Rotate PDF');
    await ui.addFiles(page, [named('broken.pdf', new TextEncoder().encode('not a pdf'))]);
    await ui.run(page, 'Rotate PDF');
    await expect(page.getByRole('alert')).toHaveText('broken.pdf is not a valid PDF.');
  });

  test('points password-protected files at Unlock', async ({ page }) => {
    await runTool(page, {
      title: 'Protect PDF',
      files: [named('doc.pdf', await pdfBytes())],
      configure: async (p) => {
        await p.getByLabel('Password', { exact: true }).fill('pw');
        await p.getByLabel('Confirm password').fill('pw');
      },
    });
    const locked = await ui.download(page, /Download doc_protected\.pdf/);
    await ui.backHome(page);
    await ui.openTool(page, 'Rotate PDF');
    await ui.addFiles(page, [locked]);
    await ui.run(page, 'Rotate PDF');
    await expect(page.getByRole('alert')).toContainText('is password-protected. Use “Unlock PDF” first.');
  });
});
