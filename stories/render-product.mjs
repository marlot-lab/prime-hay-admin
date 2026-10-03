// Renders the six 1080x1080 Meadow Hay product images to export/meadow-product-1…6.png.
// Usage: node stories/render-product.mjs   (needs playwright-core; set CHROMIUM if not on PATH)
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dir = process.env.STORIES_DIR || path.dirname(fileURLToPath(import.meta.url));
const out = process.env.OUT || path.join(dir, 'export');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(dir, 'meadow-product.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
for (let i = 1; i <= 6; i++) {
  await page.locator('#p' + i).screenshot({ path: path.join(out, `meadow-product-${i}.png`) });
}
await browser.close();
