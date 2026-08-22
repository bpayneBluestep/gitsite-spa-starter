/* =====================================================================
   agreements.ts — the Agreements (e-signature) record section (live).

   Per client, lists agreement instances from the `agreements` MEF (maestro
   listAgreements/getAgreement/createAgreement/sendAgreement/voidAgreement).
   Flow: New agreement -> pick an Active template -> assign the template's signer
   roles to real people (external signers get name+email; consultant roles are
   the logged-in user, signed in-app) -> Create (Draft) -> Send (mints per-signer
   tokens, emails links via the maestro, shows copy-link fallback).

   External signers sign on the public signing page (/spa/sign.html) via the
   dedicated runAsSuper ingester; the consultant countersigns in-app (§ countersign).
   Both surfaces render the document through the shared renderer in signing.ts, so
   the two views cannot drift. Injected controls use data-k, never `name`.
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

// Signed-PDF button — a manual retry seam.
//
// This used to be read-only (re-check and hope the background worker had produced
// the file) because a completed agreement had no reliable render trigger and a
// B.io.pdf hang would have stranded the user on a click. Both halves of that have
// changed: signing now always kicks a render (see agrSignSubmit), so this button is
// the exception path rather than the only path, and getSignedPdf is idempotent —
// it serves the cached Files copy when one exists and renders only when it doesn't.
// So: re-check first, and only render if the PDF genuinely isn't there yet.
async function agrGetPdf(cid: string, entryId: string, btn?: HTMLButtonElement): Promise<void> {
  const orig = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = 'Checking…'; }
  try {
    const a = await apiGetAgreement(cid, entryId);
    if (a && a.signedPdf) { window.open(a.signedPdf, '_blank'); return; }
    // Not there — ask the server to produce it now.
    if (btn) btn.innerHTML = 'Generating…';
    const res = await apiGetSignedPdf(cid, entryId);
    if (res && res.url) { window.open(res.url, '_blank'); await loadAgreements(cid, true); }
    else { toast('Your signed PDF is still being generated — check back in a moment.'); }
  } catch (e: any) {
    // A render can hang and 504. The signature, consent and hash are already
    // committed, so this is only a delay: the background worker retries.
    toast('The signed PDF is taking longer than usual to generate — your signature is safely recorded. Check back in a few minutes.');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
  }
}

// ── consultant in-app countersign (full-document signing view) ─────────────────
//
// The consultant is a real signer, so they get a real signing experience: the whole
// frozen agreement, merge values resolved, their own tokens marked and their
// initials/text fields collected — the same renderer (signing.ts) the parent-facing
// page uses. It used to be a bare signature pad in a small modal, which meant the
// consultant was adopting a legally binding signature on a document they could not
// read, and any {{initials:…}}/{{text:…}} token addressed to them silently rendered
// blank in the signed PDF because the values were never collected or sent.

let AGR_SIGN_PAD: SigPad | null = null;
let AGR_SIGN_FIELDS: SigField[] = [];

async function agrSignSelf(cid: string, entryId: string): Promise<void> {
  if (document.getElementById('__agrSignModal')) return;

  const host = document.createElement('div');
  host.className = 'modal-overlay';
  host.id = '__agrSignModal';
  host.innerHTML = `<div class="modal-card agr-sign-card" role="dialog" aria-modal="true" aria-label="Sign agreement">
    <div class="modal-head"><div><b>Sign this agreement</b><p>Loading the document…</p></div>
      <button class="ico-x" onclick="agrSignClose()">${ic('x', 18)}</button></div>
    <div class="modal-body">${loadingCard('Loading agreement…')}</div>
  </div>`;
  host.addEventListener('mousedown', e => { if (e.target === host) agrSignClose(); });
  document.body.appendChild(host);
  document.addEventListener('keydown', agrSignEsc);

  let a: any = null;
  try {
    a = await apiGetAgreement(cid, entryId);
  } catch (e: any) {
    const body = host.querySelector('.modal-body');
    if (body) body.innerHTML = errorCard(e && e.message ? e.message : String(e));
    return;
  }
  if (!document.getElementById('__agrSignModal')) return; // closed while loading

  const snap = a && a.contentSnapshot ? a.contentSnapshot : null;
  if (!snap || !snap.contentHtml) {
    const body = host.querySelector('.modal-body');
    if (body) body.innerHTML = errorCard('This agreement has no document content to sign. Re-create it from a template.');
    return;
  }

  const rendered = sigRenderBody({
    contentHtml: String(snap.contentHtml || ''),
    merge: a.merge || {},
    signers: (a.signers || []).map((s: any) => ({ role: s.role, name: s.name, status: s.status })),
    myRole: String(a.myRole || ''),
  });
  AGR_SIGN_FIELDS = rendered.fields;

  const title = a.title || (snap.title || 'Agreement');
  const others = (a.signers || []).filter((s: any) => s.kind !== 'consultant').map((s: any) =>
    `<div class="agr-signer"><span class="agr-s-name">${esc(s.name || s.role)}</span>${
      s.status === 'signed' ? `<span class="agr-s-ok">${ic('check', 12)} signed</span>`
      : s.status === 'declined' ? `<span class="agr-s-no">declined</span>`
      : `<span class="agr-s-wait">pending</span>`}</div>`).join('');

  host.innerHTML = `<div class="modal-card agr-sign-card" role="dialog" aria-modal="true" aria-label="Sign agreement">
    <div class="modal-head"><div><b>${esc(title)}</b><p>Review the full agreement, then adopt your signature.</p></div>
      <button class="ico-x" onclick="agrSignClose()">${ic('x', 18)}</button></div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      ${others ? `<div class="agr-sign-others">${others}</div>` : ''}
      <div class="sg-doc">${rendered.html}</div>
      ${sigFieldsHtml(rendered.fields)}
      <div class="sg-sign">
        <h3>Your signature</h3>
        <canvas id="agr-sign-pad" class="pl-sig"></canvas>
        <div class="pl-sig-actions"><button class="btn outline sm" onclick="agrSignClear()">${ic('trash', 13)} Clear</button></div>
        <label class="sg-consent"><input type="checkbox" id="agr-sign-consent">
          I adopt this signature and agree it is legally binding.</label>
      </div>
    </div>
    <div class="modal-foot"><span class="modal-status"></span><span style="flex:1"></span>
      <button class="btn ghost" onclick="agrSignClose()">${ic('x', 15)} Cancel</button>
      <button class="btn primary" onclick="agrSignSubmit('${esc(cid)}','${esc(entryId)}')">${ic('pen', 15)} Adopt &amp; Sign</button></div>
  </div>`;

  if (AGR_SIGN_PAD) { AGR_SIGN_PAD.destroy(); }
  AGR_SIGN_PAD = sigSetupPad(document.getElementById('agr-sign-pad') as HTMLCanvasElement | null);
}

function agrSignEsc(e: KeyboardEvent): void { if (e.key === 'Escape') agrSignClose(); }

function agrSignClose(): void {
  if (AGR_SIGN_PAD) { AGR_SIGN_PAD.destroy(); AGR_SIGN_PAD = null; }
  AGR_SIGN_FIELDS = [];
  const m = document.getElementById('__agrSignModal');
  if (m) m.remove();
  document.removeEventListener('keydown', agrSignEsc);
}

function agrSignClear(): void { if (AGR_SIGN_PAD) AGR_SIGN_PAD.clear(); }

async function agrSignSubmit(cid: string, entryId: string): Promise<void> {
  const modal = document.getElementById('__agrSignModal'); if (!modal) return;
  const consent = modal.querySelector('#agr-sign-consent') as HTMLInputElement | null;
  const err = modal.querySelector('.modal-err') as HTMLElement | null;
  const status = modal.querySelector('.modal-status') as HTMLElement | null;
  const showErr = (msg: string) => { if (err) { err.textContent = msg; err.hidden = false; } };

  if (!consent || !consent.checked) { showErr('Please check the consent box.'); return; }
  if (!AGR_SIGN_PAD || !AGR_SIGN_PAD.isDrawn()) { showErr('Please draw your signature.'); return; }

  // Every field the template addressed to this signer is required — a blank one
  // renders as an empty gap in the signed PDF, which is not recoverable after the
  // fact without voiding and re-sending.
  const values = sigCollectFields(modal);
  for (const f of AGR_SIGN_FIELDS) {
    if (!String(values[f.key] || '').trim()) { showErr('Please fill in "' + f.label + '".'); return; }
  }

  if (err) err.hidden = true;
  if (status) status.textContent = 'Signing…';
  let res: any = null;
  try {
    res = await apiCountersignAgreement(cid, entryId, AGR_SIGN_PAD.dataUrl(), values);
  } catch (e: any) {
    if (status) status.textContent = '';
    showErr(e && e.message ? e.message : String(e));
    return;
  }

  agrSignClose();
  await loadAgreements(cid, true);

  // The last signature is the catalyst for the signed PDF. Rendering is deliberately
  // OFF the commit path (B.io.pdf hangs under load, uncatchable), so the server
  // commits the legal record and tells us a PDF is owed; we kick the render here,
  // fire-and-forget. This mirrors exactly what the parent-facing signing page does
  // from its done screen. Without it a consultant-last agreement had no render
  // trigger at all and sat waiting on the background worker.
  if (res && res.completed && res.pdfPending) {
    apiGetSignedPdf(cid, entryId)
      .then(() => loadAgreements(cid, true))
      .catch(() => { /* the background worker is the backstop; never bother the user */ });
    toast('Signed — the agreement is complete. Generating the signed PDF…');
  } else {
    toast(res && res.completed ? 'Signed — the agreement is complete.' : 'Signed.');
  }
}
