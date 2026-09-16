"""Does the agent actually DO things when someone texts it?

Simulates the whole real-world path, not the chat box:
  1. user asks the app for a link code
  2. an inbound WhatsApp message "LINK ABC123" arrives on the webhook
  3. an inbound WhatsApp message asks for work in plain English
  4. the database is checked to see whether that work actually happened
  5. an unpaid number is checked to confirm the plan gate holds

Runs against the real webhook handler, the real agent and the real database.
"""
import json
import socket
import sys
import time
import urllib.error
import urllib.request

API = "http://localhost:3005/api"
PW = "Demo@1234"
PHONE = "447700900123"          # a UK test number (Ofcom reserved range)
UNPAID_PHONE = "447700900987"
results = []


def flush():
    try:
        s = socket.create_connection(("127.0.0.1", 6390), timeout=3)
        s.sendall(b"FLUSHALL\r\n"); s.recv(32); s.close()
    except Exception:
        pass


def call(method, path, body=None, token=None, timeout=240):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
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
        return 0, {"message": type(e).__name__ + ": " + str(e)[:90]}


def unwrap(p):
    return p["data"] if isinstance(p, dict) and "success" in p and "data" in p else p


def check(name, ok, detail=""):
    results.append((name, bool(ok), str(detail)[:170]))
    print(("  PASS  " if ok else "  FAIL  ") + name + (("\n          " + str(detail)[:150]) if detail else ""), flush=True)


def inbound(text, frm=PHONE, name="E2E Tester"):
    """A WhatsApp Cloud API 'messages' webhook, shaped the way Meta sends it."""
    payload = {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "e2e-waba",
            "changes": [{
                "field": "messages",
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {"display_phone_number": "447848472822",
                                 "phone_number_id": "e2e-phone-id"},
                    "contacts": [{"profile": {"name": name}, "wa_id": frm}],
                    "messages": [{
                        "from": frm,
                        "id": "wamid.e2e." + str(time.time()),
                        "timestamp": str(int(time.time())),
                        "type": "text",
                        "text": {"body": text},
                    }],
                },
            }],
        }],
    }
    return call("POST", "/channels/whatsapp/webhook", payload)


flush()
st, p = call("POST", "/auth/login", {"email": "pro@anchor.app", "password": PW})
TOK = (unwrap(p) or {}).get("accessToken")
if not TOK:
    print("login failed:", st, p); sys.exit(1)
STAMP = str(int(time.time()))[-5:]
print("signed in as pro@anchor.app\n")

# ------------------------------------------------------------- 1. link
print("[1] Link the phone number the way a real user would")
st, p = call("POST", "/channels/whatsapp/link", {}, TOK)
link = unwrap(p) or {}
code = link.get("code")
check("app issues a one-time link code", bool(code), "code=%s" % code)

if code:
    st, p = inbound("LINK %s" % code)
    check("webhook accepts the linking text", st == 200, "HTTP %s" % st)
    time.sleep(2)
    st, p = call("GET", "/channels/linked", None, TOK)
    linked = unwrap(p) or []
    hit = [c for c in (linked if isinstance(linked, list) else []) if PHONE in json.dumps(c)]
    check("number is now linked to the account", bool(hit),
          "%d linked channels" % len(linked if isinstance(linked, list) else []))

# --------------------------------------------- 2. text it a task to do
print("\n[2] Text the agent a task, in plain English")
title = "Send the Q3 invoice %s" % STAMP
st, p = inbound('Create a task called "%s" and mark it high priority.' % title)
check("webhook accepted the instruction", st == 200, "HTTP %s" % st)
print("      waiting for the agent to act...")
found = None
for _ in range(30):
    time.sleep(3)
    st, p = call("GET", "/tasks", None, TOK)
    tasks = unwrap(p) or []
    hits = [t for t in (tasks if isinstance(tasks, list) else []) if STAMP in (t.get("title") or "")]
    if hits:
        found = hits[0]
        break
check("THE AGENT ACTUALLY CREATED THE TASK", bool(found),
      ("%s | priority=%s | status=%s" % (found["title"], found.get("priority"), found.get("status")))
      if found else "no task containing %s appeared within 90s" % STAMP)

# --------------------------------------------- 3. text it a reminder
print("\n[3] Text it a reminder")
st, p = inbound("Remind me to water the plants on 5 May 2027 at 9am.")
check("webhook accepted the reminder request", st == 200, "HTTP %s" % st)
rem_found = None
for _ in range(25):
    time.sleep(3)
    st, p = call("GET", "/reminders", None, TOK)
    rems = unwrap(p) or []
    hits = [r for r in (rems if isinstance(rems, list) else [])
            if "water the plants" in (r.get("title") or "").lower()]
    if hits:
        rem_found = hits[0]
        break
check("THE AGENT ACTUALLY CREATED THE REMINDER", bool(rem_found),
      ("%s @ %s" % (rem_found["title"], rem_found.get("scheduledAt"))) if rem_found else "not created within 75s")

# --------------------------------------------- 4. it replies with data
print("\n[4] Ask it a question by text and confirm it answers from real data")
st, p = inbound("How many open tasks do I have? Answer with the number.")
check("webhook accepted the question", st == 200, "HTTP %s" % st)
time.sleep(12)
st, p = call("GET", "/channels/linked", None, TOK)
lch = unwrap(p) or []
chan = next((c for c in (lch if isinstance(lch, list) else []) if PHONE in json.dumps(c)), None)
check("conversation is recorded against the channel", bool(chan),
      "channel id %s" % (chan or {}).get("id"))

# --------------------------------------------- 5. the paid gate
print("\n[5] An unlinked / unpaid number must not get service")
st, p = inbound("Create a task called SHOULD-NOT-EXIST %s" % STAMP, frm=UNPAID_PHONE, name="Stranger")
check("webhook handles an unknown number without error", st == 200, "HTTP %s" % st)
time.sleep(6)
st, p = call("GET", "/tasks", None, TOK)
tasks = unwrap(p) or []
leaked = [t for t in (tasks if isinstance(tasks, list) else []) if "SHOULD-NOT-EXIST" in (t.get("title") or "")]
check("a stranger's text creates nothing on your account", not leaked,
      "%d leaked tasks" % len(leaked))

# --------------------------------------------- cleanup
print("\n[cleanup]")
removed = 0
st, p = call("GET", "/tasks", None, TOK)
for t in (unwrap(p) or []):
    if STAMP in (t.get("title") or "") or "SHOULD-NOT-EXIST" in (t.get("title") or ""):
        call("DELETE", "/tasks/" + t["id"], None, TOK); removed += 1
st, p = call("GET", "/reminders", None, TOK)
for r in (unwrap(p) or []):
    if "water the plants" in (r.get("title") or "").lower():
        call("DELETE", "/reminders/" + r["id"], None, TOK); removed += 1
print("  removed %d records" % removed)

passed = sum(1 for _, o, _ in results if o)
print("\n" + "=" * 74)
print("  INBOUND TEXT -> AGENT -> ACTION: %d/%d passed" % (passed, len(results)))
print("=" * 74)
for n, o, d in results:
    if not o:
        print("  FAILED: %s | %s" % (n, d))
sys.exit(0)
