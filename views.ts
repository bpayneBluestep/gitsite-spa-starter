/* =====================================================================
   views.ts — the primary-nav pages.
   Dashboard (placeholder) · Clients · Programs.
   Client rows are intentionally non-navigating: the client record is a
   separate merge report, not built here. Wire row clicks once it exists.
   ===================================================================== */

// The Dashboard is a live caseload overview backed by the maestro's server-side
// `dashboard` aggregation (stage counts, referral funnel/outcomes, task buckets,
// recent activity). Data loads once on first view (ensureDashboard) and caches;
// Refresh forces a reload.
function viewDashboard(): string {
  ensureDashboard();
  const action = DASHBOARD ? `<button class="btn" onclick="loadDashboard(true)">${ic('clock', 15)} Refresh</button>` : '';
  let body: string;
  if (DASHBOARD_ERROR) {
    body = `<div class="card"><div class="empty"><div class="ico">${ic('alert', 22)}</div><b>Couldn't load the dashboard</b><p>${esc(DASHBOARD_ERROR)}</p><button class="btn primary" onclick="loadDashboard(true)">${ic('clock', 15)} Retry</button></div></div>`;
  } else if (!DASHBOARD) {
    body = loadingCard('Loading your caseload overview');
  } else {
    body = dashboardBody(DASHBOARD);
  }
  const head = pageHead('Dashboard', dashGreeting(), action);
  return shell('dashboard', `${crumb([{ t: orgLabel(), h: '#/dashboard' }, { t: 'Dashboard' }])}${head}${body}`);
}

function dashGreeting(): string {
  const n = (typeof SESSION !== 'undefined' && SESSION && SESSION.firstName) ? SESSION.firstName : '';
  const hi = n ? `Welcome back, ${esc(n)}.` : 'Welcome back.';
  return `${hi} Here's your practice at a glance.`;
}

// Map a referral status to a visual tone (matches referralStatusClass semantics).
function refTone(status: string): string {
  if (status === 'Accepted' || status === 'Enrolled') return 'good';
  if (status === 'Declined' || status === 'Family Declined') return 'bad';
  if (status === 'Considering' || status === 'Pre-screening') return 'warn';
  return ''; // Referred / Application Sent / Waitlisted → primary
}

function dashboardBody(d: any): string {
  const s = d.stages || {}; const r = d.referrals || {}; const t = d.tasks || {};
  const decided = (r.accepted || 0) + (r.declined || 0);
  const winRate = decided ? Math.round((r.accepted || 0) / decided * 100) : 0;

  // ── stat row ──
  const stats = `<div class="stat-row">
    ${statTile('users', 'Active clients', s.client || 0, 'current caseload', '')}
    ${statTile('user', 'Inquiries', s.inquiry || 0, 'in the pipeline', '')}
    ${statTile('check', 'Alumni', s.alumni || 0, 'placed & closed', 'good')}
    ${statTile('alert', 'Overdue tasks', t.overdue || 0, (t.dueThisWeek || 0) + ' due this week', (t.overdue ? 'bad' : ''))}
    ${statTile('sparkle', 'Referral win rate', winRate + '%', (r.accepted || 0) + ' accepted · ' + (r.declined || 0) + ' declined', (winRate >= 50 ? 'good' : ''))}
  </div>`;

  // ── pipeline segment bar ──
  const total = (s.inquiry || 0) + (s.client || 0) + (s.alumni || 0) || 1;
  const seg = `<div class="dash-card">
    <h3>${ic('report', 16)} Caseload pipeline <span class="hint">${d.totalPeople || total} people</span></h3>
    <div class="seg">
      <span style="width:${(s.inquiry || 0) / total * 100}%;background:var(--warning)"></span>
      <span style="width:${(s.client || 0) / total * 100}%;background:var(--primary)"></span>
      <span style="width:${(s.alumni || 0) / total * 100}%;background:var(--success)"></span>
    </div>
    <div class="seg-legend">
      ${segLi('var(--warning)', 'Inquiries', s.inquiry || 0)}
      ${segLi('var(--primary)', 'Clients', s.client || 0)}
      ${segLi('var(--success)', 'Alumni', s.alumni || 0)}
    </div>
  </div>`;

  // ── referral outcomes (win rate + bars) ──
  const outcomeMax = Math.max(r.accepted || 0, r.declined || 0, 1);
  const outcomes = `<div class="dash-card">
    <h3>${ic('share', 16)} Referral outcomes <span class="hint">${r.total || 0} total</span></h3>
    <div class="bar-list">
      ${barItem('Accepted / enrolled', r.accepted || 0, outcomeMax, 'good')}
      ${barItem('Declined', r.declined || 0, outcomeMax, 'bad')}
    </div>
    <div class="seg-legend" style="margin-top:16px">
      <div class="li"><b style="font-size:20px">${winRate}%</b>&nbsp;<span class="c">acceptance rate of decided referrals</span></div>
    </div>
  </div>`;

  // ── tasks: buckets + soonest-due list ──
  const taskList = (d.upcomingTasks || []).map((tk: any) => dashTaskRow(tk, d.today)).join('') ||
    `<div class="dash-empty">No open tasks with due dates. 🎉</div>`;
  const tasksCard = `<div class="dash-card">
    <h3>${ic('calendar', 16)} Tasks ${(t.open || 0) ? `<span class="hint">${t.open} open</span>` : ''}</h3>
    <div class="mini-buckets">
      <div class="mini bad"><div class="n">${t.overdue || 0}</div><div class="l">Overdue</div></div>
      <div class="mini warn"><div class="n">${t.dueThisWeek || 0}</div><div class="l">Due this week</div></div>
      <div class="mini"><div class="n">${t.upcoming || 0}</div><div class="l">Upcoming</div></div>
    </div>
    <div class="dash-list">${taskList}</div>
  </div>`;

  // ── recent activity ──
  const commList = (d.recentComms || []).map((c: any) => dashCommRow(c)).join('') ||
    `<div class="dash-empty">No communications logged yet.</div>`;
  const activity = `<div class="dash-card">
    <h3>${ic('msg', 16)} Recent activity</h3>
    <div class="dash-list">${commList}</div>
  </div>`;

  // ── referral funnel by status ──
  const byStatus = r.byStatus || {};
  const statusOrder = ['Considering', 'Pre-screening', 'Referred', 'Application Sent', 'Waitlisted', 'Accepted', 'Enrolled', 'Declined', 'Family Declined'];
  const statusKeys = statusOrder.filter(k => byStatus[k]);
  const statusMax = Math.max.apply(null, statusKeys.map(k => byStatus[k]).concat([1]));
  const funnel = `<div class="dash-card">
    <h3>${ic('filter', 16)} Referral funnel <span class="hint">by status</span></h3>
    <div class="bar-list">
      ${statusKeys.map(k => barItem(k, byStatus[k], statusMax, refTone(k))).join('')}
    </div>
  </div>`;

  // ── top programs + top decline reasons ──
  const progs = r.topPrograms || [];
  const progMax = Math.max.apply(null, progs.map((p: any) => p.count).concat([1]));
  const declines = r.topDeclineReasons || [];
  const topCard = `<div class="dash-card">
    <h3>${ic('building', 16)} Top referral destinations</h3>
    ${progs.length ? `<div class="bar-list">${progs.map((p: any) => barItem(p.program, p.count, progMax, '')).join('')}</div>`
      : `<div class="dash-empty">No referrals logged yet.</div>`}
    ${declines.length ? `<h3 style="margin:20px 0 10px">${ic('info', 16)} Why referrals fall through</h3>
      <div class="dash-pills">${declines.map((x: any) => `<span class="pill muted">${esc(x.reason)} <b>&nbsp;${x.count}</b></span>`).join('')}</div>` : ''}
  </div>`;

  return `${stats}
    <div class="dash-grid">${seg}${tasksCard}</div>
    <div class="dash-grid">${outcomes}${activity}</div>
    <div class="dash-grid">${funnel}${topCard}</div>`;
}

function statTile(icon: string, label: string, num: string | number, sub: string, tone: string): string {
  return `<div class="stat${tone ? ' ' + tone : ''}">
    <div class="lbl">${ic(icon, 14)} ${esc(label)}</div>
    <div class="num">${esc(String(num))}</div>
    <div class="sub">${esc(sub)}</div>
  </div>`;
}
function segLi(color: string, label: string, count: number): string {
  return `<div class="li"><span class="sw" style="background:${color}"></span><b>${count}</b>&nbsp;<span class="c">${esc(label)}</span></div>`;
}
function barItem(label: string, count: number, max: number, tone: string): string {
  const pct = max ? Math.round(count / max * 100) : 0;
  return `<div class="bar-item">
    <span class="bl">${esc(label)}</span>
    <span class="bar-track"><span class="bar-fill${tone ? ' ' + tone : ''}" style="width:${pct}%"></span></span>
    <span class="bn">${count}</span>
  </div>`;
}
// A soonest-due task row. Overdue → red marker, due-this-week → amber.
function dashTaskRow(tk: any, today: string): string {
  const due = String(tk.dueDate || '');
  let rt = fmtDate(due) || '—'; let cls = '';
  if (due && today && due < today) { cls = ' bad'; rt = 'Overdue · ' + rt; }
  return `<div class="dash-li" onclick="go('#/clients/${encodeURIComponent(tk.clientId)}/tasks')">
    <div class="di">${ic('check', 15)}</div>
    <div class="bd"><div class="t1">${esc(tk.title || 'Untitled task')}</div>
      <div class="t2">${esc(tk.clientName || '')}${tk.assignee ? ' · ' + esc(tk.assignee) : ''}</div></div>
    <div class="rt${cls}">${esc(rt)}</div>
  </div>`;
}
function dashCommRow(c: any): string {
  const iconFor: { [k: string]: string } = { 'Call': 'bell', 'Email': 'mail', 'Text': 'msg', 'Video Call': 'laptop', 'In-person / Meeting': 'users', 'Note': 'fileText' };
  const icon = iconFor[c.type] || 'msg';
  const when = fmtDate(String(c.date || '')) || '';
  return `<div class="dash-li" onclick="go('#/clients/${encodeURIComponent(c.clientId)}/communications')">
    <div class="di">${ic(icon, 15)}</div>
    <div class="bd"><div class="t1">${esc(c.subject || c.type || 'Communication')}</div>
      <div class="t2">${esc(c.clientName || '')}${c.type ? ' · ' + esc(c.type) : ''}</div></div>
    <div class="rt">${esc(when)}</div>
  </div>`;
}

// ---- shared async-state cards (live data) ----
function loadingCard(msg: string): string {
  return `<div class="card"><div class="empty"><div class="ico">${ic('clock', 22)}</div><b>${esc(msg)}</b><p>Fetching live records from the maestro.</p></div></div>`;
}
function errorCard(err: string): string {
  return `<div class="card"><div class="empty"><div class="ico">${ic('alert', 22)}</div><b>Couldn't load clients</b><p>${esc(err)}</p><button class="btn primary" onclick="loadClients(true)">${ic('clock', 15)} Retry</button></div></div>`;
}

// The Clients page is tabbed across the three Individual categories:
// Clients · Inquiries · Alumni. Each tab has its own live store; switching just
// re-renders against the active store.
interface ListTab { key: string; label: string; plural: string; }
const LIST_TABS: ListTab[] = [
  { key: 'client',  label: 'client',   plural: 'Clients' },
  { key: 'inquiry', label: 'inquiry',  plural: 'Inquiries' },
  { key: 'alumni',  label: 'alumnus',  plural: 'Alumni' },
];
let LIST_TAB = 'client';
function activeTab(): ListTab { return LIST_TABS.filter(t => t.key === LIST_TAB)[0] || LIST_TABS[0]; }
function listStore(key: string): Client[] | null {
  return key === 'inquiry' ? INQUIRY_STORE : key === 'alumni' ? ALUMNI_STORE : CLIENT_STORE;
}
function listLoading(key: string): boolean {
  return key === 'inquiry' ? INQUIRIES_LOADING : key === 'alumni' ? ALUMNI_LOADING : CLIENTS_LOADING;
}
function listError(key: string): string | null {
  return key === 'inquiry' ? INQUIRIES_ERROR : key === 'alumni' ? ALUMNI_ERROR : CLIENTS_ERROR;
}
// Kick off a load for a tab's store if it hasn't been fetched yet.
function ensureList(key: string): void {
  if (key === 'inquiry') { if (INQUIRY_STORE === null && !INQUIRIES_LOADING && !INQUIRIES_ERROR) loadInquiries(); }
  else if (key === 'alumni') { if (ALUMNI_STORE === null && !ALUMNI_LOADING && !ALUMNI_ERROR) loadAlumni(); }
  else { if (CLIENT_STORE === null && !CLIENTS_LOADING && !CLIENTS_ERROR) loadClients(); }
}
function setListTab(key: string): void {
  if (LIST_TAB === key) return;
  LIST_TAB = key;
  CLIENT_QUERY = '';
  if (typeof render === 'function') render();
}
function listTabBar(): string {
  return `<div class="tabs">` + LIST_TABS.map(t => {
    const store = listStore(t.key);
    const badge = store ? `<span class="tab-badge">${store.length}</span>` : '';
    return `<button class="tab${t.key === LIST_TAB ? ' active' : ''}" onclick="setListTab('${t.key}')">${esc(t.plural)}${badge}</button>`;
  }).join('') + `</div>`;
}

function clientsChrome(countLabel: string): string {
  const tab = activeTab();
  const action = `<button class="btn primary" onclick="openNewClient('${tab.key}')">${ic('plus', 15)} New ${esc(tab.label)}</button>`;
  return `
  ${crumb([{ t: orgLabel(), h: '#/dashboard' }, { t: tab.plural }])}
  ${pageHead('Clients', 'Everyone on your caseload — clients, inquiries, and alumni, live from the database.', action)}
  ${listTabBar()}
  <div class="toolbar">
    <div class="search">${ic('search', 15)}<input id="client-search" placeholder="Search ${esc(tab.plural.toLowerCase())}…" value="${esc(CLIENT_QUERY)}" oninput="clientOnSearch()" autocomplete="off"></div>
    <span class="count" id="client-count">${esc(countLabel)}</span>
    <div style="flex:1"></div>
  </div>`;
}

function clientsTable(list: Client[]): string {
  const rows = list.map(c => {
    const loc = [c.demo.city, c.demo.state].filter(Boolean).join(', ');
    const phone = c.cell || c.homePhone || '';
    const meta = c.prefName ? 'Goes by ' + esc(c.prefName) : '';
    return `<tr class="clickable" onclick="go('#/clients/' + encodeURIComponent('${c.id}'))">
      <td><div class="cell-name">${avatar(c.first, c.last, 36, 13, c.photoUrl)}<div><div class="nm">${esc(c.last)}, ${esc(c.first)}</div>${meta ? `<div class="meta">${meta}</div>` : ''}</div></div></td>
      <td>${loc ? esc(loc) : dash}</td>
      <td>${val(c.email)}</td>
      <td>${phone ? esc(phone) : dash}</td>
    </tr>`;
  }).join('');
  return `<div class="tbl-wrap"><table>
    <thead class="rich"><tr>
      <th><span class="th-sort">Client ${ic('sort', 13)}</span></th>
      <th><span class="th-sort">Location ${ic('sort', 13)}</span></th>
      <th><span class="th-sort">Email ${ic('sort', 13)}</span></th>
      <th><span class="th-sort">Phone ${ic('sort', 13)}</span></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <div class="pager"><span>Showing 1–${list.length} of ${list.length}</span>
    <div class="pg"><button>${ic('chevR', 14)}</button><button class="num">1</button><button>${ic('chevR', 14)}</button></div></div>`;
}

// Live search state (kept at module scope so it survives re-renders).
let CLIENT_QUERY = '';
// Records in the active tab matching the search box — spans name (last/first/
// preferred), location, email, and phones. Empty query → the whole list.
function clientsFiltered(): Client[] {
  const all = listStore(LIST_TAB) || [];
  const q = CLIENT_QUERY.toLowerCase().trim();
  if (!q) return all;
  return all.filter(c => {
    const hay = [c.last, c.first, c.prefName, c.demo.city, c.demo.state, c.email, c.cell, c.homePhone]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.indexOf(q) >= 0;
  });
}
function clientCountLabel(): string {
  const total = (listStore(LIST_TAB) || []).length;
  return clientsFiltered().length + ' of ' + total;
}
function clientsRegionInner(): string {
  const tab = activeTab();
  const total = (listStore(LIST_TAB) || []).length;
  const list = clientsFiltered();
  if (list.length) return clientsTable(list);
  if (total) return `<div class="card"><div class="empty"><div class="ico">${ic('search', 22)}</div><b>No matching ${esc(tab.plural.toLowerCase())}</b><p>Try a different name, location, email, or phone.</p></div></div>`;
  return `<div class="card"><div class="empty"><div class="ico">${ic('users', 22)}</div><b>No ${esc(tab.plural.toLowerCase())} yet</b><p>Create your first ${esc(tab.label)} to get started.</p><button class="btn primary" onclick="openNewClient('${tab.key}')">${ic('plus', 15)} New ${esc(tab.label)}</button></div></div>`;
}
// Re-render only the table region + count on each keystroke, so the search box
// keeps focus (the input lives outside #client-region).
function clientOnSearch(): void {
  const el = document.getElementById('client-search') as HTMLInputElement | null;
  CLIENT_QUERY = el ? el.value : '';
  const region = document.getElementById('client-region');
  if (region) region.innerHTML = clientsRegionInner();
  const cnt = document.getElementById('client-count');
  if (cnt) cnt.textContent = clientCountLabel();
}

function viewClients(): string {
  // Eagerly load all three stores so every tab shows a live count badge and
  // switching is instant.
  LIST_TABS.forEach(t => ensureList(t.key));
  const tab = activeTab();
  const store = listStore(LIST_TAB);
  const err = listError(LIST_TAB);
  if (store === null) {
    return shell('clients', clientsChrome('…') + (err ? errorCard(err) : loadingCard('Loading ' + tab.plural.toLowerCase() + '…')));
  }
  return shell('clients', clientsChrome(clientCountLabel()) + `<div id="client-region">${clientsRegionInner()}</div>`);
}

// ---- Program Directory (live, cross-org via the maestro proxy) ----
function programsError(err: string): string {
  return `<div class="card"><div class="empty"><div class="ico">${ic('alert', 22)}</div><b>Couldn't load the directory</b><p>${esc(err)}</p><button class="btn primary" onclick="loadPrograms(true)">${ic('clock', 15)} Retry</button></div></div>`;
}
// Coerce a program's field value to an array (facet dims are a mix of multi
// arrays and single strings — region/primaryFocus are single).
function asArr(v: any): string[] { return Array.isArray(v) ? v.filter(Boolean) : (v ? [String(v)] : []); }

// The multi-value facets shown as chip groups. `store` = the DirProgram key.
const PROG_FACETS: { key: string; store: keyof DirProgram; label: string }[] = [
  { key: 'setting', store: 'setting' as keyof DirProgram, label: 'Setting' },
  { key: 'levelOfCare', store: 'levelOfCare' as keyof DirProgram, label: 'Level of care' },
  { key: 'specialties', store: 'specialties' as keyof DirProgram, label: 'Specialties' },
  { key: 'modalities', store: 'modalities' as keyof DirProgram, label: 'Modalities' },
  { key: 'genderServed', store: 'genderServed' as keyof DirProgram, label: 'Gender served' },
  { key: 'region', store: 'region' as keyof DirProgram, label: 'Region' },
];
// Boolean quick-toggles.
const PROG_TOGGLES: { key: string; label: string }[] = [
  { key: 'insuranceAccepted', label: 'Takes insurance' },
  { key: 'bluestep', label: 'On BlueStep' },
  { key: 'verified', label: 'Verified only' },
];

// Distinct values present in the store for a facet's store key, sorted.
function progFacetValues(storeKey: keyof DirProgram): string[] {
  const set: { [k: string]: true } = {};
  for (const p of (PROGRAM_STORE || [])) for (const v of asArr((p as any)[storeKey])) set[v] = true;
  return Object.keys(set).sort();
}

// Count of active filters (for the Filters button badge + chip row visibility).
function progActiveCount(): number {
  let n = 0;
  for (const f of PROG_FACETS) n += (PROG_FILTER as any)[f.key].length;
  if (PROG_FILTER.state) n++;
  if (PROG_FILTER.age) n++;
  for (const t of PROG_TOGGLES) if ((PROG_FILTER as any)[t.key]) n++;
  return n;
}

// Human-readable one-liner of the active filters (for BlueIQ context + display).
function progFilterSummary(): string {
  const parts: string[] = [];
  for (const f of PROG_FACETS) { const sel: string[] = (PROG_FILTER as any)[f.key]; if (sel.length) parts.push(f.label + ': ' + sel.join(', ')); }
  if (PROG_FILTER.state) parts.push('Home state: ' + PROG_FILTER.state);
  if (PROG_FILTER.age) parts.push('Serves age ' + PROG_FILTER.age);
  for (const t of PROG_TOGGLES) if ((PROG_FILTER as any)[t.key]) parts.push(t.label);
  if (PROG_FILTER.q) parts.push('Search: "' + PROG_FILTER.q + '"');
  return parts.join(' · ') || 'none';
}

// Compact snapshot of the currently-filtered programs for BlueIQ, so it can
// reason over exactly the shortlist the consultant is looking at. Null when no
// filters are active (BlueIQ then behaves as "the whole directory"). Capped so
// the prompt stays bounded; count/total tell the model if it's truncated.
function progBiqPayload(): { active: boolean; summary: string; count: number; total: number; programs: any[] } | null {
  if (progActiveCount() === 0) return null;
  const all = progFiltered();
  const CAP = 60;
  const programs = all.slice(0, CAP).map(p => ({
    id: p.id, name: p.programName,
    state: (p as any).locationState || '', region: (p as any).region || '',
    setting: asArr((p as any).setting), levelOfCare: asArr((p as any).levelOfCare),
    specialties: asArr((p as any).specialties), modalities: asArr((p as any).modalities),
    ageMin: (p as any).ageMin ?? null, ageMax: (p as any).ageMax ?? null,
    costPerMonthUSD: (p as any).costPerMonthUSD ?? null,
    insuranceAccepted: (p as any).insuranceAccepted === true,
  }));
  return { active: true, summary: progFilterSummary(), count: all.length, total: (PROGRAM_STORE || []).length, programs };
}

function programsChrome(countLabel: string): string {
  const n = progActiveCount();
  const badge = n ? `<span class="flt-badge">${n}</span>` : '';
  return `${crumb([{ t: orgLabel(), h: '#/dashboard' }, { t: 'Programs' }])}
  ${pageHead('Program Directory', 'A shared library of treatment programs — searchable across levels of care, populations, and geography.', `<button class="btn outline" onclick="loadPrograms(true)">${ic('clock', 15)} Refresh</button>`)}
  <div class="toolbar">
    <div class="search">${ic('search', 15)}<input id="prog-search" placeholder="Search programs, locations, specialties…" value="${esc(PROG_FILTER.q)}" oninput="progOnSearch()"></div>
    <button class="btn outline prog-filters-btn${PROG_FILTER.panelOpen ? ' active' : ''}" id="prog-filters-btn" aria-expanded="${PROG_FILTER.panelOpen}" onclick="progTogglePanel()">${ic('filter', 15)} Filters${badge}</button>
    <div style="flex:1"></div>
    <span class="count" id="prog-count">${esc(countLabel)}</span>
  </div>
  <div id="prog-filter-panel" class="prog-filter-panel${PROG_FILTER.panelOpen ? ' open' : ''}">${progFilterPanelInner()}</div>
  <div id="prog-active-chips" class="prog-active-chips">${progActiveChipsInner()}</div>`;
}

// The expandable panel: a chip group per facet + a state select + a "serves age"
// input + boolean toggles + Clear all.
function progFilterPanelInner(): string {
  const groups = PROG_FACETS.map(f => {
    const sel: string[] = (PROG_FILTER as any)[f.key];
    const vals = progFacetValues(f.store);
    if (!vals.length) return '';
    const chips = vals.map(v => {
      const on = sel.indexOf(v) >= 0;
      return `<button class="facet-chip${on ? ' on' : ''}" onclick="progToggleFacet('${f.key}','${esc(v).replace(/'/g, "\\'")}')">${esc(v)}</button>`;
    }).join('');
    return `<div class="flt-group"><div class="flt-label">${esc(f.label)}</div><div class="flt-chips">${chips}</div></div>`;
  }).join('');

  const states = progFacetValues('locationState' as keyof DirProgram);
  const stateOpts = ['<option value="">Any state</option>']
    .concat(states.map(s => `<option value="${esc(s)}"${s === PROG_FILTER.state ? ' selected' : ''}>${esc(s)}</option>`)).join('');
  const toggles = PROG_TOGGLES.map(t => {
    const on = (PROG_FILTER as any)[t.key];
    return `<button class="facet-chip${on ? ' on' : ''}" onclick="progToggleFlag('${t.key}')">${esc(t.label)}</button>`;
  }).join('');

  return `${groups}
    <div class="flt-row">
      <div class="flt-group flt-inline"><div class="flt-label">Home state</div>
        <select class="prog-filter" onchange="progOnState(this.value)">${stateOpts}</select></div>
      <div class="flt-group flt-inline"><div class="flt-label">Serves age</div>
        <input class="prog-age-in" type="number" min="0" max="99" placeholder="e.g. 15" value="${esc(PROG_FILTER.age)}" oninput="progOnAge(this.value)"></div>
      <div class="flt-group flt-inline"><div class="flt-label">Quick filters</div><div class="flt-chips">${toggles}</div></div>
    </div>
    <div class="flt-foot"><button class="btn ghost sm" onclick="progClearFilters()">${ic('x', 14)} Clear all filters</button></div>`;
}

// Removable chips for every active filter, shown above the table.
function progActiveChipsInner(): string {
  const chips: string[] = [];
  for (const f of PROG_FACETS) for (const v of ((PROG_FILTER as any)[f.key] as string[])) {
    chips.push(`<button class="active-chip" onclick="progToggleFacet('${f.key}','${esc(v).replace(/'/g, "\\'")}')">${esc(v)} ${ic('x', 12)}</button>`);
  }
  if (PROG_FILTER.state) chips.push(`<button class="active-chip" onclick="progOnState('')">State: ${esc(PROG_FILTER.state)} ${ic('x', 12)}</button>`);
  if (PROG_FILTER.age) chips.push(`<button class="active-chip" onclick="progOnAge('')">Serves age ${esc(PROG_FILTER.age)} ${ic('x', 12)}</button>`);
  for (const t of PROG_TOGGLES) if ((PROG_FILTER as any)[t.key]) chips.push(`<button class="active-chip" onclick="progToggleFlag('${t.key}')">${esc(t.label)} ${ic('x', 12)}</button>`);
  if (!chips.length) return '';
  return chips.join('') + `<button class="active-chip clear" onclick="progClearFilters()">Clear all</button>`;
}
// Directory list state: search text, the two dropdown filters, and the current
// page. Kept at module scope so it survives full re-renders (navigate away/back).
const PROG_PAGE_SIZE = 50;
interface ProgFilter {
  q: string; page: number; panelOpen: boolean; state: string; age: string;
  setting: string[]; levelOfCare: string[]; specialties: string[]; modalities: string[];
  genderServed: string[]; region: string[];
  insuranceAccepted: boolean; bluestep: boolean; verified: boolean;
}
const PROG_FILTER: ProgFilter = {
  q: '', page: 1, panelOpen: false, state: '', age: '',
  setting: [], levelOfCare: [], specialties: [], modalities: [], genderServed: [], region: [],
  insuranceAccepted: false, bluestep: false, verified: false,
};

// Programs matching search + all active facets. Faceting is AND across dimensions,
// OR within a dimension (pick Trauma + Anxiety → programs with EITHER; combined
// with Setting=Residential → residential AND (trauma OR anxiety)). All client-side
// against the loaded store, so it's instant.
function progFiltered(): DirProgram[] {
  const q = PROG_FILTER.q.toLowerCase().trim();
  const age = PROG_FILTER.age ? Number(PROG_FILTER.age) : null;
  const out = (PROGRAM_STORE || []).filter(p => {
    for (const f of PROG_FACETS) {
      const sel: string[] = (PROG_FILTER as any)[f.key];
      if (sel.length) {
        const pv = asArr((p as any)[f.store]);
        if (!sel.some(v => pv.indexOf(v) >= 0)) return false;
      }
    }
    if (PROG_FILTER.state && (p as any).locationState !== PROG_FILTER.state) return false;
    if (age !== null && !isNaN(age)) {
      const lo = typeof (p as any).ageMin === 'number' ? (p as any).ageMin : null;
      const hi = typeof (p as any).ageMax === 'number' ? (p as any).ageMax : null;
      if (lo !== null && age < lo) return false;
      if (hi !== null && age > hi) return false;
      if (lo === null && hi === null) return false; // unknown age range → excluded when filtering by age
    }
    if (PROG_FILTER.insuranceAccepted && (p as any).insuranceAccepted !== true) return false;
    if (PROG_FILTER.bluestep && p.bluestepOrgRef !== true) return false;
    if (PROG_FILTER.verified && (p as any).verified !== true) return false;
    if (q) {
      const hay = [p.programName, p.location, p.populationsRaw, asArr((p as any).specialties).join(' '),
        asArr((p as any).setting).join(' '), asArr((p as any).levelOfCare).join(' '),
        asArr(p.programType).join(' '), asArr(p.states).join(' '), p.agesRaw].join(' ').toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });
  return out.sort((a, b) => a.programName.localeCompare(b.programName));
}

function progCountLabel(): string {
  const total = (PROGRAM_STORE || []).length;
  const filtered = progFiltered().length;
  return filtered === total ? total + ' programs' : filtered + ' of ' + total + ' programs';
}

function progRow(p: DirProgram): string {
  const types = (p.programType || []).join(', ');
  const bs = p.bluestepOrgRef ? `<span class="bs-dot" title="On BlueStep — referrals flow directly"></span>` : '';
  return `<tr class="prog-row" onclick="go('#/programs/' + encodeURIComponent('${p.id}'))">
    <td class="pt-name">${bs}${esc(p.programName)}</td>
    <td class="pt-loc" title="${esc(p.location || '')}">${esc(p.location || '—')}</td>
    <td class="pt-type" title="${esc(types)}">${esc(types || '—')}</td>
    <td class="pt-ages">${esc(p.agesRaw || '—')}</td>
  </tr>`;
}

// "start–end of total" + numbered pager. A single page shows just the info label.
function progPagerHtml(total: number): string {
  const pages = Math.max(1, Math.ceil(total / PROG_PAGE_SIZE));
  const page = Math.min(Math.max(1, PROG_FILTER.page), pages);
  const start = total ? (page - 1) * PROG_PAGE_SIZE + 1 : 0;
  const end = Math.min(total, page * PROG_PAGE_SIZE);
  const info = `<span class="pg-info">${total ? start + '–' + end : 0} of ${total}</span>`;
  if (pages <= 1) return info;
  let nums = '';
  for (let i = 1; i <= pages; i++) nums += `<button class="pg-num${i === page ? ' active' : ''}" onclick="progGoPage(${i})">${i}</button>`;
  const prev = `<button class="pg-btn"${page <= 1 ? ' disabled' : ''} onclick="progGoPage(${page - 1})">${ic('chevL', 14)}</button>`;
  const next = `<button class="pg-btn"${page >= pages ? ' disabled' : ''} onclick="progGoPage(${page + 1})">${ic('chevR', 14)}</button>`;
  return `${info}<span style="flex:1"></span>${prev}${nums}${next}`;
}

// The table card: sticky-ish header row, the current page's rows, and the pager.
// Clamps the page into range in case a filter shrank the result set.
function progTableHtml(): string {
  const all = progFiltered();
  const pages = Math.max(1, Math.ceil(all.length / PROG_PAGE_SIZE));
  if (PROG_FILTER.page > pages) PROG_FILTER.page = pages;
  if (PROG_FILTER.page < 1) PROG_FILTER.page = 1;
  const startIdx = (PROG_FILTER.page - 1) * PROG_PAGE_SIZE;
  const pageItems = all.slice(startIdx, startIdx + PROG_PAGE_SIZE);
  const rows = pageItems.length
    ? pageItems.map(progRow).join('')
    : `<tr><td colspan="4"><div class="empty" style="padding:34px 12px"><div class="ico">${ic('search', 22)}</div><b>No matching programs</b><p>Try a different search term or filter.</p></div></td></tr>`;
  return `<div class="card prog-table-card">
    <div class="prog-table-scroll"><table class="prog-table">
      <thead><tr><th>Program</th><th>Location</th><th>Type</th><th>Ages</th></tr></thead>
      <tbody id="prog-tbody">${rows}</tbody>
    </table></div>
    <div class="prog-pager" id="prog-pager">${progPagerHtml(all.length)}</div>
  </div>`;
}

// Re-render only the table region + count — leaves the toolbar/search box in the
// DOM so it keeps focus while the user types.
function renderProgramTable(): void {
  const region = document.getElementById('prog-table-region');
  if (region) region.innerHTML = progTableHtml();
  const cnt = document.getElementById('prog-count');
  if (cnt) cnt.textContent = progCountLabel();
}

function progOnSearch(): void {
  const el = document.getElementById('prog-search') as HTMLInputElement | null;
  PROG_FILTER.q = el ? el.value : '';
  PROG_FILTER.page = 1;
  renderProgramTable();
}

// Re-render everything a facet change touches — the panel (chip selected-state),
// the active-chip row, the Filters badge, the count, and the table — WITHOUT
// rebuilding the toolbar, so the search box keeps focus.
function renderProgramFilters(): void {
  PROG_FILTER.page = 1;
  const panel = document.getElementById('prog-filter-panel');
  if (panel) panel.innerHTML = progFilterPanelInner();
  const chips = document.getElementById('prog-active-chips');
  if (chips) chips.innerHTML = progActiveChipsInner();
  const btn = document.getElementById('prog-filters-btn');
  if (btn) {
    const n = progActiveCount();
    const base = `${ic('filter', 15)} Filters`;
    btn.innerHTML = base + (n ? `<span class="flt-badge">${n}</span>` : '');
  }
  renderProgramTable();
}

function progTogglePanel(): void {
  PROG_FILTER.panelOpen = !PROG_FILTER.panelOpen;
  const panel = document.getElementById('prog-filter-panel');
  const btn = document.getElementById('prog-filters-btn');
  if (panel) panel.classList.toggle('open', PROG_FILTER.panelOpen);
  if (btn) { btn.classList.toggle('active', PROG_FILTER.panelOpen); btn.setAttribute('aria-expanded', String(PROG_FILTER.panelOpen)); }
}
function progToggleFacet(dim: string, value: string): void {
  const arr: string[] = (PROG_FILTER as any)[dim];
  const i = arr.indexOf(value);
  if (i >= 0) arr.splice(i, 1); else arr.push(value);
  renderProgramFilters();
}
function progToggleFlag(key: string): void {
  (PROG_FILTER as any)[key] = !(PROG_FILTER as any)[key];
  renderProgramFilters();
}
function progOnState(v: string): void { PROG_FILTER.state = v; renderProgramFilters(); }
function progOnAge(v: string): void { PROG_FILTER.age = (v || '').trim(); renderProgramFilters(); }
function progClearFilters(): void {
  PROG_FILTER.state = ''; PROG_FILTER.age = '';
  for (const f of PROG_FACETS) (PROG_FILTER as any)[f.key] = [];
  for (const t of PROG_TOGGLES) (PROG_FILTER as any)[t.key] = false;
  renderProgramFilters();
}
function progGoPage(n: number): void {
  PROG_FILTER.page = n;
  renderProgramTable();
  const main = document.querySelector('.main');
  if (main) main.scrollTo(0, 0);
}

function viewPrograms(): string {
  if (PROGRAM_STORE === null) {
    if (!PROGRAMS_LOADING && !PROGRAMS_ERROR) loadPrograms();
    return shell('programs', programsChrome('…') + (PROGRAMS_ERROR ? programsError(PROGRAMS_ERROR) : loadingCard('Loading the directory…')));
  }
  const region = `<div id="prog-table-region">${progTableHtml()}</div>`;
  return shell('programs', programsChrome(progCountLabel()) + region);
}

// ---- Program detail (read-only profile) ----
function progSection(title: string, body?: string): string {
  if (!body || !body.trim()) return '';
  return `<div class="card card-pad prog-sec"><div class="sec-h">${esc(title)}</div><div class="sec-body">${esc(body)}</div></div>`;
}
// Program record view — mirrors the client record shell (icon rail + contextual
// sidebar with logo/name/section-nav + persistent header card + content). Sections:
// Summary (private rating+summary), Notes, Files, Program Details, Contacts.
const PROGRAM_SECTIONS: { key: string; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'notes', label: 'Notes' },
  { key: 'files', label: 'Files' },
  { key: 'details', label: 'Program Details' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'referrals', label: 'Referrals' },
];
function programSectionLabel(k: string): string {
  for (const s of PROGRAM_SECTIONS) if (s.key === k) return s.label;
  return k;
}
function progInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function viewProgram(id: string, section?: string): string {
  if (!PROGRAM_DETAIL[id]) {
    if (!PROGRAM_DETAIL_LOADING[id] && !PROGRAM_DETAIL_ERROR[id]) loadProgram(id);
    const back = `${crumb([{ t: orgLabel(), h: '#/dashboard' }, { t: 'Programs', h: '#/programs' }, { t: '…' }])}`;
    const body = PROGRAM_DETAIL_ERROR[id]
      ? `<div class="card"><div class="empty"><div class="ico">${ic('alert', 22)}</div><b>Couldn't load this program</b><p>${esc(PROGRAM_DETAIL_ERROR[id])}</p><button class="btn primary" onclick="loadProgram('${esc(id)}', true)">${ic('clock', 15)} Retry</button></div></div>`
      : loadingCard('Loading program…');
    return shell('programs', back + body);
  }
  const p = PROGRAM_DETAIL[id];
  const sec = section || 'summary';
  let content: string;
  if (sec === 'summary') content = summaryProgramSection(p);
  else if (sec === 'notes') content = notesProgramSection(p);
  else if (sec === 'files') content = programFilesSection(id);
  else if (sec === 'details') content = programDetailsSection(p);
  else if (sec === 'contacts') content = programContactsSection(p);
  else if (sec === 'referrals') content = programReferralsSection(id);
  else content = summaryProgramSection(p);
  return programShell(p, sec, content);
}

function programShell(p: DirProgram, active: string, content: string): string {
  const dpid = p.id;
  registerProgramHints(p);
  const logo = programLogoUrl(dpid);
  const typeLabel = (p.programType && p.programType[0]) || 'Program';

  const nav = PROGRAM_SECTIONS.map(s =>
    `<a href="#/programs/${encodeURIComponent(dpid)}/${s.key}" class="${active === s.key ? 'active' : ''}">${esc(s.label)}</a>`
  ).join('');

  const ctx = `<aside class="ctxbar">
    <div class="rec-head">
      <div class="rec-photo prog-logo" title="Upload a logo" onclick="programLogoUpload('${esc(dpid)}')">
        ${logo ? `<img src="${esc(logo)}" alt="${esc(p.programName)}">` : esc(progInitials(p.programName))}
        <span class="prog-logo-edit">${ic('edit', 12)}</span>
      </div>
      <div class="rec-name">${esc(p.programName)}</div>
      <div class="rec-sub">${esc(typeLabel)}</div>
      ${p.bluestepOrgRef ? '<div style="margin-top:8px"><span class="pill primary"><span class="dot"></span>BlueStep</span></div>' : ''}
    </div>
    <nav class="ctxnav">${nav}</nav>
  </aside>`;

  const tags = (p.programType || []).concat(p.ageBand || []).concat(p.genderServed || []).concat(p.states || []);
  const kv = (label: string, v?: string) => v && v.trim() ? `<div class="kv"><span class="k">${esc(label)}</span><span class="v">${esc(v)}</span></div>` : '';
  const links: string[] = [];
  if (p.website) links.push(`<a class="btn outline" href="${esc(p.website)}" target="_blank" rel="noopener">${ic('external', 14)} Website</a>`);
  const loc = [p.location, p.agesRaw ? 'Ages ' + p.agesRaw : ''].filter(Boolean).join(' · ');
  const recCard = `<div class="card rec-card">
    <div class="top"><h2>${esc(p.programName)}</h2></div>
    ${loc ? `<div class="rec-loc">${esc(loc)}</div>` : ''}
    ${tags.length ? `<div class="tags" style="margin:10px 0">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="kv-grid">
      ${kv('Admissions', p.admissionsContact)}
      ${kv('Insurance', p.insuranceRaw)}
      ${kv('Accreditation', p.accreditationRaw)}
    </div>
    ${links.length ? `<div class="prog-links">${links.join('')}</div>` : ''}
  </div>`;

  const main = `<main class="main"><div class="content">
    ${crumb([{ t: orgLabel(), h: '#/dashboard' }, { t: 'Programs', h: '#/programs' }, { t: p.programName, h: '#/programs/' + encodeURIComponent(dpid) }, { t: programSectionLabel(active) }])}
    ${recCard}
    ${content}
  </div></main>`;

  return topbar() + `<div class="body record-body">${sidebar('programs', true)}<div class="nav-scrim" onclick="closeNav()"></div>${ctx}${main}</div>`;
}

function programDetailsSection(p: DirProgram): string {
  const body = progSection('Overview', p.overview)
    + progSection('Clinical Model & Modalities', p.clinicalModel)
    + progSection('Levels of Care / Structure', p.levelsOfCare)
    + progSection('Academics', p.academics)
    + progSection('Family Involvement', p.familyInvolvement)
    + progSection('Admissions & Cost', p.admissionsCost)
    + progSection('Accreditation & Ownership', p.accreditationOwnership);
  const head = `<div class="section-head"><div><h3>Program Details</h3><p>From the shared directory profile.</p></div></div>`;
  return head + (body.trim()
    ? body
    : `<div class="card"><div class="empty"><div class="ico">${ic('report', 22)}</div><b>No additional details</b><p>The directory profile has no narrative sections for this program yet.</p></div></div>`);
}

function programContactsSection(p: DirProgram): string {
  const people = p.contacts && p.contacts.people ? p.contacts.people : [];
  const contactsCard = people.length ? `<div class="card card-pad prog-sec"><div class="sec-h">Key Contacts</div>
    <div class="pc-list">${people.map((c: any) => `<div class="pc"><div class="pc-n">${esc(c.name || '')}</div><div class="pc-t">${esc(c.title || '')}</div>${(c.phone || c.email) ? `<div class="pc-d">${[c.phone, c.email].filter(Boolean).map((x: string) => esc(x)).join(' · ')}</div>` : ''}</div>`).join('')}</div></div>` : '';
  const admis = (p.admissionsContact || '').trim();
  const admisCard = admis ? `<div class="card card-pad prog-sec"><div class="sec-h">Admissions</div><div class="sec-body">${esc(admis)}</div></div>` : '';
  const sources = (p.sources || '').trim();
  const sourcesCard = sources ? `<div class="card card-pad prog-sec"><div class="sec-h">Sources</div><div class="sec-body">${sources.split('\n').filter(Boolean).map(u => `<a href="${esc(u.trim())}" target="_blank" rel="noopener">${esc(u.trim())}</a>`).join('<br>')}</div></div>` : '';
  const head = `<div class="section-head"><div><h3>Contacts</h3><p>Admissions, key people, and sources from the directory.</p></div></div>`;
  const body = contactsCard + admisCard + sourcesCard;
  return head + (body.trim()
    ? body
    : `<div class="card"><div class="empty"><div class="ico">${ic('users', 22)}</div><b>No contacts on file</b><p>The directory profile lists no contacts for this program.</p></div></div>`);
}

// ── program Referrals tab: the other side of the client↔program relationship —
// every client the consultant has referred TO this program, with outcome + date.
function programReferralsSection(id: string): string {
  const head = `<div class="section-head"><div><h3>Referrals</h3><p>Clients you've referred to this program, and how they turned out.</p></div></div>`;
  if (PROGRAM_REFERRALS[id] === undefined) {
    if (!PROGRAM_REFERRALS_LOADING[id] && !PROGRAM_REFERRALS_ERROR[id]) loadProgramReferrals(id);
    if (PROGRAM_REFERRALS_ERROR[id]) {
      return head + `<div class="card"><div class="empty"><div class="ico">${ic('alert', 22)}</div><b>Couldn't load referrals</b><p>${esc(PROGRAM_REFERRALS_ERROR[id])}</p><button class="btn primary" onclick="loadProgramReferrals('${esc(id)}', true)">${ic('clock', 15)} Retry</button></div></div>`;
    }
    return head + loadingCard('Loading referrals…');
  }
  const list = PROGRAM_REFERRALS[id] || [];
  if (!list.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic('send', 22)}</div><b>No referrals yet</b><p>When you refer a client to this program — from a client's Referrals tab — it shows up here.</p></div></div>`;
  }
  const isAcc = (s: string) => s === 'Accepted' || s === 'Enrolled';
  const acc = list.filter(r => isAcc(r.status)).length;
  const dec = list.filter(r => REFERRAL_DECLINED_STATUSES.indexOf(r.status) >= 0).length;
  const stats = `<div class="rf-stats"><span><b>${list.length}</b> total</span><span class="rf-ok"><b>${acc}</b> accepted</span><span class="rf-no"><b>${dec}</b> declined</span></div>`;
  const rows = list.map(programReferralRow).join('');
  return head + stats + `<div class="rf-list">${rows}</div>`;
}

function programReferralRow(r: any): string {
  const name = (r.clientName || '').trim() || 'Client';
  const pill = r.status ? `<span class="rf-status ${referralStatusClass(r.status)}">${esc(r.status)}</span>` : '';
  const declined = REFERRAL_DECLINED_STATUSES.indexOf(r.status) >= 0;
  const decline = (declined && r.declineReason) ? `<div class="rf-decline">${ic('alert', 13)} Decline reason: <b>${esc(r.declineReason)}</b></div>` : '';
  const notes = (r.notes || '').trim() ? `<div class="rf-notes">${esc(r.notes)}</div>` : '';
  const foot = (r.date || r.referredBy) ? `<div class="rf-foot">${r.date ? esc(fmtDate(r.date)) : ''}${r.referredBy ? ' · by ' + esc(r.referredBy) : ''}</div>` : '';
  const to = r.clientId ? `#/clients/${encodeURIComponent(r.clientId)}` : '';
  const client = to ? `<a class="rf-client" href="${to}">${esc(name)}</a>` : `<span class="rf-client">${esc(name)}</span>`;
  return `<div class="card card-pad rf-card"><div class="rf-top">${client}${pill}</div>${decline}${notes}${foot}</div>`;
}

