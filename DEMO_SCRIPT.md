# Confidence Engine — 3-minute judge script

Total ~3:00. Have the public URL already open on screen at 72%, status POC.
Two people works best: one talks, one drives. One person is fine if you rehearse.

---

## 0:00 — Hook (20s)
"Most proofs of concept die in a slide deck. Ours is going to promote itself to
production while you watch — and then tell us whether that was a good idea."

"This is the Confidence Engine. The project it's assessing on screen is itself:
its own OCI deployment, scored from real signals in Oracle Autonomous Database."

## 0:20 — The problem (20s)
"Teams ship POCs to production on gut feel. There's no objective readiness score,
and no record of who decided what. We fixed both: a live readiness score, and an
append-only audit log that the database itself narrates."

## 0:40 — Responsible path (45s)
Point at the gauge: "72%. Three controls are blocking production — firewall,
health probe, retention policy."

Click **Ask the database for a hint**. "That button is not a chatbot. It's Select
AI inside Autonomous Database, reading our real signals and answering in plain
English what's missing and how to fix it."

Click **Resolve** on the three gaps one at a time. "As we remediate, the score is
recomputed live from the data." Gauge climbs past 80 and turns green; button
flips to green **Promote to Production**.

## 1:25 — The promotion (20s)
Click **Promote to Production**. Status flips to green PRODUCTION, gauge pulses.
"Earned it. And the audit log just recorded the launch — immutable, timestamped."

## 1:45 — Cautionary path, the twist (50s)
Click **reset** (or note you'll show the other path). Now: "But the clue said the
POC became production *out of sheer confidence*. So watch what happens when
someone promotes anyway."

At 72%, click the red **Promote anyway →**. Confirm the override. Status flips to
red **PRODUCTION · AT RISK**. "It let us — but it didn't let us off the hook."

The database responds via Select AI with a risk assessment. "Autonomous Database
is now telling us, on the record, exactly what we just gambled: no recovery path,
uncontrolled egress, no data lifecycle. The audit log captured the decision *and*
its consequences."

Click **Roll back & remediate**. "And we can undo it — also logged."

## 2:35 — Tech (15s)
"All Oracle: Java on Spring Boot, Autonomous Database with Select AI on OCI
Generative AI, OCI Vault for secrets, WAF on the public endpoint, packaged to
OCIR and running on a Container Instance. CI/CD through GitHub Actions."

## 2:50 — Close (10s)
Point at the audit feed. "Firewall, Autonomous Database giving hints, Java, a POC
that became production out of sheer confidence — and the audit log says it was
awesome. That was the brief. This is it, live."

---

## If something breaks
- Hint call hangs: keep talking, it's a GenAI round trip; have a screenshot ready.
- API error on screen: you're likely pointed at a dead container — fall back to
  the local `mvn spring-boot:run` instance on a second machine.
- Keep the in-browser `preview.html` open in another tab as a last-resort backup;
  it behaves identically without a backend.

## The one line to land
"The audit log says it was awesome." Say it last, pointing at the log.
