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
      activeOwner: '', armedType: '', selected: '', zoom: 1,
      loading: true, error: '', dirty: false, saving: false, pages: [], clipboard: null,
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
      if (env.status !== 'Draft') { d.error = 'Only Draft envelopes can be designed.'; d.loading = false; render(); return; }
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
      d.owners = roles.map((r: any, i: number) => ({ id: r.id, name: r.name || r.label || 'Role', color: geoRecipientColor(i) }));
    }
    if (!d.owners.length) { d.error = d.mode === 'env' ? 'Add at least one signing recipient before placing fields.' : 'Add a role first.'; }
    d.activeOwner = d.owners.length ? d.owners[0].id : '';
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
    <button class="dsg-owner ${d.activeOwner === o.id ? 'active' : ''}" style="--oc:${o.color}"
      onclick="dsgSetOwner('${esc(o.id)}')" title="New fields are assigned to ${esc(o.name)}">
      <span class="dsg-owner-dot"></span>${esc(o.name)}</button>`).join('');

  const palette = Object.keys(GEO_TAB_DEFAULTS).map(t => `
    <button class="dsg-pal ${d.armedType === t ? 'armed' : ''}" onclick="dsgArm('${t}')"
      title="Click, then click the page to place">${esc(GEO_TAB_LABELS[t] || t)}</button>`).join('');

  const zooms = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const zoomBtns = zooms.map(z => `<button class="btn ghost sm ${d.zoom === z ? 'dsg-z-on' : ''}" onclick="dsgZoom(${z})">${z * 100}%</button>`).join('');

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
          ${d.mode === 'tpl' ? `<button class="btn ghost sm" onclick="dsgAddRole()">${ic('plus', 13)} Add role</button>` : ''}
        </div>
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
  const owner = d.owners.map(o => `<option value="${esc(o.id)}"${t.recipientId === o.id ? ' selected' : ''}>${esc(o.name)}</option>`).join('');
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
    const el = document.createElement('div');
    el.className = 'dsg-tab' + (d.selected === t.id ? ' selected' : '');
    el.setAttribute('data-tab', t.id);
    el.style.setProperty('--oc', o ? o.color : '#64748b');
    el.innerHTML = `<span class="dsg-tab-label">${esc(t.type === 'checkbox' ? '' : (t.label || GEO_TAB_LABELS[t.type] || t.type))}</span>`;
    geoApplyTabRect(el, t, scale);
    el.addEventListener('mousedown', (ev) => { ev.stopPropagation(); dsgSelect(t.id); });
    el.addEventListener('click', (ev) => ev.stopPropagation());
    overlay.appendChild(el);
    dsgMakeInteractive(el, t);
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

/* ---- interact.js wiring: move + resize with grid snap, clamped to the page ---- */
async function dsgMakeInteractive(el: HTMLElement, tab: DsgTab): Promise<void> {
  const interact = await loadInteract();
  const d = DSG!;
  interact(el)
    .draggable({
      modifiers: [interact.modifiers.snap({ targets: [interact.snappers.grid({ x: 6, y: 6 })], relativePoints: [{ x: 0, y: 0 }] })],
      listeners: {
        move(ev: any) {
          const scale = dsgScaleFor(tab.docId, tab.page);
          tab.x += geoPxToPt(ev.dx, scale);
          tab.y += geoPxToPt(ev.dy, scale);
          const info = dsgPageInfo(tab.docId, tab.page);
          if (info) geoClampTab(tab, info.wPt, info.hPt);
          geoApplyTabRect(el, tab, scale);
        },
        end() { dsgTouched(); },
      },
    })
    .resizable({
      edges: { left: true, right: true, bottom: true, top: true },
      modifiers: [interact.modifiers.restrictSize({ min: { width: 10, height: 10 } })],
      listeners: {
        move(ev: any) {
          const scale = dsgScaleFor(tab.docId, tab.page);
          tab.w = geoPxToPt(ev.rect.width, scale);
          tab.h = geoPxToPt(ev.rect.height, scale);
          tab.x += geoPxToPt(ev.deltaRect.left, scale);
          tab.y += geoPxToPt(ev.deltaRect.top, scale);
          const info = dsgPageInfo(tab.docId, tab.page);
          if (info) geoClampTab(tab, info.wPt, info.hPt);
          geoApplyTabRect(el, tab, scale);
        },
        end() { dsgTouched(); },
      },
    });
}

/* ---- interactions ---- */
function dsgSetOwner(id: string): void {
  const d = DSG!; d.activeOwner = id;
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

function dsgPageClick(ev: MouseEvent, docId: string, page: number): void {
  const d = DSG!;
  if (!d.armedType) { d.selected = ''; dsgRepaintAll(); return; }
  const pageEl = (ev.currentTarget as HTMLElement);
  const rect = pageEl.getBoundingClientRect();
  const scale = dsgScaleFor(docId, page);
  const def = GEO_TAB_DEFAULTS[d.armedType];
  const x = geoPxToPt(ev.clientX - rect.left, scale) - def.w / 2;
  const y = geoPxToPt(ev.clientY - rect.top, scale) - def.h / 2;
  const tab: DsgTab = {
    id: 't_' + Math.random().toString(36).slice(2, 10),
    docId: docId, page: page, x: x, y: y, w: def.w, h: def.h,
    type: d.armedType, recipientId: d.activeOwner,
    required: true, label: '', options: d.armedType === 'radioGroup' ? ['Option 1', 'Option 2'] : [],
  };
  const info = dsgPageInfo(docId, page);
  if (info) geoClampTab(tab, info.wPt, info.hPt);
  d.tabs.push(tab);
  d.selected = tab.id;
  d.armedType = '';
  dsgTouched();
  render();
}

function dsgSelect(id: string): void {
  const d = DSG!; d.selected = id; d.armedType = '';
  dsgRepaintAll();
}

function dsgProp(key: string, val: any): void {
  const d = DSG!;
  const t = d.tabs.find(x => x.id === d.selected);
  if (!t) return;
  (t as any)[key] = val;
  dsgTouched();
  if (key === 'recipientId') dsgRepaintAll();
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

function dsgAddRole(): void {
  const d = DSG!;
  const name = prompt('Role name (e.g. "Parent / Guardian"):', 'Signer ' + (d.owners.length + 1));
  if (name == null) return;
  const id = 'role' + (d.owners.length + 1) + '_' + Math.random().toString(36).slice(2, 6);
  d.owners.push({ id: id, name: name.trim() || ('Signer ' + (d.owners.length + 1)), color: geoRecipientColor(d.owners.length) });
  d.activeOwner = id;
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
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'c') { d.clipboard = JSON.parse(JSON.stringify(t)); return; }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'v') {
    if (!d.clipboard) return;
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
    else await apiSaveTemplateDesign(d.entryId, d.tabs, d.owners.map(o => ({ id: o.id, name: o.name })));
    d.dirty = false;
    if (st) st.textContent = 'Saved';
  } catch (e: any) {
    if (st) st.textContent = 'Save failed';
    toast('Save failed: ' + (e && e.message ? e.message : String(e)));
  }
  d.saving = false;
}
