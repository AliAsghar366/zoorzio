"""Live test of the deployed Vercel site."""
import sys
from playwright.sync_api import sync_playwright

SITE = "https://zoorzio-web.vercel.app"
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), str(detail)[:130]))
    print(("  PASS  " if ok else "  FAIL  ") + name + (("  | " + str(detail)[:95]) if detail else ""), flush=True)


PAGES = ["/", "/pricing/", "/security/", "/features/", "/channel/whatsapp/",
         "/login/", "/portal/", "/terms/", "/privacy-policy/"]

with sync_playwright() as p:
    br = p.chromium.launch(channel="msedge")
    ctx = br.new_context(viewport={"width": 1366, "height": 900})
    pg = ctx.new_page()

    all_js_errors = []
    failed_assets = {}
    pg.on("pageerror", lambda e: all_js_errors.append(str(e).splitlines()[0][:110]))
    pg.on("response", lambda r: failed_assets.setdefault(r.url.replace(SITE, ""), r.status)
          if r.url.startswith(SITE) and r.status >= 400 else None)

    print("\n[1] Pages render")
    for path in PAGES:
        try:
            resp = pg.goto(SITE + path, wait_until="networkidle", timeout=60000)
            status = resp.status if resp else 0
            title = (pg.title() or "").strip()
            body_len = pg.evaluate("document.body.innerText.length")
            check("%-24s renders" % path, status == 200 and body_len > 200,
                  "HTTP %s | %d chars | %s" % (status, body_len, title[:40]))
        except Exception as e:
            check("%-24s renders" % path, False, str(e).splitlines()[0][:80])

    print("\n[2] Backend wiring")
    pg.goto(SITE + "/login/", wait_until="networkidle", timeout=60000)
    api_base = pg.evaluate("window.ZoorzioAPI ? window.ZoorzioAPI.baseUrl() : null")
    configured = pg.evaluate("window.ZoorzioAPI ? window.ZoorzioAPI.isConfigured() : null")
    check("API client script loaded", api_base is not None, "baseUrl=%r" % api_base)
    check("API URL configured on the deployment", bool(configured),
          "ZOORZIO_API_URL env var is %s" % ("set" if configured else "NOT set - still the placeholder"))

    print("\n[3] Login behaviour with no backend")
    pg.fill("#email", "pro@anchor.app")
    pg.fill("#pw", "Demo@1234")
    pg.click("#loginSubmit")
    pg.wait_for_timeout(4000)
    err = (pg.eval_on_selector("#loginError", "e => e.textContent") or "").strip()
    visible = pg.eval_on_selector("#loginError", "e => getComputedStyle(e).display !== 'none'")
    check("shows a clear message instead of failing silently", bool(err) and visible, err[:90])
    check("did not pretend to sign in", "/portal" not in pg.url, pg.url)

    print("\n[4] Portal auth guard")
    pg.goto(SITE + "/portal/", wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(2500)
    check("portal without a token redirects to /login/", "/login" in pg.url, pg.url)

    print("\n[5] Assets and JS")
    real_errors = [e for e in all_js_errors
                   if "fbevents" not in e and "fbq" not in e and "Mixpanel" not in e]
    check("no unexpected JavaScript errors", not real_errors, real_errors[:3])
    broken = {k: v for k, v in failed_assets.items() if v >= 400}
    check("no broken same-origin assets (<=5 known)", len(broken) <= 5,
          "%d broken: %s" % (len(broken), list(broken.items())[:4]))

    br.close()

passed = sum(1 for _, ok, _ in results if ok)
print("\n" + "=" * 74)
print("  LIVE SITE RESULT: %d/%d checks passed" % (passed, len(results)))
print("=" * 74)
for name, ok, detail in results:
    if not ok:
        print("  FAILED: %s | %s" % (name, detail))
sys.exit(0)
