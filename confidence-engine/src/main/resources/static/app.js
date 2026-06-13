const PROJECT_ID = 1, THRESHOLD = 80, ARC_LEN = 540;
const $ = (id) => document.getElementById(id);
let current = null; // last dashboard payload

async function api(path, method = "GET") {
  const res = await fetch(`/api/projects/${PROJECT_ID}${path}`, { method });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  return res.json();
}

const tileClass = (p, t) => (p === t ? "tile--ok" : p === 0 ? "tile--bad" : "tile--warn");
const typeClass = (t) => ({ PROMOTE:"t-promote", AI_RISK:"t-risk", LAUNCH:"t-launch",
  SIGNAL_UPDATE:"t-resolve", ROLLBACK:"t-rollback" }[t] || "");

function phaseOf(data) {
  const status = data.project.status, pct = data.readiness.readinessPct;
  if (status === "POC") return "POC";
  return pct < THRESHOLD ? "RISK" : "PROD";
}

function renderDashboard(data) {
  current = data;
  const phase = phaseOf(data);
  const pct = data.readiness.readinessPct;

  const pill = $("statusPill"), dot = $("barDot");
  dot.classList.toggle("is-risk", phase === "RISK");
  if (phase === "POC")      { pill.textContent = "POC"; pill.className = "pill pill--poc"; }
  else if (phase === "PROD"){ pill.textContent = "PRODUCTION"; pill.className = "pill pill--prod"; }
  else                      { pill.textContent = "PRODUCTION · AT RISK"; pill.className = "pill pill--risk"; }

  $("readinessPct").textContent = pct;
  $("openGaps").textContent = data.readiness.openGaps;
  const arc = $("gaugeArc");
  requestAnimationFrame(() => { arc.style.strokeDashoffset = ARC_LEN * (1 - pct / 100); });
  arc.style.stroke = phase === "RISK" ? "var(--red)"
                    : pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--amber)" : "var(--red)";

  $("tiles").innerHTML = data.categories.map((c) => `
    <div class="tile ${tileClass(c.passed, c.total)}">
      <div class="tile__cat">${c.category}</div>
      <div class="tile__score">${c.passed}/${c.total}</div>
      <div class="tile__bar"><div class="tile__fill" style="width:${(c.passed / c.total) * 100}%"></div></div>
    </div>`).join("");

  const gapsEl = $("gaps");
  const failing = data.signals.filter((s) => !s.passed);
  if (phase === "POC" && failing.length) {
    gapsEl.innerHTML = `<div class="eyebrow gaps__title">blocking controls</div>` + failing.map((s) =>
      `<div class="gap"><div><span class="gap__cat">${s.category}</span><span class="gap__name">${s.controlName}</span></div>
       <button class="gap__btn" data-id="${s.id}">Resolve</button></div>`).join("");
    gapsEl.querySelectorAll(".gap__btn").forEach((b) =>
      b.addEventListener("click", () => resolve(+b.dataset.id)));
  } else if (phase === "POC") {
    gapsEl.innerHTML = `<p class="gaps__clear">All controls green. Ready to promote.</p>`;
  } else {
    gapsEl.innerHTML = "";
  }

  const pb = $("promoteBtn");
  if (phase === "POC") {
    if (pct >= THRESHOLD) { pb.textContent = "Promote to Production"; pb.className = "btn btn--go"; }
    else { pb.textContent = "Promote anyway →"; pb.className = "btn btn--launch"; }
    pb.disabled = false;
  } else if (phase === "PROD") {
    pb.textContent = "In Production ✓"; pb.className = "btn btn--ghost"; pb.disabled = true;
  } else {
    pb.textContent = "Roll back & remediate"; pb.className = "btn btn--ghost"; pb.disabled = false;
  }
}

function renderAudit(events, flash = false) {
  $("auditFeed").innerHTML = events.map((e, i) => `
    <li class="${flash && i === 0 ? "is-new" : ""}">
      <span class="audit__time">${new Date(e.eventTime).toLocaleTimeString()}</span>
      <span class="audit__type ${typeClass(e.eventType)}">${e.eventType}</span>
      <span class="audit__msg">${e.message ?? ""}</span>
    </li>`).join("");
}
const refreshAudit = async (flash = false) => renderAudit(await api("/audit"), flash);

async function load() {
  try { renderDashboard(await api("")); await refreshAudit(); }
  catch { $("auditFeed").innerHTML =
    `<li><span class="audit__msg">Could not reach the API. Check DB connection and env vars.</span></li>`; }
}

async function resolve(signalId) {
  renderDashboard(await api(`/signals/${signalId}/resolve`, "POST"));
  await refreshAudit(true);
}

$("hintBtn").addEventListener("click", async () => {
  const b = $("hintBtn"); b.disabled = true; b.textContent = "Asking the database…";
  try {
    const { hint } = await api("/hint", "POST");
    $("hintPanel").hidden = false; $("hintPanel").classList.remove("is-risk");
    $("hintLabel").textContent = "Autonomous Database · Select AI";
    $("hintText").textContent = hint;
    await refreshAudit(true);
  } catch {
    $("hintPanel").hidden = false;
    $("hintText").textContent = "Select AI did not respond. Verify the CONFIDENCE profile and GenAI policy.";
  } finally { b.disabled = false; b.textContent = "Ask the database for a hint"; }
});

$("promoteBtn").addEventListener("click", async () => {
  const phase = phaseOf(current), pct = current.readiness.readinessPct, gaps = current.readiness.openGaps;

  if (phase === "RISK") { // roll back
    renderDashboard(await api("/rollback", "POST")); await refreshAudit(true); return;
  }
  if (phase === "PROD") return;

  // No blocking dialog: single click promotes. The override path's risk
  // narration is the consequence, which is better for a live demo.

  const b = $("promoteBtn"); b.disabled = true; b.textContent = "Promoting…";
  try {
    const res = await api("/promote", "POST");
    renderDashboard(await api(""));
    if (res.override && res.risk) {
      $("hintPanel").hidden = false; $("hintPanel").classList.add("is-risk");
      $("hintLabel").textContent = "Autonomous Database · Select AI · risk assessment";
      $("hintText").textContent = res.risk;
    } else {
      $("gaugeRing").classList.add("pulse");
      setTimeout(() => $("gaugeRing").classList.remove("pulse"), 700);
    }
    await refreshAudit(true);
  } finally { /* button state set by renderDashboard */ }
});

load();
