// Renders each story to a 1080x1920 30fps MP4 for Instagram.
// Usage: node stories/render.mjs   (needs playwright-core + an ffmpeg binary; set FFMPEG / CHROMIUM if not on PATH)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dir = process.env.STORIES_DIR || path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(dir, process.env.STORY_FILE || 'premium-stories.html')).href + '?export', { waitUntil: 'networkidle' });
await page.addStyleTag({ content: `
  body{padding:0!important} .page{gap:0!important}
  .viewport{width:1080px!important;height:1920px!important;border-radius:0!important;box-shadow:none!important}
  .bars,.tap,.controls,.note{display:none!important}` });
await page.evaluate(() => document.fonts.ready);
const count = await page.evaluate(() => window.__storyCount);
const dur = await page.evaluate(() => window.__storyDur);
const only = process.argv[2] ? Number(process.argv[2]) - 1 : null;

for (let i = 0; i < count; i++) {
  if (only !== null && i !== only) continue;
  const out = path.join(dir, 'export', `${process.env.OUT_PREFIX || 'story'}-${i + 1}.mp4`);
  const ff = spawn(ffmpeg, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'inherit'] });
  const el = await page.$('#viewport');
  for (let f = 0; f < dur * FPS; f++) {
    await page.evaluate(([i, t]) => window.__render(i, t), [i, f / FPS]);
    const buf = await el.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('wrote', out);
}
await browser.close();
