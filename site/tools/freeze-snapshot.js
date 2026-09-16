// Freeze the captured Next.js snapshot into a stable static page.
//
// Why: the pages are a post-hydration DOM snapshot of a Next.js App Router
// site. On a static host (Vercel) the Next.js client runtime boots, then
// requests RSC payloads (…?_rsc=) which the static host answers with plain
// HTML. React can't parse that as RSC, so after the first correct paint the
// app errors out and reverts/blanks. There is also an inline locale script
// that calls window.location.replace on load.
//
// Fix: remove the Next.js bootstrap scripts, the streamed __next_f RSC data,
// and the locale-redirect IIFE — the DOM is already fully rendered. Then force
// every scroll-reveal element visible (JS used to add the --visible class), so
// nothing stays hidden once the JS is gone. CSS animations, <video>, and our
// own vanilla scripts keep working.
const fs = require('fs');
const path = require('path');

const DIST = '/home/user/zoorzio-mainweb/site/dist';

const OVERRIDE = `<style id="zoorzio-freeze">
/* snapshot is frozen (no JS hydration) — force all reveal content visible */
.nh-reveal,.nh-reveal-group .nh-reveal{opacity:1!important;transform:none!important;filter:none!important;animation:none!important}
.nh-top-zone__star{opacity:1!important}
[data-reveal],[data-aos]{opacity:1!important;transform:none!important}
</style>`;

function freeze(html) {
  let s = html;

  // 1) Next.js bootstrap / chunk scripts (with src under _next/static)
  s = s.replace(/<script\b[^>]*\ssrc="[^"]*\/_next\/static\/[^"]*"[^>]*><\/script>/g, '');

  // 2) streamed RSC data + tiny bootstrap pushes
  s = s.replace(/<script>\s*\(self\.__next_f=self\.__next_f\|\|\[\]\)\.push\([\s\S]*?\)<\/script>/g, '');
  s = s.replace(/<script>\s*self\.__next_f\.push\([\s\S]*?\)<\/script>/g, '');

  // 3) the inline locale-redirect IIFE (guard: only scripts that navigate on load)
  s = s.replace(/<script>([\s\S]*?)<\/script>/g, (m, body) => {
    if (/zoorzio: route sign-in/.test(body)) return m;           // keep our CTA script
    if (/location\.replace|storedLanguage|TzList/.test(body)) return ''; // drop redirect
    return m;
  });

  // 4) inject the visibility override at end of <head>
  if (s.includes('</head>')) s = s.replace('</head>', OVERRIDE + '</head>');
  else s = OVERRIDE + s;

  return s;
}

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name === 'portal') continue; walk(p, o); } // portal is its own app
    else o.push(p);
  }
  return o;
}

let n = 0, removedScripts = 0;
for (const f of walk(DIST).filter((f) => f.endsWith('.html'))) {
  const before = fs.readFileSync(f, 'utf8');
  if (before.includes('zoorzio-freeze')) continue;               // idempotent
  // don't freeze the login page (it's our own clean page) or redirect stubs
  if (/\/login\/index\.html$/.test(f)) continue;
  const after = freeze(before);
  if (after !== before) {
    removedScripts += (before.match(/_next\/static/g) || []).length - (after.match(/_next\/static/g) || []).length;
    fs.writeFileSync(f, after, 'utf8');
    n++;
  }
}
console.log(`frozen ${n} pages; removed ~${removedScripts} _next/static script refs`);
