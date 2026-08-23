/* =====================================================================
   agreements.ts — the Agreements tab: envelopes (schema v3, DocuSign model).

   An envelope is N uploaded PDFs + M recipients + placed tabs, one status, one
   audit trail. Documents are AUTHORED ELSEWHERE (Word → PDF) and uploaded; the
   old rich-text builder and its {{token}} grammar are retired.

   This phase (1) covers the envelope object: list, create, upload/reorder/remove
   documents, recipients, void. Field placement is phase 2; sending and signing
   are phase 3 — the Send button exists but is disabled with an honest tooltip.

   Legacy authored agreements remain readable forever: listEnvelopes returns them
   tagged legacy:true, completed ones open their signed PDF, unfinished ones can
   only be voided. Their creation/signing UI is gone.

   Backend: apiListEnvelopes/apiGetEnvelope/apiCreateEnvelope/apiUploadEnvelopeDoc/
   apiRemoveEnvelopeDoc/apiReorderEnvelopeDocs/apiSetEnvelopeRecipients/
   apiVoidEnvelope (api.ts). Thumbnails come from pdfrt.ts (pdfOpen/pdfRenderPage) —
   the same PDF→pixels path the designer and signing view will use.
   ===================================================================== */

interface EnvDoc { id: string; name: string; order: number; sourceUrl: string; fileEntryId?: string; pages: number; kind: string; }
interface EnvRecipient {
  id: string; role: string; name: string; email: string;
  kind: 'external' | 'consultant' | 'inperson' | 'cc';
  routingOrder: number; status: string; signedAt: string;
  typedName: string; signatureData: string; tabValues: Record<string, any>; hasToken: boolean;
}
interface Envelope {
  entryId: string; schemaVersion: number; title: string; status: string;
  sentAt: string; completedAt: string; voidReason: string; createdBy: string; createdAt: string;
  signedPdf: string; documents: EnvDoc[]; tabs: any[]; anchors: any[];
  recipients: EnvRecipient[]; audit: any[];
}

interface EnvState { list: any[] | null; loading: boolean; error: string | null; }
const ENV_CACHE: { [cid: string]: EnvState } = {};
// The envelope currently open in the detail editor (Draft) or viewer.
let ENV_OPEN: Envelope | null = null;
let ENV_OPEN_CID = '';
// Rendered first-page thumbnails, keyed by source url — pdf.js work is not free,
// so a thumbnail is rendered once per url per session.
const ENV_THUMBS: { [url: string]: string } = {};

function envState(cid: string): EnvState {
  if (!ENV_CACHE[cid]) ENV_CACHE[cid] = { list: null, loading: false, error: null };
  return ENV_CACHE[cid];
}

async function loadEnvelopes(cid: string, force = false): Promise<void> {
  const st = envState(cid);
  if (st.loading) return;
  if (st.list && !force) return;
  st.loading = true; st.error = null;
  try { st.list = await apiListEnvelopes(cid) || []; }
  catch (e: any) { st.error = e && e.message ? e.message : String(e); st.list = null; }
  st.loading = false;
  if (typeof render === 'function') render();
}

/* ---- section entry (client record tab) ---- */
function agreementsSection(c: Client): string {
  if (ENV_OPEN && ENV_OPEN_CID !== c.id) { ENV_OPEN = null; }
  const st = envState(c.id);
  if (st.list === null) { if (!st.loading && !st.error) loadEnvelopes(c.id); return st.error ? errorCard(st.error) : loadingCard('Loading agreements…'); }
  if (ENV_OPEN) { setTimeout(envRenderThumbs, 0); return envDetail(c, ENV_OPEN); }
  return envList(c, st.list);
}

/* ---- list ---- */
function envStatusPill(status: string, legacy: boolean): string {
  const cls = status === 'Completed' ? 'ok' : status === 'Voided' || status === 'Declined' ? 'muted'
    : status === 'Draft' ? 'draft' : 'info';
  return `<span class="pill ${cls}">${esc(status)}</span>${legacy ? ' <span class="pill muted" title="Created by the retired rich-text builder — read-only">legacy</span>' : ''}`;
}

function envList(c: Client, rows: any[]): string {
  const head = `<div class="section-head">
    <div><h3>Agreements</h3><p>Envelopes of one or more PDF documents sent for e-signature.</p></div>
    <div><button class="btn primary" onclick="envNew('${esc(c.id)}')">${ic('plus', 15)} New envelope</button></div></div>`;
  if (!rows.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic('fileText', 22)}</div>
      <b>No agreements yet</b><p>Create an envelope, upload the PDFs to sign, and add recipients.</p></div></div>`;
  }
  const body = rows.map(r => {
    const who = (r.recipients || []).map((x: any) =>
      `<span class="env-chip ${x.status === 'signed' ? 'done' : ''}" title="${esc(x.kind)} · ${esc(x.status)}">${esc(x.name || '?')}</span>`).join('');
    const open = r.legacy
      ? (r.signedPdf ? `<button class="btn outline sm" onclick="filesOpen('${esc(r.signedPdf)}')">${ic('download', 14)} Signed PDF</button>` : '')
      : `<button class="btn outline sm" onclick="envOpen('${esc(c.id)}','${esc(r.entryId)}')">${ic('chevR', 14)} Open</button>`;
    const voidBtn = (r.status !== 'Completed' && r.status !== 'Voided')
      ? `<button class="btn ghost sm" onclick="envVoid('${esc(c.id)}','${esc(r.entryId)}',${r.legacy ? 'true' : 'false'})">${ic('trash', 14)} Void</button>` : '';
    return `<div class="card env-row">
      <div class="env-row-main">
        <div class="env-row-title"><b>${esc(r.title)}</b> ${envStatusPill(r.status, !!r.legacy)}</div>
        <div class="env-row-meta">${r.docCount} document${r.docCount === 1 ? '' : 's'} · ${esc(fmtDate(r.createdAt) || '')}${r.completedAt ? ' · completed ' + esc(fmtDate(r.completedAt) || '') : ''}</div>
        <div class="env-row-who">${who}</div>
      </div>
      <div class="env-row-acts">${open}${voidBtn}</div>
    </div>`;
  }).join('');
  return head + body;
}

/* ---- create / open / void ---- */
async function envNew(cid: string): Promise<void> {
  const title = prompt('Envelope title (e.g. "Admissions Packet"):', '');
  if (title == null) return;
  try {
    const env = await apiCreateEnvelope(cid, title.trim() || 'Untitled envelope');
    ENV_OPEN = env; ENV_OPEN_CID = cid;
    await loadEnvelopes(cid, true);
  } catch (e: any) { toast('Create failed: ' + (e && e.message ? e.message : String(e))); }
}

async function envOpen(cid: string, entryId: string): Promise<void> {
  try {
    ENV_OPEN = await apiGetEnvelope(cid, entryId); ENV_OPEN_CID = cid;
    render();
  } catch (e: any) { toast(e && e.message ? e.message : String(e)); }
}

function envClose(): void { ENV_OPEN = null; render(); }

async function envVoid(cid: string, entryId: string, legacy: boolean): Promise<void> {
  const reason = prompt('Void this envelope? Recipients will no longer be able to sign.\nReason (optional):', '');
  if (reason == null) return;
  try {
    if (legacy) await apiVoidAgreement(cid, entryId, reason);
    else await apiVoidEnvelope(cid, entryId, reason);
    if (ENV_OPEN && ENV_OPEN.entryId === entryId) ENV_OPEN = null;
    await loadEnvelopes(cid, true);
    toast('Envelope voided.');
  } catch (e: any) { toast('Void failed: ' + (e && e.message ? e.message : String(e))); }
}

/* ---- detail (Draft editor / read-only viewer) ---- */
const ENV_KINDS: { v: string; label: string }[] = [
  { v: 'external', label: 'Signs via email link' },
  { v: 'consultant', label: 'Signs in-app (me)' },
  { v: 'inperson', label: 'Signs in person' },
  { v: 'cc', label: 'Receives a copy (CC)' },
];

function envDetail(c: Client, env: Envelope): string {
  const draft = env.status === 'Draft';
  const docs = (env.documents || []).slice().sort((a, b) => a.order - b.order);
  const docRows = docs.length ? docs.map((d, i) => `
    <div class="env-doc" data-doc="${esc(d.id)}">
      <canvas class="env-thumb" data-thumb="${esc(d.sourceUrl)}" width="72" height="93"></canvas>
      <div class="env-doc-body">
        <b>${esc(d.name)}</b>
        <div class="meta">${d.pages ? d.pages + ' page' + (d.pages === 1 ? '' : 's') : 'PDF'}</div>
      </div>
      ${draft ? `<div class="env-doc-acts">
        <button class="ico-mini" title="Move up" ${i === 0 ? 'disabled' : ''} onclick="envMoveDoc('${esc(d.id)}',-1)">${ic('chevU', 14)}</button>
        <button class="ico-mini" title="Move down" ${i === docs.length - 1 ? 'disabled' : ''} onclick="envMoveDoc('${esc(d.id)}',1)">${ic('chevD', 14)}</button>
        <button class="ico-mini danger" title="Remove" onclick="envRemoveDoc('${esc(d.id)}')">${ic('trash', 14)}</button>
      </div>` : ''}
    </div>`).join('')
    : `<div class="empty" style="padding:18px"><b>No documents yet</b><p>Upload the PDF(s) this envelope will send for signature.</p></div>`;

  const recRows = (env.recipients || []).map((r, i) => draft ? `
    <div class="env-rec" data-i="${i}">
      <input class="env-rec-name" value="${esc(r.name)}" placeholder="Full name" oninput="envRecChange(${i},'name',this.value)">
      <input class="env-rec-email" value="${esc(r.email)}" placeholder="Email (for email link)" oninput="envRecChange(${i},'email',this.value)">
      <select onchange="envRecChange(${i},'kind',this.value)">
        ${ENV_KINDS.map(k => `<option value="${k.v}"${r.kind === k.v ? ' selected' : ''}>${esc(k.label)}</option>`).join('')}
      </select>
      <input class="env-rec-order" type="number" min="1" value="${r.routingOrder}" title="Routing order" onchange="envRecChange(${i},'routingOrder',this.value)">
      <button class="ico-mini danger" title="Remove" onclick="envRecRemove(${i})">${ic('trash', 14)}</button>
    </div>` : `
    <div class="env-rec-ro">
      <b>${esc(r.name)}</b> <span class="meta">${esc(r.email || '')} · ${esc(r.kind)} · order ${r.routingOrder}</span>
      <span class="pill ${r.status === 'signed' ? 'ok' : 'draft'}">${esc(r.status)}</span>
    </div>`).join('');

  return `<div class="section-head">
      <div><h3>${draft
        ? `<input id="env-title" class="env-title-input" value="${esc(env.title)}" onchange="envSaveRecipients()">`
        : esc(env.title)} ${envStatusPill(env.status, false)}</h3>
      <p>${draft ? 'Upload documents and add recipients. Field placement and sending come next.' : 'Read-only — this envelope is no longer a draft.'}</p></div>
      <div>
        <button class="btn ghost" onclick="envClose()">${ic('chevL', 14)} All agreements</button>
        ${draft ? `<a class="btn outline" href="#/designer/env/${esc(c.id)}/${esc(env.entryId)}">${ic('edit', 15)} Place fields${env.tabs && env.tabs.length ? ' (' + env.tabs.length + ')' : ''}</a>
        <button class="btn primary" disabled title="Sending arrives in phase 3 — envelopes can be fully prepared now.">${ic('mail', 15)} Send</button>` : ''}
        ${env.status !== 'Completed' && env.status !== 'Voided' ? `<button class="btn ghost" onclick="envVoid('${esc(c.id)}','${esc(env.entryId)}',false)">${ic('trash', 14)} Void</button>` : ''}
      </div></div>
    <div class="card card-pad">
      <div class="agr-roles-h">Documents</div>
      ${docRows}
      ${draft ? `<button class="btn outline sm" onclick="envPickPdf()">${ic('upload', 14)} Add PDF</button>
        <span class="meta" style="margin-left:8px">PDF only · signed in the order shown</span>` : ''}
    </div>
    <div class="card card-pad" style="margin-top:14px">
      <div class="agr-roles-h">Recipients</div>
      ${recRows || '<p class="meta">No recipients yet.</p>'}
      ${draft ? `<button class="btn outline sm" onclick="envRecAdd()">${ic('plus', 14)} Add recipient</button>` : ''}
    </div>`;
}

/* Thumbnails: render each canvas marked data-thumb once, cached by url as a data
   URL so revisits are instant and pdf.js runs at most once per document. */
async function envRenderThumbs(): Promise<void> {
  const canvases = document.querySelectorAll('canvas[data-thumb]');
  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i] as HTMLCanvasElement;
    const url = canvas.getAttribute('data-thumb') || '';
    if (!url) continue;
    if (ENV_THUMBS[url]) {
      const img = new Image();
      img.onload = () => { const ctx = canvas.getContext('2d'); if (ctx) { canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0); } };
      img.src = ENV_THUMBS[url];
      continue;
    }
    try {
      const pdf = await pdfOpen(url);
      await pdfRenderPage(pdf, 1, canvas, 72);
      ENV_THUMBS[url] = canvas.toDataURL('image/png');
      try { pdf.destroy(); } catch (_e) { /* */ }
    } catch (_e) { /* leave the blank canvas — a thumbnail is never worth an error */ }
  }
}

/* ---- documents ---- */
function envPickPdf(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/pdf';
  input.multiple = true;
  input.onchange = async () => {
    const files = Array.from(input.files || []);
    for (const f of files) {
      if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { toast(f.name + ' is not a PDF.'); continue; }
      if (f.size > 25 * 1024 * 1024) { toast(f.name + ' is over the 25 MB limit.'); continue; }
      try {
        const b64 = await envFileToBase64(f);
        // Page count read client-side — the server has no reason to parse the PDF.
        let pages = 0;
        try { const pdf = await pdfOpen(URL.createObjectURL(f)); pages = pdf.numPages; try { pdf.destroy(); } catch (_e) { /* */ } } catch (_e) { /* */ }
        const name = f.name.replace(/\.pdf$/i, '');
        if (!ENV_OPEN) return;
        ENV_OPEN = await apiUploadEnvelopeDoc(ENV_OPEN_CID, ENV_OPEN.entryId, name, b64, pages);
        render();
      } catch (e: any) { toast('Upload failed: ' + (e && e.message ? e.message : String(e))); }
    }
    loadEnvelopes(ENV_OPEN_CID, true);
  };
  input.click();
}

function envFileToBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(f);
  });
}

async function envRemoveDoc(docId: string): Promise<void> {
  if (!ENV_OPEN) return;
  if (!confirm('Remove this document from the envelope?')) return;
  try {
    ENV_OPEN = await apiRemoveEnvelopeDoc(ENV_OPEN_CID, ENV_OPEN.entryId, docId);
    render();
  } catch (e: any) { toast('Remove failed: ' + (e && e.message ? e.message : String(e))); }
}

async function envMoveDoc(docId: string, dir: number): Promise<void> {
  if (!ENV_OPEN) return;
  const ids = ENV_OPEN.documents.slice().sort((a, b) => a.order - b.order).map(d => d.id);
  const i = ids.indexOf(docId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  ids[i] = ids[j]; ids[j] = docId;
  try {
    ENV_OPEN = await apiReorderEnvelopeDocs(ENV_OPEN_CID, ENV_OPEN.entryId, ids);
    render();
  } catch (e: any) { toast('Reorder failed: ' + (e && e.message ? e.message : String(e))); }
}

/* ---- recipients ----
   Edits mutate ENV_OPEN locally on each keystroke and persist on change/blur via
   envSaveRecipients — one server write per meaningful edit, not per keypress. */
function envRecChange(i: number, key: string, val: string): void {
  if (!ENV_OPEN || !ENV_OPEN.recipients[i]) return;
  (ENV_OPEN.recipients[i] as any)[key] = key === 'routingOrder' ? Math.max(1, Number(val) || 1) : val;
  if (key === 'kind' || key === 'routingOrder') envSaveRecipients();
  else envSaveRecipientsDebounced();
}

let ENV_SAVE_T: any = null;
function envSaveRecipientsDebounced(): void {
  if (ENV_SAVE_T) clearTimeout(ENV_SAVE_T);
  ENV_SAVE_T = setTimeout(envSaveRecipients, 700);
}

async function envSaveRecipients(): Promise<void> {
  if (!ENV_OPEN) return;
  if (ENV_SAVE_T) { clearTimeout(ENV_SAVE_T); ENV_SAVE_T = null; }
  const titleEl = document.getElementById('env-title') as HTMLInputElement | null;
  const title = titleEl ? titleEl.value.trim() : '';
  try {
    ENV_OPEN = await apiSetEnvelopeRecipients(ENV_OPEN_CID, ENV_OPEN.entryId, ENV_OPEN.recipients, title);
  } catch (e: any) { toast('Save failed: ' + (e && e.message ? e.message : String(e))); }
}

function envRecAdd(): void {
  if (!ENV_OPEN) return;
  const maxOrder = ENV_OPEN.recipients.reduce((m, r) => Math.max(m, r.routingOrder || 1), 0);
  ENV_OPEN.recipients.push({
    id: '', role: '', name: '', email: '', kind: 'external',
    routingOrder: maxOrder + 1, status: 'pending', signedAt: '',
    typedName: '', signatureData: '', tabValues: {}, hasToken: false,
  });
  render();
}

async function envRecRemove(i: number): Promise<void> {
  if (!ENV_OPEN) return;
  ENV_OPEN.recipients.splice(i, 1);
  await envSaveRecipients();
  render();
}
