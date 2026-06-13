# Confidence Engine — POC-to-Production Readiness Console

A web app that scores production readiness from real signals stored in Oracle
Autonomous Database, asks the database for a natural-language hint via **Select
AI**, and promotes a project from POC to PRODUCTION while writing an append-only
audit trail. Built for the Oracle/OCI hackathon clue:

> "Firewall Fliers asked Autonomous Database for a hint in The Java Jamboree;
> the POC became production out of sheer confidence. The audit log says it was awesome."

Stack: Java 21 / Spring Boot, Oracle Autonomous Database + Select AI (OCI
GenAI), Docker, OCIR, OCI Container Instances, OCI WAF, GitHub Actions.

---

## What's in this repo

```
setup_adb.sql                 run this in ADB first; creates schema + Select AI profile
pom.xml                       Maven build
Dockerfile                    multi-stage build -> slim JRE
src/main/java/com/oracle/cfeng/
  ConfidenceEngineApplication.java
  ApiController.java           REST endpoints
  HealthController.java        /healthz for the container probe
  ConfidenceService.java       JdbcTemplate access + Select AI + promote txn
  Models.java                  Project / Signal / AuditEvent / Readiness records
src/main/resources/
  application.yml              config via env vars
  static/                      index.html, styles.css, app.js (the console UI)
.github/workflows/deploy.yml   build + push image to OCIR
AGENTS.md                     build contract (for Codex, and for you)
```

Endpoints: `GET /` (UI), `GET /api/projects/{id}`,
`POST /api/projects/{id}/signals/{sid}/resolve`, `POST /api/projects/{id}/hint`,
`POST /api/projects/{id}/promote`, `POST /api/projects/{id}/rollback`,
`GET /api/projects/{id}/audit`, `GET /healthz`.

The app is self-referential: the seeded project is this app assessing its own OCI
deployment. It has two arcs. Responsible: resolve the blocking controls until
readiness crosses 80%, then promote cleanly. Cautionary (the clue): promote while
still below threshold ("out of sheer confidence"), and Select AI puts the risk on
the record while the status reads PRODUCTION · AT RISK — then roll back. See
`DEMO_SCRIPT.md` for the 3-minute judge walkthrough.

---

## Before the event — ask the organizers

GenAI access is the only thing that can hard-block you. Ask:

1. Own tenancy/compartment or shared, and do we have admin on it?
2. Is **OCI Generative AI** enabled, and in which region? (Only some regions:
   us-chicago-1, us-ashburn-1, eu-frankfurt-1, and a few others.)
3. Are we allowed to enable resource principals on Autonomous Database?

Answers decide the credential path in Step 2 below.

---

## Step 1 — Provision Autonomous Database

1. OCI Console > Oracle Database > Autonomous Database > Create.
2. Workload type: Transaction Processing (ATP). Always Free is fine.
3. Set the ADMIN password. Save it.
4. After it's running, open **Database Actions** > **SQL**.

## Step 2 — Run the database setup

Open `setup_adb.sql` and work top to bottom as ADMIN. Pick ONE credential path:

- **Path A — API key (default, least privilege).** Use if unsure about admin.
  Create an API key (Console > Profile > My profile > API keys > Add), then fill
  in and run the `DBMS_CLOUD.CREATE_CREDENTIAL` block (section 1a). Profile uses
  `credential_name => 'GENAI_CRED'`.
- **Path B — resource principal (no keys, needs admin).** Run the
  `ENABLE_RESOURCE_PRINCIPAL` block (1b). Profile uses
  `credential_name => 'OCI$RESOURCE_PRINCIPAL'`.

Both paths need the **GenAI IAM policy** (section 1c). Then run sections 2–4 to
create the schema, the `CONFIDENCE` Select AI profile, and seed data. Edit the
compartment OCID and region in section 3.

**Do not skip the smoke tests in section 5.** When the `DBMS_CLOUD_AI.GENERATE`
call returns text, your hardest dependency works. If it errors with an
authorization message, your GenAI policy or region is wrong — fix that now, not
at hour 20.

## Step 3 — Get the walletless TLS connection string

This avoids shipping a wallet inside the container.

1. ADB details page > **Database connection**.
2. Set **Mutual TLS (mTLS) authentication** to **Not required** (TLS allowed).
   You may need to add your network to the access control list, or allow secure
   access from anywhere for the demo.
3. Under **Connection strings**, copy the **TLS** string (it contains
   `protocol=tcps`), not the mTLS one.
4. Build the JDBC URL: `jdbc:oracle:thin:@` + that TLS descriptor. Example shape:

```
jdbc:oracle:thin:@(description=(retry_count=3)(retry_delay=3)(address=(protocol=tcps)(port=1521)(host=adb.us-chicago-1.oraclecloud.com))(connect_data=(service_name=xxxx_confidence_tp.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))
```

The driver trusts ADB's TLS cert via the default Java truststore, so no wallet
is needed. (If you hit a cert-trust error, fall back to the mTLS wallet and set
`TNS_ADMIN` — but try walletless first.)

## Step 4 — Run locally to verify

```bash
export DB_URL='jdbc:oracle:thin:@(description=...)'
export DB_USER='ADMIN'
export DB_PASSWORD='your-admin-password'
mvn spring-boot:run
```

Open http://localhost:8080 . You should see the gauge, the category tiles, the
audit feed, and working Hint and Promote buttons.

## Step 5 — Build and push the image to OCIR

```bash
# auth token: Console > Profile > Auth tokens > Generate token
docker login <region-key>.ocir.io -u '<tenancy-namespace>/<username>' -p '<auth-token>'

docker build -t confidence-engine .
docker tag confidence-engine <region-key>.ocir.io/<tenancy-namespace>/confidence-engine:latest
docker push <region-key>.ocir.io/<tenancy-namespace>/confidence-engine:latest
```

`<region-key>` examples: `ord` (Chicago), `iad` (Ashburn), `fra` (Frankfurt).
Find `<tenancy-namespace>` under Console > Tenancy details > Object storage namespace.

## Step 6 — Deploy on OCI Container Instances

1. Console > Developer Services > **Container Instances** > Create.
2. Networking: place it in a VCN public subnet, assign a **public IP**.
3. Add the container; image = the OCIR path you pushed. (Same-tenancy pulls work
   with a policy; otherwise add an image-pull secret with your auth token.)
4. Environment variables: `DB_URL`, `DB_USER`, `DB_PASSWORD`.
5. The app listens on **8080**. In the subnet security list / NSG, add an ingress
   rule allowing TCP **8080** from 0.0.0.0/0 for the demo.
6. Create. When it's running, your public URL is `http://<public-ip>:8080`.

## Step 7 — Put OCI WAF in front (satisfies "Firewall Fliers")

For a clean public URL and the firewall part of the clue, front the instance
with a load balancer + **OCI WAF policy** (or use Network Firewall). Even a basic
WAF policy attached to a public load balancer pointed at your instance counts and
demos well. If time is short, do this last — the app works without it.

## Step 8 — CI/CD (optional polish)

`.github/workflows/deploy.yml` builds and pushes the image to OCIR on every push
to `main`. Add repo secrets: `OCIR_REGISTRY`, `OCIR_USERNAME`, `OCIR_AUTH_TOKEN`,
`OCIR_NAMESPACE`. Container Instances pull at create time, so to ship a new build
you recreate the instance (console, or `oci container-instances container-instance
create ...`). Honest note: there is no in-place image hot-swap; recreate is the move.

---

## Demo flow (what to click)

Full beat-by-beat timing is in `DEMO_SCRIPT.md`. In short:

1. Open the public URL. Gauge shows the real score from `v_readiness` (72%), POC.
2. **Ask the database for a hint** — Select AI narrates the failing controls and
   fixes from your real data. Not a chatbot; the database answering in English.
3. Responsible path: click **Resolve** on each blocking control, watch the score
   climb past 80%, then **Promote to Production** for a clean, green launch.
4. Cautionary path (reset first): at 72% click **Promote anyway →**. Status goes
   PRODUCTION · AT RISK, Select AI records the risk, then **Roll back & remediate**.
5. Land the closer on the audit feed: "The audit log says it was awesome."

## Troubleshooting

- **Select AI authorization error** — GenAI IAM policy missing, wrong region, or
  the model name isn't available in that region. Re-check section 1c and the
  `region`/`model` in section 3.
- **Hint returns nothing** — confirm the app calls `DBMS_CLOUD_AI.GENERATE` with
  `profile_name` (it does); confirm `app.ai-profile` matches the profile name.
- **App can't connect to ADB** — using the mTLS string instead of TLS, or mTLS
  still required on the ADB. Use the TLS string and set mTLS to Not required.
- **Container can't pull image** — add the OCIR image-pull secret, or a policy
  allowing the instance to read the repo.
- **Cert trust error on walletless TLS** — fall back to the wallet + `TNS_ADMIN`.

> Note: the Java app is provided as a working skeleton and has not been compiled
> in this environment (no Maven Central access here). Run `mvn spring-boot:run`
> locally first; fix any version nits before deploying.
