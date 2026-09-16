// Turn the disk cache + hydrated DOM snapshots into a self-contained static site.
const fs = require('fs');
const path = require('path');

const ROOT = '/home/user/zoorzio-mainweb/site';
const CACHE = path.join(ROOT, 'cache');
const SNAP = path.join(ROOT, 'snapshots');
const DIST = path.join(ROOT, 'dist');
const MAIN = 'memorae.ai';

// Only asset hosts get localized. Namespace URLs (w3.org, react.dev,
// schema.org) must be left alone - rewriting them corrupts SVG creation.
const ASSET_HOSTS = [
  'cdn.memorae.ai', 'static.memorae.ai', 'memorae.ai',
  'fonts.googleapis.com', 'fonts.gstatic.com',
];

function localizeSnapshot(html) {
  let out = html;
  for (const h of ASSET_HOSTS) {
    const local = h === 'memorae.ai' ? '' : `/_ext/${h}`;
    out = out.split(`https://${h}`).join(local);
    out = out.split(`https:\\/\\/${h}`).join(local);
  }
  return out;
}

// analytics/tracking endpoints - noise, and their paths collide as files+dirs
const SKIP_HOSTS = /googletagmanager|google-analytics|analytics\.tiktok|config-security|mxpnl|mixpanel|vaudit|doubleclick|facebook|clarity\.ms|server-side-tagging|\.run\.app|google\.com|gstatic\.com\/recaptcha/i;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

let assets = 0, skipped = 0;
const files = walk(CACHE).filter((f) => !f.endsWith('.meta') && !f.endsWith('_misses.json'));

for (const f of files) {
  const rel = path.relative(CACHE, f);              // <host>/<path...>
  const parts = rel.split(path.sep);
  const host = parts.shift();
  if (SKIP_HOSTS.test(host)) { skipped++; continue; }
  let p = parts.join('/');

  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(f + '.meta', 'utf8')); } catch {}
  const isHtml = (meta.ctype || '').startsWith('text/html');

  // strip the cache's synthetic markers
  let name = path.basename(p);
  let dir = path.dirname(p);
  const isDoc = name.endsWith('.__doc');
  if (isDoc) name = name.slice(0, -'.__doc'.length);

  // drop query/header-variant copies (hash suffix) — keep the canonical one
  const variant = /^(.*)\.[0-9a-f]{12}$/.exec(name);
  if (variant) {
    const canonical = path.join(CACHE, host, dir, variant[1] + (isDoc ? '.__doc' : ''));
    if (fs.existsSync(canonical)) { skipped++; continue; }
    name = variant[1];
  }
  if (name === '__index') name = isDoc ? 'index.html' : 'index';
  else if (isDoc && isHtml) { dir = path.join(dir, name); name = 'index.html'; }

  const outRel = host === MAIN ? path.join(dir, name) : path.join('_ext', host, dir, name);
  const outAbs = path.join(DIST, outRel);
  if (fs.existsSync(outAbs)) { skipped++; continue; }
  try {
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.copyFileSync(f, outAbs);
    assets++;
  } catch { skipped++; }  // path used as both file and directory upstream
}

// hydrated snapshots win over the empty shells
let pages = 0;
for (const f of fs.readdirSync(SNAP).filter((x) => x.endsWith('.html'))) {
  const base = f.slice(0, -5);
  const route = base === 'index' ? '/' : '/' + base.split('__').join('/');
  const outAbs = path.join(DIST, route === '/' ? 'index.html' : path.join(route, 'index.html'));
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, localizeSnapshot(fs.readFileSync(path.join(SNAP, f), 'utf8')), 'utf8');
  pages++;
}

console.log(`pages: ${pages}  assets: ${assets}  skipped-variants: ${skipped}`);
