import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const names = process.argv.slice(2);
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
for (const name of names) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('file://' + path.join(root, 'harness', name + '.html'));
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
  const res = await page.evaluate(() => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return [0,0,0,0]; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
    const over = (f, b) => { const a = f[3]; return [f[0]*a + b[0]*(1-a), f[1]*a + b[1]*(1-a), f[2]*a + b[2]*(1-a), 1]; };
    const lum = (c) => { const f = (v) => { v/=255; return v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4; }; return 0.2126*f(c[0]) + 0.7152*f(c[1]) + 0.0722*f(c[2]); };
    const bgOf = (el) => { const chain = []; for (let e = el; e; e = e.parentElement) chain.push(parse(getComputedStyle(e).backgroundColor)); let b = [255,255,255,1]; for (let i = chain.length - 1; i >= 0; i--) b = over(chain[i], b); return b; };
    const out = []; const seen = new Set();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const n = w.currentNode; if (!n.textContent.trim()) continue; const el = n.parentElement;
      if (el.closest('svg') || el.closest('script') || el.closest('style') || el.closest('.katex-mathml')) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const fg = parse(cs.color); const bg = bgOf(el); const f = over(fg, bg);
      const L1 = lum(f), L2 = lum(bg); const r = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
      const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
      const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
      const key = n.textContent.trim().slice(0,40) + '|' + r.toFixed(2);
      if (r < need && !seen.has(key)) { seen.add(key); out.push(`${r.toFixed(2)} (<${need}) "${n.textContent.trim().slice(0,50)}" ${cs.fontFamily.split(',')[0]} ${size}px`); }
    }
    return out;
  });
  console.log(name, res.length ? '\n  ' + res.join('\n  ') : 'text contrast OK');
  await page.close();
}
await browser.close();
