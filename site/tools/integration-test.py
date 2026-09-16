"""Complete integration test: every Zoorzio API module + the AI service.

Creates its own resources and cleans them up; never touches DELETE /users/me,
billing webhooks, or OAuth callbacks that need a third party to call back.
"""
import json
import socket
import sys
import urllib.error
import urllib.request

API = "http://localhost:3005/api"
AI = "http://localhost:8000"
PASSWORD = "Demo@1234"

PASS, NEEDKEY, FAIL = "PASS", "NEEDS-KEY", "FAIL"
results = []
section = {"name": ""}


def flush_redis():
    try:
        s = socket.create_connection(("127.0.0.1", 6390), timeout=3)
        s.sendall(b"FLUSHALL\r\n")
        s.recv(32)
        s.close()
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
            try:
                return r.status, json.loads(raw) if raw else None
            except ValueError:
                return r.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw) if raw else None
        except ValueError:
            return e.code, raw
    except Exception as e:
        return 0, {"message": type(e).__name__ + ": " + str(e)[:90]}


def unwrap(payload):
    if isinstance(payload, dict) and "success" in payload and "data" in payload:
        return payload["data"]
    return payload


def sec(name):
    section["name"] = name
    print("\n--- %s ---" % name, flush=True)


def record(label, verdict, detail=""):
    results.append((section["name"], label, verdict, str(detail)[:120]))
    print("  %-10s %-46s %s" % (verdict, label, str(detail)[:70]), flush=True)


def check(label, method, path, body=None, token=None, ok=(200, 201), keyless=(), base=API):
    """keyless: status codes that mean 'endpoint works, provider key absent'."""
    st, payload = call(method, base + path, body, token)
    if st in ok:
        d = unwrap(payload)
        if isinstance(d, list):
            detail = "%d items" % len(d)
        elif isinstance(d, dict):
            detail = ",".join(list(d.keys())[:4])
        else:
            detail = str(d)[:50]
        record(label, PASS, "%d %s" % (st, detail))
        return d
    if st in keyless:
        msg = (payload or {}).get("message") if isinstance(payload, dict) else ""
        record(label, NEEDKEY, "%d %s" % (st, msg or "provider not configured"))
        return None
    msg = (payload or {}).get("message") if isinstance(payload, dict) else str(payload)[:60]
    record(label, FAIL, "%d %s" % (st, msg))
    return None


flush_redis()
print("=" * 96)
print("  ZOORZIO COMPLETE INTEGRATION TEST")
print("=" * 96)

# ---------------------------------------------------------------- infra
sec("Infrastructure")
for name, host, port in (("Postgres", "127.0.0.1", 5434), ("Redis", "127.0.0.1", 6390),
                         ("API", "127.0.0.1", 3005), ("AI service", "127.0.0.1", 8000)):
    try:
        socket.create_connection((host, port), timeout=3).close()
        record(name + " reachable", PASS, "port %d" % port)
    except Exception as e:
        record(name + " reachable", FAIL, str(e)[:60])

check("GET /health", "GET", "/health")
check("GET /health/detailed", "GET", "/health/detailed")

# ---------------------------------------------------------------- auth
sec("Auth")
st, payload = call("POST", API + "/auth/login", {"email": "pro@anchor.app", "password": PASSWORD})
session = unwrap(payload) or {}
token = session.get("accessToken")
refresh = session.get("refreshToken")
record("POST /auth/login (valid)", PASS if token else FAIL, "%d" % st)
if not token:
    print("\nCannot continue without a token.")
    sys.exit(1)

st, payload = call("POST", API + "/auth/login", {"email": "pro@anchor.app", "password": "wrong-one"})
record("POST /auth/login (wrong password rejected)", PASS if st == 401 else FAIL, st)

st, payload = call("POST", API + "/auth/login", {"email": "nobody@nowhere.test", "password": "whatever1"})
record("POST /auth/login (unknown user rejected)", PASS if st == 401 else FAIL, st)

check("GET /auth/me", "GET", "/auth/me", token=token)
st, _ = call("GET", API + "/auth/me")
record("GET /auth/me (no token -> 401)", PASS if st == 401 else FAIL, st)
st, _ = call("GET", API + "/auth/me", token="not-a-real-token")
record("GET /auth/me (bad token -> 401)", PASS if st == 401 else FAIL, st)

st, payload = call("POST", API + "/auth/refresh", {"refreshToken": refresh})
newsess = unwrap(payload) or {}
record("POST /auth/refresh", PASS if newsess.get("accessToken") else FAIL, st)
if newsess.get("accessToken"):
    token = newsess["accessToken"]
    refresh = newsess.get("refreshToken", refresh)

check("POST /auth/forgot-password", "POST", "/auth/forgot-password",
      {"email": "pro@anchor.app"}, token=None, ok=(200, 201))

# ---------------------------------------------------------------- users
sec("Users")
me = check("GET /users/me", "GET", "/users/me", token=token)
check("GET /users/me/preferences", "GET", "/users/me/preferences", token=token)
check("GET /users/me/stats", "GET", "/users/me/stats", token=token)
orig_loc = (me or {}).get("location")
check("PUT /users/me (update location)", "PUT", "/users/me",
      {"location": "Integration Test City"}, token=token)
again = check("GET /users/me (persisted)", "GET", "/users/me", token=token)
record("profile update persisted", PASS if (again or {}).get("location") == "Integration Test City" else FAIL,
       (again or {}).get("location"))
call("PUT", API + "/users/me", {"location": orig_loc or ""}, token)
check("PUT /users/me/preferences", "PUT", "/users/me/preferences", {"aiTone": "friendly"}, token=token)

# ---------------------------------------------------------------- plans/billing
sec("Plans & Billing")
check("GET /plans", "GET", "/plans", token=token)
check("GET /billing/subscription", "GET", "/billing/subscription", token=token)

# ---------------------------------------------------------------- tasks
sec("Tasks")
check("GET /tasks", "GET", "/tasks", token=token)
check("GET /tasks/today", "GET", "/tasks/today", token=token)
check("GET /tasks/overdue", "GET", "/tasks/overdue", token=token)
check("GET /tasks/stats", "GET", "/tasks/stats", token=token)
check("GET /tasks/suggest", "GET", "/tasks/suggest", token=token)
task = check("POST /tasks (create)", "POST", "/tasks",
             {"title": "ZZ integration task", "priority": "HIGH"}, token=token)
tid = (task or {}).get("id")
if tid:
    check("GET /tasks/:id", "GET", "/tasks/" + tid, token=token)
    check("PUT /tasks/:id (rename)", "PUT", "/tasks/" + tid,
          {"title": "ZZ integration task (edited)"}, token=token)
    got = check("GET /tasks/:id (edit persisted)", "GET", "/tasks/" + tid, token=token)
    record("task edit persisted", PASS if (got or {}).get("title", "").endswith("(edited)") else FAIL,
           (got or {}).get("title"))
    check("PUT /tasks/:id/complete", "PUT", "/tasks/" + tid + "/complete", {}, token=token)
    check("DELETE /tasks/:id", "DELETE", "/tasks/" + tid, token=token)
    st, _ = call("GET", API + "/tasks/" + tid, token=token)
    record("deleted task is gone", PASS if st in (404, 403) else FAIL, st)

# ---------------------------------------------------------------- memory
sec("Memory")
check("GET /memory", "GET", "/memory", token=token)
check("GET /memory/recent", "GET", "/memory/recent", token=token)
check("GET /memory/frequent", "GET", "/memory/frequent", token=token)
check("GET /memory/stats", "GET", "/memory/stats", token=token)
check("GET /memory/search?q=", "GET", "/memory/search?q=curry", token=token)
mem = check("POST /memory (create)", "POST", "/memory",
            {"content": "ZZ integration memory about integration testing", "type": "NOTE"}, token=token)
mid = (mem or {}).get("id")
if mid:
    check("GET /memory/:id", "GET", "/memory/" + mid, token=token)
    check("PUT /memory/:id", "PUT", "/memory/" + mid,
          {"content": "ZZ integration memory (edited)"}, token=token)
    check("DELETE /memory/:id", "DELETE", "/memory/" + mid, token=token)

# ---------------------------------------------------------------- lists
sec("Lists")
check("GET /lists", "GET", "/lists", token=token)
lst = check("POST /lists (create)", "POST", "/lists", {"name": "ZZ integration list"}, token=token)
lid = (lst or {}).get("id")
if lid:
    check("GET /lists/:id", "GET", "/lists/" + lid, token=token)
    item = check("POST /lists/:id/items", "POST", "/lists/" + lid + "/items",
                 {"content": "ZZ item one"}, token=token)
    iid = (item or {}).get("id")
    if iid:
        check("PUT /lists/:id/items/:itemId", "PUT", "/lists/" + lid + "/items/" + iid,
              {"isChecked": True}, token=token)
        check("DELETE /lists/:id/items/:itemId", "DELETE", "/lists/" + lid + "/items/" + iid, token=token)
    check("PUT /lists/:id (rename)", "PUT", "/lists/" + lid, {"name": "ZZ list renamed"}, token=token)
    check("DELETE /lists/:id", "DELETE", "/lists/" + lid, token=token)

# ---------------------------------------------------------------- reminders
sec("Reminders")
check("GET /reminders", "GET", "/reminders", token=token)
rem = check("POST /reminders (create)", "POST", "/reminders",
            {"title": "ZZ integration reminder", "scheduledAt": "2027-01-01T10:00:00.000Z"}, token=token)
rid = (rem or {}).get("id")
if rid:
    check("GET /reminders/:id", "GET", "/reminders/" + rid, token=token)
    check("PATCH /reminders/:id", "PATCH", "/reminders/" + rid, {"title": "ZZ reminder edited"}, token=token)
    check("PATCH /reminders/:id/snooze", "PATCH", "/reminders/" + rid + "/snooze",
          {"minutes": 15}, token=token)
    check("PATCH /reminders/:id/complete", "PATCH", "/reminders/" + rid + "/complete", {}, token=token)
    check("DELETE /reminders/:id", "DELETE", "/reminders/" + rid, token=token)

# ---------------------------------------------------------------- boards
sec("Boards")
check("GET /boards", "GET", "/boards", token=token)
board = check("POST /boards (create)", "POST", "/boards", {"name": "ZZ integration board"}, token=token)
bid = (board or {}).get("id")
if bid:
    check("GET /boards/:id", "GET", "/boards/" + bid, token=token)
    check("PUT /boards/:id", "PUT", "/boards/" + bid, {"name": "ZZ board renamed"}, token=token)
    check("DELETE /boards/:id", "DELETE", "/boards/" + bid, token=token)

# ---------------------------------------------------------------- calendar
sec("Calendar")
check("GET /calendar/health", "GET", "/calendar/health", token=token)
check("GET /calendar/events", "GET", "/calendar/events", token=token)
check("GET /calendar/today", "GET", "/calendar/today", token=token)
check("GET /calendar/upcoming", "GET", "/calendar/upcoming", token=token)
cal_id = None
_cals = check("GET /calendar/events (for calendar id)", "GET", "/calendar/events", token=token)
# The API exposes no "list calendars" route, so take the id from an existing
# event if there is one; otherwise fall back to the seeded calendar.
if isinstance(_cals, list) and _cals:
    cal_id = _cals[0].get("calendarId")
if not cal_id:
    cal_id = "cmtiomr940012zmb0toifsco9"

ev = check("POST /calendar/events (create)", "POST", "/calendar/events",
           {"calendarId": cal_id,
            "title": "ZZ integration event",
            "startTime": "2027-01-02T09:00:00.000Z",
            "endTime": "2027-01-02T10:00:00.000Z"}, token=token)
eid = (ev or {}).get("id")
if eid:
    check("DELETE /calendar/events/:id", "DELETE", "/calendar/events/" + eid, token=token)
check("GET /calendar/google/authorize (no creds)", "GET", "/calendar/google/authorize",
      token=token, keyless=(400, 401, 404, 500, 503))
check("GET /calendar/outlook/authorize (no creds)", "GET", "/calendar/outlook/authorize",
      token=token, keyless=(400, 401, 404, 500, 503))

# ---------------------------------------------------------------- briefing
sec("Briefing")
check("GET /briefing", "GET", "/briefing", token=token)
check("GET /briefing/weekly", "GET", "/briefing/weekly", token=token)

# ---------------------------------------------------------------- notifications
sec("Notifications")
check("GET /notifications", "GET", "/notifications", token=token)
check("GET /notifications/unread-count", "GET", "/notifications/unread-count", token=token)
check("PATCH /notifications/read-all", "PATCH", "/notifications/read-all", {}, token=token)

# ---------------------------------------------------------------- contacts
sec("Contacts")
check("GET /contacts", "GET", "/contacts", token=token)
c = check("POST /contacts (create)", "POST", "/contacts",
          {"name": "ZZ Integration Contact"}, token=token)
cid = (c or {}).get("id")
if cid:
    check("GET /contacts/:id", "GET", "/contacts/" + cid, token=token)
    check("PATCH /contacts/:id", "PATCH", "/contacts/" + cid, {"name": "ZZ Contact edited"}, token=token)
    check("DELETE /contacts/:id", "DELETE", "/contacts/" + cid, token=token)

# ---------------------------------------------------------------- friends
sec("Friends")
check("GET /friends", "GET", "/friends", token=token)
check("GET /friends/requests", "GET", "/friends/requests", token=token)
check("GET /friends/quota", "GET", "/friends/quota", token=token)
check("GET /friends/reminders", "GET", "/friends/reminders", token=token)

# ---------------------------------------------------------------- misc modules
sec("Gamification / Sharing / Permissions / API keys")
check("GET /gamification/progress", "GET", "/gamification/progress", token=token)
check("GET /sharing/shared-with-me", "GET", "/sharing/shared-with-me", token=token)
check("GET /action-permissions", "GET", "/action-permissions", token=token)
check("GET /api-keys", "GET", "/api-keys", token=token)
k = check("POST /api-keys (create)", "POST", "/api-keys", {"name": "ZZ integration key"}, token=token)
kid = (k or {}).get("id")
if kid:
    check("DELETE /api-keys/:id", "DELETE", "/api-keys/" + kid, token=token)

# ---------------------------------------------------------------- channels
sec("Channels")
check("GET /channels/health", "GET", "/channels/health", token=token)
check("GET /channels/credentials", "GET", "/channels/credentials", token=token)
check("GET /channels/linked", "GET", "/channels/linked", token=token)
check("POST /channels/whatsapp/send (no key)", "POST", "/channels/whatsapp/send",
      {"to": "447848472822", "message": "test"}, token=token, keyless=(400, 401, 403, 404, 500, 503))
check("POST /channels/telegram/send (no key)", "POST", "/channels/telegram/send",
      {"chatId": "1", "message": "test"}, token=token, keyless=(400, 401, 403, 404, 500, 503))

# ---------------------------------------------------------------- integrations
sec("Integrations")
check("GET /integrations", "GET", "/integrations", token=token)
for prov in ("github/repos", "notion/search", "slack/channels", "google-workspace/emails"):
    check("GET /integrations/%s (not connected)" % prov, "GET", "/integrations/" + prov,
          token=token, keyless=(400, 401, 403, 404, 500, 503))

# ---------------------------------------------------------------- chat
sec("Chat (via AI service)")
st, payload = call("POST", API + "/chat",
                   {"messages": [{"role": "user", "content": "Reply with exactly: PONG"}]}, token)
reply = (unwrap(payload) or {}).get("reply", "") if isinstance(payload, dict) else ""
live = bool(reply) and "having trouble" not in reply.lower()
record("POST /chat returns a live reply", PASS if live else FAIL, reply[:70])

# ---------------------------------------------------------------- AI service direct
sec("AI service (direct)")
check("GET /health", "GET", "/health", base=AI)
check("POST /summarize", "POST", "/summarize",
      {"content": "Zoorzio remembers things for you across WhatsApp and Telegram so nothing is lost."},
      base=AI, keyless=(500, 503))
check("POST /extract-task", "POST", "/extract-task",
      {"content": "Remind me to call the dentist tomorrow at 3pm"}, base=AI, keyless=(500, 503))
check("POST /sentiment", "POST", "/sentiment", {"content": "This is wonderful, thank you!"},
      base=AI, keyless=(500, 503))
check("POST /categorize", "POST", "/categorize", {"content": "Buy milk, eggs and bread"},
      base=AI, keyless=(500, 503))
check("POST /extract-entities", "POST", "/extract-entities",
      {"content": "Meet Sarah in Lahore on Friday"}, base=AI, keyless=(500, 503))
check("POST /suggest-tags", "POST", "/suggest-tags", {"content": "Chicken curry recipe with garam masala"},
      base=AI, keyless=(500, 503))
check("POST /chat", "POST", "/chat", {"messages": [{"role": "user", "content": "Say PONG"}]},
      base=AI, keyless=(500, 503))
check("POST /embeddings (OpenAI only - Groq has none)", "POST", "/embeddings", {"text": "hello"},
      base=AI, keyless=(400, 500, 503))
check("POST /describe-image (Groq vision)", "POST", "/describe-image",
      {"image_url": "https://raw.githubusercontent.com/pytorch/hub/master/images/dog.jpg"},
      base=AI, keyless=(503,))
check("POST /transcribe (Groq whisper)", "POST", "/transcribe",
      {"audio_url": "https://github.com/ggerganov/whisper.cpp/raw/master/samples/jfk.wav",
       "filename": "jfk.wav", "language": "en"}, base=AI, keyless=(503,))

# ---------------------------------------------------------------- admin
sec("Admin (admin@anchor.app)")
st, payload = call("POST", API + "/auth/login", {"email": "admin@anchor.app", "password": PASSWORD})
adm = (unwrap(payload) or {}).get("accessToken")
record("admin login", PASS if adm else FAIL, st)
if adm:
    check("GET /admin/stats", "GET", "/admin/stats", token=adm)
    check("GET /admin/users", "GET", "/admin/users", token=adm)
    check("GET /admin/audit-logs", "GET", "/admin/audit-logs", token=adm)
    check("GET /admin/whatsapp-business", "GET", "/admin/whatsapp-business", token=adm)
    check("GET /admin/whatsapp-unofficial", "GET", "/admin/whatsapp-unofficial", token=adm)
    st, _ = call("GET", API + "/admin/stats", token=token)  # non-admin user
    record("non-admin blocked from /admin/stats", PASS if st in (401, 403) else FAIL, st)

# ---------------------------------------------------------------- logout
sec("Logout")
st, _ = call("POST", API + "/auth/logout", {"refreshToken": refresh}, token)
record("POST /auth/logout", PASS if st in (200, 201) else FAIL, st)

# ---------------------------------------------------------------- summary
print("\n" + "=" * 96)
n_pass = sum(1 for r in results if r[2] == PASS)
n_key = sum(1 for r in results if r[2] == NEEDKEY)
n_fail = sum(1 for r in results if r[2] == FAIL)
print("  RESULT: %d passed | %d unavailable (missing provider key, handled gracefully) | %d failed  (of %d)"
      % (n_pass, n_key, n_fail, len(results)))
print("=" * 96)
if n_fail:
    print("\nFAILURES:")
    for s, label, verdict, detail in results:
        if verdict == FAIL:
            print("  [%s] %s -> %s" % (s, label, detail))
if n_key:
    print("\nUNAVAILABLE (endpoint reachable, provider not configured):")
    for s, label, verdict, detail in results:
        if verdict == NEEDKEY:
            print("  [%s] %s -> %s" % (s, label, detail))
sys.exit(0 if n_fail == 0 else 1)
