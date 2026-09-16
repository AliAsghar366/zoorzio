#!/usr/bin/env node
// Static server for the captured site.
// Supports HTTP Range requests, which <video> playback requires
// (python -m http.server does not, so videos stay blank there).
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'dist');
const PORT = parseInt(process.env.PORT || '8080', 10);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.otf': 'font/otf', '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

function resolve(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  if (p.includes('\0')) return null;
  const abs = path.normalize(path.join(ROOT, p));
  if (!abs.startsWith(ROOT)) return null; // no traversal outside dist
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    const idx = path.join(abs, 'index.html');
    return fs.existsSync(idx) ? idx : null;
  }
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  const withIdx = path.join(abs, 'index.html');
  if (fs.existsSync(withIdx)) return withIdx;
  const withHtml = abs + '.html';
  if (fs.existsSync(withHtml)) return withHtml;
  return null;
}

http
  .createServer((req, res) => {
    const file = resolve(req.url);
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('404 Not Found: ' + req.url);
    }
    const stat = fs.statSync(file);
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        let start = m[1] ? parseInt(m[1], 10) : 0;
        let end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
        if (isNaN(start) || start >= stat.size) {
          res.writeHead(416, { 'content-range': `bytes */${stat.size}` });
          return res.end();
        }
        if (end >= stat.size) end = stat.size - 1;
        res.writeHead(206, {
          'content-type': type,
          'content-length': end - start + 1,
          'content-range': `bytes ${start}-${end}/${stat.size}`,
          'accept-ranges': 'bytes',
        });
        return fs.createReadStream(file, { start, end }).pipe(res);
      }
    }

    res.writeHead(200, {
      'content-type': type,
      'content-length': stat.size,
      'accept-ranges': 'bytes',
      'cache-control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`\n  memorae.ai local copy running at:  http://localhost:${PORT}/\n`);
  });
