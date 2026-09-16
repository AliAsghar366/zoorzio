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
  // This used to be a warning, which meant a deploy with the variable missing
  // succeeded and quietly shipped a site that can never reach its backend -
  // the failure only showed up as "Sign-in isn't connected yet" in the browser.
  // Failing the build puts the problem where someone will actually see it.
  console.error(
    [
      'ZOORZIO_API_URL is not set, so the pages would ship with the placeholder',
      'still in them and sign-in could never reach the backend.',
      '',
      'Set it on the Vercel project (Settings -> Environment Variables), scoped to',
      'the environment you are deploying, then REDEPLOY - changing a variable does',
      'not rebuild anything on its own.',
      '',
      '  ZOORZIO_API_URL = https://<your-api-host>/api    (the /api suffix matters)',
    ].join('\n'),
  );
  process.exit(1);
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
console.log(`inject-env: API URL -> ${apiUrl}`);
console.log(`inject-env: updated ${touched} file(s)`);
if (touched === 0) {
  console.error(
    'inject-env: no file contained the placeholder. The built output is not the ' +
      'one this script is pointed at, so nothing was wired up.',
  );
  process.exit(1);
}
