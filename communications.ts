/* =====================================================================
   communications.ts — the Communications record section (multi-entry, live).

   A simple communication log: each entry is a logged call/email/text/meeting/
   note on the client's `communications` MEF, served by the maestro
   (listCommunications/addCommunication/updateCommunication/deleteCommunication).
   Each entry carries an `entryId` used to target edits/deletes. `loggedBy` and
   `loggedAt` are stamped server-side on add (the logged-in user + the instant);
   they're shown read-only in the entry footer. `contact` is free text whose
   suggestions come from the client's existing contacts (a datalist) — the typed
   or picked label is stored verbatim.

   Per the merge-report gotcha, injected controls use data-k, never `name`.
   ===================================================================== */

// The Type option list (must match the "Communication Type" option list labels
// exactly — the maestro setByName resolves the stored option by display name).
const COMM_TYPES = ['Call', 'Email', 'Text', 'In-person / Meeting', 'Video Call', 'Note'];

interface LiveComm {
  entryId: string;
  date: string; type: string; subject: string; notes: string; contact: string;
  loggedBy: string; loggedAt: string;
}

// Per-client communications cache so the section doesn't refetch on every render.
interface CommsState { list: LiveComm[] | null; loading: boolean; error: string | null; }
const COMMS_CACHE: { [clientId: string]: CommsState } = {};

function commsState(cid: string): CommsState {
  if (!COMMS_CACHE[cid]) COMMS_CACHE[cid] = { list: null, loading: false, error: null };
  return COMMS_CACHE[cid];
}

// Load (or reload) a client's communications, then re-render.
async function loadCommunications(cid: string, force = false): Promise<void> {
  const st = commsState(cid);
  if (st.loading) return;
  if (st.list && !force) return;
  st.loading = true; st.error = null;
  try {
    const rows = await apiListCommunications(cid);
    st.list = (Array.isArray(rows) ? rows : []).map(normalizeComm);
  } catch (e: any) {
    st.error = e && e.message ? e.message : String(e);
    st.list = null;
  } finally {
    st.loading = false;
    if (typeof render === 'function') render();
  }
}

function normalizeComm(r: any): LiveComm {
  return {
    entryId: String(r.entryId || ''),
    date: r.date || '', type: r.type || '', subject: r.subject || '',
    notes: r.notes || '', contact: r.contact || '',
    loggedBy: r.loggedBy || '', loggedAt: r.loggedAt || '',
  };
}

// loggedAt comes back as an ISO-8601 ZonedDateTime string; render it compactly.
function fmtCommStamp(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ── section view ─────────────────────────────────────────────────────────────
function communicationsSection(c: Client): string {
  const st = commsState(c.id);
  // The contact datalist in the modal is fed by the client's contacts — warm it.
  const cst = contactsState(c.id);
  if (cst.list === null && !cst.loading && !cst.error) loadContacts(c.id);

  const head = `<div class="section-head">
    <div><h3>Communications</h3><p>Calls, emails, texts, and notes logged for ${esc(c.first)}.</p></div>
    <div class="sec-actions">
      <button class="btn outline" onclick="openEmailComposer('${esc(c.id)}')">${ic('send', 15)} Send email</button>
      <button class="btn primary" onclick="openCommModal('${esc(c.id)}')">${ic('plus', 15)} Log communication</button>
    </div>
  </div>`;

  if (st.list === null) {
    if (!st.loading && !st.error) loadCommunications(c.id);
    const body = st.error
      ? `<div class="card"><div class="empty"><div class="ico">${ic('alert', 22)}</div><b>Couldn't load communications</b>
         <p>${esc(st.error)}</p><button class="btn primary" onclick="loadCommunications('${esc(c.id)}', true)">${ic('clock', 15)} Retry</button></div></div>`
      : `<div class="card"><div class="empty"><div class="ico">${ic('clock', 22)}</div><b>Loading communications…</b><p>Fetching from the record.</p></div></div>`;
    return head + body;
  }

  if (!st.list.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic('msg', 22)}</div>
      <b>No communications yet</b><p>Log a call, email, or note to start the history for this client.</p>
      <button class="btn primary" onclick="openCommModal('${esc(c.id)}')">${ic('plus', 15)} Log communication</button></div></div>`;
  }

  // Most recent first — by communication date, then by logged-at as a tiebreak.
  const sorted = st.list.slice().sort((a, b) => {
    const d = (b.date || '').localeCompare(a.date || '');
    return d !== 0 ? d : (b.loggedAt || '').localeCompare(a.loggedAt || '');
  });
  const rows = sorted.map(cm => commCard(c.id, cm)).join('');
  return head + `<div class="comm-list">${rows}</div>`;
}

// Notes memos hold rich text: email sends store HTML (<b>, <br>, links), while
// manually-logged notes come from a plain textarea. Render HTML as-is; escape
// plain text and turn its newlines into <br> so line breaks survive.
function renderCommNotes(notes: string): string {
  if (!notes) return '';
  const looksHtml = /<\/?(br|b|i|u|p|div|span|ul|ol|li|a|strong|em|h[1-6]|blockquote|table|tr|td)\b[^>]*>/i.test(notes);
  return looksHtml ? notes : esc(notes).replace(/\n/g, '<br>');
}

function commCard(cid: string, cm: LiveComm): string {
  const when = fmtDate(cm.date) || '—';
  const typeChip = cm.type ? `<span class="comm-type">${esc(cm.type)}</span>` : '';
  const subject = cm.subject ? esc(cm.subject) : '<span style="color:var(--muted-foreground)">(no subject)</span>';
  const meta = [
    cm.contact ? `${ic('users', 13)}<span>${esc(cm.contact)}</span>` : '',
  ].filter(Boolean).join('');
  const stamp = cm.loggedBy || cm.loggedAt
    ? `<div class="comm-foot">Logged${cm.loggedBy ? ' by ' + esc(cm.loggedBy) : ''}${cm.loggedAt ? ' · ' + esc(fmtCommStamp(cm.loggedAt)) : ''}</div>`
    : '';

  return `<div class="card comm-card">
    <div class="comm-top">
      <div class="comm-date">${ic('calendar', 14)}<span>${esc(when)}</span></div>
      ${typeChip}
      <span style="flex:1"></span>
      <div class="cc-acts">
        <button class="ico-mini" title="Edit" onclick="openCommModal('${esc(cid)}','${esc(cm.entryId)}')">${ic('edit', 15)}</button>
        <button class="ico-mini danger" title="Delete" onclick="deleteCommPrompt('${esc(cid)}','${esc(cm.entryId)}')">${ic('trash', 15)}</button>
      </div>
    </div>
    <div class="comm-subject">${subject}</div>
    ${cm.notes ? `<div class="comm-notes">${renderCommNotes(cm.notes)}</div>` : ''}
    ${meta ? `<div class="comm-meta">${meta}</div>` : ''}
    ${stamp}
  </div>`;
}

// ── add / edit modal ─────────────────────────────────────────────────────────
// The contact control is a free-text input backed by a <datalist> of the
// client's existing contacts — pick one or type anything; the value is stored
// verbatim (same "store the label" approach as the contacts relationship field).
function commContactControl(cid: string, current: string): string {
  const cst = contactsState(cid);
  const names = (cst.list || [])
    .map(ct => (ct.firstName + ' ' + ct.lastName).trim())
    .filter(Boolean);
  const opts = names.map(n => `<option value="${esc(n)}"></option>`).join('');
  return `<input type="text" data-k="contact" list="__commContacts" value="${esc(current || '')}"
    placeholder="Who was this with? (optional)" autocomplete="off">
    <datalist id="__commContacts">${opts}</datalist>`;
}

function commTypeControl(current: string): string {
  const choices = [''].concat(COMM_TYPES);
  return `<select data-k="type">${choices.map(o =>
    `<option value="${esc(o)}"${o === current ? ' selected' : ''}>${o ? esc(o) : '—'}</option>`).join('')}</select>`;
}

function todayISO(): string {
  const d = new Date();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function openCommModal(cid: string, entryId?: string): void {
  if (document.getElementById('__commModal')) closeCommModal();
  const st = commsState(cid);
  const cm = entryId && st.list ? (st.list.filter(x => x.entryId === entryId)[0] || null) : null;
  const editing = !!cm;
  const dateVal = cm ? cm.date : todayISO();

  const host = document.createElement('div');
  host.className = 'modal-overlay';
  host.id = '__commModal';
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="${editing ? 'Edit communication' : 'Log communication'}"
      data-cid="${esc(cid)}" data-entry="${esc(entryId || '')}">
    <div class="modal-head">
      <div><b>${editing ? 'Edit communication' : 'Log communication'}</b><p>${editing ? 'Update this log entry.' : 'Record a call, email, text, meeting, or note.'}</p></div>
      <button class="ico-x" title="Close" onclick="closeCommModal()">${ic('x', 18)}</button>
    </div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <div class="field-grid">
        <div class="field"><label>Date</label><input type="date" data-k="date" value="${esc(dateVal)}"></div>
        <div class="field"><label>Type</label>${commTypeControl(cm ? cm.type : '')}</div>
        <div class="field full"><label>Who was this with?</label>${commContactControl(cid, cm ? cm.contact : '')}</div>
        <div class="field full"><label>Subject</label><input type="text" data-k="subject" value="${esc(cm ? cm.subject : '')}" placeholder="Short summary" autocomplete="off"></div>
        <div class="field full"><label>Notes</label><textarea data-k="notes" rows="5" placeholder="What was discussed?">${esc(cm ? cm.notes : '')}</textarea></div>
      </div>
    </div>
    <div class="modal-foot">
      <span class="modal-status"></span>
      <span style="flex:1"></span>
      <button class="btn ghost" onclick="closeCommModal()">${ic('x', 15)} Cancel</button>
      <button class="btn primary js-save" onclick="saveCommunication()">${ic('save', 15)} ${editing ? 'Save changes' : 'Log it'}</button>
    </div>
  </div>`;
  host.addEventListener('mousedown', e => { if (e.target === host) closeCommModal(); });
  document.body.appendChild(host);
  const subj = host.querySelector('input[data-k="subject"]') as HTMLInputElement | null;
  if (subj) subj.focus();
  document.addEventListener('keydown', commEscClose);
}

function commEscClose(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  closeCommModal();
}

function closeCommModal(): void {
  const m = document.getElementById('__commModal');
  if (m) m.remove();
  document.removeEventListener('keydown', commEscClose);
}

function setCommModalError(msg: string): void {
  const el = document.querySelector('#__commModal .modal-err') as HTMLElement | null;
  if (!el) return;
  if (msg) { el.textContent = msg; el.hidden = false; } else { el.textContent = ''; el.hidden = true; }
}

async function saveCommunication(): Promise<void> {
  const modal = document.querySelector('#__commModal .modal-card') as HTMLElement | null;
  if (!modal) return;
  const cid = modal.getAttribute('data-cid') || '';
  const entryId = modal.getAttribute('data-entry') || '';
  if (!cid) { setCommModalError('Missing client id.'); return; }

  const fields: Record<string, any> = {};
  modal.querySelectorAll('[data-k]').forEach(el => {
    const k = (el as HTMLElement).dataset.k as string;
    fields[k] = (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value.trim();
  });

  setCommModalError('');
  if (!fields.subject && !fields.notes) { setCommModalError('Enter a subject or some notes.'); return; }

  const saveBtn = modal.querySelector('.js-save') as HTMLButtonElement | null;
  const status = modal.querySelector('.modal-status') as HTMLElement | null;
  if (saveBtn) saveBtn.disabled = true;
  if (status) status.textContent = 'Saving…';

  try {
    if (entryId) await apiUpdateCommunication(cid, entryId, fields);
    else await apiAddCommunication(cid, fields);
    closeCommModal();
    await loadCommunications(cid, true);
    toast(entryId ? 'Communication updated' : 'Communication logged');
  } catch (e: any) {
    if (saveBtn) saveBtn.disabled = false;
    if (status) status.textContent = '';
    setCommModalError(e && e.message ? e.message : String(e));
  }
}

async function deleteCommPrompt(cid: string, entryId: string): Promise<void> {
  if (!entryId) return;
  if (!window.confirm('Delete this communication? This can\'t be undone.')) return;
  try {
    await apiDeleteCommunication(cid, entryId);
    await loadCommunications(cid, true);
    toast('Communication deleted');
  } catch (e: any) {
    toast('Delete failed: ' + (e && e.message ? e.message : String(e)));
  }
}
