-- ============================================================
-- POC-to-Production Confidence Engine  |  ADB setup
-- Run as ADMIN in Database Actions > SQL, top to bottom.
-- Verified against DBMS_CLOUD_AI (Select AI) syntax, June 2026.
--
-- You will pick ONE credential path in section 1:
--   PATH A  API key      - works as a normal user, least privilege needed.
--                          Use this if you are NOT sure you have admin.
--   PATH B  Resource     - cleanest (no keys), but needs admin on the ADB
--           principal      instance + an IAM policy. Use only if you have it.
-- Either way you ALSO need a tenancy policy granting GenAI access (section 1c).
-- ============================================================


-- ------------------------------------------------------------
-- 1a. PATH A — API KEY CREDENTIAL  (default, lowest privilege)
--     Needs: an OCI user with an API key. In the OCI Console:
--       Profile > My profile > API keys > Add API key > Download private key.
--     Paste the private key as ONE line with the BEGIN/END header lines removed.
-- ------------------------------------------------------------
-- BEGIN
--   DBMS_CLOUD.CREATE_CREDENTIAL(
--     credential_name => 'GENAI_CRED',
--     user_ocid       => 'ocid1.user.oc1..REPLACE',
--     tenancy_ocid    => 'ocid1.tenancy.oc1..REPLACE',
--     private_key     => 'MIIEvQIBADANBgkq...one-long-line...',
--     fingerprint     => 'aa:bb:cc:dd:...');
-- END;
-- /


-- ------------------------------------------------------------
-- 1b. PATH B — RESOURCE PRINCIPAL  (no keys; needs admin)
--     Needs: ability to run this on the ADB instance, plus a dynamic group
--     containing this ADB and a policy (see 1c, the dynamic-group variant).
-- ------------------------------------------------------------
-- BEGIN
--   DBMS_CLOUD_ADMIN.ENABLE_RESOURCE_PRINCIPAL();
-- END;
-- /
-- With Path B, the credential_name in section 3 is 'OCI$RESOURCE_PRINCIPAL'.


-- ------------------------------------------------------------
-- 1c. IAM POLICY (required for BOTH paths) — add in OCI Console > Policies.
--     PATH A (API-key user is a normal user/group):
--         allow group <your-group> to use generative-ai-family in tenancy
--     PATH B (resource principal via dynamic group):
--         allow dynamic-group <adb-dynamic-group> to use generative-ai-family in tenancy
--     GenAI is region-specific. Use a region that has it (e.g. us-chicago-1,
--     us-ashburn-1, eu-frankfurt-1) in the "region" attribute in section 3.
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- 2. Schema  (run as ADMIN; everything lives in the ADMIN schema for speed)
-- ------------------------------------------------------------
CREATE TABLE projects (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR2(200) NOT NULL,
  description   VARCHAR2(1000),
  status        VARCHAR2(20) DEFAULT 'POC' NOT NULL,   -- POC | PRODUCTION
  created_at    TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE TABLE signals (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id    NUMBER NOT NULL REFERENCES projects(id),
  category      VARCHAR2(20) NOT NULL,    -- SECURITY|SCALABILITY|RELIABILITY|COST|COMPLIANCE
  control_name  VARCHAR2(200) NOT NULL,
  passed        NUMBER(1) DEFAULT 0 NOT NULL,
  weight        NUMBER DEFAULT 1 NOT NULL,
  detail        VARCHAR2(1000),
  observed_at   TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE TABLE audit_events (
  id            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id    NUMBER REFERENCES projects(id),
  event_type    VARCHAR2(50) NOT NULL,    -- ASSESS|PROMOTE|AI_HINT|SIGNAL_UPDATE
  actor         VARCHAR2(100) DEFAULT 'system',
  message       VARCHAR2(2000),
  event_time    TIMESTAMP DEFAULT SYSTIMESTAMP
);

CREATE OR REPLACE VIEW v_readiness AS
SELECT p.id AS project_id, p.name, p.status,
       ROUND(100 * NVL(SUM(s.passed * s.weight),0)
               / NULLIF(SUM(s.weight),0), 0) AS readiness_pct,
       SUM(CASE WHEN s.passed = 0 THEN 1 ELSE 0 END) AS open_gaps
FROM   projects p
LEFT JOIN signals s ON s.project_id = p.id
GROUP BY p.id, p.name, p.status;


-- ------------------------------------------------------------
-- 3. Select AI profile  (the demo centerpiece)
--    Set credential_name per the path you chose:
--      Path A -> 'GENAI_CRED'      Path B -> 'OCI$RESOURCE_PRINCIPAL'
--    Replace compartment OCID and region.
-- ------------------------------------------------------------
BEGIN
  DBMS_CLOUD_AI.CREATE_PROFILE(
    profile_name => 'CONFIDENCE',
    attributes   => '{
      "provider": "oci",
      "credential_name": "GENAI_CRED",
      "oci_compartment_id": "ocid1.compartment.oc1..REPLACE",
      "region": "us-chicago-1",
      "model": "meta.llama-3.3-70b-instruct",
      "oci_apiformat": "GENERIC",
      "comments": "true",
      "object_list": [
        {"owner": "ADMIN", "name": "PROJECTS"},
        {"owner": "ADMIN", "name": "SIGNALS"},
        {"owner": "ADMIN", "name": "AUDIT_EVENTS"}
      ]
    }');
END;
/


-- ------------------------------------------------------------
-- 4. Seed one demo project + signals (mix of pass/fail)
-- ------------------------------------------------------------
INSERT INTO projects (name, description)
VALUES ('Confidence Engine', 'This very app, assessing its own OCI deployment');

INSERT INTO signals (project_id,category,control_name,passed,weight,detail) VALUES (1,'SECURITY','WAF in front of public endpoint',1,3,'OCI WAF policy attached');
INSERT INTO signals (project_id,category,control_name,passed,weight,detail) VALUES (1,'SECURITY','Secrets in OCI Vault',1,2,'Creds in Vault');
INSERT INTO signals (project_id,category,control_name,passed,weight,detail) VALUES (1,'SECURITY','Network Firewall egress rules',0,2,'Not yet configured');
INSERT INTO signals (project_id,category,control_name,passed,weight,detail) VALUES (1,'SCALABILITY','ADB auto-scaling enabled',1,2,'ECPU auto-scale on');
INSERT INTO signals (project_id,category,control_name,passed,weight,detail) VALUES (1,'RELIABILITY','Automatic backups verified',1,2,'ADB auto-backup');
INSERT INTO signals (project_id,category,control_name,passed,weight,detail) VALUES (1,'RELIABILITY','Health probe / restart policy',0,2,'Container probe missing');
INSERT INTO signals (project_id,category,control_name,passed,weight,detail) VALUES (1,'COST','Right-sized compute shape',1,1,'Flex shape, low OCPU');
INSERT INTO signals (project_id,category,control_name,passed,weight,detail) VALUES (1,'COMPLIANCE','Audit logging enabled',1,3,'OCI Audit + app audit_events');
INSERT INTO signals (project_id,category,control_name,passed,weight,detail) VALUES (1,'COMPLIANCE','Data retention policy documented',0,1,'TODO');
COMMIT;

INSERT INTO audit_events (project_id,event_type,actor,message)
VALUES (1,'ASSESS','system','Initial readiness assessment created');
COMMIT;


-- ------------------------------------------------------------
-- 5. SMOKE TESTS — pass these BEFORE writing app code
-- ------------------------------------------------------------
SELECT * FROM v_readiness;                         -- real score from real data

EXEC DBMS_CLOUD_AI.SET_PROFILE('CONFIDENCE');      -- worksheet session only
SELECT AI 'how many security controls are failing for Confidence Engine';

-- The STATELESS form your Spring app uses (works on pooled connections):
SELECT DBMS_CLOUD_AI.GENERATE(
         prompt       => 'List the failing controls for the project named Confidence Engine and give one concrete remediation for each before it can go to production. Be concise.',
         profile_name => 'CONFIDENCE',
         action       => 'narrate'
       ) AS ai_hint
FROM dual;
-- If 5 errors with an authorization/permission message, your GenAI IAM policy
-- (section 1c) is missing or the region has no GenAI. Fix that first.
