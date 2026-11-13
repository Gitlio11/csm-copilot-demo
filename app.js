"use strict";

const state = { data: null, briefs: {}, briefMeta: {}, selected: null, csm: "" };
const TIER_LABEL = { high: "At risk", medium: "Watch", low: "Healthy" };
const SOURCE_LABEL = { data: "the numbers", note: "CSM notes", renewal: "the renewal date" };
const METER_CELLS = 100;
const MISSING = '<span class="missing">Missing in the data, not counted</span>';

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));
const num = (n, unit = "") => (n == null ? "missing" : `${Number.isInteger(n) ? n : n.toFixed(1)}${unit}`);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const isExpansion = (a) => a.list === "expansion";
const tone = (a) => (isExpansion(a) ? "t-expansion" : `t-${a.tier}`);

function ordinal(n) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th");
  return `${n}${s}`;
}

function allAccounts() {
  return [...state.data.risk, ...state.data.expansion];
}

function renewalText(a) {
  if (a.days_to_renewal == null) return "renewal unknown";
  if (a.days_to_renewal < 0) return `renewal date passed ${-a.days_to_renewal} days ago`;
  return `renews in ${a.days_to_renewal} days`;
}

/* Hero: every account as a cabinet in the hall */
function renderHall() {
  const s = state.data.summary;
  const total = allAccounts().length;
  document.getElementById("hall-title").textContent =
    `${s.high_risk_accounts} of your ${total} accounts need you this week.`;
  const hall = document.getElementById("hall");
  hall.innerHTML = allAccounts().map((a, i) => `<button type="button" class="cab ${tone(a)}" style="--i:${i}"
    data-id="${esc(a.account_id)}" tabindex="-1"
    title="${esc(a.name)}, ${isExpansion(a) ? "growing" : `risk ${a.score}`}" aria-label="${esc(a.name)}"></button>`).join("");
  hall.classList.add("boot");
  hall.addEventListener("animationend", () => hall.classList.remove("boot"), { once: true });
}

/* Ranked lists */
function accountRow(a) {
  let why;
  if (isExpansion(a)) {
    why = esc(a.growth_reasons[0] ?? "Growing");
  } else if (!a.reasons.length) {
    why = '<span class="more">No warning signs</span>';
  } else {
    const [top, ...rest] = a.reasons.slice().sort((x, y) => y.points - x.points);
    const text = top.source === "note" ? `<span class="flag">${esc(top.text)}</span>` : esc(top.text);
    why = text + (rest.length ? ` <span class="more">and ${rest.length} more</span>` : "");
  }
  return `<li><button type="button" class="row ${tone(a)}" data-id="${esc(a.account_id)}"
      aria-current="${a.account_id === state.selected}">
    <span class="led" aria-hidden="true"></span>
    <span><span class="name">${esc(a.name)}</span>
      <span class="why">${why}</span>
      <span class="meta">${esc(a.csm)}, ${renewalText(a)}</span></span>
    <span class="score" aria-label="${isExpansion(a) ? "Growing account" : `Risk score ${a.score}`}">${isExpansion(a) ? "Grow" : a.score}</span>
  </button></li>`;
}

function renderLists() {
  const pick = (list) => list.filter((a) => !state.csm || a.csm === state.csm);
  const risk = pick(state.data.risk);
  const expansion = pick(state.data.expansion);
  const groups = [["high", "Act now"], ["medium", "Watch"], ["low", "Healthy"]].map(([tier, title]) => {
    const rows = risk.filter((a) => a.tier === tier);
    return rows.length ? `<li class="group" aria-hidden="true">${title} <span class="count">${rows.length}</span></li>${rows.map(accountRow).join("")}` : "";
  }).join("");
  document.getElementById("risk-list").innerHTML = groups || '<li class="hint">No accounts for this CSM.</li>';
  document.getElementById("expansion-list").innerHTML = expansion.map(accountRow).join("") || '<li class="hint">None for this CSM.</li>';
  document.getElementById("count-risk").textContent = risk.length;
  document.getElementById("count-expansion").textContent = expansion.length;
  document.querySelectorAll(".cab").forEach((c) => {
    const a = allAccounts().find((x) => x.account_id === c.dataset.id);
    c.classList.toggle("dim", Boolean(state.csm) && a.csm !== state.csm);
  });
}

function renderIssues() {
  const issues = state.data.issues;
  document.getElementById("count-issues").textContent = issues.length;
  document.getElementById("issue-list").innerHTML = issues.map((i) => `<li><span class="kind">${esc(i.kind)}, ${esc(i.record)}</span>${esc(i.detail)}</li>`).join("");
}

function showTab(tab, { focus = false } = {}) {
  document.querySelectorAll('[role="tab"]').forEach((t) => {
    const on = t === tab;
    t.setAttribute("aria-selected", on);
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  });
  if (focus) tab.focus();
}

/* Brief */
function briefHead(a) {
  const label = isExpansion(a) ? "Growing, on the Expansion list" : `${TIER_LABEL[a.tier]}, ${ordinal(a.rank)} of ${state.data.risk.length}`;
  return `<header class="brief-head">
    <div>
      <h2>${esc(a.name)}</h2>
      <p class="meta">${esc(a.industry)} in ${esc(a.metro)}, ${esc(a.arr_display)} a year. CSM ${esc(a.csm)}. Account ${esc(a.account_id)}.</p>
      ${contactLine(a.contact)}
    </div>
    <div class="verdict ${tone(a)}"><span class="score">${isExpansion(a) ? "Grow" : a.score}</span><span class="label">${label}</span></div>
  </header>
  <p class="do-now ${tone(a)}"><strong>Do this week:</strong> ${esc(a.next_step)}</p>`;
}

function contactLine(c) {
  if (!c) return '<p class="contact">No main contact on file.</p>';
  const status = c.status ? ` <span class="contact-status">${esc(c.status)}</span>` : "";
  return `<p class="contact">Main contact: <strong>${esc(c.contact_name)}</strong>, ${esc(c.title)}.
    <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>, <a href="tel:${esc(c.phone.replace(/ /g, ""))}">${esc(c.phone)}</a>.${status}
    <span class="tag">Sample contact</span></p>`;
}

function whySection(a) {
  const growth = isExpansion(a)
    ? `<ul class="reasons">${a.growth_reasons.map((g) => `<li><span class="key p-growth"></span><span>${esc(g)}</span><span></span></li>`).join("")}</ul>`
    : "";
  let score = "";
  if (a.reasons.length) {
    const cells = a.reasons.flatMap((r) => Array(r.points).fill(`p-${r.source}`)).slice(0, METER_CELLS);
    const meter = [...cells, ...Array(Math.max(0, METER_CELLS - cells.length)).fill("")]
      .map((cls) => `<i class="${cls}"></i>`).join("");
    const rows = a.reasons.map((r) => `<li><span class="key p-${r.source}" aria-hidden="true"></span>
      <span><span class="${r.source === "note" ? "note-text" : ""}">${esc(r.text)}</span>
        <span class="meaning">${esc(r.meaning)}</span></span><span class="pts">+${r.points}</span></li>`).join("");
    const parts = ["data", "note", "renewal"].map((src) => {
      const pts = a.reasons.filter((r) => r.source === src).reduce((sum, r) => sum + r.points, 0);
      return pts ? `<strong>${pts}</strong> from ${SOURCE_LABEL[src]}` : "";
    }).filter(Boolean);
    score = `${isExpansion(a) ? '<p class="footnote">Also watch:</p>' : `<div class="meter" role="img" aria-label="Risk score ${a.score} out of 100">${meter}</div>
      <p class="legend-line"><span class="legend-lead">Each square is one point, out of 100.</span>
        <span><i class="p-data"></i>From the numbers</span><span><i class="p-note"></i>From CSM notes</span><span><i class="p-renewal"></i>Renewal coming up</span></p>`}
      <ul class="reasons">${rows}</ul>
      <p class="split">${parts.join(", ")}. Risk score <strong>${a.score}</strong>.</p>`;
  } else if (!isExpansion(a)) {
    score = '<p class="hint">No warning signs in the data.</p>';
  }
  return `<section><h3>${isExpansion(a) ? "Why it is growing" : "Why this score"}</h3>${growth}${score}</section>`;
}

function fact(label, value, sub, warn) {
  return `<div class="${warn ? "warn" : ""}"><dt>${label}</dt><dd>${value}${sub ? ` <span class="sub">${sub}</span>` : ""}</dd></div>`;
}

function numbersSection(a) {
  const t = state.data.thresholds;
  const hasTrend = a.interconnections_now != null && a.interconnections_6mo_ago != null;
  const touchKnown = a.days_since_touch != null && a.days_since_touch >= 0;
  const rows = [
    fact("Power used", a.power_pct == null ? MISSING : `${a.power_pct}%`,
      `${num(a.used_power_kva)} of ${num(a.contracted_power_kva)} kVA. Flagged below ${t.low_power_pct}%.`,
      a.power_pct != null && a.power_pct < t.low_power_pct),
    fact("Interconnections", num(a.interconnections_now),
      hasTrend ? `${num(a.interconnections_6mo_ago)} six months ago. Flagged if lower now.` : "Trend unknown: bad value in the data, not counted.",
      hasTrend && a.interconnections_now < a.interconnections_6mo_ago),
    fact("Renewal", a.renewal_date ?? MISSING, `${a.days_to_renewal == null ? "" : `In ${a.days_to_renewal} days. `}Flagged within ${t.renewal_soon_days} days.`,
      a.days_to_renewal != null && a.days_to_renewal <= t.renewal_soon_days),
    fact("Last CSM touch", touchKnown ? `${a.days_since_touch} days ago` : MISSING, `Flagged after ${t.stale_touch_days} days.`,
      touchKnown && a.days_since_touch > t.stale_touch_days),
    fact("Past due invoices", a.invoices_past_due == null ? MISSING : num(a.invoices_past_due), "Flagged at 1 or more.", a.invoices_past_due > 0),
    fact("CSAT", a.csat == null ? MISSING : `${a.csat} of 5`, `Last survey. Flagged at ${t.csat_warn_max} or lower.`,
      a.csat != null && a.csat <= t.csat_warn_max),
  ].join("");
  return `<section><h3>Key numbers</h3><dl class="facts-list">${rows}</dl></section>`;
}

function notesSection(a) {
  const notes = a.notes.length
    ? a.notes.map((n) => `<blockquote>${esc(n.text)}</blockquote><p class="cite">${esc(n.csm)}, ${esc(n.date ?? "date unknown")}</p>`).join("")
    : '<p class="hint">No CSM notes on file.</p>';
  return `<section><h3>CSM notes</h3>${notes}</section>`;
}

function casesSection(a) {
  const cases = a.open_cases.length
    ? `<div class="table-wrap"><table><thead><tr><th>Case</th><th>Priority</th><th>Status</th><th>Category</th><th>Opened</th><th>Subject</th></tr></thead>
      <tbody>${a.open_cases.map((c) => `<tr><td>${esc(c.case_id)}</td><td class="prio-${esc(c.priority)}">${esc(c.priority)}</td>
        <td class="status-${esc(c.status)}">${esc(c.status)}</td><td>${esc(c.category)}</td><td>${esc(c.opened ?? "unknown")}</td>
        <td>${esc(c.subject)}</td></tr>`).join("")}</tbody></table></div>`
    : '<p class="hint">No open cases.</p>';
  return `<section><h3>Open cases (${a.open_cases.length})</h3>${cases}
    <p class="footnote">${plural(a.closed_case_count, "closed case")} on file.</p></section>`;
}

function yourNotesSection() {
  return `<section><h3>Your notes</h3>
    <textarea class="notes-box" rows="3" disabled aria-describedby="notes-next"
      placeholder="Log what happened on the call."></textarea>
    <p class="footnote" id="notes-next">Coming next: notes save to Salesforce and feed the next score.</p></section>`;
}

function aiColumn(a) {
  const b = state.briefs[a.account_id];
  const head = '<h3>AI summary</h3>';
  if (!b) {
    return `<aside class="ai-col">${head}<p>AI summary not available for this account. Everything in From the data is complete.</p></aside>`;
  }
  const list = (items) => items.map((x) => `<li>${esc(x)}</li>`).join("");
  const check = b.unverified_numbers?.length
    ? `<p class="check">Check needed: ${esc(b.unverified_numbers.join(", "))} not found in the data.</p>` : "";
  return `<aside class="ai-col">${head}${check}
    <h4>Summary</h4><p class="summary">${esc(b.summary)}</p>
    <h4>Talking points</h4><ul class="points">${list(b.talking_points)}</ul>
    <h4>Risks to raise</h4><ul>${list(b.risks)}</ul>
    <p class="ai-meta">Written ahead of time by ${esc(state.briefMeta.model)} using only the facts on this page. Every number in it was checked against the data. Read it before you use it.</p>
  </aside>`;
}

function renderBrief() {
  const a = allAccounts().find((x) => x.account_id === state.selected);
  const el = document.getElementById("brief");
  if (!a) {
    el.innerHTML = '<p class="hint">Pick an account to prep the call.</p>';
    return;
  }
  el.innerHTML = `${briefHead(a)}
    <div class="brief-cols">
      <div class="facts-col"><p class="source">From the data</p>
        ${whySection(a)}${numbersSection(a)}${notesSection(a)}${casesSection(a)}${yourNotesSection()}</div>
      ${aiColumn(a)}
    </div>`;
}

function select(id, { focus = false } = {}) {
  state.selected = id;
  history.replaceState(null, "", `#${id}`);
  document.querySelectorAll(".row, .cab").forEach((b) => b.setAttribute("aria-current", b.dataset.id === id));
  renderBrief();
  const current = document.querySelector('.row[aria-current="true"]');
  if (current && !focus) {
    showTab(document.getElementById(current.closest(".panel").id === "panel-expansion" ? "tab-expansion" : "tab-risk"));
    current.scrollIntoView({ block: "nearest" });
  }
  if (focus) {
    const brief = document.getElementById("brief");
    if (brief.getBoundingClientRect().top < 0 || window.matchMedia("(max-width: 900px)").matches) {
      brief.scrollIntoView({ behavior: "smooth" });
    }
    brief.focus({ preventScroll: true });
  }
}

async function loadJson(path, fallback) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    return res.ok ? await res.json() : fallback;
  } catch {
    return fallback;
  }
}

function hashId() {
  try {
    return decodeURIComponent(location.hash.slice(1));
  } catch {
    return "";
  }
}

function selectFromHash() {
  const fromHash = hashId();
  if (fromHash && fromHash === state.selected) return;
  const accounts = allAccounts();
  const known = accounts.some((a) => a.account_id === fromHash);
  if (known || accounts.length) select(known ? fromHash : accounts[0].account_id);
  else renderBrief();
}

async function init() {
  const [data, briefFile] = await Promise.all([loadJson("app-data.json", null), loadJson("briefs.json", { briefs: {} })]);
  state.data = data;
  if (!state.data) {
    document.getElementById("brief").innerHTML =
      '<p class="check">Could not load app-data.json. Run python3 pipeline/build.py, then serve this folder.</p>';
    return;
  }
  state.briefs = briefFile.briefs || {};
  state.briefMeta = briefFile;

  document.getElementById("as-of").textContent = `Data as of ${state.data.as_of_date}.`;
  const filter = document.getElementById("csm-filter");
  [...new Set(allAccounts().map((a) => a.csm))].sort().forEach((csm) => filter.add(new Option(csm, csm)));
  filter.addEventListener("change", () => { state.csm = filter.value; renderLists(); });

  document.addEventListener("click", (e) => {
    const target = e.target.closest(".row, .cab");
    if (target) select(target.dataset.id, { focus: true });
    const tab = e.target.closest('[role="tab"]');
    if (tab) showTab(tab);
  });
  document.querySelector(".tabs").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const next = tabs[(tabs.indexOf(document.activeElement) + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    showTab(next, { focus: true });
  });

  renderHall();
  renderIssues();
  renderLists();
  window.addEventListener("hashchange", selectFromHash);
  selectFromHash();
}

init();
