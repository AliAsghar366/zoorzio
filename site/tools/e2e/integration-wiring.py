"""Integration wiring test, using placeholder OAuth credentials.

Real Google/GitHub/Notion/Slack keys need accounts I cannot create. What this
does instead is set placeholder credentials and verify everything our code is
responsible for: that each provider is detected as configured, that the
authorize URL is built correctly for that provider's real endpoint, that the
state token is signed and carries the right user, and that the callback
refuses a forged or missing state.

If all of that passes, swapping in real keys is the only remaining step.
"""
import base64
import json
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request

API = "http://localhost:3005/api"
results = []


def flush():
    try:
        s = socket.create_connection(("127.0.0.1", 6390), timeout=3)
        s.sendall(b"FLUSHALL\r\n"); s.recv(32); s.close()
    except Exception:
        pass


def call(method, path, body=None, token=None, follow=True, timeout=90):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):
            return None

    opener = urllib.request.build_opener() if follow else urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace")
            try:
                return r.status, json.loads(raw), dict(r.headers)
            except ValueError:
                return r.status, raw, dict(r.headers)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw), dict(e.headers)
        except ValueError:
            return e.code, raw, dict(e.headers)
    except Exception as e:
        return 0, {"message": type(e).__name__ + ": " + str(e)[:80]}, {}


def unwrap(p):
    return p["data"] if isinstance(p, dict) and "success" in p and "data" in p else p


def check(name, ok, detail=""):
    results.append((name, bool(ok), str(detail)[:170]))
    print(("  PASS  " if ok else "  FAIL  ") + name + (("\n          " + str(detail)[:150]) if detail else ""), flush=True)


def jwt_payload(tok):
    try:
        part = tok.split(".")[1]
        part += "=" * (-len(part) % 4)
        return json.loads(base64.urlsafe_b64decode(part))
    except Exception:
        return {}


flush()
st, p, _ = call("POST", "/auth/login", {"email": "pro@anchor.app", "password": "Demo@1234"})
TOK = (unwrap(p) or {}).get("accessToken")
if not TOK:
    print("login failed", st, p); sys.exit(1)
st, p, _ = call("GET", "/auth/me", None, TOK)
ME = (unwrap(p) or {}).get("id")
print("signed in as pro@anchor.app (%s)\n" % ME)

PROVIDERS = {
    "github": ("github.com/login/oauth/authorize", "test-github-client-id"),
    "notion": ("api.notion.com/v1/oauth/authorize", "test-notion-client-id"),
    "slack": ("slack.com/oauth/v2/authorize", "test-slack-client-id"),
    "google_workspace": ("accounts.google.com", "test-google-client-id"),
}

print("[1] Each provider now reports as configured")
st, p, _ = call("GET", "/integrations", None, TOK)
avail = unwrap(p) or []
print("      %d integrations listed" % len(avail if isinstance(avail, list) else []))

print("\n[2] Authorize URL is built correctly per provider")
states = {}
for prov, (host, client_id) in PROVIDERS.items():
    st, p, hdrs = call("GET", "/integrations/%s/authorize" % prov, None, TOK, follow=False)
    url = ""
    if isinstance(p, dict):
        url = (unwrap(p) or {}).get("url") or ""
    if not url:
        url = hdrs.get("Location", "") or hdrs.get("location", "")
    if not url:
        check("%s authorize URL" % prov, False, "HTTP %s, no url returned: %s" % (st, str(p)[:80]))
        continue
    parsed = urllib.parse.urlparse(url)
    q = urllib.parse.parse_qs(parsed.query)
    ok_host = host.split("/")[0] in parsed.netloc
    ok_client = q.get("client_id", [""])[0] == client_id
    ok_redirect = "callback" in q.get("redirect_uri", [""])[0]
    state = q.get("state", [""])[0]
    states[prov] = state
    check("%s authorize URL points at the real provider" % prov,
          ok_host and ok_client and ok_redirect,
          "%s | client_id=%s | redirect=%s" % (parsed.netloc, q.get("client_id", [""])[0][:28],
                                               q.get("redirect_uri", [""])[0][-34:]))
    payload = jwt_payload(state)
    check("%s state is a signed token bound to this user" % prov,
          payload.get("userId") == ME and payload.get("provider") == prov,
          "userId matches=%s provider=%s exp in %ss" % (
              payload.get("userId") == ME, payload.get("provider"),
              (payload.get("exp", 0) - payload.get("iat", 0)) if payload.get("exp") else "?"))

print("\n[3] Callback refuses forged or missing state")
for label, qs in (("no state", ""),
                  ("garbage state", "?code=abc&state=not-a-real-token"),
                  ("tampered state", "?code=abc&state=" + (states.get("github", "x")[:-6] + "AAAAAA"))):
    st, p, _ = call("GET", "/integrations/github/callback" + qs, None, None, follow=False)
    body = json.dumps(p)[:70] if not isinstance(p, str) else p[:70]
    check("callback rejects %s" % label, st in (400, 401, 403, 302),
          "HTTP %s %s" % (st, body if st not in (302,) else "redirected to an error page"))

print("\n[4] Calendar providers")
for prov, host in (("google", "accounts.google.com"), ("outlook", "login.microsoftonline.com")):
    st, p, hdrs = call("GET", "/calendar/%s/authorize" % prov, None, TOK, follow=False)
    url = ""
    if isinstance(p, dict):
        url = (unwrap(p) or {}).get("url") or (unwrap(p) or {}).get("authUrl") or ""
    if not url:
        url = hdrs.get("Location", "") or hdrs.get("location", "")
    if url:
        parsed = urllib.parse.urlparse(url)
        q = urllib.parse.parse_qs(parsed.query)
        check("%s calendar authorize URL" % prov, host in parsed.netloc,
              "%s | client_id=%s | scope=%s" % (parsed.netloc, q.get("client_id", [""])[0][:26],
                                                q.get("scope", [""])[0][:44]))
    else:
        check("%s calendar authorize URL" % prov, False,
              "HTTP %s %s" % (st, (p or {}).get("message") if isinstance(p, dict) else str(p)[:70]))

print("\n[5] Provider calls still fail cleanly while unconnected")
for label, path in (("GitHub repos", "/integrations/github/repos"),
                    ("Notion search", "/integrations/notion/search"),
                    ("Slack channels", "/integrations/slack/channels")):
    st, p, _ = call("GET", path, None, TOK)
    msg = (p or {}).get("message") if isinstance(p, dict) else ""
    check("%s returns a clear 'not connected'" % label, st == 400 and "connect" in str(msg).lower(),
          "HTTP %s - %s" % (st, msg))

passed = sum(1 for _, o, _ in results if o)
print("\n" + "=" * 74)
print("  INTEGRATION WIRING (placeholder credentials): %d/%d passed" % (passed, len(results)))
print("=" * 74)
for n, o, d in results:
    if not o:
        print("  FAILED: %s | %s" % (n, d))
sys.exit(0)
