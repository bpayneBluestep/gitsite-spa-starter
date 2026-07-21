/* =====================================================================
   agreements.ts — the Agreements (e-signature) record section (live).

   Per client, lists agreement instances from the `agreements` MEF (maestro
   listAgreements/getAgreement/createAgreement/sendAgreement/voidAgreement).
   Flow: New agreement -> pick an Active template -> assign the template's signer
   roles to real people (external signers get name+email; consultant roles are
   the logged-in user, signed in-app) -> Create (Draft) -> Send (mints per-signer
   tokens, emails links via the maestro, shows copy-link fallback).

   Signatures are collected on the public signing page (satellite site) via the
   dedicated ingester; the consultant countersigns in-app (§ countersign, added
   with Finalize). Injected controls use data-k, never `name`.
   ===================================================================== */

interface AgrSigner { id: string; role: string; name: string; email: string; kind: string; order: number; status: string; signedAt?: string; hasToken?: boolean; }
interface LiveAgreement {
  entryId: string; title: string; templateRef: string; templateName: string;
  status: string; signers: AgrSigner[]; audit: any[];
  signedPdf?: string; documentHash?: string; sentAt?: string; completedAt?: string; createdAt?: string; voidReason?: string;
  links?: { id: string; role: string; name: string; email?: string; kind: string; link: string }[];
}

interface AgrState { list: LiveAgreement[] | null; loading: boolean; error: string | null; }
const AGR_CACHE: { [clientId: string]: AgrState } = {};
let AGR_TEMPLATES: any[] | null = null; // active templates, loaded once for the picker

function agrState(cid: string): AgrState {
  if (!AGR_CACHE[cid]) AGR_CACHE[cid] = { list: null, loading: false, error: null };
  return AGR_CACHE[cid];
}

async function loadAgreements(cid: string, force = false): Promise<void> {
  const st = agrState(cid);
  if (st.loading) return;
  if (st.list && !force) return;
  st.loading = true; st.error = null;
  try {
    const rows = await apiListAgreements(cid);
    st.list = (rows || []).slice().sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  } catch (e: any) { st.error = e && e.message ? e.message : String(e); }
  st.loading = false;
  if (location.hash.indexOf('/agreements') >= 0) render();
}

// ── status pill styling ──────────────────────────────────────────────────────
function agrStatusClass(s: string): string {
  if (s === 'Completed') return 'ok';
  if (s === 'Voided' || s === 'Declined') return 'muted';
  if (s === 'Partially Signed') return 'warn';
  if (s === 'Sent') return 'info';
  return 'draft';
}

function signerProgress(a: LiveAgreement): string {
  const total = (a.signers || []).length;
  const signed = (a.signers || []).filter(s => s.status === 'signed').length;
  return signed + '/' + total + ' signed';
}

// ── section ──────────────────────────────────────────────────────────────────
function agreementsSection(c: Client): string {
  const st = agrState(c.id);
  if (st.list === null) {
    if (!st.loading && !st.error) loadAgreements(c.id);
    return sectionHead('Agreements', 'E-signature agreements for ' + esc(c.first) + '.')
      + (st.error ? errorCard(st.error) : loadingCard('Loading agreements…'));
  }
  const head = `<div class="section-head"><div><h3>Agreements</h3><p>Send templates for e-signature and track who has signed.</p></div>
    <button class="btn primary" onclick="agrOpenNew('${esc(c.id)}')">${ic('plus', 15)} New agreement</button></div>`;

  if (!st.list.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic('fileText', 22)}</div><b>No agreements yet</b>
      <p>Create one from a template to send for signature.</p></div></div>`;
  }

  const cards = st.list.map(a => {
    const cls = agrStatusClass(a.status);
    const signers = (a.signers || []).map(s => {
      const badge = s.status === 'signed' ? `<span class="agr-s-ok">${ic('check', 12)} signed</span>`
        : s.status === 'declined' ? `<span class="agr-s-no">declined</span>`
        : s.kind === 'consultant' ? `<span class="agr-s-wait">awaiting you</span>`
        : `<span class="agr-s-wait">pending</span>`;
      return `<div class="agr-signer"><span class="agr-s-name">${esc(s.name || s.role)}${s.kind === 'consultant' ? ' <span class="muted">(you)</span>' : ''}</span>${badge}</div>`;
    }).join('');
    const actions: string[] = [];
    const consultantPending = (a.signers || []).some(s => s.kind === 'consultant' && s.status !== 'signed' && s.status !== 'declined');
    if ((a.status === 'Sent' || a.status === 'Partially Signed') && consultantPending) actions.push(`<button class="btn primary sm" onclick="agrSignSelf('${esc(c.id)}','${esc(a.entryId)}')">${ic('pen', 14)} Sign now</button>`);
    if (a.status === 'Draft') actions.push(`<button class="btn primary sm" onclick="agrSend('${esc(c.id)}','${esc(a.entryId)}')">${ic('mail', 14)} Send</button>`);
    if (a.status === 'Sent' || a.status === 'Partially Signed') actions.push(`<button class="btn outline sm" onclick="agrSend('${esc(c.id)}','${esc(a.entryId)}')">${ic('mail', 14)} Resend / links</button>`);
    if (a.status === 'Completed' && a.signedPdf) actions.push(`<a class="btn primary sm" href="${esc(a.signedPdf)}" target="_blank" rel="noopener">${ic('download', 14)} Signed PDF</a>`);
    else if (a.status === 'Completed') actions.push(`<button class="btn outline sm" onclick="agrGetPdf('${esc(c.id)}','${esc(a.entryId)}',this)" title="The signed PDF is being generated in the background; click to check if it's ready.">${ic('download', 14)} PDF generating…</button>`);
    if (a.status !== 'Completed' && a.status !== 'Voided') actions.push(`<button class="btn ghost sm" onclick="agrVoid('${esc(c.id)}','${esc(a.entryId)}')">${ic('trash', 14)} Void</button>`);
    const linksBlock = a.links && a.links.length
      ? `<div class="agr-links">${a.links.filter(l => l.kind === 'external' && l.link).map(l => `<div class="agr-link-row"><span>${esc(l.name || l.role)}</span><input readonly value="${esc(l.link)}" onclick="this.select()"><button class="btn ghost sm" onclick="agrCopy('${esc(l.link)}')">Copy</button></div>`).join('')}</div>`
      : '';
    return `<div class="card agr-card">
      <div class="agr-top">
        <div><b>${esc(a.title)}</b><div class="agr-sub">${esc(a.templateName || '')} · ${signerProgress(a)}</div></div>
        <span class="pill ${cls}">${esc(a.status)}</span>
      </div>
      <div class="agr-signers">${signers}</div>
      ${linksBlock}
      <div class="agr-actions">${actions.join('')}</div>
    </div>`;
  }).join('');
  return head + `<div class="agr-list">${cards}</div>`;
}

// small helper: a section header (matches the app's .section-head)
function sectionHead(title: string, desc: string): string {
  return `<div class="section-head"><div><h3>${esc(title)}</h3><p>${esc(desc)}</p></div></div>`;
}

// ── New-agreement modal ────────────────────────────────────────────────────────
async function agrOpenNew(cid: string): Promise<void> {
  if (document.getElementById('__agrModal')) return;
  // load active templates for the picker
  if (AGR_TEMPLATES === null) {
    try { AGR_TEMPLATES = (await apiListAgreementTemplates() || []).filter((t: any) => (t.status || '') === 'Active'); }
    catch (e) { AGR_TEMPLATES = []; }
  }
  const host = document.createElement('div');
  host.className = 'modal-overlay';
  host.id = '__agrModal';
  host.innerHTML = agrModalHtml(cid);
  host.addEventListener('mousedown', e => { if (e.target === host) agrCloseNew(); });
  document.body.appendChild(host);
  document.addEventListener('keydown', agrEsc);
}
function agrEsc(e: KeyboardEvent): void { if (e.key === 'Escape') agrCloseNew(); }
function agrCloseNew(): void { const m = document.getElementById('__agrModal'); if (m) m.remove(); document.removeEventListener('keydown', agrEsc); }

function agrModalHtml(cid: string): string {
  const opts = (AGR_TEMPLATES || []).map((t: any) => `<option value="${esc(t.entryId)}">${esc(t.name)}</option>`).join('');
  const picker = (AGR_TEMPLATES && AGR_TEMPLATES.length)
    ? `<select data-k="templateRef" onchange="agrTemplatePicked('${esc(cid)}')"><option value="">Choose a template…</option>${opts}</select>`
    : `<div class="muted">No Active templates yet. Create one in <b>Settings ▸ Agreements</b>.</div>`;
  return `<div class="modal-card" role="dialog" aria-modal="true" aria-label="New agreement">
    <div class="modal-head"><div><b>New Agreement</b><p>Pick a template and assign signers.</p></div>
      <button class="ico-x" onclick="agrCloseNew()">${ic('x', 18)}</button></div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <div class="field full"><label>Template</label>${picker}</div>
      <div class="field full"><label>Title</label><input data-k="title" placeholder="e.g. Engagement Agreement — Chen"></div>
      <div id="agr-signers-wrap"></div>
    </div>
    <div class="modal-foot"><span class="modal-status"></span><span style="flex:1"></span>
      <button class="btn ghost" onclick="agrCloseNew()">${ic('x', 15)} Cancel</button>
      <button class="btn primary" onclick="agrCreateSubmit('${esc(cid)}')" id="agr-create-btn" disabled>${ic('plus', 15)} Create</button>
    </div>
  </div>`;
}

// When a template is picked, render a signer row per role + default the title.
function agrTemplatePicked(cid: string): void {
  const modal = document.getElementById('__agrModal'); if (!modal) return;
  const sel = modal.querySelector('select[data-k="templateRef"]') as HTMLSelectElement | null;
  const wrap = modal.querySelector('#agr-signers-wrap') as HTMLElement | null;
  const btn = modal.querySelector('#agr-create-btn') as HTMLButtonElement | null;
  const titleInput = modal.querySelector('input[data-k="title"]') as HTMLInputElement | null;
  if (!sel || !wrap) return;
  const tpl = (AGR_TEMPLATES || []).find((t: any) => t.entryId === sel.value);
  if (!tpl) { wrap.innerHTML = ''; if (btn) btn.disabled = true; return; }
  if (titleInput && !titleInput.value) titleInput.value = tpl.name || 'Agreement';
  const roles = (tpl.bodyJson && Array.isArray(tpl.bodyJson.roles)) ? tpl.bodyJson.roles : [];
  const me = (typeof SESSION !== 'undefined' && SESSION && SESSION.fullName) ? SESSION.fullName : (ME.first + ' ' + ME.last);
  wrap.innerHTML = '<div class="agr-roles-h">Signers</div>' + roles.map((r: any, i: number) => {
    if (r.kind === 'consultant') {
      return `<div class="agr-role" data-role="${esc(r.id)}" data-kind="consultant" data-name="${esc(me)}">
        <div class="agr-role-label">${esc(r.label || r.id)} <span class="muted">— you (${esc(me)}), sign in-app</span></div></div>`;
    }
    return `<div class="agr-role" data-role="${esc(r.id)}" data-kind="external">
      <div class="agr-role-label">${esc(r.label || r.id)}</div>
      <div class="agr-role-inputs">
        <input data-rk="name" placeholder="Full name">
        <input data-rk="email" placeholder="email@example.com" oninput="agrValidate()">
      </div></div>`;
  }).join('');
  agrValidate();
}

// Enable Create only when every external signer has a name + email.
function agrValidate(): void {
  const modal = document.getElementById('__agrModal'); if (!modal) return;
  const btn = modal.querySelector('#agr-create-btn') as HTMLButtonElement | null;
  const roles = Array.from(modal.querySelectorAll('.agr-role')) as HTMLElement[];
  let ok = roles.length > 0;
  roles.forEach(r => {
    if (r.getAttribute('data-kind') === 'external') {
      const email = (r.querySelector('input[data-rk="email"]') as HTMLInputElement | null);
      const name = (r.querySelector('input[data-rk="name"]') as HTMLInputElement | null);
      if (!email || !name || !name.value.trim() || !/.+@.+\..+/.test(email.value.trim())) ok = false;
    }
  });
  if (btn) btn.disabled = !ok;
}

async function agrCreateSubmit(cid: string): Promise<void> {
  const modal = document.getElementById('__agrModal'); if (!modal) return;
  const sel = modal.querySelector('select[data-k="templateRef"]') as HTMLSelectElement | null;
  const titleInput = modal.querySelector('input[data-k="title"]') as HTMLInputElement | null;
  const status = modal.querySelector('.modal-status') as HTMLElement | null;
  const err = modal.querySelector('.modal-err') as HTMLElement | null;
  if (!sel || !sel.value) { if (err) { err.textContent = 'Pick a template.'; err.hidden = false; } return; }
  const roles = Array.from(modal.querySelectorAll('.agr-role')) as HTMLElement[];
  const signers = roles.map((r, i) => {
    const kind = r.getAttribute('data-kind') || 'external';
    if (kind === 'consultant') return { role: r.getAttribute('data-role'), name: r.getAttribute('data-name') || '', email: '', kind: 'consultant', order: i + 1 };
    return {
      role: r.getAttribute('data-role'),
      name: (r.querySelector('input[data-rk="name"]') as HTMLInputElement).value.trim(),
      email: (r.querySelector('input[data-rk="email"]') as HTMLInputElement).value.trim(),
      kind: 'external', order: i + 1,
    };
  });
  if (err) err.hidden = true;
  if (status) status.textContent = 'Creating…';
  try {
    await apiCreateAgreement(cid, sel.value, titleInput ? titleInput.value.trim() : '', signers);
    agrCloseNew();
    await loadAgreements(cid, true);
    toast('Agreement created — send it when ready.');
  } catch (e: any) {
    if (status) status.textContent = '';
    if (err) { err.textContent = e && e.message ? e.message : String(e); err.hidden = false; }
  }
}

// ── send / void / copy ─────────────────────────────────────────────────────────
async function agrSend(cid: string, entryId: string): Promise<void> {
  try {
    const res = await apiSendAgreement(cid, entryId);
    const st = agrState(cid);
    if (st.list) { const i = st.list.findIndex(a => a.entryId === entryId); if (i >= 0) st.list[i] = res; }
    render();
    toast('Agreement sent — signing links emailed.');
  } catch (e: any) { toast('Send failed: ' + (e && e.message ? e.message : String(e))); }
}

async function agrVoid(cid: string, entryId: string): Promise<void> {
  if (!window.confirm('Void this agreement? Signers will no longer be able to sign. This can\'t be undone.')) return;
  try {
    await apiVoidAgreement(cid, entryId, '');
    await loadAgreements(cid, true);
    toast('Agreement voided.');
  } catch (e: any) { toast('Void failed: ' + (e && e.message ? e.message : String(e))); }
}

function agrCopy(link: string): void {
  try { navigator.clipboard.writeText(link); toast('Link copied.'); }
  catch (_e) { toast('Copy failed — select the text manually.'); }
}

// Download the signed PDF. Generated on demand server-side (getSignedPdf) — the
// first click may take a few seconds while it renders + caches; later clicks are
// instant. If PDF generation is momentarily unavailable, the signature is already
// safely recorded, so a retry succeeds.
// Signed-PDF button. B.io.pdf hangs under load, so a user click must NEVER trigger
// a synchronous render — the scheduled background worker owns rendering. This does a
// read-only re-check (getAgreement backfills signedPdf from Files once the worker has
// produced it): if the PDF exists we open it, otherwise we report it's still queued.
async function agrGetPdf(cid: string, entryId: string, btn?: HTMLButtonElement): Promise<void> {
  const orig = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = 'Checking…'; }
  try {
    const a = await apiGetAgreement(cid, entryId);
    if (a && a.signedPdf) { window.open(a.signedPdf, '_blank'); }
    else { toast('Your signed PDF is being generated in the background — it should appear here within a few minutes. Check back shortly.'); }
  } catch (e: any) {
    toast('Could not check the signed PDF right now — please try again in a moment.');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
  }
}

// ── consultant in-app countersign (signature pad modal) ────────────────────────
let AGR_SIGN_DRAWN = false;
function agrSignSelf(cid: string, entryId: string): void {
  if (document.getElementById('__agrSignModal')) return;
  AGR_SIGN_DRAWN = false;
  const host = document.createElement('div');
  host.className = 'modal-overlay';
  host.id = '__agrSignModal';
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="Sign agreement">
    <div class="modal-head"><div><b>Sign this agreement</b><p>Draw your signature to adopt it.</p></div>
      <button class="ico-x" onclick="agrSignClose()">${ic('x', 18)}</button></div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <canvas id="agr-sign-pad" class="pl-sig" width="440" height="150" style="width:100%"></canvas>
      <div style="margin-top:8px"><button class="btn outline sm" onclick="agrSignClear()">${ic('trash', 13)} Clear</button></div>
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;margin-top:12px">
        <input type="checkbox" id="agr-sign-consent" style="margin-top:3px"> I adopt this signature and agree it is legally binding.</label>
    </div>
    <div class="modal-foot"><span class="modal-status"></span><span style="flex:1"></span>
      <button class="btn ghost" onclick="agrSignClose()">${ic('x', 15)} Cancel</button>
      <button class="btn primary" onclick="agrSignSubmit('${esc(cid)}','${esc(entryId)}')">${ic('pen', 15)} Adopt &amp; Sign</button></div>
  </div>`;
  host.addEventListener('mousedown', e => { if (e.target === host) agrSignClose(); });
  document.body.appendChild(host);
  agrSignSetupPad();
}
function agrSignClose(): void { const m = document.getElementById('__agrSignModal'); if (m) m.remove(); }
function agrSignSetupPad(): void {
  const cv = document.getElementById('agr-sign-pad') as HTMLCanvasElement | null;
  if (!cv) return; const ctx = cv.getContext('2d'); if (!ctx) return;
  ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#12325a';
  let drawing = false, lx = 0, ly = 0;
  const pos = (e: any) => { const r = cv.getBoundingClientRect(); const t = (e.touches && e.touches[0]) || e; return { x: (t.clientX - r.left) * (cv.width / r.width), y: (t.clientY - r.top) * (cv.height / r.height) }; };
  const start = (e: any) => { drawing = true; const p = pos(e); lx = p.x; ly = p.y; e.preventDefault(); };
  const move = (e: any) => { if (!drawing) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(p.x, p.y); ctx.stroke(); lx = p.x; ly = p.y; AGR_SIGN_DRAWN = true; e.preventDefault(); };
  const end = () => { drawing = false; };
  cv.onmousedown = start; cv.onmousemove = move; window.onmouseup = end;
  cv.ontouchstart = start; cv.ontouchmove = move; cv.ontouchend = end;
}
function agrSignClear(): void { const cv = document.getElementById('agr-sign-pad') as HTMLCanvasElement | null; if (!cv) return; const ctx = cv.getContext('2d'); if (ctx) ctx.clearRect(0, 0, cv.width, cv.height); AGR_SIGN_DRAWN = false; }
async function agrSignSubmit(cid: string, entryId: string): Promise<void> {
  const modal = document.getElementById('__agrSignModal'); if (!modal) return;
  const consent = modal.querySelector('#agr-sign-consent') as HTMLInputElement | null;
  const err = modal.querySelector('.modal-err') as HTMLElement | null;
  const cv = modal.querySelector('#agr-sign-pad') as HTMLCanvasElement | null;
  const status = modal.querySelector('.modal-status') as HTMLElement | null;
  if (!consent || !consent.checked) { if (err) { err.textContent = 'Please check the consent box.'; err.hidden = false; } return; }
  if (!AGR_SIGN_DRAWN) { if (err) { err.textContent = 'Please draw your signature.'; err.hidden = false; } return; }
  if (status) status.textContent = 'Signing…';
  try {
    await apiCountersignAgreement(cid, entryId, cv ? cv.toDataURL('image/png') : '');
    agrSignClose();
    await loadAgreements(cid, true);
    toast('Signed.');
  } catch (e: any) {
    if (status) status.textContent = '';
    if (err) { err.textContent = e && e.message ? e.message : String(e); err.hidden = false; }
  }
}
