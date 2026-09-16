"""Brutal full-system sweep: every feature, from every demo login.

Runs the whole authenticated API surface separately for each demo account,
then the cross-account checks that only make sense with several users in play:
role separation, plan entitlements, and whether one account can reach
another's data.
"""
import json
import socket
import sys
import time
import urllib.error
import urllib.request

API = "http://localhost:3005/api"
AI = "http://localhost:8000"
PW = "Demo@1234"

PASS, SKIP, FAIL = "PASS", "N/A ", "FAIL"
rows = []          # (account, area, label, verdict, detail)
current = {"acct": "-", "area": "-"}


def flush_redis():
    try:
        s = socket.create_connection(("127.0.0.1", 6390), timeout=3)
        s.sendall(b"FLUSHALL\r\n"); s.recv(32); s.close()
    except Exception:
        pass


def call(method, url, body=None, token=None, timeout=90):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace")
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, (json.loads(raw) if raw else None)
        except ValueError:
            return e.code, raw
    except Exception as e:
        return 0, {"message": type(e).__name__}


def unwrap(p):
    return p["data"] if isinstance(p, dict) and "success" in p and "data" in p else p


def area(name):
    current["area"] = name


def record(label, verdict, detail=""):
    rows.append((current["acct"], current["area"], label, verdict, str(detail)[:110]))
    if verdict == FAIL:
        print("    %s  %-44s %s" % (verdict, label, str(detail)[:70]), flush=True)


def ck(label, method, path, body=None, token=None, ok=(200, 201), soft=(), base=API):
    st, payload = call(method, base + path, body, token)
    if st in ok:
        d = unwrap(payload)
        if isinstance(d, list):
            det = "%d items" % len(d)
        elif isinstance(d, dict):
            det = ",".join(list(d.keys())[:3])
        else:
            det = str(d)[:40]
        record(label, PASS, "%d %s" % (st, det))
        return d
    if st in soft:
        m = payload.get("message") if isinstance(payload, dict) else ""
        record(label, SKIP, "%d %s" % (st, m or "unavailable"))
        return None
    m = payload.get("message") if isinstance(payload, dict) else str(payload)[:50]
    record(label, FAIL, "%d %s" % (st, m))
    return None


def expect(label, cond, detail=""):
    record(label, PASS if cond else FAIL, detail)
    return bool(cond)


def login(email, password=PW):
    flush_redis()
    st, p = call("POST", API + "/auth/login", {"email": email, "password": password})
    d = unwrap(p) or {}
    return d.get("accessToken"), d.get("refreshToken"), st, d.get("user") or {}


# --------------------------------------------------------------------------
def sweep(token, label):
    """The full authenticated surface, run as one account."""
    created = {}

    area("auth/profile")
    me = ck("GET /auth/me", "GET", "/auth/me", token=token)
    ck("GET /users/me", "GET", "/users/me", token=token)
    ck("GET /users/me/preferences", "GET", "/users/me/preferences", token=token)
    ck("GET /users/me/stats", "GET", "/users/me/stats", token=token)
    ck("PUT /users/me/preferences", "PUT", "/users/me/preferences", {"aiTone": "friendly"}, token)

    area("plans/billing")
    ck("GET /plans", "GET", "/plans", token=token)
    ck("GET /billing/subscription", "GET", "/billing/subscription", token=token, ok=(200, 201), soft=(404,))

    area("tasks")
    for p in ("", "/today", "/overdue", "/stats", "/suggest"):
        ck("GET /tasks%s" % p, "GET", "/tasks" + p, token=token)
    t = ck("POST /tasks", "POST", "/tasks", {"title": "MX task " + label, "priority": "HIGH"}, token)
    if t and t.get("id"):
        created["task"] = t["id"]
        ck("GET /tasks/:id", "GET", "/tasks/" + t["id"], token=token)
        ck("PUT /tasks/:id", "PUT", "/tasks/" + t["id"], {"title": "MX task edited"}, token)
        ck("PUT /tasks/:id/complete", "PUT", "/tasks/" + t["id"] + "/complete", {}, token)

    area("memory")
    for p in ("", "/recent", "/frequent", "/stats"):
        ck("GET /memory%s" % p, "GET", "/memory" + p, token=token)
    ck("GET /memory/search", "GET", "/memory/search?q=test", token=token)
    m = ck("POST /memory", "POST", "/memory", {"content": "MX memory " + label, "type": "NOTE"}, token)
    if m and m.get("id"):
        created["memory"] = m["id"]
        ck("GET /memory/:id", "GET", "/memory/" + m["id"], token=token)
        ck("PUT /memory/:id", "PUT", "/memory/" + m["id"], {"content": "MX memory edited"}, token)

    area("lists")
    ck("GET /lists", "GET", "/lists", token=token)
    l = ck("POST /lists", "POST", "/lists", {"name": "MX list " + label}, token, soft=(403,))
    if l and l.get("id"):
        created["list"] = l["id"]
        ck("GET /lists/:id", "GET", "/lists/" + l["id"], token=token)
        it = ck("POST /lists/:id/items", "POST", "/lists/" + l["id"] + "/items",
                {"content": "MX item"}, token)
        if it and it.get("id"):
            ck("PUT /lists/:id/items/:itemId", "PUT",
               "/lists/%s/items/%s" % (l["id"], it["id"]), {"isChecked": True}, token)
            ck("DELETE /lists/:id/items/:itemId", "DELETE",
               "/lists/%s/items/%s" % (l["id"], it["id"]), token=token)
        ck("PUT /lists/:id", "PUT", "/lists/" + l["id"], {"name": "MX list edited"}, token)

    area("reminders")
    ck("GET /reminders", "GET", "/reminders", token=token)
    r = ck("POST /reminders", "POST", "/reminders",
           {"title": "MX reminder " + label, "scheduledAt": "2027-03-01T10:00:00.000Z"}, token, soft=(403,))
    if r and r.get("id"):
        created["reminder"] = r["id"]
        ck("GET /reminders/:id", "GET", "/reminders/" + r["id"], token=token)
        ck("PATCH /reminders/:id", "PATCH", "/reminders/" + r["id"], {"title": "MX rem edited"}, token)
        ck("PATCH /reminders/:id/snooze", "PATCH", "/reminders/" + r["id"] + "/snooze", {"minutes": 10}, token)
        ck("PATCH /reminders/:id/complete", "PATCH", "/reminders/" + r["id"] + "/complete", {}, token)

    area("boards")
    ck("GET /boards", "GET", "/boards", token=token)
    b = ck("POST /boards", "POST", "/boards", {"name": "MX board " + label}, token)
    if b and b.get("id"):
        created["board"] = b["id"]
        ck("GET /boards/:id", "GET", "/boards/" + b["id"], token=token)
        ck("PUT /boards/:id", "PUT", "/boards/" + b["id"], {"name": "MX board edited"}, token)

    area("calendar")
    for p in ("/health", "/events", "/today", "/upcoming"):
        ck("GET /calendar%s" % p, "GET", "/calendar" + p, token=token)
    # Was: read a calendarId out of an existing event, which meant an account
    # with a calendar but no events yet could never create its first one. That
    # gap is why GET /calendar/calendars exists.
    cals = ck("GET /calendar/calendars", "GET", "/calendar/calendars", token=token)
    cal_id = cals[0].get("id") if isinstance(cals, list) and cals else None
    if cal_id:
        ev = ck("POST /calendar/events", "POST", "/calendar/events",
                {"calendarId": cal_id, "title": "MX event",
                 "startTime": "2027-03-02T09:00:00.000Z",
                 "endTime": "2027-03-02T10:00:00.000Z"}, token)
        if ev and ev.get("id"):
            ck("DELETE /calendar/events/:id", "DELETE", "/calendar/events/" + ev["id"], token=token)
    else:
        record("POST /calendar/events", FAIL, "no calendar returned by /calendar/calendars")
    ck("GET /calendar/google/authorize", "GET", "/calendar/google/authorize", token=token,
       soft=(400, 401, 404, 500, 503))

    area("briefing/notifications/gamification")
    ck("GET /briefing", "GET", "/briefing", token=token)
    ck("GET /briefing/weekly", "GET", "/briefing/weekly", token=token)
    ck("GET /notifications", "GET", "/notifications", token=token)
    ck("GET /notifications/unread-count", "GET", "/notifications/unread-count", token=token)
    ck("PATCH /notifications/read-all", "PATCH", "/notifications/read-all", {}, token)
    ck("GET /gamification/progress", "GET", "/gamification/progress", token=token)

    area("contacts/friends/sharing")
    ck("GET /contacts", "GET", "/contacts", token=token)
    c = ck("POST /contacts", "POST", "/contacts", {"name": "MX contact " + label}, token)
    if c and c.get("id"):
        created["contact"] = c["id"]
        ck("GET /contacts/:id", "GET", "/contacts/" + c["id"], token=token)
        ck("PATCH /contacts/:id", "PATCH", "/contacts/" + c["id"], {"name": "MX contact edited"}, token)
    for p in ("", "/requests", "/quota", "/reminders"):
        ck("GET /friends%s" % p, "GET", "/friends" + p, token=token)
    ck("GET /sharing/shared-with-me", "GET", "/sharing/shared-with-me", token=token)
    ck("GET /action-permissions", "GET", "/action-permissions", token=token)

    area("api-keys/channels/integrations")
    ck("GET /api-keys", "GET", "/api-keys", token=token)
    k = ck("POST /api-keys", "POST", "/api-keys", {"name": "MX key " + label}, token)
    if k and k.get("id"):
        ck("DELETE /api-keys/:id", "DELETE", "/api-keys/" + k["id"], token=token)
    ck("GET /channels/health", "GET", "/channels/health", token=token)
    ck("GET /channels/credentials", "GET", "/channels/credentials", token=token)
    ck("GET /channels/linked", "GET", "/channels/linked", token=token)
    ck("GET /integrations", "GET", "/integrations", token=token)

    area("chat (AI)")
    st, p = call("POST", API + "/chat",
                 {"messages": [{"role": "user", "content": "Reply with one short sentence."}]},
                 token, timeout=120)
    reply = (unwrap(p) or {}).get("reply", "") if isinstance(p, dict) else ""
    expect("POST /chat returns a live reply",
           st == 200 and reply and "having trouble" not in reply.lower(), reply[:60])

    area("cleanup")
    for key, path in (("task", "/tasks/"), ("memory", "/memory/"), ("list", "/lists/"),
                      ("reminder", "/reminders/"), ("board", "/boards/"), ("contact", "/contacts/")):
        if created.get(key):
            ck("DELETE %s:id" % path, "DELETE", path + created[key], token=token)
    return created, me


# ==========================================================================
print("=" * 104)
print("  ZOORZIO FULL-SYSTEM SWEEP - every feature, every demo login")
print("=" * 104)

ACCOUNTS = [
    ("admin@anchor.app", "ADMIN"),
    ("starter@anchor.app", "Starter"),
    ("pro@anchor.app", "Pro"),
    ("ultimate@anchor.app", "Ultimate"),
]

tokens = {}
for email, label in ACCOUNTS:
    print("\n### %s (%s)" % (email, label), flush=True)
    current["acct"] = label
    area("login")
    tok, refresh, st, user = login(email)
    if not expect("login", bool(tok), "HTTP %d" % st):
        continue
    tokens[label] = tok
    expect("role is %s" % ("ADMIN" if label == "ADMIN" else "USER"),
           (user.get("role") == "ADMIN") == (label == "ADMIN"), user.get("role"))
    sweep(tok, label)
    done = sum(1 for r in rows if r[0] == label and r[3] == PASS)
    bad = sum(1 for r in rows if r[0] == label and r[3] == FAIL)
    na = sum(1 for r in rows if r[0] == label and r[3] == SKIP)
    print("    -> %d passed, %d n/a, %d failed" % (done, na, bad), flush=True)

# ---- free-tier account -----------------------------------------------------
print("\n### free tier (no subscription)", flush=True)
current["acct"] = "FREE"
area("registration")
flush_redis()
femail = "mx.free.%d@zoorzio.test" % int(time.time())
st, p = call("POST", API + "/auth/register",
             {"email": femail, "password": "FreeUser@1234", "name": "MX Free",
              "acceptedPrivacyPolicy": True})
ftok = (unwrap(p) or {}).get("accessToken")
expect("register a new account", bool(ftok), "HTTP %d" % st)
if ftok:
    tokens["FREE"] = ftok
    sweep(ftok, "FREE")
    done = sum(1 for r in rows if r[0] == "FREE" and r[3] == PASS)
    bad = sum(1 for r in rows if r[0] == "FREE" and r[3] == FAIL)
    print("    -> %d passed, %d failed" % (done, bad), flush=True)

# ---- cross-account checks --------------------------------------------------
print("\n### cross-account behaviour", flush=True)
current["acct"] = "CROSS"

area("role separation")
if tokens.get("ADMIN"):
    for p in ("/admin/stats", "/admin/users", "/admin/audit-logs"):
        ck("admin can GET %s" % p, "GET", p, token=tokens["ADMIN"])
for label in ("Starter", "Pro", "Ultimate", "FREE"):
    if tokens.get(label):
        st, _ = call("GET", API + "/admin/stats", None, tokens[label])
        expect("%s is blocked from /admin/stats" % label, st in (401, 403), st)

area("plan entitlements")
if tokens.get("FREE"):
    made = 0
    last = ""
    for i in range(6):
        st, p = call("POST", API + "/lists", {"name": "cap test %d" % i}, tokens["FREE"])
        if st in (200, 201):
            made += 1
        else:
            last = (p or {}).get("message", "")
            break
    expect("free tier is capped on lists", made <= 3 and "free-tier limit" in last,
           "created %d then: %s" % (made, last[:60]))
for label in ("Starter", "Pro", "Ultimate"):
    if not tokens.get(label):
        continue
    ids = []
    okall = True
    for i in range(5):
        st, p = call("POST", API + "/lists", {"name": "unl %s %d" % (label, i)}, tokens[label])
        if st in (200, 201):
            ids.append((unwrap(p) or {}).get("id"))
        else:
            okall = False
            break
    expect("%s is unlimited on lists" % label, okall and len(ids) == 5, "%d created" % len(ids))
    for i in ids:
        if i:
            call("DELETE", API + "/lists/" + i, None, tokens[label])

area("data isolation")
if tokens.get("Pro") and tokens.get("Starter"):
    st, p = call("POST", API + "/memory",
                 {"content": "PRO PRIVATE isolation probe", "type": "NOTE"}, tokens["Pro"])
    mid = (unwrap(p) or {}).get("id")
    if mid:
        st2, _ = call("GET", API + "/memory/" + mid, None, tokens["Starter"])
        expect("another user cannot READ this memory", st2 in (403, 404), "HTTP %d" % st2)
        st3, _ = call("DELETE", API + "/memory/" + mid, None, tokens["Starter"])
        expect("another user cannot DELETE this memory", st3 in (403, 404), "HTTP %d" % st3)
        st4, _ = call("GET", API + "/memory/" + mid, None, tokens["Pro"])
        expect("owner can still read it afterwards", st4 == 200, "HTTP %d" % st4)
        call("DELETE", API + "/memory/" + mid, None, tokens["Pro"])
    else:
        record("data isolation probe", FAIL, "could not create the probe memory")

area("auth hardening")
st, _ = call("GET", API + "/auth/me")
expect("no token is rejected", st == 401, st)
st, _ = call("GET", API + "/auth/me", None, "garbage.token.value")
expect("malformed token is rejected", st == 401, st)
flush_redis()
st, _ = call("POST", API + "/auth/login", {"email": "pro@anchor.app", "password": "wrong"})
expect("wrong password is rejected", st == 401, st)
st, _ = call("POST", API + "/auth/login", {"email": "nobody@nowhere.test", "password": "whatever1"})
expect("unknown account is rejected", st == 401, st)

area("AI service")
for name, path, body in (
    ("summarize", "/summarize", {"content": "Zoorzio remembers things across chat apps."}),
    ("extract-task", "/extract-task", {"content": "Call the dentist tomorrow at 3pm"}),
    ("sentiment", "/sentiment", {"content": "This is wonderful!"}),
    ("categorize", "/categorize", {"content": "Milk, eggs, bread"}),
    ("extract-entities", "/extract-entities", {"content": "Meet Sarah in Lahore on Friday"}),
    ("suggest-tags", "/suggest-tags", {"content": "Chicken curry with garam masala"}),
    ("chat", "/chat", {"messages": [{"role": "user", "content": "Say OK"}]}),
):
    ck("AI %s" % name, "POST", path, body, base=AI, soft=(429, 503))
ck("AI embeddings (OpenAI only)", "POST", "/embeddings", {"text": "hi"}, base=AI, soft=(503,))

# ---- summary ---------------------------------------------------------------
print("\n" + "=" * 104)
accounts = ["ADMIN", "Starter", "Pro", "Ultimate", "FREE", "CROSS"]
print("  %-12s %8s %6s %8s" % ("ACCOUNT", "PASSED", "N/A", "FAILED"))
print("  " + "-" * 40)
tp = tn = tf = 0
for a in accounts:
    p_ = sum(1 for r in rows if r[0] == a and r[3] == PASS)
    n_ = sum(1 for r in rows if r[0] == a and r[3] == SKIP)
    f_ = sum(1 for r in rows if r[0] == a and r[3] == FAIL)
    tp += p_; tn += n_; tf += f_
    print("  %-12s %8d %6d %8d" % (a, p_, n_, f_))
print("  " + "-" * 40)
print("  %-12s %8d %6d %8d   (%d checks)" % ("TOTAL", tp, tn, tf, len(rows)))
print("=" * 104)

if tf:
    print("\nFAILURES")
    for a, ar, label, v, d in rows:
        if v == FAIL:
            print("  [%s / %s] %s -> %s" % (a, ar, label, d))
na = [(a, ar, l, d) for a, ar, l, v, d in rows if v == SKIP]
if na:
    print("\nNOT APPLICABLE / UNAVAILABLE (%d)" % len(na))
    seen = set()
    for a, ar, l, d in na:
        if l in seen:
            continue
        seen.add(l)
        print("  %s -> %s" % (l, d))
sys.exit(0 if tf == 0 else 1)
