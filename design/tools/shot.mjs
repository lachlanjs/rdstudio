import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const names = process.argv.slice(2);
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
fs.mkdirSync(path.join(root, 'shots'), { recursive: true });
for (const n of names) {
  const [name, w = '1440', h = '900'] = n.split(':');
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  page.on('pageerror', (e) => logs.push('ERR ' + e.message));
  await page.goto('file://' + path.join(root, 'harness', name + '.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const fontsOk = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight + ' ' + f.style).join('; '));
  await page.screenshot({ path: path.join(root, 'shots', name + '.png') });
  console.log(name, 'fonts loaded:', fontsOk, logs.length ? 'LOGS ' + logs.join(' | ') : '');
  await page.close();
}
await browser.close();
