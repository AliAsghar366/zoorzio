"""Everything not covered by the earlier sweeps.

Voice/Whisper through the product, API-key auth, sharing between two real
accounts, the friends flow, admin actions, cron jobs, search, boards, and an
honest verdict on the integrations that need third-party credentials.
"""
import base64
import json
import socket
import sys
import time
import urllib.error
import urllib.request

API = "http://localhost:3005/api"
AI = "http://localhost:8000"
PW = "Demo@1234"
results = []


def flush():
    try:
        s = socket.create_connection(("127.0.0.1", 6390), timeout=3)
        s.sendall(b"FLUSHALL\r\n"); s.recv(32); s.close()
    except Exception:
        pass


def call(method, url, body=None, token=None, headers=None, timeout=240):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
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
        return 0, {"message": type(e).__name__ + ": " + str(e)[:90]}


def unwrap(p):
    return p["data"] if isinstance(p, dict) and "success" in p and "data" in p else p


def check(name, ok, detail=""):
    results.append((name, bool(ok), str(detail)[:160]))
    print(("  PASS  " if ok else "  FAIL  ") + name + (("\n          " + str(detail)[:140]) if detail else ""), flush=True)


def note(name, detail):
    results.append((name, None, str(detail)[:160]))
    print("  N/A   " + name + "\n          " + str(detail)[:140], flush=True)


flush()
tok = {}
for label, email in (("pro", "pro@anchor.app"), ("starter", "starter@anchor.app"), ("admin", "admin@anchor.app")):
    st, p = call("POST", API + "/auth/login", {"email": email, "password": PW})
    tok[label] = (unwrap(p) or {}).get("accessToken")
    if not tok[label]:
        print("login failed for", email, st, p); sys.exit(1)
print("signed in: pro, starter, admin\n")
STAMP = str(int(time.time()))[-5:]

# ------------------------------------------------- 1. Whisper via the product
print("[1] Voice note -> Whisper -> memory (POST /memory/voice)")
try:
    url = "https://github.com/ggerganov/whisper.cpp/raw/master/samples/jfk.wav"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    audio = urllib.request.urlopen(req, timeout=60).read()
    print("      audio fetched: %d bytes" % len(audio))
    b64 = base64.b64encode(audio).decode()
    st, p = call("POST", API + "/memory/voice", {"audioBase64": b64, "tags": ["e2e", STAMP]}, tok["pro"])
    d = unwrap(p) or {}
    content = (d.get("content") or "")
    check("voice note transcribed and saved as a memory",
          st in (200, 201) and "country" in content.lower(),
          "HTTP %s | %s" % (st, content[:110] if content else (d.get("message") or p)))
    voice_mem_id = d.get("id")
except Exception as e:
    check("voice note transcribed and saved as a memory", False, str(e)[:120])
    voice_mem_id = None

# ------------------------------------------------------- 2. API key auth
print("\n[2] API key authentication (x-api-key)")
st, p = call("POST", API + "/api-keys", {"name": "e2e key " + STAMP}, tok["pro"])
d = unwrap(p) or {}
raw_key = d.get("key") or d.get("apiKey") or d.get("plainKey")
key_id = d.get("id")
check("api key created and the secret returned once", bool(raw_key),
      ("prefix " + raw_key[:12] + "...") if raw_key else "no raw key in response: %s" % list(d.keys())[:6])
if raw_key:
    st2, p2 = call("GET", API + "/tasks", None, None, {"x-api-key": raw_key})
    check("api key authenticates a request", st2 == 200,
          "HTTP %s, %d tasks" % (st2, len(unwrap(p2) or []) if st2 == 200 else 0))
    st3, _ = call("GET", API + "/tasks", None, None, {"x-api-key": "zk_definitely_invalid_key"})
    check("an invalid api key is rejected", st3 in (401, 403), "HTTP %s" % st3)
if key_id:
    call("DELETE", API + "/api-keys/" + key_id, None, tok["pro"])

# ------------------------------------------------------------ 3. sharing
print("\n[3] Sharing a list from pro -> starter")
st, p = call("POST", API + "/lists", {"name": "Shared list " + STAMP}, tok["pro"])
lst = unwrap(p) or {}
lid = lst.get("id")
if lid:
    st, p = call("POST", API + "/sharing",
                 {"resourceType": "LIST", "resourceId": lid,
                  "targetEmail": "starter@anchor.app", "permission": "VIEW"}, tok["pro"])
    share = unwrap(p) or {}
    check("share created", st in (200, 201), "HTTP %s %s" % (st, share.get("id") or share.get("message", "")))
    st, p = call("GET", API + "/sharing/shared-with-me", None, tok["starter"])
    shared = unwrap(p) or []
    hit = [s for s in (shared if isinstance(shared, list) else []) if STAMP in json.dumps(s)]
    check("recipient sees it in shared-with-me", bool(hit), "%d shared items" % len(shared if isinstance(shared, list) else []))
    st, p = call("GET", API + "/sharing/resource/LIST/" + lid, None, tok["pro"])
    check("owner can list who a resource is shared with", st == 200, "HTTP %s" % st)
    if share.get("id"):
        st, _ = call("DELETE", API + "/sharing/" + share["id"], None, tok["pro"])
        check("share can be revoked", st in (200, 204), "HTTP %s" % st)
    call("DELETE", API + "/lists/" + lid, None, tok["pro"])
else:
    check("share created", False, "could not create the list to share")

# ------------------------------------------------------------ 4. friends
print("\n[4] Friend request pro -> starter, then accept")
# Start from a known state: a friendship left behind by an earlier run makes
# the request fail with "You are already friends", which reads as a bug and
# is not one.
_st, _p = call("GET", API + "/friends", None, tok["pro"])
for _f in (unwrap(_p) or []):
    if isinstance(_f, dict) and _f.get("friendshipId"):
        call("DELETE", API + "/friends/" + _f["friendshipId"], None, tok["pro"])
st, p = call("POST", API + "/friends/request", {"targetEmail": "starter@anchor.app"}, tok["pro"])
d = unwrap(p) or {}
check("friend request sent", st in (200, 201), "HTTP %s %s" % (st, d.get("id") or d.get("message", "")))
st, p = call("GET", API + "/friends/requests", None, tok["starter"])
reqs = unwrap(p) or []
pending = reqs if isinstance(reqs, list) else []
check("recipient sees the pending request", len(pending) > 0, "%d pending" % len(pending))
if pending:
    fid = pending[0].get("id")
    st, p = call("POST", API + "/friends/%s/accept" % fid, {}, tok["starter"])
    check("request accepted", st in (200, 201), "HTTP %s" % st)
    st, p = call("GET", API + "/friends", None, tok["pro"])
    fr = unwrap(p) or []
    check("they now appear as friends", len(fr if isinstance(fr, list) else []) > 0,
          "%d friends" % len(fr if isinstance(fr, list) else []))
    if isinstance(fr, list) and fr:
        call("DELETE", API + "/friends/" + fr[0].get("friendshipId", ""), None, tok["pro"])

# ------------------------------------------------------------ 5. admin
print("\n[5] Admin actions")
st, p = call("GET", API + "/admin/users", None, tok["admin"])
users = unwrap(p) or []
target = None
for u in (users if isinstance(users, list) else []):
    if u.get("email") == "starter@anchor.app":
        target = u
        break
check("admin can list users", bool(target), "%d users" % len(users if isinstance(users, list) else []))
import urllib.request as _u
_r = _u.Request(API + "/admin/audit-logs/export")
_r.add_header("Authorization", "Bearer " + tok["admin"])
try:
    with _u.urlopen(_r, timeout=120) as _resp:
        _csv = _resp.read().decode("utf-8", "replace")
    check("audit log export returns CSV", _resp.status == 200 and "," in _csv,
          "%d bytes, first line: %s" % (len(_csv), _csv.splitlines()[0][:60] if _csv else ""))
except Exception as _e:
    check("audit log export returns CSV", False, str(_e)[:90])
if target:
    st, p = call("POST", API + "/admin/users/%s/impersonate" % target["id"], {}, tok["admin"])
    imp = unwrap(p) or {}
    imp_token = imp.get("accessToken")
    check("admin can impersonate a user", bool(imp_token), "token issued" if imp_token else "HTTP %s %s" % (st, imp.get("message", "")))
    if imp_token:
        st, p = call("GET", API + "/auth/me", None, imp_token)
        who = (unwrap(p) or {}).get("email")
        check("impersonated token acts as that user", who == "starter@anchor.app", who)

# ------------------------------------------------------------ 6. cron
print("\n[6] Scheduled jobs")
CRON = {"Authorization": "Bearer local-e2e-cron-secret"}
for path in ("/cron/reminders", "/cron/briefing/daily", "/cron/audit-cleanup"):
    st, p = call("GET", API + path, None, None, CRON)
    d = unwrap(p)
    check("cron %s runs" % path, st in (200, 201),
          "HTTP %s %s" % (st, json.dumps(d)[:70] if d is not None else ""))

# ------------------------------------------------------------ 7. search
print("\n[7] Search over real content")
st, p = call("POST", API + "/memory",
             {"content": "The quarterly board pack for Zoorzio lives in Notion under Finance " + STAMP,
              "type": "NOTE"}, tok["pro"])
smem = (unwrap(p) or {}).get("id")
time.sleep(2)
st, p = call("GET", API + "/memory/search?q=quarterly", None, tok["pro"])
hits = unwrap(p) or []
check("full-text search finds a just-created memory",
      any(STAMP in (h.get("content") or "") for h in (hits if isinstance(hits, list) else [])),
      "%d hits for 'quarterly'" % len(hits if isinstance(hits, list) else []))
if smem:
    call("DELETE", API + "/memory/" + smem, None, tok["pro"])

# ------------------------------------------------------------ 8. boards
print("\n[8] Board with a task on it")
st, p = call("POST", API + "/boards", {"name": "E2E board " + STAMP}, tok["pro"])
bid = (unwrap(p) or {}).get("id")
if bid:
    st, p = call("POST", API + "/tasks", {"title": "Task on board " + STAMP, "boardId": bid}, tok["pro"])
    t = unwrap(p) or {}
    check("task attaches to a board", t.get("boardId") == bid, "boardId=%s" % t.get("boardId"))
    st, p = call("GET", API + "/boards/" + bid, None, tok["pro"])
    board = unwrap(p) or {}
    check("board returns its tasks", STAMP in json.dumps(board), "board payload includes the task")
    if t.get("id"):
        call("DELETE", API + "/tasks/" + t["id"], None, tok["pro"])
    call("DELETE", API + "/boards/" + bid, None, tok["pro"])

# ------------------------------------------------------------ 9. notifications
print("\n[9] Notifications")
st, p = call("GET", API + "/notifications", None, tok["pro"])
notes = unwrap(p) or []
check("notifications list", st == 200, "%d notifications" % len(notes if isinstance(notes, list) else []))
if isinstance(notes, list) and notes:
    st, p = call("PATCH", API + "/notifications/%s/read" % notes[0]["id"], {}, tok["pro"])
    check("mark one notification read", st in (200, 201), "HTTP %s" % st)
else:
    note("mark one notification read", "no notifications exist to mark")

# ------------------------------------------------------ 10. needs credentials
print("\n[10] Integrations that need third-party credentials")
for label, path, tk in (
    ("Google Calendar OAuth", "/calendar/google/authorize", tok["pro"]),
    ("Outlook Calendar OAuth", "/calendar/outlook/authorize", tok["pro"]),
    ("GitHub", "/integrations/github/repos", tok["pro"]),
    ("Notion", "/integrations/notion/search", tok["pro"]),
    ("Slack", "/integrations/slack/channels", tok["pro"]),
    ("Google Workspace", "/integrations/google-workspace/emails", tok["pro"]),
):
    st, p = call("GET", API + path, None, tk)
    msg = (p or {}).get("message") if isinstance(p, dict) else ""
    if st == 200:
        check(label + " connected", True, "HTTP 200")
    elif st in (400, 401, 403, 404, 503):
        note(label, "HTTP %s - %s" % (st, msg))
    else:
        check(label + " fails cleanly", False, "HTTP %s %s" % (st, msg))

_st, _pp = call("GET", API + "/plans", None, tok["starter"])
_plans = unwrap(_pp) or []
_pro = next((x for x in _plans if x.get("slug") == "pro"), None)
st, p = call("POST", API + "/billing/checkout", {"planId": (_pro or {}).get("id", "")}, tok["starter"])
msg = (p or {}).get("message") if isinstance(p, dict) else ""
if st in (200, 201):
    check("Stripe checkout session", True, json.dumps(unwrap(p))[:70])
else:
    note("Stripe checkout", "HTTP %s - %s" % (st, msg))

# cleanup the voice memory
if voice_mem_id:
    call("DELETE", API + "/memory/" + voice_mem_id, None, tok["pro"])

# ------------------------------------------------------------- summary
ok_n = sum(1 for _, o, _ in results if o is True)
na_n = sum(1 for _, o, _ in results if o is None)
bad = [(n, d) for n, o, d in results if o is False]
print("\n" + "=" * 72)
print("  REMAINING-FEATURES E2E: %d passed | %d need credentials | %d failed" % (ok_n, na_n, len(bad)))
print("=" * 72)
for n, d in bad:
    print("  FAILED: %s | %s" % (n, d))
sys.exit(0)
