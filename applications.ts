/* =====================================================================
   applications.ts — the Parent Application record section (live).

   Each row is an entry on the client's `application` MEF (served by the
   maestro list/get/create/setApplicationStatus actions). "Send application"
   mints a new Open instance + a token-gated public link the family fills out
   on the satellite-site interpreter. When they submit, the ingester writes the
   answers back, flips status to Complete, and the row's "View results" opens
   the in-SPA reader (no separate report) — getApplication returns the rawdata.

   Lifecycle/status: Open (waiting) · Complete (submitted) · Closed (link
   manually expired). Reader vs list is a per-client view flag, like files.ts.
   ===================================================================== */

interface LiveApplication {
  entryId: string;
  status: string;            // Open | Complete | Closed
  token: string;
  url: string;               // token-gated public link ('' if interpreter URL unset)
  dateCreated: string;
  completedTimestamp: string;
  notes: string;
  hasData: boolean;
}

interface ApplicationsState {
  list: LiveApplication[] | null;
  loading: boolean;
  error: string | null;
  busy: boolean;             // create/status in flight
  openEntryId: string | null; // when set, the reader is showing this entry
}
const APPLICATIONS_CACHE: { [clientId: string]: ApplicationsState } = {};
// Reader data cache: parsed rawdata per entryId.
const APPLICATION_DATA: { [entryId: string]: { loading: boolean; error: string | null; data: any } } = {};

function applicationsState(cid: string): ApplicationsState {
  if (!APPLICATIONS_CACHE[cid]) APPLICATIONS_CACHE[cid] = { list: null, loading: false, error: null, busy: false, openEntryId: null };
  return APPLICATIONS_CACHE[cid];
}

async function loadApplications(cid: string, force = false): Promise<void> {
  const st = applicationsState(cid);
  if (st.loading) return;
  if (st.list && !force) return;
  st.loading = true; st.error = null;
  try {
    const rows = await apiListApplications(cid);
    st.list = (Array.isArray(rows) ? rows : []).map(normalizeApplication);
  } catch (e: any) {
    st.error = e && e.message ? e.message : String(e);
    st.list = null;
  } finally {
    st.loading = false;
    if (typeof render === 'function') render();
  }
}

function normalizeApplication(r: any): LiveApplication {
  return {
    entryId: String(r.entryId || ''),
    status: r.status || 'Open',
    token: r.token || '',
    url: r.url || '',
    dateCreated: r.dateCreated || '',
    completedTimestamp: r.completedTimestamp || '',
    notes: r.notes || '',
    hasData: r.hasData === true,
  };
}

function appStatusPill(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'complete') return `<span class="pill success"><span class="dot"></span>Complete</span>`;
  if (s === 'closed') return `<span class="pill muted"><span class="dot"></span>Closed</span>`;
  return `<span class="pill warning"><span class="dot"></span>Open</span>`;
}

// ── section view ─────────────────────────────────────────────────────────────
function applicationsSection(c: Client): string {
  const st = applicationsState(c.id);

  // Reader takes over the section when an entry is open.
  if (st.openEntryId) return applicationReaderView(c, st.openEntryId);

  const interpReady = !!appInterpreterUrl();
  const head = `<div class="section-head">
    <div><h3>Parent Application</h3><p>Send ${esc(c.first)}'s family the intake application and track its status.</p></div>
    <button class="btn primary" onclick="sendApplication('${esc(c.id)}')"${st.busy ? ' disabled' : ''}>${ic('send', 15)} Send application</button>
  </div>`;

  if (st.list === null) {
    if (!st.loading && !st.error) loadApplications(c.id);
    const body = st.error
      ? `<div class="card"><div class="empty"><div class="ico">${ic('alert', 22)}</div><b>Couldn't load applications</b>
         <p>${esc(st.error)}</p><button class="btn primary" onclick="loadApplications('${esc(c.id)}', true)">${ic('clock', 15)} Retry</button></div></div>`
      : `<div class="card"><div class="empty"><div class="ico">${ic('clock', 22)}</div><b>Loading applications…</b></div></div>`;
    return head + body;
  }

  const warn = interpReady ? '' :
    `<div class="card" style="border-color:var(--warning);margin-bottom:12px"><div style="padding:12px 16px;display:flex;gap:10px;align-items:center">
      ${ic('alert', 18)}<div style="flex:1;font-size:13px">No public interpreter URL is set, so application links won't work yet.
      <a href="#/settings/applications">Set it in Settings ▸ Applications</a>.</div></div></div>`;

  if (!st.list.length) {
    return head + warn + `<div class="card"><div class="empty"><div class="ico">${ic('file', 22)}</div>
      <b>No applications sent yet</b><p>Send the family a link to complete ${esc(c.first)}'s intake application.</p>
      <button class="btn primary" onclick="sendApplication('${esc(c.id)}')"${st.busy ? ' disabled' : ''}>${ic('send', 15)} Send application</button></div></div>`;
  }

  // Newest first by creation date.
  const sorted = st.list.slice().sort((a, b) => (b.dateCreated || '').localeCompare(a.dateCreated || ''));
  const rows = sorted.map(a => applicationRow(c.id, a)).join('');
  return head + warn + `<div class="app-list">${rows}</div>`;
}

function applicationRow(cid: string, a: LiveApplication): string {
  const created = a.dateCreated ? fmtDate(a.dateCreated) : '';
  const completed = a.completedTimestamp ? fmtStamp(a.completedTimestamp) : '';
  const meta: string[] = [];
  if (created) meta.push('Sent ' + created);
  if (a.status.toLowerCase() === 'complete' && completed) meta.push('Submitted ' + completed);
  if (a.notes) meta.push(esc(a.notes));

  const actions: string[] = [];
  if (a.hasData) actions.push(`<button class="btn outline sm" onclick="openApplication('${esc(cid)}','${esc(a.entryId)}')">${ic('eye', 14)} View results</button>`);
  if (a.url && a.status.toLowerCase() !== 'closed') {
    actions.push(`<button class="btn ghost sm" onclick="copyApplicationLink('${esc(a.url)}')">${ic('link', 14)} Copy link</button>`);
    actions.push(`<a class="btn ghost sm" href="${esc(a.url)}" target="_blank" rel="noopener">${ic('external', 14)} Open</a>`);
  }
  if (a.status.toLowerCase() === 'closed') {
    actions.push(`<button class="btn ghost sm" onclick="setApplicationState('${esc(cid)}','${esc(a.entryId)}','Open')">${ic('clock', 14)} Reopen</button>`);
  } else {
    actions.push(`<button class="btn ghost sm" onclick="setApplicationState('${esc(cid)}','${esc(a.entryId)}','Closed')">${ic('x', 14)} Close</button>`);
  }

  return `<div class="card app-row">
    <div class="app-row-main">
      <div class="app-row-status">${appStatusPill(a.status)}</div>
      <div class="app-row-body">
        <div class="app-row-title">Parent Application</div>
        <div class="app-row-meta">${meta.join(' · ') || 'Not sent yet'}</div>
      </div>
    </div>
    <div class="app-row-actions">${actions.join('')}</div>
  </div>`;
}

// ── send / status / link actions ─────────────────────────────────────────────
async function sendApplication(cid: string): Promise<void> {
  const st = applicationsState(cid);
  if (st.busy) return;
  st.busy = true;
  if (typeof render === 'function') render();
  try {
    const created = await apiCreateApplication(cid);
    // Optimistically prepend; reload to stay authoritative.
    if (st.list) st.list.unshift(normalizeApplication(created));
    const url = created && created.url ? String(created.url) : '';
    if (url) {
      copyApplicationLink(url);
      toast('Application created — link copied');
    } else {
      toast('Application created. Set the interpreter URL in Settings to generate a link.');
    }
  } catch (e: any) {
    toast('Could not create application: ' + (e && e.message ? e.message : String(e)));
  } finally {
    st.busy = false;
    loadApplications(cid, true);
  }
}

async function setApplicationState(cid: string, entryId: string, status: string): Promise<void> {
  const st = applicationsState(cid);
  if (st.busy) return;
  st.busy = true;
  if (typeof render === 'function') render();
  try {
    await apiSetApplicationStatus(cid, entryId, status);
    toast(status === 'Closed' ? 'Application closed' : 'Application reopened');
  } catch (e: any) {
    toast('Could not update status: ' + (e && e.message ? e.message : String(e)));
  } finally {
    st.busy = false;
    loadApplications(cid, true);
  }
}

function copyApplicationLink(url: string): void {
  if (!url) { toast('No link available yet'); return; }
  const nav: any = navigator;
  if (nav && nav.clipboard && nav.clipboard.writeText) {
    nav.clipboard.writeText(url).then(() => toast('Link copied'), () => fallbackCopy(url));
  } else {
    fallbackCopy(url);
  }
}
function fallbackCopy(text: string): void {
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Link copied');
  } catch (_e) { toast('Copy failed — select the link manually'); }
}

// ── reader (in-SPA, replaces the flagship's separate report) ──────────────────
function openApplication(cid: string, entryId: string): void {
  applicationsState(cid).openEntryId = entryId;
  if (!APPLICATION_DATA[entryId]) loadApplicationData(cid, entryId);
  if (typeof render === 'function') render();
}
function closeApplicationReader(cid: string): void {
  applicationsState(cid).openEntryId = null;
  if (typeof render === 'function') render();
}

async function loadApplicationData(cid: string, entryId: string): Promise<void> {
  if (APPLICATION_DATA[entryId] && APPLICATION_DATA[entryId].loading) return;
  APPLICATION_DATA[entryId] = { loading: true, error: null, data: null };
  try {
    const entry = await apiGetApplication(cid, entryId);
    APPLICATION_DATA[entryId] = { loading: false, error: null, data: (entry && entry.rawdata) || null };
  } catch (e: any) {
    APPLICATION_DATA[entryId] = { loading: false, error: e && e.message ? e.message : String(e), data: null };
  } finally {
    if (typeof render === 'function') render();
  }
}

function applicationReaderView(c: Client, entryId: string): string {
  const head = `<div class="section-head">
    <div><h3>Application results</h3><p>Submitted answers for ${esc(c.first)}'s parent application.</p></div>
    <button class="btn outline" onclick="closeApplicationReader('${esc(c.id)}')">${ic('chevR', 15)} Back to applications</button>
  </div>`;
  const slot = APPLICATION_DATA[entryId];
  if (!slot || slot.loading) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic('clock', 22)}</div><b>Loading answers…</b></div></div>`;
  }
  if (slot.error) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic('alert', 22)}</div><b>Couldn't load answers</b>
      <p>${esc(slot.error)}</p><button class="btn primary" onclick="loadApplicationData('${esc(c.id)}','${esc(entryId)}')">${ic('clock', 15)} Retry</button></div></div>`;
  }
  const data = slot.data;
  if (!data || !Array.isArray(data.answers) || !data.answers.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic('file', 22)}</div><b>No answers recorded</b>
      <p>This application doesn't have stored results.</p></div></div>`;
  }
  return head + applicationAnswersHtml(data);
}

// Render the stored submission readably: section headers break the list, each
// answered field shows label → value (multi-selects joined, blanks dashed).
function applicationAnswersHtml(data: any): string {
  const submitted = data.submittedAtUtc ? fmtStamp(data.submittedAtUtc) : '';
  const blocks: string[] = [];
  let openRows: string[] = [];
  let sectionTitle = '';

  const flush = () => {
    if (!openRows.length && !sectionTitle) return;
    blocks.push(`<div class="card sum-card app-read-card">
      ${sectionTitle ? `<div class="hd"><b>${esc(sectionTitle)}</b></div>` : ''}
      ${openRows.join('') || '<div class="app-read-empty">No questions in this section.</div>'}
    </div>`);
    openRows = [];
  };

  (data.answers as any[]).forEach(a => {
    if (!a || !a.type) return;
    if (a.type === 'header') { flush(); sectionTitle = a.label || 'Section'; return; }
    if (a.type === 'static_text') return; // instructions aren't answers
    const label = a.label || '(question)';
    const display = answerDisplay(a);
    openRows.push(`<div class="sum-row"><span class="k">${esc(label)}</span><span class="v">${display}</span></div>`);
  });
  flush();

  const headerCard = `<div class="card" style="margin-bottom:12px"><div style="padding:14px 18px">
    <b style="font-size:15px">${esc(data.templateTitle || 'Parent Application')}</b>
    ${submitted ? `<div style="font-size:12.5px;color:var(--muted-foreground);margin-top:2px">Submitted ${esc(submitted)}</div>` : ''}
  </div></div>`;

  return headerCard + blocks.join('');
}

function answerDisplay(a: any): string {
  const v = a.value;
  if (v == null || v === '') return dash;
  if (Array.isArray(v)) return v.length ? v.map(esc).join(', ') : dash;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (a.type === 'doc_upload') {
    // value carries the uploaded filename(s); the file itself lands in the
    // client's Files (Application Attachments).
    return esc(String(v)) + ` <span class="pill muted" style="margin-left:6px">in Files</span>`;
  }
  if (a.type === 'date') { const d = fmtDate(String(v)); return d ? esc(d) : esc(String(v)); }
  return esc(String(v));
}
