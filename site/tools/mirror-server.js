// Caching mirror server.
// Serves memorae.ai from a local disk cache; on a miss it fetches the real
// resource through the agent proxy (via curl, which is proxy-aware), rewrites
// absolute URLs to local paths, stores it, and serves it.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const CACHE = process.env.CACHE_DIR || '/home/user/zoorzio-mainweb/site/cache';
const PORT = parseInt(process.env.PORT || '8080', 10);
const MAIN = 'memorae.ai';
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const TEXT = /^(text\/|application\/(javascript|json|xml|manifest)|application\/x-javascript)/;
const missLog = [];

function keyFor(host, urlPath, search, extraHeaders) {
  let p = decodeURIComponent(urlPath);
  if (p.endsWith('/')) p += '__index';
  if (!path.extname(p)) p += '.__doc';
  let suffix = '';
  const sig = (search || '') + JSON.stringify(extraHeaders || {});
  if (sig !== '{}' && sig.length) {
    suffix = '.' + crypto.createHash('sha1').update(sig).digest('hex').slice(0, 12);
  }
  const ext = path.extname(p);
  const base = p.slice(0, p.length - ext.length);
  return path.join(CACHE, host, base + suffix + ext);
}

// absolute URL -> local server path
function toLocal(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    const tail = u.pathname + u.search;
    return u.hostname === MAIN ? tail : `/_ext/${u.hostname}${tail}`;
  } catch {
    return null;
  }
}

function rewrite(text) {
  return text.replace(/https?:\\?\/\\?\/[A-Za-z0-9.-]+(?::\d+)?[^\s"'`()<>\\]*/g, (m) => {
    const clean = m.replace(/\\\//g, '/');
    const trail = clean.match(/[.,;)]+$/);
    const url = trail ? clean.slice(0, -trail[0].length) : clean;
    const local = toLocal(url);
    if (!local) return m;
    return local + (trail ? trail[0] : '');
  });
}

function curlFetch(url, extraHeaders) {
  return new Promise((resolve) => {
    const tmp = path.join('/tmp', 'mf-' + crypto.randomBytes(8).toString('hex'));
    const args = ['-sS', '--compressed', '-L', '--max-time', '90', '-A', UA, '-D', tmp + '.h', '-o', tmp + '.b'];
    for (const [k, v] of Object.entries(extraHeaders || {})) args.push('-H', `${k}: ${v}`);
    args.push(url);
    execFile('curl', args, { maxBuffer: 1 << 26 }, (err) => {
      let body = null, ctype = 'application/octet-stream', status = 200;
      try { body = fs.readFileSync(tmp + '.b'); } catch {}
      try {
        const h = fs.readFileSync(tmp + '.h', 'utf8');
        const cts = [...h.matchAll(/^content-type:\s*(.+)$/gim)];
        if (cts.length) ctype = cts[cts.length - 1][1].trim().split(';')[0];
        const sts = [...h.matchAll(/^HTTP\/[\d.]+ (\d{3})/gim)];
        if (sts.length) status = parseInt(sts[sts.length - 1][1], 10);
      } catch {}
      try { fs.unlinkSync(tmp + '.b'); } catch {}
      try { fs.unlinkSync(tmp + '.h'); } catch {}
      if (err && !body) return resolve(null);
      resolve({ body: body || Buffer.alloc(0), ctype, status });
    });
  });
}

const inflight = new Map();

async function getResource(host, urlPath, search, extraHeaders) {
  const file = keyFor(host, urlPath, search, extraHeaders);
  const metaFile = file + '.meta';
  if (fs.existsSync(file) && fs.existsSync(metaFile)) {
    return { body: fs.readFileSync(file), ...JSON.parse(fs.readFileSync(metaFile, 'utf8')) };
  }
  if (inflight.has(file)) return inflight.get(file);

  const p = (async () => {
    const url = `https://${host}${urlPath}${search || ''}`;
    const res = await curlFetch(url, extraHeaders);
    if (!res) { missLog.push(url); return null; }
    let body = res.body;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
    fs.writeFileSync(metaFile, JSON.stringify({ ctype: res.ctype, status: res.status }));
    return { body, ctype: res.ctype, status: res.status };
  })();
  inflight.set(file, p);
  const out = await p;
  inflight.delete(file);
  return out;
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    let host = MAIN;
    let p = u.pathname;
    const ext = p.match(/^\/_ext\/([^/]+)(\/.*)?$/);
    if (ext) { host = ext[1]; p = ext[2] || '/'; }

    const extraHeaders = {};
    for (const h of ['rsc', 'next-router-state-tree', 'next-router-prefetch', 'next-url']) {
      if (req.headers[h]) extraHeaders[h] = req.headers[h];
    }

    const r = await getResource(host, p, u.search, extraHeaders);
    if (!r) { res.writeHead(502); return res.end('mirror fetch failed'); }
    res.writeHead(r.status === 304 ? 200 : r.status, {
      'content-type': r.ctype,
      'access-control-allow-origin': '*',
      'cache-control': 'no-cache',
    });
    res.end(r.body);
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
});

process.on('SIGTERM', () => {
  fs.writeFileSync(path.join(CACHE, '_misses.json'), JSON.stringify(missLog, null, 2));
  process.exit(0);
});

server.listen(PORT, '127.0.0.1', () => console.log('mirror server on http://127.0.0.1:' + PORT));
