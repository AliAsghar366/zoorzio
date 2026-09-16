// Runs at deploy build time (see vercel.json -> buildCommand). Fills in the
// backend connection points that were left as placeholders in the static
// HTML, without touching anything else about the pages.
//
// - ZOORZIO_API_URL: base URL of the deployed apps/api backend (e.g.
//   https://your-api.up.railway.app/api). Set as an env var on the Vercel
//   project. Left untouched (build fails loudly) if not set, so a missing
//   config is never silently deployed as broken.
// - The in-page panel is served from this same deployment at /portal/, so
//   the panel URL is always a relative path - never an env var.
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const API_PLACEHOLDER = 'https://REPLACE-WITH-RAILWAY-API-URL.up.railway.app/api';
const PANEL_PLACEHOLDER = 'https://REPLACE-WITH-PANEL-APP-URL';
const PANEL_URL = '/portal/';

const apiUrl = process.env.ZOORZIO_API_URL;
if (!apiUrl) {
  console.warn(
    'WARNING: ZOORZIO_API_URL is not set - login will keep showing "not connected yet" until it is configured on the deployment.',
  );
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let touched = 0;
for (const f of walk(DIST)) {
  const original = fs.readFileSync(f, 'utf8');
  let out = original;
  if (apiUrl) out = out.split(API_PLACEHOLDER).join(apiUrl);
  out = out.split(PANEL_PLACEHOLDER).join(PANEL_URL);
  if (out !== original) {
    fs.writeFileSync(f, out, 'utf8');
    touched++;
  }
}
console.log(`inject-env: updated ${touched} file(s)`);
