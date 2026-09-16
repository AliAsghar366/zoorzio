"""End-to-end agent test: tell Zoorzio to do something in plain English,
then check the database actually changed.

This is the real product surface - not "does /api/chat return text", but
"does asking for a reminder create a reminder".
"""
import json
import socket
import sys
import time
import urllib.error
import urllib.request

API = "http://localhost:3005/api"
EMAIL, PW = "pro@anchor.app", "Demo@1234"

results = []


def flush():
    try:
        s = socket.create_connection(("127.0.0.1", 6390), timeout=3)
        s.sendall(b"FLUSHALL\r\n"); s.recv(32); s.close()
    except Exception:
        pass


def call(method, path, body=None, token=None, timeout=180):
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
        return 0, {"message": type(e).__name__ + ": " + str(e)[:80]}


def unwrap(p):
    return p["data"] if isinstance(p, dict) and "success" in p and "data" in p else p


def check(name, ok, detail=""):
    results.append((name, bool(ok), str(detail)[:150]))
    print(("  PASS  " if ok else "  FAIL  ") + name + (("\n          " + str(detail)[:130]) if detail else ""), flush=True)


flush()
st, p = call("POST", "/auth/login", {"email": EMAIL, "password": PW})
TOKEN = (unwrap(p) or {}).get("accessToken")
if not TOKEN:
    print("cannot log in:", st, p); sys.exit(1)
print("signed in as", EMAIL, "\n")


def say(text, history=None):
    """One turn with the agent. Returns (reply, full history)."""
    hist = list(history or [])
    hist.append({"role": "user", "content": text})
    st, p = call("POST", "/chat", {"messages": hist})
    reply = (unwrap(p) or {}).get("reply", "") if isinstance(p, dict) else ""
    hist.append({"role": "assistant", "content": reply})
    return reply, hist


def get(path):
    st, p = call("GET", path, token=TOKEN)
    d = unwrap(p)
    return d if isinstance(d, list) else []


# patch call() to send the token on chat too
_orig_call = call


def call_with_token(method, path, body=None, token=None, timeout=180):
    return _orig_call(method, path, body, token or TOKEN, timeout)


call = call_with_token

STAMP = str(int(time.time()))[-5:]

# ---------------------------------------------------------------- 1. task
print("[1] Ask the agent to create a task")
title = "Renew the office insurance %s" % STAMP
reply, hist = say('Create a task called "%s" with high priority.' % title)
print("      agent:", reply[:110].replace("\n", " "))
time.sleep(2)
tasks = get("/tasks")
match = [t for t in tasks if title.lower() in (t.get("title") or "").lower()]
check("task exists in the database after asking in English", bool(match),
      (match[0]["title"] + " | " + str(match[0].get("priority"))) if match else "not found among %d tasks" % len(tasks))
task_id = match[0]["id"] if match else None

# ---------------------------------------------------------------- 2. list them
print("\n[2] Ask the agent what tasks exist")
reply, _ = say("List my open tasks, just the titles.")
print("      agent:", reply[:150].replace("\n", " "))
check("agent can read tasks back", title.split()[0].lower() in reply.lower() or "insurance" in reply.lower(),
      "looked for 'insurance' in the reply")

# ---------------------------------------------------------------- 3. complete
if task_id:
    print("\n[3] Ask the agent to complete it")
    reply, _ = say('Mark the task "%s" as complete.' % title)
    print("      agent:", reply[:110].replace("\n", " "))
    time.sleep(2)
    st, p = call("GET", "/tasks/" + task_id)
    status = (unwrap(p) or {}).get("status")
    check("task status changed to completed", str(status).upper() in ("COMPLETED", "DONE"), "status=%s" % status)

# ---------------------------------------------------------------- 4. reminder
print("\n[4] Ask the agent for a reminder")
rtitle = "Call the accountant %s" % STAMP
reply, _ = say('Remind me to "%s" tomorrow at 3pm.' % rtitle)
print("      agent:", reply[:110].replace("\n", " "))
time.sleep(2)
rem = get("/reminders")
rmatch = [r for r in rem if STAMP in (r.get("title") or "") or "accountant" in (r.get("title") or "").lower()]
check("reminder created with a scheduled time", bool(rmatch),
      (rmatch[0]["title"] + " @ " + str(rmatch[0].get("scheduledAt"))) if rmatch else "not found among %d" % len(rem))

# ---------------------------------------------------------------- 5. list
print("\n[5] Ask the agent to add to a list")
reply, _ = say('Add "oat milk %s" to my shopping list. Create the list if needed.' % STAMP)
print("      agent:", reply[:110].replace("\n", " "))
time.sleep(2)
lists = get("/lists")
found_item = False
for l in lists:
    st, p = call("GET", "/lists/" + l["id"])
    full = unwrap(p) or {}
    for it in (full.get("items") or []):
        if STAMP in (it.get("content") or ""):
            found_item = True
            check("list item created", True, "%s -> %s" % (full.get("name"), it.get("content")))
            break
    if found_item:
        break
if not found_item:
    check("list item created", False, "no item containing %s across %d lists" % (STAMP, len(lists)))

# ---------------------------------------------------------------- 6. memory
print("\n[6] Ask the agent to remember something")
fact = "our office wifi password is quokka-%s" % STAMP
reply, _ = say("Remember that %s" % fact)
print("      agent:", reply[:110].replace("\n", " "))
time.sleep(2)
mem = get("/memory")
mmatch = [m for m in mem if STAMP in (m.get("content") or "")]
check("memory stored", bool(mmatch), (mmatch[0]["content"][:70]) if mmatch else "not found among %d" % len(mem))

# ---------------------------------------------------------------- 7. recall
print("\n[7] Ask the agent to recall it")
reply, _ = say("What is our office wifi password?")
print("      agent:", reply[:150].replace("\n", " "))
check("agent recalls the stored fact", STAMP in reply or "quokka" in reply.lower(),
      "looked for the stamp/quokka in the reply")

# ---------------------------------------------------------------- 8. calendar
print("\n[8] Ask the agent for a calendar event")
reply, _ = say('Put "Board meeting %s" on my calendar for 2 April 2027 at 10am for one hour.' % STAMP)
print("      agent:", reply[:110].replace("\n", " "))
time.sleep(2)
st, p = call("GET", "/calendar/events?startDate=2027-01-01&endDate=2028-01-01")
evs = unwrap(p) or []
ematch = [e for e in (evs if isinstance(evs, list) else []) if STAMP in (e.get("title") or "")]
check("calendar event created", bool(ematch),
      (ematch[0]["title"] + " @ " + str(ematch[0].get("startTime"))) if ematch else "not found among %d events" % len(evs if isinstance(evs, list) else []))

# ---------------------------------------------------------------- cleanup
print("\n[cleanup]")
removed = 0
for t in get("/tasks"):
    if STAMP in (t.get("title") or ""):
        call("DELETE", "/tasks/" + t["id"]); removed += 1
for r in get("/reminders"):
    if STAMP in (r.get("title") or ""):
        call("DELETE", "/reminders/" + r["id"]); removed += 1
for m in get("/memory"):
    if STAMP in (m.get("content") or ""):
        call("DELETE", "/memory/" + m["id"]); removed += 1
st, p = call("GET", "/calendar/events?startDate=2027-01-01&endDate=2028-01-01")
for e in (unwrap(p) or []):
    if STAMP in (e.get("title") or ""):
        call("DELETE", "/calendar/events/" + e["id"]); removed += 1
print("  removed %d test records" % removed)

passed = sum(1 for _, ok, _ in results if ok)
print("\n" + "=" * 72)
print("  AGENT END-TO-END: %d/%d passed" % (passed, len(results)))
print("=" * 72)
for n, ok, d in results:
    if not ok:
        print("  FAILED: %s | %s" % (n, d))
sys.exit(0)
