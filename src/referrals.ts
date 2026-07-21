/* =====================================================================
   referrals.ts — the Referrals record section (multi-entry, live).

   A per-client program-referral timeline on the client's `referrals` MEF,
   served by the maestro (listReferrals/addReferral/updateReferral/deleteReferral).
   Each entry references a directory program by programId (FK) + programName
   (snapshot, so the list needs no cross-org fetch). status + declineReason
   capture the accept/deny outcome; createdBy/createdAt are stamped server-side.

   The add/edit modal's program picker is a lightweight combobox over the cached
   directory program list (PROGRAM_STORE, loaded via loadPrograms()).

   Injected controls use data-k, never `name` (merge-report gotcha).
   ===================================================================== */

// MUST match the option-list labels on the referrals form (setByName resolves by
// display name).
const REFERRAL_STATUSES = ['Considering', 'Pre-screening', 'Referred', 'Application Sent', 'Accepted', 'Declined', 'Family Declined', 'Waitlisted', 'Enrolled'];
const REFERRAL_DECLINE_REASONS = ['Clinical fit', 'Acuity too high', 'No bed availability', 'Insurance not accepted', 'Age or gender not served', 'Cost', 'Family declined', 'Other'];
// Statuses that represent a decline outcome → the decline-reason field applies.
const REFERRAL_DECLINED_STATUSES = ['Declined', 'Family Declined'];

interface LiveReferral {
  entryId: string;
  programName: string; programId: string; status: string;
  declineReason: string; notes: string;
  createdBy: string; createdAt: string;
}

interface ReferralsState { list: LiveReferral[] | null; loading: boolean; error: string | null; }
const REFERRALS_CACHE: { [clientId: string]: ReferralsState } = {};

function referralsState(cid: string): ReferralsState {
  if (!REFERRALS_CACHE[cid]) REFERRALS_CACHE[cid] = { list: null, loading: false, error: null };
  return REFERRALS_CACHE[cid];
}

async function loadReferrals(cid: string, force = false): Promise<void> {
  const st = referralsState(cid);
  if (st.loading) return;
  if (st.list && !force) return;
  st.loading = true; st.error = null;
  try {
    const rows = await apiListReferrals(cid);
    st.list = (Array.isArray(rows) ? rows : []).map(normalizeReferral);
  } catch (e: any) {
    st.error = e && e.message ? e.message : String(e);
    st.list = null;
  } finally {
    st.loading = false;
    if (typeof render === 'function') render();
  }
}

function normalizeReferral(r: any): LiveReferral {
  return {
    entryId: String(r.entryId || ''),
    programName: r.programName || '', programId: r.programId || '', status: r.status || '',
    declineReason: r.declineReason || '', notes: r.notes || '',
    createdBy: r.createdBy || '', createdAt: r.createdAt || '',
  };
}

function referralStatusClass(status: string): string {
  if (status === 'Accepted' || status === 'Enrolled') return 'rf-ok';
  if (REFERRAL_DECLINED_STATUSES.indexOf(status) >= 0) return 'rf-no';
  if (status === 'Referred' || status === 'Application Sent' || status === 'Waitlisted') return 'rf-active';
  return 'rf-neutral';
}

// ── section view ─────────────────────────────────────────────────────────────
function referralsSection(c: Client): string {
  const st = referralsState(c.id);
  const head = `<div class="section-head">
    <div><h3>Referrals</h3><p>Programs ${esc(c.first)} has been referred to, and how they turned out.</p></div>
    <button class="btn primary" onclick="openReferralModal('${esc(c.id)}')">${ic('plus', 15)} Add referral</button>
  </div>`;

  if (st.list === null) {
    if (!st.loading && !st.error) loadReferrals(c.id);
    const body = st.error
      ? `<div class="card"><div class="empty"><div class="ico">${ic('alert', 22)}</div><b>Couldn't load referrals</b>
         <p>${esc(st.error)}</p><button class="btn primary" onclick="loadReferrals('${esc(c.id)}', true)">${ic('clock', 15)} Retry</button></div></div>`
      : `<div class="card"><div class="empty"><div class="ico">${ic('clock', 22)}</div><b>Loading referrals…</b></div></div>`;
    return head + body;
  }

  if (!st.list.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic('report', 22)}</div>
      <b>No referrals yet</b><p>Track which programs you've referred ${esc(c.first)} to, and whether they accepted.</p>
      <button class="btn primary" onclick="openReferralModal('${esc(c.id)}')">${ic('plus', 15)} Add referral</button></div></div>`;
  }

  // Sort: most recently added first.
  const list = st.list.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const cards = list.map(r => referralCard(c.id, r)).join('');
  return head + `<div class="rf-list">${cards}</div>`;
}

function referralCard(cid: string, r: LiveReferral): string {
  const declined = REFERRAL_DECLINED_STATUSES.indexOf(r.status) >= 0;
  const pill = r.status ? `<span class="rf-status ${referralStatusClass(r.status)}">${esc(r.status)}</span>` : '';
  const declineHtml = (declined && r.declineReason)
    ? `<div class="rf-decline">${ic('alert', 13)} Decline reason: <b>${esc(r.declineReason)}</b></div>` : '';
  const notesHtml = r.notes ? `<div class="rf-block">${esc(r.notes)}</div>` : '';
  const foot = (r.createdBy || r.createdAt)
    ? `<div class="rf-foot">Added${r.createdBy ? ' by ' + esc(r.createdBy) : ''}${r.createdAt ? ' · ' + esc(fmtDate(r.createdAt)) : ''}</div>` : '';

  return `<div class="card rf-card">
    <div class="rf-top">
      <div class="rf-prog">${ic('folder', 15)} <b>${esc(r.programName) || '<span style="color:var(--muted-foreground)">(no program)</span>'}</b></div>
      ${pill}
      <span style="flex:1"></span>
      <div class="cc-acts">
        <button class="ico-mini" title="Edit" onclick="openReferralModal('${esc(cid)}','${esc(r.entryId)}')">${ic('edit', 15)}</button>
        <button class="ico-mini danger" title="Delete" onclick="deleteReferralPrompt('${esc(cid)}','${esc(r.entryId)}')">${ic('trash', 15)}</button>
      </div>
    </div>
    ${declineHtml}
    ${notesHtml}
    ${foot}
  </div>`;
}

// ── add / edit modal ─────────────────────────────────────────────────────────
function referralSelectControl(dataK: string, choices: string[], current: string, placeholder: string, extra = ''): string {
  const opts = [`<option value="">${esc(placeholder)}</option>`]
    .concat(choices.map(o => `<option value="${esc(o)}"${o === current ? ' selected' : ''}>${esc(o)}</option>`))
    .join('');
  return `<select data-k="${dataK}"${extra}>${opts}</select>`;
}

function openReferralModal(cid: string, entryId?: string): void {
  if (document.getElementById('__referralModal')) closeReferralModal();
  // Settings drives the decline-reason dropdown — make sure it's loaded.
  if (!SETTINGS && !SETTINGS_LOADING) loadSettings();
  const st = referralsState(cid);
  const r = entryId && st.list ? (st.list.filter(x => x.entryId === entryId)[0] || null) : null;
  const editing = !!r;
  loadPrograms(); // ensure the picker has data (no-op if already loaded)

  const declineShown = r && REFERRAL_DECLINED_STATUSES.indexOf(r.status) >= 0;

  const host = document.createElement('div');
  host.className = 'modal-overlay';
  host.id = '__referralModal';
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="${editing ? 'Edit referral' : 'Add referral'}"
      data-cid="${esc(cid)}" data-entry="${esc(entryId || '')}">
    <div class="modal-head">
      <div><b>${editing ? 'Edit referral' : 'Add referral'}</b><p>${editing ? 'Update this program referral.' : 'Record a program you referred this client to.'}</p></div>
      <button class="ico-x" title="Close" onclick="closeReferralModal()">${ic('x', 18)}</button>
    </div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <div class="field-grid">
        <div class="field full">
          <label>Program</label>
          <div class="rf-combo">
            <input type="text" data-k="programName" id="__rfProgInput" value="${esc(r ? r.programName : '')}"
                   placeholder="Search programs…" autocomplete="off"
                   oninput="referralProgFilter(this.value)">
            <input type="hidden" data-k="programId" id="__rfProgId" value="${esc(r ? r.programId : '')}">
            <div class="rf-combo-list" id="__rfProgList" hidden></div>
          </div>
        </div>
        <div class="field"><label>Status</label>${referralSelectControl('status', REFERRAL_STATUSES, r ? r.status : 'Considering', '—', ' onchange="referralStatusChanged(this.value)"')}</div>
        <div class="field full" id="__rfDeclineWrap"${declineShown ? '' : ' hidden'}><label>Decline reason</label>${referralSelectControl('declineReason', declineReasonOptions(), r ? r.declineReason : '', '—')}</div>
        <div class="field full"><label>Notes</label><textarea data-k="notes" rows="5" placeholder="Notes about this referral (optional)">${esc(r ? r.notes : '')}</textarea></div>
      </div>
    </div>
    <div class="modal-foot">
      <span class="modal-status"></span>
      <span style="flex:1"></span>
      <button class="btn ghost" onclick="closeReferralModal()">${ic('x', 15)} Cancel</button>
      <button class="btn primary js-save" onclick="saveReferral()">${ic('save', 15)} ${editing ? 'Save changes' : 'Add referral'}</button>
    </div>
  </div>`;
  host.addEventListener('mousedown', e => { if (e.target === host) closeReferralModal(); });
  document.body.appendChild(host);
  const inp = host.querySelector('#__rfProgInput') as HTMLInputElement | null;
  if (inp && !editing) inp.focus();
  document.addEventListener('keydown', referralEscClose);
}

function referralEscClose(e: KeyboardEvent): void { if (e.key === 'Escape') closeReferralModal(); }
function closeReferralModal(): void {
  const m = document.getElementById('__referralModal');
  if (m) m.remove();
  document.removeEventListener('keydown', referralEscClose);
}
function setReferralModalError(msg: string): void {
  const el = document.querySelector('#__referralModal .modal-err') as HTMLElement | null;
  if (!el) return;
  if (msg) { el.textContent = msg; el.hidden = false; } else { el.textContent = ''; el.hidden = true; }
}

// Toggle the decline-reason field based on the chosen status.
function referralStatusChanged(status: string): void {
  const wrap = document.getElementById('__rfDeclineWrap');
  if (wrap) wrap.hidden = REFERRAL_DECLINED_STATUSES.indexOf(status) < 0;
}

// Program picker: filter the cached directory list and render clickable matches.
function referralProgFilter(q: string): void {
  const list = document.getElementById('__rfProgList');
  if (!list) return;
  const term = (q || '').trim().toLowerCase();
  // Nothing shows until the user actually types.
  if (!term) { list.hidden = true; list.innerHTML = ''; return; }
  if (PROGRAMS_LOADING && !PROGRAM_STORE) {
    list.innerHTML = `<div class="rf-combo-item muted">Loading programs…</div>`;
    list.hidden = false; return;
  }
  const matches = (PROGRAM_STORE || [])
    .filter(p => (p.programName || '').toLowerCase().indexOf(term) >= 0)
    .slice(0, 40);
  if (!matches.length) {
    list.innerHTML = `<div class="rf-combo-item muted">No matching programs</div>`;
    list.hidden = false; return;
  }
  // Name only — no location or other metadata.
  list.innerHTML = matches.map(p =>
    `<div class="rf-combo-item" onmousedown="referralProgPick('${esc(p.id)}', ${JSON.stringify(p.programName || '').replace(/"/g, '&quot;')})">${esc(p.programName || '(unnamed)')}</div>`
  ).join('');
  list.hidden = false;
}

function referralProgPick(id: string, name: string): void {
  const inp = document.getElementById('__rfProgInput') as HTMLInputElement | null;
  const idEl = document.getElementById('__rfProgId') as HTMLInputElement | null;
  const list = document.getElementById('__rfProgList');
  if (inp) inp.value = name;
  if (idEl) idEl.value = id;
  if (list) { list.hidden = true; list.innerHTML = ''; }
}

async function saveReferral(): Promise<void> {
  const modal = document.querySelector('#__referralModal .modal-card') as HTMLElement | null;
  if (!modal) return;
  const cid = modal.getAttribute('data-cid') || '';
  const entryId = modal.getAttribute('data-entry') || '';
  if (!cid) { setReferralModalError('Missing client id.'); return; }

  const fields: Record<string, any> = {};
  modal.querySelectorAll('[data-k]').forEach(el => {
    const k = (el as HTMLElement).dataset.k as string;
    fields[k] = (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value.trim();
  });

  setReferralModalError('');
  if (!fields.programName) { setReferralModalError('Pick a program (type to search).'); return; }
  // Clear a stale decline reason if the status isn't a decline outcome.
  if (REFERRAL_DECLINED_STATUSES.indexOf(fields.status) < 0) fields.declineReason = '';

  const saveBtn = modal.querySelector('.js-save') as HTMLButtonElement | null;
  const status = modal.querySelector('.modal-status') as HTMLElement | null;
  if (saveBtn) saveBtn.disabled = true;
  if (status) status.textContent = 'Saving…';

  try {
    if (entryId) await apiUpdateReferral(cid, entryId, fields);
    else await apiAddReferral(cid, fields);
    closeReferralModal();
    await loadReferrals(cid, true);
    toast(entryId ? 'Referral updated' : 'Referral added');
  } catch (e: any) {
    if (saveBtn) saveBtn.disabled = false;
    if (status) status.textContent = '';
    setReferralModalError(e && e.message ? e.message : String(e));
  }
}

async function deleteReferralPrompt(cid: string, entryId: string): Promise<void> {
  if (!entryId) return;
  if (!window.confirm('Delete this referral? This can\'t be undone.')) return;
  try {
    await apiDeleteReferral(cid, entryId);
    await loadReferrals(cid, true);
    toast('Referral deleted');
  } catch (e: any) {
    toast('Delete failed: ' + (e && e.message ? e.message : String(e)));
  }
}
