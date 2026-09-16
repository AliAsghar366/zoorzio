"""End-to-end test of the Zoorzio product: marketing site -> login -> portal -> API -> DB."""
import socket
import sys
from playwright.sync_api import sync_playwright

SITE = "http://localhost:8899"
EMAIL = "pro@anchor.app"
PASSWORD = "Demo@1234"

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("  PASS  " if ok else "  FAIL  ") + name + (("  | " + str(detail)[:110]) if detail else ""), flush=True)


def flush_rate_limit():
    try:
        s = socket.create_connection(("127.0.0.1", 6390), timeout=3)
        s.sendall(b"FLUSHALL\r\n")
        s.recv(32)
        s.close()
    except Exception:
        pass


flush_rate_limit()

with sync_playwright() as p:
    br = p.chromium.launch(channel="msedge")
    ctx = br.new_context(viewport={"width": 1400, "height": 950})
    pg = ctx.new_page()
    js_errors = []
    pg.on("pageerror", lambda e: js_errors.append(str(e).splitlines()[0][:120]))

    # ---------------------------------------------------------------- 1. guard
    print("\n[1] Auth guard")
    pg.goto(SITE + "/portal/", wait_until="domcontentloaded", timeout=40000)
    pg.wait_for_timeout(1200)
    check("portal without a token redirects to /login/", "/login" in pg.url, pg.url)

    # ---------------------------------------------------------------- 2. login
    print("\n[2] Login")
    pg.goto(SITE + "/login/", wait_until="networkidle", timeout=40000)
    check("API base resolved", bool(pg.evaluate("window.ZoorzioAPI.baseUrl()")),
          pg.evaluate("window.ZoorzioAPI.baseUrl()"))

    pg.fill("#email", EMAIL)
    pg.fill("#pw", "definitely-the-wrong-password")
    pg.click("#loginSubmit")
    pg.wait_for_timeout(2500)
    err_txt = (pg.eval_on_selector("#loginError", "e => e.textContent") or "").strip()
    check("wrong password is rejected with a message", bool(err_txt) and "/portal" not in pg.url, err_txt)

    pg.fill("#pw", PASSWORD)
    pg.click("#loginSubmit")
    try:
        pg.wait_for_url("**/portal/**", timeout=25000)
        ok = True
    except Exception:
        ok = False
    check("correct password reaches the portal", ok, pg.url)
    token = pg.evaluate("localStorage.getItem('zoorzio_access_token')")
    check("access token stored", bool(token))

    # ---------------------------------------------------------------- 3. home
    print("\n[3] Portal home")
    pg.goto(SITE + "/portal/", wait_until="networkidle", timeout=40000)
    pg.wait_for_timeout(1800)
    greeting = (pg.eval_on_selector("#heroGreeting", "e => e.textContent") or "").strip()
    check("greeting shows the real signed-in user", "Pro" in greeting and "," in greeting, greeting)
    check("greeting is no longer the hard-coded name", "Zeesha" not in greeting, greeting)

    # ------------------------------------------------------------ 4. workspace
    print("\n[4] Workspace")
    pg.goto(SITE + "/portal/workspace.html", wait_until="networkidle", timeout=45000)
    pg.wait_for_timeout(2800)
    eyebrow = (pg.eval_on_selector(".ws-hero__eyebrow", "e => e.textContent") or "").strip()
    check("workspace greeting personalised", "Pro" in eyebrow, eyebrow)

    boards = pg.eval_on_selector_all(".ws-board", "els => els.length")
    titles = pg.eval_on_selector_all(".ws-board__tasks li span:first-child",
                                     "els => els.map(e => e.textContent.trim())")
    check("tasks rendered from the API", boards > 0, f"{boards} boards, {len(titles)} tasks")
    seeded = [t for t in titles if t in
              ("Buy groceries", "Call dentist", "Complete API integration", "Write unit tests", "Review PR #42")]
    check("task titles match seeded database rows", len(seeded) > 0, seeded[:4])
    check("sample task 'Plan the weekend trip' is gone",
          "Plan the weekend trip" not in titles)

    lists_n = pg.eval_on_selector_all(".ws-list-card", "els => els.length")
    check("lists rendered from the API", lists_n > 0, f"{lists_n} list cards")

    rem_n = pg.eval_on_selector_all(".ws-reminder-item", "els => els.length")
    rem_titles = pg.eval_on_selector_all(".ws-reminder-item__title",
                                         "els => els.map(e => e.textContent.trim())")
    check("reminders rendered from the API", rem_n > 0, f"{rem_n} reminders")
    check("reminder text is real, not the sample row",
          "Show me today's reminders, events and tasks" not in rem_titles, rem_titles[:2])

    # ---------------------------------------------------------------- 5. chat
    print("\n[5] Coffee (chat)")
    pg.goto(SITE + "/portal/coffee.html", wait_until="networkidle", timeout=40000)
    before = pg.eval_on_selector_all(".chat__bubble", "els => els.length")
    pg.fill(".coffee__chat-input input", "Reply with exactly the word ZOORZIOTEST and nothing else.")
    pg.keyboard.press("Enter")
    try:
        pg.wait_for_function(
            "n => document.querySelectorAll('.chat__bubble').length > n + 1 && "
            "!document.querySelector('.chat__bubble.is-pending')",
            arg=before, timeout=60000)
        ok = True
    except Exception:
        ok = False
    bubbles = pg.eval_on_selector_all(".chat__bubble", "els => els.map(e => e.textContent.trim())")
    reply = bubbles[-1] if bubbles else ""
    check("chat got a reply from the assistant", ok and len(reply) > 0, reply[:90])
    check("reply is live, not the old canned string",
          "I'll follow up shortly" not in reply, reply[:70])

    # ------------------------------------------------------------- 6. explore
    print("\n[6] Explore (memory clean-up)")
    pg.goto(SITE + "/portal/explore.html", wait_until="networkidle", timeout=40000)
    pg.wait_for_timeout(2500)
    body = (pg.eval_on_selector("#reviewBody", "e => e.textContent") or "").strip()
    check("memory loaded from the API", body not in ("", "Loading your memories…")
          and "Could not load" not in body, body[:90])
    check("memory is real, not the sample list",
          body != "My Zoorzio highlights reel", body[:70])

    # ------------------------------------------------------------- 7. profile
    print("\n[7] Profile")
    pg.goto(SITE + "/portal/profile.html", wait_until="networkidle", timeout=40000)
    pg.wait_for_timeout(2500)
    email_shown = (pg.eval_on_selector("#emailValue", "e => e.textContent") or "").strip()
    member = (pg.eval_on_selector("#memberSince", "e => e.textContent") or "").strip()
    plan = (pg.eval_on_selector("#planName", "e => e.textContent") or "").strip()
    check("profile shows the signed-in email", email_shown == EMAIL, email_shown)
    check("member-since comes from the account", "Member since" in member, member)
    check("plan name populated", bool(plan), plan)

    # ------------------------------------------------------------- 8. sign out
    print("\n[8] Sign out")
    pg.on("dialog", lambda d: d.accept())
    pg.click("#signOutBtn")
    try:
        pg.wait_for_url("**/login/**", timeout=20000)
        ok = True
    except Exception:
        ok = False
    tok_after = pg.evaluate("localStorage.getItem('zoorzio_access_token')")
    check("sign out returns to login", ok, pg.url)
    check("token cleared on sign out", not tok_after)

    print("\n[9] JS errors")
    real_errors = [e for e in js_errors if "fbevents" not in e and "fbq" not in e]
    check("no JavaScript errors across the flow", not real_errors, real_errors[:3])

    br.close()

passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
print("\n" + "=" * 62)
print(f"  END-TO-END RESULT:  {passed}/{total} checks passed")
print("=" * 62)
for name, ok, detail in results:
    if not ok:
        print(f"  FAILED: {name}  | {detail}")
sys.exit(0 if passed == total else 1)
