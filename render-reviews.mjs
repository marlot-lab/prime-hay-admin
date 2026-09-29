// Renders the review stories from stories.html to 1080x1920 30fps H.264 MP4s for Instagram.
// Uses the page's current defaults (English, the seeded review, the Algarve link) and the hay
// photo background; for your own footage or edits, use the Video buttons in stories.html instead.
// Usage: node render-reviews.mjs [storyNumber]
//   needs playwright-core + an ffmpeg binary with libx264; set FFMPEG / CHROMIUM if not on PATH
//   STORY_LANG=pt|nl|es picks another language (default en)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const types = { '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.js': 'text/javascript' };

// Served over http so the canvas can read the logo and hay photos back out
const server = createServer(async (req, res) => {
  try {
    const file = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(dir)) throw new Error('outside');
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(`http://localhost:${port}/stories.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
if (process.env.STORY_LANG) await page.selectOption('#lang', process.env.STORY_LANG);
await page.waitForTimeout(500);

const outDir = path.join(dir, 'export');
await mkdir(outDir, { recursive: true });
const lang = process.env.STORY_LANG || 'en';
const count = await page.evaluate(() => window.__reviewStoryCount());
const only = process.argv[2] ? Number(process.argv[2]) - 1 : null;

for (let i = 0; i < count; i++) {
  if (only !== null && i !== only) continue;
  const seconds = await page.evaluate(i => window.__reviewPrepare(i), i);
  const out = path.join(outDir, `review-story-${lang}-${i + 1}.mp4`);
  const ff = spawn(ffmpeg, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'inherit'] });
  for (let f = 0; f < seconds * FPS; f++) {
    const url = await page.evaluate(t => window.__reviewFrame(t), f / FPS);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('wrote', out);
}
await browser.close();
server.close();
