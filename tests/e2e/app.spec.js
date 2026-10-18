import { TOOL_CATALOG } from '../../src/catalog.js';
import { named, pageCount, pdfBytes } from '../helpers/fixtures.js';
import { CSP } from '../../vite.config.mjs';
import { expect, test, ui } from './fixtures.js';

test.describe('app shell', () => {
  test('lists every tool on the home screen', async ({ page }) => {
    await expect(page).toHaveTitle('PDF Toolkit · Free PDF tools. Your files never leave your device');
    await expect(page.locator('.cell')).toHaveCount(TOOL_CATALOG.length);
    for (const tool of TOOL_CATALOG) await expect(page.getByRole('button', { name: `Open ${tool.title}` })).toBeAttached();
  });

  test('lines up OPEN buttons across each row of the grid', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const tops = await page.locator('.cell .btn').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    for (let i = 0; i < tops.length; i += 3) expect(new Set(tops.slice(i, i + 3)).size).toBe(1);
  });

  test('starts over after downloading, ready for the next file', async ({ page }) => {
    await ui.openTool(page, 'Rotate PDF');
    await ui.addFiles(page, [named('a.pdf', await pdfBytes({ pages: 1 }))]);
    await ui.run(page, 'Rotate PDF');
    await ui.download(page, 'Download a_rotated.pdf');
    await page.getByRole('button', { name: /Start over/ }).click();
    await expect(page.locator('.file')).toHaveCount(0);
    await expect(ui.status(page)).toHaveCount(0);
  });

  test('navigates into a tool and back, showing options conditionally', async ({ page }) => {
    await ui.openTool(page, 'Split PDF');
    await expect(page.getByRole('heading', { name: 'Split PDF' })).toBeVisible();
    await expect(page.getByLabel(/Ranges/)).toBeVisible();
    await ui.choose(page, 'Split mode', 'Every page');
    await expect(page.getByLabel(/Ranges/)).toBeHidden();
    await ui.backHome(page);
    await expect(page.locator('.cell')).toHaveCount(TOOL_CATALOG.length);
  });

  test('fits a phone-sized screen without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await ui.openTool(page, 'Merge PDF');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test('filters by category, searches, and remembers grid/list', async ({ page }) => {
    const security = TOOL_CATALOG.filter((t) => t.category === 'security').length;
    await page.getByRole('button', { name: `Security ${security}` }).click();
    await expect(page.locator('.cell')).toHaveCount(security);
    await page.getByRole('button', { name: `All ${TOOL_CATALOG.length}` }).click();
    await page.getByRole('searchbox', { name: 'Search tools' }).fill('watermark');
    await expect(page.locator('.cell')).toHaveCount(1);
    await page.getByRole('searchbox', { name: 'Search tools' }).fill('');
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.locator('.row')).toHaveCount(TOOL_CATALOG.length);
    await page.reload();
    await expect(page.locator('.row')).toHaveCount(TOOL_CATALOG.length);
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(18, 19, 22)');
    await page.getByRole('button', { name: 'Light', exact: true }).click();
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(242, 241, 238)');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('uses the bundled craft-launcher fonts and ships a favicon', async ({ page, request }) => {
    await page.evaluate(() => document.fonts.ready);
    for (const family of ['Inter Variable', 'Archivo Variable', 'Geist Mono Variable']) {
      expect(await page.evaluate((f) => document.fonts.check(`16px "${f}"`), family), family).toBe(true);
    }
    expect(await page.locator('.app-name').first().evaluate((e) => getComputedStyle(e).fontStretch)).toBe('118%');
    const icon = await page.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute('href');
    expect((await request.get(icon)).headers()['content-type']).toContain('svg');
  });

  test('lets keyboard users skip to the content', async ({ page, browserName }) => {
    // Safari only tabs to links with Option+Tab unless the user changes a system setting.
    await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });
});

test.describe('privacy and security', () => {
  test('has search and social metadata that says files stay on the device', async ({ page, request }) => {
    const meta = (sel) => page.locator(sel).getAttribute('content');
    expect(await meta('meta[name="description"]')).toContain('never leave your device');
    expect(await meta('meta[property="og:title"]')).toContain('never leave your device');
    expect(await meta('meta[property="og:image"]')).toBe('https://pdfkit.rxnova.dev/og-image.png');
    expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://pdfkit.rxnova.dev/');
    const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    expect(ld['@type']).toBe('WebApplication');
    expect(ld.featureList).toHaveLength(TOOL_CATALOG.length + 1);
    for (const path of ['og-image.png', 'apple-touch-icon.png', 'icon-512.png', 'site.webmanifest', 'robots.txt', 'sitemap.xml']) {
      expect((await request.get(path)).ok(), path).toBe(true);
    }
  });

  test('ships the strict Content-Security-Policy', async ({ page }) => {
    test.skip(process.env.E2E_TARGET === 'dev', 'the CSP is only added to production builds');
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', CSP);
  });

  test('processes files with the network switched off', async ({ page, context }) => {
    // Load the worker first (as a returning visitor would have), then go offline.
    await ui.openTool(page, 'Merge PDF');
    await ui.addFiles(page, [named('a.pdf', await pdfBytes({ pages: 1 })), named('b.pdf', await pdfBytes({ pages: 1 }))]);
    await ui.run(page, 'Merge PDF');
    await expect(ui.status(page)).toHaveClass(/ok/);

    await context.setOffline(true);
    await ui.addFiles(page, [named('c.pdf', await pdfBytes({ pages: 2 }))]);
    await ui.run(page, 'Merge PDF');
    const out = await ui.download(page, /Download a_merged\.pdf/);
    expect(await pageCount(out.bytes)).toBe(4);
  });
});
