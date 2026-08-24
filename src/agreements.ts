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
  notifiedAt?: string; viewedAt?: string; declinedAt?: string; declineReason?: string;
  accessCode?: string; disclosureVersion?: string; disclosureAcceptedAt?: string;
}
interface Envelope {
  entryId: string; schemaVersion: number; title: string; status: string;
  sentAt: string; completedAt: string; voidReason: string; createdBy: string; createdAt: string;
  signedPdf: string; documents: EnvDoc[]; tabs: any[]; anchors: any[];
  recipients: EnvRecipient[]; audit: any[];
  routing?: string; expiresAt?: string; expireDays?: number; remindEveryDays?: number;
  activeOrder?: number; senderName?: string; senderValues?: Record<string, any>;
  disclosure?: { version: string; text: string } | null;
}

interface EnvState { list: any[] | null; loading: boolean; error: string | null; }
const ENV_CACHE: { [cid: string]: EnvState } = {};
// The envelope currently open in the detail editor (Draft) or viewer.
let ENV_OPEN: Envelope | null = null;
let ENV_OPEN_CID = '';
// Correction mode: a Sent/Partially Signed envelope temporarily editable —
// recipients + field placement — with signed recipients locked (phase 4).
let ENV_CORRECT = false;
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
  // Offer templates first — dragging 40 fields per envelope is what templates kill.
  let tpls: any[] = [];
  try { tpls = ((await apiListAgreementTemplates()) || []).filter((t: any) => t.bodyJson && t.bodyJson.schemaVersion === 3 && (t.bodyJson.documents || []).length && t.status !== 'Archived'); }
  catch (_e) { tpls = []; }
  if (!tpls.length) { envNewBlank(cid); return; }
  const host = document.createElement('div');
  host.className = 'modal-overlay'; host.id = '__envTpl';
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" style="width:min(560px,94vw)">
    <div class="modal-head"><div><b>New envelope</b><p>Start from a template — documents, fields, and auto-place rules come along.</p></div>
      <button class="ico-x" onclick="envTplClose()">${ic('x', 18)}</button></div>
    <div class="modal-body">
      <div class="env-tpl-list">
        ${tpls.map((t: any) => `<button class="env-tpl-row" onclick="envTplPick('${esc(cid)}','${esc(t.entryId)}')">
          <b>${esc(t.name)}</b><span class="meta">${(t.bodyJson.documents || []).length} PDF${(t.bodyJson.documents || []).length === 1 ? '' : 's'}
          · ${(t.bodyJson.tabs || []).length} field${(t.bodyJson.tabs || []).length === 1 ? '' : 's'}${(t.bodyJson.anchors || []).length ? ' · ' + (t.bodyJson.anchors || []).length + ' auto-place rule' + ((t.bodyJson.anchors || []).length === 1 ? '' : 's') : ''}</span>
        </button>`).join('')}
      </div>
    </div>
    <div class="modal-foot"><span class="modal-status"></span>
      <button class="btn ghost" onclick="envTplClose()">Cancel</button>
      <button class="btn outline" onclick="envTplClose(); envNewBlank('${esc(cid)}')">Blank envelope</button></div>
  </div>`;
  document.body.appendChild(host);
  ENV_TPLS = tpls;
}

async function envNewBlank(cid: string): Promise<void> {
  const title = prompt('Envelope title (e.g. "Admissions Packet"):', '');
  if (title == null) return;
  try {
    const env = await apiCreateEnvelope(cid, title.trim() || 'Untitled envelope');
    ENV_OPEN = env; ENV_OPEN_CID = cid;
    await loadEnvelopes(cid, true);
  } catch (e: any) { toast('Create failed: ' + (e && e.message ? e.message : String(e))); }
}

/* ---- apply a template (phase 5) ---- */
let ENV_TPLS: any[] = [];
function envTplClose(): void { const m = document.getElementById('__envTpl'); if (m) m.remove(); }

/* Role slots of a template: a 2-holder role expands to roleId and roleId~2 —
   each slot maps to one real person in the apply form. '__sender__' is never a slot. */
function envTplSlots(body: any): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const r of (body.roles || [])) {
    const base = r.name || 'Signer';
    out.push({ id: r.id, label: r.holders === 2 ? base + ' (1)' : base });
    if (r.holders === 2) out.push({ id: r.id + '~2', label: base + ' (2)' });
  }
  return out;
}

function envTplPick(cid: string, tplEntryId: string): void {
  const t = ENV_TPLS.find((x: any) => x.entryId === tplEntryId);
  if (!t) return;
  const slots = envTplSlots(t.bodyJson);
  const m = document.getElementById('__envTpl');
  if (!m) return;
  m.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" style="width:min(640px,94vw)">
    <div class="modal-head"><div><b>${esc(t.name)}</b><p>Who fills each role?</p></div>
      <button class="ico-x" onclick="envTplClose()">${ic('x', 18)}</button></div>
    <div class="modal-body">
      <div class="field"><label>Envelope title</label><input id="env-tpl-title" value="${esc(t.name)}"></div>
      ${slots.map((sl, i) => `<div class="env-tpl-slot">
        <div class="env-tpl-slot-h">${esc(sl.label)}</div>
        <div class="env-rec">
          <input class="env-rec-name" id="env-slot-name-${i}" placeholder="Full name">
          <input class="env-rec-email" id="env-slot-email-${i}" placeholder="Email (for email link)">
          <select id="env-slot-kind-${i}">${ENV_KINDS.filter(k => k.v !== 'cc').map(k => `<option value="${k.v}">${esc(k.label)}</option>`).join('')}</select>
          <input class="env-rec-order" id="env-slot-order-${i}" type="number" min="1" value="1" title="Signing order">
        </div></div>`).join('')}
    </div>
    <div class="modal-foot"><span class="modal-status" id="env-tpl-status"></span>
      <button class="btn ghost" onclick="envTplClose()">Cancel</button>
      <button class="btn primary" id="env-tpl-create" onclick="envTplCreate('${esc(cid)}','${esc(tplEntryId)}')">Create envelope</button></div>
  </div>`;
}

function envTplStatus(msg: string): void {
  const el = document.getElementById('env-tpl-status');
  if (el) el.textContent = msg;
}

async function envTplCreate(cid: string, tplEntryId: string): Promise<void> {
  const t = ENV_TPLS.find((x: any) => x.entryId === tplEntryId);
  if (!t) return;
  const body = t.bodyJson;
  const slots = envTplSlots(body);
  const g = (id: string) => (document.getElementById(id) as HTMLInputElement | null);
  const title = (g('env-tpl-title') && g('env-tpl-title')!.value.trim()) || t.name;
  const recipients = slots.map((sl, i) => ({
    role: sl.id,
    name: g('env-slot-name-' + i) ? g('env-slot-name-' + i)!.value.trim() : '',
    email: g('env-slot-email-' + i) ? g('env-slot-email-' + i)!.value.trim() : '',
    kind: (document.getElementById('env-slot-kind-' + i) as HTMLSelectElement | null)?.value || 'external',
    routingOrder: Math.max(1, Number(g('env-slot-order-' + i)?.value) || 1),
  }));
  for (const r of recipients) { if (!r.name) { toast('Every role needs a name.'); return; } }
  const btn = document.getElementById('env-tpl-create') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  try {
    envTplStatus('Creating envelope…');
    let env = await apiCreateEnvelope(cid, title);
    env = await apiSetEnvelopeRecipients(cid, env.entryId, recipients, title);
    // slot id → real recipient id (setEnvelopeRecipients preserves `role`)
    const slotToRid: { [slot: string]: string } = {};
    for (const r of env.recipients) if (r.role) slotToRid[r.role] = r.id;
    const mapSlot = (slot: string) => slot === '__sender__' ? '__sender__' : (slotToRid[slot] || null);
    await loadPdfJs();
    const allTabs: any[] = [];
    const docs = (body.documents || []).slice().sort((a: any, b: any) => a.order - b.order);
    for (let di = 0; di < docs.length; di++) {
      const doc = docs[di];
      envTplStatus(`Copying "${doc.name}" (${di + 1}/${docs.length})…`);
      const resp = await fetch(doc.sourceUrl, { credentials: 'include' });
      if (!resp.ok) throw new Error('Could not fetch template PDF "' + doc.name + '" (' + resp.status + ').');
      const b64 = envBufToB64(await resp.arrayBuffer());
      env = await apiUploadEnvelopeDoc(cid, env.entryId, doc.name, b64, doc.pages || 0);
      const newDoc = env.documents[env.documents.length - 1];
      // designer-placed template tabs, slot → person
      for (const tb of (body.tabs || [])) {
        if (tb.docId !== doc.id) continue;
        const rid = mapSlot(String(tb.recipientId));
        if (!rid) continue;
        allTabs.push({ ...tb, id: 't_' + Math.random().toString(36).slice(2, 10), docId: newDoc.id, recipientId: rid });
      }
      // anchor rules against the real text layer
      if ((body.anchors || []).length) {
        envTplStatus(`Auto-placing fields on "${doc.name}"…`);
        const pdf = await pdfOpenData(b64);
        const atabs = await geoAnchorTabs(pdf, newDoc.id, body.anchors || [], mapSlot);
        allTabs.push(...atabs);
      }
    }
    envTplStatus('Saving ' + allTabs.length + ' fields…');
    env = await apiSaveEnvelopeTabs(cid, env.entryId, allTabs);
    envTplClose();
    ENV_OPEN = env; ENV_OPEN_CID = cid;
    await loadEnvelopes(cid, true);
    toast('Envelope created from template — ' + allTabs.length + ' fields placed.');
    render();
  } catch (e: any) {
    envTplStatus('');
    if (btn) btn.disabled = false;
    toast('Apply failed: ' + (e && e.message ? e.message : String(e)));
  }
}

function envBufToB64(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, Array.prototype.slice.call(u8, i, Math.min(u8.length, i + 8192)));
  return btoa(bin);
}

async function envOpen(cid: string, entryId: string): Promise<void> {
  ENV_CORRECT = false;
  try {
    ENV_OPEN = await apiGetEnvelope(cid, entryId); ENV_OPEN_CID = cid;
    render();
  } catch (e: any) { toast(e && e.message ? e.message : String(e)); }
}

function envClose(): void { ENV_OPEN = null; ENV_CORRECT = false; render(); }

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
  const inflight = env.status === 'Sent' || env.status === 'Partially Signed';
  const editable = draft || (ENV_CORRECT && inflight);
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

  const recRows = (env.recipients || []).map((r, i) => (editable && r.status !== 'signed') ? `
    <div class="env-rec" data-i="${i}">
      <input class="env-rec-name" value="${esc(r.name)}" placeholder="Full name" oninput="envRecChange(${i},'name',this.value)">
      <input class="env-rec-email" value="${esc(r.email)}" placeholder="Email (for email link)" oninput="envRecChange(${i},'email',this.value)">
      <select onchange="envRecChange(${i},'kind',this.value)">
        ${ENV_KINDS.map(k => `<option value="${k.v}"${r.kind === k.v ? ' selected' : ''}>${esc(k.label)}</option>`).join('')}
      </select>
      <input class="env-rec-order" type="number" min="1" value="${r.routingOrder}" title="Signing order" onchange="envRecChange(${i},'routingOrder',this.value)">
      ${r.kind === 'external' ? `<input class="env-rec-code" value="${esc(r.accessCode || '')}" placeholder="Access code (optional)" title="They must enter this code to open their link — share it out-of-band" oninput="envRecChange(${i},'accessCode',this.value)">` : ''}
      <button class="ico-mini danger" title="Remove" onclick="envRecRemove(${i})">${ic('trash', 14)}</button>
    </div>` : envRecRoRow(c.id, env, r)).join('');

  return `<div class="section-head">
      <div><h3>${draft
        ? `<input id="env-title" class="env-title-input" value="${esc(env.title)}" onchange="envSaveRecipients()">`
        : esc(env.title)} ${envStatusPill(env.status, false)}</h3>
      <p>${draft ? 'Upload documents and add recipients. Field placement and sending come next.'
        : inflight ? (ENV_CORRECT ? 'Correcting — edit pending recipients, or open Place fields to move their fields.' : 'In flight — use Correct to edit recipients or move fields; Resend to nudge a signer.')
        : 'Read-only.'}</p></div>
      <div>
        <button class="btn ghost" onclick="envClose()">${ic('chevL', 14)} All agreements</button>
        ${editable ? `<a class="btn outline" href="#/designer/env/${esc(c.id)}/${esc(env.entryId)}">${ic('edit', 15)} Place fields${env.tabs && env.tabs.length ? ' (' + env.tabs.length + ')' : ''}</a>` : ''}
        ${draft ? `<button class="btn primary" onclick="envSendOpen('${esc(c.id)}','${esc(env.entryId)}')">${ic('mail', 15)} Send</button>` : ''}
        ${inflight && !ENV_CORRECT ? `<button class="btn outline" onclick="envCorrectStart()" title="Edit recipients or move fields on this sent envelope">${ic('edit', 15)} Correct</button>` : ''}
        ${ENV_CORRECT ? `<button class="btn primary" onclick="envCorrectDone('${esc(c.id)}','${esc(env.entryId)}')">Done correcting</button>` : ''}
        ${env.status === 'Completed' && env.signedPdf ? `<button class="btn primary" onclick="filesOpen('${esc(env.signedPdf)}')">${ic('download', 15)} Signed PDF</button>` : ''}
        ${env.status !== 'Draft' ? `<button class="btn ghost" onclick="envVerify('${esc(c.id)}','${esc(env.entryId)}')" title="Recompute the audit hash chain and completion hash">${ic('check', 14)} Verify</button>` : ''}
        ${env.status !== 'Completed' && env.status !== 'Voided' ? `<button class="btn ghost" onclick="envVoid('${esc(c.id)}','${esc(env.entryId)}',false)">${ic('trash', 14)} Void</button>` : ''}
      </div></div>
    ${ENV_CORRECT ? `<div class="env-correct-note">${ic('edit', 14)} Correcting a sent envelope — recipients who already signed are locked, and their placed fields can't move. Pending signers see the updated envelope on their existing link.</div>` : ''}
    ${envMetaLine(env)}
    <div class="card card-pad">
      <div class="agr-roles-h">Documents</div>
      ${docRows}
      ${draft ? `<button class="btn outline sm" onclick="envPickPdf()">${ic('upload', 14)} Add PDF</button>
        <span class="meta" style="margin-left:8px">PDF only · signed in the order shown</span>` : ''}
    </div>
    <div class="card card-pad" style="margin-top:14px">
      <div class="agr-roles-h">Recipients</div>
      ${recRows || '<p class="meta">No recipients yet.</p>'}
      ${editable ? `<button class="btn outline sm" onclick="envRecAdd()">${ic('plus', 14)} Add recipient</button>` : ''}
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

/* ---- send + in-app signing (phase 3) ---- */
async function envSend(cid: string, entryId: string, opts?: any): Promise<void> {
  try {
    const env = await apiSendEnvelope(cid, entryId, opts);
    ENV_OPEN = env;
    await loadEnvelopes(cid, true);
    const n = (env.notified || []).length;
    toast('Sent.' + (n ? ' ' + n + ' signing link' + (n === 1 ? '' : 's') + ' emailed.' : ' No one to email yet.'));
    render();
  } catch (e: any) { toast('Send failed: ' + (e && e.message ? e.message : String(e))); }
}

/* Send options — routing, expiration, reminders — chosen at send time. */
function envSendOpen(cid: string, entryId: string): void {
  const env = ENV_OPEN; if (!env) return;
  // readEnvelope always reports a routing (parallel by default), so an unsent draft
  // can't be told apart by its snapshot — default the checkbox ON for drafts.
  const seq = env.status === 'Draft' ? true : env.routing === 'sequential';
  const host = document.createElement('div');
  host.className = 'modal-overlay'; host.id = '__envSendOpts';
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" style="width:min(520px,94vw)">
    <div class="modal-head"><div><b>Send “${esc(env.title)}”</b><p>Each recipient gets a personal signing link by email.</p></div>
      <button class="ico-x" onclick="envSendClose()">${ic('x', 18)}</button></div>
    <div class="modal-body">
      <label class="agb-f-req"><input type="checkbox" id="env-opt-seq" ${seq ? 'checked' : ''}>
        Enforce signing order — a recipient is emailed only after everyone with a lower order number has finished</label>
      <div class="field" style="margin-top:12px"><label>Expires after (days — 0 = never)</label>
        <input id="env-opt-exp" type="number" min="0" value="${Number(env.expireDays) || 30}"></div>
      <div class="field"><label>Remind pending signers every (days — 0 = off)</label>
        <input id="env-opt-rem" type="number" min="0" value="${env.remindEveryDays == null ? 3 : Number(env.remindEveryDays)}"></div>
      ${envSenderTabs(env).length ? `<div class="env-sender-fields">
        <div class="agr-roles-h">Your fields (stamped onto the documents)</div>
        ${envSenderTabs(env).map(t => `<div class="field"><label>${esc(t.label || 'Sender field')}${t.required !== false ? ' *' : ''}</label>
          <input id="env-sv-${esc(t.id)}" value="${esc(((env.senderValues || {}) as any)[t.id] || '')}"></div>`).join('')}
      </div>` : ''}
    </div>
    <div class="modal-foot"><span class="modal-status"></span>
      <button class="btn ghost" onclick="envSendClose()">Cancel</button>
      <button class="btn primary" onclick="envSendConfirm('${esc(cid)}','${esc(entryId)}')">${ic('mail', 15)} Send</button></div>
  </div>`;
  document.body.appendChild(host);
}
function envSendClose(): void { const m = document.getElementById('__envSendOpts'); if (m) m.remove(); }
function envSendConfirm(cid: string, entryId: string): void {
  const seq = (document.getElementById('env-opt-seq') as HTMLInputElement | null);
  const exp = (document.getElementById('env-opt-exp') as HTMLInputElement | null);
  const rem = (document.getElementById('env-opt-rem') as HTMLInputElement | null);
  const senderValues: Record<string, any> = {};
  const env = ENV_OPEN;
  for (const t of (env ? envSenderTabs(env) : [])) {
    const inp = document.getElementById('env-sv-' + t.id) as HTMLInputElement | null;
    const v = inp ? inp.value.trim() : '';
    if (t.required !== false && !v) { toast('Fill in "' + (t.label || 'the sender field') + '" before sending.'); return; }
    senderValues[t.id] = v;
  }
  const opts = {
    routing: seq && seq.checked ? 'sequential' : 'parallel',
    expireDays: exp ? Math.max(0, Number(exp.value) || 0) : 0,
    remindEveryDays: rem ? Math.max(0, Number(rem.value) || 0) : 0,
    senderValues: senderValues,
  };
  envSendClose();
  envSend(cid, entryId, opts);
}

function envSenderTabs(env: Envelope): any[] {
  return (env.tabs || []).filter((t: any) => t.recipientId === '__sender__');
}

/* One recipient's read-only row: status-aware pill + the phase-4 actions. */
function envRecRoRow(cid: string, env: Envelope, r: EnvRecipient): string {
  const inflight = env.status === 'Sent' || env.status === 'Partially Signed';
  const turn = env.routing !== 'sequential' || (r.routingOrder || 1) === (env.activeOrder || 0);
  const kindLabel = (ENV_KINDS.find(k => k.v === r.kind) || { label: r.kind }).label;
  let pill: string;
  if (r.kind === 'cc') pill = `<span class="pill muted">CC</span>`;
  else if (r.status === 'signed') pill = `<span class="pill ok">Signed${r.signedAt ? ' · ' + esc(fmtDate(r.signedAt) || '') : ''}</span>`;
  else if (r.status === 'declined') pill = `<span class="pill warn">Declined</span>`;
  else if (inflight && !turn) pill = `<span class="pill muted" title="Earlier signers haven't finished yet">Waiting · order ${r.routingOrder}</span>`;
  else if (inflight) pill = `<span class="pill info">${r.notifiedAt ? 'Emailed' : 'Their turn'}</span>`;
  else pill = `<span class="pill draft">${esc(r.status)}</span>`;
  const acts: string[] = [];
  if (inflight && r.status === 'pending' && turn) {
    if (r.kind === 'external' && r.email) acts.push(`<button class="btn outline sm" onclick="envResend('${esc(cid)}','${esc(env.entryId)}','${esc(r.id)}')">${ic('mail', 13)} Resend</button>`);
    if (r.kind === 'consultant') acts.push(`<button class="btn primary sm" onclick="envSignNow('${esc(cid)}','${esc(env.entryId)}','${esc(r.id)}')">${ic('pen', 13)} Sign now</button>`);
    if (r.kind === 'inperson') acts.push(`<button class="btn primary sm" onclick="envHandOff('${esc(cid)}','${esc(env.entryId)}','${esc(r.id)}')">${ic('pen', 13)} Hand off to sign</button>`);
  }
  return `<div class="env-rec-ro">
    <div class="env-rec-ro-main"><b>${esc(r.name)}</b>
      <span class="meta">${esc(r.email || '')}${r.email ? ' · ' : ''}${esc(kindLabel)} · order ${r.routingOrder}</span>
      ${r.status === 'declined' && r.declineReason ? `<div class="meta env-decline-reason">“${esc(r.declineReason)}”</div>` : ''}</div>
    ${pill}<span class="env-rec-acts">${acts.join('')}</span>
  </div>`;
}

/* Envelope status line: routing / expiration / reminders, shown once sent. */
function envMetaLine(env: Envelope): string {
  if (env.status === 'Draft') return '';
  const bits: string[] = [];
  bits.push(env.routing === 'sequential' ? 'Signing order enforced' : 'All signers at once');
  if (env.expiresAt) bits.push('Expires ' + (fmtDate(String(env.expiresAt).slice(0, 10)) || env.expiresAt)); // fmtDate wants a bare date, expiresAt is a full ISO stamp
  if (env.remindEveryDays) bits.push('Reminders every ' + env.remindEveryDays + ' day' + (env.remindEveryDays === 1 ? '' : 's'));
  if (env.senderName) bits.push('Sent by ' + env.senderName);
  return `<div class="env-meta-line meta">${bits.map(esc).join(' · ')}</div>`;
}

async function envResend(cid: string, entryId: string, recipientId: string): Promise<void> {
  try {
    ENV_OPEN = await apiResendEnvelope(cid, entryId, recipientId);
    toast('Signing link re-emailed.');
    render();
  } catch (e: any) { toast('Resend failed: ' + (e && e.message ? e.message : String(e))); }
}

/* Verify integrity (phase 6): recompute the audit chain + completion hash. */
async function envVerify(cid: string, entryId: string): Promise<void> {
  try {
    const v = await apiVerifyEnvelope(cid, entryId);
    const host = document.createElement('div');
    host.className = 'modal-overlay'; host.id = '__envVerify';
    host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" style="width:min(560px,94vw)">
      <div class="modal-head"><div><b>Integrity check</b><p>Audit hash chain + completion record hash.</p></div>
        <button class="ico-x" onclick="document.getElementById('__envVerify').remove()">${ic('x', 18)}</button></div>
      <div class="modal-body">
        <div class="env-verify-line ${v.firstBreak ? 'bad' : 'good'}">${v.firstBreak
          ? `${ic('x', 15)} <b>Audit chain BROKEN</b> at event #${v.firstBreak.index + 1} (“${esc(v.firstBreak.event)}”, ${esc(fmtDate(v.firstBreak.at) || v.firstBreak.at || '')}): ${esc(v.firstBreak.reason)}`
          : `${ic('check', 15)} Audit chain intact — ${v.chained} chained event${v.chained === 1 ? '' : 's'} verified${v.unchainedLegacy ? ' (' + v.unchainedLegacy + ' pre-chain event' + (v.unchainedLegacy === 1 ? '' : 's') + ' skipped)' : ''}.`}</div>
        ${v.documentHash && v.documentHash.stored ? `<div class="env-verify-line ${v.documentHash.match === false ? 'bad' : 'good'}">${v.documentHash.match === false
          ? `${ic('x', 15)} <b>Completion hash MISMATCH</b> — the signing record changed after completion.`
          : `${ic('check', 15)} Completion record hash matches: <code>${esc(String(v.documentHash.stored).slice(0, 32))}…</code>`}</div>`
        : '<div class="env-verify-line meta">No completion hash yet (envelope not completed).</div>'}
      </div></div>`;
    document.body.appendChild(host);
  } catch (e: any) { toast('Verify failed: ' + (e && e.message ? e.message : String(e))); }
}

/* Correction mode (phase 4): edit recipients / move fields on a Sent envelope. */
function envCorrectStart(): void { ENV_CORRECT = true; render(); }
async function envCorrectDone(cid: string, entryId: string): Promise<void> {
  ENV_CORRECT = false;
  try { ENV_OPEN = await apiGetEnvelope(cid, entryId); } catch (_e) { /* keep local */ }
  toast('Corrections saved. Pending signers see the updated envelope on their existing links — use Resend to nudge them.');
  render();
}

/* In-person hand-off: a full-screen prompt so staff deliberately hands the device
   over, then the same in-app signing view the consultant uses. */
function envHandOff(cid: string, entryId: string, recipientId: string): void {
  const env = ENV_OPEN; if (!env) return;
  const r = (env.recipients || []).find(x => x.id === recipientId); if (!r) return;
  const host = document.createElement('div');
  host.className = 'modal-overlay'; host.id = '__envHand';
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" style="width:min(460px,94vw)">
    <div class="modal-body env-hand">
      <div class="env-hand-ico">${ic('pen', 24)}</div>
      <h2>Hand the device to ${esc(r.name)}</h2>
      <p class="meta">They'll review the documents and sign right here, in person. Take the device back when they finish.</p>
      <div class="env-hand-acts">
        <button class="btn ghost" onclick="envHandClose()">Cancel</button>
        <button class="btn primary" onclick="envHandBegin('${esc(cid)}','${esc(entryId)}','${esc(recipientId)}')">Begin signing</button>
      </div>
    </div></div>`;
  document.body.appendChild(host);
}
function envHandClose(): void { const m = document.getElementById('__envHand'); if (m) m.remove(); }
function envHandBegin(cid: string, entryId: string, recipientId: string): void {
  envHandClose();
  envSignNow(cid, entryId, recipientId);
}

/* Full-screen in-app signing on the SAME shared signview the parent page uses. */
function envSignNow(cid: string, entryId: string, recipientId?: string): void {
  const env = ENV_OPEN;
  if (!env) return;
  const me = recipientId
    ? (env.recipients || []).find(r => r.id === recipientId)
    : (env.recipients || []).find(r => (r.kind === 'consultant' || r.kind === 'inperson') && r.status === 'pending');
  if (!me || me.status !== 'pending') { toast('Nothing to sign.'); return; }
  const host = document.createElement('div');
  host.className = 'modal-overlay';
  host.id = '__envSign';
  host.innerHTML = `<div class="modal-card env-sign-card" role="dialog" aria-modal="true">
    <div class="modal-head"><div><b>${esc(env.title)}</b><p>Complete your fields, then Finish.</p></div>
      <button class="ico-x" onclick="envSignClose()">${ic('x', 18)}</button></div>
    <div class="modal-body"><div id="sv-host"></div>
      ${env.disclosure && env.disclosure.text ? `<details class="env-disc"><summary>Electronic records &amp; signatures disclosure (version ${esc(env.disclosure.version)})</summary>
        <pre class="env-disc-text">${esc(env.disclosure.text)}</pre></details>` : ''}
      <label class="sg-consent"><input type="checkbox" id="env-consent" onchange="svUpdateProgress()">
        I have read the disclosure above, adopt this signature, and agree it is legally binding.</label></div>
  </div>`;
  document.body.appendChild(host);
  svMount({
    container: document.getElementById('sv-host')!,
    env: env,
    meId: me.id,
    submit: (p) => {
      const consent = document.getElementById('env-consent') as HTMLInputElement | null;
      if (!consent || !consent.checked) return Promise.reject(new Error('Please check the consent box.'));
      return apiSignEnvelope(cid, entryId, me.id, p.signatureData, p.typedName, p.tabValues);
    },
    onDone: async (res) => {
      envSignClose();
      ENV_OPEN = res && res.entryId ? res : null;
      await loadEnvelopes(cid, true);
      toast(res && res.completed ? 'Signed — envelope complete. The signed PDF is on file.' : 'Signed.');
      render();
    },
  });
}

function envSignClose(): void {
  sigCloseModal(); sigOnChange(null); sigResetAdopted();
  const m = document.getElementById('__envSign');
  if (m) m.remove();
}
