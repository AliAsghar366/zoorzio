const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8080';
const SNAP = '/home/user/zoorzio-mainweb/site/snapshots';
const CONC = parseInt(process.env.CONC || '3', 10);

// robots.txt disallows /login, /terms, /register, /dashboard, /auth, /payment — excluded.
const ROUTES = [
  '', '/superpower', '/superpower/calendar', '/superpower/daily-briefing',
  '/superpower/memory-everywhere', '/superpower/reminders',
  '/channel/whatsapp', '/channel/telegram', '/channel/email',
  '/channel/app', '/channel/chrome-extension',
  '/security', '/privacy-policy', '/cookies-settings', '/pricing',
];
const LOCALES = ['', '/en', '/es', '/pt', '/fr'];

const PAGES = [];
for (const l of LOCALES) for (const r of ROUTES) PAGES.push((l + r || '/') + (l + r ? '/' : ''));

function snapName(route) {
  const t = route.replace(/^\//, '').replace(/\/$/, '');
  return t === '' ? 'index' : t.replace(/\//g, '__');
}

(async () => {
  fs.mkdirSync(SNAP, { recursive: true });
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--disable-dev-shm-usage', '--no-proxy-server'],
  });

  const results = [];
  const queue = [...PAGES];
  let done = 0;

  async function worker(id) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    });
    while (queue.length) {
      const route = queue.shift();
      const page = await ctx.newPage();
      // serve cross-origin assets from the mirror; the page keeps its original
      // URLs so nothing in the JS is modified (rewriting it breaks hydration)
      await page.route('**/*', async (r) => {
        const u = r.request().url();
        if (u.startsWith('http://127.0.0.1')) return r.continue();
        // Media is captured to disk separately; streaming a 100MB+ body back
        // through CDP kills the browser, and playback isn't needed for a DOM
        // snapshot. Let the element keep its src and skip the transfer.
        if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u)) return r.abort();
        try {
          const x = new URL(u);
          const target = x.hostname === 'memorae.ai'
            ? BASE + x.pathname + x.search
            : `${BASE}/_ext/${x.hostname}${x.pathname}${x.search}`;
          const res = await fetch(target);
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 8 * 1024 * 1024) return r.abort();
          return r.fulfill({
            status: res.status,
            contentType: res.headers.get('content-type') || 'application/octet-stream',
            body: buf,
          });
        } catch { return r.abort(); }
      });
      try {
        await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForTimeout(4000);
        await page.evaluate(async () => {
          const step = Math.floor(window.innerHeight * 0.6);
          for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 300));
          }
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise((r) => setTimeout(r, 900));
          window.scrollTo(0, 0);
          await new Promise((r) => setTimeout(r, 600));
        });
        try { await page.waitForLoadState('networkidle', { timeout: 20000 }); } catch {}
        await page.waitForTimeout(1200);
        const info = await page.evaluate(() => ({
          text: document.body.innerText.trim().length,
          imgs: document.images.length,
          videos: document.querySelectorAll('video').length,
          html: '<!doctype html>\n' + document.documentElement.outerHTML,
        }));
        fs.writeFileSync(path.join(SNAP, snapName(route) + '.html'), info.html, 'utf8');
        results.push({ route, text: info.text, imgs: info.imgs, videos: info.videos });
        console.log(`[${++done}/${PAGES.length}] ${route.padEnd(34)} text=${String(info.text).padEnd(6)} imgs=${String(info.imgs).padEnd(4)} vid=${info.videos}`);
      } catch (e) {
        results.push({ route, error: e.message.slice(0, 160) });
        console.log(`[${++done}/${PAGES.length}] ${route.padEnd(34)} FAIL ${e.message.split('\n')[0].slice(0, 70)}`);
      }
      await page.close();
    }
    await ctx.close();
  }

  await Promise.all(Array.from({ length: CONC }, (_, i) => worker(i)));
  await browser.close();
  fs.writeFileSync(path.join(SNAP, '_pages.json'), JSON.stringify(results, null, 2));
  const ok = results.filter((r) => !r.error && r.text > 0).length;
  console.log(`\ncaptured ${ok}/${PAGES.length} with content`);
})();
