/* =====================================================================
   record.ts — the Client record detail screen.
   Route: #/clients/<id>[/<section>]  — the client's system id lives in the
   URL so the link is shareable and lands directly on the record.
   Shell mirrors the mockup: collapsed icon rail + contextual record sidebar
   (photo, name, sectioned nav) + persistent record header card.

   Sections fall in three buckets:
     • Summary            — read-only roll-up of the live record
     • Editable forms     — Name & Email · Demographics · Contact Info
                            (1:1 with the real BlueStep forms; see formedit.ts)
     • Under construction — everything with no backing form yet
   ===================================================================== */

interface RecordSection { key?: string; label?: string; standalone?: boolean; grp?: string; items?: { key: string; label: string }[]; }
const SECTIONS: RecordSection[] = [
  { key: 'summary', label: 'Summary', standalone: true },
  { key: 'files', label: 'Files', standalone: true },
  { grp: 'Profile', items: [
    { key: 'name', label: 'Name & Email' },
    { key: 'demographics', label: 'Demographics' },
    { key: 'contact', label: 'Contact Info' },
  ] },
  { grp: 'Casework', items: [
    { key: 'contacts', label: 'Contacts' },
    { key: 'application', label: 'Parent Application' },
    { key: 'communications', label: 'Communications' },
    { key: 'tasks', label: 'Tasks' },
  ] },
  { grp: 'Referrals', items: [{ key: 'referrals', label: 'Referrals' }] },
  { grp: 'Agreements', items: [{ key: 'agreements', label: 'Agreements' }] },
];

// Which sections are real, editable forms (route to editFormView).
const EDITABLE_SECTIONS = ['name', 'demographics', 'contact'];
// Sections backed by live data (no "soon" badge). Superset of the editable
// forms — also includes sections with their own bespoke UI (e.g. Contacts).
const LIVE_SECTIONS = EDITABLE_SECTIONS.concat(['contacts', 'application', 'communications', 'tasks', 'referrals', 'agreements']);

function sectionLabel(k: string): string {
  for (const s of SECTIONS) {
    if (s.standalone && s.key === k) return s.label as string;
    if (s.items) for (const i of s.items) if (i.key === k) return i.label;
  }
  return k;
}

// A record can be a Client, Inquiry, or Alumnus — all Individuals. Search every
// person store so any of them opens under the shared #/clients/<id> route.
function findClient(id: string): Client | undefined {
  const stores = [CLIENT_STORE, INQUIRY_STORE, ALUMNI_STORE];
  for (const s of stores) {
    const hit = (s || []).filter(c => c.id === id)[0];
    if (hit) return hit;
  }
  return undefined;
}

// ── lifecycle stage control (Inquiry → Client → Alumni) ──────────────────────
// The three stages are cumulative categories on one Individual record, so moving
// a person is just re-tagging a category — all their data carries forward. This
// renders a segmented control in the record header; clicking a different stage
// moves the record there and refreshes the lists.
const STAGE_DEFS: { key: string; label: string; noun: string }[] = [
  { key: 'inquiry', label: 'Inquiry', noun: 'Inquiry' },
  { key: 'client',  label: 'Client',  noun: 'Client' },
  { key: 'alumni',  label: 'Alumni',  noun: 'Alumnus' },
];
function stageNoun(entity?: string): string {
  const d = STAGE_DEFS.filter(s => s.key === (entity || 'client'))[0];
  return d ? d.noun : 'Client';
}
function stageControl(c: Client): string {
  const cur = c.entity || 'client';
  const steps = STAGE_DEFS.map(s => {
    const active = s.key === cur;
    return `<button type="button" class="stage-step${active ? ' active' : ''}"`
      + (active ? ' disabled aria-current="true"' : '')
      + ` onclick="moveStage('${esc(c.id)}','${s.key}')"`
      + ` title="${active ? 'Current stage' : 'Move to ' + s.label}">${esc(s.label)}</button>`;
  }).join('');
  return `<div class="stage-ctl" role="group" aria-label="Lifecycle stage">${steps}</div>`;
}

// Move a person to a different lifecycle stage, then reload every person store so
// tab membership + counts stay correct, and re-render. One-click and reversible
// (categories are additive/removable) — no confirmation needed.
async function moveStage(id: string, stage: string): Promise<void> {
  const c = findClient(id);
  if (!c) return;
  if ((c.entity || 'client') === stage) return;
  const name = (c.first + ' ' + c.last).trim() || 'Record';
  const noun = stageNoun(stage);
  try {
    const res = await apiSetStage(id, stage);
    const newStage = (res && res.stage) ? String(res.stage) : stage;
    await Promise.all([loadClients(true), loadInquiries(true), loadAlumni(true)]);
    if (typeof render === 'function') render();
    toast(name + ' moved to ' + stageNoun(newStage));
  } catch (e: any) {
    toast('Could not move ' + name + ': ' + ((e && e.message) ? e.message : String(e)));
  }
}

// ── record shell ─────────────────────────────────────────────────────────────
function recordShell(c: Client, activeSection: string, content: string): string {
  let nav = '';
  SECTIONS.forEach(s => {
    if (s.standalone) {
      nav += `<a href="#/clients/${c.id}/${s.key}" class="${activeSection === s.key ? 'active' : ''}">${s.label}</a>`;
    } else {
      nav += `<div class="grp">${esc(s.grp as string)}</div>`;
      (s.items as { key: string; label: string }[]).forEach(i => {
        const live = LIVE_SECTIONS.indexOf(i.key) >= 0;
        nav += `<a href="#/clients/${c.id}/${i.key}" class="${activeSection === i.key ? 'active' : ''}">${esc(i.label)}${live ? '' : '<span class="cnt soon">soon</span>'}</a>`;
      });
    }
  });

  const ctx = `<aside class="ctxbar">
    <div class="rec-head">
      <div class="rec-photo">${c.photoUrl ? `<img src="${esc(c.photoUrl)}" alt="${esc(c.first + ' ' + c.last)}">` : esc(initials(c.first, c.last))}</div>
      <div class="rec-name">${esc(c.last)}, ${esc(c.first)}</div>
      <div class="rec-sub">${val(c.gender) === dash ? stageNoun(c.entity) : esc(c.gender)}</div>
      <div style="margin-top:10px">${stageControl(c)}</div>
    </div>
    <nav class="ctxnav">${nav}</nav>
  </aside>`;

  const age = c.raw && c.raw.age ? String(c.raw.age) : (c.dob ? String(ageOf(c.dob)) : '');
  const loc = [c.demo.city, c.demo.state].filter(Boolean).join(', ');
  const recCard = `<div class="card rec-card">
    <div class="top"><h2>${esc(c.last)}, ${esc(c.first)}</h2></div>
    <div class="kv-grid">
      <div class="kv"><span class="k">Preferred name</span><span class="v">${val(c.prefName)}</span></div>
      <div class="kv"><span class="k">DOB</span><span class="v">${fmtDate(c.dob) || dash}</span></div>
      <div class="kv"><span class="k">Age</span><span class="v">${age || dash}</span></div>
      <div class="kv"><span class="k">Pronouns</span><span class="v">${val(c.demo.pronouns)}</span></div>
      <div class="kv"><span class="k">Email</span><span class="v">${val(c.email)}</span></div>
      <div class="kv"><span class="k">Cell</span><span class="v">${val(c.cell)}</span></div>
      <div class="kv"><span class="k">Location</span><span class="v">${loc || dash}</span></div>
      <div class="kv"><span class="k">Consultant</span><span class="v">${esc(ME.first + ' ' + ME.last)}</span></div>
    </div></div>`;

  const main = `<main class="main"><div class="content">
    ${crumb([{ t: orgLabel(), h: '#/dashboard' }, { t: 'Clients', h: '#/clients' }, { t: c.last + ', ' + c.first, h: '#/clients/' + c.id }, { t: sectionLabel(activeSection) }])}
    ${recCard}
    ${content}
  </div></main>`;

  return topbar() + `<div class="body record-body">${sidebar('clients', true)}<div class="nav-scrim" onclick="closeNav()"></div>${ctx}${main}</div>`;
}

// ── section: Summary (read-only roll-up of the three live forms) ─────────────
function summaryView(c: Client): string {
  const raw = c.raw || {};
  const loc = [c.demo.city, c.demo.state].filter(Boolean).join(', ');
  const race = Array.isArray(raw.race) && raw.race.length ? raw.race.map(esc).join(', ') : dash;
  return `
  <div class="section-head"><div><h3>Record Summary</h3><p>A read-only roll-up of ${esc(c.first)}'s live record. Use the form links to edit.</p></div>
    <button class="ico-mini danger" title="Delete client" aria-label="Delete client" onclick="confirmDeleteClient('${esc(c.id)}')">${ic('trash', 16)}</button></div>
  <div class="two-col">
    <div class="card sum-card">
      <div class="hd"><b>Name &amp; Email</b><a href="#/clients/${c.id}/name">Edit ${ic('chevR', 13)}</a></div>
      <div class="sum-row"><span class="k">Name</span><span class="v">${esc(c.last)}, ${esc(c.first)}</span></div>
      <div class="sum-row"><span class="k">Preferred name</span><span class="v">${val(c.prefName)}</span></div>
      <div class="sum-row"><span class="k">Email</span><span class="v">${val(c.email)}</span></div>
    </div>
    <div class="card sum-card">
      <div class="hd"><b>Demographics</b><a href="#/clients/${c.id}/demographics">Edit ${ic('chevR', 13)}</a></div>
      <div class="sum-row"><span class="k">Date of birth</span><span class="v">${fmtDate(c.dob) || dash}</span></div>
      <div class="sum-row"><span class="k">Gender identity</span><span class="v">${val(c.gender)}</span></div>
      <div class="sum-row"><span class="k">Pronouns</span><span class="v">${val(c.demo.pronouns)}</span></div>
      <div class="sum-row"><span class="k">Race</span><span class="v">${race}</span></div>
    </div>
    <div class="card sum-card">
      <div class="hd"><b>Contact Info</b><a href="#/clients/${c.id}/contact">Edit ${ic('chevR', 13)}</a></div>
      <div class="sum-row"><span class="k">Cell phone</span><span class="v">${val(c.cell)}</span></div>
      <div class="sum-row"><span class="k">Home phone</span><span class="v">${val(c.homePhone)}</span></div>
      <div class="sum-row"><span class="k">Location</span><span class="v">${loc || dash}</span></div>
      <div class="sum-row"><span class="k">Home ZIP</span><span class="v">${val(c.homeZip)}</span></div>
    </div>
  </div>`;
}

// ── delete client: hard confirmation modal ───────────────────────────────────
function confirmDeleteClient(id: string): void {
  const c = findClient(id);
  if (!c || document.getElementById('__delClientModal')) return;
  const fullName = (c.first + ' ' + c.last).trim();
  const host = document.createElement('div');
  host.className = 'modal-overlay';
  host.id = '__delClientModal';
  host.innerHTML = `<div class="modal-card danger-modal" role="dialog" aria-modal="true" aria-label="Delete client">
    <div class="modal-head">
      <div><b>${ic('alert', 18)} Delete ${esc(fullName)}?</b><p>This permanently deletes the entire client record.</p></div>
      <button class="ico-x js-cancel" title="Close" onclick="closeDeleteClient()">${ic('x', 18)}</button>
    </div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <div class="dz-warn">
        <p><b>This cannot be undone.</b> Deleting ${esc(fullName)} also removes all of their contacts, files, communications, tasks, and applications.</p>
        <p class="dz-confirm-label">Type <b>DELETE</b> below to confirm.</p>
        <input class="dz-confirm-input" data-k="confirm" placeholder="DELETE" autocomplete="off" oninput="delClientConfirmChanged()">
      </div>
    </div>
    <div class="modal-foot">
      <span class="modal-status"></span>
      <span style="flex:1"></span>
      <button class="btn ghost js-cancel" onclick="closeDeleteClient()">${ic('x', 15)} Cancel</button>
      <button class="btn danger js-del" disabled onclick="submitDeleteClient('${esc(id)}')">${ic('trash', 15)} Delete client</button>
    </div>
  </div>`;
  host.addEventListener('mousedown', e => { if (e.target === host) closeDeleteClient(); });
  document.body.appendChild(host);
  const inp = host.querySelector('.dz-confirm-input') as HTMLInputElement | null;
  if (inp) inp.focus();
  document.addEventListener('keydown', delClientEsc);
}

function delClientEsc(e: KeyboardEvent): void { if (e.key === 'Escape') closeDeleteClient(); }

function closeDeleteClient(): void {
  const m = document.getElementById('__delClientModal');
  if (m) m.remove();
  document.removeEventListener('keydown', delClientEsc);
}

// Enable the Delete button only when the user has typed the exact word DELETE.
function delClientConfirmChanged(): void {
  const modal = document.getElementById('__delClientModal');
  if (!modal) return;
  const inp = modal.querySelector('.dz-confirm-input') as HTMLInputElement | null;
  const btn = modal.querySelector('.js-del') as HTMLButtonElement | null;
  if (!inp || !btn) return;
  btn.disabled = inp.value.trim().toUpperCase() !== 'DELETE';
}

async function submitDeleteClient(id: string): Promise<void> {
  const modal = document.getElementById('__delClientModal');
  if (!modal) return;
  const c = findClient(id);
  const fullName = c ? (c.first + ' ' + c.last).trim() : 'Client';
  const btn = modal.querySelector('.js-del') as HTMLButtonElement | null;
  const cancel = modal.querySelector('.js-cancel') as HTMLButtonElement | null;
  const status = modal.querySelector('.modal-status') as HTMLElement | null;
  const err = modal.querySelector('.modal-err') as HTMLElement | null;
  if (err) { err.textContent = ''; err.hidden = true; }
  if (btn) btn.disabled = true;
  if (cancel) cancel.setAttribute('disabled', 'true');
  if (status) status.textContent = 'Deleting…';
  try {
    await apiDeleteClient(id);
    closeDeleteClient();
    await loadClients(true); // re-pull the live list so the record disappears
    go('#/clients');
    toast('Client deleted — ' + fullName);
  } catch (e: any) {
    if (btn) btn.disabled = false;
    if (cancel) cancel.removeAttribute('disabled');
    if (status) status.textContent = '';
    if (err) { err.textContent = (e && e.message) ? e.message : String(e); err.hidden = false; }
  }
}

// ── dispatcher ───────────────────────────────────────────────────────────────
function viewClient(id: string, section?: string): string {
  // The record may live in any of the three person stores; ensure all are loading.
  ensureList('client'); ensureList('inquiry'); ensureList('alumni');
  const c = findClient(id);
  if (!c) {
    // Still waiting on one or more stores → show a loader, not "not found".
    const stillLoading = CLIENT_STORE === null || INQUIRY_STORE === null || ALUMNI_STORE === null
      || CLIENTS_LOADING || INQUIRIES_LOADING || ALUMNI_LOADING;
    if (stillLoading && !(CLIENTS_ERROR && INQUIRIES_ERROR && ALUMNI_ERROR)) {
      return shell('clients', loadingCard('Loading record…'));
    }
  }
  if (!c) {
    return shell('clients', `${crumb([{ t: orgLabel(), h: '#/dashboard' }, { t: 'Clients', h: '#/clients' }, { t: 'Not found' }])}
      <div class="card"><div class="empty"><div class="ico">${ic('users', 22)}</div><b>Client not found</b>
      <p>No client matches this link. It may have been removed.</p>
      <a class="btn primary" href="#/clients">${ic('chevR', 15)} Back to Clients</a></div></div>`);
  }

  const sec = section || 'summary';
  let content: string;
  if (sec === 'summary') content = summaryView(c);
  else if (EDITABLE_SECTIONS.indexOf(sec) >= 0) content = editFormView(c, sec);
  else if (sec === 'files') content = filesSection(c);
  else if (sec === 'contacts') content = contactsSection(c);
  else if (sec === 'application') content = applicationsSection(c);
  else if (sec === 'communications') content = communicationsSection(c);
  else if (sec === 'tasks') content = tasksSection(c);
  else if (sec === 'referrals') content = referralsSection(c);
  else if (sec === 'agreements') content = agreementsSection(c);
  else content = underConstruction(sectionLabel(sec), '');

  return recordShell(c, sec, content);
}
