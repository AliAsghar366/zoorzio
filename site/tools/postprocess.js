// 1) Replace Next.js image-optimizer URLs with the real underlying asset paths.
// 2) Find every local asset the pages reference and download whatever is missing.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const DIST = '/home/user/zoorzio-mainweb/site/dist';
const MAIN = 'memorae.ai';
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// ---- pass 1: de-optimize image URLs -------------------------------------
function fixNextImage(text) {
  return text.replace(/[^"'\s(]*_next\/image\/?\?[^"'\s)]*/g, (m) => {
    const q = m.replace(/&amp;/g, '&');
    const mm = /[?&]url=([^&]+)/.exec(q);
    if (!mm) return m;
    try {
      let dec = decodeURIComponent(mm[1]);
      if (dec.startsWith('http')) {
        const u = new URL(dec);
        dec = u.hostname === MAIN ? u.pathname : `/_ext/${u.hostname}${u.pathname}`;
      }
      return dec.startsWith('/') ? dec : m;
    } catch { return m; }
  });
}

const textFiles = walk(DIST).filter((f) => /\.(html|css)$/.test(f));
let rewritten = 0;
for (const f of textFiles) {
  const s = fs.readFileSync(f, 'utf8');
  const out = fixNextImage(s);
  if (out !== s) { fs.writeFileSync(f, out, 'utf8'); rewritten++; }
}
console.log(`pass1: rewrote _next/image refs in ${rewritten} files`);

// ---- pass 2: collect referenced local assets ----------------------------
const refs = new Set();
function collect(text) {
  for (const m of text.matchAll(/(?:src|href|poster|data-src)\s*=\s*"([^"]+)"/g)) refs.add(m[1]);
  for (const m of text.matchAll(/srcset\s*=\s*"([^"]+)"/g))
    for (const part of m[1].split(',')) refs.add(part.trim().split(/\s+/)[0]);
  for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) refs.add(m[1]);
}
for (const f of walk(DIST).filter((f) => /\.(html|css)$/.test(f))) {
  collect(fs.readFileSync(f, 'utf8'));
}

const ASSET_EXT = /\.(webp|png|jpe?g|gif|svg|ico|mp4|webm|woff2?|otf|ttf|css|js|json|avif)$/i;
const missing = [];
for (let r of refs) {
  r = r.replace(/&amp;/g, '&').split('#')[0];
  if (!r.startsWith('/') || r.startsWith('//')) continue;
  const clean = r.split('?')[0];
  if (!ASSET_EXT.test(clean)) continue;
  const abs = path.join(DIST, decodeURIComponent(clean));
  if (!fs.existsSync(abs)) missing.push(clean);
}
const uniqueMissing = [...new Set(missing)];
console.log(`pass2: ${refs.size} refs scanned, ${uniqueMissing.length} missing assets`);

function toRemote(p) {
  const m = /^\/_ext\/([^/]+)(\/.*)?$/.exec(p);
  return m ? `https://${m[1]}${m[2] || '/'}` : `https://${MAIN}${p}`;
}

const THIRD_PARTY_NOISE = /googletagmanager|analytics\.tiktok|config-security|mxpnl|vaudit|google\.com\/ccm|doubleclick|facebook|clarity\.ms/i;

function fetchOne(p) {
  return new Promise((resolve) => {
    const url = toRemote(p);
    if (THIRD_PARTY_NOISE.test(url)) return resolve({ p, skipped: true });
    const abs = path.join(DIST, decodeURIComponent(p));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    execFile('curl', ['-sS', '-L', '--compressed', '--max-time', '120', '-A', UA, '-o', abs, '-w', '%{http_code}', url],
      { maxBuffer: 1 << 24 },
      (err, stdout) => {
        const code = parseInt((stdout || '').trim().slice(-3), 10);
        if (err || code >= 400) { try { fs.unlinkSync(abs); } catch {} return resolve({ p, ok: false, code }); }
        resolve({ p, ok: true, size: fs.statSync(abs).size });
      });
  });
}

(async () => {
  let ok = 0, bad = 0, skip = 0;
  const failures = [];
  for (let i = 0; i < uniqueMissing.length; i += 6) {
    const batch = uniqueMissing.slice(i, i + 6);
    const rs = await Promise.all(batch.map(fetchOne));
    for (const r of rs) {
      if (r.skipped) skip++;
      else if (r.ok) ok++;
      else { bad++; failures.push(`${r.p} (${r.code})`); }
    }
  }
  console.log(`pass2: downloaded ${ok}, third-party skipped ${skip}, failed ${bad}`);
  if (failures.length) {
    console.log('failures:');
    for (const f of failures.slice(0, 25)) console.log('  -', f);
  }
})();
