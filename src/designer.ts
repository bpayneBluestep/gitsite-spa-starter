/* =====================================================================
   designer.ts — the field-placement designer.

   Routes:
     #/designer/env/<clientId>/<entryId>   — place tabs on a Draft envelope
     #/designer/tpl/<templateEntryId>      — place tabs + define roles on a template

   The document is truth and it is never edited here: pdf.js renders every page of
   every PDF; tabs are absolutely-positioned divs over each page, dragged/resized
   with interact.js. Positions live in PDF points (pdfgeo.ts) — pixels are derived
   at render time, so zoom cannot drift a tab by construction.

   Placement is CLICK-TO-PLACE: click a palette type to arm it, click the page to
   drop the tab. Deliberate — cross-container drag is the fiddliest UI in this
   class of tool, while click-click is precise, touch-friendly, and lets arrow keys
   do the fine work. Moving/resizing an existing tab IS drag (interact.js).

   Keyboard: arrows nudge 1pt (Shift = 10pt), Ctrl+C/Ctrl+V copy/paste (+12pt
   offset), Delete removes. Autosaves 900ms after the last change; Ctrl+S forces.

   Envelope tabs belong to RECIPIENTS; template tabs belong to ROLES. One code
   path: both are rendered as "owners" with stable colors from pdfgeo.
   ===================================================================== */

interface DsgTab {
  id: string; docId: string; page: number;
  x: number; y: number; w: number; h: number;   // PDF points, top-left origin
  type: string; recipientId: string;            // recipient id OR template role id
  required: boolean; label: string; options: string[];
  validation?: string; conditionalOn?: string;
}

interface DsgOwner { id: string; name: string; color: string; kind?: string; }

interface DsgState {
  mode: 'env' | 'tpl';
  cid: string;            // client id (env mode only)
  entryId: string;        // envelope or template entry id
  title: string;
  docs: EnvDoc[];
  tabs: DsgTab[];
  owners: DsgOwner[];
  activeOwner: string;    // new tabs are assigned to this owner
  armedType: string;      // palette type waiting for a page click; '' = none
  selected: string;       // selected tab id
  zoom: number;           // 0.5 … 2
  loading: boolean;
  error: string;
  dirty: boolean;
  saving: boolean;
  pages: GeoPage[];       // filled as pdf.js reports real page sizes
  clipboard: DsgTab | null;
  correcting: boolean;              // env is Sent/Partially Signed (phase-4 correction)
  locked: { [rid: string]: boolean }; // recipients who already signed — their tabs are immutable
  roles: any[];                     // tpl mode: raw roles (id, name, optional)
}

let DSG: DsgState | null = null;
let DSG_SAVE_T: any = null;
const DSG_BASE_W = 816; // 8.5in at 96dpi — the 100% render width for a letter page

/* ---- route entry ---- */
function viewDesigner(parts: string[]): string {
  // parts: ['designer','env',cid,entryId] or ['designer','tpl',entryId]
  const mode = parts[1] === 'tpl' ? 'tpl' : 'env';
  const cid = mode === 'env' ? decodeURIComponent(parts[2] || '') : '';
  const entryId = decodeURIComponent(mode === 'env' ? (parts[3] || '') : (parts[2] || ''));
  if (!DSG || DSG.entryId !== entryId) {
    DSG = {
      mode: mode, cid: cid, entryId: entryId, title: '', docs: [], tabs: [], owners: [],
      activeOwner: '', armedType: '', selected: '', zoom: 0, // 0 = fit-to-width, computed on first mount
      loading: true, error: '', dirty: false, saving: false, pages: [], clipboard: null,
      correcting: false, locked: {}, roles: [],
    };
    dsgLoad();
  }
  setTimeout(dsgMountPages, 0);
  return shell('', dsgView());
}

async function dsgLoad(): Promise<void> {
  const d = DSG; if (!d) return;
  try {
    if (d.mode === 'env') {
      const env = await apiGetEnvelope(d.cid, d.entryId);
      // Draft: normal designing. Sent/Partially Signed: a CORRECTION — allowed, with
      // signed recipients' fields locked (the server enforces the same rule).
      if (env.status !== 'Draft' && env.status !== 'Sent' && env.status !== 'Partially Signed') {
        d.error = 'This envelope is ' + env.status + ' and can no longer be edited.'; d.loading = false; render(); return;
      }
      d.correcting = env.status !== 'Draft';
      d.locked = {};
      for (const r of (env.recipients || [])) { if (r.status === 'signed') d.locked[r.id] = true; }
      d.title = env.title;
      d.docs = (env.documents || []).slice().sort((a: EnvDoc, b: EnvDoc) => a.order - b.order);
      d.tabs = env.tabs || [];
      d.owners = (env.recipients || []).filter((r: EnvRecipient) => r.kind !== 'cc')
        .map((r: EnvRecipient, i: number) => ({ id: r.id, name: r.name || '(unnamed)', color: geoRecipientColor(i), kind: r.kind }));
    } else {
      const list = await apiListAgreementTemplates();
      const t = (list || []).find((x: any) => x.entryId === d.entryId);
      if (!t || !t.bodyJson || t.bodyJson.schemaVersion !== 3) { d.error = 'Template not found or not an upload-based template.'; d.loading = false; render(); return; }
      d.title = t.name;
      d.docs = (t.bodyJson.documents || []).slice().sort((a: any, b: any) => a.order - b.order);
      d.tabs = t.bodyJson.tabs || [];
      const roles = (t.bodyJson.roles || []) as any[];
      if (!roles.length) roles.push({ id: 'role1_' + Math.random().toString(36).slice(2, 6), name: 'Signer 1' });
      d.roles = roles;
      d.owners = dsgOwnersFromRoles(roles);
    }
    // Both modes get the sender pseudo-owner: fields the SENDER fills in the send
    // dialog (tuition rate, start date) — never a signer's, never signature-like.
    d.owners.push({ id: '__sender__', name: 'Sender (at send)', color: '#64748b' });
    if (d.owners.length < 2) { d.error = d.mode === 'env' ? 'Add at least one signing recipient before placing fields.' : 'Add a role first.'; }
    const firstUnlocked = d.owners.find(o => !d.locked[o.id] && o.id !== '__sender__');
    d.activeOwner = firstUnlocked ? firstUnlocked.id : (d.owners.length ? d.owners[0].id : '');
    d.loading = false;
  } catch (e: any) { d.error = e && e.message ? e.message : String(e); d.loading = false; }
  render();
}

/* ---- view ---- */
function dsgView(): string {
  const d = DSG!;
  if (d.loading) return loadingCard('Loading designer…');
  if (d.error && !d.owners.length) return `${crumb([{ t: 'Designer' }])}${errorCard(d.error)}
    <button class="btn ghost" onclick="dsgBack()">${ic('chevL', 14)} Back</button>`;

  const ownerBtns = d.owners.map(o => `
    <button class="dsg-owner ${d.activeOwner === o.id ? 'active' : ''}${d.locked[o.id] ? ' locked' : ''}" style="--oc:${o.color}"
      data-owner="${esc(o.id)}" onclick="dsgSetOwner('${esc(o.id)}')" title="${d.locked[o.id] ? esc(o.name) + ' has already signed — their fields are locked' : 'New fields are assigned to ' + esc(o.name)}">
      <span class="dsg-owner-dot"></span>${esc(o.name)}${d.locked[o.id] ? ' 🔒' : ''}</button>`).join('');

  const palette = Object.keys(GEO_TAB_DEFAULTS).map(t => `
    <button class="dsg-pal ${d.armedType === t ? 'armed' : ''}" data-pal="${t}" onclick="dsgPalClick('${t}')"
      onpointerdown="dsgPalDown(event,'${t}')"
      title="Drag onto the page, or click then click the page">${esc(GEO_TAB_LABELS[t] || t)}</button>`).join('');

  const zooms = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const zoomBtns = `<button class="btn ghost sm" onclick="dsgZoomFit()" title="Fit the page to the window">Fit</button>`
    + zooms.map(z => `<button class="btn ghost sm ${Math.abs(d.zoom - z) < 0.01 ? 'dsg-z-on' : ''}" onclick="dsgZoom(${z})">${z * 100}%</button>`).join('');

  const pages = d.docs.map(doc => {
    const n = Math.max(1, doc.pages || 1);
    let html = `<div class="dsg-docname">${esc(doc.name)}</div>`;
    for (let p = 1; p <= n; p++) {
      html += `<div class="dsg-page" data-doc="${esc(doc.id)}" data-page="${p}" data-url="${esc(doc.sourceUrl)}"
        onclick="dsgPageClick(event,'${esc(doc.id)}',${p})">
        <canvas class="dsg-canvas"></canvas>
        <div class="dsg-overlay"></div>
      </div>`;
    }
    return html;
  }).join('');

  return `${crumb([{ t: 'Agreements' }, { t: d.title }, { t: 'Place fields' }])}
    ${d.correcting ? `<div class="env-correct-note">${ic('edit', 14)} Correcting a sent envelope — fields of recipients who already signed are locked.</div>` : ''}
    <div class="page-head"><div><h1>Place fields</h1>
      <p>${d.armedType ? `Click the page to place a <b>${esc(GEO_TAB_LABELS[d.armedType])}</b> for <b>${esc((d.owners.find(o => o.id === d.activeOwner) || { name: '?' }).name)}</b> — Esc to cancel.` : 'Pick a field type, then click the page. Drag to move, edges to resize, arrows to nudge. Ctrl+C copies the selected field, Ctrl+V pastes it at your cursor.'}</p></div>
      <div>
        <span class="dsg-savestate">${d.saving ? 'Saving…' : d.dirty ? 'Unsaved' : 'Saved'}</span>
        <button class="btn ghost" onclick="dsgBack()">${ic('chevL', 14)} Done</button>
      </div></div>
    <div class="dsg-layout">
      <div class="dsg-side">
        <div class="card card-pad">
          <div class="agb-side-h">${d.mode === 'env' ? 'Recipients' : 'Roles'}</div>
          <div class="dsg-owners">${ownerBtns}</div>
          ${d.mode === 'tpl' ? `<button class="btn ghost sm" onclick="dsgAddRole()">${ic('plus', 13)} Add role</button>
          <div class="dsg-holders">${d.roles.map(r => `<div class="dsg-holders-row">
            <label title="An optional role may be left blank when this template is applied — that person and all their fields are omitted from the envelope.">
              <input type="checkbox" ${r.optional ? 'checked' : ''} onchange="dsgToggleOptional('${esc(r.id)}')"> ${esc(r.name)} is optional</label>
            <button class="ico-mini" title="Rename ${esc(r.name)}" onclick="dsgRenameRole('${esc(r.id)}')">${ic('edit', 12)}</button></div>`).join('')}</div>` : ''}
        </div>
        <div class="card card-pad">
          <div class="agb-side-h">Fields</div>
          <div class="dsg-palette">${palette}</div>
        </div>
      </div>
      <div class="dsg-main">
        <div class="dsg-toolbar">${zoomBtns}<span class="meta" id="dsg-count" style="margin-left:auto">${d.tabs.length} field${d.tabs.length === 1 ? '' : 's'}</span></div>
        <div class="dsg-scroll" id="dsg-scroll">${pages}</div>
      </div>
    </div>
    <div id="dsg-props" class="dsg-props-float${d.selected ? '' : ' dsg-hidden'}">${dsgPropsHtml()}</div>`;
}

/* Properties panel for the selected tab. */
function dsgPropsHtml(): string {
  const d = DSG!;
  const t = d.tabs.find(x => x.id === d.selected);
  if (!t) return '';
  const head = `<div class="dsg-props-head"><div class="agb-side-h">${esc(GEO_TAB_LABELS[t.type] || t.type)}</div>
    <button class="ico-mini" title="Close (Esc)" onclick="dsgDeselect()">${ic('x', 14)}</button></div>`;
  if (d.locked[t.recipientId]) {
    const lockedOwner = d.owners.find(o => o.id === t.recipientId);
    return `${head}
      <p class="meta">${esc(lockedOwner ? lockedOwner.name : 'This recipient')} has already signed — this field can't be changed by a correction.</p>`;
  }
  const owner = d.owners.filter(o => !d.locked[o.id]).map(o => `<option value="${esc(o.id)}"${t.recipientId === o.id ? ' selected' : ''}>${esc(o.name)}</option>`).join('');
  // Sender fields can bind to a client-record source — resolved when the send
  // dialog opens, editable there, frozen into senderValues at send (phase 7).
  const prefill = t.recipientId === '__sender__' && t.type === 'text' ? `
    <div class="field"><label>Auto-fill from</label><select onchange="dsgPrefillSource(this.value)">
      <option value="">(typed by the sender)</option>
      ${ENV_PREFILL_SOURCES.map(sc => `<option value="${sc.key}"${(t as any).source === sc.key ? ' selected' : ''}>${esc(sc.label)}</option>`).join('')}
    </select></div>` : '';
  const needsOpts = t.type === 'radioGroup' || t.type === 'dropdown';
  const auto = t.type === 'dateSigned' || t.type === 'name';
  return `${head}
    <div class="field"><label>Assigned to</label><select onchange="dsgProp('recipientId',this.value)">${owner}</select></div>
    ${prefill}
    ${auto ? `<p class="meta">Filled automatically when they sign.</p>` : `
      <div class="field"><label>Label</label><input value="${esc(t.label)}" oninput="dsgProp('label',this.value)"></div>
      ${needsOpts ? `<div class="field"><label>Options (one per line)</label>
        <textarea rows="4" oninput="dsgPropOptions(this.value)">${esc((t.options || []).join('\n'))}</textarea></div>` : ''}
      <label class="agb-f-req" style="margin-bottom:8px"><input type="checkbox" ${t.required ? 'checked' : ''}
        onchange="dsgProp('required',this.checked)"> Required</label>`}
    <div class="dsg-prop-acts">
      <button class="btn ghost sm" onclick="dsgDuplicate()">${ic('plus', 13)} Duplicate</button>
      <button class="btn ghost sm danger" onclick="dsgDelete()">${ic('trash', 13)} Delete</button>
    </div>`;
}

/* ---- page mounting: render canvases + overlays after the DOM exists ---- */
async function dsgMountPages(): Promise<void> {
  const d = DSG; if (!d || d.loading) return;
  // zoom 0 is the fit-to-width sentinel: measure the scroll container once the DOM
  // exists, pick the zoom that fills it, and re-render. The designer owns the full
  // viewport width (.content:has(.dsg-layout) lifts the app's 1080px cap), so "fit"
  // means the page actually uses the screen instead of a letterboxed strip.
  if (d.zoom === 0) {
    const sc = document.getElementById('dsg-scroll');
    if (!sc) return;
    const avail = sc.clientWidth - 48; // scroll padding
    d.zoom = Math.max(0.5, Math.min(2, Math.round((avail / DSG_BASE_W) * 20) / 20));
    render();
    return;
  }
  const pageEls = document.querySelectorAll('.dsg-page');
  const byUrl: { [url: string]: any } = {};
  for (let i = 0; i < pageEls.length; i++) {
    const el = pageEls[i] as HTMLElement;
    const url = el.getAttribute('data-url') || '';
    const docId = el.getAttribute('data-doc') || '';
    const pageNum = Number(el.getAttribute('data-page')) || 1;
    const canvas = el.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas || !url) continue;
    try {
      if (!byUrl[url]) byUrl[url] = await pdfOpen(url);
      const dims = await pdfRenderPage(byUrl[url], pageNum, canvas, Math.round(DSG_BASE_W * d.zoom));
      // Record the real page size so pt<->px math is exact for this page.
      if (!d.pages.find(p => p.docId === docId && p.page === pageNum)) {
        d.pages.push({ docId: docId, page: pageNum, wPt: dims.wPt, hPt: dims.hPt });
      }
      el.style.width = canvas.style.width;
      el.style.height = canvas.style.height;
      dsgPaintOverlay(el, docId, pageNum);
    } catch (_e) { el.classList.add('dsg-page-err'); }
  }
}

function dsgPageInfo(docId: string, page: number): GeoPage | null {
  return DSG ? (DSG.pages.find(p => p.docId === docId && p.page === page) || null) : null;
}

function dsgScaleFor(docId: string, page: number): number {
  const info = dsgPageInfo(docId, page);
  return info ? geoScale(DSG_BASE_W * DSG!.zoom, info.wPt) : 1;
}

/* Redraw the tab divs on one page's overlay. */
function dsgPaintOverlay(pageEl: HTMLElement, docId: string, page: number): void {
  const d = DSG!;
  const overlay = pageEl.querySelector('.dsg-overlay') as HTMLElement | null;
  if (!overlay) return;
  const scale = dsgScaleFor(docId, page);
  overlay.innerHTML = '';
  for (const t of d.tabs) {
    if (t.docId !== docId || t.page !== page) continue;
    const o = d.owners.find(x => x.id === t.recipientId);
    const lockedT = !!d.locked[t.recipientId];
    const el = document.createElement('div');
    el.className = 'dsg-tab' + (d.selected === t.id ? ' selected' : '') + (lockedT ? ' locked' : '');
    el.setAttribute('data-tab', t.id);
    el.style.setProperty('--oc', o ? o.color : '#64748b');
    el.innerHTML = `<span class="dsg-tab-label">${esc(t.type === 'checkbox' ? '' : (t.label || GEO_TAB_LABELS[t.type] || t.type))}</span>`;
    geoApplyTabRect(el, t, scale);
    el.addEventListener('click', (ev) => ev.stopPropagation());
    overlay.appendChild(el);
    if (!lockedT) dsgMakeInteractive(el, t);
  }
}

function dsgRepaintAll(): void {
  const pageEls = document.querySelectorAll('.dsg-page');
  for (let i = 0; i < pageEls.length; i++) {
    const el = pageEls[i] as HTMLElement;
    dsgPaintOverlay(el, el.getAttribute('data-doc') || '', Number(el.getAttribute('data-page')) || 1);
  }
  dsgPropsRefresh();
}

/* ---- drag + resize, hand-rolled on pointer events ----
   interact.js was vendored for this and its minified build turned out to be broken
   at runtime (scope.interactables never initializes — "interactables.get is not a
   function" on first use). Move + resize + grid snap + page clamp is ~70 lines with
   pointer capture, all in the pt-space we already own, so the dependency is gone.

   Behaviour: drag anywhere in the tab moves it; the outer 6px of each edge resizes;
   positions snap to a 3pt grid on release; everything clamps to the page. */
const DSG_EDGE = 6;    // px — resize handle thickness
const DSG_GRID = 3;    // pt — release snap

function dsgMakeInteractive(el: HTMLElement, tab: DsgTab): void {
  el.addEventListener('pointerdown', function (ev: PointerEvent) {
    if (ev.button !== 0) return;
    ev.preventDefault(); ev.stopPropagation();
    dsgSelect(tab.id);
    const scale = dsgScaleFor(tab.docId, tab.page);
    const rect = el.getBoundingClientRect();
    const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
    // Which edges is the pointer within DSG_EDGE px of? None = move.
    const edges = {
      l: px <= DSG_EDGE, r: px >= rect.width - DSG_EDGE,
      t: py <= DSG_EDGE, b: py >= rect.height - DSG_EDGE,
    };
    const resizing = edges.l || edges.r || edges.t || edges.b;
    const start = { x: tab.x, y: tab.y, w: tab.w, h: tab.h, cx: ev.clientX, cy: ev.clientY };
    const info = dsgPageInfo(tab.docId, tab.page);
    let moved = false;

    const onMove = (mv: PointerEvent) => {
      const dxPt = geoPxToPt(mv.clientX - start.cx, scale);
      const dyPt = geoPxToPt(mv.clientY - start.cy, scale);
      if (Math.abs(dxPt) + Math.abs(dyPt) > 0.5) moved = true;
      if (!resizing) {
        tab.x = start.x + dxPt; tab.y = start.y + dyPt;
      } else {
        if (edges.r) tab.w = Math.max(8, start.w + dxPt);
        if (edges.b) tab.h = Math.max(8, start.h + dyPt);
        if (edges.l) { const w2 = Math.max(8, start.w - dxPt); tab.x = start.x + (start.w - w2); tab.w = w2; }
        if (edges.t) { const h2 = Math.max(8, start.h - dyPt); tab.y = start.y + (start.h - h2); tab.h = h2; }
      }
      if (info) geoClampTab(tab, info.wPt, info.hPt);
      geoApplyTabRect(el, tab, scale);
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      if (moved) {
        // snap on release, not during — dragging feels 1:1, results line up
        tab.x = Math.round(tab.x / DSG_GRID) * DSG_GRID;
        tab.y = Math.round(tab.y / DSG_GRID) * DSG_GRID;
        tab.w = Math.round(tab.w / DSG_GRID) * DSG_GRID;
        tab.h = Math.round(tab.h / DSG_GRID) * DSG_GRID;
        if (info) geoClampTab(tab, info.wPt, info.hPt);
        geoApplyTabRect(el, tab, scale);
        dsgTouched();
      }
      dsgPropsPosition();
    };
    el.setPointerCapture(ev.pointerId);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  });

  // Resize affordance: show the right cursor near edges.
  el.addEventListener('pointermove', function (ev: PointerEvent) {
    if ((ev as any).buttons) return; // mid-gesture — capture handler owns it
    const rect = el.getBoundingClientRect();
    const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
    const l = px <= DSG_EDGE, r = px >= rect.width - DSG_EDGE, t = py <= DSG_EDGE, b = py >= rect.height - DSG_EDGE;
    el.style.cursor = (l && t) || (r && b) ? 'nwse-resize' : (r && t) || (l && b) ? 'nesw-resize'
      : l || r ? 'ew-resize' : t || b ? 'ns-resize' : 'move';
  });
}

/* ---- interactions ---- */
function dsgSetOwner(id: string): void {
  const d = DSG!;
  if (d.locked[id]) { toast('That recipient has already signed — new fields can\'t be assigned to them.'); return; }
  d.activeOwner = id;
  const t = d.tabs.find(x => x.id === d.selected);
  if (t) {
    t.recipientId = id;
    const el = document.querySelector('[data-tab="' + t.id + '"]') as HTMLElement | null;
    const o = d.owners.find(x => x.id === id);
    if (el && o) el.style.setProperty('--oc', o.color);
    dsgTouched();
  }
  dsgUiSync();
  dsgPropsRefresh();
}

function dsgArm(type: string): void {
  const d = DSG!;
  d.armedType = d.armedType === type ? '' : type;
  d.selected = '';
  const els = document.querySelectorAll('.dsg-tab.selected');
  for (let i = 0; i < els.length; i++) els[i].classList.remove('selected');
  dsgUiSync();
  dsgPropsRefresh();
}

// Create a tab of `type` centred on a page-local pixel point. Shared by
// click-to-place and drag-from-palette.
const DSG_SIGNER_ONLY: { [t: string]: boolean } = { signature: true, initials: true, dateSigned: true, name: true };
function dsgPlaceAt(docId: string, page: number, pxX: number, pxY: number, type: string): void {
  const d = DSG!;
  if (d.activeOwner === '__sender__' && DSG_SIGNER_ONLY[type]) { toast('Sender fields are filled at send time — signature-type fields need a signer.'); d.armedType = ''; render(); return; }
  const scale = dsgScaleFor(docId, page);
  const def = GEO_TAB_DEFAULTS[type];
  const tab: DsgTab = {
    id: 't_' + Math.random().toString(36).slice(2, 10),
    docId: docId, page: page,
    x: geoPxToPt(pxX, scale) - def.w / 2, y: geoPxToPt(pxY, scale) - def.h / 2,
    w: def.w, h: def.h,
    type: type, recipientId: d.activeOwner,
    required: true, label: '', options: type === 'radioGroup' ? ['Option 1', 'Option 2'] : [],
  };
  const info = dsgPageInfo(docId, page);
  if (info) geoClampTab(tab, info.wPt, info.hPt);
  d.tabs.push(tab);
  d.selected = tab.id;
  d.armedType = '';
  dsgTouched();
  // Paint only the affected page — a render() here scrolled the user to the top.
  const pageEl = document.querySelector('.dsg-page[data-doc="' + docId + '"][data-page="' + page + '"]') as HTMLElement | null;
  if (pageEl) dsgPaintOverlay(pageEl, docId, page);
  dsgUiSync();
  dsgPropsRefresh();
}

function dsgPageClick(ev: MouseEvent, docId: string, page: number): void {
  const d = DSG!;
  if (!d.armedType) { d.selected = ''; dsgRepaintAll(); return; }
  const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
  dsgPlaceAt(docId, page, ev.clientX - rect.left, ev.clientY - rect.top, d.armedType);
}

/* ---- drag-from-palette ----
   pointerdown on a palette button starts watching; once the pointer travels >5px a
   ghost (sized at the hovered page's scale) follows it, and releasing over a page
   places the tab there. Releasing anywhere else cancels. A plain CLICK (no travel)
   still arms click-to-place — both idioms work, nobody has to relearn anything.
   The ghost is pointer-events:none so elementFromPoint sees the page under it. */
let DSG_PAL_SUPPRESS_CLICK = false;
function dsgPalDown(ev: PointerEvent, type: string): void {
  if (ev.button !== 0) return;
  const startX = ev.clientX, startY = ev.clientY;
  let ghost: HTMLElement | null = null;
  DSG_PAL_SUPPRESS_CLICK = false;

  const pageUnder = (x: number, y: number): HTMLElement | null => {
    const el = document.elementFromPoint(x, y);
    return el ? (el.closest('.dsg-page') as HTMLElement | null) : null;
  };
  const onMove = (mv: PointerEvent) => {
    if (!ghost) {
      if (Math.abs(mv.clientX - startX) + Math.abs(mv.clientY - startY) < 5) return;
      DSG_PAL_SUPPRESS_CLICK = true;
      ghost = document.createElement('div');
      ghost.className = 'dsg-ghost';
      const o = DSG!.owners.find(x => x.id === DSG!.activeOwner);
      ghost.style.setProperty('--oc', o ? o.color : '#64748b');
      ghost.textContent = GEO_TAB_LABELS[type] || type;
      document.body.appendChild(ghost);
    }
    const pg = pageUnder(mv.clientX, mv.clientY);
    const def = GEO_TAB_DEFAULTS[type];
    const scale = pg ? dsgScaleFor(pg.getAttribute('data-doc') || '', Number(pg.getAttribute('data-page')) || 1) : 1;
    ghost.style.width = Math.round(def.w * scale) + 'px';
    ghost.style.height = Math.round(def.h * scale) + 'px';
    ghost.style.left = Math.round(mv.clientX - (def.w * scale) / 2) + 'px';
    ghost.style.top = Math.round(mv.clientY - (def.h * scale) / 2) + 'px';
    ghost.classList.toggle('droppable', !!pg);
  };
  const onUp = (up: PointerEvent) => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    if (!ghost) return; // plain click — the click handler arms as before
    ghost.remove();
    const pg = pageUnder(up.clientX, up.clientY);
    if (!pg) return;
    const rect = pg.getBoundingClientRect();
    dsgPlaceAt(pg.getAttribute('data-doc') || '', Number(pg.getAttribute('data-page')) || 1,
      up.clientX - rect.left, up.clientY - rect.top, type);
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function dsgPalClick(type: string): void {
  if (DSG_PAL_SUPPRESS_CLICK) { DSG_PAL_SUPPRESS_CLICK = false; return; }
  dsgArm(type);
}

/* Sync the sidebar chrome WITHOUT render(): a full render rebuilds the scroll
   pane and re-rasterizes every pdf.js canvas — the designer visibly "reloads"
   and jumps to the top, losing the user's place mid-work. */
function dsgUiSync(): void {
  const d = DSG; if (!d) return;
  const pals = document.querySelectorAll('.dsg-pal');
  for (let i = 0; i < pals.length; i++) pals[i].classList.toggle('armed', pals[i].getAttribute('data-pal') === d.armedType);
  const owners = document.querySelectorAll('.dsg-owner');
  for (let i = 0; i < owners.length; i++) owners[i].classList.toggle('active', owners[i].getAttribute('data-owner') === d.activeOwner);
  const count = document.getElementById('dsg-count');
  if (count) count.textContent = d.tabs.length + ' field' + (d.tabs.length === 1 ? '' : 's');
}

function dsgPropsRefresh(): void {
  const d = DSG;
  const props = document.getElementById('dsg-props');
  if (!props || !d) return;
  props.innerHTML = dsgPropsHtml();
  // The editor is a POPOVER anchored beside the selected field — right where the
  // user just clicked, instead of a corner they may never look at.
  props.classList.toggle('dsg-hidden', !d.selected);
  dsgPropsPosition();
}

/* Place the popover beside the selected tab: to its right, flipping left when
   the viewport runs out, clamped vertically. Re-run on scroll/resize/drag-end. */
function dsgPropsPosition(): void {
  const d = DSG;
  const panel = document.getElementById('dsg-props');
  if (!d || !panel || !d.selected || panel.classList.contains('dsg-hidden')) return;
  const el = document.querySelector('[data-tab="' + d.selected + '"]') as HTMLElement | null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const pw = panel.offsetWidth || 280;
  const ph = panel.offsetHeight || 240;
  let left = r.right + 14;
  if (left + pw > window.innerWidth - 12) left = r.left - pw - 14;
  if (left < 12) { left = Math.max(12, Math.min(window.innerWidth - pw - 12, r.left)); }
  let top = r.top - 10;
  top = Math.max(64, Math.min(window.innerHeight - ph - 12, top));
  panel.style.left = left + 'px';
  panel.style.top = top + 'px';
  panel.style.right = 'auto';
}
/* Track the cursor so Ctrl+V can paste WHERE THE MOUSE IS — copy a field once,
   point at the next blank, paste. Cross-page paste works: the copy adopts
   whichever page the cursor is over. */
let DSG_MOUSE = { x: 0, y: 0 };
document.addEventListener('mousemove', function (e: MouseEvent) { DSG_MOUSE.x = e.clientX; DSG_MOUSE.y = e.clientY; });
function dsgMouseSpot(): { docId: string; page: number; x: number; y: number } | null {
  const hit = document.elementFromPoint(DSG_MOUSE.x, DSG_MOUSE.y) as HTMLElement | null;
  const pg = hit && hit.closest ? hit.closest('.dsg-page') as HTMLElement | null : null;
  if (!pg) return null;
  const docId = pg.getAttribute('data-doc') || '';
  const page = Number(pg.getAttribute('data-page')) || 1;
  const r = pg.getBoundingClientRect();
  const scale = dsgScaleFor(docId, page);
  return { docId: docId, page: page, x: geoPxToPt(DSG_MOUSE.x - r.left, scale), y: geoPxToPt(DSG_MOUSE.y - r.top, scale) };
}

// Keep the popover glued to its field while the page scrolls or the window resizes.
document.addEventListener('scroll', function () { if (location.hash.indexOf('/designer/') >= 0) dsgPropsPosition(); }, true);
window.addEventListener('resize', function () { if (location.hash.indexOf('/designer/') >= 0) dsgPropsPosition(); });
function dsgDeselect(): void {
  const d = DSG!; d.selected = '';
  const els = document.querySelectorAll('.dsg-tab.selected');
  for (let i = 0; i < els.length; i++) els[i].classList.remove('selected');
  dsgPropsRefresh();
}
function dsgSelect(id: string): void {
  const d = DSG!; d.selected = id; d.armedType = '';
  // IN PLACE, never a repaint: this runs on mousedown, and rebuilding the overlay
  // here destroys the element interact.js is about to drag — which presented as
  // "drag doesn't work at all". Selection is a class toggle plus a panel refresh.
  const els = document.querySelectorAll('.dsg-tab.selected');
  for (let i = 0; i < els.length; i++) els[i].classList.remove('selected');
  const el = document.querySelector('[data-tab="' + id + '"]');
  if (el) el.classList.add('selected');
  dsgPropsRefresh();
}

function dsgProp(key: string, val: any): void {
  const d = DSG!;
  const t = d.tabs.find(x => x.id === d.selected);
  if (!t) return;
  if (d.locked[t.recipientId]) return;
  if (key === 'recipientId' && d.locked[String(val)]) { toast('That recipient has already signed.'); return; }
  if (key === 'recipientId' && String(val) === '__sender__' && DSG_SIGNER_ONLY[t.type]) { toast('Signature-type fields need a signer, not the sender.'); return; }
  (t as any)[key] = val;
  dsgTouched();
  if (key === 'recipientId') {
    const el = document.querySelector('[data-tab="' + t.id + '"]') as HTMLElement | null;
    const o = d.owners.find(x => x.id === val);
    if (el && o) el.style.setProperty('--oc', o.color);
  }
}

function dsgPrefillSource(key: string): void {
  const d = DSG!;
  const t = d.tabs.find(x => x.id === d.selected);
  if (!t) return;
  (t as any).source = key || undefined;
  // Give an unlabeled tab the source's friendly name — it's what the send dialog shows.
  const src = ENV_PREFILL_SOURCES.find(sc => sc.key === key);
  if (src && !t.label) { t.label = src.label; }
  dsgTouched();
  dsgRepaintAll();
}

function dsgPropOptions(text: string): void {
  const d = DSG!;
  const t = d.tabs.find(x => x.id === d.selected);
  if (!t) return;
  t.options = String(text).split('\n').map(s => s.trim()).filter(s => !!s);
  dsgTouched();
}

function dsgDuplicate(): void {
  const d = DSG!;
  const t = d.tabs.find(x => x.id === d.selected);
  if (!t) return;
  if (d.locked[t.recipientId]) { toast('Locked — that recipient has already signed.'); return; }
  const copy: DsgTab = JSON.parse(JSON.stringify(t));
  copy.id = 't_' + Math.random().toString(36).slice(2, 10);
  copy.x += 12; copy.y += 12;
  const info = dsgPageInfo(copy.docId, copy.page);
  if (info) geoClampTab(copy, info.wPt, info.hPt);
  d.tabs.push(copy);
  d.selected = copy.id;
  dsgTouched();
  dsgRepaintAll();
}

function dsgDelete(): void {
  const d = DSG!;
  const sel = d.tabs.find(x => x.id === d.selected);
  if (sel && d.locked[sel.recipientId]) { toast('Locked — that recipient has already signed.'); return; }
  d.tabs = d.tabs.filter(x => x.id !== d.selected);
  d.selected = '';
  dsgTouched();
  dsgRepaintAll();
}

function dsgZoom(z: number): void {
  const d = DSG!;
  d.zoom = z;
  d.pages = []; // page px sizes change; pt sizes are re-reported on render
  render();
}

function dsgZoomFit(): void {
  const d = DSG!;
  d.zoom = 0; d.pages = [];
  render();
}

function dsgAddRole(): void {
  const d = DSG!;
  const name = prompt('Role name (e.g. "Parent / Guardian"):', 'Signer ' + (d.roles.length + 1));
  if (name == null) return;
  const id = 'role' + (d.roles.length + 1) + '_' + Math.random().toString(36).slice(2, 6);
  d.roles.push({ id: id, name: name.trim() || ('Signer ' + (d.roles.length + 1)) });
  dsgRebuildOwners();
  d.activeOwner = id;
  dsgTouched();
  render();
}

/* One designer owner slot per role. (The old "two signers share this role"
   expansion is gone — two co-signers are simply two roles, which is what users
   expect. Roles can instead be OPTIONAL: skippable when the template is applied.) */
function dsgOwnersFromRoles(roles: any[]): DsgOwner[] {
  return roles.map((r: any, i: number) => ({ id: r.id, name: (r.name || r.label || 'Role') + (r.optional ? ' (optional)' : ''), color: geoRecipientColor(i) }));
}
function dsgRebuildOwners(): void {
  const d = DSG!;
  d.owners = dsgOwnersFromRoles(d.roles);
  d.owners.push({ id: '__sender__', name: 'Sender (at send)', color: '#64748b' });
}
function dsgRenameRole(roleId: string): void {
  const d = DSG!;
  const r = d.roles.find((x: any) => x.id === roleId);
  if (!r) return;
  const name = prompt('Rename role:', r.name || '');
  if (name == null || !name.trim()) return;
  r.name = name.trim();
  dsgRebuildOwners();
  dsgTouched();
  render();
}

function dsgToggleOptional(roleId: string): void {
  const d = DSG!;
  const r = d.roles.find((x: any) => x.id === roleId);
  if (!r) return;
  r.optional = !r.optional;
  dsgRebuildOwners();
  dsgTouched();
  render();
}

function dsgBack(): void {
  dsgFlushSave();
  if (DSG && DSG.mode === 'env') location.hash = '#/clients/' + DSG.cid + '/agreements';
  else location.hash = '#/agreementbuilder';
  DSG = null;
}

/* ---- keyboard (bound once; acts only while the designer is on screen) ---- */
document.addEventListener('keydown', function (ev: KeyboardEvent) {
  const d = DSG;
  if (!d || location.hash.indexOf('/designer/') < 0) return;
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (ev.key === 'Escape') { d.armedType = ''; d.selected = ''; render(); return; }
  const t = d.tabs.find(x => x.id === d.selected);
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); dsgFlushSave(); return; }
  if (!t) return;
  if (d.locked[t.recipientId]) return; // signed recipients' fields are immutable
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'c') { d.clipboard = JSON.parse(JSON.stringify(t)); return; }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'v') {
    if (!d.clipboard) return;
    if (d.locked[d.clipboard.recipientId]) return;
    const copy: DsgTab = JSON.parse(JSON.stringify(d.clipboard));
    copy.id = 't_' + Math.random().toString(36).slice(2, 10);
    const m = dsgMouseSpot();
    if (m) {
      // paste CENTERED under the cursor, on whichever page it's over
      copy.docId = m.docId; copy.page = m.page;
      copy.x = m.x - copy.w / 2; copy.y = m.y - copy.h / 2;
    } else {
      copy.x += 12; copy.y += 12; // cursor not over a page — offset beside the original
    }
    const infoP = dsgPageInfo(copy.docId, copy.page);
    if (infoP) geoClampTab(copy, infoP.wPt, infoP.hPt);
    d.tabs.push(copy); d.selected = copy.id; dsgTouched(); dsgRepaintAll(); return;
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'd') { ev.preventDefault(); dsgDuplicate(); return; }
  if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); dsgDelete(); return; }
  const step = ev.shiftKey ? 10 : 1;
  let moved = true;
  if (ev.key === 'ArrowLeft') t.x -= step;
  else if (ev.key === 'ArrowRight') t.x += step;
  else if (ev.key === 'ArrowUp') t.y -= step;
  else if (ev.key === 'ArrowDown') t.y += step;
  else moved = false;
  if (moved) {
    ev.preventDefault();
    const info = dsgPageInfo(t.docId, t.page);
    if (info) geoClampTab(t, info.wPt, info.hPt);
    dsgTouched();
    dsgRepaintAll();
  }
});

/* ---- autosave ---- */
function dsgTouched(): void {
  const d = DSG!;
  d.dirty = true;
  const st = document.querySelector('.dsg-savestate'); if (st) st.textContent = 'Unsaved';
  if (DSG_SAVE_T) clearTimeout(DSG_SAVE_T);
  DSG_SAVE_T = setTimeout(dsgFlushSave, 900);
}

async function dsgFlushSave(): Promise<void> {
  const d = DSG;
  if (!d || !d.dirty || d.saving) return;
  if (DSG_SAVE_T) { clearTimeout(DSG_SAVE_T); DSG_SAVE_T = null; }
  d.saving = true;
  const st = document.querySelector('.dsg-savestate'); if (st) st.textContent = 'Saving…';
  try {
    if (d.mode === 'env') await apiSaveEnvelopeTabs(d.cid, d.entryId, d.tabs);
    else await apiSaveTemplateDesign(d.entryId, d.tabs, d.roles.map((r: any) => ({ id: r.id, name: r.name, optional: !!r.optional })), []);
    d.dirty = false;
    if (st) st.textContent = 'Saved';
  } catch (e: any) {
    if (st) st.textContent = 'Save failed';
    toast('Save failed: ' + (e && e.message ? e.message : String(e)));
  }
  d.saving = false;
}
