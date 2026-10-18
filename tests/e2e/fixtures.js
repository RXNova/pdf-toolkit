import { readFile } from 'node:fs/promises';
import { test as base, expect } from '@playwright/test';

/**
 * `page` opens the app and, after each test, asserts two invariants:
 *   1. nothing was requested from any origin but the app's own (files never leave the device);
 *   2. no uncaught errors were thrown in the page.
 */
export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL).origin;
    const foreignRequests = [];
    const pageErrors = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (!['blob:', 'data:'].includes(url.protocol) && url.origin !== origin) foreignRequests.push(req.url());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await use(page);

    expect(foreignRequests, 'requests to other origins').toEqual([]);
    expect(pageErrors, 'uncaught page errors').toEqual([]);
  },
});

export { expect };

const MIME = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
const mimeFor = (name) => MIME[name.split('.').pop().toLowerCase()] ?? 'application/octet-stream';

/** Page-object helpers. Files are `{ name, bytes }` built by tests/helpers/fixtures.js. */
export const ui = {
  openTool: (page, title) => page.getByRole('button', { name: `Open ${title}`, exact: true }).click(),

  addFiles: (page, files) =>
    page.getByTestId('file-input').setInputFiles(
      files.map((f) => ({ name: f.name, mimeType: mimeFor(f.name), buffer: Buffer.from(f.bytes) })),
    ),

  /** Drop files onto the drop zone the way the OS would. */
  dropFiles: async (page, files) => {
    const dataTransfer = await page.evaluateHandle((list) => {
      const dt = new DataTransfer();
      for (const { name, data, type } of list) dt.items.add(new File([new Uint8Array(data)], name, { type }));
      return dt;
    }, files.map((f) => ({ name: f.name, data: [...f.bytes], type: mimeFor(f.name) })));
    await page.getByTestId('dropzone').dispatchEvent('drop', { dataTransfer });
  },

  /** Pick an option in a segmented control (a labelled radio group). */
  choose: (page, group, option) =>
    page.getByRole('group', { name: group }).getByRole('radio', { name: option, exact: true }).check(),

  run: (page, title) => page.getByRole('button', { name: title, exact: true }).click(),

  status: (page) => page.locator('.status'),

  /** Click a download link and return the downloaded file. */
  download: async (page, linkName) => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: linkName }).click()]);
    return { name: download.suggestedFilename(), bytes: new Uint8Array(await readFile(await download.path())) };
  },

  backHome: (page) => page.getByRole('button', { name: /All tools/i }).click(),
};
