/* =====================================================================
   appbuilder.ts — the Application Builder (full-bleed admin view).

   Authors the parent-application TEMPLATE: an ordered list of fields the
   builder edits and the interpreter (on the public satellite site) renders
   into a fillable form. The template is stored as draft + published JSON on
   the org's `app` form (see maestro getAppTemplate/saveAppTemplate/
   publishAppTemplate). Publishing is what families fill out.

   UI: a 3-pane flagship builder modeled on summitridge's Application Builder
   (files/1461779) — a searchable Navigator (left) outlining sections+fields, a
   Canvas (middle) of section-grouped compact cards with inline editing + a
   normal/compact view toggle, and a slide-in Inspector (right) for deep field
   settings. A status pill bar (fields/unmapped/required/conditional/inactive),
   a field-type picker grid, form settings, and a Logic overview round it out.
   All markup is `.bs-pab-*` (styles in appbuilder.css); the template JSON shape
   is unchanged so the interpreter + ingester speak one contract.

   Route: #/builder  (launched from Settings ▸ Applications)

   Render discipline: the SPA's render() wipes #app, which would steal input
   focus on every keystroke. Field-property text edits update state in place and
   patch the DOM surgically (card/nav label); structural changes re-render a
   whole pane (canvas / navigator / inspector).
   ===================================================================== */

type AppFieldType =
  | 'header' | 'static_text' | 'text' | 'memo' | 'number' | 'date'
  | 'single_select' | 'multi_select' | 'boolean' | 'doc_upload';

interface AppOption { id: string; label: string; }
interface AppVisibility {
  sourceFieldId: string;
  // boolean source: show when Yes and/or No is chosen; select source: show when
  // any of optionIds is chosen.
  match: { boolean?: { true: boolean; false: boolean }; optionIds?: string[] };
}
interface AppField {
  id: string;
  type: AppFieldType;
  label: string;
  description: string;
  required: boolean;
  mapTo: string;          // '' or a maestro client-field key (firstName, dob, …)
  active: boolean;        // inactive fields are kept but not rendered to parents
  settings: {
    content?: string;     // static_text body
    placeholder?: string; // text / memo / number
    options?: AppOption[];// single_select / multi_select
  };
  visibility?: AppVisibility | null;
}
interface AppTemplate {
  schemaVersion: number;
  title: string;
  description: string;
  lastModifiedUtc: string;
  strings: { submittedMessage?: string };
  fields: AppField[];
}

// mapTo targets — these are maestro CLIENT_FIELDS payload keys, so the ingester
// can populate the real record by passing { [mapTo]: value } to the field engine.
const MAP_TO_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '— Not mapped —' },
  { value: 'firstName', label: 'Client • First name' },
  { value: 'lastName', label: 'Client • Last name' },
  { value: 'prefName', label: 'Client • Preferred name' },
  { value: 'email', label: 'Client • Email' },
  { value: 'dob', label: 'Client • Date of birth' },
  { value: 'cell', label: 'Client • Cell phone' },
  { value: 'homePhone', label: 'Client • Home phone' },
  { value: 'homeAddress', label: 'Client • Home address' },
  { value: 'homeCity', label: 'Client • City' },
  { value: 'homeState', label: 'Client • State' },
  { value: 'homeZip', label: 'Client • ZIP' },
  { value: 'sex', label: 'Client • Sex' },
  { value: 'gender', label: 'Client • Gender' },
  { value: 'pronouns', label: 'Client • Pronouns' },
  { value: 'race', label: 'Client • Race' },
  { value: 'ethnicity', label: 'Client • Ethnicity' },
  { value: 'sexualOrientation', label: 'Client • Sexual orientation' },
  { value: 'ssn', label: 'Client • SSN' },
];

const FIELD_TYPES: { type: AppFieldType; glyph: string; label: string; sub: string }[] = [
  { type: 'header', glyph: 'H', label: 'Header', sub: 'Section title' },
  { type: 'static_text', glyph: '✎', label: 'Static Text', sub: 'Instructions / notes' },
  { type: 'text', glyph: 'T', label: 'Text', sub: 'Short answer' },
  { type: 'memo', glyph: '¶', label: 'Memo', sub: 'Multi-line answer' },
  { type: 'number', glyph: '#', label: 'Number', sub: 'Numeric input' },
  { type: 'date', glyph: '▦', label: 'Date', sub: 'Date picker' },
  { type: 'single_select', glyph: '◉', label: 'Single Select', sub: 'Dropdown / radio' },
  { type: 'multi_select', glyph: '☑', label: 'Multi Select', sub: 'Checkboxes' },
  { type: 'boolean', glyph: '⇄', label: 'Yes / No', sub: 'Boolean toggle' },
  { type: 'doc_upload', glyph: '↑', label: 'Document Upload', sub: 'File attachment' },
];
function fieldTypeMeta(t: AppFieldType) {
  return FIELD_TYPES.filter(x => x.type === t)[0] || { type: t, glyph: '?', label: t, sub: '' };
}
// Types that don't capture an answer (no required / mapTo / data).
function isDisplayType(t: AppFieldType): boolean { return t === 'header' || t === 'static_text'; }
// Types eligible as a conditional-logic SOURCE (a discrete, checkable value).
function isLogicSource(t: AppFieldType): boolean { return t === 'boolean' || t === 'single_select' || t === 'multi_select'; }

/* ---- state ---- */
interface BuilderState {
  template: AppTemplate | null;
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  dirty: boolean;
  lastUpdated: string;
  lastPublished: string;
  busy: '' | 'saving' | 'publishing';
  navQuery: string;                 // Navigator search text
  canvasQuery: string;              // Canvas filter text
  compact: boolean;                 // compact canvas view
  inspectorOpen: boolean;           // right slide-in panel open
  collapsed: { [sectionId: string]: boolean }; // collapsed section ids
  dragId: string;                   // field id being dragged
}
const BUILDER: BuilderState = {
  template: null, loading: false, error: null,
  selectedId: null, dirty: false, lastUpdated: '', lastPublished: '', busy: '',
  navQuery: '', canvasQuery: '', compact: false, inspectorOpen: false, collapsed: {}, dragId: '',
};

function uuid(): string {
  if ((window as any).crypto && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function blankTemplate(): AppTemplate {
  return {
    schemaVersion: 1,
    title: 'Parent Application',
    description: '',
    lastModifiedUtc: '',
    strings: { submittedMessage: 'Thank you — your application has been submitted.' },
    fields: [],
  };
}

function createField(type: AppFieldType): AppField {
  const f: AppField = {
    id: uuid(), type: type, label: '', description: '',
    required: false, mapTo: '', active: true, settings: {}, visibility: null,
  };
  if (type === 'header') f.label = 'New Section';
  else if (type === 'static_text') f.settings.content = 'Enter instructions here.';
  else f.label = 'Untitled question';
  if (type === 'single_select' || type === 'multi_select') {
    f.settings.options = [{ id: uuid(), label: 'Option 1' }, { id: uuid(), label: 'Option 2' }];
  }
  if (type === 'text' || type === 'memo' || type === 'number') f.settings.placeholder = '';
  return f;
}

/* ---- load ---- */
async function loadAppTemplate(force = false): Promise<void> {
  if (BUILDER.loading) return;
  if (BUILDER.template && !force) return;
  BUILDER.loading = true; BUILDER.error = null;
  try {
    const data = await apiGetAppTemplate();
    const tmpl = (data && (data.draft || data.published)) || blankTemplate();
    BUILDER.template = normalizeTemplate(tmpl);
    BUILDER.lastUpdated = (data && data.lastUpdated) || '';
    BUILDER.lastPublished = (data && data.lastPublished) || '';
    BUILDER.dirty = false;
  } catch (e: any) {
    BUILDER.error = e && e.message ? e.message : String(e);
  } finally {
    BUILDER.loading = false;
    if (typeof render === 'function') render();
  }
}

// Defensive: coerce a loaded JSON blob into a well-formed template so the UI
// never trips on a hand-edited or partial draft.
function normalizeTemplate(t: any): AppTemplate {
  const base = blankTemplate();
  if (!t || typeof t !== 'object') return base;
  const fields: AppField[] = Array.isArray(t.fields) ? t.fields.map(normalizeField).filter(Boolean) as AppField[] : [];
  return {
    schemaVersion: t.schemaVersion || 1,
    title: typeof t.title === 'string' ? t.title : base.title,
    description: typeof t.description === 'string' ? t.description : '',
    lastModifiedUtc: t.lastModifiedUtc || '',
    strings: (t.strings && typeof t.strings === 'object') ? t.strings : base.strings,
    fields: fields,
  };
}
function normalizeField(f: any): AppField | null {
  if (!f || typeof f !== 'object' || !f.type) return null;
  const settings = (f.settings && typeof f.settings === 'object') ? f.settings : {};
  if (settings.options && Array.isArray(settings.options)) {
    settings.options = settings.options
      .map((o: any) => ({ id: o && o.id ? String(o.id) : uuid(), label: o && o.label != null ? String(o.label) : '' }));
  }
  return {
    id: f.id ? String(f.id) : uuid(),
    type: f.type,
    label: typeof f.label === 'string' ? f.label : '',
    description: typeof f.description === 'string' ? f.description : '',
    required: f.required === true,
    mapTo: typeof f.mapTo === 'string' ? f.mapTo : '',
    active: f.active !== false,
    settings: settings,
    visibility: (f.visibility && f.visibility.sourceFieldId) ? f.visibility : null,
  };
}

function builderTemplate(): AppTemplate {
  if (!BUILDER.template) BUILDER.template = blankTemplate();
  return BUILDER.template;
}
function builderField(id: string): AppField | null {
  return builderTemplate().fields.filter(f => f.id === id)[0] || null;
}
function markDirty(): void {
  BUILDER.dirty = true;
  builderTemplate().lastModifiedUtc = new Date().toISOString();
  const ind = document.getElementById('pab-dirty');
  if (ind) ind.textContent = 'Unsaved changes';
}

/* ---- shared derivations ---- */
// The label shown for a field on the canvas / navigator.
function fieldPreviewLabel(f: AppField): string {
  if (f.type === 'header') return f.label || 'Untitled Section';
  if (f.type === 'static_text') return f.settings.content || 'Instructions';
  return f.label || 'Untitled question';
}
// Group the flat field list into sections: a `header` field opens a section;
// everything after it (until the next header) is its children. Fields before
// the first header live in an "orphan" (header-less) section.
function groupSections(fields: AppField[]): { header: AppField | null; items: { field: AppField; index: number }[] }[] {
  const groups: { header: AppField | null; items: { field: AppField; index: number }[] }[] = [];
  let cur: { header: AppField | null; items: { field: AppField; index: number }[] } | null = null;
  fields.forEach((f, i) => {
    if (f.type === 'header') {
      cur = { header: f, items: [] };
      groups.push(cur);
    } else {
      if (!cur) { cur = { header: null, items: [] }; groups.push(cur); }
      cur.items.push({ field: f, index: i });
    }
  });
  return groups;
}
function statCounts(t: AppTemplate) {
  const q = t.fields.filter(f => !isDisplayType(f.type));
  return {
    total: t.fields.length,
    unmapped: q.filter(f => !f.mapTo).length,
    required: q.filter(f => f.required).length,
    conditional: t.fields.filter(f => f.visibility && f.visibility.sourceFieldId).length,
    inactive: t.fields.filter(f => !f.active).length,
  };
}

/* ---- top-level view ---- */
function viewAppBuilder(): string {
  // Super-only — the builder edits org-wide config.
  if (SESSION && SESSION.loggedIn && !SESSION.isSuper) {
    return shell('settings', `<div class="card"><div class="empty"><div class="ico">${ic('settings', 22)}</div>
      <b>Admins only</b><p>The Application Builder is available to organization administrators.</p>
      <a class="btn primary" href="#/settings">${ic('chevR', 15)} Back to Settings</a></div></div>`);
  }
  if (BUILDER.template === null) {
    if (!BUILDER.loading && !BUILDER.error) loadAppTemplate();
    const inner = BUILDER.error
      ? `<div class="card"><div class="empty"><div class="ico">${ic('alert', 22)}</div><b>Couldn't load the template</b>
         <p>${esc(BUILDER.error)}</p><button class="btn primary" onclick="loadAppTemplate(true)">${ic('clock', 15)} Retry</button></div></div>`
      : `<div class="card"><div class="empty"><div class="ico">${ic('clock', 22)}</div><b>Loading builder…</b></div></div>`;
    return topbar() + `<div class="body">${sidebar('settings', true)}<main class="main"><div class="content">${inner}</div></main></div>`;
  }
  const t = builderTemplate();
  const root = `<div class="bs-pab-root">
    ${builderHeader(t)}
    <div class="bs-pab-body${BUILDER.inspectorOpen ? ' inspector-open' : ''}">
      ${builderNav(t)}
      ${builderCanvasWrap(t)}
      ${builderInspectorPanel()}
    </div>
  </div>`;
  return topbar() + `<div class="body">${sidebar('settings', true)}<main class="main pab-main">${root}</main></div>`;
}

/* ---- header ---- */
function builderStatSpan(id: string, num: number, label: string, cls: string): string {
  return `<span class="bs-pab-stat${cls ? ' ' + cls : ''}" id="stat-${id}"><span class="bs-pab-stat-num">${num}</span> ${esc(label)}</span>`;
}
function builderHeader(t: AppTemplate): string {
  const c = statCounts(t);
  const pub = BUILDER.lastPublished ? ('Published ' + fmtStamp(BUILDER.lastPublished)) : 'Not published yet';
  const dirty = BUILDER.dirty ? 'Unsaved changes' : (BUILDER.lastUpdated ? 'Saved' : '');
  const busy = BUILDER.busy ? ' disabled' : '';
  const div = '<span class="bs-pab-stat-divider"></span>';
  return `<header class="bs-pab-header">
    <div class="bs-pab-header-left">
      <div class="bs-pab-logo-mark">⬡</div>
      <div class="bs-pab-title-block">
        <div class="bs-pab-main-title">${esc(t.title || 'Application Builder')}</div>
        <div class="bs-pab-main-subtitle">${esc(pub)}</div>
      </div>
    </div>
    <div class="bs-pab-header-center">
      <div class="bs-pab-status-bar">
        ${builderStatSpan('total', c.total, 'fields', '')}${div}
        ${builderStatSpan('unmapped', c.unmapped, 'unmapped', c.unmapped ? 'bs-pab-stat-warn' : '')}${div}
        ${builderStatSpan('required', c.required, 'required', 'bs-pab-stat-req')}${div}
        ${builderStatSpan('conditional', c.conditional, 'conditional', '')}${div}
        ${builderStatSpan('inactive', c.inactive, 'inactive', 'bs-pab-stat-muted')}
      </div>
    </div>
    <div class="bs-pab-header-right">
      <span class="bs-pab-dirty" id="pab-dirty">${esc(dirty)}</span>
      <button class="bs-pab-btn bs-pab-btn-ghost" onclick="builderFormSettings()" title="Form settings">⚙ Settings</button>
      <button class="bs-pab-btn bs-pab-btn-ghost" onclick="builderOpenLogic()" title="View all logic rules">≣ Logic</button>
      <button class="bs-pab-btn bs-pab-btn-outline" id="pab-save" onclick="builderSave()"${busy}>💾 Save Draft</button>
      <button class="bs-pab-btn bs-pab-btn-primary" id="pab-publish" onclick="builderPublish()"${busy}>🚀 Publish</button>
    </div>
  </header>`;
}

/* ---- navigator (left) ---- */
function builderNav(t: AppTemplate): string {
  return `<aside class="bs-pab-nav">
    <div class="bs-pab-nav-header">
      <span class="bs-pab-nav-title">Navigator</span>
      <div class="bs-pab-nav-header-actions">
        <button class="bs-pab-add-field-btn" onclick="builderOpenPicker()"><span class="bs-pab-add-field-plus">+</span> Add Field</button>
        <button class="bs-pab-icon-btn" title="Collapse all sections" onclick="builderCollapseAll()">⊟</button>
      </div>
    </div>
    <div class="bs-pab-nav-search-wrap">
      <input class="bs-pab-nav-search" id="pab-nav-search" type="text" placeholder="Search fields…" value="${esc(BUILDER.navQuery)}" oninput="builderNavSearchInput(this.value)" autocomplete="off">
    </div>
    <div class="bs-pab-nav-list" id="pab-nav-list">${builderNavList(t)}</div>
  </aside>`;
}
function builderNavList(t: AppTemplate): string {
  if (!t.fields.length) return `<div class="bs-pab-empty-state" style="padding:18px 12px"><strong>No fields yet</strong>Use <em>Add Field</em> above.</div>`;
  const filter = BUILDER.navQuery.toLowerCase().trim();
  const groups = groupSections(t.fields);
  let html = '';
  for (const g of groups) {
    const sid = g.header ? g.header.id : '__orphan__';
    const collapsed = !!BUILDER.collapsed[sid];
    const matched = g.items.filter(it => it.field.type !== 'header' && (!filter || fieldPreviewLabel(it.field).toLowerCase().indexOf(filter) >= 0));
    const label = g.header ? (g.header.label || 'Untitled Section') : 'Ungrouped';
    const headerMatch = !filter || label.toLowerCase().indexOf(filter) >= 0;
    if (filter && !headerMatch && !matched.length) continue;
    const toShow = filter ? matched : g.items.filter(it => it.field.type !== 'header');
    const items = toShow.map(it => {
      const f = it.field;
      const active = BUILDER.selectedId === f.id ? ' active' : '';
      const req = f.required ? ' bs-pab-nav-item-req' : '';
      return `<div class="bs-pab-nav-item${active}${req}" onclick="builderSelect('${esc(f.id)}')">
        <div class="bs-pab-nav-item-dot"></div>
        <span class="bs-pab-nav-item-label">${esc(fieldPreviewLabel(f))}</span>
        <span class="bs-pab-nav-item-type">${esc(fieldTypeMeta(f.type).label)}</span>
      </div>`;
    }).join('');
    if (g.header) {
      const count = filter ? matched.length : g.items.filter(it => it.field.type !== 'header').length;
      html += `<div class="bs-pab-nav-section">
        <div class="bs-pab-nav-section-header${collapsed ? ' collapsed' : ''}" onclick="builderToggleSection('${esc(sid)}')">
          <span class="bs-pab-nav-section-arrow">▼</span>
          <span class="bs-pab-nav-section-label" onclick="event.stopPropagation();builderSelect('${esc(g.header.id)}')">${esc(label)}</span>
          <span class="bs-pab-nav-section-count">${count}</span>
        </div>
        <div class="bs-pab-nav-items${collapsed ? ' collapsed' : ''}">${items}</div>
      </div>`;
    } else {
      html += `<div class="bs-pab-nav-section bs-pab-nav-unsectioned"><div class="bs-pab-nav-items">${items}</div></div>`;
    }
  }
  return html;
}

/* ---- canvas (middle) ---- */
function builderCanvasWrap(t: AppTemplate): string {
  return `<main class="bs-pab-canvas-wrap">
    <div class="bs-pab-canvas-toolbar">
      <div class="bs-pab-canvas-search-wrap">
        <input class="bs-pab-canvas-search" id="pab-canvas-search" type="text" placeholder="Filter fields on canvas…" value="${esc(BUILDER.canvasQuery)}" oninput="builderCanvasFilterInput(this.value)" autocomplete="off">
      </div>
      <div class="bs-pab-view-toggle">
        <button class="bs-pab-view-btn${!BUILDER.compact ? ' bs-pab-view-active' : ''}" title="Normal view" onclick="builderSetView(false)">☰</button>
        <button class="bs-pab-view-btn${BUILDER.compact ? ' bs-pab-view-active' : ''}" title="Compact view" onclick="builderSetView(true)">≡</button>
      </div>
    </div>
    <div class="bs-pab-canvas${BUILDER.compact ? ' compact' : ''}" id="pab-canvas">${builderCanvas(t)}</div>
  </main>`;
}
function builderCanvas(t: AppTemplate): string {
  if (!t.fields.length) {
    return `<div class="bs-pab-empty-state"><strong>No fields yet</strong>Click <em>Add Field</em> in the navigator to get started.</div>`;
  }
  const filter = BUILDER.canvasQuery.toLowerCase().trim();
  const groups = groupSections(t.fields);
  let html = '';
  for (const g of groups) {
    const sid = g.header ? g.header.id : '__orphan__';
    const collapsed = !!BUILDER.collapsed[sid];
    const matched = g.items.filter(it => !filter || fieldPreviewLabel(it.field).toLowerCase().indexOf(filter) >= 0);
    const headerMatch = !filter || (g.header && (g.header.label || '').toLowerCase().indexOf(filter) >= 0);
    if (filter && !headerMatch && !matched.length) continue;
    const toRender = filter ? matched : g.items;
    html += `<div class="bs-pab-section-group">`;
    if (g.header) html += builderSectionHeaderCard(g.header, filter ? matched.length : g.items.length, collapsed);
    html += `<div class="bs-pab-section-body${collapsed ? ' collapsed' : ''}"><div class="bs-pab-field-list">`;
    html += toRender.map(it => builderFieldCard(it.field)).join('');
    html += `</div></div></div>`;
  }
  return html;
}
function builderSectionHeaderCard(f: AppField, count: number, collapsed: boolean): string {
  const sel = BUILDER.selectedId === f.id ? ' bs-pab-field-selected' : '';
  return `<div class="bs-pab-section-header-card${sel}" draggable="true" data-fid="${esc(f.id)}"
      ondragstart="builderDragStart(event,'${esc(f.id)}')" ondragover="builderDragOver(event)" ondrop="builderDrop(event,'${esc(f.id)}')" ondragend="builderDragEnd()"
      onclick="builderOpenInspector('${esc(f.id)}')">
    <button class="bs-pab-section-collapse-btn${collapsed ? ' collapsed' : ''}" title="Toggle section" onclick="event.stopPropagation();builderToggleSection('${esc(f.id)}')">▼</button>
    <span class="bs-pab-section-drag-handle" title="Drag to reorder">⠿</span>
    <span class="bs-pab-section-label" data-fid-label="${esc(f.id)}">${esc(f.label || 'Untitled Section')}</span>
    <span class="bs-pab-section-meta">${count} field${count !== 1 ? 's' : ''}</span>
    <div class="bs-pab-section-field-actions">
      <button class="bs-pab-icon-btn" title="Duplicate" onclick="event.stopPropagation();builderDuplicate('${esc(f.id)}')">⧉</button>
      <button class="bs-pab-icon-btn bs-pab-icon-btn-danger" title="Delete section" onclick="event.stopPropagation();builderDelete('${esc(f.id)}')">🗑</button>
    </div>
  </div>`;
}
function fieldCardHint(f: AppField): string {
  if (!f.active) return 'Hidden — kept for historical data';
  if (f.visibility && f.visibility.sourceFieldId) return 'Shown conditionally';
  if (f.mapTo) { const o = MAP_TO_OPTIONS.filter(x => x.value === f.mapTo)[0]; return o ? o.label : f.mapTo; }
  if (f.type === 'static_text') return '';
  return 'Not mapped';
}
function fieldBadges(f: AppField): string {
  const b: string[] = [];
  if (f.required && !isDisplayType(f.type)) b.push('<span class="bs-pab-badge-pill bs-pab-badge-req">Req</span>');
  if (f.visibility && f.visibility.sourceFieldId) b.push('<span class="bs-pab-badge-pill bs-pab-badge-cond">Cond</span>');
  if (f.mapTo) b.push('<span class="bs-pab-badge-pill bs-pab-badge-mapped">Mapped</span>');
  if (!f.active) b.push('<span class="bs-pab-badge-pill bs-pab-badge-inactive">Off</span>');
  return b.join('');
}
function builderFieldCard(f: AppField): string {
  const sel = BUILDER.selectedId === f.id;
  const hint = fieldCardHint(f);
  return `<div class="bs-pab-field-card${sel ? ' bs-pab-field-selected' : ''}${!f.active ? ' bs-pab-field-inactive' : ''}" draggable="true" data-fid="${esc(f.id)}"
      ondragstart="builderDragStart(event,'${esc(f.id)}')" ondragover="builderDragOver(event)" ondrop="builderDrop(event,'${esc(f.id)}')" ondragend="builderDragEnd()"
      onclick="builderSelect('${esc(f.id)}')">
    <div class="bs-pab-field-row">
      <div class="bs-pab-field-handle"><div class="bs-pab-handle-line"></div><div class="bs-pab-handle-line"></div><div class="bs-pab-handle-line"></div></div>
      <span class="bs-pab-field-type-pill bs-pab-type-${esc(f.type)}">${esc(fieldTypeMeta(f.type).label)}</span>
      <div class="bs-pab-field-main">
        <div class="bs-pab-field-label-text" data-fid-label="${esc(f.id)}">${esc(fieldPreviewLabel(f))}</div>
        ${hint ? `<div class="bs-pab-field-hint">${esc(hint)}</div>` : ''}
      </div>
      <div class="bs-pab-field-badges">${fieldBadges(f)}</div>
      <div class="bs-pab-field-row-actions">
        <button class="bs-pab-icon-btn" title="Duplicate" onclick="event.stopPropagation();builderDuplicate('${esc(f.id)}')">⧉</button>
        <button class="bs-pab-icon-btn bs-pab-icon-btn-danger" title="Delete" onclick="event.stopPropagation();builderDelete('${esc(f.id)}')">🗑</button>
      </div>
    </div>
    ${sel ? builderInlineEditor(f) : ''}
  </div>`;
}
// Inline quick-edit shown under the selected card: label + map-to, required/active
// toggles, and a link into the full inspector. Mirrors the reference's card editor.
function builderInlineEditor(f: AppField): string {
  const answerable = !isDisplayType(f.type);
  let labelGroup: string;
  if (f.type === 'static_text') {
    labelGroup = `<div class="bs-pab-inline-group bs-pab-inline-group-flex">
      <div class="bs-pab-inline-label">Instructions text</div>
      <textarea class="bs-pab-inline-input" style="min-height:52px;resize:vertical" oninput="builderSetProp('${esc(f.id)}','content',this.value)">${esc(f.settings.content || '')}</textarea>
    </div>`;
  } else {
    labelGroup = `<div class="bs-pab-inline-group bs-pab-inline-group-flex">
      <div class="bs-pab-inline-label">${f.type === 'header' ? 'Section title' : 'Question label'}</div>
      <input class="bs-pab-inline-input" value="${esc(f.label || '')}" oninput="builderSetProp('${esc(f.id)}','label',this.value)" autocomplete="off">
    </div>`;
  }
  let mapGroup = '';
  if (answerable) {
    const opts = MAP_TO_OPTIONS.map(o => `<option value="${esc(o.value)}"${o.value === f.mapTo ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
    mapGroup = `<div class="bs-pab-inline-group bs-pab-inline-group-fixed" style="flex:0 0 180px;min-width:180px">
      <div class="bs-pab-inline-label">Map to</div>
      <select class="bs-pab-inline-select" onchange="builderSetProp('${esc(f.id)}','mapTo',this.value)">${opts}</select>
    </div>`;
  }
  const toggle = (prop: 'required' | 'active', label: string, on: boolean) =>
    `<div class="bs-pab-inline-toggle-item" onclick="builderSetBool('${esc(f.id)}','${prop}',${on ? 'false' : 'true'})">
      <div class="bs-pab-toggle-pill${on ? ' bs-pab-toggle-on' : ''}"></div>
      <span class="bs-pab-toggle-label">${esc(label)}</span>
    </div>`;
  let toggles = '';
  if (answerable) toggles = `<div class="bs-pab-inline-toggles">${toggle('required', 'Required', f.required)}${toggle('active', 'Active', f.active)}</div>`;
  else if (f.type === 'header') toggles = `<div class="bs-pab-inline-toggles">${toggle('active', 'Active', f.active)}</div>`;
  return `<div class="bs-pab-inline-editor" onclick="event.stopPropagation()">
    <div class="bs-pab-inline-row">${labelGroup}${mapGroup}</div>
    ${toggles}
    <button class="bs-pab-inline-more-btn" onclick="event.stopPropagation();builderOpenInspector('${esc(f.id)}')">More settings (description, logic, type options) →</button>
  </div>`;
}

/* ---- inspector (right, slide-in) ---- */
function builderInspectorPanel(): string {
  return `<aside class="bs-pab-inspector-panel">
    <div class="bs-pab-inspector-header">
      <span class="bs-pab-inspector-title" id="pab-insp-title">Field Settings</span>
      <button class="bs-pab-icon-btn" title="Close" onclick="builderCloseInspector()">✕</button>
    </div>
    <div class="bs-pab-inspector" id="pab-inspector">${builderInspector(BUILDER.selectedId ? builderField(BUILDER.selectedId) : null)}</div>
  </aside>`;
}
function inspSection(title: string, inner: string): string {
  return `<div class="bs-pab-inspector-section"><div class="bs-pab-insp-section-title">${esc(title)}</div>${inner}</div>`;
}
function inspGroup(label: string, control: string, hint: string): string {
  return `<div class="bs-pab-field-group"><div class="bs-pab-label">${esc(label)}</div>${control}${hint ? `<div class="bs-pab-helper">${esc(hint)}</div>` : ''}</div>`;
}
function inspToggleRow(label: string, hint: string, on: boolean, onclickExpr: string): string {
  return `<div class="bs-pab-toggle-row">
    <div><div class="bs-pab-label">${esc(label)}</div>${hint ? `<div class="bs-pab-helper">${esc(hint)}</div>` : ''}</div>
    <div class="bs-pab-toggle-pill${on ? ' bs-pab-toggle-on' : ''}" onclick="${onclickExpr}"></div>
  </div>`;
}
function builderInspector(f: AppField | null): string {
  if (!f) return `<div class="bs-pab-empty-state"><strong>No field selected</strong>Select a field on the canvas to edit its settings.</div>`;
  const answerable = !isDisplayType(f.type);
  const out: string[] = [];

  // Basic
  let basic = '';
  if (f.type === 'static_text') {
    basic += inspGroup('Content', `<textarea class="bs-pab-input" style="min-height:70px" oninput="builderSetProp('${esc(f.id)}','content',this.value)">${esc(f.settings.content || '')}</textarea>`, '');
  } else {
    basic += inspGroup(f.type === 'header' ? 'Section title' : 'Label',
      `<input class="bs-pab-input" value="${esc(f.label || '')}" oninput="builderSetProp('${esc(f.id)}','label',this.value)" autocomplete="off">`, '');
    basic += inspGroup('Description (optional)',
      `<textarea class="bs-pab-input" style="min-height:52px" oninput="builderSetProp('${esc(f.id)}','description',this.value)">${esc(f.description || '')}</textarea>`,
      'Helper text shown below the question.');
  }
  if (answerable) basic += inspToggleRow('Required', 'Applicants must answer this question.', f.required, `builderSetBool('${esc(f.id)}','required',${f.required ? 'false' : 'true'})`);
  basic += inspToggleRow('Active', 'Turn off to hide from new applications but keep for historical data.', f.active, `builderSetBool('${esc(f.id)}','active',${f.active ? 'false' : 'true'})`);
  out.push(inspSection('Basic', basic));

  // Placeholder (text/memo/number)
  if (f.type === 'text' || f.type === 'memo' || f.type === 'number') {
    out.push(inspSection('Type Settings', inspGroup('Placeholder (optional)',
      `<input class="bs-pab-input" value="${esc(f.settings.placeholder || '')}" oninput="builderSetProp('${esc(f.id)}','placeholder',this.value)" autocomplete="off">`, '')));
  }

  // Options (selects)
  if (f.type === 'single_select' || f.type === 'multi_select') {
    const rows = (f.settings.options || []).map(o => `<div class="bs-pab-option-row">
      <input class="bs-pab-input" value="${esc(o.label)}" placeholder="Option label" oninput="builderSetOption('${esc(f.id)}','${esc(o.id)}',this.value)" autocomplete="off">
      <button class="bs-pab-icon-btn bs-pab-icon-btn-danger" title="Remove" onclick="builderRemoveOption('${esc(f.id)}','${esc(o.id)}')">🗑</button>
    </div>`).join('');
    out.push(inspSection('Options', `<div class="bs-pab-options-list">${rows || '<div class="bs-pab-helper">No options yet.</div>'}</div>
      <button class="bs-pab-btn bs-pab-btn-ghost" style="margin-top:8px" onclick="builderAddOption('${esc(f.id)}')">+ Add option</button>`));
  }

  // Mapping
  if (answerable) {
    const opts = MAP_TO_OPTIONS.map(o => `<option value="${esc(o.value)}"${o.value === f.mapTo ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
    out.push(inspSection('Mapping', inspGroup('Map answer to a record field (optional)',
      `<select class="bs-pab-select" onchange="builderSetProp('${esc(f.id)}','mapTo',this.value)">${opts}</select>`,
      'When the family submits, this answer also populates the client’s record.')));
  }

  // Logic
  out.push(inspSection('Logic (Show / Hide)', builderLogicEditor(f)));

  return out.join('');
}
function builderLogicEditor(f: AppField): string {
  const t = builderTemplate();
  const myIdx = t.fields.findIndex(x => x.id === f.id);
  const sources = t.fields.filter((x, i) => i < myIdx && isLogicSource(x.type));
  const enabled = !!(f.visibility);
  let html = `<div class="bs-pab-helper" style="margin-bottom:8px">Show this field only when an earlier Yes/No or choice question has a specific answer.</div>`;
  html += inspToggleRow('Conditional', '', enabled, `builderToggleVisibility('${esc(f.id)}',${enabled ? 'false' : 'true'})`);
  if (!enabled) return html;
  if (!sources.length) return html + `<div class="bs-pab-helper">Add a Yes/No or choice question above this one to drive the rule.</div>`;
  const vis = f.visibility as AppVisibility;
  const srcOpts = `<option value="">— Choose a question —</option>` + sources.map(s =>
    `<option value="${esc(s.id)}"${vis.sourceFieldId === s.id ? ' selected' : ''}>${esc(s.label || '(untitled)')}</option>`).join('');
  html += inspGroup('When this question…', `<select class="bs-pab-select" onchange="builderSetVisSource('${esc(f.id)}',this.value)">${srcOpts}</select>`, '');
  const src = builderField(vis.sourceFieldId);
  if (src && src.type === 'boolean') {
    const m = (vis.match && vis.match.boolean) || { true: false, false: false };
    html += `<div class="bs-pab-helper">…has the answer:</div>
      <label class="bs-pab-check"><input type="checkbox" ${m.true ? 'checked' : ''} onchange="builderSetVisBool('${esc(f.id)}','true',this.checked)"> Yes</label>
      <label class="bs-pab-check"><input type="checkbox" ${m.false ? 'checked' : ''} onchange="builderSetVisBool('${esc(f.id)}','false',this.checked)"> No</label>`;
  } else if (src && (src.type === 'single_select' || src.type === 'multi_select')) {
    const chosen = (vis.match && vis.match.optionIds) || [];
    const checks = (src.settings.options || []).map(o =>
      `<label class="bs-pab-check"><input type="checkbox" ${chosen.indexOf(o.id) >= 0 ? 'checked' : ''} onchange="builderSetVisOption('${esc(f.id)}','${esc(o.id)}',this.checked)"> ${esc(o.label)}</label>`).join('');
    html += `<div class="bs-pab-helper">…is any of:</div>${checks || '<div class="bs-pab-helper">That question has no options.</div>'}`;
  } else if (vis.sourceFieldId) {
    html += `<div class="bs-pab-helper">That source question is no longer available.</div>`;
  }
  return html;
}

/* ---- selection + inspector open/close ---- */
function builderSelect(id: string): void {
  if (BUILDER.selectedId === id) return; // no-op (keeps inline input focus)
  BUILDER.selectedId = id || null;
  builderRerenderCanvas();
  builderRerenderNav();
  if (BUILDER.inspectorOpen) builderRerenderInspector();
}
function builderOpenInspector(id: string): void {
  if (id) BUILDER.selectedId = id;
  BUILDER.inspectorOpen = true;
  const body = document.querySelector('.bs-pab-body');
  if (body) body.classList.add('inspector-open');
  builderRerenderInspector();
  builderRerenderCanvas();
  builderRerenderNav();
}
function builderCloseInspector(): void {
  BUILDER.inspectorOpen = false;
  const body = document.querySelector('.bs-pab-body');
  if (body) body.classList.remove('inspector-open');
}

/* ---- navigator / canvas controls ---- */
function builderNavSearchInput(v: string): void { BUILDER.navQuery = v; builderRerenderNav(); }
function builderCanvasFilterInput(v: string): void { BUILDER.canvasQuery = v; builderRerenderCanvas(); }
function builderSetView(compact: boolean): void {
  BUILDER.compact = compact;
  const c = document.getElementById('pab-canvas');
  if (c) c.classList.toggle('compact', compact);
  document.querySelectorAll('.bs-pab-view-btn').forEach((b, i) => b.classList.toggle('bs-pab-view-active', i === (compact ? 1 : 0)));
}
function builderToggleSection(sid: string): void {
  BUILDER.collapsed[sid] = !BUILDER.collapsed[sid];
  builderRerenderCanvas();
  builderRerenderNav();
}
function builderCollapseAll(): void {
  const t = builderTemplate();
  const headers = t.fields.filter(f => f.type === 'header');
  const anyOpen = headers.some(h => !BUILDER.collapsed[h.id]);
  headers.forEach(h => { BUILDER.collapsed[h.id] = anyOpen; });
  builderRerenderCanvas();
  builderRerenderNav();
}

/* ---- drag reorder ---- */
function builderDragStart(e: DragEvent, id: string): void {
  BUILDER.dragId = id;
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', id); } catch (_e) { /* */ } }
}
function builderDragOver(e: DragEvent): void {
  if (!BUILDER.dragId) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
}
function builderDrop(e: DragEvent, targetId: string): void {
  e.preventDefault();
  const src = BUILDER.dragId; BUILDER.dragId = '';
  if (!src || src === targetId) return;
  const t = builderTemplate();
  const from = t.fields.findIndex(f => f.id === src);
  const to = t.fields.findIndex(f => f.id === targetId);
  if (from < 0 || to < 0) return;
  const moved = t.fields.splice(from, 1)[0];
  const newTo = t.fields.findIndex(f => f.id === targetId);
  t.fields.splice(newTo + (from < to ? 1 : 0), 0, moved);
  markDirty();
  builderRerenderCanvas();
  builderRerenderNav();
}
function builderDragEnd(): void { BUILDER.dragId = ''; }

/* ---- mutations ---- */
function builderMove(id: string, dir: number): void {
  const t = builderTemplate();
  const i = t.fields.findIndex(f => f.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= t.fields.length) return;
  const tmp = t.fields[i]; t.fields[i] = t.fields[j]; t.fields[j] = tmp;
  markDirty();
  builderRerenderCanvas();
  builderRerenderNav();
}
function builderDelete(id: string): void {
  const t = builderTemplate();
  const i = t.fields.findIndex(f => f.id === id);
  if (i < 0) return;
  // Clear any visibility rules that referenced the deleted field.
  t.fields.forEach(f => { if (f.visibility && f.visibility.sourceFieldId === id) f.visibility = null; });
  t.fields.splice(i, 1);
  if (BUILDER.selectedId === id) BUILDER.selectedId = null;
  markDirty();
  builderRerenderCanvas();
  builderRerenderNav();
  builderRerenderInspector();
}
function builderDuplicate(id: string): void {
  const t = builderTemplate();
  const i = t.fields.findIndex(f => f.id === id);
  if (i < 0) return;
  const copy: AppField = JSON.parse(JSON.stringify(t.fields[i]));
  copy.id = uuid();
  copy.visibility = null; // don't carry conditional source into the dupe
  if (copy.settings.options) copy.settings.options = copy.settings.options.map(o => ({ id: uuid(), label: o.label }));
  t.fields.splice(i + 1, 0, copy);
  BUILDER.selectedId = copy.id;
  markDirty();
  builderRerenderCanvas();
  builderRerenderNav();
  builderRerenderInspector();
}
function builderAddField(type: AppFieldType): void {
  builderClosePicker();
  const t = builderTemplate();
  const f = createField(type);
  // Insert after the selected field, else at the end.
  const selIdx = BUILDER.selectedId ? t.fields.findIndex(x => x.id === BUILDER.selectedId) : -1;
  if (selIdx >= 0) t.fields.splice(selIdx + 1, 0, f); else t.fields.push(f);
  BUILDER.selectedId = f.id;
  markDirty();
  builderRerenderCanvas();
  builderRerenderNav();
  builderRerenderInspector();
}

// Property edit from an <input>/<textarea>/<select> — update state in place.
// For label/content we patch the visible card + nav labels without a re-render so
// the input keeps focus. mapTo re-renders the canvas (badges/hint change).
function builderSetProp(id: string, prop: string, value: string): void {
  const f = builderField(id);
  if (!f) return;
  if (prop === 'content' || prop === 'placeholder') f.settings[prop as 'content' | 'placeholder'] = value;
  else (f as any)[prop] = value;
  markDirty();
  if (prop === 'label' || prop === 'content') patchCardTitle(id);
  if (prop === 'mapTo') { builderRerenderCanvas(); builderRerenderInspector(); }
}
function builderSetBool(id: string, prop: 'required' | 'active', value: boolean): void {
  const f = builderField(id);
  if (!f) return;
  (f as any)[prop] = value;
  markDirty();
  builderRerenderCanvas();
  builderRerenderInspector();
}

function builderAddOption(id: string): void {
  const f = builderField(id);
  if (!f) return;
  if (!f.settings.options) f.settings.options = [];
  f.settings.options.push({ id: uuid(), label: 'New option' });
  markDirty();
  builderRerenderInspector();
}
function builderRemoveOption(id: string, optId: string): void {
  const f = builderField(id);
  if (!f || !f.settings.options) return;
  f.settings.options = f.settings.options.filter(o => o.id !== optId);
  // Drop the option from any conditional rule that referenced it.
  builderTemplate().fields.forEach(x => {
    if (x.visibility && x.visibility.match && x.visibility.match.optionIds) {
      x.visibility.match.optionIds = x.visibility.match.optionIds.filter(o => o !== optId);
    }
  });
  markDirty();
  builderRerenderInspector();
}
function builderSetOption(id: string, optId: string, label: string): void {
  const f = builderField(id);
  if (!f || !f.settings.options) return;
  const o = f.settings.options.filter(x => x.id === optId)[0];
  if (o) { o.label = label; markDirty(); }
}

/* ---- conditional logic ---- */
function builderToggleVisibility(id: string, on: boolean): void {
  const f = builderField(id);
  if (!f) return;
  f.visibility = on ? { sourceFieldId: '', match: {} } : null;
  markDirty();
  builderRerenderInspector();
  builderRerenderCanvas();
}
function builderSetVisSource(id: string, sourceId: string): void {
  const f = builderField(id);
  if (!f || !f.visibility) return;
  f.visibility.sourceFieldId = sourceId;
  const src = builderField(sourceId);
  f.visibility.match = src && src.type === 'boolean' ? { boolean: { true: false, false: false } } : { optionIds: [] };
  markDirty();
  builderRerenderInspector();
  builderRerenderCanvas();
}
function builderSetVisBool(id: string, which: 'true' | 'false', on: boolean): void {
  const f = builderField(id);
  if (!f || !f.visibility) return;
  if (!f.visibility.match.boolean) f.visibility.match.boolean = { true: false, false: false };
  f.visibility.match.boolean[which] = on;
  markDirty();
}
function builderSetVisOption(id: string, optId: string, on: boolean): void {
  const f = builderField(id);
  if (!f || !f.visibility) return;
  if (!f.visibility.match.optionIds) f.visibility.match.optionIds = [];
  const arr = f.visibility.match.optionIds;
  const at = arr.indexOf(optId);
  if (on && at < 0) arr.push(optId);
  if (!on && at >= 0) arr.splice(at, 1);
  markDirty();
}

/* ---- surgical DOM patches (avoid full re-render → keep input focus) ---- */
function builderRerenderCanvas(): void {
  const el = document.getElementById('pab-canvas');
  if (el) el.innerHTML = builderCanvas(builderTemplate());
  builderSyncCounts();
}
function builderRerenderNav(): void {
  const el = document.getElementById('pab-nav-list');
  if (el) el.innerHTML = builderNavList(builderTemplate());
}
function builderRerenderInspector(): void {
  const el = document.getElementById('pab-inspector');
  if (el) el.innerHTML = builderInspector(BUILDER.selectedId ? builderField(BUILDER.selectedId) : null);
}
// Label/content typing: patch the card label text + nav item label in place.
function patchCardTitle(id: string): void {
  const f = builderField(id);
  if (!f) return;
  const title = fieldPreviewLabel(f);
  document.querySelectorAll('[data-fid-label="' + id + '"]').forEach(el => { (el as HTMLElement).textContent = title; });
  const nav = document.querySelector('.bs-pab-nav-item[onclick*="' + id + '"] .bs-pab-nav-item-label') as HTMLElement | null;
  if (nav) nav.textContent = title;
}
function builderSyncCounts(): void {
  const c = statCounts(builderTemplate());
  const set = (idi: string, n: number) => { const e = document.getElementById('stat-' + idi); if (e) { const num = e.querySelector('.bs-pab-stat-num'); if (num) num.textContent = String(n); } };
  set('total', c.total); set('unmapped', c.unmapped); set('required', c.required); set('conditional', c.conditional); set('inactive', c.inactive);
  const un = document.getElementById('stat-unmapped'); if (un) un.classList.toggle('bs-pab-stat-warn', c.unmapped > 0);
}

/* ---- field-type picker modal (grid) ---- */
function builderOpenPicker(): void {
  const cards = FIELD_TYPES.map(ft =>
    `<button class="bs-pab-picker-card" onclick="builderAddField('${ft.type}')">
      <span class="bs-pab-picker-icon">${esc(ft.glyph)}</span>
      <span class="bs-pab-picker-label">${esc(ft.label)}</span>
      <span class="bs-pab-picker-sub">${esc(ft.sub)}</span>
    </button>`).join('');
  const html = `<div class="bs-pab-modal-overlay" id="pab-picker" style="display:flex" onclick="if(event.target===this)builderClosePicker()">
    <div class="bs-pab-modal bs-pab-picker-modal">
      <div class="bs-pab-modal-header"><span class="bs-pab-modal-title">Add a Field</span><button class="bs-pab-icon-btn" onclick="builderClosePicker()">✕</button></div>
      <div class="bs-pab-picker-grid">${cards}</div>
    </div>
  </div>`;
  mountOverlay(html);
}
function builderClosePicker(): void { unmountOverlay('pab-picker'); }

/* ---- form-level settings modal ---- */
function builderFormSettings(): void {
  const t = builderTemplate();
  const html = `<div class="bs-pab-modal-overlay" id="pab-formset" style="display:flex" onclick="if(event.target===this)unmountOverlay('pab-formset')">
    <div class="bs-pab-modal" style="width:520px;max-width:95vw">
      <div class="bs-pab-modal-header"><span class="bs-pab-modal-title">Form Settings</span><button class="bs-pab-icon-btn" onclick="unmountOverlay('pab-formset')">✕</button></div>
      <div style="padding:16px 20px;display:flex;flex-direction:column;gap:14px;max-height:70vh;overflow-y:auto">
        <div class="bs-pab-field-group"><div class="bs-pab-label">Application title</div>
          <input class="bs-pab-input" type="text" value="${esc(t.title)}" oninput="builderSetForm('title',this.value)" autocomplete="off"></div>
        <div class="bs-pab-field-group"><div class="bs-pab-label">Intro / description</div>
          <textarea class="bs-pab-input" style="min-height:70px" oninput="builderSetForm('description',this.value)">${esc(t.description)}</textarea>
          <div class="bs-pab-helper">Shown to families at the top of the application.</div></div>
        <div class="bs-pab-field-group"><div class="bs-pab-label">Confirmation message</div>
          <textarea class="bs-pab-input" style="min-height:52px" oninput="builderSetForm('submittedMessage',this.value)">${esc(t.strings.submittedMessage || '')}</textarea>
          <div class="bs-pab-helper">Shown after a successful submit.</div></div>
      </div>
      <div style="padding:12px 20px;border-top:1px solid var(--bs-border);display:flex;justify-content:flex-end">
        <button class="bs-pab-btn bs-pab-btn-primary" onclick="unmountOverlay('pab-formset');builderRefreshHeader()">Done</button>
      </div>
    </div>
  </div>`;
  mountOverlay(html);
}
function builderSetForm(prop: 'title' | 'description' | 'submittedMessage', value: string): void {
  const t = builderTemplate();
  if (prop === 'submittedMessage') t.strings.submittedMessage = value;
  else (t as any)[prop] = value;
  markDirty();
}
function builderRefreshHeader(): void {
  if (typeof render === 'function') render();
}

/* ---- logic overview modal ---- */
function builderOpenLogic(): void {
  const t = builderTemplate();
  const rules = t.fields.filter(f => f.visibility && f.visibility.sourceFieldId);
  let body: string;
  if (!rules.length) {
    body = `<div class="bs-pab-empty-state"><strong>No conditional rules</strong>Add a rule from a field's Logic section to show/hide it based on an earlier answer.</div>`;
  } else {
    const rows = rules.map(f => {
      const src = builderField((f.visibility as AppVisibility).sourceFieldId);
      const vis = f.visibility as AppVisibility;
      let cond = '';
      if (src && src.type === 'boolean') {
        const m = vis.match.boolean || { true: false, false: false };
        const parts: string[] = []; if (m.true) parts.push('Yes'); if (m.false) parts.push('No');
        cond = (src.label || '(untitled)') + ' = ' + (parts.join(' or ') || '(none)');
      } else if (src) {
        const chosen = vis.match.optionIds || [];
        const labels = (src.settings.options || []).filter(o => chosen.indexOf(o.id) >= 0).map(o => o.label);
        cond = (src.label || '(untitled)') + ' is ' + (labels.join(' / ') || '(none)');
      } else { cond = '(source removed)'; }
      return `<tr><td style="font-weight:600">${esc(fieldPreviewLabel(f))}</td><td>shows when</td><td>${esc(cond)}</td></tr>`;
    }).join('');
    body = `<table class="bs-pab-logic-table"><thead><tr><th>Field</th><th></th><th>Condition</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  const html = `<div class="bs-pab-modal-overlay" id="pab-logic" style="display:flex" onclick="if(event.target===this)unmountOverlay('pab-logic')">
    <div class="bs-pab-modal bs-pab-logic-modal">
      <div class="bs-pab-modal-header"><span class="bs-pab-modal-title">Logic Overview</span><button class="bs-pab-icon-btn" onclick="unmountOverlay('pab-logic')">✕</button></div>
      <div class="bs-pab-logic-table-wrap" style="padding:12px 20px;max-height:70vh;overflow-y:auto">${body}</div>
    </div>
  </div>`;
  mountOverlay(html);
}

/* ---- save / publish ---- */
function builderValidate(t: AppTemplate): string {
  for (const f of t.fields) {
    if ((f.type === 'single_select' || f.type === 'multi_select')) {
      const opts = (f.settings.options || []).filter(o => o.label.trim());
      if (!opts.length) return 'The choice question "' + (f.label || 'Untitled') + '" needs at least one option.';
    }
  }
  return '';
}

async function builderSave(): Promise<void> {
  if (BUILDER.busy) return;
  const t = builderTemplate();
  BUILDER.busy = 'saving';
  builderSetBtns(true, 'Saving…', null);
  try {
    const res = await apiSaveAppTemplate(t);
    BUILDER.lastUpdated = (res && res.lastUpdated) || new Date().toISOString();
    BUILDER.dirty = false;
    toast('Draft saved');
  } catch (e: any) {
    toast('Save failed: ' + (e && e.message ? e.message : String(e)));
  } finally {
    BUILDER.busy = '';
    builderSetBtns(false, 'Save Draft', BUILDER.dirty ? 'Unsaved changes' : 'Saved');
  }
}

async function builderPublish(): Promise<void> {
  if (BUILDER.busy) return;
  const t = builderTemplate();
  const problem = builderValidate(t);
  if (problem) { toast(problem); return; }
  if (!confirm('Publish this application? Families opening their link will see this version.')) return;
  BUILDER.busy = 'publishing';
  builderSetBtns(true, null, 'Publishing…');
  try {
    const res = await apiPublishAppTemplate(t);
    BUILDER.lastPublished = (res && res.lastPublished) || new Date().toISOString();
    BUILDER.lastUpdated = (res && res.lastUpdated) || BUILDER.lastPublished;
    BUILDER.dirty = false;
    toast('Published');
    if (typeof render === 'function') render();
  } catch (e: any) {
    toast('Publish failed: ' + (e && e.message ? e.message : String(e)));
  } finally {
    BUILDER.busy = '';
    builderSetBtns(false, 'Save Draft', null);
  }
}

function builderSetBtns(disabled: boolean, saveLabel: string | null, dirtyLabel: string | null): void {
  const save = document.getElementById('pab-save') as HTMLButtonElement | null;
  const pub = document.getElementById('pab-publish') as HTMLButtonElement | null;
  if (save) { save.disabled = disabled; if (saveLabel) save.textContent = '💾 ' + saveLabel; }
  if (pub) pub.disabled = disabled;
  if (dirtyLabel !== null) { const d = document.getElementById('pab-dirty'); if (d) d.textContent = dirtyLabel; }
}

/* ---- tiny overlay helpers (shared modal mount under <body>) ---- */
function mountOverlay(html: string): void {
  const host = document.createElement('div');
  host.innerHTML = html;
  const node = host.firstElementChild;
  if (node) document.body.appendChild(node);
}
function unmountOverlay(id: string): void {
  const el = document.getElementById(id);
  if (el) el.remove();
}

/* ---- misc ---- */
function fmtStamp(iso: string): string {
  if (!iso) return '';
  try {
    // Java ZonedDateTime.toString() appends a "[Zone]" suffix (e.g.
    // 2026-06-30T00:15:57.210-06:00[US/Mountain]) that Date can't parse — strip it.
    const clean = iso.replace(/\[[^\]]*\]\s*$/, '');
    const d = new Date(clean);
    if (isNaN(d.getTime())) return clean;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (_e) { return iso; }
}
