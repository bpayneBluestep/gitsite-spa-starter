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
  roles: any[];                     // tpl mode: raw roles (id, name, holders) — owners are DERIVED slots
  anchors: any[];                   // tpl mode: auto-place rules (phase 5)
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
      correcting: false, locked: {}, roles: [], anchors: [],
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
      d.anchors = (t.bodyJson.anchors || []) as any[];
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
      onclick="dsgSetOwner('${esc(o.id)}')" title="${d.locked[o.id] ? esc(o.name) + ' has already signed — their fields are locked' : 'New fields are assigned to ' + esc(o.name)}">
      <span class="dsg-owner-dot"></span>${esc(o.name)}${d.locked[o.id] ? ' 🔒' : ''}</button>`).join('');

  const palette = Object.keys(GEO_TAB_DEFAULTS).map(t => `
    <button class="dsg-pal ${d.armedType === t ? 'armed' : ''}" onclick="dsgPalClick('${t}')"
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
      <p>${d.armedType ? `Click the page to place a <b>${esc(GEO_TAB_LABELS[d.armedType])}</b> for <b>${esc((d.owners.find(o => o.id === d.activeOwner) || { name: '?' }).name)}</b> — Esc to cancel.` : 'Pick a field type, then click the page. Drag to move, edges to resize, arrows to nudge.'}</p></div>
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
          <div class="dsg-holders">${d.roles.map(r => `<label class="dsg-holders-row"><input type="checkbox" ${r.holders === 2 ? 'checked' : ''}
            onchange="dsgToggleHolders('${esc(r.id)}')"> ${esc(r.name)}: two signers share this role</label>`).join('')}</div>` : ''}
        </div>
        ${d.mode === 'tpl' ? dsgAnchorsCard() : ''}
        <div class="card card-pad">
          <div class="agb-side-h">Fields</div>
          <div class="dsg-palette">${palette}</div>
        </div>
        <div class="card card-pad" id="dsg-props">${dsgPropsHtml()}</div>
      </div>
      <div class="dsg-main">
        <div class="dsg-toolbar">${zoomBtns}<span class="meta" style="margin-left:auto">${d.tabs.length} field${d.tabs.length === 1 ? '' : 's'}</span></div>
        <div class="dsg-scroll" id="dsg-scroll">${pages}</div>
      </div>
    </div>`;
}

/* Properties panel for the selected tab. */
function dsgPropsHtml(): string {
  const d = DSG!;
  const t = d.tabs.find(x => x.id === d.selected);
  if (!t) return `<div class="agb-side-h">Selected field</div><p class="meta">Click a placed field to edit it.</p>`;
  if (d.locked[t.recipientId]) {
    const lockedOwner = d.owners.find(o => o.id === t.recipientId);
    return `<div class="agb-side-h">${esc(GEO_TAB_LABELS[t.type] || t.type)}</div>
      <p class="meta">${esc(lockedOwner ? lockedOwner.name : 'This recipient')} has already signed — this field can't be changed by a correction.</p>`;
  }
  const owner = d.owners.filter(o => !d.locked[o.id]).map(o => `<option value="${esc(o.id)}"${t.recipientId === o.id ? ' selected' : ''}>${esc(o.name)}</option>`).join('');
  const needsOpts = t.type === 'radioGroup' || t.type === 'dropdown';
  const auto = t.type === 'dateSigned' || t.type === 'name';
  return `<div class="agb-side-h">${esc(GEO_TAB_LABELS[t.type] || t.type)}</div>
    <div class="field"><label>Assigned to</label><select onchange="dsgProp('recipientId',this.value)">${owner}</select></div>
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
  const props = document.getElementById('dsg-props');
  if (props) props.innerHTML = dsgPropsHtml();
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
  if (t) { t.recipientId = id; dsgTouched(); }
  render();
}

function dsgArm(type: string): void {
  const d = DSG!;
  d.armedType = d.armedType === type ? '' : type;
  d.selected = '';
  render();
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
  render();
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

function dsgSelect(id: string): void {
  const d = DSG!; d.selected = id; d.armedType = '';
  // IN PLACE, never a repaint: this runs on mousedown, and rebuilding the overlay
  // here destroys the element interact.js is about to drag — which presented as
  // "drag doesn't work at all". Selection is a class toggle plus a panel refresh.
  const els = document.querySelectorAll('.dsg-tab.selected');
  for (let i = 0; i < els.length; i++) els[i].classList.remove('selected');
  const el = document.querySelector('[data-tab="' + id + '"]');
  if (el) el.classList.add('selected');
  const props = document.getElementById('dsg-props');
  if (props) props.innerHTML = dsgPropsHtml();
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
  d.roles.push({ id: id, name: name.trim() || ('Signer ' + (d.roles.length + 1)), holders: 1 });
  dsgRebuildOwners();
  d.activeOwner = id;
  dsgTouched();
  render();
}

/* Roles → designer owner SLOTS. A 2-holder role ("Sponsor(s)") becomes two slots —
   roleId (holder 1) and roleId~2 (holder 2) — so each holder's fields are placed
   and signed independently; apply maps each slot to a real person. */
function dsgOwnersFromRoles(roles: any[]): DsgOwner[] {
  const out: DsgOwner[] = [];
  roles.forEach((r: any) => {
    const base = r.name || r.label || 'Role';
    out.push({ id: r.id, name: r.holders === 2 ? base + ' (1)' : base, color: geoRecipientColor(out.length) });
    if (r.holders === 2) out.push({ id: r.id + '~2', name: base + ' (2)', color: geoRecipientColor(out.length) });
  });
  return out;
}
function dsgRebuildOwners(): void {
  const d = DSG!;
  d.owners = dsgOwnersFromRoles(d.roles);
  d.owners.push({ id: '__sender__', name: 'Sender (at send)', color: '#64748b' });
}
function dsgToggleHolders(roleId: string): void {
  const d = DSG!;
  const r = d.roles.find((x: any) => x.id === roleId);
  if (!r) return;
  const to2 = r.holders !== 2;
  if (!to2) {
    // collapsing 2 → 1 reassigns the second holder's tabs (and anchor rules) to holder 1
    for (const t of d.tabs) if (t.recipientId === roleId + '~2') t.recipientId = roleId;
    for (const a of d.anchors) if (a.roleSlot === roleId + '~2') a.roleSlot = roleId;
    if (d.activeOwner === roleId + '~2') d.activeOwner = roleId;
  }
  r.holders = to2 ? 2 : 1;
  dsgRebuildOwners();
  dsgTouched();
  render();
}

/* ---- auto-place rules (anchor tagging, phase 5) ---- */
function dsgAnchorsCard(): string {
  const d = DSG!;
  const slotName = (id: string) => (d.owners.find(o => o.id === id) || { name: id }).name;
  const rows = d.anchors.map((a: any, i: number) => `
    <div class="dsg-anchor"><div class="dsg-anchor-main"><b>“${esc(a.matchText)}”</b>
      <span class="meta">${esc(GEO_TAB_LABELS[a.tabType] || a.tabType)} → ${esc(slotName(a.roleSlot))} · dx ${a.dx || 0}, dy ${a.dy || 0}</span></div>
      <button class="ico-mini danger" title="Delete rule" onclick="dsgAnchorDel(${i})">${ic('trash', 13)}</button></div>`).join('');
  const types = ['initials', 'signature', 'text', 'dateSigned', 'checkbox'];
  return `<div class="card card-pad">
    <div class="agb-side-h">Auto-place rules</div>
    <p class="meta">On apply, each rule drops a field beside <b>every</b> occurrence of its text.</p>
    ${rows || '<p class="meta">No rules yet.</p>'}
    <div class="dsg-anchor-form">
      <input id="dsg-an-text" placeholder="Match text (exact, case-sensitive)">
      <div class="dsg-anchor-row">
        <select id="dsg-an-type">${types.map(t => `<option value="${t}">${esc(GEO_TAB_LABELS[t] || t)}</option>`).join('')}</select>
        <select id="dsg-an-slot">${d.owners.map(o => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('')}</select>
      </div>
      <div class="dsg-anchor-row">
        <input id="dsg-an-dx" type="number" value="100" title="dx (pt right of the text)"> <span class="meta">dx</span>
        <input id="dsg-an-dy" type="number" value="0" title="dy (pt down)"> <span class="meta">dy</span>
      </div>
      <button class="btn outline sm" onclick="dsgAnchorAdd()">${ic('plus', 13)} Add rule</button>
    </div>
  </div>`;
}
function dsgAnchorAdd(): void {
  const d = DSG!;
  const g = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  const text = g('dsg-an-text') ? (g('dsg-an-text') as HTMLInputElement).value.trim() : '';
  if (!text) { toast('Enter the text to match.'); return; }
  d.anchors.push({
    id: 'an_' + Math.random().toString(36).slice(2, 8),
    matchText: text,
    tabType: g('dsg-an-type') ? g('dsg-an-type')!.value : 'initials',
    roleSlot: g('dsg-an-slot') ? g('dsg-an-slot')!.value : '',
    dx: Number(g('dsg-an-dx') ? g('dsg-an-dx')!.value : 0) || 0,
    dy: Number(g('dsg-an-dy') ? g('dsg-an-dy')!.value : 0) || 0,
    required: true,
  });
  dsgTouched();
  render();
}
function dsgAnchorDel(i: number): void {
  const d = DSG!;
  d.anchors.splice(i, 1);
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
    copy.x += 12; copy.y += 12;
    d.tabs.push(copy); d.selected = copy.id; dsgTouched(); dsgRepaintAll(); return;
  }
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
    else await apiSaveTemplateDesign(d.entryId, d.tabs, d.roles.map((r: any) => ({ id: r.id, name: r.name, holders: r.holders === 2 ? 2 : 1 })), d.anchors);
    d.dirty = false;
    if (st) st.textContent = 'Saved';
  } catch (e: any) {
    if (st) st.textContent = 'Save failed';
    toast('Save failed: ' + (e && e.message ? e.message : String(e)));
  }
  d.saving = false;
}
