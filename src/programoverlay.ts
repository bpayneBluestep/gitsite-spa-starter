/* =====================================================================
   programoverlay.ts — Program Overlay (Directory Layer 2).

   Consultant-PRIVATE data on a directory program, rendered on the program
   detail page (#/programs/<id>): a 1–5 star rating, a private summary, and
   timestamped notes (with a Tour type that reveals tour date + format).

   The directory program lives in a SEPARATE org and is read-only here; the
   private data lives in a LOCAL overlay record that the maestro find-or-creates
   LAZILY on the first write (rating / summary / note). The SPA only ever holds
   the DIRECTORY program id — it passes display "hints" so a first write can seed
   the new overlay without a cross-org fetch.

   Files reuse the shared Files section (Phase C2). Injected controls use
   data-k, never `name` (merge-report gotcha). See BUILD-STATE §20.
   ===================================================================== */

const PROGRAM_NOTE_TYPES = ['General', 'Tour', 'Call', 'Concern', 'Update'];
const TOUR_FORMATS = ['In-person', 'Virtual'];

interface ProgramNote {
  entryId: string; body: string; noteType: string; tourDate: string; tourFormat: string;
  createdBy: string; createdAt: string;
}
interface ProgramOverlayData {
  id: string; internalRating: string; privateSummary: string;
  cachedName: string; directorySlug: string; logo?: string;
}
interface POState {
  overlay: ProgramOverlayData | null | undefined; // undefined = unloaded, null = none yet
  notes: ProgramNote[] | null;
  ovLoading: boolean; notesLoading: boolean; error: string | null;
  saving?: boolean;           // a rating/summary write is in flight (may be a first-time create)
  pendingRating?: number;     // optimistic star fill while saving
}
const PO_CACHE: { [dpid: string]: POState } = {};
function poState(dpid: string): POState {
  if (!PO_CACHE[dpid]) PO_CACHE[dpid] = { overlay: undefined, notes: null, ovLoading: false, notesLoading: false, error: null };
  return PO_CACHE[dpid];
}
function poHints(p: DirProgram): ProgramHints {
  return {
    directorySlug: p.aktProfile || p.website || '',
    cachedName: p.programName || '',
    cachedLocation: p.location || '',
    cachedType: (p.programType && p.programType[0]) || '',
  };
}
// dpid -> hints, so onclick handlers (which only carry the dpid) can rebuild the
// hints a lazy create needs. Populated each render by registerProgramHints.
const PO_HINTS: { [dpid: string]: ProgramHints } = {};

async function loadProgramOverlay(dpid: string, force = false): Promise<void> {
  const st = poState(dpid);
  if (st.ovLoading) return;
  if (st.overlay !== undefined && !force) return;
  st.ovLoading = true; st.error = null;
  try { st.overlay = (await apiGetProgramOverlay(dpid)) || null; }
  catch (e: any) { st.error = e && e.message ? e.message : String(e); st.overlay = null; }
  finally { st.ovLoading = false; if (typeof render === 'function') render(); }
}
async function loadProgramNotes(dpid: string, force = false): Promise<void> {
  const st = poState(dpid);
  if (st.notesLoading) return;
  if (st.notes && !force) return;
  st.notesLoading = true;
  try {
    const rows = await apiListProgramNotes(dpid);
    st.notes = (Array.isArray(rows) ? rows : []).map(normalizeProgramNote);
  } catch (e: any) { st.error = e && e.message ? e.message : String(e); st.notes = null; }
  finally { st.notesLoading = false; if (typeof render === 'function') render(); }
}
function normalizeProgramNote(r: any): ProgramNote {
  return {
    entryId: String(r.entryId || ''), body: r.body || '', noteType: r.noteType || '',
    tourDate: r.tourDate || '', tourFormat: r.tourFormat || '',
    createdBy: r.createdBy || '', createdAt: r.createdAt || '',
  };
}

// Cache the program's display hints so onclick handlers + the shared Files section
// (which only carry the directory id) can seed a lazy overlay create. Called by
// the shell/sections on every render.
function registerProgramHints(p: DirProgram): void { PO_HINTS[p.id] = poHints(p); }

// The program's logo URL for the record-shell header, or '' (falls back to initials).
function programLogoUrl(dpid: string): string {
  const ov = poState(dpid).overlay;
  return ov && ov.logo ? String(ov.logo) : '';
}

// Click the header logo → pick an image → square-crop (shared cropper) → upload.
function programLogoUpload(dpid: string): void {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    try {
      const dataUrl = await fileToDataUrl(f);
      openCropper(dataUrl, async (out: string) => {
        const comma = out.indexOf(',');
        const b64 = comma >= 0 ? out.slice(comma + 1) : out;
        try {
          const ov = await apiSetProgramLogo(dpid, PO_HINTS[dpid] || {}, { dataBase64: b64, filename: 'logo.png', contentType: 'image/png' });
          if (ov) poState(dpid).overlay = ov;
          if (typeof render === 'function') render();
          toast('Logo updated');
        } catch (e: any) { toast('Logo upload failed: ' + (e && e.message ? e.message : String(e))); }
      });
    } catch (_e) { toast('Could not read that image.'); }
  };
  input.click();
}

// ── SECTION: Summary (private rating + summary + at-a-glance) ─────────────────
function summaryProgramSection(p: DirProgram): string {
  const dpid = p.id;
  registerProgramHints(p);
  const st = poState(dpid);
  if (st.overlay === undefined && !st.ovLoading) loadProgramOverlay(dpid);

  const savedRating = st.overlay ? (Number(st.overlay.internalRating) || 0) : 0;
  const rating = st.saving && typeof st.pendingRating === 'number' ? st.pendingRating : savedRating;
  const summary = st.overlay ? (st.overlay.privateSummary || '') : '';

  const stars = [1, 2, 3, 4, 5].map(n =>
    `<button class="pov-star${n <= rating ? ' on' : ''}" title="${n} star${n > 1 ? 's' : ''}" onclick="setProgramRating('${esc(dpid)}',${n})">${ic('star', 20)}</button>`
  ).join('');
  const clearStar = rating ? `<button class="pov-star-clear" title="Clear rating" onclick="setProgramRating('${esc(dpid)}',0)">${ic('x', 14)}</button>` : '';
  const saving = st.saving ? `<span class="pov-saving"><span class="spin"></span>Saving…</span>` : '';
  const pops = (p.populationsRaw || '').trim();

  return `<div class="section-head"><div><h3>Summary</h3><p>Your private rating and take on this program.</p></div></div>
  <div class="card card-pad pov${st.saving ? ' saving' : ''}">
    ${saving}
    <div class="pov-rating">
      <span class="pov-label">Your rating</span>
      <span class="pov-stars">${stars}</span>${clearStar}
    </div>
    <div class="pov-summary">
      <label class="pov-label" for="pov-sum-${esc(dpid)}">Private summary</label>
      <textarea id="pov-sum-${esc(dpid)}" class="pov-sum-input" rows="3" placeholder="Your private take on this program…">${esc(summary)}</textarea>
      <div class="pov-sum-actions"><button id="pov-sum-${esc(dpid)}-save" class="btn ghost sm" onclick="saveProgramSummary('${esc(dpid)}')">${ic('check', 14)} Save summary</button></div>
    </div>
  </div>
  ${pops ? `<div class="card card-pad prog-sec"><div class="sec-h">Populations &amp; Specialties</div><div class="sec-body">${esc(pops)}</div></div>` : ''}`;
}

// ── SECTION: Notes ────────────────────────────────────────────────────────────
function notesProgramSection(p: DirProgram): string {
  const dpid = p.id;
  registerProgramHints(p);
  const st = poState(dpid);
  if (st.notes === null && !st.notesLoading) loadProgramNotes(dpid);
  const head = `<div class="section-head">
    <div><h3>Notes</h3><p>Private notes on this program — calls, tours, and observations.</p></div>
    <button class="btn primary" onclick="openProgramNoteModal('${esc(dpid)}')">${ic('plus', 15)} Add note</button>
  </div>`;
  return head + renderProgramNotes(dpid, st);
}

function renderProgramNotes(dpid: string, st: POState): string {
  if (st.notes === null) {
    return `<div class="pov-empty">${st.error ? esc(st.error) : 'Loading notes…'}</div>`;
  }
  if (!st.notes.length) return `<div class="pov-empty">No notes yet — add a call, tour, or general note.</div>`;
  const notes = st.notes.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return `<div class="pov-note-list">${notes.map(n => programNoteCard(dpid, n)).join('')}</div>`;
}

function programNoteCard(dpid: string, n: ProgramNote): string {
  const typeMod = n.noteType === 'Concern' ? ' concern' : n.noteType === 'Tour' ? ' tour' : '';
  const typeChip = n.noteType ? `<span class="pov-note-type${typeMod}">${esc(n.noteType)}</span>` : '';
  const tourBits = [n.tourDate ? (fmtDate(n.tourDate) || n.tourDate) : '', n.tourFormat].filter(Boolean).join(' · ');
  const tour = n.noteType === 'Tour' && tourBits ? `<span class="pov-note-tour">${ic('calendar', 12)} ${esc(tourBits)}</span>` : '';
  const foot = (n.createdBy || n.createdAt)
    ? `<div class="pov-note-foot">${esc(n.createdBy || '')}${n.createdAt ? ' · ' + esc(fmtDate(n.createdAt) || n.createdAt) : ''}</div>` : '';
  return `<div class="pov-note">
    <div class="pov-note-top">${typeChip}${tour}<span style="flex:1"></span>
      <button class="ico-mini" title="Edit" onclick="openProgramNoteModal('${esc(dpid)}','${esc(n.entryId)}')">${ic('edit', 14)}</button>
      <button class="ico-mini danger" title="Delete" onclick="deleteProgramNotePrompt('${esc(dpid)}','${esc(n.entryId)}')">${ic('trash', 14)}</button>
    </div>
    <div class="pov-note-body">${esc(n.body)}</div>
    ${foot}
  </div>`;
}

async function setProgramRating(dpid: string, n: number): Promise<void> {
  const st = poState(dpid);
  if (st.saving) return;                       // ignore double-clicks mid-save
  st.saving = true; st.pendingRating = n;      // optimistic fill + saving indicator
  if (typeof render === 'function') render();
  try {
    const ov = await apiSaveProgramOverlay(dpid, PO_HINTS[dpid] || {}, { internalRating: n });
    if (ov) st.overlay = ov;
    toast(n ? ('Rated ' + n + ' star' + (n > 1 ? 's' : '')) : 'Rating cleared');
  } catch (e: any) {
    toast('Could not save rating: ' + (e && e.message ? e.message : String(e)));
  } finally {
    st.saving = false; st.pendingRating = undefined;
    if (typeof render === 'function') render();
  }
}

async function saveProgramSummary(dpid: string): Promise<void> {
  // Don't re-render mid-save here — it would reset the textarea the user is looking
  // at. Disable the button, show its own inline "Saving…", and only update state.
  const btn = document.getElementById('pov-sum-' + dpid + '-save') as HTMLButtonElement | null;
  const ta = document.getElementById('pov-sum-' + dpid) as HTMLTextAreaElement | null;
  const value = ta ? ta.value.trim() : '';
  if (btn) btn.disabled = true;
  try {
    const ov = await apiSaveProgramOverlay(dpid, PO_HINTS[dpid] || {}, { privateSummary: value });
    if (ov) poState(dpid).overlay = ov;
    toast('Summary saved');
  } catch (e: any) {
    toast('Could not save summary: ' + (e && e.message ? e.message : String(e)));
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── note add/edit modal ──────────────────────────────────────────────────────
function poSelect(dataK: string, choices: string[], current: string, placeholder: string, extra?: string): string {
  const opts = [`<option value="">${esc(placeholder)}</option>`]
    .concat(choices.map(o => `<option value="${esc(o)}"${o === current ? ' selected' : ''}>${esc(o)}</option>`)).join('');
  return `<select data-k="${dataK}"${extra || ''}>${opts}</select>`;
}

function openProgramNoteModal(dpid: string, entryId?: string): void {
  if (document.getElementById('__poNoteModal')) closeProgramNoteModal();
  const st = poState(dpid);
  const n = entryId && st.notes ? (st.notes.filter(x => x.entryId === entryId)[0] || null) : null;
  const editing = !!n;
  const noteType = n ? (n.noteType || 'General') : 'General';
  const tourHidden = noteType === 'Tour' ? '' : ' hidden';

  const host = document.createElement('div');
  host.className = 'modal-overlay';
  host.id = '__poNoteModal';
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="${editing ? 'Edit note' : 'Add note'}" data-dpid="${esc(dpid)}" data-entry="${esc(entryId || '')}">
    <div class="modal-head"><div><b>${editing ? 'Edit note' : 'Add note'}</b><p>A private note about this program.</p></div>
      <button class="ico-x" title="Close" onclick="closeProgramNoteModal()">${ic('x', 18)}</button></div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <div class="field-grid">
        <div class="field"><label>Type</label>${poSelect('noteType', PROGRAM_NOTE_TYPES, noteType, '—', ' onchange="onProgramNoteTypeChange(this)"')}</div>
        <div class="field pov-tour-wrap"${tourHidden}><label>Tour date</label><input type="date" data-k="tourDate" value="${esc(n ? n.tourDate : '')}"></div>
        <div class="field pov-tour-wrap"${tourHidden}><label>Tour format</label>${poSelect('tourFormat', TOUR_FORMATS, n ? n.tourFormat : '', '—')}</div>
        <div class="field full"><label>Note</label><textarea data-k="body" rows="4" placeholder="What did you learn?" autocomplete="off">${esc(n ? n.body : '')}</textarea></div>
      </div>
    </div>
    <div class="modal-foot"><span class="modal-status"></span><span style="flex:1"></span>
      <button class="btn ghost" onclick="closeProgramNoteModal()">${ic('x', 15)} Cancel</button>
      <button class="btn primary js-save" onclick="saveProgramNote()">${ic('check', 15)} ${editing ? 'Save changes' : 'Add note'}</button></div>
  </div>`;
  host.addEventListener('mousedown', e => { if (e.target === host) closeProgramNoteModal(); });
  document.body.appendChild(host);
  const body = host.querySelector('textarea[data-k="body"]') as HTMLTextAreaElement | null;
  if (body) body.focus();
  document.addEventListener('keydown', poNoteEsc);
}
function poNoteEsc(e: KeyboardEvent): void { if (e.key === 'Escape') closeProgramNoteModal(); }
function closeProgramNoteModal(): void {
  const m = document.getElementById('__poNoteModal'); if (m) m.remove();
  document.removeEventListener('keydown', poNoteEsc);
}
// Reveal Tour date/format only for the "Tour" note type.
function onProgramNoteTypeChange(sel: HTMLSelectElement): void {
  const card = sel.closest('.modal-card'); if (!card) return;
  const show = sel.value === 'Tour';
  card.querySelectorAll('.pov-tour-wrap').forEach(el => { (el as HTMLElement).hidden = !show; });
}
function setPoNoteErr(msg: string): void {
  const el = document.querySelector('#__poNoteModal .modal-err') as HTMLElement | null;
  if (!el) return;
  if (msg) { el.textContent = msg; el.hidden = false; } else { el.textContent = ''; el.hidden = true; }
}
async function saveProgramNote(): Promise<void> {
  const modal = document.querySelector('#__poNoteModal .modal-card') as HTMLElement | null;
  if (!modal) return;
  const dpid = modal.getAttribute('data-dpid') || '';
  const entryId = modal.getAttribute('data-entry') || '';
  const fields: Record<string, any> = {};
  modal.querySelectorAll('[data-k]').forEach(el => {
    const k = (el as HTMLElement).dataset.k as string;
    fields[k] = (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value.trim();
  });
  setPoNoteErr('');
  if (!fields.body) { setPoNoteErr('Write something in the note.'); return; }
  // Drop tour fields when it isn't a Tour note (so a type change leaves no stale data).
  if (fields.noteType !== 'Tour') { fields.tourDate = ''; fields.tourFormat = ''; }

  const saveBtn = modal.querySelector('.js-save') as HTMLButtonElement | null;
  const status = modal.querySelector('.modal-status') as HTMLElement | null;
  if (saveBtn) saveBtn.disabled = true;
  if (status) status.textContent = 'Saving…';
  try {
    if (entryId) await apiUpdateProgramNote(dpid, entryId, fields);
    else await apiAddProgramNote(dpid, PO_HINTS[dpid] || {}, fields);
    closeProgramNoteModal();
    // A first note may have lazily created the overlay — reload rating/summary too.
    poState(dpid).overlay = undefined;
    await Promise.all([loadProgramNotes(dpid, true), loadProgramOverlay(dpid, true)]);
    toast(entryId ? 'Note updated' : 'Note added');
  } catch (e: any) {
    if (saveBtn) saveBtn.disabled = false;
    if (status) status.textContent = '';
    setPoNoteErr(e && e.message ? e.message : String(e));
  }
}
async function deleteProgramNotePrompt(dpid: string, entryId: string): Promise<void> {
  if (!entryId) return;
  if (!window.confirm('Delete this note? This can\'t be undone.')) return;
  try { await apiDeleteProgramNote(dpid, entryId); await loadProgramNotes(dpid, true); toast('Note deleted'); }
  catch (e: any) { toast('Delete failed: ' + (e && e.message ? e.message : String(e))); }
}
