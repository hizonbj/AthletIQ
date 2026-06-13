# AGENTS.md — POC-to-Production Confidence Engine

Build a small web app that scores whether a project is production-ready from
real signals stored in Oracle Autonomous Database, lets a user ask the database
for a natural-language "hint" via Select AI, and promotes a project from POC to
PRODUCTION while writing an append-only audit trail.

This file is the contract. Follow the constraints exactly — several are
non-obvious and will silently break if ignored.

## Stack (do not substitute)
- Java 21, Spring Boot 3.x, Maven.
- Oracle Autonomous Database (schema already created — see setup_adb.sql).
- Oracle JDBC thin driver (ojdbc11) + UCP. Plain server-rendered UI is fine:
  Thymeleaf + a single page, or a tiny static HTML/JS calling REST endpoints.
  Do NOT pull in a heavy SPA framework. Speed and a clean look matter more.
- Package as a Docker image, runnable on OCI Container Instances.

## Hard constraints (these are the ones that break)
1. Select AI from the app MUST use the stateless form:
   `DBMS_CLOUD_AI.GENERATE(prompt => ?, profile_name => 'CONFIDENCE', action => 'narrate')`
   Never rely on `SET_PROFILE` + `SELECT AI` from a pooled connection — the
   profile does not survive across pool checkouts.
2. Dashboard numbers (readiness %, gap counts) come from the SQL view
   `v_readiness`, NOT from the LLM. Only the "hint"/recommendations use the LLM.
3. The audit trail is append-only. Never UPDATE or DELETE `audit_events`.
   Every assess, hint, signal change, and promotion inserts a row.
4. Promotion is a transaction: update `projects.status = 'PRODUCTION'`, insert a
   PROMOTE audit row, in one commit. If the readiness % is below a threshold
   (default 80), still allow it but record that it was an override in the audit
   message (the demo narrative: "POC became production out of sheer confidence").
5. DB connection: prefer ADB's TLS (walletless) connection string so the
   container needs no wallet file. Read it from env var `DB_URL`. Support a
   wallet fallback via `TNS_ADMIN` if `DB_URL` is an mTLS descriptor.
6. No secrets in code or in the image. All config via env vars:
   `DB_URL`, `DB_USER`, `DB_PASSWORD`.

## Endpoints
- `GET  /`                       -> dashboard page: project, readiness %, status,
                                    per-category breakdown, list of open gaps.
- `GET  /api/projects/{id}`      -> JSON: project + readiness + signals.
- `POST /api/projects/{id}/hint` -> calls DBMS_CLOUD_AI.GENERATE (narrate),
                                    returns the NL text, writes an AI_HINT audit row.
- `POST /api/projects/{id}/promote` -> the promotion transaction (constraint 4),
                                    returns new status, writes PROMOTE audit row.
- `GET  /api/projects/{id}/audit` -> the audit trail, newest first.
- `GET  /healthz`                -> 200 for the Container Instance probe.

## UI requirements (this is where demo points are won)
- One screen. Big readiness number with a circular/linear progress meter.
- Five category tiles (Security, Scalability, Reliability, Cost, Compliance)
  each showing pass/total and color (green/amber/red).
- An "Ask the database for a hint" button -> shows the Select AI narration in a
  panel. Label it so judges see it's the DB answering, not a generic chatbot.
- A prominent "Promote POC to Production" button. On click: confirm, call
  promote, then animate status flipping to PRODUCTION and reveal the audit row
  that was just written ("The audit log says it was awesome").
- Clean, modern, dark or Oracle-red accent. No template default look.

## Repo layout
```
/src/main/java/...        Spring Boot app
/src/main/resources/      templates, static assets, application.yml
/setup_adb.sql            DB setup (already provided, do not regenerate)
/Dockerfile               multi-stage: maven build -> slim JRE runtime
/.github/workflows/deploy.yml   build image, push to OCIR, redeploy
/README.md
```

## Dockerfile notes
- Multi-stage. Final stage: `eclipse-temurin:21-jre`. Expose 8080.
- Entry: `java -jar app.jar`. Do not bake env values in.

## Definition of done
- `docker run -e DB_URL=... -e DB_USER=... -e DB_PASSWORD=... <img>` serves the
  dashboard on :8080, hint and promote both work end to end against ADB, and
  every action shows up in `/api/projects/1/audit`.
