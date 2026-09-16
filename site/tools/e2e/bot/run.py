# -*- coding: utf-8 -*-
"""Runs the case table against the live bot and reports every failure.

Cases that only inspect the reply run concurrently. Cases that assert a
database side effect run serially, because they compare row counts before and
after and concurrency would make that meaningless.
"""
import json
import os
import re
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cases as C

API = "http://localhost:3005/api"
PSQL = r"C:\Program Files\PostgreSQL\15\bin\psql"
EMAIL, PW = "pro@anchor.app", "Demo@1234"
WORKERS = int(os.environ.get("WORKERS", "4"))
ONLY = os.environ.get("ONLY", "")

TABLES = {
    "reminder": "reminders", "task": "tasks", "memory": "memories",
    "list": "lists", "board": "boards", "contact": "contacts",
}

lock = threading.Lock()
results = []
TOKEN = None
USER_ID = None


def flush_redis():
    try:
        s = socket.create_connection(("127.0.0.1", 6390), timeout=3)
        s.sendall(b"FLUSHALL\r\n"); s.recv(32); s.close()
    except Exception:
        pass


def sql(q):
    try:
        out = subprocess.check_output(
            [PSQL, "-h", "127.0.0.1", "-p", "5434", "-U", "postgres",
             "-d", "anchor_dev", "-tAc", q],
            stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL, timeout=60)
        return out.decode("utf-8", "replace").strip()
    except Exception:
        return ""


def api(method, path, body=None, token=None, timeout=200):
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
        return 0, {"message": type(e).__name__}


def unwrap(p):
    return p["data"] if isinstance(p, dict) and "success" in p and "data" in p else p


QUOTA_HIT = threading.Event()


FALLBACK = "having trouble responding"


def chat(messages, retries=2):
    if QUOTA_HIT.is_set():
        return "__QUOTA__"
    for attempt in range(retries + 1):
        st, p = api("POST", "/chat", {"messages": messages}, TOKEN)
        if st == 200:
            reply = (unwrap(p) or {}).get("reply", "")
            if FALLBACK in reply.lower():
                with lock:
                    globals()["FALLBACK_RUN"] = globals().get("FALLBACK_RUN", 0) + 1
                    run = globals()["FALLBACK_RUN"]
                # One is a bug worth reporting; five in a row is the provider.
                if run >= 5:
                    QUOTA_HIT.set()
                    return "__QUOTA__"
                return reply
            with lock:
                globals()["FALLBACK_RUN"] = 0
            return reply
        blob = json.dumps(p) if not isinstance(p, str) else p
        # The provider's daily token cap is not a bug in the bot. Mark it and
        # stop, rather than reporting hundreds of "failures" that are one quota.
        if "tokens per day" in blob or "TPD" in blob:
            QUOTA_HIT.set()
            return "__QUOTA__"
        if st in (429, 502, 503, 0) and attempt < retries:
            time.sleep(4 * (attempt + 1))
            continue
        return "__HTTP_%s__" % st
    return "__HTTP_FAIL__"


def count(kind):
    t = TABLES.get(kind)
    if t:
        return int(sql('SELECT count(*) FROM %s WHERE "userId"=\'%s\';' % (t, USER_ID)) or 0)
    if kind == "event":
        return int(sql(
            'SELECT count(*) FROM calendar_events e JOIN calendars c ON c.id=e."calendarId" '
            "WHERE c.\"userId\"='%s';" % USER_ID) or 0)
    return 0


def record(section, prompt, ok, detail):
    with lock:
        results.append((section, prompt, ok, detail))
        n = len(results)
        if n % 25 == 0:
            bad = sum(1 for r in results if r[2] is False)
            skip = sum(1 for r in results if r[2] is None)
            print("    ... %d done, %d failing, %d quota-skipped" % (n, bad, skip), flush=True)


def judge(kind, arg, reply, before=None, after=None):
    """Returns (ok, detail)."""
    if reply == "__QUOTA__":
        return None, "provider daily token quota reached"
    if reply.startswith("__HTTP_"):
        return False, "transport %s" % reply
    low = reply.lower()

    if kind == "say":
        return bool(re.search(arg, reply, re.I)), reply[:90]
    if kind == "deny":
        return not re.search(arg, reply, re.I), reply[:90]
    if kind == "scope":
        return reply.strip() == C.OUT_OF_SCOPE, reply[:90]
    if kind == "noscope":
        return reply.strip() != C.OUT_OF_SCOPE, reply[:90]
    if kind == "made":
        return (after or 0) > (before or 0), "%s %d->%d | %s" % (arg, before, after, reply[:60])
    if kind == "nocreate":
        return (after or 0) <= (before or 0), "%s %d->%d | %s" % (arg, before, after, reply[:60])
    if kind == "rel":
        # scheduledAt is a timestamp WITHOUT time zone holding UTC, while this
        # session's timezone is Asia/Karachi, so a bare now() reads five hours
        # off. That skew was a fault in this harness, not in the product.
        q = (
            "SELECT EXTRACT(EPOCH FROM (\"scheduledAt\" - (now() AT TIME ZONE 'UTC')))::int "
            "FROM reminders WHERE \"userId\" = '%s' ORDER BY \"createdAt\" DESC LIMIT 1;"
            % USER_ID
        )
        row = sql(q)
        if not row:
            return False, "no reminder row | %s" % reply[:60]
        try:
            delta = int(float(row))
        except ValueError:
            return False, "unparsable %r" % row
        target = int(arg)
        # generous: within 20% or 120s, whichever is larger
        tol = max(120, int(target * 0.2))
        ok = abs(delta - target) <= tol
        return ok, "wanted ~%ds, got %ds (%s)" % (target, delta, reply[:45])
    if kind == "nocrash":
        return "having trouble responding" not in low, reply[:90]
    return True, reply[:90]


def run_reply_case(case):
    section, prompt, kind, arg = case
    reply = chat([{"role": "user", "content": prompt}])
    ok, detail = judge(kind, arg, reply)
    record(section, prompt, ok, detail)


def run_db_case(case):
    section, prompt, kind, arg = case
    before = count(arg) if kind in ("made", "nocreate") else None
    reply = chat([{"role": "user", "content": prompt}])
    after = count(arg) if kind in ("made", "nocreate") else None
    ok, detail = judge(kind, arg, reply, before, after)
    record(section, prompt, ok, detail)


def main():
    global TOKEN, USER_ID
    flush_redis()
    st, p = api("POST", "/auth/login", {"email": EMAIL, "password": PW})
    TOKEN = (unwrap(p) or {}).get("accessToken")
    if not TOKEN:
        print("login failed:", st, p); sys.exit(1)
    st, p = api("GET", "/auth/me", None, TOKEN)
    USER_ID = (unwrap(p) or {}).get("id")
    print("signed in as %s (%s)\n" % (EMAIL, USER_ID))

    all_cases = [c for c in C.CASES if not ONLY or c[0].startswith(ONLY)]
    db_kinds = ("made", "nocreate", "rel")
    db_cases = [c for c in all_cases if c[2] in db_kinds]
    reply_cases = [c for c in all_cases if c[2] not in db_kinds]

    print("%d reply-only cases (concurrent x%d)" % (len(reply_cases), WORKERS), flush=True)
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        list(ex.map(run_reply_case, reply_cases))
    print("    reply cases done in %.1f min\n" % ((time.time() - t0) / 60), flush=True)

    print("%d database-verified cases (serial)" % len(db_cases), flush=True)
    t0 = time.time()
    for c in db_cases:
        run_db_case(c)
    print("    db cases done in %.1f min\n" % ((time.time() - t0) / 60), flush=True)

    print("%d multi-turn conversations" % len(C.MULTI), flush=True)
    for convo in C.MULTI:
        history = []
        for turn_prompt, expect in convo:
            history.append({"role": "user", "content": turn_prompt})
            reply = chat(history)
            history.append({"role": "assistant", "content": reply})
            if expect is None:
                continue
            ok = bool(re.search(expect, reply, re.I)) and not reply.startswith("__HTTP_")
            record("M-multiturn", turn_prompt, ok, reply[:90])

    # ---------------- report ----------------
    total = len(results)
    bad = [r for r in results if not r[2]]
    print("\n" + "=" * 84)
    print("  ZOORZIO BOT SWEEP: %d cases, %d passed, %d failed" % (total, total - len(bad), len(bad)))
    print("=" * 84)

    from collections import Counter, defaultdict
    by_sec = defaultdict(lambda: [0, 0])
    for sec, _, ok, _ in results:
        grp = sec.split("-")[0]
        by_sec[grp][0] += 1
        if ok is False:
            by_sec[grp][1] += 1
    print("\n  %-6s %8s %8s" % ("GROUP", "CASES", "FAILED"))
    for g in sorted(by_sec):
        n, f = by_sec[g]
        print("  %-6s %8d %8d" % (g, n, f))

    if bad:
        print("\nFAILURES (%d), grouped:" % len(bad))
        groups = defaultdict(list)
        for sec, prompt, _o, detail in bad:
            groups[sec].append((prompt, detail))
        for sec in sorted(groups):
            print("\n  [%s] %d" % (sec, len(groups[sec])))
            for prompt, detail in groups[sec][:6]:
                print("     %-58s -> %s" % (repr(prompt)[:58], detail[:72]))
            if len(groups[sec]) > 6:
                print("     ... and %d more" % (len(groups[sec]) - 6))

    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "failures.json"), "w") as f:
        json.dump([{"section": s, "prompt": p, "detail": d} for s, p, ok, d in results if ok is False],
                  f, indent=1, ensure_ascii=False)
    print("\nfull failure list: bot/failures.json")


if __name__ == "__main__":
    main()
