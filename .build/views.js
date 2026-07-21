function viewDashboard() {
  ensureDashboard();
  const action = DASHBOARD ? `<button class="btn" onclick="loadDashboard(true)">${ic("clock", 15)} Refresh</button>` : "";
  let body;
  if (DASHBOARD_ERROR) {
    body = `<div class="card"><div class="empty"><div class="ico">${ic("alert", 22)}</div><b>Couldn't load the dashboard</b><p>${esc(DASHBOARD_ERROR)}</p><button class="btn primary" onclick="loadDashboard(true)">${ic("clock", 15)} Retry</button></div></div>`;
  } else if (!DASHBOARD) {
    body = loadingCard("Loading your caseload overview");
  } else {
    body = dashboardBody(DASHBOARD);
  }
  const head = pageHead("Dashboard", dashGreeting(), action);
  return shell("dashboard", `${crumb([{ t: orgLabel(), h: "#/dashboard" }, { t: "Dashboard" }])}${head}${body}`);
}
function dashGreeting() {
  const n = typeof SESSION !== "undefined" && SESSION && SESSION.firstName ? SESSION.firstName : "";
  const hi = n ? `Welcome back, ${esc(n)}.` : "Welcome back.";
  return `${hi} Here's your practice at a glance.`;
}
function refTone(status) {
  if (status === "Accepted" || status === "Enrolled") return "good";
  if (status === "Declined" || status === "Family Declined") return "bad";
  if (status === "Considering" || status === "Pre-screening") return "warn";
  return "";
}
function dashboardBody(d) {
  const s = d.stages || {};
  const r = d.referrals || {};
  const t = d.tasks || {};
  const decided = (r.accepted || 0) + (r.declined || 0);
  const winRate = decided ? Math.round((r.accepted || 0) / decided * 100) : 0;
  const stats = `<div class="stat-row">
    ${statTile("users", "Active clients", s.client || 0, "current caseload", "")}
    ${statTile("user", "Inquiries", s.inquiry || 0, "in the pipeline", "")}
    ${statTile("check", "Alumni", s.alumni || 0, "placed & closed", "good")}
    ${statTile("alert", "Overdue tasks", t.overdue || 0, (t.dueThisWeek || 0) + " due this week", t.overdue ? "bad" : "")}
    ${statTile("sparkle", "Referral win rate", winRate + "%", (r.accepted || 0) + " accepted \xB7 " + (r.declined || 0) + " declined", winRate >= 50 ? "good" : "")}
  </div>`;
  const total = (s.inquiry || 0) + (s.client || 0) + (s.alumni || 0) || 1;
  const seg = `<div class="dash-card">
    <h3>${ic("report", 16)} Caseload pipeline <span class="hint">${d.totalPeople || total} people</span></h3>
    <div class="seg">
      <span style="width:${(s.inquiry || 0) / total * 100}%;background:var(--warning)"></span>
      <span style="width:${(s.client || 0) / total * 100}%;background:var(--primary)"></span>
      <span style="width:${(s.alumni || 0) / total * 100}%;background:var(--success)"></span>
    </div>
    <div class="seg-legend">
      ${segLi("var(--warning)", "Inquiries", s.inquiry || 0)}
      ${segLi("var(--primary)", "Clients", s.client || 0)}
      ${segLi("var(--success)", "Alumni", s.alumni || 0)}
    </div>
  </div>`;
  const outcomeMax = Math.max(r.accepted || 0, r.declined || 0, 1);
  const outcomes = `<div class="dash-card">
    <h3>${ic("share", 16)} Referral outcomes <span class="hint">${r.total || 0} total</span></h3>
    <div class="bar-list">
      ${barItem("Accepted / enrolled", r.accepted || 0, outcomeMax, "good")}
      ${barItem("Declined", r.declined || 0, outcomeMax, "bad")}
    </div>
    <div class="seg-legend" style="margin-top:16px">
      <div class="li"><b style="font-size:20px">${winRate}%</b>&nbsp;<span class="c">acceptance rate of decided referrals</span></div>
    </div>
  </div>`;
  const taskList = (d.upcomingTasks || []).map((tk) => dashTaskRow(tk, d.today)).join("") || `<div class="dash-empty">No open tasks with due dates. \u{1F389}</div>`;
  const tasksCard = `<div class="dash-card">
    <h3>${ic("calendar", 16)} Tasks ${t.open || 0 ? `<span class="hint">${t.open} open</span>` : ""}</h3>
    <div class="mini-buckets">
      <div class="mini bad"><div class="n">${t.overdue || 0}</div><div class="l">Overdue</div></div>
      <div class="mini warn"><div class="n">${t.dueThisWeek || 0}</div><div class="l">Due this week</div></div>
      <div class="mini"><div class="n">${t.upcoming || 0}</div><div class="l">Upcoming</div></div>
    </div>
    <div class="dash-list">${taskList}</div>
  </div>`;
  const commList = (d.recentComms || []).map((c) => dashCommRow(c)).join("") || `<div class="dash-empty">No communications logged yet.</div>`;
  const activity = `<div class="dash-card">
    <h3>${ic("msg", 16)} Recent activity</h3>
    <div class="dash-list">${commList}</div>
  </div>`;
  const byStatus = r.byStatus || {};
  const statusOrder = ["Considering", "Pre-screening", "Referred", "Application Sent", "Waitlisted", "Accepted", "Enrolled", "Declined", "Family Declined"];
  const statusKeys = statusOrder.filter((k) => byStatus[k]);
  const statusMax = Math.max.apply(null, statusKeys.map((k) => byStatus[k]).concat([1]));
  const funnel = `<div class="dash-card">
    <h3>${ic("filter", 16)} Referral funnel <span class="hint">by status</span></h3>
    <div class="bar-list">
      ${statusKeys.map((k) => barItem(k, byStatus[k], statusMax, refTone(k))).join("")}
    </div>
  </div>`;
  const progs = r.topPrograms || [];
  const progMax = Math.max.apply(null, progs.map((p) => p.count).concat([1]));
  const declines = r.topDeclineReasons || [];
  const topCard = `<div class="dash-card">
    <h3>${ic("building", 16)} Top referral destinations</h3>
    ${progs.length ? `<div class="bar-list">${progs.map((p) => barItem(p.program, p.count, progMax, "")).join("")}</div>` : `<div class="dash-empty">No referrals logged yet.</div>`}
    ${declines.length ? `<h3 style="margin:20px 0 10px">${ic("info", 16)} Why referrals fall through</h3>
      <div class="dash-pills">${declines.map((x) => `<span class="pill muted">${esc(x.reason)} <b>&nbsp;${x.count}</b></span>`).join("")}</div>` : ""}
  </div>`;
  return `${stats}
    <div class="dash-grid">${seg}${tasksCard}</div>
    <div class="dash-grid">${outcomes}${activity}</div>
    <div class="dash-grid">${funnel}${topCard}</div>`;
}
function statTile(icon, label, num, sub, tone) {
  return `<div class="stat${tone ? " " + tone : ""}">
    <div class="lbl">${ic(icon, 14)} ${esc(label)}</div>
    <div class="num">${esc(String(num))}</div>
    <div class="sub">${esc(sub)}</div>
  </div>`;
}
function segLi(color, label, count) {
  return `<div class="li"><span class="sw" style="background:${color}"></span><b>${count}</b>&nbsp;<span class="c">${esc(label)}</span></div>`;
}
function barItem(label, count, max, tone) {
  const pct = max ? Math.round(count / max * 100) : 0;
  return `<div class="bar-item">
    <span class="bl">${esc(label)}</span>
    <span class="bar-track"><span class="bar-fill${tone ? " " + tone : ""}" style="width:${pct}%"></span></span>
    <span class="bn">${count}</span>
  </div>`;
}
function dashTaskRow(tk, today) {
  const due = String(tk.dueDate || "");
  let rt = fmtDate(due) || "\u2014";
  let cls = "";
  if (due && today && due < today) {
    cls = " bad";
    rt = "Overdue \xB7 " + rt;
  }
  return `<div class="dash-li" onclick="go('#/clients/${encodeURIComponent(tk.clientId)}/tasks')">
    <div class="di">${ic("check", 15)}</div>
    <div class="bd"><div class="t1">${esc(tk.title || "Untitled task")}</div>
      <div class="t2">${esc(tk.clientName || "")}${tk.assignee ? " \xB7 " + esc(tk.assignee) : ""}</div></div>
    <div class="rt${cls}">${esc(rt)}</div>
  </div>`;
}
function dashCommRow(c) {
  const iconFor = { "Call": "bell", "Email": "mail", "Text": "msg", "Video Call": "laptop", "In-person / Meeting": "users", "Note": "fileText" };
  const icon = iconFor[c.type] || "msg";
  const when = fmtDate(String(c.date || "")) || "";
  return `<div class="dash-li" onclick="go('#/clients/${encodeURIComponent(c.clientId)}/communications')">
    <div class="di">${ic(icon, 15)}</div>
    <div class="bd"><div class="t1">${esc(c.subject || c.type || "Communication")}</div>
      <div class="t2">${esc(c.clientName || "")}${c.type ? " \xB7 " + esc(c.type) : ""}</div></div>
    <div class="rt">${esc(when)}</div>
  </div>`;
}
function loadingCard(msg) {
  return `<div class="card"><div class="empty"><div class="ico">${ic("clock", 22)}</div><b>${esc(msg)}</b><p>Fetching live records from the maestro.</p></div></div>`;
}
function errorCard(err) {
  return `<div class="card"><div class="empty"><div class="ico">${ic("alert", 22)}</div><b>Couldn't load clients</b><p>${esc(err)}</p><button class="btn primary" onclick="loadClients(true)">${ic("clock", 15)} Retry</button></div></div>`;
}
const LIST_TABS = [
  { key: "client", label: "client", plural: "Clients" },
  { key: "inquiry", label: "inquiry", plural: "Inquiries" },
  { key: "alumni", label: "alumnus", plural: "Alumni" }
];
let LIST_TAB = "client";
function activeTab() {
  return LIST_TABS.filter((t) => t.key === LIST_TAB)[0] || LIST_TABS[0];
}
function listStore(key) {
  return key === "inquiry" ? INQUIRY_STORE : key === "alumni" ? ALUMNI_STORE : CLIENT_STORE;
}
function listLoading(key) {
  return key === "inquiry" ? INQUIRIES_LOADING : key === "alumni" ? ALUMNI_LOADING : CLIENTS_LOADING;
}
function listError(key) {
  return key === "inquiry" ? INQUIRIES_ERROR : key === "alumni" ? ALUMNI_ERROR : CLIENTS_ERROR;
}
function ensureList(key) {
  if (key === "inquiry") {
    if (INQUIRY_STORE === null && !INQUIRIES_LOADING && !INQUIRIES_ERROR) loadInquiries();
  } else if (key === "alumni") {
    if (ALUMNI_STORE === null && !ALUMNI_LOADING && !ALUMNI_ERROR) loadAlumni();
  } else {
    if (CLIENT_STORE === null && !CLIENTS_LOADING && !CLIENTS_ERROR) loadClients();
  }
}
function setListTab(key) {
  if (LIST_TAB === key) return;
  LIST_TAB = key;
  CLIENT_QUERY = "";
  if (typeof render === "function") render();
}
function listTabBar() {
  return `<div class="tabs">` + LIST_TABS.map((t) => {
    const store = listStore(t.key);
    const badge = store ? `<span class="tab-badge">${store.length}</span>` : "";
    return `<button class="tab${t.key === LIST_TAB ? " active" : ""}" onclick="setListTab('${t.key}')">${esc(t.plural)}${badge}</button>`;
  }).join("") + `</div>`;
}
function clientsChrome(countLabel) {
  const tab = activeTab();
  const action = `<button class="btn primary" onclick="openNewClient('${tab.key}')">${ic("plus", 15)} New ${esc(tab.label)}</button>`;
  return `
  ${crumb([{ t: orgLabel(), h: "#/dashboard" }, { t: tab.plural }])}
  ${pageHead("Clients", "Everyone on your caseload \u2014 clients, inquiries, and alumni, live from the database.", action)}
  ${listTabBar()}
  <div class="toolbar">
    <div class="search">${ic("search", 15)}<input id="client-search" placeholder="Search ${esc(tab.plural.toLowerCase())}\u2026" value="${esc(CLIENT_QUERY)}" oninput="clientOnSearch()" autocomplete="off"></div>
    <span class="count" id="client-count">${esc(countLabel)}</span>
    <div style="flex:1"></div>
  </div>`;
}
function clientsTable(list) {
  const rows = list.map((c) => {
    const loc = [c.demo.city, c.demo.state].filter(Boolean).join(", ");
    const phone = c.cell || c.homePhone || "";
    const meta = c.prefName ? "Goes by " + esc(c.prefName) : "";
    return `<tr class="clickable" onclick="go('#/clients/' + encodeURIComponent('${c.id}'))">
      <td><div class="cell-name">${avatar(c.first, c.last, 36, 13, c.photoUrl)}<div><div class="nm">${esc(c.last)}, ${esc(c.first)}</div>${meta ? `<div class="meta">${meta}</div>` : ""}</div></div></td>
      <td>${loc ? esc(loc) : dash}</td>
      <td>${val(c.email)}</td>
      <td>${phone ? esc(phone) : dash}</td>
    </tr>`;
  }).join("");
  return `<div class="tbl-wrap"><table>
    <thead class="rich"><tr>
      <th><span class="th-sort">Client ${ic("sort", 13)}</span></th>
      <th><span class="th-sort">Location ${ic("sort", 13)}</span></th>
      <th><span class="th-sort">Email ${ic("sort", 13)}</span></th>
      <th><span class="th-sort">Phone ${ic("sort", 13)}</span></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <div class="pager"><span>Showing 1\u2013${list.length} of ${list.length}</span>
    <div class="pg"><button>${ic("chevR", 14)}</button><button class="num">1</button><button>${ic("chevR", 14)}</button></div></div>`;
}
let CLIENT_QUERY = "";
function clientsFiltered() {
  const all = listStore(LIST_TAB) || [];
  const q = CLIENT_QUERY.toLowerCase().trim();
  if (!q) return all;
  return all.filter((c) => {
    const hay = [c.last, c.first, c.prefName, c.demo.city, c.demo.state, c.email, c.cell, c.homePhone].filter(Boolean).join(" ").toLowerCase();
    return hay.indexOf(q) >= 0;
  });
}
function clientCountLabel() {
  const total = (listStore(LIST_TAB) || []).length;
  return clientsFiltered().length + " of " + total;
}
function clientsRegionInner() {
  const tab = activeTab();
  const total = (listStore(LIST_TAB) || []).length;
  const list = clientsFiltered();
  if (list.length) return clientsTable(list);
  if (total) return `<div class="card"><div class="empty"><div class="ico">${ic("search", 22)}</div><b>No matching ${esc(tab.plural.toLowerCase())}</b><p>Try a different name, location, email, or phone.</p></div></div>`;
  return `<div class="card"><div class="empty"><div class="ico">${ic("users", 22)}</div><b>No ${esc(tab.plural.toLowerCase())} yet</b><p>Create your first ${esc(tab.label)} to get started.</p><button class="btn primary" onclick="openNewClient('${tab.key}')">${ic("plus", 15)} New ${esc(tab.label)}</button></div></div>`;
}
function clientOnSearch() {
  const el = document.getElementById("client-search");
  CLIENT_QUERY = el ? el.value : "";
  const region = document.getElementById("client-region");
  if (region) region.innerHTML = clientsRegionInner();
  const cnt = document.getElementById("client-count");
  if (cnt) cnt.textContent = clientCountLabel();
}
function viewClients() {
  LIST_TABS.forEach((t) => ensureList(t.key));
  const tab = activeTab();
  const store = listStore(LIST_TAB);
  const err = listError(LIST_TAB);
  if (store === null) {
    return shell("clients", clientsChrome("\u2026") + (err ? errorCard(err) : loadingCard("Loading " + tab.plural.toLowerCase() + "\u2026")));
  }
  return shell("clients", clientsChrome(clientCountLabel()) + `<div id="client-region">${clientsRegionInner()}</div>`);
}
function programsError(err) {
  return `<div class="card"><div class="empty"><div class="ico">${ic("alert", 22)}</div><b>Couldn't load the directory</b><p>${esc(err)}</p><button class="btn primary" onclick="loadPrograms(true)">${ic("clock", 15)} Retry</button></div></div>`;
}
function asArr(v) {
  return Array.isArray(v) ? v.filter(Boolean) : v ? [String(v)] : [];
}
const PROG_FACETS = [
  { key: "setting", store: "setting", label: "Setting" },
  { key: "levelOfCare", store: "levelOfCare", label: "Level of care" },
  { key: "specialties", store: "specialties", label: "Specialties" },
  { key: "modalities", store: "modalities", label: "Modalities" },
  { key: "genderServed", store: "genderServed", label: "Gender served" },
  { key: "region", store: "region", label: "Region" }
];
const PROG_TOGGLES = [
  { key: "insuranceAccepted", label: "Takes insurance" },
  { key: "bluestep", label: "On BlueStep" },
  { key: "verified", label: "Verified only" }
];
function progFacetValues(storeKey) {
  const set = {};
  for (const p of PROGRAM_STORE || []) for (const v of asArr(p[storeKey])) set[v] = true;
  return Object.keys(set).sort();
}
function progActiveCount() {
  let n = 0;
  for (const f of PROG_FACETS) n += PROG_FILTER[f.key].length;
  if (PROG_FILTER.state) n++;
  if (PROG_FILTER.age) n++;
  for (const t of PROG_TOGGLES) if (PROG_FILTER[t.key]) n++;
  return n;
}
function progFilterSummary() {
  const parts = [];
  for (const f of PROG_FACETS) {
    const sel = PROG_FILTER[f.key];
    if (sel.length) parts.push(f.label + ": " + sel.join(", "));
  }
  if (PROG_FILTER.state) parts.push("Home state: " + PROG_FILTER.state);
  if (PROG_FILTER.age) parts.push("Serves age " + PROG_FILTER.age);
  for (const t of PROG_TOGGLES) if (PROG_FILTER[t.key]) parts.push(t.label);
  if (PROG_FILTER.q) parts.push('Search: "' + PROG_FILTER.q + '"');
  return parts.join(" \xB7 ") || "none";
}
function progBiqPayload() {
  if (progActiveCount() === 0) return null;
  const all = progFiltered();
  const CAP = 60;
  const programs = all.slice(0, CAP).map((p) => ({
    id: p.id,
    name: p.programName,
    state: p.locationState || "",
    region: p.region || "",
    setting: asArr(p.setting),
    levelOfCare: asArr(p.levelOfCare),
    specialties: asArr(p.specialties),
    modalities: asArr(p.modalities),
    ageMin: p.ageMin ?? null,
    ageMax: p.ageMax ?? null,
    costPerMonthUSD: p.costPerMonthUSD ?? null,
    insuranceAccepted: p.insuranceAccepted === true
  }));
  return { active: true, summary: progFilterSummary(), count: all.length, total: (PROGRAM_STORE || []).length, programs };
}
function programsChrome(countLabel) {
  const n = progActiveCount();
  const badge = n ? `<span class="flt-badge">${n}</span>` : "";
  return `${crumb([{ t: orgLabel(), h: "#/dashboard" }, { t: "Programs" }])}
  ${pageHead("Program Directory", "A shared library of treatment programs \u2014 searchable across levels of care, populations, and geography.", `<button class="btn outline" onclick="loadPrograms(true)">${ic("clock", 15)} Refresh</button>`)}
  <div class="toolbar">
    <div class="search">${ic("search", 15)}<input id="prog-search" placeholder="Search programs, locations, specialties\u2026" value="${esc(PROG_FILTER.q)}" oninput="progOnSearch()"></div>
    <button class="btn outline prog-filters-btn${PROG_FILTER.panelOpen ? " active" : ""}" id="prog-filters-btn" aria-expanded="${PROG_FILTER.panelOpen}" onclick="progTogglePanel()">${ic("filter", 15)} Filters${badge}</button>
    <div style="flex:1"></div>
    <span class="count" id="prog-count">${esc(countLabel)}</span>
  </div>
  <div id="prog-filter-panel" class="prog-filter-panel${PROG_FILTER.panelOpen ? " open" : ""}">${progFilterPanelInner()}</div>
  <div id="prog-active-chips" class="prog-active-chips">${progActiveChipsInner()}</div>`;
}
function progFilterPanelInner() {
  const groups = PROG_FACETS.map((f) => {
    const sel = PROG_FILTER[f.key];
    const vals = progFacetValues(f.store);
    if (!vals.length) return "";
    const chips = vals.map((v) => {
      const on = sel.indexOf(v) >= 0;
      return `<button class="facet-chip${on ? " on" : ""}" onclick="progToggleFacet('${f.key}','${esc(v).replace(/'/g, "\\'")}')">${esc(v)}</button>`;
    }).join("");
    return `<div class="flt-group"><div class="flt-label">${esc(f.label)}</div><div class="flt-chips">${chips}</div></div>`;
  }).join("");
  const states = progFacetValues("locationState");
  const stateOpts = ['<option value="">Any state</option>'].concat(states.map((s) => `<option value="${esc(s)}"${s === PROG_FILTER.state ? " selected" : ""}>${esc(s)}</option>`)).join("");
  const toggles = PROG_TOGGLES.map((t) => {
    const on = PROG_FILTER[t.key];
    return `<button class="facet-chip${on ? " on" : ""}" onclick="progToggleFlag('${t.key}')">${esc(t.label)}</button>`;
  }).join("");
  return `${groups}
    <div class="flt-row">
      <div class="flt-group flt-inline"><div class="flt-label">Home state</div>
        <select class="prog-filter" onchange="progOnState(this.value)">${stateOpts}</select></div>
      <div class="flt-group flt-inline"><div class="flt-label">Serves age</div>
        <input class="prog-age-in" type="number" min="0" max="99" placeholder="e.g. 15" value="${esc(PROG_FILTER.age)}" oninput="progOnAge(this.value)"></div>
      <div class="flt-group flt-inline"><div class="flt-label">Quick filters</div><div class="flt-chips">${toggles}</div></div>
    </div>
    <div class="flt-foot"><button class="btn ghost sm" onclick="progClearFilters()">${ic("x", 14)} Clear all filters</button></div>`;
}
function progActiveChipsInner() {
  const chips = [];
  for (const f of PROG_FACETS) for (const v of PROG_FILTER[f.key]) {
    chips.push(`<button class="active-chip" onclick="progToggleFacet('${f.key}','${esc(v).replace(/'/g, "\\'")}')">${esc(v)} ${ic("x", 12)}</button>`);
  }
  if (PROG_FILTER.state) chips.push(`<button class="active-chip" onclick="progOnState('')">State: ${esc(PROG_FILTER.state)} ${ic("x", 12)}</button>`);
  if (PROG_FILTER.age) chips.push(`<button class="active-chip" onclick="progOnAge('')">Serves age ${esc(PROG_FILTER.age)} ${ic("x", 12)}</button>`);
  for (const t of PROG_TOGGLES) if (PROG_FILTER[t.key]) chips.push(`<button class="active-chip" onclick="progToggleFlag('${t.key}')">${esc(t.label)} ${ic("x", 12)}</button>`);
  if (!chips.length) return "";
  return chips.join("") + `<button class="active-chip clear" onclick="progClearFilters()">Clear all</button>`;
}
const PROG_PAGE_SIZE = 50;
const PROG_FILTER = {
  q: "",
  page: 1,
  panelOpen: false,
  state: "",
  age: "",
  setting: [],
  levelOfCare: [],
  specialties: [],
  modalities: [],
  genderServed: [],
  region: [],
  insuranceAccepted: false,
  bluestep: false,
  verified: false
};
function progFiltered() {
  const q = PROG_FILTER.q.toLowerCase().trim();
  const age = PROG_FILTER.age ? Number(PROG_FILTER.age) : null;
  const out = (PROGRAM_STORE || []).filter((p) => {
    for (const f of PROG_FACETS) {
      const sel = PROG_FILTER[f.key];
      if (sel.length) {
        const pv = asArr(p[f.store]);
        if (!sel.some((v) => pv.indexOf(v) >= 0)) return false;
      }
    }
    if (PROG_FILTER.state && p.locationState !== PROG_FILTER.state) return false;
    if (age !== null && !isNaN(age)) {
      const lo = typeof p.ageMin === "number" ? p.ageMin : null;
      const hi = typeof p.ageMax === "number" ? p.ageMax : null;
      if (lo !== null && age < lo) return false;
      if (hi !== null && age > hi) return false;
      if (lo === null && hi === null) return false;
    }
    if (PROG_FILTER.insuranceAccepted && p.insuranceAccepted !== true) return false;
    if (PROG_FILTER.bluestep && p.bluestepOrgRef !== true) return false;
    if (PROG_FILTER.verified && p.verified !== true) return false;
    if (q) {
      const hay = [
        p.programName,
        p.location,
        p.populationsRaw,
        asArr(p.specialties).join(" "),
        asArr(p.setting).join(" "),
        asArr(p.levelOfCare).join(" "),
        asArr(p.programType).join(" "),
        asArr(p.states).join(" "),
        p.agesRaw
      ].join(" ").toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });
  return out.sort((a, b) => a.programName.localeCompare(b.programName));
}
function progCountLabel() {
  const total = (PROGRAM_STORE || []).length;
  const filtered = progFiltered().length;
  return filtered === total ? total + " programs" : filtered + " of " + total + " programs";
}
function progRow(p) {
  const types = (p.programType || []).join(", ");
  const bs = p.bluestepOrgRef ? `<span class="bs-dot" title="On BlueStep \u2014 referrals flow directly"></span>` : "";
  return `<tr class="prog-row" onclick="go('#/programs/' + encodeURIComponent('${p.id}'))">
    <td class="pt-name">${bs}${esc(p.programName)}</td>
    <td class="pt-loc" title="${esc(p.location || "")}">${esc(p.location || "\u2014")}</td>
    <td class="pt-type" title="${esc(types)}">${esc(types || "\u2014")}</td>
    <td class="pt-ages">${esc(p.agesRaw || "\u2014")}</td>
  </tr>`;
}
function progPagerHtml(total) {
  const pages = Math.max(1, Math.ceil(total / PROG_PAGE_SIZE));
  const page = Math.min(Math.max(1, PROG_FILTER.page), pages);
  const start = total ? (page - 1) * PROG_PAGE_SIZE + 1 : 0;
  const end = Math.min(total, page * PROG_PAGE_SIZE);
  const info = `<span class="pg-info">${total ? start + "\u2013" + end : 0} of ${total}</span>`;
  if (pages <= 1) return info;
  let nums = "";
  for (let i = 1; i <= pages; i++) nums += `<button class="pg-num${i === page ? " active" : ""}" onclick="progGoPage(${i})">${i}</button>`;
  const prev = `<button class="pg-btn"${page <= 1 ? " disabled" : ""} onclick="progGoPage(${page - 1})">${ic("chevL", 14)}</button>`;
  const next = `<button class="pg-btn"${page >= pages ? " disabled" : ""} onclick="progGoPage(${page + 1})">${ic("chevR", 14)}</button>`;
  return `${info}<span style="flex:1"></span>${prev}${nums}${next}`;
}
function progTableHtml() {
  const all = progFiltered();
  const pages = Math.max(1, Math.ceil(all.length / PROG_PAGE_SIZE));
  if (PROG_FILTER.page > pages) PROG_FILTER.page = pages;
  if (PROG_FILTER.page < 1) PROG_FILTER.page = 1;
  const startIdx = (PROG_FILTER.page - 1) * PROG_PAGE_SIZE;
  const pageItems = all.slice(startIdx, startIdx + PROG_PAGE_SIZE);
  const rows = pageItems.length ? pageItems.map(progRow).join("") : `<tr><td colspan="4"><div class="empty" style="padding:34px 12px"><div class="ico">${ic("search", 22)}</div><b>No matching programs</b><p>Try a different search term or filter.</p></div></td></tr>`;
  return `<div class="card prog-table-card">
    <div class="prog-table-scroll"><table class="prog-table">
      <thead><tr><th>Program</th><th>Location</th><th>Type</th><th>Ages</th></tr></thead>
      <tbody id="prog-tbody">${rows}</tbody>
    </table></div>
    <div class="prog-pager" id="prog-pager">${progPagerHtml(all.length)}</div>
  </div>`;
}
function renderProgramTable() {
  const region = document.getElementById("prog-table-region");
  if (region) region.innerHTML = progTableHtml();
  const cnt = document.getElementById("prog-count");
  if (cnt) cnt.textContent = progCountLabel();
}
function progOnSearch() {
  const el = document.getElementById("prog-search");
  PROG_FILTER.q = el ? el.value : "";
  PROG_FILTER.page = 1;
  renderProgramTable();
}
function renderProgramFilters() {
  PROG_FILTER.page = 1;
  const panel = document.getElementById("prog-filter-panel");
  if (panel) panel.innerHTML = progFilterPanelInner();
  const chips = document.getElementById("prog-active-chips");
  if (chips) chips.innerHTML = progActiveChipsInner();
  const btn = document.getElementById("prog-filters-btn");
  if (btn) {
    const n = progActiveCount();
    const base = `${ic("filter", 15)} Filters`;
    btn.innerHTML = base + (n ? `<span class="flt-badge">${n}</span>` : "");
  }
  renderProgramTable();
}
function progTogglePanel() {
  PROG_FILTER.panelOpen = !PROG_FILTER.panelOpen;
  const panel = document.getElementById("prog-filter-panel");
  const btn = document.getElementById("prog-filters-btn");
  if (panel) panel.classList.toggle("open", PROG_FILTER.panelOpen);
  if (btn) {
    btn.classList.toggle("active", PROG_FILTER.panelOpen);
    btn.setAttribute("aria-expanded", String(PROG_FILTER.panelOpen));
  }
}
function progToggleFacet(dim, value) {
  const arr = PROG_FILTER[dim];
  const i = arr.indexOf(value);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(value);
  renderProgramFilters();
}
function progToggleFlag(key) {
  PROG_FILTER[key] = !PROG_FILTER[key];
  renderProgramFilters();
}
function progOnState(v) {
  PROG_FILTER.state = v;
  renderProgramFilters();
}
function progOnAge(v) {
  PROG_FILTER.age = (v || "").trim();
  renderProgramFilters();
}
function progClearFilters() {
  PROG_FILTER.state = "";
  PROG_FILTER.age = "";
  for (const f of PROG_FACETS) PROG_FILTER[f.key] = [];
  for (const t of PROG_TOGGLES) PROG_FILTER[t.key] = false;
  renderProgramFilters();
}
function progGoPage(n) {
  PROG_FILTER.page = n;
  renderProgramTable();
  const main = document.querySelector(".main");
  if (main) main.scrollTo(0, 0);
}
function viewPrograms() {
  if (PROGRAM_STORE === null) {
    if (!PROGRAMS_LOADING && !PROGRAMS_ERROR) loadPrograms();
    return shell("programs", programsChrome("\u2026") + (PROGRAMS_ERROR ? programsError(PROGRAMS_ERROR) : loadingCard("Loading the directory\u2026")));
  }
  const region = `<div id="prog-table-region">${progTableHtml()}</div>`;
  return shell("programs", programsChrome(progCountLabel()) + region);
}
function progSection(title, body) {
  if (!body || !body.trim()) return "";
  return `<div class="card card-pad prog-sec"><div class="sec-h">${esc(title)}</div><div class="sec-body">${esc(body)}</div></div>`;
}
const PROGRAM_SECTIONS = [
  { key: "summary", label: "Summary" },
  { key: "notes", label: "Notes" },
  { key: "files", label: "Files" },
  { key: "details", label: "Program Details" },
  { key: "contacts", label: "Contacts" },
  { key: "referrals", label: "Referrals" }
];
function programSectionLabel(k) {
  for (const s of PROGRAM_SECTIONS) if (s.key === k) return s.label;
  return k;
}
function progInitials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function viewProgram(id, section) {
  if (!PROGRAM_DETAIL[id]) {
    if (!PROGRAM_DETAIL_LOADING[id] && !PROGRAM_DETAIL_ERROR[id]) loadProgram(id);
    const back = `${crumb([{ t: orgLabel(), h: "#/dashboard" }, { t: "Programs", h: "#/programs" }, { t: "\u2026" }])}`;
    const body = PROGRAM_DETAIL_ERROR[id] ? `<div class="card"><div class="empty"><div class="ico">${ic("alert", 22)}</div><b>Couldn't load this program</b><p>${esc(PROGRAM_DETAIL_ERROR[id])}</p><button class="btn primary" onclick="loadProgram('${esc(id)}', true)">${ic("clock", 15)} Retry</button></div></div>` : loadingCard("Loading program\u2026");
    return shell("programs", back + body);
  }
  const p = PROGRAM_DETAIL[id];
  const sec = section || "summary";
  let content;
  if (sec === "summary") content = summaryProgramSection(p);
  else if (sec === "notes") content = notesProgramSection(p);
  else if (sec === "files") content = programFilesSection(id);
  else if (sec === "details") content = programDetailsSection(p);
  else if (sec === "contacts") content = programContactsSection(p);
  else if (sec === "referrals") content = programReferralsSection(id);
  else content = summaryProgramSection(p);
  return programShell(p, sec, content);
}
function programShell(p, active, content) {
  const dpid = p.id;
  registerProgramHints(p);
  const logo = programLogoUrl(dpid);
  const typeLabel = p.programType && p.programType[0] || "Program";
  const nav = PROGRAM_SECTIONS.map(
    (s) => `<a href="#/programs/${encodeURIComponent(dpid)}/${s.key}" class="${active === s.key ? "active" : ""}">${esc(s.label)}</a>`
  ).join("");
  const ctx = `<aside class="ctxbar">
    <div class="rec-head">
      <div class="rec-photo prog-logo" title="Upload a logo" onclick="programLogoUpload('${esc(dpid)}')">
        ${logo ? `<img src="${esc(logo)}" alt="${esc(p.programName)}">` : esc(progInitials(p.programName))}
        <span class="prog-logo-edit">${ic("edit", 12)}</span>
      </div>
      <div class="rec-name">${esc(p.programName)}</div>
      <div class="rec-sub">${esc(typeLabel)}</div>
      ${p.bluestepOrgRef ? '<div style="margin-top:8px"><span class="pill primary"><span class="dot"></span>BlueStep</span></div>' : ""}
    </div>
    <nav class="ctxnav">${nav}</nav>
  </aside>`;
  const tags = (p.programType || []).concat(p.ageBand || []).concat(p.genderServed || []).concat(p.states || []);
  const kv = (label, v) => v && v.trim() ? `<div class="kv"><span class="k">${esc(label)}</span><span class="v">${esc(v)}</span></div>` : "";
  const links = [];
  if (p.website) links.push(`<a class="btn outline" href="${esc(p.website)}" target="_blank" rel="noopener">${ic("external", 14)} Website</a>`);
  const loc = [p.location, p.agesRaw ? "Ages " + p.agesRaw : ""].filter(Boolean).join(" \xB7 ");
  const recCard = `<div class="card rec-card">
    <div class="top"><h2>${esc(p.programName)}</h2></div>
    ${loc ? `<div class="rec-loc">${esc(loc)}</div>` : ""}
    ${tags.length ? `<div class="tags" style="margin:10px 0">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
    <div class="kv-grid">
      ${kv("Admissions", p.admissionsContact)}
      ${kv("Insurance", p.insuranceRaw)}
      ${kv("Accreditation", p.accreditationRaw)}
    </div>
    ${links.length ? `<div class="prog-links">${links.join("")}</div>` : ""}
  </div>`;
  const main = `<main class="main"><div class="content">
    ${crumb([{ t: orgLabel(), h: "#/dashboard" }, { t: "Programs", h: "#/programs" }, { t: p.programName, h: "#/programs/" + encodeURIComponent(dpid) }, { t: programSectionLabel(active) }])}
    ${recCard}
    ${content}
  </div></main>`;
  return topbar() + `<div class="body record-body">${sidebar("programs", true)}<div class="nav-scrim" onclick="closeNav()"></div>${ctx}${main}</div>`;
}
function programDetailsSection(p) {
  const body = progSection("Overview", p.overview) + progSection("Clinical Model & Modalities", p.clinicalModel) + progSection("Levels of Care / Structure", p.levelsOfCare) + progSection("Academics", p.academics) + progSection("Family Involvement", p.familyInvolvement) + progSection("Admissions & Cost", p.admissionsCost) + progSection("Accreditation & Ownership", p.accreditationOwnership);
  const head = `<div class="section-head"><div><h3>Program Details</h3><p>From the shared directory profile.</p></div></div>`;
  return head + (body.trim() ? body : `<div class="card"><div class="empty"><div class="ico">${ic("report", 22)}</div><b>No additional details</b><p>The directory profile has no narrative sections for this program yet.</p></div></div>`);
}
function programContactsSection(p) {
  const people = p.contacts && p.contacts.people ? p.contacts.people : [];
  const contactsCard = people.length ? `<div class="card card-pad prog-sec"><div class="sec-h">Key Contacts</div>
    <div class="pc-list">${people.map((c) => `<div class="pc"><div class="pc-n">${esc(c.name || "")}</div><div class="pc-t">${esc(c.title || "")}</div>${c.phone || c.email ? `<div class="pc-d">${[c.phone, c.email].filter(Boolean).map((x) => esc(x)).join(" \xB7 ")}</div>` : ""}</div>`).join("")}</div></div>` : "";
  const admis = (p.admissionsContact || "").trim();
  const admisCard = admis ? `<div class="card card-pad prog-sec"><div class="sec-h">Admissions</div><div class="sec-body">${esc(admis)}</div></div>` : "";
  const sources = (p.sources || "").trim();
  const sourcesCard = sources ? `<div class="card card-pad prog-sec"><div class="sec-h">Sources</div><div class="sec-body">${sources.split("\n").filter(Boolean).map((u) => `<a href="${esc(u.trim())}" target="_blank" rel="noopener">${esc(u.trim())}</a>`).join("<br>")}</div></div>` : "";
  const head = `<div class="section-head"><div><h3>Contacts</h3><p>Admissions, key people, and sources from the directory.</p></div></div>`;
  const body = contactsCard + admisCard + sourcesCard;
  return head + (body.trim() ? body : `<div class="card"><div class="empty"><div class="ico">${ic("users", 22)}</div><b>No contacts on file</b><p>The directory profile lists no contacts for this program.</p></div></div>`);
}
function programReferralsSection(id) {
  const head = `<div class="section-head"><div><h3>Referrals</h3><p>Clients you've referred to this program, and how they turned out.</p></div></div>`;
  if (PROGRAM_REFERRALS[id] === void 0) {
    if (!PROGRAM_REFERRALS_LOADING[id] && !PROGRAM_REFERRALS_ERROR[id]) loadProgramReferrals(id);
    if (PROGRAM_REFERRALS_ERROR[id]) {
      return head + `<div class="card"><div class="empty"><div class="ico">${ic("alert", 22)}</div><b>Couldn't load referrals</b><p>${esc(PROGRAM_REFERRALS_ERROR[id])}</p><button class="btn primary" onclick="loadProgramReferrals('${esc(id)}', true)">${ic("clock", 15)} Retry</button></div></div>`;
    }
    return head + loadingCard("Loading referrals\u2026");
  }
  const list = PROGRAM_REFERRALS[id] || [];
  if (!list.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic("send", 22)}</div><b>No referrals yet</b><p>When you refer a client to this program \u2014 from a client's Referrals tab \u2014 it shows up here.</p></div></div>`;
  }
  const isAcc = (s) => s === "Accepted" || s === "Enrolled";
  const acc = list.filter((r) => isAcc(r.status)).length;
  const dec = list.filter((r) => REFERRAL_DECLINED_STATUSES.indexOf(r.status) >= 0).length;
  const stats = `<div class="rf-stats"><span><b>${list.length}</b> total</span><span class="rf-ok"><b>${acc}</b> accepted</span><span class="rf-no"><b>${dec}</b> declined</span></div>`;
  const rows = list.map(programReferralRow).join("");
  return head + stats + `<div class="rf-list">${rows}</div>`;
}
function programReferralRow(r) {
  const name = (r.clientName || "").trim() || "Client";
  const pill = r.status ? `<span class="rf-status ${referralStatusClass(r.status)}">${esc(r.status)}</span>` : "";
  const declined = REFERRAL_DECLINED_STATUSES.indexOf(r.status) >= 0;
  const decline = declined && r.declineReason ? `<div class="rf-decline">${ic("alert", 13)} Decline reason: <b>${esc(r.declineReason)}</b></div>` : "";
  const notes = (r.notes || "").trim() ? `<div class="rf-notes">${esc(r.notes)}</div>` : "";
  const foot = r.date || r.referredBy ? `<div class="rf-foot">${r.date ? esc(fmtDate(r.date)) : ""}${r.referredBy ? " \xB7 by " + esc(r.referredBy) : ""}</div>` : "";
  const to = r.clientId ? `#/clients/${encodeURIComponent(r.clientId)}` : "";
  const client = to ? `<a class="rf-client" href="${to}">${esc(name)}</a>` : `<span class="rf-client">${esc(name)}</span>`;
  return `<div class="card card-pad rf-card"><div class="rf-top">${client}${pill}</div>${decline}${notes}${foot}</div>`;
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidmlld3MudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgdmlld3MudHMgXHUyMDE0IHRoZSBwcmltYXJ5LW5hdiBwYWdlcy5cbiAgIERhc2hib2FyZCAocGxhY2Vob2xkZXIpIFx1MDBCNyBDbGllbnRzIFx1MDBCNyBQcm9ncmFtcy5cbiAgIENsaWVudCByb3dzIGFyZSBpbnRlbnRpb25hbGx5IG5vbi1uYXZpZ2F0aW5nOiB0aGUgY2xpZW50IHJlY29yZCBpcyBhXG4gICBzZXBhcmF0ZSBtZXJnZSByZXBvcnQsIG5vdCBidWlsdCBoZXJlLiBXaXJlIHJvdyBjbGlja3Mgb25jZSBpdCBleGlzdHMuXG4gICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuLy8gVGhlIERhc2hib2FyZCBpcyBhIGxpdmUgY2FzZWxvYWQgb3ZlcnZpZXcgYmFja2VkIGJ5IHRoZSBtYWVzdHJvJ3Mgc2VydmVyLXNpZGVcbi8vIGBkYXNoYm9hcmRgIGFnZ3JlZ2F0aW9uIChzdGFnZSBjb3VudHMsIHJlZmVycmFsIGZ1bm5lbC9vdXRjb21lcywgdGFzayBidWNrZXRzLFxuLy8gcmVjZW50IGFjdGl2aXR5KS4gRGF0YSBsb2FkcyBvbmNlIG9uIGZpcnN0IHZpZXcgKGVuc3VyZURhc2hib2FyZCkgYW5kIGNhY2hlcztcbi8vIFJlZnJlc2ggZm9yY2VzIGEgcmVsb2FkLlxuZnVuY3Rpb24gdmlld0Rhc2hib2FyZCgpOiBzdHJpbmcge1xuICBlbnN1cmVEYXNoYm9hcmQoKTtcbiAgY29uc3QgYWN0aW9uID0gREFTSEJPQVJEID8gYDxidXR0b24gY2xhc3M9XCJidG5cIiBvbmNsaWNrPVwibG9hZERhc2hib2FyZCh0cnVlKVwiPiR7aWMoJ2Nsb2NrJywgMTUpfSBSZWZyZXNoPC9idXR0b24+YCA6ICcnO1xuICBsZXQgYm9keTogc3RyaW5nO1xuICBpZiAoREFTSEJPQVJEX0VSUk9SKSB7XG4gICAgYm9keSA9IGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdhbGVydCcsIDIyKX08L2Rpdj48Yj5Db3VsZG4ndCBsb2FkIHRoZSBkYXNoYm9hcmQ8L2I+PHA+JHtlc2MoREFTSEJPQVJEX0VSUk9SKX08L3A+PGJ1dHRvbiBjbGFzcz1cImJ0biBwcmltYXJ5XCIgb25jbGljaz1cImxvYWREYXNoYm9hcmQodHJ1ZSlcIj4ke2ljKCdjbG9jaycsIDE1KX0gUmV0cnk8L2J1dHRvbj48L2Rpdj48L2Rpdj5gO1xuICB9IGVsc2UgaWYgKCFEQVNIQk9BUkQpIHtcbiAgICBib2R5ID0gbG9hZGluZ0NhcmQoJ0xvYWRpbmcgeW91ciBjYXNlbG9hZCBvdmVydmlldycpO1xuICB9IGVsc2Uge1xuICAgIGJvZHkgPSBkYXNoYm9hcmRCb2R5KERBU0hCT0FSRCk7XG4gIH1cbiAgY29uc3QgaGVhZCA9IHBhZ2VIZWFkKCdEYXNoYm9hcmQnLCBkYXNoR3JlZXRpbmcoKSwgYWN0aW9uKTtcbiAgcmV0dXJuIHNoZWxsKCdkYXNoYm9hcmQnLCBgJHtjcnVtYihbeyB0OiBvcmdMYWJlbCgpLCBoOiAnIy9kYXNoYm9hcmQnIH0sIHsgdDogJ0Rhc2hib2FyZCcgfV0pfSR7aGVhZH0ke2JvZHl9YCk7XG59XG5cbmZ1bmN0aW9uIGRhc2hHcmVldGluZygpOiBzdHJpbmcge1xuICBjb25zdCBuID0gKHR5cGVvZiBTRVNTSU9OICE9PSAndW5kZWZpbmVkJyAmJiBTRVNTSU9OICYmIFNFU1NJT04uZmlyc3ROYW1lKSA/IFNFU1NJT04uZmlyc3ROYW1lIDogJyc7XG4gIGNvbnN0IGhpID0gbiA/IGBXZWxjb21lIGJhY2ssICR7ZXNjKG4pfS5gIDogJ1dlbGNvbWUgYmFjay4nO1xuICByZXR1cm4gYCR7aGl9IEhlcmUncyB5b3VyIHByYWN0aWNlIGF0IGEgZ2xhbmNlLmA7XG59XG5cbi8vIE1hcCBhIHJlZmVycmFsIHN0YXR1cyB0byBhIHZpc3VhbCB0b25lIChtYXRjaGVzIHJlZmVycmFsU3RhdHVzQ2xhc3Mgc2VtYW50aWNzKS5cbmZ1bmN0aW9uIHJlZlRvbmUoc3RhdHVzOiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoc3RhdHVzID09PSAnQWNjZXB0ZWQnIHx8IHN0YXR1cyA9PT0gJ0Vucm9sbGVkJykgcmV0dXJuICdnb29kJztcbiAgaWYgKHN0YXR1cyA9PT0gJ0RlY2xpbmVkJyB8fCBzdGF0dXMgPT09ICdGYW1pbHkgRGVjbGluZWQnKSByZXR1cm4gJ2JhZCc7XG4gIGlmIChzdGF0dXMgPT09ICdDb25zaWRlcmluZycgfHwgc3RhdHVzID09PSAnUHJlLXNjcmVlbmluZycpIHJldHVybiAnd2Fybic7XG4gIHJldHVybiAnJzsgLy8gUmVmZXJyZWQgLyBBcHBsaWNhdGlvbiBTZW50IC8gV2FpdGxpc3RlZCBcdTIxOTIgcHJpbWFyeVxufVxuXG5mdW5jdGlvbiBkYXNoYm9hcmRCb2R5KGQ6IGFueSk6IHN0cmluZyB7XG4gIGNvbnN0IHMgPSBkLnN0YWdlcyB8fCB7fTsgY29uc3QgciA9IGQucmVmZXJyYWxzIHx8IHt9OyBjb25zdCB0ID0gZC50YXNrcyB8fCB7fTtcbiAgY29uc3QgZGVjaWRlZCA9IChyLmFjY2VwdGVkIHx8IDApICsgKHIuZGVjbGluZWQgfHwgMCk7XG4gIGNvbnN0IHdpblJhdGUgPSBkZWNpZGVkID8gTWF0aC5yb3VuZCgoci5hY2NlcHRlZCB8fCAwKSAvIGRlY2lkZWQgKiAxMDApIDogMDtcblxuICAvLyBcdTI1MDBcdTI1MDAgc3RhdCByb3cgXHUyNTAwXHUyNTAwXG4gIGNvbnN0IHN0YXRzID0gYDxkaXYgY2xhc3M9XCJzdGF0LXJvd1wiPlxuICAgICR7c3RhdFRpbGUoJ3VzZXJzJywgJ0FjdGl2ZSBjbGllbnRzJywgcy5jbGllbnQgfHwgMCwgJ2N1cnJlbnQgY2FzZWxvYWQnLCAnJyl9XG4gICAgJHtzdGF0VGlsZSgndXNlcicsICdJbnF1aXJpZXMnLCBzLmlucXVpcnkgfHwgMCwgJ2luIHRoZSBwaXBlbGluZScsICcnKX1cbiAgICAke3N0YXRUaWxlKCdjaGVjaycsICdBbHVtbmknLCBzLmFsdW1uaSB8fCAwLCAncGxhY2VkICYgY2xvc2VkJywgJ2dvb2QnKX1cbiAgICAke3N0YXRUaWxlKCdhbGVydCcsICdPdmVyZHVlIHRhc2tzJywgdC5vdmVyZHVlIHx8IDAsICh0LmR1ZVRoaXNXZWVrIHx8IDApICsgJyBkdWUgdGhpcyB3ZWVrJywgKHQub3ZlcmR1ZSA/ICdiYWQnIDogJycpKX1cbiAgICAke3N0YXRUaWxlKCdzcGFya2xlJywgJ1JlZmVycmFsIHdpbiByYXRlJywgd2luUmF0ZSArICclJywgKHIuYWNjZXB0ZWQgfHwgMCkgKyAnIGFjY2VwdGVkIFx1MDBCNyAnICsgKHIuZGVjbGluZWQgfHwgMCkgKyAnIGRlY2xpbmVkJywgKHdpblJhdGUgPj0gNTAgPyAnZ29vZCcgOiAnJykpfVxuICA8L2Rpdj5gO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCBwaXBlbGluZSBzZWdtZW50IGJhciBcdTI1MDBcdTI1MDBcbiAgY29uc3QgdG90YWwgPSAocy5pbnF1aXJ5IHx8IDApICsgKHMuY2xpZW50IHx8IDApICsgKHMuYWx1bW5pIHx8IDApIHx8IDE7XG4gIGNvbnN0IHNlZyA9IGA8ZGl2IGNsYXNzPVwiZGFzaC1jYXJkXCI+XG4gICAgPGgzPiR7aWMoJ3JlcG9ydCcsIDE2KX0gQ2FzZWxvYWQgcGlwZWxpbmUgPHNwYW4gY2xhc3M9XCJoaW50XCI+JHtkLnRvdGFsUGVvcGxlIHx8IHRvdGFsfSBwZW9wbGU8L3NwYW4+PC9oMz5cbiAgICA8ZGl2IGNsYXNzPVwic2VnXCI+XG4gICAgICA8c3BhbiBzdHlsZT1cIndpZHRoOiR7KHMuaW5xdWlyeSB8fCAwKSAvIHRvdGFsICogMTAwfSU7YmFja2dyb3VuZDp2YXIoLS13YXJuaW5nKVwiPjwvc3Bhbj5cbiAgICAgIDxzcGFuIHN0eWxlPVwid2lkdGg6JHsocy5jbGllbnQgfHwgMCkgLyB0b3RhbCAqIDEwMH0lO2JhY2tncm91bmQ6dmFyKC0tcHJpbWFyeSlcIj48L3NwYW4+XG4gICAgICA8c3BhbiBzdHlsZT1cIndpZHRoOiR7KHMuYWx1bW5pIHx8IDApIC8gdG90YWwgKiAxMDB9JTtiYWNrZ3JvdW5kOnZhcigtLXN1Y2Nlc3MpXCI+PC9zcGFuPlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJzZWctbGVnZW5kXCI+XG4gICAgICAke3NlZ0xpKCd2YXIoLS13YXJuaW5nKScsICdJbnF1aXJpZXMnLCBzLmlucXVpcnkgfHwgMCl9XG4gICAgICAke3NlZ0xpKCd2YXIoLS1wcmltYXJ5KScsICdDbGllbnRzJywgcy5jbGllbnQgfHwgMCl9XG4gICAgICAke3NlZ0xpKCd2YXIoLS1zdWNjZXNzKScsICdBbHVtbmknLCBzLmFsdW1uaSB8fCAwKX1cbiAgICA8L2Rpdj5cbiAgPC9kaXY+YDtcblxuICAvLyBcdTI1MDBcdTI1MDAgcmVmZXJyYWwgb3V0Y29tZXMgKHdpbiByYXRlICsgYmFycykgXHUyNTAwXHUyNTAwXG4gIGNvbnN0IG91dGNvbWVNYXggPSBNYXRoLm1heChyLmFjY2VwdGVkIHx8IDAsIHIuZGVjbGluZWQgfHwgMCwgMSk7XG4gIGNvbnN0IG91dGNvbWVzID0gYDxkaXYgY2xhc3M9XCJkYXNoLWNhcmRcIj5cbiAgICA8aDM+JHtpYygnc2hhcmUnLCAxNil9IFJlZmVycmFsIG91dGNvbWVzIDxzcGFuIGNsYXNzPVwiaGludFwiPiR7ci50b3RhbCB8fCAwfSB0b3RhbDwvc3Bhbj48L2gzPlxuICAgIDxkaXYgY2xhc3M9XCJiYXItbGlzdFwiPlxuICAgICAgJHtiYXJJdGVtKCdBY2NlcHRlZCAvIGVucm9sbGVkJywgci5hY2NlcHRlZCB8fCAwLCBvdXRjb21lTWF4LCAnZ29vZCcpfVxuICAgICAgJHtiYXJJdGVtKCdEZWNsaW5lZCcsIHIuZGVjbGluZWQgfHwgMCwgb3V0Y29tZU1heCwgJ2JhZCcpfVxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJzZWctbGVnZW5kXCIgc3R5bGU9XCJtYXJnaW4tdG9wOjE2cHhcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJsaVwiPjxiIHN0eWxlPVwiZm9udC1zaXplOjIwcHhcIj4ke3dpblJhdGV9JTwvYj4mbmJzcDs8c3BhbiBjbGFzcz1cImNcIj5hY2NlcHRhbmNlIHJhdGUgb2YgZGVjaWRlZCByZWZlcnJhbHM8L3NwYW4+PC9kaXY+XG4gICAgPC9kaXY+XG4gIDwvZGl2PmA7XG5cbiAgLy8gXHUyNTAwXHUyNTAwIHRhc2tzOiBidWNrZXRzICsgc29vbmVzdC1kdWUgbGlzdCBcdTI1MDBcdTI1MDBcbiAgY29uc3QgdGFza0xpc3QgPSAoZC51cGNvbWluZ1Rhc2tzIHx8IFtdKS5tYXAoKHRrOiBhbnkpID0+IGRhc2hUYXNrUm93KHRrLCBkLnRvZGF5KSkuam9pbignJykgfHxcbiAgICBgPGRpdiBjbGFzcz1cImRhc2gtZW1wdHlcIj5ObyBvcGVuIHRhc2tzIHdpdGggZHVlIGRhdGVzLiBcdUQ4M0NcdURGODk8L2Rpdj5gO1xuICBjb25zdCB0YXNrc0NhcmQgPSBgPGRpdiBjbGFzcz1cImRhc2gtY2FyZFwiPlxuICAgIDxoMz4ke2ljKCdjYWxlbmRhcicsIDE2KX0gVGFza3MgJHsodC5vcGVuIHx8IDApID8gYDxzcGFuIGNsYXNzPVwiaGludFwiPiR7dC5vcGVufSBvcGVuPC9zcGFuPmAgOiAnJ308L2gzPlxuICAgIDxkaXYgY2xhc3M9XCJtaW5pLWJ1Y2tldHNcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJtaW5pIGJhZFwiPjxkaXYgY2xhc3M9XCJuXCI+JHt0Lm92ZXJkdWUgfHwgMH08L2Rpdj48ZGl2IGNsYXNzPVwibFwiPk92ZXJkdWU8L2Rpdj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJtaW5pIHdhcm5cIj48ZGl2IGNsYXNzPVwiblwiPiR7dC5kdWVUaGlzV2VlayB8fCAwfTwvZGl2PjxkaXYgY2xhc3M9XCJsXCI+RHVlIHRoaXMgd2VlazwvZGl2PjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cIm1pbmlcIj48ZGl2IGNsYXNzPVwiblwiPiR7dC51cGNvbWluZyB8fCAwfTwvZGl2PjxkaXYgY2xhc3M9XCJsXCI+VXBjb21pbmc8L2Rpdj48L2Rpdj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwiZGFzaC1saXN0XCI+JHt0YXNrTGlzdH08L2Rpdj5cbiAgPC9kaXY+YDtcblxuICAvLyBcdTI1MDBcdTI1MDAgcmVjZW50IGFjdGl2aXR5IFx1MjUwMFx1MjUwMFxuICBjb25zdCBjb21tTGlzdCA9IChkLnJlY2VudENvbW1zIHx8IFtdKS5tYXAoKGM6IGFueSkgPT4gZGFzaENvbW1Sb3coYykpLmpvaW4oJycpIHx8XG4gICAgYDxkaXYgY2xhc3M9XCJkYXNoLWVtcHR5XCI+Tm8gY29tbXVuaWNhdGlvbnMgbG9nZ2VkIHlldC48L2Rpdj5gO1xuICBjb25zdCBhY3Rpdml0eSA9IGA8ZGl2IGNsYXNzPVwiZGFzaC1jYXJkXCI+XG4gICAgPGgzPiR7aWMoJ21zZycsIDE2KX0gUmVjZW50IGFjdGl2aXR5PC9oMz5cbiAgICA8ZGl2IGNsYXNzPVwiZGFzaC1saXN0XCI+JHtjb21tTGlzdH08L2Rpdj5cbiAgPC9kaXY+YDtcblxuICAvLyBcdTI1MDBcdTI1MDAgcmVmZXJyYWwgZnVubmVsIGJ5IHN0YXR1cyBcdTI1MDBcdTI1MDBcbiAgY29uc3QgYnlTdGF0dXMgPSByLmJ5U3RhdHVzIHx8IHt9O1xuICBjb25zdCBzdGF0dXNPcmRlciA9IFsnQ29uc2lkZXJpbmcnLCAnUHJlLXNjcmVlbmluZycsICdSZWZlcnJlZCcsICdBcHBsaWNhdGlvbiBTZW50JywgJ1dhaXRsaXN0ZWQnLCAnQWNjZXB0ZWQnLCAnRW5yb2xsZWQnLCAnRGVjbGluZWQnLCAnRmFtaWx5IERlY2xpbmVkJ107XG4gIGNvbnN0IHN0YXR1c0tleXMgPSBzdGF0dXNPcmRlci5maWx0ZXIoayA9PiBieVN0YXR1c1trXSk7XG4gIGNvbnN0IHN0YXR1c01heCA9IE1hdGgubWF4LmFwcGx5KG51bGwsIHN0YXR1c0tleXMubWFwKGsgPT4gYnlTdGF0dXNba10pLmNvbmNhdChbMV0pKTtcbiAgY29uc3QgZnVubmVsID0gYDxkaXYgY2xhc3M9XCJkYXNoLWNhcmRcIj5cbiAgICA8aDM+JHtpYygnZmlsdGVyJywgMTYpfSBSZWZlcnJhbCBmdW5uZWwgPHNwYW4gY2xhc3M9XCJoaW50XCI+Ynkgc3RhdHVzPC9zcGFuPjwvaDM+XG4gICAgPGRpdiBjbGFzcz1cImJhci1saXN0XCI+XG4gICAgICAke3N0YXR1c0tleXMubWFwKGsgPT4gYmFySXRlbShrLCBieVN0YXR1c1trXSwgc3RhdHVzTWF4LCByZWZUb25lKGspKSkuam9pbignJyl9XG4gICAgPC9kaXY+XG4gIDwvZGl2PmA7XG5cbiAgLy8gXHUyNTAwXHUyNTAwIHRvcCBwcm9ncmFtcyArIHRvcCBkZWNsaW5lIHJlYXNvbnMgXHUyNTAwXHUyNTAwXG4gIGNvbnN0IHByb2dzID0gci50b3BQcm9ncmFtcyB8fCBbXTtcbiAgY29uc3QgcHJvZ01heCA9IE1hdGgubWF4LmFwcGx5KG51bGwsIHByb2dzLm1hcCgocDogYW55KSA9PiBwLmNvdW50KS5jb25jYXQoWzFdKSk7XG4gIGNvbnN0IGRlY2xpbmVzID0gci50b3BEZWNsaW5lUmVhc29ucyB8fCBbXTtcbiAgY29uc3QgdG9wQ2FyZCA9IGA8ZGl2IGNsYXNzPVwiZGFzaC1jYXJkXCI+XG4gICAgPGgzPiR7aWMoJ2J1aWxkaW5nJywgMTYpfSBUb3AgcmVmZXJyYWwgZGVzdGluYXRpb25zPC9oMz5cbiAgICAke3Byb2dzLmxlbmd0aCA/IGA8ZGl2IGNsYXNzPVwiYmFyLWxpc3RcIj4ke3Byb2dzLm1hcCgocDogYW55KSA9PiBiYXJJdGVtKHAucHJvZ3JhbSwgcC5jb3VudCwgcHJvZ01heCwgJycpKS5qb2luKCcnKX08L2Rpdj5gXG4gICAgICA6IGA8ZGl2IGNsYXNzPVwiZGFzaC1lbXB0eVwiPk5vIHJlZmVycmFscyBsb2dnZWQgeWV0LjwvZGl2PmB9XG4gICAgJHtkZWNsaW5lcy5sZW5ndGggPyBgPGgzIHN0eWxlPVwibWFyZ2luOjIwcHggMCAxMHB4XCI+JHtpYygnaW5mbycsIDE2KX0gV2h5IHJlZmVycmFscyBmYWxsIHRocm91Z2g8L2gzPlxuICAgICAgPGRpdiBjbGFzcz1cImRhc2gtcGlsbHNcIj4ke2RlY2xpbmVzLm1hcCgoeDogYW55KSA9PiBgPHNwYW4gY2xhc3M9XCJwaWxsIG11dGVkXCI+JHtlc2MoeC5yZWFzb24pfSA8Yj4mbmJzcDske3guY291bnR9PC9iPjwvc3Bhbj5gKS5qb2luKCcnKX08L2Rpdj5gIDogJyd9XG4gIDwvZGl2PmA7XG5cbiAgcmV0dXJuIGAke3N0YXRzfVxuICAgIDxkaXYgY2xhc3M9XCJkYXNoLWdyaWRcIj4ke3NlZ30ke3Rhc2tzQ2FyZH08L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwiZGFzaC1ncmlkXCI+JHtvdXRjb21lc30ke2FjdGl2aXR5fTwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJkYXNoLWdyaWRcIj4ke2Z1bm5lbH0ke3RvcENhcmR9PC9kaXY+YDtcbn1cblxuZnVuY3Rpb24gc3RhdFRpbGUoaWNvbjogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCBudW06IHN0cmluZyB8IG51bWJlciwgc3ViOiBzdHJpbmcsIHRvbmU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgPGRpdiBjbGFzcz1cInN0YXQke3RvbmUgPyAnICcgKyB0b25lIDogJyd9XCI+XG4gICAgPGRpdiBjbGFzcz1cImxibFwiPiR7aWMoaWNvbiwgMTQpfSAke2VzYyhsYWJlbCl9PC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cIm51bVwiPiR7ZXNjKFN0cmluZyhudW0pKX08L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwic3ViXCI+JHtlc2Moc3ViKX08L2Rpdj5cbiAgPC9kaXY+YDtcbn1cbmZ1bmN0aW9uIHNlZ0xpKGNvbG9yOiBzdHJpbmcsIGxhYmVsOiBzdHJpbmcsIGNvdW50OiBudW1iZXIpOiBzdHJpbmcge1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJsaVwiPjxzcGFuIGNsYXNzPVwic3dcIiBzdHlsZT1cImJhY2tncm91bmQ6JHtjb2xvcn1cIj48L3NwYW4+PGI+JHtjb3VudH08L2I+Jm5ic3A7PHNwYW4gY2xhc3M9XCJjXCI+JHtlc2MobGFiZWwpfTwvc3Bhbj48L2Rpdj5gO1xufVxuZnVuY3Rpb24gYmFySXRlbShsYWJlbDogc3RyaW5nLCBjb3VudDogbnVtYmVyLCBtYXg6IG51bWJlciwgdG9uZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgcGN0ID0gbWF4ID8gTWF0aC5yb3VuZChjb3VudCAvIG1heCAqIDEwMCkgOiAwO1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJiYXItaXRlbVwiPlxuICAgIDxzcGFuIGNsYXNzPVwiYmxcIj4ke2VzYyhsYWJlbCl9PC9zcGFuPlxuICAgIDxzcGFuIGNsYXNzPVwiYmFyLXRyYWNrXCI+PHNwYW4gY2xhc3M9XCJiYXItZmlsbCR7dG9uZSA/ICcgJyArIHRvbmUgOiAnJ31cIiBzdHlsZT1cIndpZHRoOiR7cGN0fSVcIj48L3NwYW4+PC9zcGFuPlxuICAgIDxzcGFuIGNsYXNzPVwiYm5cIj4ke2NvdW50fTwvc3Bhbj5cbiAgPC9kaXY+YDtcbn1cbi8vIEEgc29vbmVzdC1kdWUgdGFzayByb3cuIE92ZXJkdWUgXHUyMTkyIHJlZCBtYXJrZXIsIGR1ZS10aGlzLXdlZWsgXHUyMTkyIGFtYmVyLlxuZnVuY3Rpb24gZGFzaFRhc2tSb3codGs6IGFueSwgdG9kYXk6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IGR1ZSA9IFN0cmluZyh0ay5kdWVEYXRlIHx8ICcnKTtcbiAgbGV0IHJ0ID0gZm10RGF0ZShkdWUpIHx8ICdcdTIwMTQnOyBsZXQgY2xzID0gJyc7XG4gIGlmIChkdWUgJiYgdG9kYXkgJiYgZHVlIDwgdG9kYXkpIHsgY2xzID0gJyBiYWQnOyBydCA9ICdPdmVyZHVlIFx1MDBCNyAnICsgcnQ7IH1cbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiZGFzaC1saVwiIG9uY2xpY2s9XCJnbygnIy9jbGllbnRzLyR7ZW5jb2RlVVJJQ29tcG9uZW50KHRrLmNsaWVudElkKX0vdGFza3MnKVwiPlxuICAgIDxkaXYgY2xhc3M9XCJkaVwiPiR7aWMoJ2NoZWNrJywgMTUpfTwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJiZFwiPjxkaXYgY2xhc3M9XCJ0MVwiPiR7ZXNjKHRrLnRpdGxlIHx8ICdVbnRpdGxlZCB0YXNrJyl9PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwidDJcIj4ke2VzYyh0ay5jbGllbnROYW1lIHx8ICcnKX0ke3RrLmFzc2lnbmVlID8gJyBcdTAwQjcgJyArIGVzYyh0ay5hc3NpZ25lZSkgOiAnJ308L2Rpdj48L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwicnQke2Nsc31cIj4ke2VzYyhydCl9PC9kaXY+XG4gIDwvZGl2PmA7XG59XG5mdW5jdGlvbiBkYXNoQ29tbVJvdyhjOiBhbnkpOiBzdHJpbmcge1xuICBjb25zdCBpY29uRm9yOiB7IFtrOiBzdHJpbmddOiBzdHJpbmcgfSA9IHsgJ0NhbGwnOiAnYmVsbCcsICdFbWFpbCc6ICdtYWlsJywgJ1RleHQnOiAnbXNnJywgJ1ZpZGVvIENhbGwnOiAnbGFwdG9wJywgJ0luLXBlcnNvbiAvIE1lZXRpbmcnOiAndXNlcnMnLCAnTm90ZSc6ICdmaWxlVGV4dCcgfTtcbiAgY29uc3QgaWNvbiA9IGljb25Gb3JbYy50eXBlXSB8fCAnbXNnJztcbiAgY29uc3Qgd2hlbiA9IGZtdERhdGUoU3RyaW5nKGMuZGF0ZSB8fCAnJykpIHx8ICcnO1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJkYXNoLWxpXCIgb25jbGljaz1cImdvKCcjL2NsaWVudHMvJHtlbmNvZGVVUklDb21wb25lbnQoYy5jbGllbnRJZCl9L2NvbW11bmljYXRpb25zJylcIj5cbiAgICA8ZGl2IGNsYXNzPVwiZGlcIj4ke2ljKGljb24sIDE1KX08L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwiYmRcIj48ZGl2IGNsYXNzPVwidDFcIj4ke2VzYyhjLnN1YmplY3QgfHwgYy50eXBlIHx8ICdDb21tdW5pY2F0aW9uJyl9PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwidDJcIj4ke2VzYyhjLmNsaWVudE5hbWUgfHwgJycpfSR7Yy50eXBlID8gJyBcdTAwQjcgJyArIGVzYyhjLnR5cGUpIDogJyd9PC9kaXY+PC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cInJ0XCI+JHtlc2Mod2hlbil9PC9kaXY+XG4gIDwvZGl2PmA7XG59XG5cbi8vIC0tLS0gc2hhcmVkIGFzeW5jLXN0YXRlIGNhcmRzIChsaXZlIGRhdGEpIC0tLS1cbmZ1bmN0aW9uIGxvYWRpbmdDYXJkKG1zZzogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdjbG9jaycsIDIyKX08L2Rpdj48Yj4ke2VzYyhtc2cpfTwvYj48cD5GZXRjaGluZyBsaXZlIHJlY29yZHMgZnJvbSB0aGUgbWFlc3Ryby48L3A+PC9kaXY+PC9kaXY+YDtcbn1cbmZ1bmN0aW9uIGVycm9yQ2FyZChlcnI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgPGRpdiBjbGFzcz1cImNhcmRcIj48ZGl2IGNsYXNzPVwiZW1wdHlcIj48ZGl2IGNsYXNzPVwiaWNvXCI+JHtpYygnYWxlcnQnLCAyMil9PC9kaXY+PGI+Q291bGRuJ3QgbG9hZCBjbGllbnRzPC9iPjxwPiR7ZXNjKGVycil9PC9wPjxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeVwiIG9uY2xpY2s9XCJsb2FkQ2xpZW50cyh0cnVlKVwiPiR7aWMoJ2Nsb2NrJywgMTUpfSBSZXRyeTwvYnV0dG9uPjwvZGl2PjwvZGl2PmA7XG59XG5cbi8vIFRoZSBDbGllbnRzIHBhZ2UgaXMgdGFiYmVkIGFjcm9zcyB0aGUgdGhyZWUgSW5kaXZpZHVhbCBjYXRlZ29yaWVzOlxuLy8gQ2xpZW50cyBcdTAwQjcgSW5xdWlyaWVzIFx1MDBCNyBBbHVtbmkuIEVhY2ggdGFiIGhhcyBpdHMgb3duIGxpdmUgc3RvcmU7IHN3aXRjaGluZyBqdXN0XG4vLyByZS1yZW5kZXJzIGFnYWluc3QgdGhlIGFjdGl2ZSBzdG9yZS5cbmludGVyZmFjZSBMaXN0VGFiIHsga2V5OiBzdHJpbmc7IGxhYmVsOiBzdHJpbmc7IHBsdXJhbDogc3RyaW5nOyB9XG5jb25zdCBMSVNUX1RBQlM6IExpc3RUYWJbXSA9IFtcbiAgeyBrZXk6ICdjbGllbnQnLCAgbGFiZWw6ICdjbGllbnQnLCAgIHBsdXJhbDogJ0NsaWVudHMnIH0sXG4gIHsga2V5OiAnaW5xdWlyeScsIGxhYmVsOiAnaW5xdWlyeScsICBwbHVyYWw6ICdJbnF1aXJpZXMnIH0sXG4gIHsga2V5OiAnYWx1bW5pJywgIGxhYmVsOiAnYWx1bW51cycsICBwbHVyYWw6ICdBbHVtbmknIH0sXG5dO1xubGV0IExJU1RfVEFCID0gJ2NsaWVudCc7XG5mdW5jdGlvbiBhY3RpdmVUYWIoKTogTGlzdFRhYiB7IHJldHVybiBMSVNUX1RBQlMuZmlsdGVyKHQgPT4gdC5rZXkgPT09IExJU1RfVEFCKVswXSB8fCBMSVNUX1RBQlNbMF07IH1cbmZ1bmN0aW9uIGxpc3RTdG9yZShrZXk6IHN0cmluZyk6IENsaWVudFtdIHwgbnVsbCB7XG4gIHJldHVybiBrZXkgPT09ICdpbnF1aXJ5JyA/IElOUVVJUllfU1RPUkUgOiBrZXkgPT09ICdhbHVtbmknID8gQUxVTU5JX1NUT1JFIDogQ0xJRU5UX1NUT1JFO1xufVxuZnVuY3Rpb24gbGlzdExvYWRpbmcoa2V5OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIGtleSA9PT0gJ2lucXVpcnknID8gSU5RVUlSSUVTX0xPQURJTkcgOiBrZXkgPT09ICdhbHVtbmknID8gQUxVTU5JX0xPQURJTkcgOiBDTElFTlRTX0xPQURJTkc7XG59XG5mdW5jdGlvbiBsaXN0RXJyb3Ioa2V5OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgcmV0dXJuIGtleSA9PT0gJ2lucXVpcnknID8gSU5RVUlSSUVTX0VSUk9SIDoga2V5ID09PSAnYWx1bW5pJyA/IEFMVU1OSV9FUlJPUiA6IENMSUVOVFNfRVJST1I7XG59XG4vLyBLaWNrIG9mZiBhIGxvYWQgZm9yIGEgdGFiJ3Mgc3RvcmUgaWYgaXQgaGFzbid0IGJlZW4gZmV0Y2hlZCB5ZXQuXG5mdW5jdGlvbiBlbnN1cmVMaXN0KGtleTogc3RyaW5nKTogdm9pZCB7XG4gIGlmIChrZXkgPT09ICdpbnF1aXJ5JykgeyBpZiAoSU5RVUlSWV9TVE9SRSA9PT0gbnVsbCAmJiAhSU5RVUlSSUVTX0xPQURJTkcgJiYgIUlOUVVJUklFU19FUlJPUikgbG9hZElucXVpcmllcygpOyB9XG4gIGVsc2UgaWYgKGtleSA9PT0gJ2FsdW1uaScpIHsgaWYgKEFMVU1OSV9TVE9SRSA9PT0gbnVsbCAmJiAhQUxVTU5JX0xPQURJTkcgJiYgIUFMVU1OSV9FUlJPUikgbG9hZEFsdW1uaSgpOyB9XG4gIGVsc2UgeyBpZiAoQ0xJRU5UX1NUT1JFID09PSBudWxsICYmICFDTElFTlRTX0xPQURJTkcgJiYgIUNMSUVOVFNfRVJST1IpIGxvYWRDbGllbnRzKCk7IH1cbn1cbmZ1bmN0aW9uIHNldExpc3RUYWIoa2V5OiBzdHJpbmcpOiB2b2lkIHtcbiAgaWYgKExJU1RfVEFCID09PSBrZXkpIHJldHVybjtcbiAgTElTVF9UQUIgPSBrZXk7XG4gIENMSUVOVF9RVUVSWSA9ICcnO1xuICBpZiAodHlwZW9mIHJlbmRlciA9PT0gJ2Z1bmN0aW9uJykgcmVuZGVyKCk7XG59XG5mdW5jdGlvbiBsaXN0VGFiQmFyKCk6IHN0cmluZyB7XG4gIHJldHVybiBgPGRpdiBjbGFzcz1cInRhYnNcIj5gICsgTElTVF9UQUJTLm1hcCh0ID0+IHtcbiAgICBjb25zdCBzdG9yZSA9IGxpc3RTdG9yZSh0LmtleSk7XG4gICAgY29uc3QgYmFkZ2UgPSBzdG9yZSA/IGA8c3BhbiBjbGFzcz1cInRhYi1iYWRnZVwiPiR7c3RvcmUubGVuZ3RofTwvc3Bhbj5gIDogJyc7XG4gICAgcmV0dXJuIGA8YnV0dG9uIGNsYXNzPVwidGFiJHt0LmtleSA9PT0gTElTVF9UQUIgPyAnIGFjdGl2ZScgOiAnJ31cIiBvbmNsaWNrPVwic2V0TGlzdFRhYignJHt0LmtleX0nKVwiPiR7ZXNjKHQucGx1cmFsKX0ke2JhZGdlfTwvYnV0dG9uPmA7XG4gIH0pLmpvaW4oJycpICsgYDwvZGl2PmA7XG59XG5cbmZ1bmN0aW9uIGNsaWVudHNDaHJvbWUoY291bnRMYWJlbDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgdGFiID0gYWN0aXZlVGFiKCk7XG4gIGNvbnN0IGFjdGlvbiA9IGA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnlcIiBvbmNsaWNrPVwib3Blbk5ld0NsaWVudCgnJHt0YWIua2V5fScpXCI+JHtpYygncGx1cycsIDE1KX0gTmV3ICR7ZXNjKHRhYi5sYWJlbCl9PC9idXR0b24+YDtcbiAgcmV0dXJuIGBcbiAgJHtjcnVtYihbeyB0OiBvcmdMYWJlbCgpLCBoOiAnIy9kYXNoYm9hcmQnIH0sIHsgdDogdGFiLnBsdXJhbCB9XSl9XG4gICR7cGFnZUhlYWQoJ0NsaWVudHMnLCAnRXZlcnlvbmUgb24geW91ciBjYXNlbG9hZCBcdTIwMTQgY2xpZW50cywgaW5xdWlyaWVzLCBhbmQgYWx1bW5pLCBsaXZlIGZyb20gdGhlIGRhdGFiYXNlLicsIGFjdGlvbil9XG4gICR7bGlzdFRhYkJhcigpfVxuICA8ZGl2IGNsYXNzPVwidG9vbGJhclwiPlxuICAgIDxkaXYgY2xhc3M9XCJzZWFyY2hcIj4ke2ljKCdzZWFyY2gnLCAxNSl9PGlucHV0IGlkPVwiY2xpZW50LXNlYXJjaFwiIHBsYWNlaG9sZGVyPVwiU2VhcmNoICR7ZXNjKHRhYi5wbHVyYWwudG9Mb3dlckNhc2UoKSl9XHUyMDI2XCIgdmFsdWU9XCIke2VzYyhDTElFTlRfUVVFUlkpfVwiIG9uaW5wdXQ9XCJjbGllbnRPblNlYXJjaCgpXCIgYXV0b2NvbXBsZXRlPVwib2ZmXCI+PC9kaXY+XG4gICAgPHNwYW4gY2xhc3M9XCJjb3VudFwiIGlkPVwiY2xpZW50LWNvdW50XCI+JHtlc2MoY291bnRMYWJlbCl9PC9zcGFuPlxuICAgIDxkaXYgc3R5bGU9XCJmbGV4OjFcIj48L2Rpdj5cbiAgPC9kaXY+YDtcbn1cblxuZnVuY3Rpb24gY2xpZW50c1RhYmxlKGxpc3Q6IENsaWVudFtdKTogc3RyaW5nIHtcbiAgY29uc3Qgcm93cyA9IGxpc3QubWFwKGMgPT4ge1xuICAgIGNvbnN0IGxvYyA9IFtjLmRlbW8uY2l0eSwgYy5kZW1vLnN0YXRlXS5maWx0ZXIoQm9vbGVhbikuam9pbignLCAnKTtcbiAgICBjb25zdCBwaG9uZSA9IGMuY2VsbCB8fCBjLmhvbWVQaG9uZSB8fCAnJztcbiAgICBjb25zdCBtZXRhID0gYy5wcmVmTmFtZSA/ICdHb2VzIGJ5ICcgKyBlc2MoYy5wcmVmTmFtZSkgOiAnJztcbiAgICByZXR1cm4gYDx0ciBjbGFzcz1cImNsaWNrYWJsZVwiIG9uY2xpY2s9XCJnbygnIy9jbGllbnRzLycgKyBlbmNvZGVVUklDb21wb25lbnQoJyR7Yy5pZH0nKSlcIj5cbiAgICAgIDx0ZD48ZGl2IGNsYXNzPVwiY2VsbC1uYW1lXCI+JHthdmF0YXIoYy5maXJzdCwgYy5sYXN0LCAzNiwgMTMsIGMucGhvdG9VcmwpfTxkaXY+PGRpdiBjbGFzcz1cIm5tXCI+JHtlc2MoYy5sYXN0KX0sICR7ZXNjKGMuZmlyc3QpfTwvZGl2PiR7bWV0YSA/IGA8ZGl2IGNsYXNzPVwibWV0YVwiPiR7bWV0YX08L2Rpdj5gIDogJyd9PC9kaXY+PC9kaXY+PC90ZD5cbiAgICAgIDx0ZD4ke2xvYyA/IGVzYyhsb2MpIDogZGFzaH08L3RkPlxuICAgICAgPHRkPiR7dmFsKGMuZW1haWwpfTwvdGQ+XG4gICAgICA8dGQ+JHtwaG9uZSA/IGVzYyhwaG9uZSkgOiBkYXNofTwvdGQ+XG4gICAgPC90cj5gO1xuICB9KS5qb2luKCcnKTtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwidGJsLXdyYXBcIj48dGFibGU+XG4gICAgPHRoZWFkIGNsYXNzPVwicmljaFwiPjx0cj5cbiAgICAgIDx0aD48c3BhbiBjbGFzcz1cInRoLXNvcnRcIj5DbGllbnQgJHtpYygnc29ydCcsIDEzKX08L3NwYW4+PC90aD5cbiAgICAgIDx0aD48c3BhbiBjbGFzcz1cInRoLXNvcnRcIj5Mb2NhdGlvbiAke2ljKCdzb3J0JywgMTMpfTwvc3Bhbj48L3RoPlxuICAgICAgPHRoPjxzcGFuIGNsYXNzPVwidGgtc29ydFwiPkVtYWlsICR7aWMoJ3NvcnQnLCAxMyl9PC9zcGFuPjwvdGg+XG4gICAgICA8dGg+PHNwYW4gY2xhc3M9XCJ0aC1zb3J0XCI+UGhvbmUgJHtpYygnc29ydCcsIDEzKX08L3NwYW4+PC90aD5cbiAgICA8L3RyPjwvdGhlYWQ+XG4gICAgPHRib2R5PiR7cm93c308L3Rib2R5PlxuICA8L3RhYmxlPjwvZGl2PlxuICA8ZGl2IGNsYXNzPVwicGFnZXJcIj48c3Bhbj5TaG93aW5nIDFcdTIwMTMke2xpc3QubGVuZ3RofSBvZiAke2xpc3QubGVuZ3RofTwvc3Bhbj5cbiAgICA8ZGl2IGNsYXNzPVwicGdcIj48YnV0dG9uPiR7aWMoJ2NoZXZSJywgMTQpfTwvYnV0dG9uPjxidXR0b24gY2xhc3M9XCJudW1cIj4xPC9idXR0b24+PGJ1dHRvbj4ke2ljKCdjaGV2UicsIDE0KX08L2J1dHRvbj48L2Rpdj48L2Rpdj5gO1xufVxuXG4vLyBMaXZlIHNlYXJjaCBzdGF0ZSAoa2VwdCBhdCBtb2R1bGUgc2NvcGUgc28gaXQgc3Vydml2ZXMgcmUtcmVuZGVycykuXG5sZXQgQ0xJRU5UX1FVRVJZID0gJyc7XG4vLyBSZWNvcmRzIGluIHRoZSBhY3RpdmUgdGFiIG1hdGNoaW5nIHRoZSBzZWFyY2ggYm94IFx1MjAxNCBzcGFucyBuYW1lIChsYXN0L2ZpcnN0L1xuLy8gcHJlZmVycmVkKSwgbG9jYXRpb24sIGVtYWlsLCBhbmQgcGhvbmVzLiBFbXB0eSBxdWVyeSBcdTIxOTIgdGhlIHdob2xlIGxpc3QuXG5mdW5jdGlvbiBjbGllbnRzRmlsdGVyZWQoKTogQ2xpZW50W10ge1xuICBjb25zdCBhbGwgPSBsaXN0U3RvcmUoTElTVF9UQUIpIHx8IFtdO1xuICBjb25zdCBxID0gQ0xJRU5UX1FVRVJZLnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuICBpZiAoIXEpIHJldHVybiBhbGw7XG4gIHJldHVybiBhbGwuZmlsdGVyKGMgPT4ge1xuICAgIGNvbnN0IGhheSA9IFtjLmxhc3QsIGMuZmlyc3QsIGMucHJlZk5hbWUsIGMuZGVtby5jaXR5LCBjLmRlbW8uc3RhdGUsIGMuZW1haWwsIGMuY2VsbCwgYy5ob21lUGhvbmVdXG4gICAgICAuZmlsdGVyKEJvb2xlYW4pLmpvaW4oJyAnKS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiBoYXkuaW5kZXhPZihxKSA+PSAwO1xuICB9KTtcbn1cbmZ1bmN0aW9uIGNsaWVudENvdW50TGFiZWwoKTogc3RyaW5nIHtcbiAgY29uc3QgdG90YWwgPSAobGlzdFN0b3JlKExJU1RfVEFCKSB8fCBbXSkubGVuZ3RoO1xuICByZXR1cm4gY2xpZW50c0ZpbHRlcmVkKCkubGVuZ3RoICsgJyBvZiAnICsgdG90YWw7XG59XG5mdW5jdGlvbiBjbGllbnRzUmVnaW9uSW5uZXIoKTogc3RyaW5nIHtcbiAgY29uc3QgdGFiID0gYWN0aXZlVGFiKCk7XG4gIGNvbnN0IHRvdGFsID0gKGxpc3RTdG9yZShMSVNUX1RBQikgfHwgW10pLmxlbmd0aDtcbiAgY29uc3QgbGlzdCA9IGNsaWVudHNGaWx0ZXJlZCgpO1xuICBpZiAobGlzdC5sZW5ndGgpIHJldHVybiBjbGllbnRzVGFibGUobGlzdCk7XG4gIGlmICh0b3RhbCkgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdzZWFyY2gnLCAyMil9PC9kaXY+PGI+Tm8gbWF0Y2hpbmcgJHtlc2ModGFiLnBsdXJhbC50b0xvd2VyQ2FzZSgpKX08L2I+PHA+VHJ5IGEgZGlmZmVyZW50IG5hbWUsIGxvY2F0aW9uLCBlbWFpbCwgb3IgcGhvbmUuPC9wPjwvZGl2PjwvZGl2PmA7XG4gIHJldHVybiBgPGRpdiBjbGFzcz1cImNhcmRcIj48ZGl2IGNsYXNzPVwiZW1wdHlcIj48ZGl2IGNsYXNzPVwiaWNvXCI+JHtpYygndXNlcnMnLCAyMil9PC9kaXY+PGI+Tm8gJHtlc2ModGFiLnBsdXJhbC50b0xvd2VyQ2FzZSgpKX0geWV0PC9iPjxwPkNyZWF0ZSB5b3VyIGZpcnN0ICR7ZXNjKHRhYi5sYWJlbCl9IHRvIGdldCBzdGFydGVkLjwvcD48YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnlcIiBvbmNsaWNrPVwib3Blbk5ld0NsaWVudCgnJHt0YWIua2V5fScpXCI+JHtpYygncGx1cycsIDE1KX0gTmV3ICR7ZXNjKHRhYi5sYWJlbCl9PC9idXR0b24+PC9kaXY+PC9kaXY+YDtcbn1cbi8vIFJlLXJlbmRlciBvbmx5IHRoZSB0YWJsZSByZWdpb24gKyBjb3VudCBvbiBlYWNoIGtleXN0cm9rZSwgc28gdGhlIHNlYXJjaCBib3hcbi8vIGtlZXBzIGZvY3VzICh0aGUgaW5wdXQgbGl2ZXMgb3V0c2lkZSAjY2xpZW50LXJlZ2lvbikuXG5mdW5jdGlvbiBjbGllbnRPblNlYXJjaCgpOiB2b2lkIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2xpZW50LXNlYXJjaCcpIGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsO1xuICBDTElFTlRfUVVFUlkgPSBlbCA/IGVsLnZhbHVlIDogJyc7XG4gIGNvbnN0IHJlZ2lvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjbGllbnQtcmVnaW9uJyk7XG4gIGlmIChyZWdpb24pIHJlZ2lvbi5pbm5lckhUTUwgPSBjbGllbnRzUmVnaW9uSW5uZXIoKTtcbiAgY29uc3QgY250ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NsaWVudC1jb3VudCcpO1xuICBpZiAoY250KSBjbnQudGV4dENvbnRlbnQgPSBjbGllbnRDb3VudExhYmVsKCk7XG59XG5cbmZ1bmN0aW9uIHZpZXdDbGllbnRzKCk6IHN0cmluZyB7XG4gIC8vIEVhZ2VybHkgbG9hZCBhbGwgdGhyZWUgc3RvcmVzIHNvIGV2ZXJ5IHRhYiBzaG93cyBhIGxpdmUgY291bnQgYmFkZ2UgYW5kXG4gIC8vIHN3aXRjaGluZyBpcyBpbnN0YW50LlxuICBMSVNUX1RBQlMuZm9yRWFjaCh0ID0+IGVuc3VyZUxpc3QodC5rZXkpKTtcbiAgY29uc3QgdGFiID0gYWN0aXZlVGFiKCk7XG4gIGNvbnN0IHN0b3JlID0gbGlzdFN0b3JlKExJU1RfVEFCKTtcbiAgY29uc3QgZXJyID0gbGlzdEVycm9yKExJU1RfVEFCKTtcbiAgaWYgKHN0b3JlID09PSBudWxsKSB7XG4gICAgcmV0dXJuIHNoZWxsKCdjbGllbnRzJywgY2xpZW50c0Nocm9tZSgnXHUyMDI2JykgKyAoZXJyID8gZXJyb3JDYXJkKGVycikgOiBsb2FkaW5nQ2FyZCgnTG9hZGluZyAnICsgdGFiLnBsdXJhbC50b0xvd2VyQ2FzZSgpICsgJ1x1MjAyNicpKSk7XG4gIH1cbiAgcmV0dXJuIHNoZWxsKCdjbGllbnRzJywgY2xpZW50c0Nocm9tZShjbGllbnRDb3VudExhYmVsKCkpICsgYDxkaXYgaWQ9XCJjbGllbnQtcmVnaW9uXCI+JHtjbGllbnRzUmVnaW9uSW5uZXIoKX08L2Rpdj5gKTtcbn1cblxuLy8gLS0tLSBQcm9ncmFtIERpcmVjdG9yeSAobGl2ZSwgY3Jvc3Mtb3JnIHZpYSB0aGUgbWFlc3RybyBwcm94eSkgLS0tLVxuZnVuY3Rpb24gcHJvZ3JhbXNFcnJvcihlcnI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgPGRpdiBjbGFzcz1cImNhcmRcIj48ZGl2IGNsYXNzPVwiZW1wdHlcIj48ZGl2IGNsYXNzPVwiaWNvXCI+JHtpYygnYWxlcnQnLCAyMil9PC9kaXY+PGI+Q291bGRuJ3QgbG9hZCB0aGUgZGlyZWN0b3J5PC9iPjxwPiR7ZXNjKGVycil9PC9wPjxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeVwiIG9uY2xpY2s9XCJsb2FkUHJvZ3JhbXModHJ1ZSlcIj4ke2ljKCdjbG9jaycsIDE1KX0gUmV0cnk8L2J1dHRvbj48L2Rpdj48L2Rpdj5gO1xufVxuLy8gQ29lcmNlIGEgcHJvZ3JhbSdzIGZpZWxkIHZhbHVlIHRvIGFuIGFycmF5IChmYWNldCBkaW1zIGFyZSBhIG1peCBvZiBtdWx0aVxuLy8gYXJyYXlzIGFuZCBzaW5nbGUgc3RyaW5ncyBcdTIwMTQgcmVnaW9uL3ByaW1hcnlGb2N1cyBhcmUgc2luZ2xlKS5cbmZ1bmN0aW9uIGFzQXJyKHY6IGFueSk6IHN0cmluZ1tdIHsgcmV0dXJuIEFycmF5LmlzQXJyYXkodikgPyB2LmZpbHRlcihCb29sZWFuKSA6ICh2ID8gW1N0cmluZyh2KV0gOiBbXSk7IH1cblxuLy8gVGhlIG11bHRpLXZhbHVlIGZhY2V0cyBzaG93biBhcyBjaGlwIGdyb3Vwcy4gYHN0b3JlYCA9IHRoZSBEaXJQcm9ncmFtIGtleS5cbmNvbnN0IFBST0dfRkFDRVRTOiB7IGtleTogc3RyaW5nOyBzdG9yZToga2V5b2YgRGlyUHJvZ3JhbTsgbGFiZWw6IHN0cmluZyB9W10gPSBbXG4gIHsga2V5OiAnc2V0dGluZycsIHN0b3JlOiAnc2V0dGluZycgYXMga2V5b2YgRGlyUHJvZ3JhbSwgbGFiZWw6ICdTZXR0aW5nJyB9LFxuICB7IGtleTogJ2xldmVsT2ZDYXJlJywgc3RvcmU6ICdsZXZlbE9mQ2FyZScgYXMga2V5b2YgRGlyUHJvZ3JhbSwgbGFiZWw6ICdMZXZlbCBvZiBjYXJlJyB9LFxuICB7IGtleTogJ3NwZWNpYWx0aWVzJywgc3RvcmU6ICdzcGVjaWFsdGllcycgYXMga2V5b2YgRGlyUHJvZ3JhbSwgbGFiZWw6ICdTcGVjaWFsdGllcycgfSxcbiAgeyBrZXk6ICdtb2RhbGl0aWVzJywgc3RvcmU6ICdtb2RhbGl0aWVzJyBhcyBrZXlvZiBEaXJQcm9ncmFtLCBsYWJlbDogJ01vZGFsaXRpZXMnIH0sXG4gIHsga2V5OiAnZ2VuZGVyU2VydmVkJywgc3RvcmU6ICdnZW5kZXJTZXJ2ZWQnIGFzIGtleW9mIERpclByb2dyYW0sIGxhYmVsOiAnR2VuZGVyIHNlcnZlZCcgfSxcbiAgeyBrZXk6ICdyZWdpb24nLCBzdG9yZTogJ3JlZ2lvbicgYXMga2V5b2YgRGlyUHJvZ3JhbSwgbGFiZWw6ICdSZWdpb24nIH0sXG5dO1xuLy8gQm9vbGVhbiBxdWljay10b2dnbGVzLlxuY29uc3QgUFJPR19UT0dHTEVTOiB7IGtleTogc3RyaW5nOyBsYWJlbDogc3RyaW5nIH1bXSA9IFtcbiAgeyBrZXk6ICdpbnN1cmFuY2VBY2NlcHRlZCcsIGxhYmVsOiAnVGFrZXMgaW5zdXJhbmNlJyB9LFxuICB7IGtleTogJ2JsdWVzdGVwJywgbGFiZWw6ICdPbiBCbHVlU3RlcCcgfSxcbiAgeyBrZXk6ICd2ZXJpZmllZCcsIGxhYmVsOiAnVmVyaWZpZWQgb25seScgfSxcbl07XG5cbi8vIERpc3RpbmN0IHZhbHVlcyBwcmVzZW50IGluIHRoZSBzdG9yZSBmb3IgYSBmYWNldCdzIHN0b3JlIGtleSwgc29ydGVkLlxuZnVuY3Rpb24gcHJvZ0ZhY2V0VmFsdWVzKHN0b3JlS2V5OiBrZXlvZiBEaXJQcm9ncmFtKTogc3RyaW5nW10ge1xuICBjb25zdCBzZXQ6IHsgW2s6IHN0cmluZ106IHRydWUgfSA9IHt9O1xuICBmb3IgKGNvbnN0IHAgb2YgKFBST0dSQU1fU1RPUkUgfHwgW10pKSBmb3IgKGNvbnN0IHYgb2YgYXNBcnIoKHAgYXMgYW55KVtzdG9yZUtleV0pKSBzZXRbdl0gPSB0cnVlO1xuICByZXR1cm4gT2JqZWN0LmtleXMoc2V0KS5zb3J0KCk7XG59XG5cbi8vIENvdW50IG9mIGFjdGl2ZSBmaWx0ZXJzIChmb3IgdGhlIEZpbHRlcnMgYnV0dG9uIGJhZGdlICsgY2hpcCByb3cgdmlzaWJpbGl0eSkuXG5mdW5jdGlvbiBwcm9nQWN0aXZlQ291bnQoKTogbnVtYmVyIHtcbiAgbGV0IG4gPSAwO1xuICBmb3IgKGNvbnN0IGYgb2YgUFJPR19GQUNFVFMpIG4gKz0gKFBST0dfRklMVEVSIGFzIGFueSlbZi5rZXldLmxlbmd0aDtcbiAgaWYgKFBST0dfRklMVEVSLnN0YXRlKSBuKys7XG4gIGlmIChQUk9HX0ZJTFRFUi5hZ2UpIG4rKztcbiAgZm9yIChjb25zdCB0IG9mIFBST0dfVE9HR0xFUykgaWYgKChQUk9HX0ZJTFRFUiBhcyBhbnkpW3Qua2V5XSkgbisrO1xuICByZXR1cm4gbjtcbn1cblxuLy8gSHVtYW4tcmVhZGFibGUgb25lLWxpbmVyIG9mIHRoZSBhY3RpdmUgZmlsdGVycyAoZm9yIEJsdWVJUSBjb250ZXh0ICsgZGlzcGxheSkuXG5mdW5jdGlvbiBwcm9nRmlsdGVyU3VtbWFyeSgpOiBzdHJpbmcge1xuICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBmIG9mIFBST0dfRkFDRVRTKSB7IGNvbnN0IHNlbDogc3RyaW5nW10gPSAoUFJPR19GSUxURVIgYXMgYW55KVtmLmtleV07IGlmIChzZWwubGVuZ3RoKSBwYXJ0cy5wdXNoKGYubGFiZWwgKyAnOiAnICsgc2VsLmpvaW4oJywgJykpOyB9XG4gIGlmIChQUk9HX0ZJTFRFUi5zdGF0ZSkgcGFydHMucHVzaCgnSG9tZSBzdGF0ZTogJyArIFBST0dfRklMVEVSLnN0YXRlKTtcbiAgaWYgKFBST0dfRklMVEVSLmFnZSkgcGFydHMucHVzaCgnU2VydmVzIGFnZSAnICsgUFJPR19GSUxURVIuYWdlKTtcbiAgZm9yIChjb25zdCB0IG9mIFBST0dfVE9HR0xFUykgaWYgKChQUk9HX0ZJTFRFUiBhcyBhbnkpW3Qua2V5XSkgcGFydHMucHVzaCh0LmxhYmVsKTtcbiAgaWYgKFBST0dfRklMVEVSLnEpIHBhcnRzLnB1c2goJ1NlYXJjaDogXCInICsgUFJPR19GSUxURVIucSArICdcIicpO1xuICByZXR1cm4gcGFydHMuam9pbignIFx1MDBCNyAnKSB8fCAnbm9uZSc7XG59XG5cbi8vIENvbXBhY3Qgc25hcHNob3Qgb2YgdGhlIGN1cnJlbnRseS1maWx0ZXJlZCBwcm9ncmFtcyBmb3IgQmx1ZUlRLCBzbyBpdCBjYW5cbi8vIHJlYXNvbiBvdmVyIGV4YWN0bHkgdGhlIHNob3J0bGlzdCB0aGUgY29uc3VsdGFudCBpcyBsb29raW5nIGF0LiBOdWxsIHdoZW4gbm9cbi8vIGZpbHRlcnMgYXJlIGFjdGl2ZSAoQmx1ZUlRIHRoZW4gYmVoYXZlcyBhcyBcInRoZSB3aG9sZSBkaXJlY3RvcnlcIikuIENhcHBlZCBzb1xuLy8gdGhlIHByb21wdCBzdGF5cyBib3VuZGVkOyBjb3VudC90b3RhbCB0ZWxsIHRoZSBtb2RlbCBpZiBpdCdzIHRydW5jYXRlZC5cbmZ1bmN0aW9uIHByb2dCaXFQYXlsb2FkKCk6IHsgYWN0aXZlOiBib29sZWFuOyBzdW1tYXJ5OiBzdHJpbmc7IGNvdW50OiBudW1iZXI7IHRvdGFsOiBudW1iZXI7IHByb2dyYW1zOiBhbnlbXSB9IHwgbnVsbCB7XG4gIGlmIChwcm9nQWN0aXZlQ291bnQoKSA9PT0gMCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IGFsbCA9IHByb2dGaWx0ZXJlZCgpO1xuICBjb25zdCBDQVAgPSA2MDtcbiAgY29uc3QgcHJvZ3JhbXMgPSBhbGwuc2xpY2UoMCwgQ0FQKS5tYXAocCA9PiAoe1xuICAgIGlkOiBwLmlkLCBuYW1lOiBwLnByb2dyYW1OYW1lLFxuICAgIHN0YXRlOiAocCBhcyBhbnkpLmxvY2F0aW9uU3RhdGUgfHwgJycsIHJlZ2lvbjogKHAgYXMgYW55KS5yZWdpb24gfHwgJycsXG4gICAgc2V0dGluZzogYXNBcnIoKHAgYXMgYW55KS5zZXR0aW5nKSwgbGV2ZWxPZkNhcmU6IGFzQXJyKChwIGFzIGFueSkubGV2ZWxPZkNhcmUpLFxuICAgIHNwZWNpYWx0aWVzOiBhc0FycigocCBhcyBhbnkpLnNwZWNpYWx0aWVzKSwgbW9kYWxpdGllczogYXNBcnIoKHAgYXMgYW55KS5tb2RhbGl0aWVzKSxcbiAgICBhZ2VNaW46IChwIGFzIGFueSkuYWdlTWluID8/IG51bGwsIGFnZU1heDogKHAgYXMgYW55KS5hZ2VNYXggPz8gbnVsbCxcbiAgICBjb3N0UGVyTW9udGhVU0Q6IChwIGFzIGFueSkuY29zdFBlck1vbnRoVVNEID8/IG51bGwsXG4gICAgaW5zdXJhbmNlQWNjZXB0ZWQ6IChwIGFzIGFueSkuaW5zdXJhbmNlQWNjZXB0ZWQgPT09IHRydWUsXG4gIH0pKTtcbiAgcmV0dXJuIHsgYWN0aXZlOiB0cnVlLCBzdW1tYXJ5OiBwcm9nRmlsdGVyU3VtbWFyeSgpLCBjb3VudDogYWxsLmxlbmd0aCwgdG90YWw6IChQUk9HUkFNX1NUT1JFIHx8IFtdKS5sZW5ndGgsIHByb2dyYW1zIH07XG59XG5cbmZ1bmN0aW9uIHByb2dyYW1zQ2hyb21lKGNvdW50TGFiZWw6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IG4gPSBwcm9nQWN0aXZlQ291bnQoKTtcbiAgY29uc3QgYmFkZ2UgPSBuID8gYDxzcGFuIGNsYXNzPVwiZmx0LWJhZGdlXCI+JHtufTwvc3Bhbj5gIDogJyc7XG4gIHJldHVybiBgJHtjcnVtYihbeyB0OiBvcmdMYWJlbCgpLCBoOiAnIy9kYXNoYm9hcmQnIH0sIHsgdDogJ1Byb2dyYW1zJyB9XSl9XG4gICR7cGFnZUhlYWQoJ1Byb2dyYW0gRGlyZWN0b3J5JywgJ0Egc2hhcmVkIGxpYnJhcnkgb2YgdHJlYXRtZW50IHByb2dyYW1zIFx1MjAxNCBzZWFyY2hhYmxlIGFjcm9zcyBsZXZlbHMgb2YgY2FyZSwgcG9wdWxhdGlvbnMsIGFuZCBnZW9ncmFwaHkuJywgYDxidXR0b24gY2xhc3M9XCJidG4gb3V0bGluZVwiIG9uY2xpY2s9XCJsb2FkUHJvZ3JhbXModHJ1ZSlcIj4ke2ljKCdjbG9jaycsIDE1KX0gUmVmcmVzaDwvYnV0dG9uPmApfVxuICA8ZGl2IGNsYXNzPVwidG9vbGJhclwiPlxuICAgIDxkaXYgY2xhc3M9XCJzZWFyY2hcIj4ke2ljKCdzZWFyY2gnLCAxNSl9PGlucHV0IGlkPVwicHJvZy1zZWFyY2hcIiBwbGFjZWhvbGRlcj1cIlNlYXJjaCBwcm9ncmFtcywgbG9jYXRpb25zLCBzcGVjaWFsdGllc1x1MjAyNlwiIHZhbHVlPVwiJHtlc2MoUFJPR19GSUxURVIucSl9XCIgb25pbnB1dD1cInByb2dPblNlYXJjaCgpXCI+PC9kaXY+XG4gICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBvdXRsaW5lIHByb2ctZmlsdGVycy1idG4ke1BST0dfRklMVEVSLnBhbmVsT3BlbiA/ICcgYWN0aXZlJyA6ICcnfVwiIGlkPVwicHJvZy1maWx0ZXJzLWJ0blwiIGFyaWEtZXhwYW5kZWQ9XCIke1BST0dfRklMVEVSLnBhbmVsT3Blbn1cIiBvbmNsaWNrPVwicHJvZ1RvZ2dsZVBhbmVsKClcIj4ke2ljKCdmaWx0ZXInLCAxNSl9IEZpbHRlcnMke2JhZGdlfTwvYnV0dG9uPlxuICAgIDxkaXYgc3R5bGU9XCJmbGV4OjFcIj48L2Rpdj5cbiAgICA8c3BhbiBjbGFzcz1cImNvdW50XCIgaWQ9XCJwcm9nLWNvdW50XCI+JHtlc2MoY291bnRMYWJlbCl9PC9zcGFuPlxuICA8L2Rpdj5cbiAgPGRpdiBpZD1cInByb2ctZmlsdGVyLXBhbmVsXCIgY2xhc3M9XCJwcm9nLWZpbHRlci1wYW5lbCR7UFJPR19GSUxURVIucGFuZWxPcGVuID8gJyBvcGVuJyA6ICcnfVwiPiR7cHJvZ0ZpbHRlclBhbmVsSW5uZXIoKX08L2Rpdj5cbiAgPGRpdiBpZD1cInByb2ctYWN0aXZlLWNoaXBzXCIgY2xhc3M9XCJwcm9nLWFjdGl2ZS1jaGlwc1wiPiR7cHJvZ0FjdGl2ZUNoaXBzSW5uZXIoKX08L2Rpdj5gO1xufVxuXG4vLyBUaGUgZXhwYW5kYWJsZSBwYW5lbDogYSBjaGlwIGdyb3VwIHBlciBmYWNldCArIGEgc3RhdGUgc2VsZWN0ICsgYSBcInNlcnZlcyBhZ2VcIlxuLy8gaW5wdXQgKyBib29sZWFuIHRvZ2dsZXMgKyBDbGVhciBhbGwuXG5mdW5jdGlvbiBwcm9nRmlsdGVyUGFuZWxJbm5lcigpOiBzdHJpbmcge1xuICBjb25zdCBncm91cHMgPSBQUk9HX0ZBQ0VUUy5tYXAoZiA9PiB7XG4gICAgY29uc3Qgc2VsOiBzdHJpbmdbXSA9IChQUk9HX0ZJTFRFUiBhcyBhbnkpW2Yua2V5XTtcbiAgICBjb25zdCB2YWxzID0gcHJvZ0ZhY2V0VmFsdWVzKGYuc3RvcmUpO1xuICAgIGlmICghdmFscy5sZW5ndGgpIHJldHVybiAnJztcbiAgICBjb25zdCBjaGlwcyA9IHZhbHMubWFwKHYgPT4ge1xuICAgICAgY29uc3Qgb24gPSBzZWwuaW5kZXhPZih2KSA+PSAwO1xuICAgICAgcmV0dXJuIGA8YnV0dG9uIGNsYXNzPVwiZmFjZXQtY2hpcCR7b24gPyAnIG9uJyA6ICcnfVwiIG9uY2xpY2s9XCJwcm9nVG9nZ2xlRmFjZXQoJyR7Zi5rZXl9JywnJHtlc2ModikucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpfScpXCI+JHtlc2Modil9PC9idXR0b24+YDtcbiAgICB9KS5qb2luKCcnKTtcbiAgICByZXR1cm4gYDxkaXYgY2xhc3M9XCJmbHQtZ3JvdXBcIj48ZGl2IGNsYXNzPVwiZmx0LWxhYmVsXCI+JHtlc2MoZi5sYWJlbCl9PC9kaXY+PGRpdiBjbGFzcz1cImZsdC1jaGlwc1wiPiR7Y2hpcHN9PC9kaXY+PC9kaXY+YDtcbiAgfSkuam9pbignJyk7XG5cbiAgY29uc3Qgc3RhdGVzID0gcHJvZ0ZhY2V0VmFsdWVzKCdsb2NhdGlvblN0YXRlJyBhcyBrZXlvZiBEaXJQcm9ncmFtKTtcbiAgY29uc3Qgc3RhdGVPcHRzID0gWyc8b3B0aW9uIHZhbHVlPVwiXCI+QW55IHN0YXRlPC9vcHRpb24+J11cbiAgICAuY29uY2F0KHN0YXRlcy5tYXAocyA9PiBgPG9wdGlvbiB2YWx1ZT1cIiR7ZXNjKHMpfVwiJHtzID09PSBQUk9HX0ZJTFRFUi5zdGF0ZSA/ICcgc2VsZWN0ZWQnIDogJyd9PiR7ZXNjKHMpfTwvb3B0aW9uPmApKS5qb2luKCcnKTtcbiAgY29uc3QgdG9nZ2xlcyA9IFBST0dfVE9HR0xFUy5tYXAodCA9PiB7XG4gICAgY29uc3Qgb24gPSAoUFJPR19GSUxURVIgYXMgYW55KVt0LmtleV07XG4gICAgcmV0dXJuIGA8YnV0dG9uIGNsYXNzPVwiZmFjZXQtY2hpcCR7b24gPyAnIG9uJyA6ICcnfVwiIG9uY2xpY2s9XCJwcm9nVG9nZ2xlRmxhZygnJHt0LmtleX0nKVwiPiR7ZXNjKHQubGFiZWwpfTwvYnV0dG9uPmA7XG4gIH0pLmpvaW4oJycpO1xuXG4gIHJldHVybiBgJHtncm91cHN9XG4gICAgPGRpdiBjbGFzcz1cImZsdC1yb3dcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJmbHQtZ3JvdXAgZmx0LWlubGluZVwiPjxkaXYgY2xhc3M9XCJmbHQtbGFiZWxcIj5Ib21lIHN0YXRlPC9kaXY+XG4gICAgICAgIDxzZWxlY3QgY2xhc3M9XCJwcm9nLWZpbHRlclwiIG9uY2hhbmdlPVwicHJvZ09uU3RhdGUodGhpcy52YWx1ZSlcIj4ke3N0YXRlT3B0c308L3NlbGVjdD48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJmbHQtZ3JvdXAgZmx0LWlubGluZVwiPjxkaXYgY2xhc3M9XCJmbHQtbGFiZWxcIj5TZXJ2ZXMgYWdlPC9kaXY+XG4gICAgICAgIDxpbnB1dCBjbGFzcz1cInByb2ctYWdlLWluXCIgdHlwZT1cIm51bWJlclwiIG1pbj1cIjBcIiBtYXg9XCI5OVwiIHBsYWNlaG9sZGVyPVwiZS5nLiAxNVwiIHZhbHVlPVwiJHtlc2MoUFJPR19GSUxURVIuYWdlKX1cIiBvbmlucHV0PVwicHJvZ09uQWdlKHRoaXMudmFsdWUpXCI+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiZmx0LWdyb3VwIGZsdC1pbmxpbmVcIj48ZGl2IGNsYXNzPVwiZmx0LWxhYmVsXCI+UXVpY2sgZmlsdGVyczwvZGl2PjxkaXYgY2xhc3M9XCJmbHQtY2hpcHNcIj4ke3RvZ2dsZXN9PC9kaXY+PC9kaXY+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cImZsdC1mb290XCI+PGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdCBzbVwiIG9uY2xpY2s9XCJwcm9nQ2xlYXJGaWx0ZXJzKClcIj4ke2ljKCd4JywgMTQpfSBDbGVhciBhbGwgZmlsdGVyczwvYnV0dG9uPjwvZGl2PmA7XG59XG5cbi8vIFJlbW92YWJsZSBjaGlwcyBmb3IgZXZlcnkgYWN0aXZlIGZpbHRlciwgc2hvd24gYWJvdmUgdGhlIHRhYmxlLlxuZnVuY3Rpb24gcHJvZ0FjdGl2ZUNoaXBzSW5uZXIoKTogc3RyaW5nIHtcbiAgY29uc3QgY2hpcHM6IHN0cmluZ1tdID0gW107XG4gIGZvciAoY29uc3QgZiBvZiBQUk9HX0ZBQ0VUUykgZm9yIChjb25zdCB2IG9mICgoUFJPR19GSUxURVIgYXMgYW55KVtmLmtleV0gYXMgc3RyaW5nW10pKSB7XG4gICAgY2hpcHMucHVzaChgPGJ1dHRvbiBjbGFzcz1cImFjdGl2ZS1jaGlwXCIgb25jbGljaz1cInByb2dUb2dnbGVGYWNldCgnJHtmLmtleX0nLCcke2VzYyh2KS5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIil9JylcIj4ke2VzYyh2KX0gJHtpYygneCcsIDEyKX08L2J1dHRvbj5gKTtcbiAgfVxuICBpZiAoUFJPR19GSUxURVIuc3RhdGUpIGNoaXBzLnB1c2goYDxidXR0b24gY2xhc3M9XCJhY3RpdmUtY2hpcFwiIG9uY2xpY2s9XCJwcm9nT25TdGF0ZSgnJylcIj5TdGF0ZTogJHtlc2MoUFJPR19GSUxURVIuc3RhdGUpfSAke2ljKCd4JywgMTIpfTwvYnV0dG9uPmApO1xuICBpZiAoUFJPR19GSUxURVIuYWdlKSBjaGlwcy5wdXNoKGA8YnV0dG9uIGNsYXNzPVwiYWN0aXZlLWNoaXBcIiBvbmNsaWNrPVwicHJvZ09uQWdlKCcnKVwiPlNlcnZlcyBhZ2UgJHtlc2MoUFJPR19GSUxURVIuYWdlKX0gJHtpYygneCcsIDEyKX08L2J1dHRvbj5gKTtcbiAgZm9yIChjb25zdCB0IG9mIFBST0dfVE9HR0xFUykgaWYgKChQUk9HX0ZJTFRFUiBhcyBhbnkpW3Qua2V5XSkgY2hpcHMucHVzaChgPGJ1dHRvbiBjbGFzcz1cImFjdGl2ZS1jaGlwXCIgb25jbGljaz1cInByb2dUb2dnbGVGbGFnKCcke3Qua2V5fScpXCI+JHtlc2ModC5sYWJlbCl9ICR7aWMoJ3gnLCAxMil9PC9idXR0b24+YCk7XG4gIGlmICghY2hpcHMubGVuZ3RoKSByZXR1cm4gJyc7XG4gIHJldHVybiBjaGlwcy5qb2luKCcnKSArIGA8YnV0dG9uIGNsYXNzPVwiYWN0aXZlLWNoaXAgY2xlYXJcIiBvbmNsaWNrPVwicHJvZ0NsZWFyRmlsdGVycygpXCI+Q2xlYXIgYWxsPC9idXR0b24+YDtcbn1cbi8vIERpcmVjdG9yeSBsaXN0IHN0YXRlOiBzZWFyY2ggdGV4dCwgdGhlIHR3byBkcm9wZG93biBmaWx0ZXJzLCBhbmQgdGhlIGN1cnJlbnRcbi8vIHBhZ2UuIEtlcHQgYXQgbW9kdWxlIHNjb3BlIHNvIGl0IHN1cnZpdmVzIGZ1bGwgcmUtcmVuZGVycyAobmF2aWdhdGUgYXdheS9iYWNrKS5cbmNvbnN0IFBST0dfUEFHRV9TSVpFID0gNTA7XG5pbnRlcmZhY2UgUHJvZ0ZpbHRlciB7XG4gIHE6IHN0cmluZzsgcGFnZTogbnVtYmVyOyBwYW5lbE9wZW46IGJvb2xlYW47IHN0YXRlOiBzdHJpbmc7IGFnZTogc3RyaW5nO1xuICBzZXR0aW5nOiBzdHJpbmdbXTsgbGV2ZWxPZkNhcmU6IHN0cmluZ1tdOyBzcGVjaWFsdGllczogc3RyaW5nW107IG1vZGFsaXRpZXM6IHN0cmluZ1tdO1xuICBnZW5kZXJTZXJ2ZWQ6IHN0cmluZ1tdOyByZWdpb246IHN0cmluZ1tdO1xuICBpbnN1cmFuY2VBY2NlcHRlZDogYm9vbGVhbjsgYmx1ZXN0ZXA6IGJvb2xlYW47IHZlcmlmaWVkOiBib29sZWFuO1xufVxuY29uc3QgUFJPR19GSUxURVI6IFByb2dGaWx0ZXIgPSB7XG4gIHE6ICcnLCBwYWdlOiAxLCBwYW5lbE9wZW46IGZhbHNlLCBzdGF0ZTogJycsIGFnZTogJycsXG4gIHNldHRpbmc6IFtdLCBsZXZlbE9mQ2FyZTogW10sIHNwZWNpYWx0aWVzOiBbXSwgbW9kYWxpdGllczogW10sIGdlbmRlclNlcnZlZDogW10sIHJlZ2lvbjogW10sXG4gIGluc3VyYW5jZUFjY2VwdGVkOiBmYWxzZSwgYmx1ZXN0ZXA6IGZhbHNlLCB2ZXJpZmllZDogZmFsc2UsXG59O1xuXG4vLyBQcm9ncmFtcyBtYXRjaGluZyBzZWFyY2ggKyBhbGwgYWN0aXZlIGZhY2V0cy4gRmFjZXRpbmcgaXMgQU5EIGFjcm9zcyBkaW1lbnNpb25zLFxuLy8gT1Igd2l0aGluIGEgZGltZW5zaW9uIChwaWNrIFRyYXVtYSArIEFueGlldHkgXHUyMTkyIHByb2dyYW1zIHdpdGggRUlUSEVSOyBjb21iaW5lZFxuLy8gd2l0aCBTZXR0aW5nPVJlc2lkZW50aWFsIFx1MjE5MiByZXNpZGVudGlhbCBBTkQgKHRyYXVtYSBPUiBhbnhpZXR5KSkuIEFsbCBjbGllbnQtc2lkZVxuLy8gYWdhaW5zdCB0aGUgbG9hZGVkIHN0b3JlLCBzbyBpdCdzIGluc3RhbnQuXG5mdW5jdGlvbiBwcm9nRmlsdGVyZWQoKTogRGlyUHJvZ3JhbVtdIHtcbiAgY29uc3QgcSA9IFBST0dfRklMVEVSLnEudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gIGNvbnN0IGFnZSA9IFBST0dfRklMVEVSLmFnZSA/IE51bWJlcihQUk9HX0ZJTFRFUi5hZ2UpIDogbnVsbDtcbiAgY29uc3Qgb3V0ID0gKFBST0dSQU1fU1RPUkUgfHwgW10pLmZpbHRlcihwID0+IHtcbiAgICBmb3IgKGNvbnN0IGYgb2YgUFJPR19GQUNFVFMpIHtcbiAgICAgIGNvbnN0IHNlbDogc3RyaW5nW10gPSAoUFJPR19GSUxURVIgYXMgYW55KVtmLmtleV07XG4gICAgICBpZiAoc2VsLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBwdiA9IGFzQXJyKChwIGFzIGFueSlbZi5zdG9yZV0pO1xuICAgICAgICBpZiAoIXNlbC5zb21lKHYgPT4gcHYuaW5kZXhPZih2KSA+PSAwKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoUFJPR19GSUxURVIuc3RhdGUgJiYgKHAgYXMgYW55KS5sb2NhdGlvblN0YXRlICE9PSBQUk9HX0ZJTFRFUi5zdGF0ZSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChhZ2UgIT09IG51bGwgJiYgIWlzTmFOKGFnZSkpIHtcbiAgICAgIGNvbnN0IGxvID0gdHlwZW9mIChwIGFzIGFueSkuYWdlTWluID09PSAnbnVtYmVyJyA/IChwIGFzIGFueSkuYWdlTWluIDogbnVsbDtcbiAgICAgIGNvbnN0IGhpID0gdHlwZW9mIChwIGFzIGFueSkuYWdlTWF4ID09PSAnbnVtYmVyJyA/IChwIGFzIGFueSkuYWdlTWF4IDogbnVsbDtcbiAgICAgIGlmIChsbyAhPT0gbnVsbCAmJiBhZ2UgPCBsbykgcmV0dXJuIGZhbHNlO1xuICAgICAgaWYgKGhpICE9PSBudWxsICYmIGFnZSA+IGhpKSByZXR1cm4gZmFsc2U7XG4gICAgICBpZiAobG8gPT09IG51bGwgJiYgaGkgPT09IG51bGwpIHJldHVybiBmYWxzZTsgLy8gdW5rbm93biBhZ2UgcmFuZ2UgXHUyMTkyIGV4Y2x1ZGVkIHdoZW4gZmlsdGVyaW5nIGJ5IGFnZVxuICAgIH1cbiAgICBpZiAoUFJPR19GSUxURVIuaW5zdXJhbmNlQWNjZXB0ZWQgJiYgKHAgYXMgYW55KS5pbnN1cmFuY2VBY2NlcHRlZCAhPT0gdHJ1ZSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChQUk9HX0ZJTFRFUi5ibHVlc3RlcCAmJiBwLmJsdWVzdGVwT3JnUmVmICE9PSB0cnVlKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKFBST0dfRklMVEVSLnZlcmlmaWVkICYmIChwIGFzIGFueSkudmVyaWZpZWQgIT09IHRydWUpIHJldHVybiBmYWxzZTtcbiAgICBpZiAocSkge1xuICAgICAgY29uc3QgaGF5ID0gW3AucHJvZ3JhbU5hbWUsIHAubG9jYXRpb24sIHAucG9wdWxhdGlvbnNSYXcsIGFzQXJyKChwIGFzIGFueSkuc3BlY2lhbHRpZXMpLmpvaW4oJyAnKSxcbiAgICAgICAgYXNBcnIoKHAgYXMgYW55KS5zZXR0aW5nKS5qb2luKCcgJyksIGFzQXJyKChwIGFzIGFueSkubGV2ZWxPZkNhcmUpLmpvaW4oJyAnKSxcbiAgICAgICAgYXNBcnIocC5wcm9ncmFtVHlwZSkuam9pbignICcpLCBhc0FycihwLnN0YXRlcykuam9pbignICcpLCBwLmFnZXNSYXddLmpvaW4oJyAnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKGhheS5pbmRleE9mKHEpIDwgMCkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSk7XG4gIHJldHVybiBvdXQuc29ydCgoYSwgYikgPT4gYS5wcm9ncmFtTmFtZS5sb2NhbGVDb21wYXJlKGIucHJvZ3JhbU5hbWUpKTtcbn1cblxuZnVuY3Rpb24gcHJvZ0NvdW50TGFiZWwoKTogc3RyaW5nIHtcbiAgY29uc3QgdG90YWwgPSAoUFJPR1JBTV9TVE9SRSB8fCBbXSkubGVuZ3RoO1xuICBjb25zdCBmaWx0ZXJlZCA9IHByb2dGaWx0ZXJlZCgpLmxlbmd0aDtcbiAgcmV0dXJuIGZpbHRlcmVkID09PSB0b3RhbCA/IHRvdGFsICsgJyBwcm9ncmFtcycgOiBmaWx0ZXJlZCArICcgb2YgJyArIHRvdGFsICsgJyBwcm9ncmFtcyc7XG59XG5cbmZ1bmN0aW9uIHByb2dSb3cocDogRGlyUHJvZ3JhbSk6IHN0cmluZyB7XG4gIGNvbnN0IHR5cGVzID0gKHAucHJvZ3JhbVR5cGUgfHwgW10pLmpvaW4oJywgJyk7XG4gIGNvbnN0IGJzID0gcC5ibHVlc3RlcE9yZ1JlZiA/IGA8c3BhbiBjbGFzcz1cImJzLWRvdFwiIHRpdGxlPVwiT24gQmx1ZVN0ZXAgXHUyMDE0IHJlZmVycmFscyBmbG93IGRpcmVjdGx5XCI+PC9zcGFuPmAgOiAnJztcbiAgcmV0dXJuIGA8dHIgY2xhc3M9XCJwcm9nLXJvd1wiIG9uY2xpY2s9XCJnbygnIy9wcm9ncmFtcy8nICsgZW5jb2RlVVJJQ29tcG9uZW50KCcke3AuaWR9JykpXCI+XG4gICAgPHRkIGNsYXNzPVwicHQtbmFtZVwiPiR7YnN9JHtlc2MocC5wcm9ncmFtTmFtZSl9PC90ZD5cbiAgICA8dGQgY2xhc3M9XCJwdC1sb2NcIiB0aXRsZT1cIiR7ZXNjKHAubG9jYXRpb24gfHwgJycpfVwiPiR7ZXNjKHAubG9jYXRpb24gfHwgJ1x1MjAxNCcpfTwvdGQ+XG4gICAgPHRkIGNsYXNzPVwicHQtdHlwZVwiIHRpdGxlPVwiJHtlc2ModHlwZXMpfVwiPiR7ZXNjKHR5cGVzIHx8ICdcdTIwMTQnKX08L3RkPlxuICAgIDx0ZCBjbGFzcz1cInB0LWFnZXNcIj4ke2VzYyhwLmFnZXNSYXcgfHwgJ1x1MjAxNCcpfTwvdGQ+XG4gIDwvdHI+YDtcbn1cblxuLy8gXCJzdGFydFx1MjAxM2VuZCBvZiB0b3RhbFwiICsgbnVtYmVyZWQgcGFnZXIuIEEgc2luZ2xlIHBhZ2Ugc2hvd3MganVzdCB0aGUgaW5mbyBsYWJlbC5cbmZ1bmN0aW9uIHByb2dQYWdlckh0bWwodG90YWw6IG51bWJlcik6IHN0cmluZyB7XG4gIGNvbnN0IHBhZ2VzID0gTWF0aC5tYXgoMSwgTWF0aC5jZWlsKHRvdGFsIC8gUFJPR19QQUdFX1NJWkUpKTtcbiAgY29uc3QgcGFnZSA9IE1hdGgubWluKE1hdGgubWF4KDEsIFBST0dfRklMVEVSLnBhZ2UpLCBwYWdlcyk7XG4gIGNvbnN0IHN0YXJ0ID0gdG90YWwgPyAocGFnZSAtIDEpICogUFJPR19QQUdFX1NJWkUgKyAxIDogMDtcbiAgY29uc3QgZW5kID0gTWF0aC5taW4odG90YWwsIHBhZ2UgKiBQUk9HX1BBR0VfU0laRSk7XG4gIGNvbnN0IGluZm8gPSBgPHNwYW4gY2xhc3M9XCJwZy1pbmZvXCI+JHt0b3RhbCA/IHN0YXJ0ICsgJ1x1MjAxMycgKyBlbmQgOiAwfSBvZiAke3RvdGFsfTwvc3Bhbj5gO1xuICBpZiAocGFnZXMgPD0gMSkgcmV0dXJuIGluZm87XG4gIGxldCBudW1zID0gJyc7XG4gIGZvciAobGV0IGkgPSAxOyBpIDw9IHBhZ2VzOyBpKyspIG51bXMgKz0gYDxidXR0b24gY2xhc3M9XCJwZy1udW0ke2kgPT09IHBhZ2UgPyAnIGFjdGl2ZScgOiAnJ31cIiBvbmNsaWNrPVwicHJvZ0dvUGFnZSgke2l9KVwiPiR7aX08L2J1dHRvbj5gO1xuICBjb25zdCBwcmV2ID0gYDxidXR0b24gY2xhc3M9XCJwZy1idG5cIiR7cGFnZSA8PSAxID8gJyBkaXNhYmxlZCcgOiAnJ30gb25jbGljaz1cInByb2dHb1BhZ2UoJHtwYWdlIC0gMX0pXCI+JHtpYygnY2hldkwnLCAxNCl9PC9idXR0b24+YDtcbiAgY29uc3QgbmV4dCA9IGA8YnV0dG9uIGNsYXNzPVwicGctYnRuXCIke3BhZ2UgPj0gcGFnZXMgPyAnIGRpc2FibGVkJyA6ICcnfSBvbmNsaWNrPVwicHJvZ0dvUGFnZSgke3BhZ2UgKyAxfSlcIj4ke2ljKCdjaGV2UicsIDE0KX08L2J1dHRvbj5gO1xuICByZXR1cm4gYCR7aW5mb308c3BhbiBzdHlsZT1cImZsZXg6MVwiPjwvc3Bhbj4ke3ByZXZ9JHtudW1zfSR7bmV4dH1gO1xufVxuXG4vLyBUaGUgdGFibGUgY2FyZDogc3RpY2t5LWlzaCBoZWFkZXIgcm93LCB0aGUgY3VycmVudCBwYWdlJ3Mgcm93cywgYW5kIHRoZSBwYWdlci5cbi8vIENsYW1wcyB0aGUgcGFnZSBpbnRvIHJhbmdlIGluIGNhc2UgYSBmaWx0ZXIgc2hyYW5rIHRoZSByZXN1bHQgc2V0LlxuZnVuY3Rpb24gcHJvZ1RhYmxlSHRtbCgpOiBzdHJpbmcge1xuICBjb25zdCBhbGwgPSBwcm9nRmlsdGVyZWQoKTtcbiAgY29uc3QgcGFnZXMgPSBNYXRoLm1heCgxLCBNYXRoLmNlaWwoYWxsLmxlbmd0aCAvIFBST0dfUEFHRV9TSVpFKSk7XG4gIGlmIChQUk9HX0ZJTFRFUi5wYWdlID4gcGFnZXMpIFBST0dfRklMVEVSLnBhZ2UgPSBwYWdlcztcbiAgaWYgKFBST0dfRklMVEVSLnBhZ2UgPCAxKSBQUk9HX0ZJTFRFUi5wYWdlID0gMTtcbiAgY29uc3Qgc3RhcnRJZHggPSAoUFJPR19GSUxURVIucGFnZSAtIDEpICogUFJPR19QQUdFX1NJWkU7XG4gIGNvbnN0IHBhZ2VJdGVtcyA9IGFsbC5zbGljZShzdGFydElkeCwgc3RhcnRJZHggKyBQUk9HX1BBR0VfU0laRSk7XG4gIGNvbnN0IHJvd3MgPSBwYWdlSXRlbXMubGVuZ3RoXG4gICAgPyBwYWdlSXRlbXMubWFwKHByb2dSb3cpLmpvaW4oJycpXG4gICAgOiBgPHRyPjx0ZCBjb2xzcGFuPVwiNFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiIHN0eWxlPVwicGFkZGluZzozNHB4IDEycHhcIj48ZGl2IGNsYXNzPVwiaWNvXCI+JHtpYygnc2VhcmNoJywgMjIpfTwvZGl2PjxiPk5vIG1hdGNoaW5nIHByb2dyYW1zPC9iPjxwPlRyeSBhIGRpZmZlcmVudCBzZWFyY2ggdGVybSBvciBmaWx0ZXIuPC9wPjwvZGl2PjwvdGQ+PC90cj5gO1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJjYXJkIHByb2ctdGFibGUtY2FyZFwiPlxuICAgIDxkaXYgY2xhc3M9XCJwcm9nLXRhYmxlLXNjcm9sbFwiPjx0YWJsZSBjbGFzcz1cInByb2ctdGFibGVcIj5cbiAgICAgIDx0aGVhZD48dHI+PHRoPlByb2dyYW08L3RoPjx0aD5Mb2NhdGlvbjwvdGg+PHRoPlR5cGU8L3RoPjx0aD5BZ2VzPC90aD48L3RyPjwvdGhlYWQ+XG4gICAgICA8dGJvZHkgaWQ9XCJwcm9nLXRib2R5XCI+JHtyb3dzfTwvdGJvZHk+XG4gICAgPC90YWJsZT48L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwicHJvZy1wYWdlclwiIGlkPVwicHJvZy1wYWdlclwiPiR7cHJvZ1BhZ2VySHRtbChhbGwubGVuZ3RoKX08L2Rpdj5cbiAgPC9kaXY+YDtcbn1cblxuLy8gUmUtcmVuZGVyIG9ubHkgdGhlIHRhYmxlIHJlZ2lvbiArIGNvdW50IFx1MjAxNCBsZWF2ZXMgdGhlIHRvb2xiYXIvc2VhcmNoIGJveCBpbiB0aGVcbi8vIERPTSBzbyBpdCBrZWVwcyBmb2N1cyB3aGlsZSB0aGUgdXNlciB0eXBlcy5cbmZ1bmN0aW9uIHJlbmRlclByb2dyYW1UYWJsZSgpOiB2b2lkIHtcbiAgY29uc3QgcmVnaW9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Byb2ctdGFibGUtcmVnaW9uJyk7XG4gIGlmIChyZWdpb24pIHJlZ2lvbi5pbm5lckhUTUwgPSBwcm9nVGFibGVIdG1sKCk7XG4gIGNvbnN0IGNudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcm9nLWNvdW50Jyk7XG4gIGlmIChjbnQpIGNudC50ZXh0Q29udGVudCA9IHByb2dDb3VudExhYmVsKCk7XG59XG5cbmZ1bmN0aW9uIHByb2dPblNlYXJjaCgpOiB2b2lkIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJvZy1zZWFyY2gnKSBhcyBIVE1MSW5wdXRFbGVtZW50IHwgbnVsbDtcbiAgUFJPR19GSUxURVIucSA9IGVsID8gZWwudmFsdWUgOiAnJztcbiAgUFJPR19GSUxURVIucGFnZSA9IDE7XG4gIHJlbmRlclByb2dyYW1UYWJsZSgpO1xufVxuXG4vLyBSZS1yZW5kZXIgZXZlcnl0aGluZyBhIGZhY2V0IGNoYW5nZSB0b3VjaGVzIFx1MjAxNCB0aGUgcGFuZWwgKGNoaXAgc2VsZWN0ZWQtc3RhdGUpLFxuLy8gdGhlIGFjdGl2ZS1jaGlwIHJvdywgdGhlIEZpbHRlcnMgYmFkZ2UsIHRoZSBjb3VudCwgYW5kIHRoZSB0YWJsZSBcdTIwMTQgV0lUSE9VVFxuLy8gcmVidWlsZGluZyB0aGUgdG9vbGJhciwgc28gdGhlIHNlYXJjaCBib3gga2VlcHMgZm9jdXMuXG5mdW5jdGlvbiByZW5kZXJQcm9ncmFtRmlsdGVycygpOiB2b2lkIHtcbiAgUFJPR19GSUxURVIucGFnZSA9IDE7XG4gIGNvbnN0IHBhbmVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Byb2ctZmlsdGVyLXBhbmVsJyk7XG4gIGlmIChwYW5lbCkgcGFuZWwuaW5uZXJIVE1MID0gcHJvZ0ZpbHRlclBhbmVsSW5uZXIoKTtcbiAgY29uc3QgY2hpcHMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJvZy1hY3RpdmUtY2hpcHMnKTtcbiAgaWYgKGNoaXBzKSBjaGlwcy5pbm5lckhUTUwgPSBwcm9nQWN0aXZlQ2hpcHNJbm5lcigpO1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJvZy1maWx0ZXJzLWJ0bicpO1xuICBpZiAoYnRuKSB7XG4gICAgY29uc3QgbiA9IHByb2dBY3RpdmVDb3VudCgpO1xuICAgIGNvbnN0IGJhc2UgPSBgJHtpYygnZmlsdGVyJywgMTUpfSBGaWx0ZXJzYDtcbiAgICBidG4uaW5uZXJIVE1MID0gYmFzZSArIChuID8gYDxzcGFuIGNsYXNzPVwiZmx0LWJhZGdlXCI+JHtufTwvc3Bhbj5gIDogJycpO1xuICB9XG4gIHJlbmRlclByb2dyYW1UYWJsZSgpO1xufVxuXG5mdW5jdGlvbiBwcm9nVG9nZ2xlUGFuZWwoKTogdm9pZCB7XG4gIFBST0dfRklMVEVSLnBhbmVsT3BlbiA9ICFQUk9HX0ZJTFRFUi5wYW5lbE9wZW47XG4gIGNvbnN0IHBhbmVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Byb2ctZmlsdGVyLXBhbmVsJyk7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcm9nLWZpbHRlcnMtYnRuJyk7XG4gIGlmIChwYW5lbCkgcGFuZWwuY2xhc3NMaXN0LnRvZ2dsZSgnb3BlbicsIFBST0dfRklMVEVSLnBhbmVsT3Blbik7XG4gIGlmIChidG4pIHsgYnRuLmNsYXNzTGlzdC50b2dnbGUoJ2FjdGl2ZScsIFBST0dfRklMVEVSLnBhbmVsT3Blbik7IGJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCBTdHJpbmcoUFJPR19GSUxURVIucGFuZWxPcGVuKSk7IH1cbn1cbmZ1bmN0aW9uIHByb2dUb2dnbGVGYWNldChkaW06IHN0cmluZywgdmFsdWU6IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCBhcnI6IHN0cmluZ1tdID0gKFBST0dfRklMVEVSIGFzIGFueSlbZGltXTtcbiAgY29uc3QgaSA9IGFyci5pbmRleE9mKHZhbHVlKTtcbiAgaWYgKGkgPj0gMCkgYXJyLnNwbGljZShpLCAxKTsgZWxzZSBhcnIucHVzaCh2YWx1ZSk7XG4gIHJlbmRlclByb2dyYW1GaWx0ZXJzKCk7XG59XG5mdW5jdGlvbiBwcm9nVG9nZ2xlRmxhZyhrZXk6IHN0cmluZyk6IHZvaWQge1xuICAoUFJPR19GSUxURVIgYXMgYW55KVtrZXldID0gIShQUk9HX0ZJTFRFUiBhcyBhbnkpW2tleV07XG4gIHJlbmRlclByb2dyYW1GaWx0ZXJzKCk7XG59XG5mdW5jdGlvbiBwcm9nT25TdGF0ZSh2OiBzdHJpbmcpOiB2b2lkIHsgUFJPR19GSUxURVIuc3RhdGUgPSB2OyByZW5kZXJQcm9ncmFtRmlsdGVycygpOyB9XG5mdW5jdGlvbiBwcm9nT25BZ2Uodjogc3RyaW5nKTogdm9pZCB7IFBST0dfRklMVEVSLmFnZSA9ICh2IHx8ICcnKS50cmltKCk7IHJlbmRlclByb2dyYW1GaWx0ZXJzKCk7IH1cbmZ1bmN0aW9uIHByb2dDbGVhckZpbHRlcnMoKTogdm9pZCB7XG4gIFBST0dfRklMVEVSLnN0YXRlID0gJyc7IFBST0dfRklMVEVSLmFnZSA9ICcnO1xuICBmb3IgKGNvbnN0IGYgb2YgUFJPR19GQUNFVFMpIChQUk9HX0ZJTFRFUiBhcyBhbnkpW2Yua2V5XSA9IFtdO1xuICBmb3IgKGNvbnN0IHQgb2YgUFJPR19UT0dHTEVTKSAoUFJPR19GSUxURVIgYXMgYW55KVt0LmtleV0gPSBmYWxzZTtcbiAgcmVuZGVyUHJvZ3JhbUZpbHRlcnMoKTtcbn1cbmZ1bmN0aW9uIHByb2dHb1BhZ2UobjogbnVtYmVyKTogdm9pZCB7XG4gIFBST0dfRklMVEVSLnBhZ2UgPSBuO1xuICByZW5kZXJQcm9ncmFtVGFibGUoKTtcbiAgY29uc3QgbWFpbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5tYWluJyk7XG4gIGlmIChtYWluKSBtYWluLnNjcm9sbFRvKDAsIDApO1xufVxuXG5mdW5jdGlvbiB2aWV3UHJvZ3JhbXMoKTogc3RyaW5nIHtcbiAgaWYgKFBST0dSQU1fU1RPUkUgPT09IG51bGwpIHtcbiAgICBpZiAoIVBST0dSQU1TX0xPQURJTkcgJiYgIVBST0dSQU1TX0VSUk9SKSBsb2FkUHJvZ3JhbXMoKTtcbiAgICByZXR1cm4gc2hlbGwoJ3Byb2dyYW1zJywgcHJvZ3JhbXNDaHJvbWUoJ1x1MjAyNicpICsgKFBST0dSQU1TX0VSUk9SID8gcHJvZ3JhbXNFcnJvcihQUk9HUkFNU19FUlJPUikgOiBsb2FkaW5nQ2FyZCgnTG9hZGluZyB0aGUgZGlyZWN0b3J5XHUyMDI2JykpKTtcbiAgfVxuICBjb25zdCByZWdpb24gPSBgPGRpdiBpZD1cInByb2ctdGFibGUtcmVnaW9uXCI+JHtwcm9nVGFibGVIdG1sKCl9PC9kaXY+YDtcbiAgcmV0dXJuIHNoZWxsKCdwcm9ncmFtcycsIHByb2dyYW1zQ2hyb21lKHByb2dDb3VudExhYmVsKCkpICsgcmVnaW9uKTtcbn1cblxuLy8gLS0tLSBQcm9ncmFtIGRldGFpbCAocmVhZC1vbmx5IHByb2ZpbGUpIC0tLS1cbmZ1bmN0aW9uIHByb2dTZWN0aW9uKHRpdGxlOiBzdHJpbmcsIGJvZHk/OiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoIWJvZHkgfHwgIWJvZHkudHJpbSgpKSByZXR1cm4gJyc7XG4gIHJldHVybiBgPGRpdiBjbGFzcz1cImNhcmQgY2FyZC1wYWQgcHJvZy1zZWNcIj48ZGl2IGNsYXNzPVwic2VjLWhcIj4ke2VzYyh0aXRsZSl9PC9kaXY+PGRpdiBjbGFzcz1cInNlYy1ib2R5XCI+JHtlc2MoYm9keSl9PC9kaXY+PC9kaXY+YDtcbn1cbi8vIFByb2dyYW0gcmVjb3JkIHZpZXcgXHUyMDE0IG1pcnJvcnMgdGhlIGNsaWVudCByZWNvcmQgc2hlbGwgKGljb24gcmFpbCArIGNvbnRleHR1YWxcbi8vIHNpZGViYXIgd2l0aCBsb2dvL25hbWUvc2VjdGlvbi1uYXYgKyBwZXJzaXN0ZW50IGhlYWRlciBjYXJkICsgY29udGVudCkuIFNlY3Rpb25zOlxuLy8gU3VtbWFyeSAocHJpdmF0ZSByYXRpbmcrc3VtbWFyeSksIE5vdGVzLCBGaWxlcywgUHJvZ3JhbSBEZXRhaWxzLCBDb250YWN0cy5cbmNvbnN0IFBST0dSQU1fU0VDVElPTlM6IHsga2V5OiBzdHJpbmc7IGxhYmVsOiBzdHJpbmcgfVtdID0gW1xuICB7IGtleTogJ3N1bW1hcnknLCBsYWJlbDogJ1N1bW1hcnknIH0sXG4gIHsga2V5OiAnbm90ZXMnLCBsYWJlbDogJ05vdGVzJyB9LFxuICB7IGtleTogJ2ZpbGVzJywgbGFiZWw6ICdGaWxlcycgfSxcbiAgeyBrZXk6ICdkZXRhaWxzJywgbGFiZWw6ICdQcm9ncmFtIERldGFpbHMnIH0sXG4gIHsga2V5OiAnY29udGFjdHMnLCBsYWJlbDogJ0NvbnRhY3RzJyB9LFxuICB7IGtleTogJ3JlZmVycmFscycsIGxhYmVsOiAnUmVmZXJyYWxzJyB9LFxuXTtcbmZ1bmN0aW9uIHByb2dyYW1TZWN0aW9uTGFiZWwoazogc3RyaW5nKTogc3RyaW5nIHtcbiAgZm9yIChjb25zdCBzIG9mIFBST0dSQU1fU0VDVElPTlMpIGlmIChzLmtleSA9PT0gaykgcmV0dXJuIHMubGFiZWw7XG4gIHJldHVybiBrO1xufVxuZnVuY3Rpb24gcHJvZ0luaXRpYWxzKG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHBhcnRzID0gKG5hbWUgfHwgJycpLnRyaW0oKS5zcGxpdCgvXFxzKy8pLmZpbHRlcihCb29sZWFuKTtcbiAgaWYgKCFwYXJ0cy5sZW5ndGgpIHJldHVybiAnPyc7XG4gIGlmIChwYXJ0cy5sZW5ndGggPT09IDEpIHJldHVybiBwYXJ0c1swXS5zbGljZSgwLCAyKS50b1VwcGVyQ2FzZSgpO1xuICByZXR1cm4gKHBhcnRzWzBdWzBdICsgcGFydHNbcGFydHMubGVuZ3RoIC0gMV1bMF0pLnRvVXBwZXJDYXNlKCk7XG59XG5cbmZ1bmN0aW9uIHZpZXdQcm9ncmFtKGlkOiBzdHJpbmcsIHNlY3Rpb24/OiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoIVBST0dSQU1fREVUQUlMW2lkXSkge1xuICAgIGlmICghUFJPR1JBTV9ERVRBSUxfTE9BRElOR1tpZF0gJiYgIVBST0dSQU1fREVUQUlMX0VSUk9SW2lkXSkgbG9hZFByb2dyYW0oaWQpO1xuICAgIGNvbnN0IGJhY2sgPSBgJHtjcnVtYihbeyB0OiBvcmdMYWJlbCgpLCBoOiAnIy9kYXNoYm9hcmQnIH0sIHsgdDogJ1Byb2dyYW1zJywgaDogJyMvcHJvZ3JhbXMnIH0sIHsgdDogJ1x1MjAyNicgfV0pfWA7XG4gICAgY29uc3QgYm9keSA9IFBST0dSQU1fREVUQUlMX0VSUk9SW2lkXVxuICAgICAgPyBgPGRpdiBjbGFzcz1cImNhcmRcIj48ZGl2IGNsYXNzPVwiZW1wdHlcIj48ZGl2IGNsYXNzPVwiaWNvXCI+JHtpYygnYWxlcnQnLCAyMil9PC9kaXY+PGI+Q291bGRuJ3QgbG9hZCB0aGlzIHByb2dyYW08L2I+PHA+JHtlc2MoUFJPR1JBTV9ERVRBSUxfRVJST1JbaWRdKX08L3A+PGJ1dHRvbiBjbGFzcz1cImJ0biBwcmltYXJ5XCIgb25jbGljaz1cImxvYWRQcm9ncmFtKCcke2VzYyhpZCl9JywgdHJ1ZSlcIj4ke2ljKCdjbG9jaycsIDE1KX0gUmV0cnk8L2J1dHRvbj48L2Rpdj48L2Rpdj5gXG4gICAgICA6IGxvYWRpbmdDYXJkKCdMb2FkaW5nIHByb2dyYW1cdTIwMjYnKTtcbiAgICByZXR1cm4gc2hlbGwoJ3Byb2dyYW1zJywgYmFjayArIGJvZHkpO1xuICB9XG4gIGNvbnN0IHAgPSBQUk9HUkFNX0RFVEFJTFtpZF07XG4gIGNvbnN0IHNlYyA9IHNlY3Rpb24gfHwgJ3N1bW1hcnknO1xuICBsZXQgY29udGVudDogc3RyaW5nO1xuICBpZiAoc2VjID09PSAnc3VtbWFyeScpIGNvbnRlbnQgPSBzdW1tYXJ5UHJvZ3JhbVNlY3Rpb24ocCk7XG4gIGVsc2UgaWYgKHNlYyA9PT0gJ25vdGVzJykgY29udGVudCA9IG5vdGVzUHJvZ3JhbVNlY3Rpb24ocCk7XG4gIGVsc2UgaWYgKHNlYyA9PT0gJ2ZpbGVzJykgY29udGVudCA9IHByb2dyYW1GaWxlc1NlY3Rpb24oaWQpO1xuICBlbHNlIGlmIChzZWMgPT09ICdkZXRhaWxzJykgY29udGVudCA9IHByb2dyYW1EZXRhaWxzU2VjdGlvbihwKTtcbiAgZWxzZSBpZiAoc2VjID09PSAnY29udGFjdHMnKSBjb250ZW50ID0gcHJvZ3JhbUNvbnRhY3RzU2VjdGlvbihwKTtcbiAgZWxzZSBpZiAoc2VjID09PSAncmVmZXJyYWxzJykgY29udGVudCA9IHByb2dyYW1SZWZlcnJhbHNTZWN0aW9uKGlkKTtcbiAgZWxzZSBjb250ZW50ID0gc3VtbWFyeVByb2dyYW1TZWN0aW9uKHApO1xuICByZXR1cm4gcHJvZ3JhbVNoZWxsKHAsIHNlYywgY29udGVudCk7XG59XG5cbmZ1bmN0aW9uIHByb2dyYW1TaGVsbChwOiBEaXJQcm9ncmFtLCBhY3RpdmU6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgZHBpZCA9IHAuaWQ7XG4gIHJlZ2lzdGVyUHJvZ3JhbUhpbnRzKHApO1xuICBjb25zdCBsb2dvID0gcHJvZ3JhbUxvZ29VcmwoZHBpZCk7XG4gIGNvbnN0IHR5cGVMYWJlbCA9IChwLnByb2dyYW1UeXBlICYmIHAucHJvZ3JhbVR5cGVbMF0pIHx8ICdQcm9ncmFtJztcblxuICBjb25zdCBuYXYgPSBQUk9HUkFNX1NFQ1RJT05TLm1hcChzID0+XG4gICAgYDxhIGhyZWY9XCIjL3Byb2dyYW1zLyR7ZW5jb2RlVVJJQ29tcG9uZW50KGRwaWQpfS8ke3Mua2V5fVwiIGNsYXNzPVwiJHthY3RpdmUgPT09IHMua2V5ID8gJ2FjdGl2ZScgOiAnJ31cIj4ke2VzYyhzLmxhYmVsKX08L2E+YFxuICApLmpvaW4oJycpO1xuXG4gIGNvbnN0IGN0eCA9IGA8YXNpZGUgY2xhc3M9XCJjdHhiYXJcIj5cbiAgICA8ZGl2IGNsYXNzPVwicmVjLWhlYWRcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJyZWMtcGhvdG8gcHJvZy1sb2dvXCIgdGl0bGU9XCJVcGxvYWQgYSBsb2dvXCIgb25jbGljaz1cInByb2dyYW1Mb2dvVXBsb2FkKCcke2VzYyhkcGlkKX0nKVwiPlxuICAgICAgICAke2xvZ28gPyBgPGltZyBzcmM9XCIke2VzYyhsb2dvKX1cIiBhbHQ9XCIke2VzYyhwLnByb2dyYW1OYW1lKX1cIj5gIDogZXNjKHByb2dJbml0aWFscyhwLnByb2dyYW1OYW1lKSl9XG4gICAgICAgIDxzcGFuIGNsYXNzPVwicHJvZy1sb2dvLWVkaXRcIj4ke2ljKCdlZGl0JywgMTIpfTwvc3Bhbj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cInJlYy1uYW1lXCI+JHtlc2MocC5wcm9ncmFtTmFtZSl9PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwicmVjLXN1YlwiPiR7ZXNjKHR5cGVMYWJlbCl9PC9kaXY+XG4gICAgICAke3AuYmx1ZXN0ZXBPcmdSZWYgPyAnPGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6OHB4XCI+PHNwYW4gY2xhc3M9XCJwaWxsIHByaW1hcnlcIj48c3BhbiBjbGFzcz1cImRvdFwiPjwvc3Bhbj5CbHVlU3RlcDwvc3Bhbj48L2Rpdj4nIDogJyd9XG4gICAgPC9kaXY+XG4gICAgPG5hdiBjbGFzcz1cImN0eG5hdlwiPiR7bmF2fTwvbmF2PlxuICA8L2FzaWRlPmA7XG5cbiAgY29uc3QgdGFncyA9IChwLnByb2dyYW1UeXBlIHx8IFtdKS5jb25jYXQocC5hZ2VCYW5kIHx8IFtdKS5jb25jYXQocC5nZW5kZXJTZXJ2ZWQgfHwgW10pLmNvbmNhdChwLnN0YXRlcyB8fCBbXSk7XG4gIGNvbnN0IGt2ID0gKGxhYmVsOiBzdHJpbmcsIHY/OiBzdHJpbmcpID0+IHYgJiYgdi50cmltKCkgPyBgPGRpdiBjbGFzcz1cImt2XCI+PHNwYW4gY2xhc3M9XCJrXCI+JHtlc2MobGFiZWwpfTwvc3Bhbj48c3BhbiBjbGFzcz1cInZcIj4ke2VzYyh2KX08L3NwYW4+PC9kaXY+YCA6ICcnO1xuICBjb25zdCBsaW5rczogc3RyaW5nW10gPSBbXTtcbiAgaWYgKHAud2Vic2l0ZSkgbGlua3MucHVzaChgPGEgY2xhc3M9XCJidG4gb3V0bGluZVwiIGhyZWY9XCIke2VzYyhwLndlYnNpdGUpfVwiIHRhcmdldD1cIl9ibGFua1wiIHJlbD1cIm5vb3BlbmVyXCI+JHtpYygnZXh0ZXJuYWwnLCAxNCl9IFdlYnNpdGU8L2E+YCk7XG4gIGNvbnN0IGxvYyA9IFtwLmxvY2F0aW9uLCBwLmFnZXNSYXcgPyAnQWdlcyAnICsgcC5hZ2VzUmF3IDogJyddLmZpbHRlcihCb29sZWFuKS5qb2luKCcgXHUwMEI3ICcpO1xuICBjb25zdCByZWNDYXJkID0gYDxkaXYgY2xhc3M9XCJjYXJkIHJlYy1jYXJkXCI+XG4gICAgPGRpdiBjbGFzcz1cInRvcFwiPjxoMj4ke2VzYyhwLnByb2dyYW1OYW1lKX08L2gyPjwvZGl2PlxuICAgICR7bG9jID8gYDxkaXYgY2xhc3M9XCJyZWMtbG9jXCI+JHtlc2MobG9jKX08L2Rpdj5gIDogJyd9XG4gICAgJHt0YWdzLmxlbmd0aCA/IGA8ZGl2IGNsYXNzPVwidGFnc1wiIHN0eWxlPVwibWFyZ2luOjEwcHggMFwiPiR7dGFncy5tYXAodCA9PiBgPHNwYW4gY2xhc3M9XCJ0YWdcIj4ke2VzYyh0KX08L3NwYW4+YCkuam9pbignJyl9PC9kaXY+YCA6ICcnfVxuICAgIDxkaXYgY2xhc3M9XCJrdi1ncmlkXCI+XG4gICAgICAke2t2KCdBZG1pc3Npb25zJywgcC5hZG1pc3Npb25zQ29udGFjdCl9XG4gICAgICAke2t2KCdJbnN1cmFuY2UnLCBwLmluc3VyYW5jZVJhdyl9XG4gICAgICAke2t2KCdBY2NyZWRpdGF0aW9uJywgcC5hY2NyZWRpdGF0aW9uUmF3KX1cbiAgICA8L2Rpdj5cbiAgICAke2xpbmtzLmxlbmd0aCA/IGA8ZGl2IGNsYXNzPVwicHJvZy1saW5rc1wiPiR7bGlua3Muam9pbignJyl9PC9kaXY+YCA6ICcnfVxuICA8L2Rpdj5gO1xuXG4gIGNvbnN0IG1haW4gPSBgPG1haW4gY2xhc3M9XCJtYWluXCI+PGRpdiBjbGFzcz1cImNvbnRlbnRcIj5cbiAgICAke2NydW1iKFt7IHQ6IG9yZ0xhYmVsKCksIGg6ICcjL2Rhc2hib2FyZCcgfSwgeyB0OiAnUHJvZ3JhbXMnLCBoOiAnIy9wcm9ncmFtcycgfSwgeyB0OiBwLnByb2dyYW1OYW1lLCBoOiAnIy9wcm9ncmFtcy8nICsgZW5jb2RlVVJJQ29tcG9uZW50KGRwaWQpIH0sIHsgdDogcHJvZ3JhbVNlY3Rpb25MYWJlbChhY3RpdmUpIH1dKX1cbiAgICAke3JlY0NhcmR9XG4gICAgJHtjb250ZW50fVxuICA8L2Rpdj48L21haW4+YDtcblxuICByZXR1cm4gdG9wYmFyKCkgKyBgPGRpdiBjbGFzcz1cImJvZHkgcmVjb3JkLWJvZHlcIj4ke3NpZGViYXIoJ3Byb2dyYW1zJywgdHJ1ZSl9PGRpdiBjbGFzcz1cIm5hdi1zY3JpbVwiIG9uY2xpY2s9XCJjbG9zZU5hdigpXCI+PC9kaXY+JHtjdHh9JHttYWlufTwvZGl2PmA7XG59XG5cbmZ1bmN0aW9uIHByb2dyYW1EZXRhaWxzU2VjdGlvbihwOiBEaXJQcm9ncmFtKTogc3RyaW5nIHtcbiAgY29uc3QgYm9keSA9IHByb2dTZWN0aW9uKCdPdmVydmlldycsIHAub3ZlcnZpZXcpXG4gICAgKyBwcm9nU2VjdGlvbignQ2xpbmljYWwgTW9kZWwgJiBNb2RhbGl0aWVzJywgcC5jbGluaWNhbE1vZGVsKVxuICAgICsgcHJvZ1NlY3Rpb24oJ0xldmVscyBvZiBDYXJlIC8gU3RydWN0dXJlJywgcC5sZXZlbHNPZkNhcmUpXG4gICAgKyBwcm9nU2VjdGlvbignQWNhZGVtaWNzJywgcC5hY2FkZW1pY3MpXG4gICAgKyBwcm9nU2VjdGlvbignRmFtaWx5IEludm9sdmVtZW50JywgcC5mYW1pbHlJbnZvbHZlbWVudClcbiAgICArIHByb2dTZWN0aW9uKCdBZG1pc3Npb25zICYgQ29zdCcsIHAuYWRtaXNzaW9uc0Nvc3QpXG4gICAgKyBwcm9nU2VjdGlvbignQWNjcmVkaXRhdGlvbiAmIE93bmVyc2hpcCcsIHAuYWNjcmVkaXRhdGlvbk93bmVyc2hpcCk7XG4gIGNvbnN0IGhlYWQgPSBgPGRpdiBjbGFzcz1cInNlY3Rpb24taGVhZFwiPjxkaXY+PGgzPlByb2dyYW0gRGV0YWlsczwvaDM+PHA+RnJvbSB0aGUgc2hhcmVkIGRpcmVjdG9yeSBwcm9maWxlLjwvcD48L2Rpdj48L2Rpdj5gO1xuICByZXR1cm4gaGVhZCArIChib2R5LnRyaW0oKVxuICAgID8gYm9keVxuICAgIDogYDxkaXYgY2xhc3M9XCJjYXJkXCI+PGRpdiBjbGFzcz1cImVtcHR5XCI+PGRpdiBjbGFzcz1cImljb1wiPiR7aWMoJ3JlcG9ydCcsIDIyKX08L2Rpdj48Yj5ObyBhZGRpdGlvbmFsIGRldGFpbHM8L2I+PHA+VGhlIGRpcmVjdG9yeSBwcm9maWxlIGhhcyBubyBuYXJyYXRpdmUgc2VjdGlvbnMgZm9yIHRoaXMgcHJvZ3JhbSB5ZXQuPC9wPjwvZGl2PjwvZGl2PmApO1xufVxuXG5mdW5jdGlvbiBwcm9ncmFtQ29udGFjdHNTZWN0aW9uKHA6IERpclByb2dyYW0pOiBzdHJpbmcge1xuICBjb25zdCBwZW9wbGUgPSBwLmNvbnRhY3RzICYmIHAuY29udGFjdHMucGVvcGxlID8gcC5jb250YWN0cy5wZW9wbGUgOiBbXTtcbiAgY29uc3QgY29udGFjdHNDYXJkID0gcGVvcGxlLmxlbmd0aCA/IGA8ZGl2IGNsYXNzPVwiY2FyZCBjYXJkLXBhZCBwcm9nLXNlY1wiPjxkaXYgY2xhc3M9XCJzZWMtaFwiPktleSBDb250YWN0czwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJwYy1saXN0XCI+JHtwZW9wbGUubWFwKChjOiBhbnkpID0+IGA8ZGl2IGNsYXNzPVwicGNcIj48ZGl2IGNsYXNzPVwicGMtblwiPiR7ZXNjKGMubmFtZSB8fCAnJyl9PC9kaXY+PGRpdiBjbGFzcz1cInBjLXRcIj4ke2VzYyhjLnRpdGxlIHx8ICcnKX08L2Rpdj4keyhjLnBob25lIHx8IGMuZW1haWwpID8gYDxkaXYgY2xhc3M9XCJwYy1kXCI+JHtbYy5waG9uZSwgYy5lbWFpbF0uZmlsdGVyKEJvb2xlYW4pLm1hcCgoeDogc3RyaW5nKSA9PiBlc2MoeCkpLmpvaW4oJyBcdTAwQjcgJyl9PC9kaXY+YCA6ICcnfTwvZGl2PmApLmpvaW4oJycpfTwvZGl2PjwvZGl2PmAgOiAnJztcbiAgY29uc3QgYWRtaXMgPSAocC5hZG1pc3Npb25zQ29udGFjdCB8fCAnJykudHJpbSgpO1xuICBjb25zdCBhZG1pc0NhcmQgPSBhZG1pcyA/IGA8ZGl2IGNsYXNzPVwiY2FyZCBjYXJkLXBhZCBwcm9nLXNlY1wiPjxkaXYgY2xhc3M9XCJzZWMtaFwiPkFkbWlzc2lvbnM8L2Rpdj48ZGl2IGNsYXNzPVwic2VjLWJvZHlcIj4ke2VzYyhhZG1pcyl9PC9kaXY+PC9kaXY+YCA6ICcnO1xuICBjb25zdCBzb3VyY2VzID0gKHAuc291cmNlcyB8fCAnJykudHJpbSgpO1xuICBjb25zdCBzb3VyY2VzQ2FyZCA9IHNvdXJjZXMgPyBgPGRpdiBjbGFzcz1cImNhcmQgY2FyZC1wYWQgcHJvZy1zZWNcIj48ZGl2IGNsYXNzPVwic2VjLWhcIj5Tb3VyY2VzPC9kaXY+PGRpdiBjbGFzcz1cInNlYy1ib2R5XCI+JHtzb3VyY2VzLnNwbGl0KCdcXG4nKS5maWx0ZXIoQm9vbGVhbikubWFwKHUgPT4gYDxhIGhyZWY9XCIke2VzYyh1LnRyaW0oKSl9XCIgdGFyZ2V0PVwiX2JsYW5rXCIgcmVsPVwibm9vcGVuZXJcIj4ke2VzYyh1LnRyaW0oKSl9PC9hPmApLmpvaW4oJzxicj4nKX08L2Rpdj48L2Rpdj5gIDogJyc7XG4gIGNvbnN0IGhlYWQgPSBgPGRpdiBjbGFzcz1cInNlY3Rpb24taGVhZFwiPjxkaXY+PGgzPkNvbnRhY3RzPC9oMz48cD5BZG1pc3Npb25zLCBrZXkgcGVvcGxlLCBhbmQgc291cmNlcyBmcm9tIHRoZSBkaXJlY3RvcnkuPC9wPjwvZGl2PjwvZGl2PmA7XG4gIGNvbnN0IGJvZHkgPSBjb250YWN0c0NhcmQgKyBhZG1pc0NhcmQgKyBzb3VyY2VzQ2FyZDtcbiAgcmV0dXJuIGhlYWQgKyAoYm9keS50cmltKClcbiAgICA/IGJvZHlcbiAgICA6IGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCd1c2VycycsIDIyKX08L2Rpdj48Yj5ObyBjb250YWN0cyBvbiBmaWxlPC9iPjxwPlRoZSBkaXJlY3RvcnkgcHJvZmlsZSBsaXN0cyBubyBjb250YWN0cyBmb3IgdGhpcyBwcm9ncmFtLjwvcD48L2Rpdj48L2Rpdj5gKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIHByb2dyYW0gUmVmZXJyYWxzIHRhYjogdGhlIG90aGVyIHNpZGUgb2YgdGhlIGNsaWVudFx1MjE5NHByb2dyYW0gcmVsYXRpb25zaGlwIFx1MjAxNFxuLy8gZXZlcnkgY2xpZW50IHRoZSBjb25zdWx0YW50IGhhcyByZWZlcnJlZCBUTyB0aGlzIHByb2dyYW0sIHdpdGggb3V0Y29tZSArIGRhdGUuXG5mdW5jdGlvbiBwcm9ncmFtUmVmZXJyYWxzU2VjdGlvbihpZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgaGVhZCA9IGA8ZGl2IGNsYXNzPVwic2VjdGlvbi1oZWFkXCI+PGRpdj48aDM+UmVmZXJyYWxzPC9oMz48cD5DbGllbnRzIHlvdSd2ZSByZWZlcnJlZCB0byB0aGlzIHByb2dyYW0sIGFuZCBob3cgdGhleSB0dXJuZWQgb3V0LjwvcD48L2Rpdj48L2Rpdj5gO1xuICBpZiAoUFJPR1JBTV9SRUZFUlJBTFNbaWRdID09PSB1bmRlZmluZWQpIHtcbiAgICBpZiAoIVBST0dSQU1fUkVGRVJSQUxTX0xPQURJTkdbaWRdICYmICFQUk9HUkFNX1JFRkVSUkFMU19FUlJPUltpZF0pIGxvYWRQcm9ncmFtUmVmZXJyYWxzKGlkKTtcbiAgICBpZiAoUFJPR1JBTV9SRUZFUlJBTFNfRVJST1JbaWRdKSB7XG4gICAgICByZXR1cm4gaGVhZCArIGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdhbGVydCcsIDIyKX08L2Rpdj48Yj5Db3VsZG4ndCBsb2FkIHJlZmVycmFsczwvYj48cD4ke2VzYyhQUk9HUkFNX1JFRkVSUkFMU19FUlJPUltpZF0pfTwvcD48YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnlcIiBvbmNsaWNrPVwibG9hZFByb2dyYW1SZWZlcnJhbHMoJyR7ZXNjKGlkKX0nLCB0cnVlKVwiPiR7aWMoJ2Nsb2NrJywgMTUpfSBSZXRyeTwvYnV0dG9uPjwvZGl2PjwvZGl2PmA7XG4gICAgfVxuICAgIHJldHVybiBoZWFkICsgbG9hZGluZ0NhcmQoJ0xvYWRpbmcgcmVmZXJyYWxzXHUyMDI2Jyk7XG4gIH1cbiAgY29uc3QgbGlzdCA9IFBST0dSQU1fUkVGRVJSQUxTW2lkXSB8fCBbXTtcbiAgaWYgKCFsaXN0Lmxlbmd0aCkge1xuICAgIHJldHVybiBoZWFkICsgYDxkaXYgY2xhc3M9XCJjYXJkXCI+PGRpdiBjbGFzcz1cImVtcHR5XCI+PGRpdiBjbGFzcz1cImljb1wiPiR7aWMoJ3NlbmQnLCAyMil9PC9kaXY+PGI+Tm8gcmVmZXJyYWxzIHlldDwvYj48cD5XaGVuIHlvdSByZWZlciBhIGNsaWVudCB0byB0aGlzIHByb2dyYW0gXHUyMDE0IGZyb20gYSBjbGllbnQncyBSZWZlcnJhbHMgdGFiIFx1MjAxNCBpdCBzaG93cyB1cCBoZXJlLjwvcD48L2Rpdj48L2Rpdj5gO1xuICB9XG4gIGNvbnN0IGlzQWNjID0gKHM6IHN0cmluZykgPT4gcyA9PT0gJ0FjY2VwdGVkJyB8fCBzID09PSAnRW5yb2xsZWQnO1xuICBjb25zdCBhY2MgPSBsaXN0LmZpbHRlcihyID0+IGlzQWNjKHIuc3RhdHVzKSkubGVuZ3RoO1xuICBjb25zdCBkZWMgPSBsaXN0LmZpbHRlcihyID0+IFJFRkVSUkFMX0RFQ0xJTkVEX1NUQVRVU0VTLmluZGV4T2Yoci5zdGF0dXMpID49IDApLmxlbmd0aDtcbiAgY29uc3Qgc3RhdHMgPSBgPGRpdiBjbGFzcz1cInJmLXN0YXRzXCI+PHNwYW4+PGI+JHtsaXN0Lmxlbmd0aH08L2I+IHRvdGFsPC9zcGFuPjxzcGFuIGNsYXNzPVwicmYtb2tcIj48Yj4ke2FjY308L2I+IGFjY2VwdGVkPC9zcGFuPjxzcGFuIGNsYXNzPVwicmYtbm9cIj48Yj4ke2RlY308L2I+IGRlY2xpbmVkPC9zcGFuPjwvZGl2PmA7XG4gIGNvbnN0IHJvd3MgPSBsaXN0Lm1hcChwcm9ncmFtUmVmZXJyYWxSb3cpLmpvaW4oJycpO1xuICByZXR1cm4gaGVhZCArIHN0YXRzICsgYDxkaXYgY2xhc3M9XCJyZi1saXN0XCI+JHtyb3dzfTwvZGl2PmA7XG59XG5cbmZ1bmN0aW9uIHByb2dyYW1SZWZlcnJhbFJvdyhyOiBhbnkpOiBzdHJpbmcge1xuICBjb25zdCBuYW1lID0gKHIuY2xpZW50TmFtZSB8fCAnJykudHJpbSgpIHx8ICdDbGllbnQnO1xuICBjb25zdCBwaWxsID0gci5zdGF0dXMgPyBgPHNwYW4gY2xhc3M9XCJyZi1zdGF0dXMgJHtyZWZlcnJhbFN0YXR1c0NsYXNzKHIuc3RhdHVzKX1cIj4ke2VzYyhyLnN0YXR1cyl9PC9zcGFuPmAgOiAnJztcbiAgY29uc3QgZGVjbGluZWQgPSBSRUZFUlJBTF9ERUNMSU5FRF9TVEFUVVNFUy5pbmRleE9mKHIuc3RhdHVzKSA+PSAwO1xuICBjb25zdCBkZWNsaW5lID0gKGRlY2xpbmVkICYmIHIuZGVjbGluZVJlYXNvbikgPyBgPGRpdiBjbGFzcz1cInJmLWRlY2xpbmVcIj4ke2ljKCdhbGVydCcsIDEzKX0gRGVjbGluZSByZWFzb246IDxiPiR7ZXNjKHIuZGVjbGluZVJlYXNvbil9PC9iPjwvZGl2PmAgOiAnJztcbiAgY29uc3Qgbm90ZXMgPSAoci5ub3RlcyB8fCAnJykudHJpbSgpID8gYDxkaXYgY2xhc3M9XCJyZi1ub3Rlc1wiPiR7ZXNjKHIubm90ZXMpfTwvZGl2PmAgOiAnJztcbiAgY29uc3QgZm9vdCA9IChyLmRhdGUgfHwgci5yZWZlcnJlZEJ5KSA/IGA8ZGl2IGNsYXNzPVwicmYtZm9vdFwiPiR7ci5kYXRlID8gZXNjKGZtdERhdGUoci5kYXRlKSkgOiAnJ30ke3IucmVmZXJyZWRCeSA/ICcgXHUwMEI3IGJ5ICcgKyBlc2Moci5yZWZlcnJlZEJ5KSA6ICcnfTwvZGl2PmAgOiAnJztcbiAgY29uc3QgdG8gPSByLmNsaWVudElkID8gYCMvY2xpZW50cy8ke2VuY29kZVVSSUNvbXBvbmVudChyLmNsaWVudElkKX1gIDogJyc7XG4gIGNvbnN0IGNsaWVudCA9IHRvID8gYDxhIGNsYXNzPVwicmYtY2xpZW50XCIgaHJlZj1cIiR7dG99XCI+JHtlc2MobmFtZSl9PC9hPmAgOiBgPHNwYW4gY2xhc3M9XCJyZi1jbGllbnRcIj4ke2VzYyhuYW1lKX08L3NwYW4+YDtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiY2FyZCBjYXJkLXBhZCByZi1jYXJkXCI+PGRpdiBjbGFzcz1cInJmLXRvcFwiPiR7Y2xpZW50fSR7cGlsbH08L2Rpdj4ke2RlY2xpbmV9JHtub3Rlc30ke2Zvb3R9PC9kaXY+YDtcbn1cblxuIl0sCiAgIm1hcHBpbmdzIjogIkFBV0EsU0FBUyxnQkFBd0I7QUFDL0Isa0JBQWdCO0FBQ2hCLFFBQU0sU0FBUyxZQUFZLHFE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
