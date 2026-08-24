/* =====================================================================
   agreements.ts — the Agreements tab: envelopes (schema v3, DocuSign model).

   An envelope is N uploaded PDFs + M recipients + placed tabs, one status, one
   audit trail. Documents are AUTHORED ELSEWHERE (Word → PDF) and uploaded; the
   old rich-text builder and its {{token}} grammar are retired.

   This phase (1) covers the envelope object: list, create, upload/reorder/remove
   documents, recipients, void. Field placement is phase 2; sending and signing
   are phase 3 — the Send button exists but is disabled with an honest tooltip.

   Legacy authored agreements remain readable forever: listEnvelopes returns them
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
function envStatusPill(status: string, _legacy?: boolean): string {
  const cls = status === 'Completed' ? 'ok' : status === 'Voided' || status === 'Declined' ? 'muted'
    : status === 'Draft' ? 'draft' : 'info';
  return `<span class="pill ${cls}">${esc(status)}</span>`;
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
    const open = `<button class="btn outline sm" onclick="envOpen('${esc(c.id)}','${esc(r.entryId)}')">${ic('chevR', 14)} Open</button>`;
    const voidBtn = (r.status !== 'Completed' && r.status !== 'Voided')
      ? `<button class="btn ghost sm" onclick="envVoid('${esc(c.id)}','${esc(r.entryId)}')">${ic('trash', 14)} Void</button>` : '';
    return `<div class="card env-row">
      <div class="env-row-main">
        <div class="env-row-title"><b>${esc(r.title)}</b> ${envStatusPill(r.status)}</div>
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
  // Only ACTIVE templates are offered for sending — Draft is the authoring state.
  try { tpls = ((await apiListAgreementTemplates()) || []).filter((t: any) => t.bodyJson && t.bodyJson.schemaVersion === 3 && (t.bodyJson.documents || []).length && t.status === 'Active'); }
  catch (_e) { tpls = []; }
  if (!tpls.length) { envNewBlank(cid); return; }
  ENV_TPLS = tpls;
  const host = document.createElement('div');
  host.className = 'modal-overlay'; host.id = '__envTpl';
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" style="width:min(560px,94vw)">
    <div class="modal-head"><div><b>New envelope</b><p>Pick every agreement this client needs — they combine into one envelope, one signing session.</p></div>
      <button class="ico-x" onclick="envTplClose()">${ic('x', 18)}</button></div>
    <div class="modal-body">
      <div class="env-tpl-list">
        ${tpls.map((t: any, i: number) => `<label class="env-tpl-row env-tpl-check">
          <input type="checkbox" id="env-pack-t-${i}" onchange="envPackSum()">
          <span class="env-tpl-check-body"><b>${esc(t.name)}</b><span class="meta">${(t.bodyJson.documents || []).length} PDF${(t.bodyJson.documents || []).length === 1 ? '' : 's'}
          · ${(t.bodyJson.tabs || []).length} field${(t.bodyJson.tabs || []).length === 1 ? '' : 's'}</span></span>
        </label>`).join('')}
      </div>
    </div>
    <div class="modal-foot"><span class="modal-status" id="env-pack-sum">Nothing selected.</span>
      <button class="btn ghost" onclick="envTplClose()">Cancel</button>
      <button class="btn outline" onclick="envTplClose(); envNewBlank('${esc(cid)}')">Blank envelope</button>
      <button class="btn primary" id="env-pack-next" onclick="envPackNext('${esc(cid)}')" disabled>Continue</button></div>
  </div>`;
  document.body.appendChild(host);
}

/* ---- packet composition (multi-template envelopes) ----
   Programs author ONE template per agreement; at enrollment the consultant
   multi-selects the subset that applies and the templates compose into one
   envelope — one recipient set, one routing order, one signing session. Roles
   are consolidated across templates by trimmed case-insensitive name (the same
   rule "Add from template" matches by). A near-miss like "Parent" vs
   "Parent / Guardian" shows as two rows — visible at compose time, and NEVER
   auto-merged (guessing wrong silently is worse than asking). */
let ENV_PACK: { tpls: any[]; roles: { key: string; label: string; optional: boolean; from: string[] }[] } | null = null;

/* Slots of one template + consolidation keys. Two DISTINCT roles sharing a name
   inside one template (the dual-sponsor pattern: "Parent / Guardian" twice) are
   different people, so duplicate labels are occurrence-numbered: the 2nd
   "Parent / Guardian" keys as "parent / guardian#2" and displays "(2)". Across
   templates, occurrence N of a name merges with occurrence N of the same name. */
function envPackKeys(body: any): { slot: { id: string; label: string; optional: boolean }; key: string; label: string }[] {
  const seen: { [k: string]: number } = {};
  return envTplSlots(body).map(sl => {
    const base = sl.label.trim().toLowerCase();
    const n = (seen[base] = (seen[base] || 0) + 1);
    return { slot: sl, key: n === 1 ? base : base + '#' + n, label: n === 1 ? sl.label : sl.label + ' (' + n + ')' };
  });
}

function envPackSel(): any[] {
  return ENV_TPLS.filter((_t: any, i: number) => {
    const cb = document.getElementById('env-pack-t-' + i) as HTMLInputElement | null;
    return !!(cb && cb.checked);
  });
}

function envPackSum(): void {
  const sel = envPackSel();
  const docs = sel.reduce((n: number, t: any) => n + (t.bodyJson.documents || []).length, 0);
  const flds = sel.reduce((n: number, t: any) => n + (t.bodyJson.tabs || []).length, 0);
  const el = document.getElementById('env-pack-sum');
  if (el) el.textContent = sel.length
    ? sel.length + ' template' + (sel.length === 1 ? '' : 's') + ' · ' + docs + ' PDF' + (docs === 1 ? '' : 's') + ' · ' + flds + ' field' + (flds === 1 ? '' : 's')
    : 'Nothing selected.';
  const btn = document.getElementById('env-pack-next') as HTMLButtonElement | null;
  if (btn) btn.disabled = !sel.length;
}

function envPackNext(cid: string): void {
  const sel = envPackSel();
  if (!sel.length) return;
  // One template = the proven single-template flow, unchanged.
  if (sel.length === 1) { envTplPick(cid, sel[0].entryId); return; }
  envPackRoles(cid, sel);
}

/* Consolidated-role assignment step. `optional` only survives if the role is
   optional in EVERY template that needs it — required anywhere wins. */
async function envPackRoles(cid: string, sel: any[]): Promise<void> {
  if (contactsState(cid).list === null) { try { await loadContacts(cid); } catch (_e) { /* picker just stays empty */ } }
  envBuildPickOpts(cid);
  const roles: { key: string; label: string; optional: boolean; from: string[] }[] = [];
  const byKey: { [k: string]: { key: string; label: string; optional: boolean; from: string[] } } = {};
  for (const t of sel) {
    for (const k of envPackKeys(t.bodyJson)) {
      let r = byKey[k.key];
      if (!r) { r = { key: k.key, label: k.label, optional: k.slot.optional, from: [] }; byKey[k.key] = r; roles.push(r); }
      if (!k.slot.optional) r.optional = false;
      if (r.from.indexOf(t.name) < 0) r.from.push(t.name);
    }
  }
  ENV_PACK = { tpls: sel, roles: roles };
  const m = document.getElementById('__envTpl');
  if (!m) return;
  m.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" style="width:min(640px,94vw)">
    <div class="modal-head"><div><b>Who signs?</b><p>These ${sel.length} templates need ${roles.length} role${roles.length === 1 ? '' : 's'}. The same name in two templates is the same person here.</p></div>
      <button class="ico-x" onclick="envTplClose()">${ic('x', 18)}</button></div>
    <div class="modal-body">
      <div class="field"><label>Envelope title</label><input id="env-tpl-title" placeholder="e.g. Admissions Packet"></div>
      <p class="env-pack-note">Seeing two rows for the same person (e.g. "Parent" and "Parent / Guardian")? The templates spell that role differently — you can assign both to the same person now, and align the role names in the designer later.</p>
      ${roles.map((r, i) => `<div class="env-tpl-slot">
        <div class="env-tpl-slot-h">${esc(r.label)}${r.optional ? ' <span class="env-slot-opt">optional — leave blank to skip</span>' : ''}</div>
        <div class="env-pack-from">in: ${esc(r.from.join(', '))}</div>
        <div class="env-rec">
          ${envPickSelect(`envSlotPick(${i},this.value)`)}
          <input class="env-rec-name" id="env-slot-name-${i}" placeholder="Full name">
          <input class="env-rec-email" id="env-slot-email-${i}" placeholder="Email (for email link)">
          <select id="env-slot-kind-${i}">${ENV_KINDS.filter(k => k.v !== 'cc').map(k => `<option value="${k.v}">${esc(k.label)}</option>`).join('')}</select>
          <input class="env-rec-order" id="env-slot-order-${i}" type="number" min="1" value="1" title="Signing order">
        </div></div>`).join('')}
    </div>
    <div class="modal-foot"><span class="modal-status" id="env-tpl-status"></span>
      <button class="btn ghost" onclick="envTplClose(); envNew('${esc(cid)}')">Back</button>
      <button class="btn primary" id="env-tpl-create" onclick="envPackCreate('${esc(cid)}')">Create envelope</button></div>
  </div>`;
}

/* Create the packet: one envelope, the consolidated recipients set ONCE, then
   each template's documents copied and tabs remapped in selection order. The
   slot→recipient mapping goes through the consolidated role KEY — never by
   index across templates. A mid-loop failure keeps the draft valid: documents
   copied so far stay, their tabs are saved best-effort, and the toast names
   the template that failed. */
async function envPackCreate(cid: string): Promise<void> {
  const p = ENV_PACK;
  if (!p) return;
  const g = (id: string) => (document.getElementById(id) as HTMLInputElement | null);
  const title = (g('env-tpl-title') && g('env-tpl-title')!.value.trim())
    || 'Signing packet (' + p.tpls.length + ' agreements)';
  const filled: any[] = []; const roleToIdx: { [key: string]: number } = {};
  for (let i = 0; i < p.roles.length; i++) {
    const r = p.roles[i];
    const name = g('env-slot-name-' + i) ? g('env-slot-name-' + i)!.value.trim() : '';
    if (!name) {
      if (r.optional) continue;
      toast('"' + r.label + '" needs a name (or mark the role optional in its templates).'); return;
    }
    roleToIdx[r.key] = filled.length;
    filled.push({
      role: r.label, name: name,
      email: g('env-slot-email-' + i) ? g('env-slot-email-' + i)!.value.trim() : '',
      kind: (document.getElementById('env-slot-kind-' + i) as HTMLSelectElement | null)?.value || 'external',
      routingOrder: Math.max(1, Number(g('env-slot-order-' + i)?.value) || 1),
    });
  }
  if (!filled.length) { toast('At least one signer is needed.'); return; }
  const btn = document.getElementById('env-tpl-create') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  let env: any = null; const allTabs: any[] = []; let failedTpl = '';
  try {
    envTplStatus('Creating envelope…');
    env = await apiCreateEnvelope(cid, title);
    env = await apiSetEnvelopeRecipients(cid, env.entryId, filled, title);
    // consolidated role key → real recipient id (server materializes in order sent)
    const keyToRid: { [k: string]: string } = {};
    for (const k in roleToIdx) {
      if (!Object.prototype.hasOwnProperty.call(roleToIdx, k)) continue;
      keyToRid[k] = env.recipients[roleToIdx[k]] ? env.recipients[roleToIdx[k]].id : '';
    }
    let done = 0;
    const totalDocs = p.tpls.reduce((n: number, t: any) => n + (t.bodyJson.documents || []).length, 0);
    for (const t of p.tpls) {
      failedTpl = t.name;
      const body = t.bodyJson;
      // THIS template's slot id → consolidated role key → recipient id
      const slotKey: { [sid: string]: string } = {};
      for (const k of envPackKeys(body)) slotKey[k.slot.id] = k.key;
      const mapSlot = (slot: string) => slot === '__sender__' ? '__sender__' : (keyToRid[slotKey[slot] || ''] || null);
      const docs = (body.documents || []).slice().sort((a: any, b: any) => a.order - b.order);
      for (const doc of docs) {
        done++;
        envTplStatus(`Copying "${doc.name}" (${done}/${totalDocs})…`);
        const resp = await fetch(doc.sourceUrl, { credentials: 'include' });
        if (!resp.ok) throw new Error('Could not fetch template PDF "' + doc.name + '" (' + resp.status + ').');
        const b64 = envBufToB64(await resp.arrayBuffer());
        env = await apiUploadEnvelopeDoc(cid, env.entryId, doc.name, b64, doc.pages || 0);
        const newDoc = env.documents[env.documents.length - 1];
        for (const tb of (body.tabs || [])) {
          if (tb.docId !== doc.id) continue;
          const rid = mapSlot(String(tb.recipientId));
          if (!rid) continue;
          allTabs.push({ ...tb, id: 't_' + Math.random().toString(36).slice(2, 10), docId: newDoc.id, recipientId: rid });
        }
      }
      failedTpl = '';
    }
    envTplStatus('Saving ' + allTabs.length + ' fields…');
    env = await apiSaveEnvelopeTabs(cid, env.entryId, allTabs);
    envTplClose();
    ENV_PACK = null;
    ENV_OPEN = env; ENV_OPEN_CID = cid;
    await loadEnvelopes(cid, true);
    toast('Envelope created — ' + p.tpls.length + ' agreements, ' + allTabs.length + ' fields.');
    render();
  } catch (e: any) {
    // Keep what copied so far — the draft stays valid and editable.
    if (env && allTabs.length) { try { env = await apiSaveEnvelopeTabs(cid, env.entryId, allTabs); } catch (_e2) { /* best-effort */ } }
    envTplStatus('');
    if (btn) btn.disabled = false;
    const msg = e && e.message ? e.message : String(e);
    if (env) {
      ENV_OPEN = env; ENV_OPEN_CID = cid;
      try { await loadEnvelopes(cid, true); } catch (_e3) { /* list refresh only */ }
      envTplClose(); render();
      toast((failedTpl ? '"' + failedTpl + '" failed: ' : 'Packet failed: ') + msg + ' — the draft keeps what was copied.');
    } else {
      toast('Create failed: ' + msg);
    }
  }
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

/* ---- composite templates (DocuSign-style): add a template to a DRAFT ----
   The category problem: standard vs accelerated packets share most paperwork.
   Instead of duplicating whole packet templates, keep a core template plus small
   addenda and stack them into ONE envelope. Roles are matched to the envelope's
   existing recipients BY NAME (how DocuSign matches composite-template roles);
   unmatched roles add a new person, optional roles can be skipped. */
async function envAddTpl(cid: string, entryId: string): Promise<void> {
  let tpls: any[] = [];
  try { tpls = ((await apiListAgreementTemplates()) || []).filter((t: any) => t.bodyJson && t.bodyJson.schemaVersion === 3 && (t.bodyJson.documents || []).length && t.status === 'Active'); }
  catch (_e) { tpls = []; }
  if (!tpls.length) { toast('No active templates to add.'); return; }
  ENV_TPLS = tpls;
  const host = document.createElement('div');
  host.className = 'modal-overlay'; host.id = '__envTpl';
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" style="width:min(560px,94vw)">
    <div class="modal-head"><div><b>Add from template</b><p>Its documents and fields append to this envelope — recipients are shared.</p></div>
      <button class="ico-x" onclick="envTplClose()">${ic('x', 18)}</button></div>
    <div class="modal-body">
      <div class="env-tpl-list">
        ${tpls.map((t: any) => `<button class="env-tpl-row" onclick="envTplPick('${esc(cid)}','${esc(t.entryId)}','${esc(entryId)}')">
          <b>${esc(t.name)}</b><span class="meta">${(t.bodyJson.documents || []).length} PDF${(t.bodyJson.documents || []).length === 1 ? '' : 's'}
          · ${(t.bodyJson.tabs || []).length} field${(t.bodyJson.tabs || []).length === 1 ? '' : 's'}</span>
        </button>`).join('')}
      </div>
    </div>
    <div class="modal-foot"><span class="modal-status"></span>
      <button class="btn ghost" onclick="envTplClose()">Cancel</button></div>
  </div>`;
  document.body.appendChild(host);
}

/* One role row of the add-mapping form: assign to an existing recipient (name
   match preselected), bring in a new person, or skip an optional role. */
function envAddRoleRow(env: Envelope, sl: { id: string; label: string; optional: boolean }, i: number): string {
  const match = (env.recipients || []).find(r => (r.role || '').trim().toLowerCase() === sl.label.trim().toLowerCase());
  const pre = match ? match.id : '__new__';
  return `<div class="env-tpl-slot">
    <div class="env-tpl-slot-h">${esc(sl.label)}${sl.optional ? ' <span class="env-slot-opt">optional</span>' : ''}</div>
    <div class="env-rec">
      <select id="env-slot-map-${i}" onchange="envAddMapChange(${i})">
        ${(env.recipients || []).map(r => `<option value="${esc(r.id)}"${pre === r.id ? ' selected' : ''}>${esc(r.name)}${r.role ? ' — ' + esc(r.role) : ''}${pre === r.id ? ' (matched)' : ''}</option>`).join('')}
        <option value="__new__"${pre === '__new__' ? ' selected' : ''}>New person…</option>
        ${sl.optional ? `<option value="__skip__">Skip — leave this role out</option>` : ''}
      </select>
    </div>
    <div class="env-rec" id="env-slot-new-${i}" style="${pre === '__new__' ? '' : 'display:none'}">
      ${envPickSelect(`envSlotPick(${i},this.value)`)}
      <input class="env-rec-name" id="env-slot-name-${i}" placeholder="Full name">
      <input class="env-rec-email" id="env-slot-email-${i}" placeholder="Email (for email link)">
      <select id="env-slot-kind-${i}">${ENV_KINDS.filter(k => k.v !== 'cc').map(k => `<option value="${k.v}">${esc(k.label)}</option>`).join('')}</select>
      <input class="env-rec-order" id="env-slot-order-${i}" type="number" min="1" value="1" title="Signing order">
    </div></div>`;
}
function envAddMapChange(i: number): void {
  const sel = document.getElementById('env-slot-map-' + i) as HTMLSelectElement | null;
  const row = document.getElementById('env-slot-new-' + i);
  if (sel && row) row.style.display = sel.value === '__new__' ? '' : 'none';
}

/* Append the picked template to the open draft: merge recipients, copy PDFs,
   remap and append tabs. Everything rides existing draft-editing actions. */
async function envTplAddApply(cid: string, tplEntryId: string): Promise<void> {
  const t = ENV_TPLS.find((x: any) => x.entryId === tplEntryId);
  const env0 = ENV_OPEN;
  if (!t || !env0) return;
  const body = t.bodyJson;
  const slots = envTplSlots(body);
  const g = (id: string) => (document.getElementById(id) as HTMLInputElement | null);
  // resolve each slot: existing rid | new person | skipped
  const slotPick: { slot: any; rid?: string; add?: any }[] = [];
  for (let i = 0; i < slots.length; i++) {
    const sel = (document.getElementById('env-slot-map-' + i) as HTMLSelectElement | null);
    const v = sel ? sel.value : '__new__';
    if (v === '__skip__') continue;
    if (v === '__new__') {
      const name = g('env-slot-name-' + i) ? g('env-slot-name-' + i)!.value.trim() : '';
      if (!name) {
        if (slots[i].optional) continue; // blank optional = skipped
        toast('"' + slots[i].label + '" needs a person — pick an existing recipient or enter a name.'); return;
      }
      slotPick.push({ slot: slots[i], add: {
        role: slots[i].label, name: name,
        email: g('env-slot-email-' + i) ? g('env-slot-email-' + i)!.value.trim() : '',
        kind: (document.getElementById('env-slot-kind-' + i) as HTMLSelectElement | null)?.value || 'external',
        routingOrder: Math.max(1, Number(g('env-slot-order-' + i)?.value) || 1),
      } });
    } else slotPick.push({ slot: slots[i], rid: v });
  }
  const btn = document.getElementById('env-tpl-create') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  try {
    let env = env0;
    const adds = slotPick.filter(sp => sp.add);
    if (adds.length) {
      envTplStatus('Adding ' + adds.length + ' recipient' + (adds.length === 1 ? '' : 's') + '…');
      // existing recipients go back verbatim WITH ids (the server preserves state
      // by id); new ones follow and come back in order after them.
      const keep = (env.recipients || []).map(r => ({ id: r.id, role: r.role, name: r.name, email: r.email, kind: r.kind, routingOrder: r.routingOrder, accessCode: (r as any).accessCode }));
      env = await apiSetEnvelopeRecipients(cid, env.entryId, keep.concat(adds.map(a => a.add)), env.title);
      for (let j = 0; j < adds.length; j++) {
        const nr = env.recipients[keep.length + j];
        if (nr) adds[j].rid = nr.id;
      }
    }
    const slotToRid: { [slot: string]: string } = {};
    for (const sp of slotPick) if (sp.rid) slotToRid[sp.slot.id] = sp.rid;
    const mapSlot = (slot: string) => slot === '__sender__' ? '__sender__' : (slotToRid[slot] || null);
    const newTabs: any[] = [];
    const docs = (body.documents || []).slice().sort((a: any, b: any) => a.order - b.order);
    for (let di = 0; di < docs.length; di++) {
      const doc = docs[di];
      envTplStatus(`Copying "${doc.name}" (${di + 1}/${docs.length})…`);
      const resp = await fetch(doc.sourceUrl, { credentials: 'include' });
      if (!resp.ok) throw new Error('Could not fetch template PDF "' + doc.name + '" (' + resp.status + ').');
      const b64 = envBufToB64(await resp.arrayBuffer());
      env = await apiUploadEnvelopeDoc(cid, env.entryId, doc.name, b64, doc.pages || 0);
      const newDoc = env.documents[env.documents.length - 1];
      for (const tb of (body.tabs || [])) {
        if (tb.docId !== doc.id) continue;
        const rid = mapSlot(String(tb.recipientId));
        if (!rid) continue;
        newTabs.push({ ...tb, id: 't_' + Math.random().toString(36).slice(2, 10), docId: newDoc.id, recipientId: rid });
      }
    }
    envTplStatus('Saving ' + newTabs.length + ' fields…');
    env = await apiSaveEnvelopeTabs(cid, env.entryId, (env.tabs || []).concat(newTabs));
    envTplClose();
    ENV_OPEN = env; ENV_OPEN_CID = cid;
    await loadEnvelopes(cid, true);
    toast('"' + t.name + '" added — ' + docs.length + ' document' + (docs.length === 1 ? '' : 's') + ', ' + newTabs.length + ' fields.');
    render();
  } catch (e: any) {
    envTplStatus('');
    if (btn) btn.disabled = false;
    toast('Add failed: ' + (e && e.message ? e.message : String(e)));
  }
}

/* ---- apply a template (phase 5) ---- */
let ENV_TPLS: any[] = [];
function envTplClose(): void { const m = document.getElementById('__envTpl'); if (m) m.remove(); }

/* One apply-form slot per template role. Optional roles may be left blank —
   that person and every field assigned to them are omitted from the envelope
   (tabs and anchor rules whose slot has no recipient are dropped by the mapping
   already). Legacy holders:2 templates still expand into two slots, read-only. */
function envTplSlots(body: any): { id: string; label: string; optional: boolean }[] {
  const out: { id: string; label: string; optional: boolean }[] = [];
  for (const r of (body.roles || [])) {
    const base = r.name || 'Signer';
    out.push({ id: r.id, label: r.holders === 2 ? base + ' (1)' : base, optional: !!r.optional });
    if (r.holders === 2) out.push({ id: r.id + '~2', label: base + ' (2)', optional: !!r.optional });
  }
  return out;
}

async function envTplPick(cid: string, tplEntryId: string, addTo?: string): Promise<void> {
  const t = ENV_TPLS.find((x: any) => x.entryId === tplEntryId);
  if (!t) return;
  // Contacts feed the per-slot picker — have them ready before the modal draws.
  if (contactsState(cid).list === null) { try { await loadContacts(cid); } catch (_e) { /* picker just stays empty */ } }
  envBuildPickOpts(cid);
  const slots = envTplSlots(t.bodyJson);
  const m = document.getElementById('__envTpl');
  if (!m) return;
  if (addTo && ENV_OPEN) {
    // ADD mode: map the template's roles onto the envelope's existing recipients.
    m.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" style="width:min(640px,94vw)">
      <div class="modal-head"><div><b>${esc(t.name)}</b><p>Who fills each of its roles on this envelope?</p></div>
        <button class="ico-x" onclick="envTplClose()">${ic('x', 18)}</button></div>
      <div class="modal-body">
        ${slots.map((sl, i) => envAddRoleRow(ENV_OPEN!, sl, i)).join('')}
      </div>
      <div class="modal-foot"><span class="modal-status" id="env-tpl-status"></span>
        <button class="btn ghost" onclick="envTplClose()">Cancel</button>
        <button class="btn primary" id="env-tpl-create" onclick="envTplAddApply('${esc(cid)}','${esc(tplEntryId)}')">Add to envelope</button></div>
    </div>`;
    return;
  }
  m.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" style="width:min(640px,94vw)">
    <div class="modal-head"><div><b>${esc(t.name)}</b><p>Who fills each role?</p></div>
      <button class="ico-x" onclick="envTplClose()">${ic('x', 18)}</button></div>
    <div class="modal-body">
      <div class="field"><label>Envelope title</label><input id="env-tpl-title" value="${esc(t.name)}"></div>
      ${slots.map((sl, i) => `<div class="env-tpl-slot">
        <div class="env-tpl-slot-h">${esc(sl.label)}${sl.optional ? ' <span class="env-slot-opt">optional — leave blank to skip</span>' : ''}</div>
        <div class="env-rec">
          ${envPickSelect(`envSlotPick(${i},this.value)`)}
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
    role: sl.label,
    name: g('env-slot-name-' + i) ? g('env-slot-name-' + i)!.value.trim() : '',
    email: g('env-slot-email-' + i) ? g('env-slot-email-' + i)!.value.trim() : '',
    kind: (document.getElementById('env-slot-kind-' + i) as HTMLSelectElement | null)?.value || 'external',
    routingOrder: Math.max(1, Number(g('env-slot-order-' + i)?.value) || 1),
  }));
  // Optional roles may be skipped: a blank name omits that person and their fields.
  for (let i = 0; i < recipients.length; i++) {
    if (!recipients[i].name && !slots[i].optional) { toast('"' + slots[i].label + '" needs a name (or mark the role optional in the template).'); return; }
  }
  const skipped = recipients.filter((r, i) => !r.name && slots[i].optional).length;
  const filled: any[] = []; const filledSlotIds: string[] = [];
  recipients.forEach((r, i) => { if (r.name) { filled.push(r); filledSlotIds.push(slots[i].id); } });
  const btn = document.getElementById('env-tpl-create') as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  try {
    envTplStatus('Creating envelope…');
    let env = await apiCreateEnvelope(cid, title);
    env = await apiSetEnvelopeRecipients(cid, env.entryId, filled, title);
    // slot id → real recipient id: the server materializes recipients in the
    // order sent, so pair by index (role text is display/matching only).
    const slotToRid: { [slot: string]: string } = {};
    for (let ri = 0; ri < filledSlotIds.length && ri < env.recipients.length; ri++) slotToRid[filledSlotIds[ri]] = env.recipients[ri].id;
    const mapSlot = (slot: string) => slot === '__sender__' ? '__sender__' : (slotToRid[slot] || null);
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
    }
    envTplStatus('Saving ' + allTabs.length + ' fields…');
    env = await apiSaveEnvelopeTabs(cid, env.entryId, allTabs);
    envTplClose();
    ENV_OPEN = env; ENV_OPEN_CID = cid;
    await loadEnvelopes(cid, true);
    toast('Envelope created from template — ' + allTabs.length + ' fields placed'
      + (skipped ? ' (' + skipped + ' optional role' + (skipped === 1 ? '' : 's') + ' skipped)' : '') + '.');
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

async function envVoid(cid: string, entryId: string): Promise<void> {
  const reason = prompt('Void this envelope? Recipients will no longer be able to sign.\nReason (optional):', '');
  if (reason == null) return;
  try {
    await apiVoidEnvelope(cid, entryId, reason);
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
  envBuildPickOpts(c.id);
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
      ${envPickSelect(`envRecPick(${i},this.value)`)}
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
        ${draft ? `<button class="btn outline" onclick="envAddTpl('${esc(c.id)}','${esc(env.entryId)}')" title="Append another template's documents and fields to this envelope (DocuSign-style composite)">${ic('plus', 15)} Add from template</button>
        <button class="btn primary" onclick="envSendOpen('${esc(c.id)}','${esc(env.entryId)}')">${ic('mail', 15)} Send</button>` : ''}
        ${inflight && !ENV_CORRECT ? `<button class="btn outline" onclick="envCorrectStart()" title="Edit recipients or move fields on this sent envelope">${ic('edit', 15)} Correct</button>` : ''}
        ${ENV_CORRECT ? `<button class="btn primary" onclick="envCorrectDone('${esc(c.id)}','${esc(env.entryId)}')">Done correcting</button>` : ''}
        ${env.status === 'Completed' ? envSignedDownloads(env) : ''}
        ${env.status !== 'Draft' ? `<button class="btn ghost" onclick="envVerify('${esc(c.id)}','${esc(env.entryId)}')" title="Recompute the audit hash chain and completion hash">${ic('check', 14)} Verify</button>` : ''}
        ${env.status !== 'Completed' && env.status !== 'Voided' ? `<button class="btn ghost" onclick="envVoid('${esc(c.id)}','${esc(env.entryId)}')">${ic('trash', 14)} Void</button>` : ''}
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
  const hasSender = envSenderTabs(env).length > 0;
  const host = document.createElement('div');
  host.className = 'modal-overlay'; host.id = '__envSendOpts';
  const w = hasSender ? 'min(880px,96vw)' : 'min(520px,94vw)';
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" style="width:${w};max-width:${w}">
    <div class="modal-head"><div><b>Send “${esc(env.title)}”</b><p>Each recipient gets a personal signing link by email.</p></div>
      <button class="ico-x" onclick="envSendClose()">${ic('x', 18)}</button></div>
    <div class="modal-body">
      <label class="agb-f-req"><input type="checkbox" id="env-opt-seq" ${seq ? 'checked' : ''}>
        Enforce signing order — a recipient is emailed only after everyone with a lower order number has finished</label>
      <div class="field" style="margin-top:12px"><label>Expires after (days — 0 = never)</label>
        <input id="env-opt-exp" type="number" min="0" value="${Number(env.expireDays) || 30}"></div>
      <div class="field"><label>Remind pending signers every (days — 0 = off)</label>
        <input id="env-opt-rem" type="number" min="0" value="${env.remindEveryDays == null ? 3 : Number(env.remindEveryDays)}"></div>
      ${hasSender ? `<div class="env-sender-fields">
        <div class="agr-roles-h">Your fields — fill them in on the page</div>
        <p class="meta env-sv-hint">These stamp onto the documents before anyone signs. Yellow = auto-filled from the client record; edit anything.</p>
        <div id="env-sv-pane" class="env-sv-pane"><div class="env-sv-loading">Rendering pages…</div></div>
      </div>` : ''}
    </div>
    <div class="modal-foot"><span class="modal-status"></span>
      <button class="btn ghost" onclick="envSendClose()">Cancel</button>
      <button class="btn primary" onclick="envSendConfirm('${esc(cid)}','${esc(entryId)}')">${ic('mail', 15)} Send</button></div>
  </div>`;
  document.body.appendChild(host);
  if (hasSender) envSendRenderPages(cid);
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
    const v = inp ? (t.type === 'checkbox' ? (inp.checked ? true : '') : inp.value.trim()) : '';
    if (t.required !== false && !v && t.type !== 'checkbox') {
      toast('Fill in the highlighted field before sending.');
      if (inp) { inp.classList.add('env-sv-miss'); inp.scrollIntoView({ block: 'center' }); inp.focus(); }
      return;
    }
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

/* ---- recipient picker: fill name/email from the client's CONTACTS ----
   The contacts form already knows Mom and Dad — typing them again per envelope
   is busywork. The picker lists contacts (relationship shown, signers first),
   plus the client (in-person) and the logged-in consultant (in-app). */
let ENV_PICK: { label: string; name: string; email: string; kind: string }[] = [];
function envBuildPickOpts(cid: string): void {
  ENV_PICK = [];
  const st = contactsState(cid);
  if (st.list === null && !st.loading) loadContacts(cid); // render() re-runs on arrival
  // Live contacts are LiveContact (firstName/relationship); primaries first.
  const sorted = (st.list || []).slice().sort((a: any, b: any) => Number(!!b.primary) - Number(!!a.primary));
  for (const ct of sorted as any[]) {
    const nm = ((ct.firstName || ct.first || '') + ' ' + (ct.lastName || ct.last || '')).trim();
    if (!nm) continue;
    const rel = ct.relationship || ct.rel || '';
    ENV_PICK.push({
      label: nm + (rel ? ' — ' + rel : '') + (ct.email ? '' : ' (no email on file)'),
      name: nm, email: ct.email || '', kind: 'external',
    });
  }
  const c = typeof findClient === 'function' ? findClient(cid) : undefined;
  if (c) ENV_PICK.push({ label: (c.first + ' ' + c.last).trim() + ' — client, signs in person', name: (c.first + ' ' + c.last).trim(), email: c.email || '', kind: 'inperson' });
  if (typeof ME !== 'undefined' && ME) ENV_PICK.push({ label: (ME.first + ' ' + ME.last).trim() + ' — me, signs in-app', name: (ME.first + ' ' + ME.last).trim(), email: '', kind: 'consultant' });
}
function envPickSelect(onchange: string): string {
  if (!ENV_PICK.length) return '';
  return `<select class="env-rec-pick" onchange="${onchange}" title="Fill from the client's contacts">
    <option value="">Contacts…</option>
    ${ENV_PICK.map((o, i) => `<option value="${i}">${esc(o.label)}</option>`).join('')}
  </select>`;
}
function envRecPick(i: number, v: string): void {
  if (!ENV_OPEN || v === '') return;
  const o = ENV_PICK[Number(v)];
  if (!o) return;
  const r = ENV_OPEN.recipients[i];
  r.name = o.name; r.email = o.email; (r as any).kind = o.kind;
  envSaveRecipients().then(() => render());
}
function envSlotPick(i: number, v: string): void {
  if (v === '') return;
  const o = ENV_PICK[Number(v)];
  if (!o) return;
  const g = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  if (g('env-slot-name-' + i)) (g('env-slot-name-' + i) as HTMLInputElement).value = o.name;
  if (g('env-slot-email-' + i)) (g('env-slot-email-' + i) as HTMLInputElement).value = o.email;
  if (g('env-slot-kind-' + i)) (g('env-slot-kind-' + i) as HTMLSelectElement).value = o.kind;
}

/* Completed downloads, split-output era: one signed PDF per document (Files
   entries) + the certificate (the signedPdf DocumentLink). Envelopes completed
   before the split keep their single merged PDF. */
function envSignedDownloads(env: Envelope): string {
  const signed = (env.documents || []).filter((d: any) => d.signedUrl);
  if (!signed.length) {
    return env.signedPdf ? `<button class="btn primary" onclick="filesOpen('${esc(env.signedPdf)}')">${ic('download', 15)} Signed PDF</button>` : '';
  }
  return `<div class="env-signed-list">
    ${signed.map((d: any) => `<button class="btn outline sm" onclick="filesOpen('${esc(d.signedUrl)}')">${ic('download', 14)} ${esc(d.name)} — signed</button>`).join('')}
    ${env.signedPdf ? `<button class="btn primary sm" onclick="filesOpen('${esc(env.signedPdf)}')">${ic('download', 14)} Certificate of completion</button>` : ''}
  </div>`;
}

function envSenderTabs(env: Envelope): any[] {
  return (env.tabs || []).filter((t: any) => t.recipientId === '__sender__');
}

/* On-page sender fill: the send dialog renders ONLY the pages that carry sender
   tabs and overlays a real input at each tab's spot — the sender sees exactly
   where each value lands (a bare "Sender field *" list is unusable past one
   field). Same pdfgeo geometry the signer sees, so what you type is what stamps. */
async function envSendRenderPages(cid: string): Promise<void> {
  const env = ENV_OPEN;
  const pane = document.getElementById('env-sv-pane');
  if (!env || !pane) return;
  const tabs = envSenderTabs(env);
  const docs = (env.documents || []).slice().sort((a: any, b: any) => a.order - b.order);
  const spots: { doc: any; page: number }[] = [];
  for (const doc of docs) {
    const pages: number[] = [];
    for (const t of tabs) if (t.docId === doc.id && pages.indexOf(t.page) < 0) pages.push(t.page);
    pages.sort((a, b) => a - b).forEach(pg => spots.push({ doc: doc, page: pg }));
  }
  if (!spots.length) { pane.innerHTML = ''; return; }
  pane.innerHTML = spots.map(sp => `<div class="env-sv-pagelabel">${esc(sp.doc.name)} — page ${sp.page}</div>
    <div class="env-sv-page" data-doc="${esc(sp.doc.id)}" data-page="${sp.page}"><canvas></canvas><div class="env-sv-overlay"></div></div>`).join('');
  const width = Math.min(820, Math.max(320, (pane.clientWidth || 820)));
  const byDoc: { [k: string]: any } = {};
  const els = pane.querySelectorAll('.env-sv-page');
  for (let i = 0; i < els.length; i++) {
    const el = els[i] as HTMLElement;
    if (!document.getElementById('__envSendOpts')) return; // dialog closed mid-render
    const docId = el.getAttribute('data-doc') || '';
    const pageNum = Number(el.getAttribute('data-page')) || 1;
    const doc = docs.find((d: any) => d.id === docId);
    const canvas = el.querySelector('canvas') as HTMLCanvasElement;
    const pageTabs = tabs.filter((t: any) => t.docId === docId && t.page === pageNum);
    try {
      if (!byDoc[docId]) byDoc[docId] = await pdfOpen(doc.sourceUrl);
      const dims = await pdfRenderPage(byDoc[docId], pageNum, canvas, width);
      el.style.width = canvas.style.width; el.style.height = canvas.style.height;
      const scale = geoScale(width, dims.wPt);
      const overlay = el.querySelector('.env-sv-overlay') as HTMLElement;
      for (const t of pageTabs) {
        const wrap = document.createElement('div');
        wrap.className = 'env-sv-tab';
        geoApplyTabRect(wrap, t, scale);
        wrap.innerHTML = envSenderInputHtml(cid, env, t);
        overlay.appendChild(wrap);
      }
    } catch (_e) {
      // page didn't render (bad PDF, network) — fall back to labeled inputs so send still works
      el.classList.add('env-sv-err');
      el.style.width = 'auto'; el.style.height = 'auto';
      el.innerHTML = '<div class="env-sv-loading">Couldn\'t render this page — fill the fields here instead.</div>'
        + pageTabs.map((t: any) => `<div class="field" style="padding:0 12px 10px"><label>${esc(t.label || 'Sender field')}${t.required !== false ? ' *' : ''}</label>
          <input id="env-sv-${esc(t.id)}"></div>`).join('');
    }
  }
}

/* The editable control for one sender tab on the send-dialog page overlay. */
function envSenderInputHtml(cid: string, env: Envelope, t: any): string {
  const saved = ((env.senderValues || {}) as any)[t.id];
  if (t.type === 'checkbox') return `<input type="checkbox" id="env-sv-${esc(t.id)}" ${saved ? 'checked' : ''} title="${esc(t.label || 'Sender checkbox')}">`;
  const auto = !saved && t.source ? envPrefillValue(cid, t.source) : '';
  return `<input id="env-sv-${esc(t.id)}" class="${auto ? 'env-sv-auto' : ''}" value="${esc(saved || auto || '')}"
    placeholder="${esc(t.label || (t.required !== false ? 'required' : ''))}"
    title="${esc(t.label || 'Sender field')}${t.required !== false ? ' (required)' : ''}"
    oninput="this.classList.remove('env-sv-auto','env-sv-miss')">`;
}

/* ---- auto-filled sender fields (phase 7) ----
   A sender tab may carry a `source` — a client-record binding resolved when the
   send dialog opens. The value lands in the input PREFILLED but editable; on send
   it freezes into env.senderValues like any other sender field, so stamping,
   validation, and the signing views need nothing new. */
const ENV_PREFILL_SOURCES: { key: string; label: string }[] = [
  { key: 'clientName', label: 'Client full name' },
  { key: 'clientFirstName', label: 'Client first name' },
  { key: 'clientDob', label: 'Client date of birth' },
  { key: 'clientEmail', label: 'Client email' },
  { key: 'clientPhone', label: 'Client cell phone' },
  { key: 'clientLocation', label: 'Client city, state' },
  { key: 'consultantName', label: 'Consultant name' },
  { key: 'today', label: "Today's date" },
];
function envPrefillValue(cid: string, key: string): string {
  const c = typeof findClient === 'function' ? findClient(cid) : undefined;
  switch (key) {
    case 'clientName': return c ? (c.first + ' ' + c.last).trim() : '';
    case 'clientFirstName': return c ? c.first : '';
    case 'clientDob': return c && c.dob ? (fmtDate(c.dob) || c.dob) : '';
    case 'clientEmail': return (c && c.email) || '';
    case 'clientPhone': return (c && c.cell) || '';
    case 'clientLocation': return c ? [c.demo && c.demo.city, c.demo && c.demo.state].filter(Boolean).join(', ') : '';
    case 'consultantName': return typeof ME !== 'undefined' && ME ? (ME.first + ' ' + ME.last).trim() : '';
    case 'today': return fmtDate(new Date().toISOString().slice(0, 10)) || '';
    default: return '';
  }
}

/* One recipient's read-only row: status-aware pill + the phase-4 actions. */
function envRecRoRow(cid: string, env: Envelope, r: EnvRecipient): string {
  const inflight = env.status === 'Sent' || env.status === 'Partially Signed';
  const turn = env.routing !== 'sequential' || (r.routingOrder || 1) === (env.activeOrder || 0);
  const kindLabel = (ENV_KINDS.find(k => k.v === r.kind) || { label: r.kind }).label;
  let pill: string;
  if (r.kind === 'cc') pill = `<span class="pill muted">CC</span>`;
  else if (r.status === 'signed') pill = `<span class="pill ok">Signed${r.signedAt ? ' · ' + esc(fmtDate(String(r.signedAt).slice(0, 10)) || '') : ''}</span>`;
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
    progress: (me as any).progress || null,
    saveProgress: (p: any) => apiSaveEnvelopeProgress(cid, entryId, me.id, p.tabValues, p.typedName, p.hasAdopted),
    submit: (p) => {
      const consent = document.getElementById('env-consent') as HTMLInputElement | null;
      if (!consent || !consent.checked) return Promise.reject(new Error('Please check the consent box.'));
      return apiSignEnvelope(cid, entryId, me.id, p.signatureData, p.typedName, p.tabValues, p.initialsData);
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
