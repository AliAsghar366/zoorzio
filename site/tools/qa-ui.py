# -*- coding: utf-8 -*-
"""UI QA against production: every page, three viewports, assets, console,
accessibility basics, and the auth guard. No LLM calls."""
import sys
from playwright.sync_api import sync_playwright

SITE = "https://zoorzio-web.vercel.app"
rows = []


def check(area, name, ok, detail=""):
    rows.append((area, name, bool(ok), str(detail)[:120]))
    if not ok:
        print("  FAIL  [%s] %s -> %s" % (area, name, str(detail)[:90]), flush=True)


# Real routes only - /about/, /contact/ and /blog/ do not exist in this build
# and nothing links to them, so asserting they load was testing my guess.
PAGES = ["/", "/login/", "/pricing/", "/features/", "/security/", "/terms/",
         "/privacy-policy/", "/cookies-settings/", "/legal-notice/"]
PORTAL = ["/portal/", "/portal/workspace.html", "/portal/coffee.html",
          "/portal/explore.html", "/portal/profile.html"]
ADMIN = ["/admin/whatsapp/", "/admin/telegram/"]
VIEWPORTS = [("desktop", 1440, 900), ("tablet", 820, 1180), ("phone", 390, 844)]

with sync_playwright() as p:
    br = p.chromium.launch(channel="msedge")

    # ---------- public pages, three viewports ----------
    for label, w, h in VIEWPORTS:
        ctx = br.new_context(viewport={"width": w, "height": h})
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e).splitlines()[0][:80]))
        for path in PAGES:
            try:
                r = pg.goto(SITE + path, wait_until="domcontentloaded", timeout=45000)
                status = r.status if r else 0
                pg.wait_for_timeout(700)
                body = pg.evaluate("document.body.innerText.length")
                # horizontal overflow is the classic responsive break
                overflow = pg.evaluate(
                    "Math.max(0, document.documentElement.scrollWidth - window.innerWidth)")
                check(label, "%s loads" % path, status == 200 and body > 50,
                      "HTTP %s, %d chars" % (status, body))
                check(label, "%s no h-scroll" % path, overflow <= 2, "%dpx overflow" % overflow)
            except Exception as e:
                check(label, "%s loads" % path, False, type(e).__name__)
        real = [e for e in errs if not any(x in e for x in
                ("fbevents", "fbq", "_ttq", "execStart", "mixpanel", "gtag", "vaudit"))]
        check(label, "no first-party JS errors", not real, real[:2])
        ctx.close()

    # ---------- auth guard ----------
    ctx = br.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    for path in PORTAL:
        pg.goto(SITE + path, wait_until="domcontentloaded", timeout=45000)
        pg.wait_for_timeout(1200)
        check("guard", "%s redirects when signed out" % path, "/login" in pg.url, pg.url[-46:])
    ctx.close()

    # ---------- signed in ----------
    ctx = br.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    errs, failed = [], []
    pg.on("pageerror", lambda e: errs.append(str(e).splitlines()[0][:80]))
    pg.on("requestfailed", lambda r: failed.append(r.url[:70]) if r.url.startswith(SITE) else None)
    pg.goto(SITE + "/login/", wait_until="networkidle", timeout=60000)
    pg.fill("#email", "pro@anchor.app")
    pg.fill("#pw", "Demo@1234")
    pg.click("#loginSubmit")
    try:
        pg.wait_for_url("**/portal/**", timeout=45000)
        signed = True
    except Exception:
        signed = False
    check("auth", "sign in reaches the portal", signed, pg.url[-46:])

    if signed:
        for label, w, h in VIEWPORTS:
            pg.set_viewport_size({"width": w, "height": h})
            for path in PORTAL:
                pg.goto(SITE + path, wait_until="domcontentloaded", timeout=45000)
                pg.wait_for_timeout(1500)
                body = pg.evaluate("document.body.innerText.length")
                overflow = pg.evaluate(
                    "Math.max(0, document.documentElement.scrollWidth - window.innerWidth)")
                check(label, "%s renders signed in" % path, body > 40, "%d chars" % body)
                check(label, "%s no h-scroll" % path, overflow <= 2, "%dpx" % overflow)

        pg.set_viewport_size({"width": 1280, "height": 900})
        # images that failed to load
        pg.goto(SITE + "/portal/", wait_until="networkidle", timeout=60000)
        broken = pg.evaluate(
            "Array.from(document.images).filter(i => i.complete && i.naturalWidth === 0)"
            ".map(i => i.src).slice(0,5)")
        check("assets", "no broken images on the portal", not broken, broken)

        # basic a11y: inputs need labels, images need alt
        pg.goto(SITE + "/portal/profile.html", wait_until="networkidle", timeout=60000)
        # alt="" is how a decorative image is correctly marked; only a missing
        # alt attribute is a defect.
        noalt = pg.evaluate(
            "Array.from(document.images).filter(i => !i.hasAttribute('alt'))"
            ".map(i=>i.src.slice(-36)).slice(0,5)")
        check("a11y", "every image has an alt attribute", not noalt, noalt)
        nolabel = pg.evaluate("""
            Array.from(document.querySelectorAll('input:not([type=hidden])')).filter(i =>
              !i.labels?.length && !i.getAttribute('aria-label') && !i.placeholder
            ).map(i => i.id || i.name || i.type).slice(0,5)""")
        check("a11y", "inputs are labelled", not nolabel, nolabel)

    check("console", "no first-party JS errors while signed in", not errs, errs[:3])
    check("assets", "no failed same-origin requests", not failed, sorted(set(failed))[:3])
    ctx.close()

    # ---------- admin pages ----------
    ctx = br.new_context(viewport={"width": 1280, "height": 900})
    pg = ctx.new_page()
    aerrs = []
    pg.on("pageerror", lambda e: aerrs.append(str(e).splitlines()[0][:80]))
    for path in ADMIN:
        pg.goto(SITE + path, wait_until="networkidle", timeout=45000)
        pg.wait_for_timeout(800)
        has_form = pg.evaluate("!!document.querySelector('#email') && !!document.querySelector('#pw')")
        check("admin", "%s shows the sign-in form" % path, has_form, pg.title())
        api_ok = pg.evaluate("(window.ZoorzioAPI && window.ZoorzioAPI.baseUrl()) || ''")
        check("admin", "%s is wired to the API" % path, "railway.app/api" in api_ok, api_ok[-42:])
    check("admin", "no JS errors on admin pages", not aerrs, aerrs[:2])
    ctx.close()
    br.close()

total = len(rows)
bad = [r for r in rows if not r[2]]
print("\n" + "=" * 76)
print("  UI QA: %d checks, %d passed, %d failed" % (total, total - len(bad), len(bad)))
print("=" * 76)
from collections import defaultdict
agg = defaultdict(lambda: [0, 0])
for area, _, ok, _ in rows:
    agg[area][0] += 1
    if not ok:
        agg[area][1] += 1
print("  %-10s %7s %7s" % ("AREA", "CHECKS", "FAILED"))
for a in sorted(agg):
    print("  %-10s %7d %7d" % (a, agg[a][0], agg[a][1]))
if bad:
    print("\nFAILURES:")
    for area, name, _, detail in bad:
        print("  [%-8s] %-44s %s" % (area, name, detail))
sys.exit(0)
