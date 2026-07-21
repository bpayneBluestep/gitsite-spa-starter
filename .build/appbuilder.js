const MAP_TO_OPTIONS = [
  { value: "", label: "\u2014 Not mapped \u2014" },
  { value: "firstName", label: "Client \u2022 First name" },
  { value: "lastName", label: "Client \u2022 Last name" },
  { value: "prefName", label: "Client \u2022 Preferred name" },
  { value: "email", label: "Client \u2022 Email" },
  { value: "dob", label: "Client \u2022 Date of birth" },
  { value: "cell", label: "Client \u2022 Cell phone" },
  { value: "homePhone", label: "Client \u2022 Home phone" },
  { value: "homeAddress", label: "Client \u2022 Home address" },
  { value: "homeCity", label: "Client \u2022 City" },
  { value: "homeState", label: "Client \u2022 State" },
  { value: "homeZip", label: "Client \u2022 ZIP" },
  { value: "sex", label: "Client \u2022 Sex" },
  { value: "gender", label: "Client \u2022 Gender" },
  { value: "pronouns", label: "Client \u2022 Pronouns" },
  { value: "race", label: "Client \u2022 Race" },
  { value: "ethnicity", label: "Client \u2022 Ethnicity" },
  { value: "sexualOrientation", label: "Client \u2022 Sexual orientation" },
  { value: "ssn", label: "Client \u2022 SSN" }
];
const FIELD_TYPES = [
  { type: "header", glyph: "H", label: "Header", sub: "Section title" },
  { type: "static_text", glyph: "\u270E", label: "Static Text", sub: "Instructions / notes" },
  { type: "text", glyph: "T", label: "Text", sub: "Short answer" },
  { type: "memo", glyph: "\xB6", label: "Memo", sub: "Multi-line answer" },
  { type: "number", glyph: "#", label: "Number", sub: "Numeric input" },
  { type: "date", glyph: "\u25A6", label: "Date", sub: "Date picker" },
  { type: "single_select", glyph: "\u25C9", label: "Single Select", sub: "Dropdown / radio" },
  { type: "multi_select", glyph: "\u2611", label: "Multi Select", sub: "Checkboxes" },
  { type: "boolean", glyph: "\u21C4", label: "Yes / No", sub: "Boolean toggle" },
  { type: "doc_upload", glyph: "\u2191", label: "Document Upload", sub: "File attachment" }
];
function fieldTypeMeta(t) {
  return FIELD_TYPES.filter((x) => x.type === t)[0] || { type: t, glyph: "?", label: t, sub: "" };
}
function isDisplayType(t) {
  return t === "header" || t === "static_text";
}
function isLogicSource(t) {
  return t === "boolean" || t === "single_select" || t === "multi_select";
}
const BUILDER = {
  template: null,
  loading: false,
  error: null,
  selectedId: null,
  dirty: false,
  lastUpdated: "",
  lastPublished: "",
  busy: "",
  navQuery: "",
  canvasQuery: "",
  compact: false,
  inspectorOpen: false,
  collapsed: {},
  dragId: ""
};
function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : r & 3 | 8).toString(16);
  });
}
function blankTemplate() {
  return {
    schemaVersion: 1,
    title: "Parent Application",
    description: "",
    lastModifiedUtc: "",
    strings: { submittedMessage: "Thank you \u2014 your application has been submitted." },
    fields: []
  };
}
function createField(type) {
  const f = {
    id: uuid(),
    type,
    label: "",
    description: "",
    required: false,
    mapTo: "",
    active: true,
    settings: {},
    visibility: null
  };
  if (type === "header") f.label = "New Section";
  else if (type === "static_text") f.settings.content = "Enter instructions here.";
  else f.label = "Untitled question";
  if (type === "single_select" || type === "multi_select") {
    f.settings.options = [{ id: uuid(), label: "Option 1" }, { id: uuid(), label: "Option 2" }];
  }
  if (type === "text" || type === "memo" || type === "number") f.settings.placeholder = "";
  return f;
}
async function loadAppTemplate(force = false) {
  if (BUILDER.loading) return;
  if (BUILDER.template && !force) return;
  BUILDER.loading = true;
  BUILDER.error = null;
  try {
    const data = await apiGetAppTemplate();
    const tmpl = data && (data.draft || data.published) || blankTemplate();
    BUILDER.template = normalizeTemplate(tmpl);
    BUILDER.lastUpdated = data && data.lastUpdated || "";
    BUILDER.lastPublished = data && data.lastPublished || "";
    BUILDER.dirty = false;
  } catch (e) {
    BUILDER.error = e && e.message ? e.message : String(e);
  } finally {
    BUILDER.loading = false;
    if (typeof render === "function") render();
  }
}
function normalizeTemplate(t) {
  const base = blankTemplate();
  if (!t || typeof t !== "object") return base;
  const fields = Array.isArray(t.fields) ? t.fields.map(normalizeField).filter(Boolean) : [];
  return {
    schemaVersion: t.schemaVersion || 1,
    title: typeof t.title === "string" ? t.title : base.title,
    description: typeof t.description === "string" ? t.description : "",
    lastModifiedUtc: t.lastModifiedUtc || "",
    strings: t.strings && typeof t.strings === "object" ? t.strings : base.strings,
    fields
  };
}
function normalizeField(f) {
  if (!f || typeof f !== "object" || !f.type) return null;
  const settings = f.settings && typeof f.settings === "object" ? f.settings : {};
  if (settings.options && Array.isArray(settings.options)) {
    settings.options = settings.options.map((o) => ({ id: o && o.id ? String(o.id) : uuid(), label: o && o.label != null ? String(o.label) : "" }));
  }
  return {
    id: f.id ? String(f.id) : uuid(),
    type: f.type,
    label: typeof f.label === "string" ? f.label : "",
    description: typeof f.description === "string" ? f.description : "",
    required: f.required === true,
    mapTo: typeof f.mapTo === "string" ? f.mapTo : "",
    active: f.active !== false,
    settings,
    visibility: f.visibility && f.visibility.sourceFieldId ? f.visibility : null
  };
}
function builderTemplate() {
  if (!BUILDER.template) BUILDER.template = blankTemplate();
  return BUILDER.template;
}
function builderField(id) {
  return builderTemplate().fields.filter((f) => f.id === id)[0] || null;
}
function markDirty() {
  BUILDER.dirty = true;
  builderTemplate().lastModifiedUtc = (/* @__PURE__ */ new Date()).toISOString();
  const ind = document.getElementById("pab-dirty");
  if (ind) ind.textContent = "Unsaved changes";
}
function fieldPreviewLabel(f) {
  if (f.type === "header") return f.label || "Untitled Section";
  if (f.type === "static_text") return f.settings.content || "Instructions";
  return f.label || "Untitled question";
}
function groupSections(fields) {
  const groups = [];
  let cur = null;
  fields.forEach((f, i) => {
    if (f.type === "header") {
      cur = { header: f, items: [] };
      groups.push(cur);
    } else {
      if (!cur) {
        cur = { header: null, items: [] };
        groups.push(cur);
      }
      cur.items.push({ field: f, index: i });
    }
  });
  return groups;
}
function statCounts(t) {
  const q = t.fields.filter((f) => !isDisplayType(f.type));
  return {
    total: t.fields.length,
    unmapped: q.filter((f) => !f.mapTo).length,
    required: q.filter((f) => f.required).length,
    conditional: t.fields.filter((f) => f.visibility && f.visibility.sourceFieldId).length,
    inactive: t.fields.filter((f) => !f.active).length
  };
}
function viewAppBuilder() {
  if (SESSION && SESSION.loggedIn && !SESSION.isSuper) {
    return shell("settings", `<div class="card"><div class="empty"><div class="ico">${ic("settings", 22)}</div>
      <b>Admins only</b><p>The Application Builder is available to organization administrators.</p>
      <a class="btn primary" href="#/settings">${ic("chevR", 15)} Back to Settings</a></div></div>`);
  }
  if (BUILDER.template === null) {
    if (!BUILDER.loading && !BUILDER.error) loadAppTemplate();
    const inner = BUILDER.error ? `<div class="card"><div class="empty"><div class="ico">${ic("alert", 22)}</div><b>Couldn't load the template</b>
         <p>${esc(BUILDER.error)}</p><button class="btn primary" onclick="loadAppTemplate(true)">${ic("clock", 15)} Retry</button></div></div>` : `<div class="card"><div class="empty"><div class="ico">${ic("clock", 22)}</div><b>Loading builder\u2026</b></div></div>`;
    return topbar() + `<div class="body">${sidebar("settings", true)}<main class="main"><div class="content">${inner}</div></main></div>`;
  }
  const t = builderTemplate();
  const root = `<div class="bs-pab-root">
    ${builderHeader(t)}
    <div class="bs-pab-body${BUILDER.inspectorOpen ? " inspector-open" : ""}">
      ${builderNav(t)}
      ${builderCanvasWrap(t)}
      ${builderInspectorPanel()}
    </div>
  </div>`;
  return topbar() + `<div class="body">${sidebar("settings", true)}<main class="main pab-main">${root}</main></div>`;
}
function builderStatSpan(id, num, label, cls) {
  return `<span class="bs-pab-stat${cls ? " " + cls : ""}" id="stat-${id}"><span class="bs-pab-stat-num">${num}</span> ${esc(label)}</span>`;
}
function builderHeader(t) {
  const c = statCounts(t);
  const pub = BUILDER.lastPublished ? "Published " + fmtStamp(BUILDER.lastPublished) : "Not published yet";
  const dirty = BUILDER.dirty ? "Unsaved changes" : BUILDER.lastUpdated ? "Saved" : "";
  const busy = BUILDER.busy ? " disabled" : "";
  const div = '<span class="bs-pab-stat-divider"></span>';
  return `<header class="bs-pab-header">
    <div class="bs-pab-header-left">
      <div class="bs-pab-logo-mark">\u2B21</div>
      <div class="bs-pab-title-block">
        <div class="bs-pab-main-title">${esc(t.title || "Application Builder")}</div>
        <div class="bs-pab-main-subtitle">${esc(pub)}</div>
      </div>
    </div>
    <div class="bs-pab-header-center">
      <div class="bs-pab-status-bar">
        ${builderStatSpan("total", c.total, "fields", "")}${div}
        ${builderStatSpan("unmapped", c.unmapped, "unmapped", c.unmapped ? "bs-pab-stat-warn" : "")}${div}
        ${builderStatSpan("required", c.required, "required", "bs-pab-stat-req")}${div}
        ${builderStatSpan("conditional", c.conditional, "conditional", "")}${div}
        ${builderStatSpan("inactive", c.inactive, "inactive", "bs-pab-stat-muted")}
      </div>
    </div>
    <div class="bs-pab-header-right">
      <span class="bs-pab-dirty" id="pab-dirty">${esc(dirty)}</span>
      <button class="bs-pab-btn bs-pab-btn-ghost" onclick="builderFormSettings()" title="Form settings">\u2699 Settings</button>
      <button class="bs-pab-btn bs-pab-btn-ghost" onclick="builderOpenLogic()" title="View all logic rules">\u2263 Logic</button>
      <button class="bs-pab-btn bs-pab-btn-outline" id="pab-save" onclick="builderSave()"${busy}>\u{1F4BE} Save Draft</button>
      <button class="bs-pab-btn bs-pab-btn-primary" id="pab-publish" onclick="builderPublish()"${busy}>\u{1F680} Publish</button>
    </div>
  </header>`;
}
function builderNav(t) {
  return `<aside class="bs-pab-nav">
    <div class="bs-pab-nav-header">
      <span class="bs-pab-nav-title">Navigator</span>
      <div class="bs-pab-nav-header-actions">
        <button class="bs-pab-add-field-btn" onclick="builderOpenPicker()"><span class="bs-pab-add-field-plus">+</span> Add Field</button>
        <button class="bs-pab-icon-btn" title="Collapse all sections" onclick="builderCollapseAll()">\u229F</button>
      </div>
    </div>
    <div class="bs-pab-nav-search-wrap">
      <input class="bs-pab-nav-search" id="pab-nav-search" type="text" placeholder="Search fields\u2026" value="${esc(BUILDER.navQuery)}" oninput="builderNavSearchInput(this.value)" autocomplete="off">
    </div>
    <div class="bs-pab-nav-list" id="pab-nav-list">${builderNavList(t)}</div>
  </aside>`;
}
function builderNavList(t) {
  if (!t.fields.length) return `<div class="bs-pab-empty-state" style="padding:18px 12px"><strong>No fields yet</strong>Use <em>Add Field</em> above.</div>`;
  const filter = BUILDER.navQuery.toLowerCase().trim();
  const groups = groupSections(t.fields);
  let html = "";
  for (const g of groups) {
    const sid = g.header ? g.header.id : "__orphan__";
    const collapsed = !!BUILDER.collapsed[sid];
    const matched = g.items.filter((it) => it.field.type !== "header" && (!filter || fieldPreviewLabel(it.field).toLowerCase().indexOf(filter) >= 0));
    const label = g.header ? g.header.label || "Untitled Section" : "Ungrouped";
    const headerMatch = !filter || label.toLowerCase().indexOf(filter) >= 0;
    if (filter && !headerMatch && !matched.length) continue;
    const toShow = filter ? matched : g.items.filter((it) => it.field.type !== "header");
    const items = toShow.map((it) => {
      const f = it.field;
      const active = BUILDER.selectedId === f.id ? " active" : "";
      const req = f.required ? " bs-pab-nav-item-req" : "";
      return `<div class="bs-pab-nav-item${active}${req}" onclick="builderSelect('${esc(f.id)}')">
        <div class="bs-pab-nav-item-dot"></div>
        <span class="bs-pab-nav-item-label">${esc(fieldPreviewLabel(f))}</span>
        <span class="bs-pab-nav-item-type">${esc(fieldTypeMeta(f.type).label)}</span>
      </div>`;
    }).join("");
    if (g.header) {
      const count = filter ? matched.length : g.items.filter((it) => it.field.type !== "header").length;
      html += `<div class="bs-pab-nav-section">
        <div class="bs-pab-nav-section-header${collapsed ? " collapsed" : ""}" onclick="builderToggleSection('${esc(sid)}')">
          <span class="bs-pab-nav-section-arrow">\u25BC</span>
          <span class="bs-pab-nav-section-label" onclick="event.stopPropagation();builderSelect('${esc(g.header.id)}')">${esc(label)}</span>
          <span class="bs-pab-nav-section-count">${count}</span>
        </div>
        <div class="bs-pab-nav-items${collapsed ? " collapsed" : ""}">${items}</div>
      </div>`;
    } else {
      html += `<div class="bs-pab-nav-section bs-pab-nav-unsectioned"><div class="bs-pab-nav-items">${items}</div></div>`;
    }
  }
  return html;
}
function builderCanvasWrap(t) {
  return `<main class="bs-pab-canvas-wrap">
    <div class="bs-pab-canvas-toolbar">
      <div class="bs-pab-canvas-search-wrap">
        <input class="bs-pab-canvas-search" id="pab-canvas-search" type="text" placeholder="Filter fields on canvas\u2026" value="${esc(BUILDER.canvasQuery)}" oninput="builderCanvasFilterInput(this.value)" autocomplete="off">
      </div>
      <div class="bs-pab-view-toggle">
        <button class="bs-pab-view-btn${!BUILDER.compact ? " bs-pab-view-active" : ""}" title="Normal view" onclick="builderSetView(false)">\u2630</button>
        <button class="bs-pab-view-btn${BUILDER.compact ? " bs-pab-view-active" : ""}" title="Compact view" onclick="builderSetView(true)">\u2261</button>
      </div>
    </div>
    <div class="bs-pab-canvas${BUILDER.compact ? " compact" : ""}" id="pab-canvas">${builderCanvas(t)}</div>
  </main>`;
}
function builderCanvas(t) {
  if (!t.fields.length) {
    return `<div class="bs-pab-empty-state"><strong>No fields yet</strong>Click <em>Add Field</em> in the navigator to get started.</div>`;
  }
  const filter = BUILDER.canvasQuery.toLowerCase().trim();
  const groups = groupSections(t.fields);
  let html = "";
  for (const g of groups) {
    const sid = g.header ? g.header.id : "__orphan__";
    const collapsed = !!BUILDER.collapsed[sid];
    const matched = g.items.filter((it) => !filter || fieldPreviewLabel(it.field).toLowerCase().indexOf(filter) >= 0);
    const headerMatch = !filter || g.header && (g.header.label || "").toLowerCase().indexOf(filter) >= 0;
    if (filter && !headerMatch && !matched.length) continue;
    const toRender = filter ? matched : g.items;
    html += `<div class="bs-pab-section-group">`;
    if (g.header) html += builderSectionHeaderCard(g.header, filter ? matched.length : g.items.length, collapsed);
    html += `<div class="bs-pab-section-body${collapsed ? " collapsed" : ""}"><div class="bs-pab-field-list">`;
    html += toRender.map((it) => builderFieldCard(it.field)).join("");
    html += `</div></div></div>`;
  }
  return html;
}
function builderSectionHeaderCard(f, count, collapsed) {
  const sel = BUILDER.selectedId === f.id ? " bs-pab-field-selected" : "";
  return `<div class="bs-pab-section-header-card${sel}" draggable="true" data-fid="${esc(f.id)}"
      ondragstart="builderDragStart(event,'${esc(f.id)}')" ondragover="builderDragOver(event)" ondrop="builderDrop(event,'${esc(f.id)}')" ondragend="builderDragEnd()"
      onclick="builderOpenInspector('${esc(f.id)}')">
    <button class="bs-pab-section-collapse-btn${collapsed ? " collapsed" : ""}" title="Toggle section" onclick="event.stopPropagation();builderToggleSection('${esc(f.id)}')">\u25BC</button>
    <span class="bs-pab-section-drag-handle" title="Drag to reorder">\u283F</span>
    <span class="bs-pab-section-label" data-fid-label="${esc(f.id)}">${esc(f.label || "Untitled Section")}</span>
    <span class="bs-pab-section-meta">${count} field${count !== 1 ? "s" : ""}</span>
    <div class="bs-pab-section-field-actions">
      <button class="bs-pab-icon-btn" title="Duplicate" onclick="event.stopPropagation();builderDuplicate('${esc(f.id)}')">\u29C9</button>
      <button class="bs-pab-icon-btn bs-pab-icon-btn-danger" title="Delete section" onclick="event.stopPropagation();builderDelete('${esc(f.id)}')">\u{1F5D1}</button>
    </div>
  </div>`;
}
function fieldCardHint(f) {
  if (!f.active) return "Hidden \u2014 kept for historical data";
  if (f.visibility && f.visibility.sourceFieldId) return "Shown conditionally";
  if (f.mapTo) {
    const o = MAP_TO_OPTIONS.filter((x) => x.value === f.mapTo)[0];
    return o ? o.label : f.mapTo;
  }
  if (f.type === "static_text") return "";
  return "Not mapped";
}
function fieldBadges(f) {
  const b = [];
  if (f.required && !isDisplayType(f.type)) b.push('<span class="bs-pab-badge-pill bs-pab-badge-req">Req</span>');
  if (f.visibility && f.visibility.sourceFieldId) b.push('<span class="bs-pab-badge-pill bs-pab-badge-cond">Cond</span>');
  if (f.mapTo) b.push('<span class="bs-pab-badge-pill bs-pab-badge-mapped">Mapped</span>');
  if (!f.active) b.push('<span class="bs-pab-badge-pill bs-pab-badge-inactive">Off</span>');
  return b.join("");
}
function builderFieldCard(f) {
  const sel = BUILDER.selectedId === f.id;
  const hint = fieldCardHint(f);
  return `<div class="bs-pab-field-card${sel ? " bs-pab-field-selected" : ""}${!f.active ? " bs-pab-field-inactive" : ""}" draggable="true" data-fid="${esc(f.id)}"
      ondragstart="builderDragStart(event,'${esc(f.id)}')" ondragover="builderDragOver(event)" ondrop="builderDrop(event,'${esc(f.id)}')" ondragend="builderDragEnd()"
      onclick="builderSelect('${esc(f.id)}')">
    <div class="bs-pab-field-row">
      <div class="bs-pab-field-handle"><div class="bs-pab-handle-line"></div><div class="bs-pab-handle-line"></div><div class="bs-pab-handle-line"></div></div>
      <span class="bs-pab-field-type-pill bs-pab-type-${esc(f.type)}">${esc(fieldTypeMeta(f.type).label)}</span>
      <div class="bs-pab-field-main">
        <div class="bs-pab-field-label-text" data-fid-label="${esc(f.id)}">${esc(fieldPreviewLabel(f))}</div>
        ${hint ? `<div class="bs-pab-field-hint">${esc(hint)}</div>` : ""}
      </div>
      <div class="bs-pab-field-badges">${fieldBadges(f)}</div>
      <div class="bs-pab-field-row-actions">
        <button class="bs-pab-icon-btn" title="Duplicate" onclick="event.stopPropagation();builderDuplicate('${esc(f.id)}')">\u29C9</button>
        <button class="bs-pab-icon-btn bs-pab-icon-btn-danger" title="Delete" onclick="event.stopPropagation();builderDelete('${esc(f.id)}')">\u{1F5D1}</button>
      </div>
    </div>
    ${sel ? builderInlineEditor(f) : ""}
  </div>`;
}
function builderInlineEditor(f) {
  const answerable = !isDisplayType(f.type);
  let labelGroup;
  if (f.type === "static_text") {
    labelGroup = `<div class="bs-pab-inline-group bs-pab-inline-group-flex">
      <div class="bs-pab-inline-label">Instructions text</div>
      <textarea class="bs-pab-inline-input" style="min-height:52px;resize:vertical" oninput="builderSetProp('${esc(f.id)}','content',this.value)">${esc(f.settings.content || "")}</textarea>
    </div>`;
  } else {
    labelGroup = `<div class="bs-pab-inline-group bs-pab-inline-group-flex">
      <div class="bs-pab-inline-label">${f.type === "header" ? "Section title" : "Question label"}</div>
      <input class="bs-pab-inline-input" value="${esc(f.label || "")}" oninput="builderSetProp('${esc(f.id)}','label',this.value)" autocomplete="off">
    </div>`;
  }
  let mapGroup = "";
  if (answerable) {
    const opts = MAP_TO_OPTIONS.map((o) => `<option value="${esc(o.value)}"${o.value === f.mapTo ? " selected" : ""}>${esc(o.label)}</option>`).join("");
    mapGroup = `<div class="bs-pab-inline-group bs-pab-inline-group-fixed" style="flex:0 0 180px;min-width:180px">
      <div class="bs-pab-inline-label">Map to</div>
      <select class="bs-pab-inline-select" onchange="builderSetProp('${esc(f.id)}','mapTo',this.value)">${opts}</select>
    </div>`;
  }
  const toggle = (prop, label, on) => `<div class="bs-pab-inline-toggle-item" onclick="builderSetBool('${esc(f.id)}','${prop}',${on ? "false" : "true"})">
      <div class="bs-pab-toggle-pill${on ? " bs-pab-toggle-on" : ""}"></div>
      <span class="bs-pab-toggle-label">${esc(label)}</span>
    </div>`;
  let toggles = "";
  if (answerable) toggles = `<div class="bs-pab-inline-toggles">${toggle("required", "Required", f.required)}${toggle("active", "Active", f.active)}</div>`;
  else if (f.type === "header") toggles = `<div class="bs-pab-inline-toggles">${toggle("active", "Active", f.active)}</div>`;
  return `<div class="bs-pab-inline-editor" onclick="event.stopPropagation()">
    <div class="bs-pab-inline-row">${labelGroup}${mapGroup}</div>
    ${toggles}
    <button class="bs-pab-inline-more-btn" onclick="event.stopPropagation();builderOpenInspector('${esc(f.id)}')">More settings (description, logic, type options) \u2192</button>
  </div>`;
}
function builderInspectorPanel() {
  return `<aside class="bs-pab-inspector-panel">
    <div class="bs-pab-inspector-header">
      <span class="bs-pab-inspector-title" id="pab-insp-title">Field Settings</span>
      <button class="bs-pab-icon-btn" title="Close" onclick="builderCloseInspector()">\u2715</button>
    </div>
    <div class="bs-pab-inspector" id="pab-inspector">${builderInspector(BUILDER.selectedId ? builderField(BUILDER.selectedId) : null)}</div>
  </aside>`;
}
function inspSection(title, inner) {
  return `<div class="bs-pab-inspector-section"><div class="bs-pab-insp-section-title">${esc(title)}</div>${inner}</div>`;
}
function inspGroup(label, control, hint) {
  return `<div class="bs-pab-field-group"><div class="bs-pab-label">${esc(label)}</div>${control}${hint ? `<div class="bs-pab-helper">${esc(hint)}</div>` : ""}</div>`;
}
function inspToggleRow(label, hint, on, onclickExpr) {
  return `<div class="bs-pab-toggle-row">
    <div><div class="bs-pab-label">${esc(label)}</div>${hint ? `<div class="bs-pab-helper">${esc(hint)}</div>` : ""}</div>
    <div class="bs-pab-toggle-pill${on ? " bs-pab-toggle-on" : ""}" onclick="${onclickExpr}"></div>
  </div>`;
}
function builderInspector(f) {
  if (!f) return `<div class="bs-pab-empty-state"><strong>No field selected</strong>Select a field on the canvas to edit its settings.</div>`;
  const answerable = !isDisplayType(f.type);
  const out = [];
  let basic = "";
  if (f.type === "static_text") {
    basic += inspGroup("Content", `<textarea class="bs-pab-input" style="min-height:70px" oninput="builderSetProp('${esc(f.id)}','content',this.value)">${esc(f.settings.content || "")}</textarea>`, "");
  } else {
    basic += inspGroup(
      f.type === "header" ? "Section title" : "Label",
      `<input class="bs-pab-input" value="${esc(f.label || "")}" oninput="builderSetProp('${esc(f.id)}','label',this.value)" autocomplete="off">`,
      ""
    );
    basic += inspGroup(
      "Description (optional)",
      `<textarea class="bs-pab-input" style="min-height:52px" oninput="builderSetProp('${esc(f.id)}','description',this.value)">${esc(f.description || "")}</textarea>`,
      "Helper text shown below the question."
    );
  }
  if (answerable) basic += inspToggleRow("Required", "Applicants must answer this question.", f.required, `builderSetBool('${esc(f.id)}','required',${f.required ? "false" : "true"})`);
  basic += inspToggleRow("Active", "Turn off to hide from new applications but keep for historical data.", f.active, `builderSetBool('${esc(f.id)}','active',${f.active ? "false" : "true"})`);
  out.push(inspSection("Basic", basic));
  if (f.type === "text" || f.type === "memo" || f.type === "number") {
    out.push(inspSection("Type Settings", inspGroup(
      "Placeholder (optional)",
      `<input class="bs-pab-input" value="${esc(f.settings.placeholder || "")}" oninput="builderSetProp('${esc(f.id)}','placeholder',this.value)" autocomplete="off">`,
      ""
    )));
  }
  if (f.type === "single_select" || f.type === "multi_select") {
    const rows = (f.settings.options || []).map((o) => `<div class="bs-pab-option-row">
      <input class="bs-pab-input" value="${esc(o.label)}" placeholder="Option label" oninput="builderSetOption('${esc(f.id)}','${esc(o.id)}',this.value)" autocomplete="off">
      <button class="bs-pab-icon-btn bs-pab-icon-btn-danger" title="Remove" onclick="builderRemoveOption('${esc(f.id)}','${esc(o.id)}')">\u{1F5D1}</button>
    </div>`).join("");
    out.push(inspSection("Options", `<div class="bs-pab-options-list">${rows || '<div class="bs-pab-helper">No options yet.</div>'}</div>
      <button class="bs-pab-btn bs-pab-btn-ghost" style="margin-top:8px" onclick="builderAddOption('${esc(f.id)}')">+ Add option</button>`));
  }
  if (answerable) {
    const opts = MAP_TO_OPTIONS.map((o) => `<option value="${esc(o.value)}"${o.value === f.mapTo ? " selected" : ""}>${esc(o.label)}</option>`).join("");
    out.push(inspSection("Mapping", inspGroup(
      "Map answer to a record field (optional)",
      `<select class="bs-pab-select" onchange="builderSetProp('${esc(f.id)}','mapTo',this.value)">${opts}</select>`,
      "When the family submits, this answer also populates the client\u2019s record."
    )));
  }
  out.push(inspSection("Logic (Show / Hide)", builderLogicEditor(f)));
  return out.join("");
}
function builderLogicEditor(f) {
  const t = builderTemplate();
  const myIdx = t.fields.findIndex((x) => x.id === f.id);
  const sources = t.fields.filter((x, i) => i < myIdx && isLogicSource(x.type));
  const enabled = !!f.visibility;
  let html = `<div class="bs-pab-helper" style="margin-bottom:8px">Show this field only when an earlier Yes/No or choice question has a specific answer.</div>`;
  html += inspToggleRow("Conditional", "", enabled, `builderToggleVisibility('${esc(f.id)}',${enabled ? "false" : "true"})`);
  if (!enabled) return html;
  if (!sources.length) return html + `<div class="bs-pab-helper">Add a Yes/No or choice question above this one to drive the rule.</div>`;
  const vis = f.visibility;
  const srcOpts = `<option value="">\u2014 Choose a question \u2014</option>` + sources.map((s) => `<option value="${esc(s.id)}"${vis.sourceFieldId === s.id ? " selected" : ""}>${esc(s.label || "(untitled)")}</option>`).join("");
  html += inspGroup("When this question\u2026", `<select class="bs-pab-select" onchange="builderSetVisSource('${esc(f.id)}',this.value)">${srcOpts}</select>`, "");
  const src = builderField(vis.sourceFieldId);
  if (src && src.type === "boolean") {
    const m = vis.match && vis.match.boolean || { true: false, false: false };
    html += `<div class="bs-pab-helper">\u2026has the answer:</div>
      <label class="bs-pab-check"><input type="checkbox" ${m.true ? "checked" : ""} onchange="builderSetVisBool('${esc(f.id)}','true',this.checked)"> Yes</label>
      <label class="bs-pab-check"><input type="checkbox" ${m.false ? "checked" : ""} onchange="builderSetVisBool('${esc(f.id)}','false',this.checked)"> No</label>`;
  } else if (src && (src.type === "single_select" || src.type === "multi_select")) {
    const chosen = vis.match && vis.match.optionIds || [];
    const checks = (src.settings.options || []).map((o) => `<label class="bs-pab-check"><input type="checkbox" ${chosen.indexOf(o.id) >= 0 ? "checked" : ""} onchange="builderSetVisOption('${esc(f.id)}','${esc(o.id)}',this.checked)"> ${esc(o.label)}</label>`).join("");
    html += `<div class="bs-pab-helper">\u2026is any of:</div>${checks || '<div class="bs-pab-helper">That question has no options.</div>'}`;
  } else if (vis.sourceFieldId) {
    html += `<div class="bs-pab-helper">That source question is no longer available.</div>`;
  }
  return html;
}
function builderSelect(id) {
  if (BUILDER.selectedId === id) return;
  BUILDER.selectedId = id || null;
  builderRerenderCanvas();
  builderRerenderNav();
  if (BUILDER.inspectorOpen) builderRerenderInspector();
}
function builderOpenInspector(id) {
  if (id) BUILDER.selectedId = id;
  BUILDER.inspectorOpen = true;
  const body = document.querySelector(".bs-pab-body");
  if (body) body.classList.add("inspector-open");
  builderRerenderInspector();
  builderRerenderCanvas();
  builderRerenderNav();
}
function builderCloseInspector() {
  BUILDER.inspectorOpen = false;
  const body = document.querySelector(".bs-pab-body");
  if (body) body.classList.remove("inspector-open");
}
function builderNavSearchInput(v) {
  BUILDER.navQuery = v;
  builderRerenderNav();
}
function builderCanvasFilterInput(v) {
  BUILDER.canvasQuery = v;
  builderRerenderCanvas();
}
function builderSetView(compact) {
  BUILDER.compact = compact;
  const c = document.getElementById("pab-canvas");
  if (c) c.classList.toggle("compact", compact);
  document.querySelectorAll(".bs-pab-view-btn").forEach((b, i) => b.classList.toggle("bs-pab-view-active", i === (compact ? 1 : 0)));
}
function builderToggleSection(sid) {
  BUILDER.collapsed[sid] = !BUILDER.collapsed[sid];
  builderRerenderCanvas();
  builderRerenderNav();
}
function builderCollapseAll() {
  const t = builderTemplate();
  const headers = t.fields.filter((f) => f.type === "header");
  const anyOpen = headers.some((h) => !BUILDER.collapsed[h.id]);
  headers.forEach((h) => {
    BUILDER.collapsed[h.id] = anyOpen;
  });
  builderRerenderCanvas();
  builderRerenderNav();
}
function builderDragStart(e, id) {
  BUILDER.dragId = id;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", id);
    } catch (_e) {
    }
  }
}
function builderDragOver(e) {
  if (!BUILDER.dragId) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
}
function builderDrop(e, targetId) {
  e.preventDefault();
  const src = BUILDER.dragId;
  BUILDER.dragId = "";
  if (!src || src === targetId) return;
  const t = builderTemplate();
  const from = t.fields.findIndex((f) => f.id === src);
  const to = t.fields.findIndex((f) => f.id === targetId);
  if (from < 0 || to < 0) return;
  const moved = t.fields.splice(from, 1)[0];
  const newTo = t.fields.findIndex((f) => f.id === targetId);
  t.fields.splice(newTo + (from < to ? 1 : 0), 0, moved);
  markDirty();
  builderRerenderCanvas();
  builderRerenderNav();
}
function builderDragEnd() {
  BUILDER.dragId = "";
}
function builderMove(id, dir) {
  const t = builderTemplate();
  const i = t.fields.findIndex((f) => f.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= t.fields.length) return;
  const tmp = t.fields[i];
  t.fields[i] = t.fields[j];
  t.fields[j] = tmp;
  markDirty();
  builderRerenderCanvas();
  builderRerenderNav();
}
function builderDelete(id) {
  const t = builderTemplate();
  const i = t.fields.findIndex((f) => f.id === id);
  if (i < 0) return;
  t.fields.forEach((f) => {
    if (f.visibility && f.visibility.sourceFieldId === id) f.visibility = null;
  });
  t.fields.splice(i, 1);
  if (BUILDER.selectedId === id) BUILDER.selectedId = null;
  markDirty();
  builderRerenderCanvas();
  builderRerenderNav();
  builderRerenderInspector();
}
function builderDuplicate(id) {
  const t = builderTemplate();
  const i = t.fields.findIndex((f) => f.id === id);
  if (i < 0) return;
  const copy = JSON.parse(JSON.stringify(t.fields[i]));
  copy.id = uuid();
  copy.visibility = null;
  if (copy.settings.options) copy.settings.options = copy.settings.options.map((o) => ({ id: uuid(), label: o.label }));
  t.fields.splice(i + 1, 0, copy);
  BUILDER.selectedId = copy.id;
  markDirty();
  builderRerenderCanvas();
  builderRerenderNav();
  builderRerenderInspector();
}
function builderAddField(type) {
  builderClosePicker();
  const t = builderTemplate();
  const f = createField(type);
  const selIdx = BUILDER.selectedId ? t.fields.findIndex((x) => x.id === BUILDER.selectedId) : -1;
  if (selIdx >= 0) t.fields.splice(selIdx + 1, 0, f);
  else t.fields.push(f);
  BUILDER.selectedId = f.id;
  markDirty();
  builderRerenderCanvas();
  builderRerenderNav();
  builderRerenderInspector();
}
function builderSetProp(id, prop, value) {
  const f = builderField(id);
  if (!f) return;
  if (prop === "content" || prop === "placeholder") f.settings[prop] = value;
  else f[prop] = value;
  markDirty();
  if (prop === "label" || prop === "content") patchCardTitle(id);
  if (prop === "mapTo") {
    builderRerenderCanvas();
    builderRerenderInspector();
  }
}
function builderSetBool(id, prop, value) {
  const f = builderField(id);
  if (!f) return;
  f[prop] = value;
  markDirty();
  builderRerenderCanvas();
  builderRerenderInspector();
}
function builderAddOption(id) {
  const f = builderField(id);
  if (!f) return;
  if (!f.settings.options) f.settings.options = [];
  f.settings.options.push({ id: uuid(), label: "New option" });
  markDirty();
  builderRerenderInspector();
}
function builderRemoveOption(id, optId) {
  const f = builderField(id);
  if (!f || !f.settings.options) return;
  f.settings.options = f.settings.options.filter((o) => o.id !== optId);
  builderTemplate().fields.forEach((x) => {
    if (x.visibility && x.visibility.match && x.visibility.match.optionIds) {
      x.visibility.match.optionIds = x.visibility.match.optionIds.filter((o) => o !== optId);
    }
  });
  markDirty();
  builderRerenderInspector();
}
function builderSetOption(id, optId, label) {
  const f = builderField(id);
  if (!f || !f.settings.options) return;
  const o = f.settings.options.filter((x) => x.id === optId)[0];
  if (o) {
    o.label = label;
    markDirty();
  }
}
function builderToggleVisibility(id, on) {
  const f = builderField(id);
  if (!f) return;
  f.visibility = on ? { sourceFieldId: "", match: {} } : null;
  markDirty();
  builderRerenderInspector();
  builderRerenderCanvas();
}
function builderSetVisSource(id, sourceId) {
  const f = builderField(id);
  if (!f || !f.visibility) return;
  f.visibility.sourceFieldId = sourceId;
  const src = builderField(sourceId);
  f.visibility.match = src && src.type === "boolean" ? { boolean: { true: false, false: false } } : { optionIds: [] };
  markDirty();
  builderRerenderInspector();
  builderRerenderCanvas();
}
function builderSetVisBool(id, which, on) {
  const f = builderField(id);
  if (!f || !f.visibility) return;
  if (!f.visibility.match.boolean) f.visibility.match.boolean = { true: false, false: false };
  f.visibility.match.boolean[which] = on;
  markDirty();
}
function builderSetVisOption(id, optId, on) {
  const f = builderField(id);
  if (!f || !f.visibility) return;
  if (!f.visibility.match.optionIds) f.visibility.match.optionIds = [];
  const arr = f.visibility.match.optionIds;
  const at = arr.indexOf(optId);
  if (on && at < 0) arr.push(optId);
  if (!on && at >= 0) arr.splice(at, 1);
  markDirty();
}
function builderRerenderCanvas() {
  const el = document.getElementById("pab-canvas");
  if (el) el.innerHTML = builderCanvas(builderTemplate());
  builderSyncCounts();
}
function builderRerenderNav() {
  const el = document.getElementById("pab-nav-list");
  if (el) el.innerHTML = builderNavList(builderTemplate());
}
function builderRerenderInspector() {
  const el = document.getElementById("pab-inspector");
  if (el) el.innerHTML = builderInspector(BUILDER.selectedId ? builderField(BUILDER.selectedId) : null);
}
function patchCardTitle(id) {
  const f = builderField(id);
  if (!f) return;
  const title = fieldPreviewLabel(f);
  document.querySelectorAll('[data-fid-label="' + id + '"]').forEach((el) => {
    el.textContent = title;
  });
  const nav = document.querySelector('.bs-pab-nav-item[onclick*="' + id + '"] .bs-pab-nav-item-label');
  if (nav) nav.textContent = title;
}
function builderSyncCounts() {
  const c = statCounts(builderTemplate());
  const set = (idi, n) => {
    const e = document.getElementById("stat-" + idi);
    if (e) {
      const num = e.querySelector(".bs-pab-stat-num");
      if (num) num.textContent = String(n);
    }
  };
  set("total", c.total);
  set("unmapped", c.unmapped);
  set("required", c.required);
  set("conditional", c.conditional);
  set("inactive", c.inactive);
  const un = document.getElementById("stat-unmapped");
  if (un) un.classList.toggle("bs-pab-stat-warn", c.unmapped > 0);
}
function builderOpenPicker() {
  const cards = FIELD_TYPES.map((ft) => `<button class="bs-pab-picker-card" onclick="builderAddField('${ft.type}')">
      <span class="bs-pab-picker-icon">${esc(ft.glyph)}</span>
      <span class="bs-pab-picker-label">${esc(ft.label)}</span>
      <span class="bs-pab-picker-sub">${esc(ft.sub)}</span>
    </button>`).join("");
  const html = `<div class="bs-pab-modal-overlay" id="pab-picker" style="display:flex" onclick="if(event.target===this)builderClosePicker()">
    <div class="bs-pab-modal bs-pab-picker-modal">
      <div class="bs-pab-modal-header"><span class="bs-pab-modal-title">Add a Field</span><button class="bs-pab-icon-btn" onclick="builderClosePicker()">\u2715</button></div>
      <div class="bs-pab-picker-grid">${cards}</div>
    </div>
  </div>`;
  mountOverlay(html);
}
function builderClosePicker() {
  unmountOverlay("pab-picker");
}
function builderFormSettings() {
  const t = builderTemplate();
  const html = `<div class="bs-pab-modal-overlay" id="pab-formset" style="display:flex" onclick="if(event.target===this)unmountOverlay('pab-formset')">
    <div class="bs-pab-modal" style="width:520px;max-width:95vw">
      <div class="bs-pab-modal-header"><span class="bs-pab-modal-title">Form Settings</span><button class="bs-pab-icon-btn" onclick="unmountOverlay('pab-formset')">\u2715</button></div>
      <div style="padding:16px 20px;display:flex;flex-direction:column;gap:14px;max-height:70vh;overflow-y:auto">
        <div class="bs-pab-field-group"><div class="bs-pab-label">Application title</div>
          <input class="bs-pab-input" type="text" value="${esc(t.title)}" oninput="builderSetForm('title',this.value)" autocomplete="off"></div>
        <div class="bs-pab-field-group"><div class="bs-pab-label">Intro / description</div>
          <textarea class="bs-pab-input" style="min-height:70px" oninput="builderSetForm('description',this.value)">${esc(t.description)}</textarea>
          <div class="bs-pab-helper">Shown to families at the top of the application.</div></div>
        <div class="bs-pab-field-group"><div class="bs-pab-label">Confirmation message</div>
          <textarea class="bs-pab-input" style="min-height:52px" oninput="builderSetForm('submittedMessage',this.value)">${esc(t.strings.submittedMessage || "")}</textarea>
          <div class="bs-pab-helper">Shown after a successful submit.</div></div>
      </div>
      <div style="padding:12px 20px;border-top:1px solid var(--bs-border);display:flex;justify-content:flex-end">
        <button class="bs-pab-btn bs-pab-btn-primary" onclick="unmountOverlay('pab-formset');builderRefreshHeader()">Done</button>
      </div>
    </div>
  </div>`;
  mountOverlay(html);
}
function builderSetForm(prop, value) {
  const t = builderTemplate();
  if (prop === "submittedMessage") t.strings.submittedMessage = value;
  else t[prop] = value;
  markDirty();
}
function builderRefreshHeader() {
  if (typeof render === "function") render();
}
function builderOpenLogic() {
  const t = builderTemplate();
  const rules = t.fields.filter((f) => f.visibility && f.visibility.sourceFieldId);
  let body;
  if (!rules.length) {
    body = `<div class="bs-pab-empty-state"><strong>No conditional rules</strong>Add a rule from a field's Logic section to show/hide it based on an earlier answer.</div>`;
  } else {
    const rows = rules.map((f) => {
      const src = builderField(f.visibility.sourceFieldId);
      const vis = f.visibility;
      let cond = "";
      if (src && src.type === "boolean") {
        const m = vis.match.boolean || { true: false, false: false };
        const parts = [];
        if (m.true) parts.push("Yes");
        if (m.false) parts.push("No");
        cond = (src.label || "(untitled)") + " = " + (parts.join(" or ") || "(none)");
      } else if (src) {
        const chosen = vis.match.optionIds || [];
        const labels = (src.settings.options || []).filter((o) => chosen.indexOf(o.id) >= 0).map((o) => o.label);
        cond = (src.label || "(untitled)") + " is " + (labels.join(" / ") || "(none)");
      } else {
        cond = "(source removed)";
      }
      return `<tr><td style="font-weight:600">${esc(fieldPreviewLabel(f))}</td><td>shows when</td><td>${esc(cond)}</td></tr>`;
    }).join("");
    body = `<table class="bs-pab-logic-table"><thead><tr><th>Field</th><th></th><th>Condition</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  const html = `<div class="bs-pab-modal-overlay" id="pab-logic" style="display:flex" onclick="if(event.target===this)unmountOverlay('pab-logic')">
    <div class="bs-pab-modal bs-pab-logic-modal">
      <div class="bs-pab-modal-header"><span class="bs-pab-modal-title">Logic Overview</span><button class="bs-pab-icon-btn" onclick="unmountOverlay('pab-logic')">\u2715</button></div>
      <div class="bs-pab-logic-table-wrap" style="padding:12px 20px;max-height:70vh;overflow-y:auto">${body}</div>
    </div>
  </div>`;
  mountOverlay(html);
}
function builderValidate(t) {
  for (const f of t.fields) {
    if (f.type === "single_select" || f.type === "multi_select") {
      const opts = (f.settings.options || []).filter((o) => o.label.trim());
      if (!opts.length) return 'The choice question "' + (f.label || "Untitled") + '" needs at least one option.';
    }
  }
  return "";
}
async function builderSave() {
  if (BUILDER.busy) return;
  const t = builderTemplate();
  BUILDER.busy = "saving";
  builderSetBtns(true, "Saving\u2026", null);
  try {
    const res = await apiSaveAppTemplate(t);
    BUILDER.lastUpdated = res && res.lastUpdated || (/* @__PURE__ */ new Date()).toISOString();
    BUILDER.dirty = false;
    toast("Draft saved");
  } catch (e) {
    toast("Save failed: " + (e && e.message ? e.message : String(e)));
  } finally {
    BUILDER.busy = "";
    builderSetBtns(false, "Save Draft", BUILDER.dirty ? "Unsaved changes" : "Saved");
  }
}
async function builderPublish() {
  if (BUILDER.busy) return;
  const t = builderTemplate();
  const problem = builderValidate(t);
  if (problem) {
    toast(problem);
    return;
  }
  if (!confirm("Publish this application? Families opening their link will see this version.")) return;
  BUILDER.busy = "publishing";
  builderSetBtns(true, null, "Publishing\u2026");
  try {
    const res = await apiPublishAppTemplate(t);
    BUILDER.lastPublished = res && res.lastPublished || (/* @__PURE__ */ new Date()).toISOString();
    BUILDER.lastUpdated = res && res.lastUpdated || BUILDER.lastPublished;
    BUILDER.dirty = false;
    toast("Published");
    if (typeof render === "function") render();
  } catch (e) {
    toast("Publish failed: " + (e && e.message ? e.message : String(e)));
  } finally {
    BUILDER.busy = "";
    builderSetBtns(false, "Save Draft", null);
  }
}
function builderSetBtns(disabled, saveLabel, dirtyLabel) {
  const save = document.getElementById("pab-save");
  const pub = document.getElementById("pab-publish");
  if (save) {
    save.disabled = disabled;
    if (saveLabel) save.textContent = "\u{1F4BE} " + saveLabel;
  }
  if (pub) pub.disabled = disabled;
  if (dirtyLabel !== null) {
    const d = document.getElementById("pab-dirty");
    if (d) d.textContent = dirtyLabel;
  }
}
function mountOverlay(html) {
  const host = document.createElement("div");
  host.innerHTML = html;
  const node = host.firstElementChild;
  if (node) document.body.appendChild(node);
}
function unmountOverlay(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}
function fmtStamp(iso) {
  if (!iso) return "";
  try {
    const clean = iso.replace(/\[[^\]]*\]\s*$/, "");
    const d = new Date(clean);
    if (isNaN(d.getTime())) return clean;
    return d.toLocaleDateString(void 0, { month: "short", day: "numeric", year: "numeric" });
  } catch (_e) {
    return iso;
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiYXBwYnVpbGRlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICBhcHBidWlsZGVyLnRzIFx1MjAxNCB0aGUgQXBwbGljYXRpb24gQnVpbGRlciAoZnVsbC1ibGVlZCBhZG1pbiB2aWV3KS5cblxuICAgQXV0aG9ycyB0aGUgcGFyZW50LWFwcGxpY2F0aW9uIFRFTVBMQVRFOiBhbiBvcmRlcmVkIGxpc3Qgb2YgZmllbGRzIHRoZVxuICAgYnVpbGRlciBlZGl0cyBhbmQgdGhlIGludGVycHJldGVyIChvbiB0aGUgcHVibGljIHNhdGVsbGl0ZSBzaXRlKSByZW5kZXJzXG4gICBpbnRvIGEgZmlsbGFibGUgZm9ybS4gVGhlIHRlbXBsYXRlIGlzIHN0b3JlZCBhcyBkcmFmdCArIHB1Ymxpc2hlZCBKU09OIG9uXG4gICB0aGUgb3JnJ3MgYGFwcGAgZm9ybSAoc2VlIG1hZXN0cm8gZ2V0QXBwVGVtcGxhdGUvc2F2ZUFwcFRlbXBsYXRlL1xuICAgcHVibGlzaEFwcFRlbXBsYXRlKS4gUHVibGlzaGluZyBpcyB3aGF0IGZhbWlsaWVzIGZpbGwgb3V0LlxuXG4gICBVSTogYSAzLXBhbmUgZmxhZ3NoaXAgYnVpbGRlciBtb2RlbGVkIG9uIHN1bW1pdHJpZGdlJ3MgQXBwbGljYXRpb24gQnVpbGRlclxuICAgKGZpbGVzLzE0NjE3NzkpIFx1MjAxNCBhIHNlYXJjaGFibGUgTmF2aWdhdG9yIChsZWZ0KSBvdXRsaW5pbmcgc2VjdGlvbnMrZmllbGRzLCBhXG4gICBDYW52YXMgKG1pZGRsZSkgb2Ygc2VjdGlvbi1ncm91cGVkIGNvbXBhY3QgY2FyZHMgd2l0aCBpbmxpbmUgZWRpdGluZyArIGFcbiAgIG5vcm1hbC9jb21wYWN0IHZpZXcgdG9nZ2xlLCBhbmQgYSBzbGlkZS1pbiBJbnNwZWN0b3IgKHJpZ2h0KSBmb3IgZGVlcCBmaWVsZFxuICAgc2V0dGluZ3MuIEEgc3RhdHVzIHBpbGwgYmFyIChmaWVsZHMvdW5tYXBwZWQvcmVxdWlyZWQvY29uZGl0aW9uYWwvaW5hY3RpdmUpLFxuICAgYSBmaWVsZC10eXBlIHBpY2tlciBncmlkLCBmb3JtIHNldHRpbmdzLCBhbmQgYSBMb2dpYyBvdmVydmlldyByb3VuZCBpdCBvdXQuXG4gICBBbGwgbWFya3VwIGlzIGAuYnMtcGFiLSpgIChzdHlsZXMgaW4gYXBwYnVpbGRlci5jc3MpOyB0aGUgdGVtcGxhdGUgSlNPTiBzaGFwZVxuICAgaXMgdW5jaGFuZ2VkIHNvIHRoZSBpbnRlcnByZXRlciArIGluZ2VzdGVyIHNwZWFrIG9uZSBjb250cmFjdC5cblxuICAgUm91dGU6ICMvYnVpbGRlciAgKGxhdW5jaGVkIGZyb20gU2V0dGluZ3MgXHUyNUI4IEFwcGxpY2F0aW9ucylcblxuICAgUmVuZGVyIGRpc2NpcGxpbmU6IHRoZSBTUEEncyByZW5kZXIoKSB3aXBlcyAjYXBwLCB3aGljaCB3b3VsZCBzdGVhbCBpbnB1dFxuICAgZm9jdXMgb24gZXZlcnkga2V5c3Ryb2tlLiBGaWVsZC1wcm9wZXJ0eSB0ZXh0IGVkaXRzIHVwZGF0ZSBzdGF0ZSBpbiBwbGFjZSBhbmRcbiAgIHBhdGNoIHRoZSBET00gc3VyZ2ljYWxseSAoY2FyZC9uYXYgbGFiZWwpOyBzdHJ1Y3R1cmFsIGNoYW5nZXMgcmUtcmVuZGVyIGFcbiAgIHdob2xlIHBhbmUgKGNhbnZhcyAvIG5hdmlnYXRvciAvIGluc3BlY3RvcikuXG4gICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxudHlwZSBBcHBGaWVsZFR5cGUgPVxuICB8ICdoZWFkZXInIHwgJ3N0YXRpY190ZXh0JyB8ICd0ZXh0JyB8ICdtZW1vJyB8ICdudW1iZXInIHwgJ2RhdGUnXG4gIHwgJ3NpbmdsZV9zZWxlY3QnIHwgJ211bHRpX3NlbGVjdCcgfCAnYm9vbGVhbicgfCAnZG9jX3VwbG9hZCc7XG5cbmludGVyZmFjZSBBcHBPcHRpb24geyBpZDogc3RyaW5nOyBsYWJlbDogc3RyaW5nOyB9XG5pbnRlcmZhY2UgQXBwVmlzaWJpbGl0eSB7XG4gIHNvdXJjZUZpZWxkSWQ6IHN0cmluZztcbiAgLy8gYm9vbGVhbiBzb3VyY2U6IHNob3cgd2hlbiBZZXMgYW5kL29yIE5vIGlzIGNob3Nlbjsgc2VsZWN0IHNvdXJjZTogc2hvdyB3aGVuXG4gIC8vIGFueSBvZiBvcHRpb25JZHMgaXMgY2hvc2VuLlxuICBtYXRjaDogeyBib29sZWFuPzogeyB0cnVlOiBib29sZWFuOyBmYWxzZTogYm9vbGVhbiB9OyBvcHRpb25JZHM/OiBzdHJpbmdbXSB9O1xufVxuaW50ZXJmYWNlIEFwcEZpZWxkIHtcbiAgaWQ6IHN0cmluZztcbiAgdHlwZTogQXBwRmllbGRUeXBlO1xuICBsYWJlbDogc3RyaW5nO1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICByZXF1aXJlZDogYm9vbGVhbjtcbiAgbWFwVG86IHN0cmluZzsgICAgICAgICAgLy8gJycgb3IgYSBtYWVzdHJvIGNsaWVudC1maWVsZCBrZXkgKGZpcnN0TmFtZSwgZG9iLCBcdTIwMjYpXG4gIGFjdGl2ZTogYm9vbGVhbjsgICAgICAgIC8vIGluYWN0aXZlIGZpZWxkcyBhcmUga2VwdCBidXQgbm90IHJlbmRlcmVkIHRvIHBhcmVudHNcbiAgc2V0dGluZ3M6IHtcbiAgICBjb250ZW50Pzogc3RyaW5nOyAgICAgLy8gc3RhdGljX3RleHQgYm9keVxuICAgIHBsYWNlaG9sZGVyPzogc3RyaW5nOyAvLyB0ZXh0IC8gbWVtbyAvIG51bWJlclxuICAgIG9wdGlvbnM/OiBBcHBPcHRpb25bXTsvLyBzaW5nbGVfc2VsZWN0IC8gbXVsdGlfc2VsZWN0XG4gIH07XG4gIHZpc2liaWxpdHk/OiBBcHBWaXNpYmlsaXR5IHwgbnVsbDtcbn1cbmludGVyZmFjZSBBcHBUZW1wbGF0ZSB7XG4gIHNjaGVtYVZlcnNpb246IG51bWJlcjtcbiAgdGl0bGU6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgbGFzdE1vZGlmaWVkVXRjOiBzdHJpbmc7XG4gIHN0cmluZ3M6IHsgc3VibWl0dGVkTWVzc2FnZT86IHN0cmluZyB9O1xuICBmaWVsZHM6IEFwcEZpZWxkW107XG59XG5cbi8vIG1hcFRvIHRhcmdldHMgXHUyMDE0IHRoZXNlIGFyZSBtYWVzdHJvIENMSUVOVF9GSUVMRFMgcGF5bG9hZCBrZXlzLCBzbyB0aGUgaW5nZXN0ZXJcbi8vIGNhbiBwb3B1bGF0ZSB0aGUgcmVhbCByZWNvcmQgYnkgcGFzc2luZyB7IFttYXBUb106IHZhbHVlIH0gdG8gdGhlIGZpZWxkIGVuZ2luZS5cbmNvbnN0IE1BUF9UT19PUFRJT05TOiB7IHZhbHVlOiBzdHJpbmc7IGxhYmVsOiBzdHJpbmcgfVtdID0gW1xuICB7IHZhbHVlOiAnJywgbGFiZWw6ICdcdTIwMTQgTm90IG1hcHBlZCBcdTIwMTQnIH0sXG4gIHsgdmFsdWU6ICdmaXJzdE5hbWUnLCBsYWJlbDogJ0NsaWVudCBcdTIwMjIgRmlyc3QgbmFtZScgfSxcbiAgeyB2YWx1ZTogJ2xhc3ROYW1lJywgbGFiZWw6ICdDbGllbnQgXHUyMDIyIExhc3QgbmFtZScgfSxcbiAgeyB2YWx1ZTogJ3ByZWZOYW1lJywgbGFiZWw6ICdDbGllbnQgXHUyMDIyIFByZWZlcnJlZCBuYW1lJyB9LFxuICB7IHZhbHVlOiAnZW1haWwnLCBsYWJlbDogJ0NsaWVudCBcdTIwMjIgRW1haWwnIH0sXG4gIHsgdmFsdWU6ICdkb2InLCBsYWJlbDogJ0NsaWVudCBcdTIwMjIgRGF0ZSBvZiBiaXJ0aCcgfSxcbiAgeyB2YWx1ZTogJ2NlbGwnLCBsYWJlbDogJ0NsaWVudCBcdTIwMjIgQ2VsbCBwaG9uZScgfSxcbiAgeyB2YWx1ZTogJ2hvbWVQaG9uZScsIGxhYmVsOiAnQ2xpZW50IFx1MjAyMiBIb21lIHBob25lJyB9LFxuICB7IHZhbHVlOiAnaG9tZUFkZHJlc3MnLCBsYWJlbDogJ0NsaWVudCBcdTIwMjIgSG9tZSBhZGRyZXNzJyB9LFxuICB7IHZhbHVlOiAnaG9tZUNpdHknLCBsYWJlbDogJ0NsaWVudCBcdTIwMjIgQ2l0eScgfSxcbiAgeyB2YWx1ZTogJ2hvbWVTdGF0ZScsIGxhYmVsOiAnQ2xpZW50IFx1MjAyMiBTdGF0ZScgfSxcbiAgeyB2YWx1ZTogJ2hvbWVaaXAnLCBsYWJlbDogJ0NsaWVudCBcdTIwMjIgWklQJyB9LFxuICB7IHZhbHVlOiAnc2V4JywgbGFiZWw6ICdDbGllbnQgXHUyMDIyIFNleCcgfSxcbiAgeyB2YWx1ZTogJ2dlbmRlcicsIGxhYmVsOiAnQ2xpZW50IFx1MjAyMiBHZW5kZXInIH0sXG4gIHsgdmFsdWU6ICdwcm9ub3VucycsIGxhYmVsOiAnQ2xpZW50IFx1MjAyMiBQcm9ub3VucycgfSxcbiAgeyB2YWx1ZTogJ3JhY2UnLCBsYWJlbDogJ0NsaWVudCBcdTIwMjIgUmFjZScgfSxcbiAgeyB2YWx1ZTogJ2V0aG5pY2l0eScsIGxhYmVsOiAnQ2xpZW50IFx1MjAyMiBFdGhuaWNpdHknIH0sXG4gIHsgdmFsdWU6ICdzZXh1YWxPcmllbnRhdGlvbicsIGxhYmVsOiAnQ2xpZW50IFx1MjAyMiBTZXh1YWwgb3JpZW50YXRpb24nIH0sXG4gIHsgdmFsdWU6ICdzc24nLCBsYWJlbDogJ0NsaWVudCBcdTIwMjIgU1NOJyB9LFxuXTtcblxuY29uc3QgRklFTERfVFlQRVM6IHsgdHlwZTogQXBwRmllbGRUeXBlOyBnbHlwaDogc3RyaW5nOyBsYWJlbDogc3RyaW5nOyBzdWI6IHN0cmluZyB9W10gPSBbXG4gIHsgdHlwZTogJ2hlYWRlcicsIGdseXBoOiAnSCcsIGxhYmVsOiAnSGVhZGVyJywgc3ViOiAnU2VjdGlvbiB0aXRsZScgfSxcbiAgeyB0eXBlOiAnc3RhdGljX3RleHQnLCBnbHlwaDogJ1x1MjcwRScsIGxhYmVsOiAnU3RhdGljIFRleHQnLCBzdWI6ICdJbnN0cnVjdGlvbnMgLyBub3RlcycgfSxcbiAgeyB0eXBlOiAndGV4dCcsIGdseXBoOiAnVCcsIGxhYmVsOiAnVGV4dCcsIHN1YjogJ1Nob3J0IGFuc3dlcicgfSxcbiAgeyB0eXBlOiAnbWVtbycsIGdseXBoOiAnXHUwMEI2JywgbGFiZWw6ICdNZW1vJywgc3ViOiAnTXVsdGktbGluZSBhbnN3ZXInIH0sXG4gIHsgdHlwZTogJ251bWJlcicsIGdseXBoOiAnIycsIGxhYmVsOiAnTnVtYmVyJywgc3ViOiAnTnVtZXJpYyBpbnB1dCcgfSxcbiAgeyB0eXBlOiAnZGF0ZScsIGdseXBoOiAnXHUyNUE2JywgbGFiZWw6ICdEYXRlJywgc3ViOiAnRGF0ZSBwaWNrZXInIH0sXG4gIHsgdHlwZTogJ3NpbmdsZV9zZWxlY3QnLCBnbHlwaDogJ1x1MjVDOScsIGxhYmVsOiAnU2luZ2xlIFNlbGVjdCcsIHN1YjogJ0Ryb3Bkb3duIC8gcmFkaW8nIH0sXG4gIHsgdHlwZTogJ211bHRpX3NlbGVjdCcsIGdseXBoOiAnXHUyNjExJywgbGFiZWw6ICdNdWx0aSBTZWxlY3QnLCBzdWI6ICdDaGVja2JveGVzJyB9LFxuICB7IHR5cGU6ICdib29sZWFuJywgZ2x5cGg6ICdcdTIxQzQnLCBsYWJlbDogJ1llcyAvIE5vJywgc3ViOiAnQm9vbGVhbiB0b2dnbGUnIH0sXG4gIHsgdHlwZTogJ2RvY191cGxvYWQnLCBnbHlwaDogJ1x1MjE5MScsIGxhYmVsOiAnRG9jdW1lbnQgVXBsb2FkJywgc3ViOiAnRmlsZSBhdHRhY2htZW50JyB9LFxuXTtcbmZ1bmN0aW9uIGZpZWxkVHlwZU1ldGEodDogQXBwRmllbGRUeXBlKSB7XG4gIHJldHVybiBGSUVMRF9UWVBFUy5maWx0ZXIoeCA9PiB4LnR5cGUgPT09IHQpWzBdIHx8IHsgdHlwZTogdCwgZ2x5cGg6ICc/JywgbGFiZWw6IHQsIHN1YjogJycgfTtcbn1cbi8vIFR5cGVzIHRoYXQgZG9uJ3QgY2FwdHVyZSBhbiBhbnN3ZXIgKG5vIHJlcXVpcmVkIC8gbWFwVG8gLyBkYXRhKS5cbmZ1bmN0aW9uIGlzRGlzcGxheVR5cGUodDogQXBwRmllbGRUeXBlKTogYm9vbGVhbiB7IHJldHVybiB0ID09PSAnaGVhZGVyJyB8fCB0ID09PSAnc3RhdGljX3RleHQnOyB9XG4vLyBUeXBlcyBlbGlnaWJsZSBhcyBhIGNvbmRpdGlvbmFsLWxvZ2ljIFNPVVJDRSAoYSBkaXNjcmV0ZSwgY2hlY2thYmxlIHZhbHVlKS5cbmZ1bmN0aW9uIGlzTG9naWNTb3VyY2UodDogQXBwRmllbGRUeXBlKTogYm9vbGVhbiB7IHJldHVybiB0ID09PSAnYm9vbGVhbicgfHwgdCA9PT0gJ3NpbmdsZV9zZWxlY3QnIHx8IHQgPT09ICdtdWx0aV9zZWxlY3QnOyB9XG5cbi8qIC0tLS0gc3RhdGUgLS0tLSAqL1xuaW50ZXJmYWNlIEJ1aWxkZXJTdGF0ZSB7XG4gIHRlbXBsYXRlOiBBcHBUZW1wbGF0ZSB8IG51bGw7XG4gIGxvYWRpbmc6IGJvb2xlYW47XG4gIGVycm9yOiBzdHJpbmcgfCBudWxsO1xuICBzZWxlY3RlZElkOiBzdHJpbmcgfCBudWxsO1xuICBkaXJ0eTogYm9vbGVhbjtcbiAgbGFzdFVwZGF0ZWQ6IHN0cmluZztcbiAgbGFzdFB1Ymxpc2hlZDogc3RyaW5nO1xuICBidXN5OiAnJyB8ICdzYXZpbmcnIHwgJ3B1Ymxpc2hpbmcnO1xuICBuYXZRdWVyeTogc3RyaW5nOyAgICAgICAgICAgICAgICAgLy8gTmF2aWdhdG9yIHNlYXJjaCB0ZXh0XG4gIGNhbnZhc1F1ZXJ5OiBzdHJpbmc7ICAgICAgICAgICAgICAvLyBDYW52YXMgZmlsdGVyIHRleHRcbiAgY29tcGFjdDogYm9vbGVhbjsgICAgICAgICAgICAgICAgIC8vIGNvbXBhY3QgY2FudmFzIHZpZXdcbiAgaW5zcGVjdG9yT3BlbjogYm9vbGVhbjsgICAgICAgICAgIC8vIHJpZ2h0IHNsaWRlLWluIHBhbmVsIG9wZW5cbiAgY29sbGFwc2VkOiB7IFtzZWN0aW9uSWQ6IHN0cmluZ106IGJvb2xlYW4gfTsgLy8gY29sbGFwc2VkIHNlY3Rpb24gaWRzXG4gIGRyYWdJZDogc3RyaW5nOyAgICAgICAgICAgICAgICAgICAvLyBmaWVsZCBpZCBiZWluZyBkcmFnZ2VkXG59XG5jb25zdCBCVUlMREVSOiBCdWlsZGVyU3RhdGUgPSB7XG4gIHRlbXBsYXRlOiBudWxsLCBsb2FkaW5nOiBmYWxzZSwgZXJyb3I6IG51bGwsXG4gIHNlbGVjdGVkSWQ6IG51bGwsIGRpcnR5OiBmYWxzZSwgbGFzdFVwZGF0ZWQ6ICcnLCBsYXN0UHVibGlzaGVkOiAnJywgYnVzeTogJycsXG4gIG5hdlF1ZXJ5OiAnJywgY2FudmFzUXVlcnk6ICcnLCBjb21wYWN0OiBmYWxzZSwgaW5zcGVjdG9yT3BlbjogZmFsc2UsIGNvbGxhcHNlZDoge30sIGRyYWdJZDogJycsXG59O1xuXG5mdW5jdGlvbiB1dWlkKCk6IHN0cmluZyB7XG4gIGlmICgod2luZG93IGFzIGFueSkuY3J5cHRvICYmIChjcnlwdG8gYXMgYW55KS5yYW5kb21VVUlEKSByZXR1cm4gKGNyeXB0byBhcyBhbnkpLnJhbmRvbVVVSUQoKTtcbiAgcmV0dXJuICd4eHh4eHh4eHh4eHg0eHh4eXh4eHh4eHh4eHh4eCcucmVwbGFjZSgvW3h5XS9nLCBjID0+IHtcbiAgICBjb25zdCByID0gKE1hdGgucmFuZG9tKCkgKiAxNikgfCAwO1xuICAgIHJldHVybiAoYyA9PT0gJ3gnID8gciA6IChyICYgMHgzKSB8IDB4OCkudG9TdHJpbmcoMTYpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gYmxhbmtUZW1wbGF0ZSgpOiBBcHBUZW1wbGF0ZSB7XG4gIHJldHVybiB7XG4gICAgc2NoZW1hVmVyc2lvbjogMSxcbiAgICB0aXRsZTogJ1BhcmVudCBBcHBsaWNhdGlvbicsXG4gICAgZGVzY3JpcHRpb246ICcnLFxuICAgIGxhc3RNb2RpZmllZFV0YzogJycsXG4gICAgc3RyaW5nczogeyBzdWJtaXR0ZWRNZXNzYWdlOiAnVGhhbmsgeW91IFx1MjAxNCB5b3VyIGFwcGxpY2F0aW9uIGhhcyBiZWVuIHN1Ym1pdHRlZC4nIH0sXG4gICAgZmllbGRzOiBbXSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlRmllbGQodHlwZTogQXBwRmllbGRUeXBlKTogQXBwRmllbGQge1xuICBjb25zdCBmOiBBcHBGaWVsZCA9IHtcbiAgICBpZDogdXVpZCgpLCB0eXBlOiB0eXBlLCBsYWJlbDogJycsIGRlc2NyaXB0aW9uOiAnJyxcbiAgICByZXF1aXJlZDogZmFsc2UsIG1hcFRvOiAnJywgYWN0aXZlOiB0cnVlLCBzZXR0aW5nczoge30sIHZpc2liaWxpdHk6IG51bGwsXG4gIH07XG4gIGlmICh0eXBlID09PSAnaGVhZGVyJykgZi5sYWJlbCA9ICdOZXcgU2VjdGlvbic7XG4gIGVsc2UgaWYgKHR5cGUgPT09ICdzdGF0aWNfdGV4dCcpIGYuc2V0dGluZ3MuY29udGVudCA9ICdFbnRlciBpbnN0cnVjdGlvbnMgaGVyZS4nO1xuICBlbHNlIGYubGFiZWwgPSAnVW50aXRsZWQgcXVlc3Rpb24nO1xuICBpZiAodHlwZSA9PT0gJ3NpbmdsZV9zZWxlY3QnIHx8IHR5cGUgPT09ICdtdWx0aV9zZWxlY3QnKSB7XG4gICAgZi5zZXR0aW5ncy5vcHRpb25zID0gW3sgaWQ6IHV1aWQoKSwgbGFiZWw6ICdPcHRpb24gMScgfSwgeyBpZDogdXVpZCgpLCBsYWJlbDogJ09wdGlvbiAyJyB9XTtcbiAgfVxuICBpZiAodHlwZSA9PT0gJ3RleHQnIHx8IHR5cGUgPT09ICdtZW1vJyB8fCB0eXBlID09PSAnbnVtYmVyJykgZi5zZXR0aW5ncy5wbGFjZWhvbGRlciA9ICcnO1xuICByZXR1cm4gZjtcbn1cblxuLyogLS0tLSBsb2FkIC0tLS0gKi9cbmFzeW5jIGZ1bmN0aW9uIGxvYWRBcHBUZW1wbGF0ZShmb3JjZSA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmIChCVUlMREVSLmxvYWRpbmcpIHJldHVybjtcbiAgaWYgKEJVSUxERVIudGVtcGxhdGUgJiYgIWZvcmNlKSByZXR1cm47XG4gIEJVSUxERVIubG9hZGluZyA9IHRydWU7IEJVSUxERVIuZXJyb3IgPSBudWxsO1xuICB0cnkge1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBhcGlHZXRBcHBUZW1wbGF0ZSgpO1xuICAgIGNvbnN0IHRtcGwgPSAoZGF0YSAmJiAoZGF0YS5kcmFmdCB8fCBkYXRhLnB1Ymxpc2hlZCkpIHx8IGJsYW5rVGVtcGxhdGUoKTtcbiAgICBCVUlMREVSLnRlbXBsYXRlID0gbm9ybWFsaXplVGVtcGxhdGUodG1wbCk7XG4gICAgQlVJTERFUi5sYXN0VXBkYXRlZCA9IChkYXRhICYmIGRhdGEubGFzdFVwZGF0ZWQpIHx8ICcnO1xuICAgIEJVSUxERVIubGFzdFB1Ymxpc2hlZCA9IChkYXRhICYmIGRhdGEubGFzdFB1Ymxpc2hlZCkgfHwgJyc7XG4gICAgQlVJTERFUi5kaXJ0eSA9IGZhbHNlO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBCVUlMREVSLmVycm9yID0gZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSk7XG4gIH0gZmluYWxseSB7XG4gICAgQlVJTERFUi5sb2FkaW5nID0gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiByZW5kZXIgPT09ICdmdW5jdGlvbicpIHJlbmRlcigpO1xuICB9XG59XG5cbi8vIERlZmVuc2l2ZTogY29lcmNlIGEgbG9hZGVkIEpTT04gYmxvYiBpbnRvIGEgd2VsbC1mb3JtZWQgdGVtcGxhdGUgc28gdGhlIFVJXG4vLyBuZXZlciB0cmlwcyBvbiBhIGhhbmQtZWRpdGVkIG9yIHBhcnRpYWwgZHJhZnQuXG5mdW5jdGlvbiBub3JtYWxpemVUZW1wbGF0ZSh0OiBhbnkpOiBBcHBUZW1wbGF0ZSB7XG4gIGNvbnN0IGJhc2UgPSBibGFua1RlbXBsYXRlKCk7XG4gIGlmICghdCB8fCB0eXBlb2YgdCAhPT0gJ29iamVjdCcpIHJldHVybiBiYXNlO1xuICBjb25zdCBmaWVsZHM6IEFwcEZpZWxkW10gPSBBcnJheS5pc0FycmF5KHQuZmllbGRzKSA/IHQuZmllbGRzLm1hcChub3JtYWxpemVGaWVsZCkuZmlsdGVyKEJvb2xlYW4pIGFzIEFwcEZpZWxkW10gOiBbXTtcbiAgcmV0dXJuIHtcbiAgICBzY2hlbWFWZXJzaW9uOiB0LnNjaGVtYVZlcnNpb24gfHwgMSxcbiAgICB0aXRsZTogdHlwZW9mIHQudGl0bGUgPT09ICdzdHJpbmcnID8gdC50aXRsZSA6IGJhc2UudGl0bGUsXG4gICAgZGVzY3JpcHRpb246IHR5cGVvZiB0LmRlc2NyaXB0aW9uID09PSAnc3RyaW5nJyA/IHQuZGVzY3JpcHRpb24gOiAnJyxcbiAgICBsYXN0TW9kaWZpZWRVdGM6IHQubGFzdE1vZGlmaWVkVXRjIHx8ICcnLFxuICAgIHN0cmluZ3M6ICh0LnN0cmluZ3MgJiYgdHlwZW9mIHQuc3RyaW5ncyA9PT0gJ29iamVjdCcpID8gdC5zdHJpbmdzIDogYmFzZS5zdHJpbmdzLFxuICAgIGZpZWxkczogZmllbGRzLFxuICB9O1xufVxuZnVuY3Rpb24gbm9ybWFsaXplRmllbGQoZjogYW55KTogQXBwRmllbGQgfCBudWxsIHtcbiAgaWYgKCFmIHx8IHR5cGVvZiBmICE9PSAnb2JqZWN0JyB8fCAhZi50eXBlKSByZXR1cm4gbnVsbDtcbiAgY29uc3Qgc2V0dGluZ3MgPSAoZi5zZXR0aW5ncyAmJiB0eXBlb2YgZi5zZXR0aW5ncyA9PT0gJ29iamVjdCcpID8gZi5zZXR0aW5ncyA6IHt9O1xuICBpZiAoc2V0dGluZ3Mub3B0aW9ucyAmJiBBcnJheS5pc0FycmF5KHNldHRpbmdzLm9wdGlvbnMpKSB7XG4gICAgc2V0dGluZ3Mub3B0aW9ucyA9IHNldHRpbmdzLm9wdGlvbnNcbiAgICAgIC5tYXAoKG86IGFueSkgPT4gKHsgaWQ6IG8gJiYgby5pZCA/IFN0cmluZyhvLmlkKSA6IHV1aWQoKSwgbGFiZWw6IG8gJiYgby5sYWJlbCAhPSBudWxsID8gU3RyaW5nKG8ubGFiZWwpIDogJycgfSkpO1xuICB9XG4gIHJldHVybiB7XG4gICAgaWQ6IGYuaWQgPyBTdHJpbmcoZi5pZCkgOiB1dWlkKCksXG4gICAgdHlwZTogZi50eXBlLFxuICAgIGxhYmVsOiB0eXBlb2YgZi5sYWJlbCA9PT0gJ3N0cmluZycgPyBmLmxhYmVsIDogJycsXG4gICAgZGVzY3JpcHRpb246IHR5cGVvZiBmLmRlc2NyaXB0aW9uID09PSAnc3RyaW5nJyA/IGYuZGVzY3JpcHRpb24gOiAnJyxcbiAgICByZXF1aXJlZDogZi5yZXF1aXJlZCA9PT0gdHJ1ZSxcbiAgICBtYXBUbzogdHlwZW9mIGYubWFwVG8gPT09ICdzdHJpbmcnID8gZi5tYXBUbyA6ICcnLFxuICAgIGFjdGl2ZTogZi5hY3RpdmUgIT09IGZhbHNlLFxuICAgIHNldHRpbmdzOiBzZXR0aW5ncyxcbiAgICB2aXNpYmlsaXR5OiAoZi52aXNpYmlsaXR5ICYmIGYudmlzaWJpbGl0eS5zb3VyY2VGaWVsZElkKSA/IGYudmlzaWJpbGl0eSA6IG51bGwsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGJ1aWxkZXJUZW1wbGF0ZSgpOiBBcHBUZW1wbGF0ZSB7XG4gIGlmICghQlVJTERFUi50ZW1wbGF0ZSkgQlVJTERFUi50ZW1wbGF0ZSA9IGJsYW5rVGVtcGxhdGUoKTtcbiAgcmV0dXJuIEJVSUxERVIudGVtcGxhdGU7XG59XG5mdW5jdGlvbiBidWlsZGVyRmllbGQoaWQ6IHN0cmluZyk6IEFwcEZpZWxkIHwgbnVsbCB7XG4gIHJldHVybiBidWlsZGVyVGVtcGxhdGUoKS5maWVsZHMuZmlsdGVyKGYgPT4gZi5pZCA9PT0gaWQpWzBdIHx8IG51bGw7XG59XG5mdW5jdGlvbiBtYXJrRGlydHkoKTogdm9pZCB7XG4gIEJVSUxERVIuZGlydHkgPSB0cnVlO1xuICBidWlsZGVyVGVtcGxhdGUoKS5sYXN0TW9kaWZpZWRVdGMgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG4gIGNvbnN0IGluZCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYWItZGlydHknKTtcbiAgaWYgKGluZCkgaW5kLnRleHRDb250ZW50ID0gJ1Vuc2F2ZWQgY2hhbmdlcyc7XG59XG5cbi8qIC0tLS0gc2hhcmVkIGRlcml2YXRpb25zIC0tLS0gKi9cbi8vIFRoZSBsYWJlbCBzaG93biBmb3IgYSBmaWVsZCBvbiB0aGUgY2FudmFzIC8gbmF2aWdhdG9yLlxuZnVuY3Rpb24gZmllbGRQcmV2aWV3TGFiZWwoZjogQXBwRmllbGQpOiBzdHJpbmcge1xuICBpZiAoZi50eXBlID09PSAnaGVhZGVyJykgcmV0dXJuIGYubGFiZWwgfHwgJ1VudGl0bGVkIFNlY3Rpb24nO1xuICBpZiAoZi50eXBlID09PSAnc3RhdGljX3RleHQnKSByZXR1cm4gZi5zZXR0aW5ncy5jb250ZW50IHx8ICdJbnN0cnVjdGlvbnMnO1xuICByZXR1cm4gZi5sYWJlbCB8fCAnVW50aXRsZWQgcXVlc3Rpb24nO1xufVxuLy8gR3JvdXAgdGhlIGZsYXQgZmllbGQgbGlzdCBpbnRvIHNlY3Rpb25zOiBhIGBoZWFkZXJgIGZpZWxkIG9wZW5zIGEgc2VjdGlvbjtcbi8vIGV2ZXJ5dGhpbmcgYWZ0ZXIgaXQgKHVudGlsIHRoZSBuZXh0IGhlYWRlcikgaXMgaXRzIGNoaWxkcmVuLiBGaWVsZHMgYmVmb3JlXG4vLyB0aGUgZmlyc3QgaGVhZGVyIGxpdmUgaW4gYW4gXCJvcnBoYW5cIiAoaGVhZGVyLWxlc3MpIHNlY3Rpb24uXG5mdW5jdGlvbiBncm91cFNlY3Rpb25zKGZpZWxkczogQXBwRmllbGRbXSk6IHsgaGVhZGVyOiBBcHBGaWVsZCB8IG51bGw7IGl0ZW1zOiB7IGZpZWxkOiBBcHBGaWVsZDsgaW5kZXg6IG51bWJlciB9W10gfVtdIHtcbiAgY29uc3QgZ3JvdXBzOiB7IGhlYWRlcjogQXBwRmllbGQgfCBudWxsOyBpdGVtczogeyBmaWVsZDogQXBwRmllbGQ7IGluZGV4OiBudW1iZXIgfVtdIH1bXSA9IFtdO1xuICBsZXQgY3VyOiB7IGhlYWRlcjogQXBwRmllbGQgfCBudWxsOyBpdGVtczogeyBmaWVsZDogQXBwRmllbGQ7IGluZGV4OiBudW1iZXIgfVtdIH0gfCBudWxsID0gbnVsbDtcbiAgZmllbGRzLmZvckVhY2goKGYsIGkpID0+IHtcbiAgICBpZiAoZi50eXBlID09PSAnaGVhZGVyJykge1xuICAgICAgY3VyID0geyBoZWFkZXI6IGYsIGl0ZW1zOiBbXSB9O1xuICAgICAgZ3JvdXBzLnB1c2goY3VyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFjdXIpIHsgY3VyID0geyBoZWFkZXI6IG51bGwsIGl0ZW1zOiBbXSB9OyBncm91cHMucHVzaChjdXIpOyB9XG4gICAgICBjdXIuaXRlbXMucHVzaCh7IGZpZWxkOiBmLCBpbmRleDogaSB9KTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gZ3JvdXBzO1xufVxuZnVuY3Rpb24gc3RhdENvdW50cyh0OiBBcHBUZW1wbGF0ZSkge1xuICBjb25zdCBxID0gdC5maWVsZHMuZmlsdGVyKGYgPT4gIWlzRGlzcGxheVR5cGUoZi50eXBlKSk7XG4gIHJldHVybiB7XG4gICAgdG90YWw6IHQuZmllbGRzLmxlbmd0aCxcbiAgICB1bm1hcHBlZDogcS5maWx0ZXIoZiA9PiAhZi5tYXBUbykubGVuZ3RoLFxuICAgIHJlcXVpcmVkOiBxLmZpbHRlcihmID0+IGYucmVxdWlyZWQpLmxlbmd0aCxcbiAgICBjb25kaXRpb25hbDogdC5maWVsZHMuZmlsdGVyKGYgPT4gZi52aXNpYmlsaXR5ICYmIGYudmlzaWJpbGl0eS5zb3VyY2VGaWVsZElkKS5sZW5ndGgsXG4gICAgaW5hY3RpdmU6IHQuZmllbGRzLmZpbHRlcihmID0+ICFmLmFjdGl2ZSkubGVuZ3RoLFxuICB9O1xufVxuXG4vKiAtLS0tIHRvcC1sZXZlbCB2aWV3IC0tLS0gKi9cbmZ1bmN0aW9uIHZpZXdBcHBCdWlsZGVyKCk6IHN0cmluZyB7XG4gIC8vIFN1cGVyLW9ubHkgXHUyMDE0IHRoZSBidWlsZGVyIGVkaXRzIG9yZy13aWRlIGNvbmZpZy5cbiAgaWYgKFNFU1NJT04gJiYgU0VTU0lPTi5sb2dnZWRJbiAmJiAhU0VTU0lPTi5pc1N1cGVyKSB7XG4gICAgcmV0dXJuIHNoZWxsKCdzZXR0aW5ncycsIGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdzZXR0aW5ncycsIDIyKX08L2Rpdj5cbiAgICAgIDxiPkFkbWlucyBvbmx5PC9iPjxwPlRoZSBBcHBsaWNhdGlvbiBCdWlsZGVyIGlzIGF2YWlsYWJsZSB0byBvcmdhbml6YXRpb24gYWRtaW5pc3RyYXRvcnMuPC9wPlxuICAgICAgPGEgY2xhc3M9XCJidG4gcHJpbWFyeVwiIGhyZWY9XCIjL3NldHRpbmdzXCI+JHtpYygnY2hldlInLCAxNSl9IEJhY2sgdG8gU2V0dGluZ3M8L2E+PC9kaXY+PC9kaXY+YCk7XG4gIH1cbiAgaWYgKEJVSUxERVIudGVtcGxhdGUgPT09IG51bGwpIHtcbiAgICBpZiAoIUJVSUxERVIubG9hZGluZyAmJiAhQlVJTERFUi5lcnJvcikgbG9hZEFwcFRlbXBsYXRlKCk7XG4gICAgY29uc3QgaW5uZXIgPSBCVUlMREVSLmVycm9yXG4gICAgICA/IGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdhbGVydCcsIDIyKX08L2Rpdj48Yj5Db3VsZG4ndCBsb2FkIHRoZSB0ZW1wbGF0ZTwvYj5cbiAgICAgICAgIDxwPiR7ZXNjKEJVSUxERVIuZXJyb3IpfTwvcD48YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnlcIiBvbmNsaWNrPVwibG9hZEFwcFRlbXBsYXRlKHRydWUpXCI+JHtpYygnY2xvY2snLCAxNSl9IFJldHJ5PC9idXR0b24+PC9kaXY+PC9kaXY+YFxuICAgICAgOiBgPGRpdiBjbGFzcz1cImNhcmRcIj48ZGl2IGNsYXNzPVwiZW1wdHlcIj48ZGl2IGNsYXNzPVwiaWNvXCI+JHtpYygnY2xvY2snLCAyMil9PC9kaXY+PGI+TG9hZGluZyBidWlsZGVyXHUyMDI2PC9iPjwvZGl2PjwvZGl2PmA7XG4gICAgcmV0dXJuIHRvcGJhcigpICsgYDxkaXYgY2xhc3M9XCJib2R5XCI+JHtzaWRlYmFyKCdzZXR0aW5ncycsIHRydWUpfTxtYWluIGNsYXNzPVwibWFpblwiPjxkaXYgY2xhc3M9XCJjb250ZW50XCI+JHtpbm5lcn08L2Rpdj48L21haW4+PC9kaXY+YDtcbiAgfVxuICBjb25zdCB0ID0gYnVpbGRlclRlbXBsYXRlKCk7XG4gIGNvbnN0IHJvb3QgPSBgPGRpdiBjbGFzcz1cImJzLXBhYi1yb290XCI+XG4gICAgJHtidWlsZGVySGVhZGVyKHQpfVxuICAgIDxkaXYgY2xhc3M9XCJicy1wYWItYm9keSR7QlVJTERFUi5pbnNwZWN0b3JPcGVuID8gJyBpbnNwZWN0b3Itb3BlbicgOiAnJ31cIj5cbiAgICAgICR7YnVpbGRlck5hdih0KX1cbiAgICAgICR7YnVpbGRlckNhbnZhc1dyYXAodCl9XG4gICAgICAke2J1aWxkZXJJbnNwZWN0b3JQYW5lbCgpfVxuICAgIDwvZGl2PlxuICA8L2Rpdj5gO1xuICByZXR1cm4gdG9wYmFyKCkgKyBgPGRpdiBjbGFzcz1cImJvZHlcIj4ke3NpZGViYXIoJ3NldHRpbmdzJywgdHJ1ZSl9PG1haW4gY2xhc3M9XCJtYWluIHBhYi1tYWluXCI+JHtyb290fTwvbWFpbj48L2Rpdj5gO1xufVxuXG4vKiAtLS0tIGhlYWRlciAtLS0tICovXG5mdW5jdGlvbiBidWlsZGVyU3RhdFNwYW4oaWQ6IHN0cmluZywgbnVtOiBudW1iZXIsIGxhYmVsOiBzdHJpbmcsIGNsczogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGA8c3BhbiBjbGFzcz1cImJzLXBhYi1zdGF0JHtjbHMgPyAnICcgKyBjbHMgOiAnJ31cIiBpZD1cInN0YXQtJHtpZH1cIj48c3BhbiBjbGFzcz1cImJzLXBhYi1zdGF0LW51bVwiPiR7bnVtfTwvc3Bhbj4gJHtlc2MobGFiZWwpfTwvc3Bhbj5gO1xufVxuZnVuY3Rpb24gYnVpbGRlckhlYWRlcih0OiBBcHBUZW1wbGF0ZSk6IHN0cmluZyB7XG4gIGNvbnN0IGMgPSBzdGF0Q291bnRzKHQpO1xuICBjb25zdCBwdWIgPSBCVUlMREVSLmxhc3RQdWJsaXNoZWQgPyAoJ1B1Ymxpc2hlZCAnICsgZm10U3RhbXAoQlVJTERFUi5sYXN0UHVibGlzaGVkKSkgOiAnTm90IHB1Ymxpc2hlZCB5ZXQnO1xuICBjb25zdCBkaXJ0eSA9IEJVSUxERVIuZGlydHkgPyAnVW5zYXZlZCBjaGFuZ2VzJyA6IChCVUlMREVSLmxhc3RVcGRhdGVkID8gJ1NhdmVkJyA6ICcnKTtcbiAgY29uc3QgYnVzeSA9IEJVSUxERVIuYnVzeSA/ICcgZGlzYWJsZWQnIDogJyc7XG4gIGNvbnN0IGRpdiA9ICc8c3BhbiBjbGFzcz1cImJzLXBhYi1zdGF0LWRpdmlkZXJcIj48L3NwYW4+JztcbiAgcmV0dXJuIGA8aGVhZGVyIGNsYXNzPVwiYnMtcGFiLWhlYWRlclwiPlxuICAgIDxkaXYgY2xhc3M9XCJicy1wYWItaGVhZGVyLWxlZnRcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJicy1wYWItbG9nby1tYXJrXCI+XHUyQjIxPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiYnMtcGFiLXRpdGxlLWJsb2NrXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJicy1wYWItbWFpbi10aXRsZVwiPiR7ZXNjKHQudGl0bGUgfHwgJ0FwcGxpY2F0aW9uIEJ1aWxkZXInKX08L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImJzLXBhYi1tYWluLXN1YnRpdGxlXCI+JHtlc2MocHViKX08L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJicy1wYWItaGVhZGVyLWNlbnRlclwiPlxuICAgICAgPGRpdiBjbGFzcz1cImJzLXBhYi1zdGF0dXMtYmFyXCI+XG4gICAgICAgICR7YnVpbGRlclN0YXRTcGFuKCd0b3RhbCcsIGMudG90YWwsICdmaWVsZHMnLCAnJyl9JHtkaXZ9XG4gICAgICAgICR7YnVpbGRlclN0YXRTcGFuKCd1bm1hcHBlZCcsIGMudW5tYXBwZWQsICd1bm1hcHBlZCcsIGMudW5tYXBwZWQgPyAnYnMtcGFiLXN0YXQtd2FybicgOiAnJyl9JHtkaXZ9XG4gICAgICAgICR7YnVpbGRlclN0YXRTcGFuKCdyZXF1aXJlZCcsIGMucmVxdWlyZWQsICdyZXF1aXJlZCcsICdicy1wYWItc3RhdC1yZXEnKX0ke2Rpdn1cbiAgICAgICAgJHtidWlsZGVyU3RhdFNwYW4oJ2NvbmRpdGlvbmFsJywgYy5jb25kaXRpb25hbCwgJ2NvbmRpdGlvbmFsJywgJycpfSR7ZGl2fVxuICAgICAgICAke2J1aWxkZXJTdGF0U3BhbignaW5hY3RpdmUnLCBjLmluYWN0aXZlLCAnaW5hY3RpdmUnLCAnYnMtcGFiLXN0YXQtbXV0ZWQnKX1cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJicy1wYWItaGVhZGVyLXJpZ2h0XCI+XG4gICAgICA8c3BhbiBjbGFzcz1cImJzLXBhYi1kaXJ0eVwiIGlkPVwicGFiLWRpcnR5XCI+JHtlc2MoZGlydHkpfTwvc3Bhbj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJicy1wYWItYnRuIGJzLXBhYi1idG4tZ2hvc3RcIiBvbmNsaWNrPVwiYnVpbGRlckZvcm1TZXR0aW5ncygpXCIgdGl0bGU9XCJGb3JtIHNldHRpbmdzXCI+XHUyNjk5IFNldHRpbmdzPC9idXR0b24+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnMtcGFiLWJ0biBicy1wYWItYnRuLWdob3N0XCIgb25jbGljaz1cImJ1aWxkZXJPcGVuTG9naWMoKVwiIHRpdGxlPVwiVmlldyBhbGwgbG9naWMgcnVsZXNcIj5cdTIyNjMgTG9naWM8L2J1dHRvbj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJicy1wYWItYnRuIGJzLXBhYi1idG4tb3V0bGluZVwiIGlkPVwicGFiLXNhdmVcIiBvbmNsaWNrPVwiYnVpbGRlclNhdmUoKVwiJHtidXN5fT5cdUQ4M0RcdURDQkUgU2F2ZSBEcmFmdDwvYnV0dG9uPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJzLXBhYi1idG4gYnMtcGFiLWJ0bi1wcmltYXJ5XCIgaWQ9XCJwYWItcHVibGlzaFwiIG9uY2xpY2s9XCJidWlsZGVyUHVibGlzaCgpXCIke2J1c3l9Plx1RDgzRFx1REU4MCBQdWJsaXNoPC9idXR0b24+XG4gICAgPC9kaXY+XG4gIDwvaGVhZGVyPmA7XG59XG5cbi8qIC0tLS0gbmF2aWdhdG9yIChsZWZ0KSAtLS0tICovXG5mdW5jdGlvbiBidWlsZGVyTmF2KHQ6IEFwcFRlbXBsYXRlKTogc3RyaW5nIHtcbiAgcmV0dXJuIGA8YXNpZGUgY2xhc3M9XCJicy1wYWItbmF2XCI+XG4gICAgPGRpdiBjbGFzcz1cImJzLXBhYi1uYXYtaGVhZGVyXCI+XG4gICAgICA8c3BhbiBjbGFzcz1cImJzLXBhYi1uYXYtdGl0bGVcIj5OYXZpZ2F0b3I8L3NwYW4+XG4gICAgICA8ZGl2IGNsYXNzPVwiYnMtcGFiLW5hdi1oZWFkZXItYWN0aW9uc1wiPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnMtcGFiLWFkZC1maWVsZC1idG5cIiBvbmNsaWNrPVwiYnVpbGRlck9wZW5QaWNrZXIoKVwiPjxzcGFuIGNsYXNzPVwiYnMtcGFiLWFkZC1maWVsZC1wbHVzXCI+Kzwvc3Bhbj4gQWRkIEZpZWxkPC9idXR0b24+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJicy1wYWItaWNvbi1idG5cIiB0aXRsZT1cIkNvbGxhcHNlIGFsbCBzZWN0aW9uc1wiIG9uY2xpY2s9XCJidWlsZGVyQ29sbGFwc2VBbGwoKVwiPlx1MjI5RjwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cImJzLXBhYi1uYXYtc2VhcmNoLXdyYXBcIj5cbiAgICAgIDxpbnB1dCBjbGFzcz1cImJzLXBhYi1uYXYtc2VhcmNoXCIgaWQ9XCJwYWItbmF2LXNlYXJjaFwiIHR5cGU9XCJ0ZXh0XCIgcGxhY2Vob2xkZXI9XCJTZWFyY2ggZmllbGRzXHUyMDI2XCIgdmFsdWU9XCIke2VzYyhCVUlMREVSLm5hdlF1ZXJ5KX1cIiBvbmlucHV0PVwiYnVpbGRlck5hdlNlYXJjaElucHV0KHRoaXMudmFsdWUpXCIgYXV0b2NvbXBsZXRlPVwib2ZmXCI+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cImJzLXBhYi1uYXYtbGlzdFwiIGlkPVwicGFiLW5hdi1saXN0XCI+JHtidWlsZGVyTmF2TGlzdCh0KX08L2Rpdj5cbiAgPC9hc2lkZT5gO1xufVxuZnVuY3Rpb24gYnVpbGRlck5hdkxpc3QodDogQXBwVGVtcGxhdGUpOiBzdHJpbmcge1xuICBpZiAoIXQuZmllbGRzLmxlbmd0aCkgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiYnMtcGFiLWVtcHR5LXN0YXRlXCIgc3R5bGU9XCJwYWRkaW5nOjE4cHggMTJweFwiPjxzdHJvbmc+Tm8gZmllbGRzIHlldDwvc3Ryb25nPlVzZSA8ZW0+QWRkIEZpZWxkPC9lbT4gYWJvdmUuPC9kaXY+YDtcbiAgY29uc3QgZmlsdGVyID0gQlVJTERFUi5uYXZRdWVyeS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgY29uc3QgZ3JvdXBzID0gZ3JvdXBTZWN0aW9ucyh0LmZpZWxkcyk7XG4gIGxldCBodG1sID0gJyc7XG4gIGZvciAoY29uc3QgZyBvZiBncm91cHMpIHtcbiAgICBjb25zdCBzaWQgPSBnLmhlYWRlciA/IGcuaGVhZGVyLmlkIDogJ19fb3JwaGFuX18nO1xuICAgIGNvbnN0IGNvbGxhcHNlZCA9ICEhQlVJTERFUi5jb2xsYXBzZWRbc2lkXTtcbiAgICBjb25zdCBtYXRjaGVkID0gZy5pdGVtcy5maWx0ZXIoaXQgPT4gaXQuZmllbGQudHlwZSAhPT0gJ2hlYWRlcicgJiYgKCFmaWx0ZXIgfHwgZmllbGRQcmV2aWV3TGFiZWwoaXQuZmllbGQpLnRvTG93ZXJDYXNlKCkuaW5kZXhPZihmaWx0ZXIpID49IDApKTtcbiAgICBjb25zdCBsYWJlbCA9IGcuaGVhZGVyID8gKGcuaGVhZGVyLmxhYmVsIHx8ICdVbnRpdGxlZCBTZWN0aW9uJykgOiAnVW5ncm91cGVkJztcbiAgICBjb25zdCBoZWFkZXJNYXRjaCA9ICFmaWx0ZXIgfHwgbGFiZWwudG9Mb3dlckNhc2UoKS5pbmRleE9mKGZpbHRlcikgPj0gMDtcbiAgICBpZiAoZmlsdGVyICYmICFoZWFkZXJNYXRjaCAmJiAhbWF0Y2hlZC5sZW5ndGgpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHRvU2hvdyA9IGZpbHRlciA/IG1hdGNoZWQgOiBnLml0ZW1zLmZpbHRlcihpdCA9PiBpdC5maWVsZC50eXBlICE9PSAnaGVhZGVyJyk7XG4gICAgY29uc3QgaXRlbXMgPSB0b1Nob3cubWFwKGl0ID0+IHtcbiAgICAgIGNvbnN0IGYgPSBpdC5maWVsZDtcbiAgICAgIGNvbnN0IGFjdGl2ZSA9IEJVSUxERVIuc2VsZWN0ZWRJZCA9PT0gZi5pZCA/ICcgYWN0aXZlJyA6ICcnO1xuICAgICAgY29uc3QgcmVxID0gZi5yZXF1aXJlZCA/ICcgYnMtcGFiLW5hdi1pdGVtLXJlcScgOiAnJztcbiAgICAgIHJldHVybiBgPGRpdiBjbGFzcz1cImJzLXBhYi1uYXYtaXRlbSR7YWN0aXZlfSR7cmVxfVwiIG9uY2xpY2s9XCJidWlsZGVyU2VsZWN0KCcke2VzYyhmLmlkKX0nKVwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiYnMtcGFiLW5hdi1pdGVtLWRvdFwiPjwvZGl2PlxuICAgICAgICA8c3BhbiBjbGFzcz1cImJzLXBhYi1uYXYtaXRlbS1sYWJlbFwiPiR7ZXNjKGZpZWxkUHJldmlld0xhYmVsKGYpKX08L3NwYW4+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwiYnMtcGFiLW5hdi1pdGVtLXR5cGVcIj4ke2VzYyhmaWVsZFR5cGVNZXRhKGYudHlwZSkubGFiZWwpfTwvc3Bhbj5cbiAgICAgIDwvZGl2PmA7XG4gICAgfSkuam9pbignJyk7XG4gICAgaWYgKGcuaGVhZGVyKSB7XG4gICAgICBjb25zdCBjb3VudCA9IGZpbHRlciA/IG1hdGNoZWQubGVuZ3RoIDogZy5pdGVtcy5maWx0ZXIoaXQgPT4gaXQuZmllbGQudHlwZSAhPT0gJ2hlYWRlcicpLmxlbmd0aDtcbiAgICAgIGh0bWwgKz0gYDxkaXYgY2xhc3M9XCJicy1wYWItbmF2LXNlY3Rpb25cIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImJzLXBhYi1uYXYtc2VjdGlvbi1oZWFkZXIke2NvbGxhcHNlZCA/ICcgY29sbGFwc2VkJyA6ICcnfVwiIG9uY2xpY2s9XCJidWlsZGVyVG9nZ2xlU2VjdGlvbignJHtlc2Moc2lkKX0nKVwiPlxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwiYnMtcGFiLW5hdi1zZWN0aW9uLWFycm93XCI+XHUyNUJDPC9zcGFuPlxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwiYnMtcGFiLW5hdi1zZWN0aW9uLWxhYmVsXCIgb25jbGljaz1cImV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO2J1aWxkZXJTZWxlY3QoJyR7ZXNjKGcuaGVhZGVyLmlkKX0nKVwiPiR7ZXNjKGxhYmVsKX08L3NwYW4+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJicy1wYWItbmF2LXNlY3Rpb24tY291bnRcIj4ke2NvdW50fTwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJicy1wYWItbmF2LWl0ZW1zJHtjb2xsYXBzZWQgPyAnIGNvbGxhcHNlZCcgOiAnJ31cIj4ke2l0ZW1zfTwvZGl2PlxuICAgICAgPC9kaXY+YDtcbiAgICB9IGVsc2Uge1xuICAgICAgaHRtbCArPSBgPGRpdiBjbGFzcz1cImJzLXBhYi1uYXYtc2VjdGlvbiBicy1wYWItbmF2LXVuc2VjdGlvbmVkXCI+PGRpdiBjbGFzcz1cImJzLXBhYi1uYXYtaXRlbXNcIj4ke2l0ZW1zfTwvZGl2PjwvZGl2PmA7XG4gICAgfVxuICB9XG4gIHJldHVybiBodG1sO1xufVxuXG4vKiAtLS0tIGNhbnZhcyAobWlkZGxlKSAtLS0tICovXG5mdW5jdGlvbiBidWlsZGVyQ2FudmFzV3JhcCh0OiBBcHBUZW1wbGF0ZSk6IHN0cmluZyB7XG4gIHJldHVybiBgPG1haW4gY2xhc3M9XCJicy1wYWItY2FudmFzLXdyYXBcIj5cbiAgICA8ZGl2IGNsYXNzPVwiYnMtcGFiLWNhbnZhcy10b29sYmFyXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiYnMtcGFiLWNhbnZhcy1zZWFyY2gtd3JhcFwiPlxuICAgICAgICA8aW5wdXQgY2xhc3M9XCJicy1wYWItY2FudmFzLXNlYXJjaFwiIGlkPVwicGFiLWNhbnZhcy1zZWFyY2hcIiB0eXBlPVwidGV4dFwiIHBsYWNlaG9sZGVyPVwiRmlsdGVyIGZpZWxkcyBvbiBjYW52YXNcdTIwMjZcIiB2YWx1ZT1cIiR7ZXNjKEJVSUxERVIuY2FudmFzUXVlcnkpfVwiIG9uaW5wdXQ9XCJidWlsZGVyQ2FudmFzRmlsdGVySW5wdXQodGhpcy52YWx1ZSlcIiBhdXRvY29tcGxldGU9XCJvZmZcIj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImJzLXBhYi12aWV3LXRvZ2dsZVwiPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnMtcGFiLXZpZXctYnRuJHshQlVJTERFUi5jb21wYWN0ID8gJyBicy1wYWItdmlldy1hY3RpdmUnIDogJyd9XCIgdGl0bGU9XCJOb3JtYWwgdmlld1wiIG9uY2xpY2s9XCJidWlsZGVyU2V0VmlldyhmYWxzZSlcIj5cdTI2MzA8L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJzLXBhYi12aWV3LWJ0biR7QlVJTERFUi5jb21wYWN0ID8gJyBicy1wYWItdmlldy1hY3RpdmUnIDogJyd9XCIgdGl0bGU9XCJDb21wYWN0IHZpZXdcIiBvbmNsaWNrPVwiYnVpbGRlclNldFZpZXcodHJ1ZSlcIj5cdTIyNjE8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJicy1wYWItY2FudmFzJHtCVUlMREVSLmNvbXBhY3QgPyAnIGNvbXBhY3QnIDogJyd9XCIgaWQ9XCJwYWItY2FudmFzXCI+JHtidWlsZGVyQ2FudmFzKHQpfTwvZGl2PlxuICA8L21haW4+YDtcbn1cbmZ1bmN0aW9uIGJ1aWxkZXJDYW52YXModDogQXBwVGVtcGxhdGUpOiBzdHJpbmcge1xuICBpZiAoIXQuZmllbGRzLmxlbmd0aCkge1xuICAgIHJldHVybiBgPGRpdiBjbGFzcz1cImJzLXBhYi1lbXB0eS1zdGF0ZVwiPjxzdHJvbmc+Tm8gZmllbGRzIHlldDwvc3Ryb25nPkNsaWNrIDxlbT5BZGQgRmllbGQ8L2VtPiBpbiB0aGUgbmF2aWdhdG9yIHRvIGdldCBzdGFydGVkLjwvZGl2PmA7XG4gIH1cbiAgY29uc3QgZmlsdGVyID0gQlVJTERFUi5jYW52YXNRdWVyeS50b0xvd2VyQ2FzZSgpLnRyaW0oKTtcbiAgY29uc3QgZ3JvdXBzID0gZ3JvdXBTZWN0aW9ucyh0LmZpZWxkcyk7XG4gIGxldCBodG1sID0gJyc7XG4gIGZvciAoY29uc3QgZyBvZiBncm91cHMpIHtcbiAgICBjb25zdCBzaWQgPSBnLmhlYWRlciA/IGcuaGVhZGVyLmlkIDogJ19fb3JwaGFuX18nO1xuICAgIGNvbnN0IGNvbGxhcHNlZCA9ICEhQlVJTERFUi5jb2xsYXBzZWRbc2lkXTtcbiAgICBjb25zdCBtYXRjaGVkID0gZy5pdGVtcy5maWx0ZXIoaXQgPT4gIWZpbHRlciB8fCBmaWVsZFByZXZpZXdMYWJlbChpdC5maWVsZCkudG9Mb3dlckNhc2UoKS5pbmRleE9mKGZpbHRlcikgPj0gMCk7XG4gICAgY29uc3QgaGVhZGVyTWF0Y2ggPSAhZmlsdGVyIHx8IChnLmhlYWRlciAmJiAoZy5oZWFkZXIubGFiZWwgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5kZXhPZihmaWx0ZXIpID49IDApO1xuICAgIGlmIChmaWx0ZXIgJiYgIWhlYWRlck1hdGNoICYmICFtYXRjaGVkLmxlbmd0aCkgY29udGludWU7XG4gICAgY29uc3QgdG9SZW5kZXIgPSBmaWx0ZXIgPyBtYXRjaGVkIDogZy5pdGVtcztcbiAgICBodG1sICs9IGA8ZGl2IGNsYXNzPVwiYnMtcGFiLXNlY3Rpb24tZ3JvdXBcIj5gO1xuICAgIGlmIChnLmhlYWRlcikgaHRtbCArPSBidWlsZGVyU2VjdGlvbkhlYWRlckNhcmQoZy5oZWFkZXIsIGZpbHRlciA/IG1hdGNoZWQubGVuZ3RoIDogZy5pdGVtcy5sZW5ndGgsIGNvbGxhcHNlZCk7XG4gICAgaHRtbCArPSBgPGRpdiBjbGFzcz1cImJzLXBhYi1zZWN0aW9uLWJvZHkke2NvbGxhcHNlZCA/ICcgY29sbGFwc2VkJyA6ICcnfVwiPjxkaXYgY2xhc3M9XCJicy1wYWItZmllbGQtbGlzdFwiPmA7XG4gICAgaHRtbCArPSB0b1JlbmRlci5tYXAoaXQgPT4gYnVpbGRlckZpZWxkQ2FyZChpdC5maWVsZCkpLmpvaW4oJycpO1xuICAgIGh0bWwgKz0gYDwvZGl2PjwvZGl2PjwvZGl2PmA7XG4gIH1cbiAgcmV0dXJuIGh0bWw7XG59XG5mdW5jdGlvbiBidWlsZGVyU2VjdGlvbkhlYWRlckNhcmQoZjogQXBwRmllbGQsIGNvdW50OiBudW1iZXIsIGNvbGxhcHNlZDogYm9vbGVhbik6IHN0cmluZyB7XG4gIGNvbnN0IHNlbCA9IEJVSUxERVIuc2VsZWN0ZWRJZCA9PT0gZi5pZCA/ICcgYnMtcGFiLWZpZWxkLXNlbGVjdGVkJyA6ICcnO1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJicy1wYWItc2VjdGlvbi1oZWFkZXItY2FyZCR7c2VsfVwiIGRyYWdnYWJsZT1cInRydWVcIiBkYXRhLWZpZD1cIiR7ZXNjKGYuaWQpfVwiXG4gICAgICBvbmRyYWdzdGFydD1cImJ1aWxkZXJEcmFnU3RhcnQoZXZlbnQsJyR7ZXNjKGYuaWQpfScpXCIgb25kcmFnb3Zlcj1cImJ1aWxkZXJEcmFnT3ZlcihldmVudClcIiBvbmRyb3A9XCJidWlsZGVyRHJvcChldmVudCwnJHtlc2MoZi5pZCl9JylcIiBvbmRyYWdlbmQ9XCJidWlsZGVyRHJhZ0VuZCgpXCJcbiAgICAgIG9uY2xpY2s9XCJidWlsZGVyT3Blbkluc3BlY3RvcignJHtlc2MoZi5pZCl9JylcIj5cbiAgICA8YnV0dG9uIGNsYXNzPVwiYnMtcGFiLXNlY3Rpb24tY29sbGFwc2UtYnRuJHtjb2xsYXBzZWQgPyAnIGNvbGxhcHNlZCcgOiAnJ31cIiB0aXRsZT1cIlRvZ2dsZSBzZWN0aW9uXCIgb25jbGljaz1cImV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO2J1aWxkZXJUb2dnbGVTZWN0aW9uKCcke2VzYyhmLmlkKX0nKVwiPlx1MjVCQzwvYnV0dG9uPlxuICAgIDxzcGFuIGNsYXNzPVwiYnMtcGFiLXNlY3Rpb24tZHJhZy1oYW5kbGVcIiB0aXRsZT1cIkRyYWcgdG8gcmVvcmRlclwiPlx1MjgzRjwvc3Bhbj5cbiAgICA8c3BhbiBjbGFzcz1cImJzLXBhYi1zZWN0aW9uLWxhYmVsXCIgZGF0YS1maWQtbGFiZWw9XCIke2VzYyhmLmlkKX1cIj4ke2VzYyhmLmxhYmVsIHx8ICdVbnRpdGxlZCBTZWN0aW9uJyl9PC9zcGFuPlxuICAgIDxzcGFuIGNsYXNzPVwiYnMtcGFiLXNlY3Rpb24tbWV0YVwiPiR7Y291bnR9IGZpZWxkJHtjb3VudCAhPT0gMSA/ICdzJyA6ICcnfTwvc3Bhbj5cbiAgICA8ZGl2IGNsYXNzPVwiYnMtcGFiLXNlY3Rpb24tZmllbGQtYWN0aW9uc1wiPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJzLXBhYi1pY29uLWJ0blwiIHRpdGxlPVwiRHVwbGljYXRlXCIgb25jbGljaz1cImV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO2J1aWxkZXJEdXBsaWNhdGUoJyR7ZXNjKGYuaWQpfScpXCI+XHUyOUM5PC9idXR0b24+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnMtcGFiLWljb24tYnRuIGJzLXBhYi1pY29uLWJ0bi1kYW5nZXJcIiB0aXRsZT1cIkRlbGV0ZSBzZWN0aW9uXCIgb25jbGljaz1cImV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO2J1aWxkZXJEZWxldGUoJyR7ZXNjKGYuaWQpfScpXCI+XHVEODNEXHVEREQxPC9idXR0b24+XG4gICAgPC9kaXY+XG4gIDwvZGl2PmA7XG59XG5mdW5jdGlvbiBmaWVsZENhcmRIaW50KGY6IEFwcEZpZWxkKTogc3RyaW5nIHtcbiAgaWYgKCFmLmFjdGl2ZSkgcmV0dXJuICdIaWRkZW4gXHUyMDE0IGtlcHQgZm9yIGhpc3RvcmljYWwgZGF0YSc7XG4gIGlmIChmLnZpc2liaWxpdHkgJiYgZi52aXNpYmlsaXR5LnNvdXJjZUZpZWxkSWQpIHJldHVybiAnU2hvd24gY29uZGl0aW9uYWxseSc7XG4gIGlmIChmLm1hcFRvKSB7IGNvbnN0IG8gPSBNQVBfVE9fT1BUSU9OUy5maWx0ZXIoeCA9PiB4LnZhbHVlID09PSBmLm1hcFRvKVswXTsgcmV0dXJuIG8gPyBvLmxhYmVsIDogZi5tYXBUbzsgfVxuICBpZiAoZi50eXBlID09PSAnc3RhdGljX3RleHQnKSByZXR1cm4gJyc7XG4gIHJldHVybiAnTm90IG1hcHBlZCc7XG59XG5mdW5jdGlvbiBmaWVsZEJhZGdlcyhmOiBBcHBGaWVsZCk6IHN0cmluZyB7XG4gIGNvbnN0IGI6IHN0cmluZ1tdID0gW107XG4gIGlmIChmLnJlcXVpcmVkICYmICFpc0Rpc3BsYXlUeXBlKGYudHlwZSkpIGIucHVzaCgnPHNwYW4gY2xhc3M9XCJicy1wYWItYmFkZ2UtcGlsbCBicy1wYWItYmFkZ2UtcmVxXCI+UmVxPC9zcGFuPicpO1xuICBpZiAoZi52aXNpYmlsaXR5ICYmIGYudmlzaWJpbGl0eS5zb3VyY2VGaWVsZElkKSBiLnB1c2goJzxzcGFuIGNsYXNzPVwiYnMtcGFiLWJhZGdlLXBpbGwgYnMtcGFiLWJhZGdlLWNvbmRcIj5Db25kPC9zcGFuPicpO1xuICBpZiAoZi5tYXBUbykgYi5wdXNoKCc8c3BhbiBjbGFzcz1cImJzLXBhYi1iYWRnZS1waWxsIGJzLXBhYi1iYWRnZS1tYXBwZWRcIj5NYXBwZWQ8L3NwYW4+Jyk7XG4gIGlmICghZi5hY3RpdmUpIGIucHVzaCgnPHNwYW4gY2xhc3M9XCJicy1wYWItYmFkZ2UtcGlsbCBicy1wYWItYmFkZ2UtaW5hY3RpdmVcIj5PZmY8L3NwYW4+Jyk7XG4gIHJldHVybiBiLmpvaW4oJycpO1xufVxuZnVuY3Rpb24gYnVpbGRlckZpZWxkQ2FyZChmOiBBcHBGaWVsZCk6IHN0cmluZyB7XG4gIGNvbnN0IHNlbCA9IEJVSUxERVIuc2VsZWN0ZWRJZCA9PT0gZi5pZDtcbiAgY29uc3QgaGludCA9IGZpZWxkQ2FyZEhpbnQoZik7XG4gIHJldHVybiBgPGRpdiBjbGFzcz1cImJzLXBhYi1maWVsZC1jYXJkJHtzZWwgPyAnIGJzLXBhYi1maWVsZC1zZWxlY3RlZCcgOiAnJ30keyFmLmFjdGl2ZSA/ICcgYnMtcGFiLWZpZWxkLWluYWN0aXZlJyA6ICcnfVwiIGRyYWdnYWJsZT1cInRydWVcIiBkYXRhLWZpZD1cIiR7ZXNjKGYuaWQpfVwiXG4gICAgICBvbmRyYWdzdGFydD1cImJ1aWxkZXJEcmFnU3RhcnQoZXZlbnQsJyR7ZXNjKGYuaWQpfScpXCIgb25kcmFnb3Zlcj1cImJ1aWxkZXJEcmFnT3ZlcihldmVudClcIiBvbmRyb3A9XCJidWlsZGVyRHJvcChldmVudCwnJHtlc2MoZi5pZCl9JylcIiBvbmRyYWdlbmQ9XCJidWlsZGVyRHJhZ0VuZCgpXCJcbiAgICAgIG9uY2xpY2s9XCJidWlsZGVyU2VsZWN0KCcke2VzYyhmLmlkKX0nKVwiPlxuICAgIDxkaXYgY2xhc3M9XCJicy1wYWItZmllbGQtcm93XCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiYnMtcGFiLWZpZWxkLWhhbmRsZVwiPjxkaXYgY2xhc3M9XCJicy1wYWItaGFuZGxlLWxpbmVcIj48L2Rpdj48ZGl2IGNsYXNzPVwiYnMtcGFiLWhhbmRsZS1saW5lXCI+PC9kaXY+PGRpdiBjbGFzcz1cImJzLXBhYi1oYW5kbGUtbGluZVwiPjwvZGl2PjwvZGl2PlxuICAgICAgPHNwYW4gY2xhc3M9XCJicy1wYWItZmllbGQtdHlwZS1waWxsIGJzLXBhYi10eXBlLSR7ZXNjKGYudHlwZSl9XCI+JHtlc2MoZmllbGRUeXBlTWV0YShmLnR5cGUpLmxhYmVsKX08L3NwYW4+XG4gICAgICA8ZGl2IGNsYXNzPVwiYnMtcGFiLWZpZWxkLW1haW5cIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImJzLXBhYi1maWVsZC1sYWJlbC10ZXh0XCIgZGF0YS1maWQtbGFiZWw9XCIke2VzYyhmLmlkKX1cIj4ke2VzYyhmaWVsZFByZXZpZXdMYWJlbChmKSl9PC9kaXY+XG4gICAgICAgICR7aGludCA/IGA8ZGl2IGNsYXNzPVwiYnMtcGFiLWZpZWxkLWhpbnRcIj4ke2VzYyhoaW50KX08L2Rpdj5gIDogJyd9XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJicy1wYWItZmllbGQtYmFkZ2VzXCI+JHtmaWVsZEJhZGdlcyhmKX08L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJicy1wYWItZmllbGQtcm93LWFjdGlvbnNcIj5cbiAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJzLXBhYi1pY29uLWJ0blwiIHRpdGxlPVwiRHVwbGljYXRlXCIgb25jbGljaz1cImV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO2J1aWxkZXJEdXBsaWNhdGUoJyR7ZXNjKGYuaWQpfScpXCI+XHUyOUM5PC9idXR0b24+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJicy1wYWItaWNvbi1idG4gYnMtcGFiLWljb24tYnRuLWRhbmdlclwiIHRpdGxlPVwiRGVsZXRlXCIgb25jbGljaz1cImV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO2J1aWxkZXJEZWxldGUoJyR7ZXNjKGYuaWQpfScpXCI+XHVEODNEXHVEREQxPC9idXR0b24+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgICAke3NlbCA/IGJ1aWxkZXJJbmxpbmVFZGl0b3IoZikgOiAnJ31cbiAgPC9kaXY+YDtcbn1cbi8vIElubGluZSBxdWljay1lZGl0IHNob3duIHVuZGVyIHRoZSBzZWxlY3RlZCBjYXJkOiBsYWJlbCArIG1hcC10bywgcmVxdWlyZWQvYWN0aXZlXG4vLyB0b2dnbGVzLCBhbmQgYSBsaW5rIGludG8gdGhlIGZ1bGwgaW5zcGVjdG9yLiBNaXJyb3JzIHRoZSByZWZlcmVuY2UncyBjYXJkIGVkaXRvci5cbmZ1bmN0aW9uIGJ1aWxkZXJJbmxpbmVFZGl0b3IoZjogQXBwRmllbGQpOiBzdHJpbmcge1xuICBjb25zdCBhbnN3ZXJhYmxlID0gIWlzRGlzcGxheVR5cGUoZi50eXBlKTtcbiAgbGV0IGxhYmVsR3JvdXA6IHN0cmluZztcbiAgaWYgKGYudHlwZSA9PT0gJ3N0YXRpY190ZXh0Jykge1xuICAgIGxhYmVsR3JvdXAgPSBgPGRpdiBjbGFzcz1cImJzLXBhYi1pbmxpbmUtZ3JvdXAgYnMtcGFiLWlubGluZS1ncm91cC1mbGV4XCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiYnMtcGFiLWlubGluZS1sYWJlbFwiPkluc3RydWN0aW9ucyB0ZXh0PC9kaXY+XG4gICAgICA8dGV4dGFyZWEgY2xhc3M9XCJicy1wYWItaW5saW5lLWlucHV0XCIgc3R5bGU9XCJtaW4taGVpZ2h0OjUycHg7cmVzaXplOnZlcnRpY2FsXCIgb25pbnB1dD1cImJ1aWxkZXJTZXRQcm9wKCcke2VzYyhmLmlkKX0nLCdjb250ZW50Jyx0aGlzLnZhbHVlKVwiPiR7ZXNjKGYuc2V0dGluZ3MuY29udGVudCB8fCAnJyl9PC90ZXh0YXJlYT5cbiAgICA8L2Rpdj5gO1xuICB9IGVsc2Uge1xuICAgIGxhYmVsR3JvdXAgPSBgPGRpdiBjbGFzcz1cImJzLXBhYi1pbmxpbmUtZ3JvdXAgYnMtcGFiLWlubGluZS1ncm91cC1mbGV4XCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiYnMtcGFiLWlubGluZS1sYWJlbFwiPiR7Zi50eXBlID09PSAnaGVhZGVyJyA/ICdTZWN0aW9uIHRpdGxlJyA6ICdRdWVzdGlvbiBsYWJlbCd9PC9kaXY+XG4gICAgICA8aW5wdXQgY2xhc3M9XCJicy1wYWItaW5saW5lLWlucHV0XCIgdmFsdWU9XCIke2VzYyhmLmxhYmVsIHx8ICcnKX1cIiBvbmlucHV0PVwiYnVpbGRlclNldFByb3AoJyR7ZXNjKGYuaWQpfScsJ2xhYmVsJyx0aGlzLnZhbHVlKVwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiPlxuICAgIDwvZGl2PmA7XG4gIH1cbiAgbGV0IG1hcEdyb3VwID0gJyc7XG4gIGlmIChhbnN3ZXJhYmxlKSB7XG4gICAgY29uc3Qgb3B0cyA9IE1BUF9UT19PUFRJT05TLm1hcChvID0+IGA8b3B0aW9uIHZhbHVlPVwiJHtlc2Moby52YWx1ZSl9XCIke28udmFsdWUgPT09IGYubWFwVG8gPyAnIHNlbGVjdGVkJyA6ICcnfT4ke2VzYyhvLmxhYmVsKX08L29wdGlvbj5gKS5qb2luKCcnKTtcbiAgICBtYXBHcm91cCA9IGA8ZGl2IGNsYXNzPVwiYnMtcGFiLWlubGluZS1ncm91cCBicy1wYWItaW5saW5lLWdyb3VwLWZpeGVkXCIgc3R5bGU9XCJmbGV4OjAgMCAxODBweDttaW4td2lkdGg6MTgwcHhcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJicy1wYWItaW5saW5lLWxhYmVsXCI+TWFwIHRvPC9kaXY+XG4gICAgICA8c2VsZWN0IGNsYXNzPVwiYnMtcGFiLWlubGluZS1zZWxlY3RcIiBvbmNoYW5nZT1cImJ1aWxkZXJTZXRQcm9wKCcke2VzYyhmLmlkKX0nLCdtYXBUbycsdGhpcy52YWx1ZSlcIj4ke29wdHN9PC9zZWxlY3Q+XG4gICAgPC9kaXY+YDtcbiAgfVxuICBjb25zdCB0b2dnbGUgPSAocHJvcDogJ3JlcXVpcmVkJyB8ICdhY3RpdmUnLCBsYWJlbDogc3RyaW5nLCBvbjogYm9vbGVhbikgPT5cbiAgICBgPGRpdiBjbGFzcz1cImJzLXBhYi1pbmxpbmUtdG9nZ2xlLWl0ZW1cIiBvbmNsaWNrPVwiYnVpbGRlclNldEJvb2woJyR7ZXNjKGYuaWQpfScsJyR7cHJvcH0nLCR7b24gPyAnZmFsc2UnIDogJ3RydWUnfSlcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJicy1wYWItdG9nZ2xlLXBpbGwke29uID8gJyBicy1wYWItdG9nZ2xlLW9uJyA6ICcnfVwiPjwvZGl2PlxuICAgICAgPHNwYW4gY2xhc3M9XCJicy1wYWItdG9nZ2xlLWxhYmVsXCI+JHtlc2MobGFiZWwpfTwvc3Bhbj5cbiAgICA8L2Rpdj5gO1xuICBsZXQgdG9nZ2xlcyA9ICcnO1xuICBpZiAoYW5zd2VyYWJsZSkgdG9nZ2xlcyA9IGA8ZGl2IGNsYXNzPVwiYnMtcGFiLWlubGluZS10b2dnbGVzXCI+JHt0b2dnbGUoJ3JlcXVpcmVkJywgJ1JlcXVpcmVkJywgZi5yZXF1aXJlZCl9JHt0b2dnbGUoJ2FjdGl2ZScsICdBY3RpdmUnLCBmLmFjdGl2ZSl9PC9kaXY+YDtcbiAgZWxzZSBpZiAoZi50eXBlID09PSAnaGVhZGVyJykgdG9nZ2xlcyA9IGA8ZGl2IGNsYXNzPVwiYnMtcGFiLWlubGluZS10b2dnbGVzXCI+JHt0b2dnbGUoJ2FjdGl2ZScsICdBY3RpdmUnLCBmLmFjdGl2ZSl9PC9kaXY+YDtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiYnMtcGFiLWlubGluZS1lZGl0b3JcIiBvbmNsaWNrPVwiZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcIj5cbiAgICA8ZGl2IGNsYXNzPVwiYnMtcGFiLWlubGluZS1yb3dcIj4ke2xhYmVsR3JvdXB9JHttYXBHcm91cH08L2Rpdj5cbiAgICAke3RvZ2dsZXN9XG4gICAgPGJ1dHRvbiBjbGFzcz1cImJzLXBhYi1pbmxpbmUtbW9yZS1idG5cIiBvbmNsaWNrPVwiZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7YnVpbGRlck9wZW5JbnNwZWN0b3IoJyR7ZXNjKGYuaWQpfScpXCI+TW9yZSBzZXR0aW5ncyAoZGVzY3JpcHRpb24sIGxvZ2ljLCB0eXBlIG9wdGlvbnMpIFx1MjE5MjwvYnV0dG9uPlxuICA8L2Rpdj5gO1xufVxuXG4vKiAtLS0tIGluc3BlY3RvciAocmlnaHQsIHNsaWRlLWluKSAtLS0tICovXG5mdW5jdGlvbiBidWlsZGVySW5zcGVjdG9yUGFuZWwoKTogc3RyaW5nIHtcbiAgcmV0dXJuIGA8YXNpZGUgY2xhc3M9XCJicy1wYWItaW5zcGVjdG9yLXBhbmVsXCI+XG4gICAgPGRpdiBjbGFzcz1cImJzLXBhYi1pbnNwZWN0b3ItaGVhZGVyXCI+XG4gICAgICA8c3BhbiBjbGFzcz1cImJzLXBhYi1pbnNwZWN0b3ItdGl0bGVcIiBpZD1cInBhYi1pbnNwLXRpdGxlXCI+RmllbGQgU2V0dGluZ3M8L3NwYW4+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnMtcGFiLWljb24tYnRuXCIgdGl0bGU9XCJDbG9zZVwiIG9uY2xpY2s9XCJidWlsZGVyQ2xvc2VJbnNwZWN0b3IoKVwiPlx1MjcxNTwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJicy1wYWItaW5zcGVjdG9yXCIgaWQ9XCJwYWItaW5zcGVjdG9yXCI+JHtidWlsZGVySW5zcGVjdG9yKEJVSUxERVIuc2VsZWN0ZWRJZCA/IGJ1aWxkZXJGaWVsZChCVUlMREVSLnNlbGVjdGVkSWQpIDogbnVsbCl9PC9kaXY+XG4gIDwvYXNpZGU+YDtcbn1cbmZ1bmN0aW9uIGluc3BTZWN0aW9uKHRpdGxlOiBzdHJpbmcsIGlubmVyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJicy1wYWItaW5zcGVjdG9yLXNlY3Rpb25cIj48ZGl2IGNsYXNzPVwiYnMtcGFiLWluc3Atc2VjdGlvbi10aXRsZVwiPiR7ZXNjKHRpdGxlKX08L2Rpdj4ke2lubmVyfTwvZGl2PmA7XG59XG5mdW5jdGlvbiBpbnNwR3JvdXAobGFiZWw6IHN0cmluZywgY29udHJvbDogc3RyaW5nLCBoaW50OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJicy1wYWItZmllbGQtZ3JvdXBcIj48ZGl2IGNsYXNzPVwiYnMtcGFiLWxhYmVsXCI+JHtlc2MobGFiZWwpfTwvZGl2PiR7Y29udHJvbH0ke2hpbnQgPyBgPGRpdiBjbGFzcz1cImJzLXBhYi1oZWxwZXJcIj4ke2VzYyhoaW50KX08L2Rpdj5gIDogJyd9PC9kaXY+YDtcbn1cbmZ1bmN0aW9uIGluc3BUb2dnbGVSb3cobGFiZWw6IHN0cmluZywgaGludDogc3RyaW5nLCBvbjogYm9vbGVhbiwgb25jbGlja0V4cHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgPGRpdiBjbGFzcz1cImJzLXBhYi10b2dnbGUtcm93XCI+XG4gICAgPGRpdj48ZGl2IGNsYXNzPVwiYnMtcGFiLWxhYmVsXCI+JHtlc2MobGFiZWwpfTwvZGl2PiR7aGludCA/IGA8ZGl2IGNsYXNzPVwiYnMtcGFiLWhlbHBlclwiPiR7ZXNjKGhpbnQpfTwvZGl2PmAgOiAnJ308L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwiYnMtcGFiLXRvZ2dsZS1waWxsJHtvbiA/ICcgYnMtcGFiLXRvZ2dsZS1vbicgOiAnJ31cIiBvbmNsaWNrPVwiJHtvbmNsaWNrRXhwcn1cIj48L2Rpdj5cbiAgPC9kaXY+YDtcbn1cbmZ1bmN0aW9uIGJ1aWxkZXJJbnNwZWN0b3IoZjogQXBwRmllbGQgfCBudWxsKTogc3RyaW5nIHtcbiAgaWYgKCFmKSByZXR1cm4gYDxkaXYgY2xhc3M9XCJicy1wYWItZW1wdHktc3RhdGVcIj48c3Ryb25nPk5vIGZpZWxkIHNlbGVjdGVkPC9zdHJvbmc+U2VsZWN0IGEgZmllbGQgb24gdGhlIGNhbnZhcyB0byBlZGl0IGl0cyBzZXR0aW5ncy48L2Rpdj5gO1xuICBjb25zdCBhbnN3ZXJhYmxlID0gIWlzRGlzcGxheVR5cGUoZi50eXBlKTtcbiAgY29uc3Qgb3V0OiBzdHJpbmdbXSA9IFtdO1xuXG4gIC8vIEJhc2ljXG4gIGxldCBiYXNpYyA9ICcnO1xuICBpZiAoZi50eXBlID09PSAnc3RhdGljX3RleHQnKSB7XG4gICAgYmFzaWMgKz0gaW5zcEdyb3VwKCdDb250ZW50JywgYDx0ZXh0YXJlYSBjbGFzcz1cImJzLXBhYi1pbnB1dFwiIHN0eWxlPVwibWluLWhlaWdodDo3MHB4XCIgb25pbnB1dD1cImJ1aWxkZXJTZXRQcm9wKCcke2VzYyhmLmlkKX0nLCdjb250ZW50Jyx0aGlzLnZhbHVlKVwiPiR7ZXNjKGYuc2V0dGluZ3MuY29udGVudCB8fCAnJyl9PC90ZXh0YXJlYT5gLCAnJyk7XG4gIH0gZWxzZSB7XG4gICAgYmFzaWMgKz0gaW5zcEdyb3VwKGYudHlwZSA9PT0gJ2hlYWRlcicgPyAnU2VjdGlvbiB0aXRsZScgOiAnTGFiZWwnLFxuICAgICAgYDxpbnB1dCBjbGFzcz1cImJzLXBhYi1pbnB1dFwiIHZhbHVlPVwiJHtlc2MoZi5sYWJlbCB8fCAnJyl9XCIgb25pbnB1dD1cImJ1aWxkZXJTZXRQcm9wKCcke2VzYyhmLmlkKX0nLCdsYWJlbCcsdGhpcy52YWx1ZSlcIiBhdXRvY29tcGxldGU9XCJvZmZcIj5gLCAnJyk7XG4gICAgYmFzaWMgKz0gaW5zcEdyb3VwKCdEZXNjcmlwdGlvbiAob3B0aW9uYWwpJyxcbiAgICAgIGA8dGV4dGFyZWEgY2xhc3M9XCJicy1wYWItaW5wdXRcIiBzdHlsZT1cIm1pbi1oZWlnaHQ6NTJweFwiIG9uaW5wdXQ9XCJidWlsZGVyU2V0UHJvcCgnJHtlc2MoZi5pZCl9JywnZGVzY3JpcHRpb24nLHRoaXMudmFsdWUpXCI+JHtlc2MoZi5kZXNjcmlwdGlvbiB8fCAnJyl9PC90ZXh0YXJlYT5gLFxuICAgICAgJ0hlbHBlciB0ZXh0IHNob3duIGJlbG93IHRoZSBxdWVzdGlvbi4nKTtcbiAgfVxuICBpZiAoYW5zd2VyYWJsZSkgYmFzaWMgKz0gaW5zcFRvZ2dsZVJvdygnUmVxdWlyZWQnLCAnQXBwbGljYW50cyBtdXN0IGFuc3dlciB0aGlzIHF1ZXN0aW9uLicsIGYucmVxdWlyZWQsIGBidWlsZGVyU2V0Qm9vbCgnJHtlc2MoZi5pZCl9JywncmVxdWlyZWQnLCR7Zi5yZXF1aXJlZCA/ICdmYWxzZScgOiAndHJ1ZSd9KWApO1xuICBiYXNpYyArPSBpbnNwVG9nZ2xlUm93KCdBY3RpdmUnLCAnVHVybiBvZmYgdG8gaGlkZSBmcm9tIG5ldyBhcHBsaWNhdGlvbnMgYnV0IGtlZXAgZm9yIGhpc3RvcmljYWwgZGF0YS4nLCBmLmFjdGl2ZSwgYGJ1aWxkZXJTZXRCb29sKCcke2VzYyhmLmlkKX0nLCdhY3RpdmUnLCR7Zi5hY3RpdmUgPyAnZmFsc2UnIDogJ3RydWUnfSlgKTtcbiAgb3V0LnB1c2goaW5zcFNlY3Rpb24oJ0Jhc2ljJywgYmFzaWMpKTtcblxuICAvLyBQbGFjZWhvbGRlciAodGV4dC9tZW1vL251bWJlcilcbiAgaWYgKGYudHlwZSA9PT0gJ3RleHQnIHx8IGYudHlwZSA9PT0gJ21lbW8nIHx8IGYudHlwZSA9PT0gJ251bWJlcicpIHtcbiAgICBvdXQucHVzaChpbnNwU2VjdGlvbignVHlwZSBTZXR0aW5ncycsIGluc3BHcm91cCgnUGxhY2Vob2xkZXIgKG9wdGlvbmFsKScsXG4gICAgICBgPGlucHV0IGNsYXNzPVwiYnMtcGFiLWlucHV0XCIgdmFsdWU9XCIke2VzYyhmLnNldHRpbmdzLnBsYWNlaG9sZGVyIHx8ICcnKX1cIiBvbmlucHV0PVwiYnVpbGRlclNldFByb3AoJyR7ZXNjKGYuaWQpfScsJ3BsYWNlaG9sZGVyJyx0aGlzLnZhbHVlKVwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiPmAsICcnKSkpO1xuICB9XG5cbiAgLy8gT3B0aW9ucyAoc2VsZWN0cylcbiAgaWYgKGYudHlwZSA9PT0gJ3NpbmdsZV9zZWxlY3QnIHx8IGYudHlwZSA9PT0gJ211bHRpX3NlbGVjdCcpIHtcbiAgICBjb25zdCByb3dzID0gKGYuc2V0dGluZ3Mub3B0aW9ucyB8fCBbXSkubWFwKG8gPT4gYDxkaXYgY2xhc3M9XCJicy1wYWItb3B0aW9uLXJvd1wiPlxuICAgICAgPGlucHV0IGNsYXNzPVwiYnMtcGFiLWlucHV0XCIgdmFsdWU9XCIke2VzYyhvLmxhYmVsKX1cIiBwbGFjZWhvbGRlcj1cIk9wdGlvbiBsYWJlbFwiIG9uaW5wdXQ9XCJidWlsZGVyU2V0T3B0aW9uKCcke2VzYyhmLmlkKX0nLCcke2VzYyhvLmlkKX0nLHRoaXMudmFsdWUpXCIgYXV0b2NvbXBsZXRlPVwib2ZmXCI+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnMtcGFiLWljb24tYnRuIGJzLXBhYi1pY29uLWJ0bi1kYW5nZXJcIiB0aXRsZT1cIlJlbW92ZVwiIG9uY2xpY2s9XCJidWlsZGVyUmVtb3ZlT3B0aW9uKCcke2VzYyhmLmlkKX0nLCcke2VzYyhvLmlkKX0nKVwiPlx1RDgzRFx1REREMTwvYnV0dG9uPlxuICAgIDwvZGl2PmApLmpvaW4oJycpO1xuICAgIG91dC5wdXNoKGluc3BTZWN0aW9uKCdPcHRpb25zJywgYDxkaXYgY2xhc3M9XCJicy1wYWItb3B0aW9ucy1saXN0XCI+JHtyb3dzIHx8ICc8ZGl2IGNsYXNzPVwiYnMtcGFiLWhlbHBlclwiPk5vIG9wdGlvbnMgeWV0LjwvZGl2Pid9PC9kaXY+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnMtcGFiLWJ0biBicy1wYWItYnRuLWdob3N0XCIgc3R5bGU9XCJtYXJnaW4tdG9wOjhweFwiIG9uY2xpY2s9XCJidWlsZGVyQWRkT3B0aW9uKCcke2VzYyhmLmlkKX0nKVwiPisgQWRkIG9wdGlvbjwvYnV0dG9uPmApKTtcbiAgfVxuXG4gIC8vIE1hcHBpbmdcbiAgaWYgKGFuc3dlcmFibGUpIHtcbiAgICBjb25zdCBvcHRzID0gTUFQX1RPX09QVElPTlMubWFwKG8gPT4gYDxvcHRpb24gdmFsdWU9XCIke2VzYyhvLnZhbHVlKX1cIiR7by52YWx1ZSA9PT0gZi5tYXBUbyA/ICcgc2VsZWN0ZWQnIDogJyd9PiR7ZXNjKG8ubGFiZWwpfTwvb3B0aW9uPmApLmpvaW4oJycpO1xuICAgIG91dC5wdXNoKGluc3BTZWN0aW9uKCdNYXBwaW5nJywgaW5zcEdyb3VwKCdNYXAgYW5zd2VyIHRvIGEgcmVjb3JkIGZpZWxkIChvcHRpb25hbCknLFxuICAgICAgYDxzZWxlY3QgY2xhc3M9XCJicy1wYWItc2VsZWN0XCIgb25jaGFuZ2U9XCJidWlsZGVyU2V0UHJvcCgnJHtlc2MoZi5pZCl9JywnbWFwVG8nLHRoaXMudmFsdWUpXCI+JHtvcHRzfTwvc2VsZWN0PmAsXG4gICAgICAnV2hlbiB0aGUgZmFtaWx5IHN1Ym1pdHMsIHRoaXMgYW5zd2VyIGFsc28gcG9wdWxhdGVzIHRoZSBjbGllbnRcdTIwMTlzIHJlY29yZC4nKSkpO1xuICB9XG5cbiAgLy8gTG9naWNcbiAgb3V0LnB1c2goaW5zcFNlY3Rpb24oJ0xvZ2ljIChTaG93IC8gSGlkZSknLCBidWlsZGVyTG9naWNFZGl0b3IoZikpKTtcblxuICByZXR1cm4gb3V0LmpvaW4oJycpO1xufVxuZnVuY3Rpb24gYnVpbGRlckxvZ2ljRWRpdG9yKGY6IEFwcEZpZWxkKTogc3RyaW5nIHtcbiAgY29uc3QgdCA9IGJ1aWxkZXJUZW1wbGF0ZSgpO1xuICBjb25zdCBteUlkeCA9IHQuZmllbGRzLmZpbmRJbmRleCh4ID0+IHguaWQgPT09IGYuaWQpO1xuICBjb25zdCBzb3VyY2VzID0gdC5maWVsZHMuZmlsdGVyKCh4LCBpKSA9PiBpIDwgbXlJZHggJiYgaXNMb2dpY1NvdXJjZSh4LnR5cGUpKTtcbiAgY29uc3QgZW5hYmxlZCA9ICEhKGYudmlzaWJpbGl0eSk7XG4gIGxldCBodG1sID0gYDxkaXYgY2xhc3M9XCJicy1wYWItaGVscGVyXCIgc3R5bGU9XCJtYXJnaW4tYm90dG9tOjhweFwiPlNob3cgdGhpcyBmaWVsZCBvbmx5IHdoZW4gYW4gZWFybGllciBZZXMvTm8gb3IgY2hvaWNlIHF1ZXN0aW9uIGhhcyBhIHNwZWNpZmljIGFuc3dlci48L2Rpdj5gO1xuICBodG1sICs9IGluc3BUb2dnbGVSb3coJ0NvbmRpdGlvbmFsJywgJycsIGVuYWJsZWQsIGBidWlsZGVyVG9nZ2xlVmlzaWJpbGl0eSgnJHtlc2MoZi5pZCl9Jywke2VuYWJsZWQgPyAnZmFsc2UnIDogJ3RydWUnfSlgKTtcbiAgaWYgKCFlbmFibGVkKSByZXR1cm4gaHRtbDtcbiAgaWYgKCFzb3VyY2VzLmxlbmd0aCkgcmV0dXJuIGh0bWwgKyBgPGRpdiBjbGFzcz1cImJzLXBhYi1oZWxwZXJcIj5BZGQgYSBZZXMvTm8gb3IgY2hvaWNlIHF1ZXN0aW9uIGFib3ZlIHRoaXMgb25lIHRvIGRyaXZlIHRoZSBydWxlLjwvZGl2PmA7XG4gIGNvbnN0IHZpcyA9IGYudmlzaWJpbGl0eSBhcyBBcHBWaXNpYmlsaXR5O1xuICBjb25zdCBzcmNPcHRzID0gYDxvcHRpb24gdmFsdWU9XCJcIj5cdTIwMTQgQ2hvb3NlIGEgcXVlc3Rpb24gXHUyMDE0PC9vcHRpb24+YCArIHNvdXJjZXMubWFwKHMgPT5cbiAgICBgPG9wdGlvbiB2YWx1ZT1cIiR7ZXNjKHMuaWQpfVwiJHt2aXMuc291cmNlRmllbGRJZCA9PT0gcy5pZCA/ICcgc2VsZWN0ZWQnIDogJyd9PiR7ZXNjKHMubGFiZWwgfHwgJyh1bnRpdGxlZCknKX08L29wdGlvbj5gKS5qb2luKCcnKTtcbiAgaHRtbCArPSBpbnNwR3JvdXAoJ1doZW4gdGhpcyBxdWVzdGlvblx1MjAyNicsIGA8c2VsZWN0IGNsYXNzPVwiYnMtcGFiLXNlbGVjdFwiIG9uY2hhbmdlPVwiYnVpbGRlclNldFZpc1NvdXJjZSgnJHtlc2MoZi5pZCl9Jyx0aGlzLnZhbHVlKVwiPiR7c3JjT3B0c308L3NlbGVjdD5gLCAnJyk7XG4gIGNvbnN0IHNyYyA9IGJ1aWxkZXJGaWVsZCh2aXMuc291cmNlRmllbGRJZCk7XG4gIGlmIChzcmMgJiYgc3JjLnR5cGUgPT09ICdib29sZWFuJykge1xuICAgIGNvbnN0IG0gPSAodmlzLm1hdGNoICYmIHZpcy5tYXRjaC5ib29sZWFuKSB8fCB7IHRydWU6IGZhbHNlLCBmYWxzZTogZmFsc2UgfTtcbiAgICBodG1sICs9IGA8ZGl2IGNsYXNzPVwiYnMtcGFiLWhlbHBlclwiPlx1MjAyNmhhcyB0aGUgYW5zd2VyOjwvZGl2PlxuICAgICAgPGxhYmVsIGNsYXNzPVwiYnMtcGFiLWNoZWNrXCI+PGlucHV0IHR5cGU9XCJjaGVja2JveFwiICR7bS50cnVlID8gJ2NoZWNrZWQnIDogJyd9IG9uY2hhbmdlPVwiYnVpbGRlclNldFZpc0Jvb2woJyR7ZXNjKGYuaWQpfScsJ3RydWUnLHRoaXMuY2hlY2tlZClcIj4gWWVzPC9sYWJlbD5cbiAgICAgIDxsYWJlbCBjbGFzcz1cImJzLXBhYi1jaGVja1wiPjxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiAke20uZmFsc2UgPyAnY2hlY2tlZCcgOiAnJ30gb25jaGFuZ2U9XCJidWlsZGVyU2V0VmlzQm9vbCgnJHtlc2MoZi5pZCl9JywnZmFsc2UnLHRoaXMuY2hlY2tlZClcIj4gTm88L2xhYmVsPmA7XG4gIH0gZWxzZSBpZiAoc3JjICYmIChzcmMudHlwZSA9PT0gJ3NpbmdsZV9zZWxlY3QnIHx8IHNyYy50eXBlID09PSAnbXVsdGlfc2VsZWN0JykpIHtcbiAgICBjb25zdCBjaG9zZW4gPSAodmlzLm1hdGNoICYmIHZpcy5tYXRjaC5vcHRpb25JZHMpIHx8IFtdO1xuICAgIGNvbnN0IGNoZWNrcyA9IChzcmMuc2V0dGluZ3Mub3B0aW9ucyB8fCBbXSkubWFwKG8gPT5cbiAgICAgIGA8bGFiZWwgY2xhc3M9XCJicy1wYWItY2hlY2tcIj48aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgJHtjaG9zZW4uaW5kZXhPZihvLmlkKSA+PSAwID8gJ2NoZWNrZWQnIDogJyd9IG9uY2hhbmdlPVwiYnVpbGRlclNldFZpc09wdGlvbignJHtlc2MoZi5pZCl9JywnJHtlc2Moby5pZCl9Jyx0aGlzLmNoZWNrZWQpXCI+ICR7ZXNjKG8ubGFiZWwpfTwvbGFiZWw+YCkuam9pbignJyk7XG4gICAgaHRtbCArPSBgPGRpdiBjbGFzcz1cImJzLXBhYi1oZWxwZXJcIj5cdTIwMjZpcyBhbnkgb2Y6PC9kaXY+JHtjaGVja3MgfHwgJzxkaXYgY2xhc3M9XCJicy1wYWItaGVscGVyXCI+VGhhdCBxdWVzdGlvbiBoYXMgbm8gb3B0aW9ucy48L2Rpdj4nfWA7XG4gIH0gZWxzZSBpZiAodmlzLnNvdXJjZUZpZWxkSWQpIHtcbiAgICBodG1sICs9IGA8ZGl2IGNsYXNzPVwiYnMtcGFiLWhlbHBlclwiPlRoYXQgc291cmNlIHF1ZXN0aW9uIGlzIG5vIGxvbmdlciBhdmFpbGFibGUuPC9kaXY+YDtcbiAgfVxuICByZXR1cm4gaHRtbDtcbn1cblxuLyogLS0tLSBzZWxlY3Rpb24gKyBpbnNwZWN0b3Igb3Blbi9jbG9zZSAtLS0tICovXG5mdW5jdGlvbiBidWlsZGVyU2VsZWN0KGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgaWYgKEJVSUxERVIuc2VsZWN0ZWRJZCA9PT0gaWQpIHJldHVybjsgLy8gbm8tb3AgKGtlZXBzIGlubGluZSBpbnB1dCBmb2N1cylcbiAgQlVJTERFUi5zZWxlY3RlZElkID0gaWQgfHwgbnVsbDtcbiAgYnVpbGRlclJlcmVuZGVyQ2FudmFzKCk7XG4gIGJ1aWxkZXJSZXJlbmRlck5hdigpO1xuICBpZiAoQlVJTERFUi5pbnNwZWN0b3JPcGVuKSBidWlsZGVyUmVyZW5kZXJJbnNwZWN0b3IoKTtcbn1cbmZ1bmN0aW9uIGJ1aWxkZXJPcGVuSW5zcGVjdG9yKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgaWYgKGlkKSBCVUlMREVSLnNlbGVjdGVkSWQgPSBpZDtcbiAgQlVJTERFUi5pbnNwZWN0b3JPcGVuID0gdHJ1ZTtcbiAgY29uc3QgYm9keSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5icy1wYWItYm9keScpO1xuICBpZiAoYm9keSkgYm9keS5jbGFzc0xpc3QuYWRkKCdpbnNwZWN0b3Itb3BlbicpO1xuICBidWlsZGVyUmVyZW5kZXJJbnNwZWN0b3IoKTtcbiAgYnVpbGRlclJlcmVuZGVyQ2FudmFzKCk7XG4gIGJ1aWxkZXJSZXJlbmRlck5hdigpO1xufVxuZnVuY3Rpb24gYnVpbGRlckNsb3NlSW5zcGVjdG9yKCk6IHZvaWQge1xuICBCVUlMREVSLmluc3BlY3Rvck9wZW4gPSBmYWxzZTtcbiAgY29uc3QgYm9keSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5icy1wYWItYm9keScpO1xuICBpZiAoYm9keSkgYm9keS5jbGFzc0xpc3QucmVtb3ZlKCdpbnNwZWN0b3Itb3BlbicpO1xufVxuXG4vKiAtLS0tIG5hdmlnYXRvciAvIGNhbnZhcyBjb250cm9scyAtLS0tICovXG5mdW5jdGlvbiBidWlsZGVyTmF2U2VhcmNoSW5wdXQodjogc3RyaW5nKTogdm9pZCB7IEJVSUxERVIubmF2UXVlcnkgPSB2OyBidWlsZGVyUmVyZW5kZXJOYXYoKTsgfVxuZnVuY3Rpb24gYnVpbGRlckNhbnZhc0ZpbHRlcklucHV0KHY6IHN0cmluZyk6IHZvaWQgeyBCVUlMREVSLmNhbnZhc1F1ZXJ5ID0gdjsgYnVpbGRlclJlcmVuZGVyQ2FudmFzKCk7IH1cbmZ1bmN0aW9uIGJ1aWxkZXJTZXRWaWV3KGNvbXBhY3Q6IGJvb2xlYW4pOiB2b2lkIHtcbiAgQlVJTERFUi5jb21wYWN0ID0gY29tcGFjdDtcbiAgY29uc3QgYyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYWItY2FudmFzJyk7XG4gIGlmIChjKSBjLmNsYXNzTGlzdC50b2dnbGUoJ2NvbXBhY3QnLCBjb21wYWN0KTtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmJzLXBhYi12aWV3LWJ0bicpLmZvckVhY2goKGIsIGkpID0+IGIuY2xhc3NMaXN0LnRvZ2dsZSgnYnMtcGFiLXZpZXctYWN0aXZlJywgaSA9PT0gKGNvbXBhY3QgPyAxIDogMCkpKTtcbn1cbmZ1bmN0aW9uIGJ1aWxkZXJUb2dnbGVTZWN0aW9uKHNpZDogc3RyaW5nKTogdm9pZCB7XG4gIEJVSUxERVIuY29sbGFwc2VkW3NpZF0gPSAhQlVJTERFUi5jb2xsYXBzZWRbc2lkXTtcbiAgYnVpbGRlclJlcmVuZGVyQ2FudmFzKCk7XG4gIGJ1aWxkZXJSZXJlbmRlck5hdigpO1xufVxuZnVuY3Rpb24gYnVpbGRlckNvbGxhcHNlQWxsKCk6IHZvaWQge1xuICBjb25zdCB0ID0gYnVpbGRlclRlbXBsYXRlKCk7XG4gIGNvbnN0IGhlYWRlcnMgPSB0LmZpZWxkcy5maWx0ZXIoZiA9PiBmLnR5cGUgPT09ICdoZWFkZXInKTtcbiAgY29uc3QgYW55T3BlbiA9IGhlYWRlcnMuc29tZShoID0+ICFCVUlMREVSLmNvbGxhcHNlZFtoLmlkXSk7XG4gIGhlYWRlcnMuZm9yRWFjaChoID0+IHsgQlVJTERFUi5jb2xsYXBzZWRbaC5pZF0gPSBhbnlPcGVuOyB9KTtcbiAgYnVpbGRlclJlcmVuZGVyQ2FudmFzKCk7XG4gIGJ1aWxkZXJSZXJlbmRlck5hdigpO1xufVxuXG4vKiAtLS0tIGRyYWcgcmVvcmRlciAtLS0tICovXG5mdW5jdGlvbiBidWlsZGVyRHJhZ1N0YXJ0KGU6IERyYWdFdmVudCwgaWQ6IHN0cmluZyk6IHZvaWQge1xuICBCVUlMREVSLmRyYWdJZCA9IGlkO1xuICBpZiAoZS5kYXRhVHJhbnNmZXIpIHsgZS5kYXRhVHJhbnNmZXIuZWZmZWN0QWxsb3dlZCA9ICdtb3ZlJzsgdHJ5IHsgZS5kYXRhVHJhbnNmZXIuc2V0RGF0YSgndGV4dC9wbGFpbicsIGlkKTsgfSBjYXRjaCAoX2UpIHsgLyogKi8gfSB9XG59XG5mdW5jdGlvbiBidWlsZGVyRHJhZ092ZXIoZTogRHJhZ0V2ZW50KTogdm9pZCB7XG4gIGlmICghQlVJTERFUi5kcmFnSWQpIHJldHVybjtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICBpZiAoZS5kYXRhVHJhbnNmZXIpIGUuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnbW92ZSc7XG59XG5mdW5jdGlvbiBidWlsZGVyRHJvcChlOiBEcmFnRXZlbnQsIHRhcmdldElkOiBzdHJpbmcpOiB2b2lkIHtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICBjb25zdCBzcmMgPSBCVUlMREVSLmRyYWdJZDsgQlVJTERFUi5kcmFnSWQgPSAnJztcbiAgaWYgKCFzcmMgfHwgc3JjID09PSB0YXJnZXRJZCkgcmV0dXJuO1xuICBjb25zdCB0ID0gYnVpbGRlclRlbXBsYXRlKCk7XG4gIGNvbnN0IGZyb20gPSB0LmZpZWxkcy5maW5kSW5kZXgoZiA9PiBmLmlkID09PSBzcmMpO1xuICBjb25zdCB0byA9IHQuZmllbGRzLmZpbmRJbmRleChmID0+IGYuaWQgPT09IHRhcmdldElkKTtcbiAgaWYgKGZyb20gPCAwIHx8IHRvIDwgMCkgcmV0dXJuO1xuICBjb25zdCBtb3ZlZCA9IHQuZmllbGRzLnNwbGljZShmcm9tLCAxKVswXTtcbiAgY29uc3QgbmV3VG8gPSB0LmZpZWxkcy5maW5kSW5kZXgoZiA9PiBmLmlkID09PSB0YXJnZXRJZCk7XG4gIHQuZmllbGRzLnNwbGljZShuZXdUbyArIChmcm9tIDwgdG8gPyAxIDogMCksIDAsIG1vdmVkKTtcbiAgbWFya0RpcnR5KCk7XG4gIGJ1aWxkZXJSZXJlbmRlckNhbnZhcygpO1xuICBidWlsZGVyUmVyZW5kZXJOYXYoKTtcbn1cbmZ1bmN0aW9uIGJ1aWxkZXJEcmFnRW5kKCk6IHZvaWQgeyBCVUlMREVSLmRyYWdJZCA9ICcnOyB9XG5cbi8qIC0tLS0gbXV0YXRpb25zIC0tLS0gKi9cbmZ1bmN0aW9uIGJ1aWxkZXJNb3ZlKGlkOiBzdHJpbmcsIGRpcjogbnVtYmVyKTogdm9pZCB7XG4gIGNvbnN0IHQgPSBidWlsZGVyVGVtcGxhdGUoKTtcbiAgY29uc3QgaSA9IHQuZmllbGRzLmZpbmRJbmRleChmID0+IGYuaWQgPT09IGlkKTtcbiAgY29uc3QgaiA9IGkgKyBkaXI7XG4gIGlmIChpIDwgMCB8fCBqIDwgMCB8fCBqID49IHQuZmllbGRzLmxlbmd0aCkgcmV0dXJuO1xuICBjb25zdCB0bXAgPSB0LmZpZWxkc1tpXTsgdC5maWVsZHNbaV0gPSB0LmZpZWxkc1tqXTsgdC5maWVsZHNbal0gPSB0bXA7XG4gIG1hcmtEaXJ0eSgpO1xuICBidWlsZGVyUmVyZW5kZXJDYW52YXMoKTtcbiAgYnVpbGRlclJlcmVuZGVyTmF2KCk7XG59XG5mdW5jdGlvbiBidWlsZGVyRGVsZXRlKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgdCA9IGJ1aWxkZXJUZW1wbGF0ZSgpO1xuICBjb25zdCBpID0gdC5maWVsZHMuZmluZEluZGV4KGYgPT4gZi5pZCA9PT0gaWQpO1xuICBpZiAoaSA8IDApIHJldHVybjtcbiAgLy8gQ2xlYXIgYW55IHZpc2liaWxpdHkgcnVsZXMgdGhhdCByZWZlcmVuY2VkIHRoZSBkZWxldGVkIGZpZWxkLlxuICB0LmZpZWxkcy5mb3JFYWNoKGYgPT4geyBpZiAoZi52aXNpYmlsaXR5ICYmIGYudmlzaWJpbGl0eS5zb3VyY2VGaWVsZElkID09PSBpZCkgZi52aXNpYmlsaXR5ID0gbnVsbDsgfSk7XG4gIHQuZmllbGRzLnNwbGljZShpLCAxKTtcbiAgaWYgKEJVSUxERVIuc2VsZWN0ZWRJZCA9PT0gaWQpIEJVSUxERVIuc2VsZWN0ZWRJZCA9IG51bGw7XG4gIG1hcmtEaXJ0eSgpO1xuICBidWlsZGVyUmVyZW5kZXJDYW52YXMoKTtcbiAgYnVpbGRlclJlcmVuZGVyTmF2KCk7XG4gIGJ1aWxkZXJSZXJlbmRlckluc3BlY3RvcigpO1xufVxuZnVuY3Rpb24gYnVpbGRlckR1cGxpY2F0ZShpZDogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IHQgPSBidWlsZGVyVGVtcGxhdGUoKTtcbiAgY29uc3QgaSA9IHQuZmllbGRzLmZpbmRJbmRleChmID0+IGYuaWQgPT09IGlkKTtcbiAgaWYgKGkgPCAwKSByZXR1cm47XG4gIGNvbnN0IGNvcHk6IEFwcEZpZWxkID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeSh0LmZpZWxkc1tpXSkpO1xuICBjb3B5LmlkID0gdXVpZCgpO1xuICBjb3B5LnZpc2liaWxpdHkgPSBudWxsOyAvLyBkb24ndCBjYXJyeSBjb25kaXRpb25hbCBzb3VyY2UgaW50byB0aGUgZHVwZVxuICBpZiAoY29weS5zZXR0aW5ncy5vcHRpb25zKSBjb3B5LnNldHRpbmdzLm9wdGlvbnMgPSBjb3B5LnNldHRpbmdzLm9wdGlvbnMubWFwKG8gPT4gKHsgaWQ6IHV1aWQoKSwgbGFiZWw6IG8ubGFiZWwgfSkpO1xuICB0LmZpZWxkcy5zcGxpY2UoaSArIDEsIDAsIGNvcHkpO1xuICBCVUlMREVSLnNlbGVjdGVkSWQgPSBjb3B5LmlkO1xuICBtYXJrRGlydHkoKTtcbiAgYnVpbGRlclJlcmVuZGVyQ2FudmFzKCk7XG4gIGJ1aWxkZXJSZXJlbmRlck5hdigpO1xuICBidWlsZGVyUmVyZW5kZXJJbnNwZWN0b3IoKTtcbn1cbmZ1bmN0aW9uIGJ1aWxkZXJBZGRGaWVsZCh0eXBlOiBBcHBGaWVsZFR5cGUpOiB2b2lkIHtcbiAgYnVpbGRlckNsb3NlUGlja2VyKCk7XG4gIGNvbnN0IHQgPSBidWlsZGVyVGVtcGxhdGUoKTtcbiAgY29uc3QgZiA9IGNyZWF0ZUZpZWxkKHR5cGUpO1xuICAvLyBJbnNlcnQgYWZ0ZXIgdGhlIHNlbGVjdGVkIGZpZWxkLCBlbHNlIGF0IHRoZSBlbmQuXG4gIGNvbnN0IHNlbElkeCA9IEJVSUxERVIuc2VsZWN0ZWRJZCA/IHQuZmllbGRzLmZpbmRJbmRleCh4ID0+IHguaWQgPT09IEJVSUxERVIuc2VsZWN0ZWRJZCkgOiAtMTtcbiAgaWYgKHNlbElkeCA+PSAwKSB0LmZpZWxkcy5zcGxpY2Uoc2VsSWR4ICsgMSwgMCwgZik7IGVsc2UgdC5maWVsZHMucHVzaChmKTtcbiAgQlVJTERFUi5zZWxlY3RlZElkID0gZi5pZDtcbiAgbWFya0RpcnR5KCk7XG4gIGJ1aWxkZXJSZXJlbmRlckNhbnZhcygpO1xuICBidWlsZGVyUmVyZW5kZXJOYXYoKTtcbiAgYnVpbGRlclJlcmVuZGVySW5zcGVjdG9yKCk7XG59XG5cbi8vIFByb3BlcnR5IGVkaXQgZnJvbSBhbiA8aW5wdXQ+Lzx0ZXh0YXJlYT4vPHNlbGVjdD4gXHUyMDE0IHVwZGF0ZSBzdGF0ZSBpbiBwbGFjZS5cbi8vIEZvciBsYWJlbC9jb250ZW50IHdlIHBhdGNoIHRoZSB2aXNpYmxlIGNhcmQgKyBuYXYgbGFiZWxzIHdpdGhvdXQgYSByZS1yZW5kZXIgc29cbi8vIHRoZSBpbnB1dCBrZWVwcyBmb2N1cy4gbWFwVG8gcmUtcmVuZGVycyB0aGUgY2FudmFzIChiYWRnZXMvaGludCBjaGFuZ2UpLlxuZnVuY3Rpb24gYnVpbGRlclNldFByb3AoaWQ6IHN0cmluZywgcHJvcDogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGYgPSBidWlsZGVyRmllbGQoaWQpO1xuICBpZiAoIWYpIHJldHVybjtcbiAgaWYgKHByb3AgPT09ICdjb250ZW50JyB8fCBwcm9wID09PSAncGxhY2Vob2xkZXInKSBmLnNldHRpbmdzW3Byb3AgYXMgJ2NvbnRlbnQnIHwgJ3BsYWNlaG9sZGVyJ10gPSB2YWx1ZTtcbiAgZWxzZSAoZiBhcyBhbnkpW3Byb3BdID0gdmFsdWU7XG4gIG1hcmtEaXJ0eSgpO1xuICBpZiAocHJvcCA9PT0gJ2xhYmVsJyB8fCBwcm9wID09PSAnY29udGVudCcpIHBhdGNoQ2FyZFRpdGxlKGlkKTtcbiAgaWYgKHByb3AgPT09ICdtYXBUbycpIHsgYnVpbGRlclJlcmVuZGVyQ2FudmFzKCk7IGJ1aWxkZXJSZXJlbmRlckluc3BlY3RvcigpOyB9XG59XG5mdW5jdGlvbiBidWlsZGVyU2V0Qm9vbChpZDogc3RyaW5nLCBwcm9wOiAncmVxdWlyZWQnIHwgJ2FjdGl2ZScsIHZhbHVlOiBib29sZWFuKTogdm9pZCB7XG4gIGNvbnN0IGYgPSBidWlsZGVyRmllbGQoaWQpO1xuICBpZiAoIWYpIHJldHVybjtcbiAgKGYgYXMgYW55KVtwcm9wXSA9IHZhbHVlO1xuICBtYXJrRGlydHkoKTtcbiAgYnVpbGRlclJlcmVuZGVyQ2FudmFzKCk7XG4gIGJ1aWxkZXJSZXJlbmRlckluc3BlY3RvcigpO1xufVxuXG5mdW5jdGlvbiBidWlsZGVyQWRkT3B0aW9uKGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgZiA9IGJ1aWxkZXJGaWVsZChpZCk7XG4gIGlmICghZikgcmV0dXJuO1xuICBpZiAoIWYuc2V0dGluZ3Mub3B0aW9ucykgZi5zZXR0aW5ncy5vcHRpb25zID0gW107XG4gIGYuc2V0dGluZ3Mub3B0aW9ucy5wdXNoKHsgaWQ6IHV1aWQoKSwgbGFiZWw6ICdOZXcgb3B0aW9uJyB9KTtcbiAgbWFya0RpcnR5KCk7XG4gIGJ1aWxkZXJSZXJlbmRlckluc3BlY3RvcigpO1xufVxuZnVuY3Rpb24gYnVpbGRlclJlbW92ZU9wdGlvbihpZDogc3RyaW5nLCBvcHRJZDogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGYgPSBidWlsZGVyRmllbGQoaWQpO1xuICBpZiAoIWYgfHwgIWYuc2V0dGluZ3Mub3B0aW9ucykgcmV0dXJuO1xuICBmLnNldHRpbmdzLm9wdGlvbnMgPSBmLnNldHRpbmdzLm9wdGlvbnMuZmlsdGVyKG8gPT4gby5pZCAhPT0gb3B0SWQpO1xuICAvLyBEcm9wIHRoZSBvcHRpb24gZnJvbSBhbnkgY29uZGl0aW9uYWwgcnVsZSB0aGF0IHJlZmVyZW5jZWQgaXQuXG4gIGJ1aWxkZXJUZW1wbGF0ZSgpLmZpZWxkcy5mb3JFYWNoKHggPT4ge1xuICAgIGlmICh4LnZpc2liaWxpdHkgJiYgeC52aXNpYmlsaXR5Lm1hdGNoICYmIHgudmlzaWJpbGl0eS5tYXRjaC5vcHRpb25JZHMpIHtcbiAgICAgIHgudmlzaWJpbGl0eS5tYXRjaC5vcHRpb25JZHMgPSB4LnZpc2liaWxpdHkubWF0Y2gub3B0aW9uSWRzLmZpbHRlcihvID0+IG8gIT09IG9wdElkKTtcbiAgICB9XG4gIH0pO1xuICBtYXJrRGlydHkoKTtcbiAgYnVpbGRlclJlcmVuZGVySW5zcGVjdG9yKCk7XG59XG5mdW5jdGlvbiBidWlsZGVyU2V0T3B0aW9uKGlkOiBzdHJpbmcsIG9wdElkOiBzdHJpbmcsIGxhYmVsOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgZiA9IGJ1aWxkZXJGaWVsZChpZCk7XG4gIGlmICghZiB8fCAhZi5zZXR0aW5ncy5vcHRpb25zKSByZXR1cm47XG4gIGNvbnN0IG8gPSBmLnNldHRpbmdzLm9wdGlvbnMuZmlsdGVyKHggPT4geC5pZCA9PT0gb3B0SWQpWzBdO1xuICBpZiAobykgeyBvLmxhYmVsID0gbGFiZWw7IG1hcmtEaXJ0eSgpOyB9XG59XG5cbi8qIC0tLS0gY29uZGl0aW9uYWwgbG9naWMgLS0tLSAqL1xuZnVuY3Rpb24gYnVpbGRlclRvZ2dsZVZpc2liaWxpdHkoaWQ6IHN0cmluZywgb246IGJvb2xlYW4pOiB2b2lkIHtcbiAgY29uc3QgZiA9IGJ1aWxkZXJGaWVsZChpZCk7XG4gIGlmICghZikgcmV0dXJuO1xuICBmLnZpc2liaWxpdHkgPSBvbiA/IHsgc291cmNlRmllbGRJZDogJycsIG1hdGNoOiB7fSB9IDogbnVsbDtcbiAgbWFya0RpcnR5KCk7XG4gIGJ1aWxkZXJSZXJlbmRlckluc3BlY3RvcigpO1xuICBidWlsZGVyUmVyZW5kZXJDYW52YXMoKTtcbn1cbmZ1bmN0aW9uIGJ1aWxkZXJTZXRWaXNTb3VyY2UoaWQ6IHN0cmluZywgc291cmNlSWQ6IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCBmID0gYnVpbGRlckZpZWxkKGlkKTtcbiAgaWYgKCFmIHx8ICFmLnZpc2liaWxpdHkpIHJldHVybjtcbiAgZi52aXNpYmlsaXR5LnNvdXJjZUZpZWxkSWQgPSBzb3VyY2VJZDtcbiAgY29uc3Qgc3JjID0gYnVpbGRlckZpZWxkKHNvdXJjZUlkKTtcbiAgZi52aXNpYmlsaXR5Lm1hdGNoID0gc3JjICYmIHNyYy50eXBlID09PSAnYm9vbGVhbicgPyB7IGJvb2xlYW46IHsgdHJ1ZTogZmFsc2UsIGZhbHNlOiBmYWxzZSB9IH0gOiB7IG9wdGlvbklkczogW10gfTtcbiAgbWFya0RpcnR5KCk7XG4gIGJ1aWxkZXJSZXJlbmRlckluc3BlY3RvcigpO1xuICBidWlsZGVyUmVyZW5kZXJDYW52YXMoKTtcbn1cbmZ1bmN0aW9uIGJ1aWxkZXJTZXRWaXNCb29sKGlkOiBzdHJpbmcsIHdoaWNoOiAndHJ1ZScgfCAnZmFsc2UnLCBvbjogYm9vbGVhbik6IHZvaWQge1xuICBjb25zdCBmID0gYnVpbGRlckZpZWxkKGlkKTtcbiAgaWYgKCFmIHx8ICFmLnZpc2liaWxpdHkpIHJldHVybjtcbiAgaWYgKCFmLnZpc2liaWxpdHkubWF0Y2guYm9vbGVhbikgZi52aXNpYmlsaXR5Lm1hdGNoLmJvb2xlYW4gPSB7IHRydWU6IGZhbHNlLCBmYWxzZTogZmFsc2UgfTtcbiAgZi52aXNpYmlsaXR5Lm1hdGNoLmJvb2xlYW5bd2hpY2hdID0gb247XG4gIG1hcmtEaXJ0eSgpO1xufVxuZnVuY3Rpb24gYnVpbGRlclNldFZpc09wdGlvbihpZDogc3RyaW5nLCBvcHRJZDogc3RyaW5nLCBvbjogYm9vbGVhbik6IHZvaWQge1xuICBjb25zdCBmID0gYnVpbGRlckZpZWxkKGlkKTtcbiAgaWYgKCFmIHx8ICFmLnZpc2liaWxpdHkpIHJldHVybjtcbiAgaWYgKCFmLnZpc2liaWxpdHkubWF0Y2gub3B0aW9uSWRzKSBmLnZpc2liaWxpdHkubWF0Y2gub3B0aW9uSWRzID0gW107XG4gIGNvbnN0IGFyciA9IGYudmlzaWJpbGl0eS5tYXRjaC5vcHRpb25JZHM7XG4gIGNvbnN0IGF0ID0gYXJyLmluZGV4T2Yob3B0SWQpO1xuICBpZiAob24gJiYgYXQgPCAwKSBhcnIucHVzaChvcHRJZCk7XG4gIGlmICghb24gJiYgYXQgPj0gMCkgYXJyLnNwbGljZShhdCwgMSk7XG4gIG1hcmtEaXJ0eSgpO1xufVxuXG4vKiAtLS0tIHN1cmdpY2FsIERPTSBwYXRjaGVzIChhdm9pZCBmdWxsIHJlLXJlbmRlciBcdTIxOTIga2VlcCBpbnB1dCBmb2N1cykgLS0tLSAqL1xuZnVuY3Rpb24gYnVpbGRlclJlcmVuZGVyQ2FudmFzKCk6IHZvaWQge1xuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYWItY2FudmFzJyk7XG4gIGlmIChlbCkgZWwuaW5uZXJIVE1MID0gYnVpbGRlckNhbnZhcyhidWlsZGVyVGVtcGxhdGUoKSk7XG4gIGJ1aWxkZXJTeW5jQ291bnRzKCk7XG59XG5mdW5jdGlvbiBidWlsZGVyUmVyZW5kZXJOYXYoKTogdm9pZCB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhYi1uYXYtbGlzdCcpO1xuICBpZiAoZWwpIGVsLmlubmVySFRNTCA9IGJ1aWxkZXJOYXZMaXN0KGJ1aWxkZXJUZW1wbGF0ZSgpKTtcbn1cbmZ1bmN0aW9uIGJ1aWxkZXJSZXJlbmRlckluc3BlY3RvcigpOiB2b2lkIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGFiLWluc3BlY3RvcicpO1xuICBpZiAoZWwpIGVsLmlubmVySFRNTCA9IGJ1aWxkZXJJbnNwZWN0b3IoQlVJTERFUi5zZWxlY3RlZElkID8gYnVpbGRlckZpZWxkKEJVSUxERVIuc2VsZWN0ZWRJZCkgOiBudWxsKTtcbn1cbi8vIExhYmVsL2NvbnRlbnQgdHlwaW5nOiBwYXRjaCB0aGUgY2FyZCBsYWJlbCB0ZXh0ICsgbmF2IGl0ZW0gbGFiZWwgaW4gcGxhY2UuXG5mdW5jdGlvbiBwYXRjaENhcmRUaXRsZShpZDogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGYgPSBidWlsZGVyRmllbGQoaWQpO1xuICBpZiAoIWYpIHJldHVybjtcbiAgY29uc3QgdGl0bGUgPSBmaWVsZFByZXZpZXdMYWJlbChmKTtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtZmlkLWxhYmVsPVwiJyArIGlkICsgJ1wiXScpLmZvckVhY2goZWwgPT4geyAoZWwgYXMgSFRNTEVsZW1lbnQpLnRleHRDb250ZW50ID0gdGl0bGU7IH0pO1xuICBjb25zdCBuYXYgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuYnMtcGFiLW5hdi1pdGVtW29uY2xpY2sqPVwiJyArIGlkICsgJ1wiXSAuYnMtcGFiLW5hdi1pdGVtLWxhYmVsJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAobmF2KSBuYXYudGV4dENvbnRlbnQgPSB0aXRsZTtcbn1cbmZ1bmN0aW9uIGJ1aWxkZXJTeW5jQ291bnRzKCk6IHZvaWQge1xuICBjb25zdCBjID0gc3RhdENvdW50cyhidWlsZGVyVGVtcGxhdGUoKSk7XG4gIGNvbnN0IHNldCA9IChpZGk6IHN0cmluZywgbjogbnVtYmVyKSA9PiB7IGNvbnN0IGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3RhdC0nICsgaWRpKTsgaWYgKGUpIHsgY29uc3QgbnVtID0gZS5xdWVyeVNlbGVjdG9yKCcuYnMtcGFiLXN0YXQtbnVtJyk7IGlmIChudW0pIG51bS50ZXh0Q29udGVudCA9IFN0cmluZyhuKTsgfSB9O1xuICBzZXQoJ3RvdGFsJywgYy50b3RhbCk7IHNldCgndW5tYXBwZWQnLCBjLnVubWFwcGVkKTsgc2V0KCdyZXF1aXJlZCcsIGMucmVxdWlyZWQpOyBzZXQoJ2NvbmRpdGlvbmFsJywgYy5jb25kaXRpb25hbCk7IHNldCgnaW5hY3RpdmUnLCBjLmluYWN0aXZlKTtcbiAgY29uc3QgdW4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3RhdC11bm1hcHBlZCcpOyBpZiAodW4pIHVuLmNsYXNzTGlzdC50b2dnbGUoJ2JzLXBhYi1zdGF0LXdhcm4nLCBjLnVubWFwcGVkID4gMCk7XG59XG5cbi8qIC0tLS0gZmllbGQtdHlwZSBwaWNrZXIgbW9kYWwgKGdyaWQpIC0tLS0gKi9cbmZ1bmN0aW9uIGJ1aWxkZXJPcGVuUGlja2VyKCk6IHZvaWQge1xuICBjb25zdCBjYXJkcyA9IEZJRUxEX1RZUEVTLm1hcChmdCA9PlxuICAgIGA8YnV0dG9uIGNsYXNzPVwiYnMtcGFiLXBpY2tlci1jYXJkXCIgb25jbGljaz1cImJ1aWxkZXJBZGRGaWVsZCgnJHtmdC50eXBlfScpXCI+XG4gICAgICA8c3BhbiBjbGFzcz1cImJzLXBhYi1waWNrZXItaWNvblwiPiR7ZXNjKGZ0LmdseXBoKX08L3NwYW4+XG4gICAgICA8c3BhbiBjbGFzcz1cImJzLXBhYi1waWNrZXItbGFiZWxcIj4ke2VzYyhmdC5sYWJlbCl9PC9zcGFuPlxuICAgICAgPHNwYW4gY2xhc3M9XCJicy1wYWItcGlja2VyLXN1YlwiPiR7ZXNjKGZ0LnN1Yil9PC9zcGFuPlxuICAgIDwvYnV0dG9uPmApLmpvaW4oJycpO1xuICBjb25zdCBodG1sID0gYDxkaXYgY2xhc3M9XCJicy1wYWItbW9kYWwtb3ZlcmxheVwiIGlkPVwicGFiLXBpY2tlclwiIHN0eWxlPVwiZGlzcGxheTpmbGV4XCIgb25jbGljaz1cImlmKGV2ZW50LnRhcmdldD09PXRoaXMpYnVpbGRlckNsb3NlUGlja2VyKClcIj5cbiAgICA8ZGl2IGNsYXNzPVwiYnMtcGFiLW1vZGFsIGJzLXBhYi1waWNrZXItbW9kYWxcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJicy1wYWItbW9kYWwtaGVhZGVyXCI+PHNwYW4gY2xhc3M9XCJicy1wYWItbW9kYWwtdGl0bGVcIj5BZGQgYSBGaWVsZDwvc3Bhbj48YnV0dG9uIGNsYXNzPVwiYnMtcGFiLWljb24tYnRuXCIgb25jbGljaz1cImJ1aWxkZXJDbG9zZVBpY2tlcigpXCI+XHUyNzE1PC9idXR0b24+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiYnMtcGFiLXBpY2tlci1ncmlkXCI+JHtjYXJkc308L2Rpdj5cbiAgICA8L2Rpdj5cbiAgPC9kaXY+YDtcbiAgbW91bnRPdmVybGF5KGh0bWwpO1xufVxuZnVuY3Rpb24gYnVpbGRlckNsb3NlUGlja2VyKCk6IHZvaWQgeyB1bm1vdW50T3ZlcmxheSgncGFiLXBpY2tlcicpOyB9XG5cbi8qIC0tLS0gZm9ybS1sZXZlbCBzZXR0aW5ncyBtb2RhbCAtLS0tICovXG5mdW5jdGlvbiBidWlsZGVyRm9ybVNldHRpbmdzKCk6IHZvaWQge1xuICBjb25zdCB0ID0gYnVpbGRlclRlbXBsYXRlKCk7XG4gIGNvbnN0IGh0bWwgPSBgPGRpdiBjbGFzcz1cImJzLXBhYi1tb2RhbC1vdmVybGF5XCIgaWQ9XCJwYWItZm9ybXNldFwiIHN0eWxlPVwiZGlzcGxheTpmbGV4XCIgb25jbGljaz1cImlmKGV2ZW50LnRhcmdldD09PXRoaXMpdW5tb3VudE92ZXJsYXkoJ3BhYi1mb3Jtc2V0JylcIj5cbiAgICA8ZGl2IGNsYXNzPVwiYnMtcGFiLW1vZGFsXCIgc3R5bGU9XCJ3aWR0aDo1MjBweDttYXgtd2lkdGg6OTV2d1wiPlxuICAgICAgPGRpdiBjbGFzcz1cImJzLXBhYi1tb2RhbC1oZWFkZXJcIj48c3BhbiBjbGFzcz1cImJzLXBhYi1tb2RhbC10aXRsZVwiPkZvcm0gU2V0dGluZ3M8L3NwYW4+PGJ1dHRvbiBjbGFzcz1cImJzLXBhYi1pY29uLWJ0blwiIG9uY2xpY2s9XCJ1bm1vdW50T3ZlcmxheSgncGFiLWZvcm1zZXQnKVwiPlx1MjcxNTwvYnV0dG9uPjwvZGl2PlxuICAgICAgPGRpdiBzdHlsZT1cInBhZGRpbmc6MTZweCAyMHB4O2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjE0cHg7bWF4LWhlaWdodDo3MHZoO292ZXJmbG93LXk6YXV0b1wiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiYnMtcGFiLWZpZWxkLWdyb3VwXCI+PGRpdiBjbGFzcz1cImJzLXBhYi1sYWJlbFwiPkFwcGxpY2F0aW9uIHRpdGxlPC9kaXY+XG4gICAgICAgICAgPGlucHV0IGNsYXNzPVwiYnMtcGFiLWlucHV0XCIgdHlwZT1cInRleHRcIiB2YWx1ZT1cIiR7ZXNjKHQudGl0bGUpfVwiIG9uaW5wdXQ9XCJidWlsZGVyU2V0Rm9ybSgndGl0bGUnLHRoaXMudmFsdWUpXCIgYXV0b2NvbXBsZXRlPVwib2ZmXCI+PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJicy1wYWItZmllbGQtZ3JvdXBcIj48ZGl2IGNsYXNzPVwiYnMtcGFiLWxhYmVsXCI+SW50cm8gLyBkZXNjcmlwdGlvbjwvZGl2PlxuICAgICAgICAgIDx0ZXh0YXJlYSBjbGFzcz1cImJzLXBhYi1pbnB1dFwiIHN0eWxlPVwibWluLWhlaWdodDo3MHB4XCIgb25pbnB1dD1cImJ1aWxkZXJTZXRGb3JtKCdkZXNjcmlwdGlvbicsdGhpcy52YWx1ZSlcIj4ke2VzYyh0LmRlc2NyaXB0aW9uKX08L3RleHRhcmVhPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJicy1wYWItaGVscGVyXCI+U2hvd24gdG8gZmFtaWxpZXMgYXQgdGhlIHRvcCBvZiB0aGUgYXBwbGljYXRpb24uPC9kaXY+PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJicy1wYWItZmllbGQtZ3JvdXBcIj48ZGl2IGNsYXNzPVwiYnMtcGFiLWxhYmVsXCI+Q29uZmlybWF0aW9uIG1lc3NhZ2U8L2Rpdj5cbiAgICAgICAgICA8dGV4dGFyZWEgY2xhc3M9XCJicy1wYWItaW5wdXRcIiBzdHlsZT1cIm1pbi1oZWlnaHQ6NTJweFwiIG9uaW5wdXQ9XCJidWlsZGVyU2V0Rm9ybSgnc3VibWl0dGVkTWVzc2FnZScsdGhpcy52YWx1ZSlcIj4ke2VzYyh0LnN0cmluZ3Muc3VibWl0dGVkTWVzc2FnZSB8fCAnJyl9PC90ZXh0YXJlYT5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnMtcGFiLWhlbHBlclwiPlNob3duIGFmdGVyIGEgc3VjY2Vzc2Z1bCBzdWJtaXQuPC9kaXY+PC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgc3R5bGU9XCJwYWRkaW5nOjEycHggMjBweDtib3JkZXItdG9wOjFweCBzb2xpZCB2YXIoLS1icy1ib3JkZXIpO2Rpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6ZmxleC1lbmRcIj5cbiAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJzLXBhYi1idG4gYnMtcGFiLWJ0bi1wcmltYXJ5XCIgb25jbGljaz1cInVubW91bnRPdmVybGF5KCdwYWItZm9ybXNldCcpO2J1aWxkZXJSZWZyZXNoSGVhZGVyKClcIj5Eb25lPC9idXR0b24+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgPC9kaXY+YDtcbiAgbW91bnRPdmVybGF5KGh0bWwpO1xufVxuZnVuY3Rpb24gYnVpbGRlclNldEZvcm0ocHJvcDogJ3RpdGxlJyB8ICdkZXNjcmlwdGlvbicgfCAnc3VibWl0dGVkTWVzc2FnZScsIHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgdCA9IGJ1aWxkZXJUZW1wbGF0ZSgpO1xuICBpZiAocHJvcCA9PT0gJ3N1Ym1pdHRlZE1lc3NhZ2UnKSB0LnN0cmluZ3Muc3VibWl0dGVkTWVzc2FnZSA9IHZhbHVlO1xuICBlbHNlICh0IGFzIGFueSlbcHJvcF0gPSB2YWx1ZTtcbiAgbWFya0RpcnR5KCk7XG59XG5mdW5jdGlvbiBidWlsZGVyUmVmcmVzaEhlYWRlcigpOiB2b2lkIHtcbiAgaWYgKHR5cGVvZiByZW5kZXIgPT09ICdmdW5jdGlvbicpIHJlbmRlcigpO1xufVxuXG4vKiAtLS0tIGxvZ2ljIG92ZXJ2aWV3IG1vZGFsIC0tLS0gKi9cbmZ1bmN0aW9uIGJ1aWxkZXJPcGVuTG9naWMoKTogdm9pZCB7XG4gIGNvbnN0IHQgPSBidWlsZGVyVGVtcGxhdGUoKTtcbiAgY29uc3QgcnVsZXMgPSB0LmZpZWxkcy5maWx0ZXIoZiA9PiBmLnZpc2liaWxpdHkgJiYgZi52aXNpYmlsaXR5LnNvdXJjZUZpZWxkSWQpO1xuICBsZXQgYm9keTogc3RyaW5nO1xuICBpZiAoIXJ1bGVzLmxlbmd0aCkge1xuICAgIGJvZHkgPSBgPGRpdiBjbGFzcz1cImJzLXBhYi1lbXB0eS1zdGF0ZVwiPjxzdHJvbmc+Tm8gY29uZGl0aW9uYWwgcnVsZXM8L3N0cm9uZz5BZGQgYSBydWxlIGZyb20gYSBmaWVsZCdzIExvZ2ljIHNlY3Rpb24gdG8gc2hvdy9oaWRlIGl0IGJhc2VkIG9uIGFuIGVhcmxpZXIgYW5zd2VyLjwvZGl2PmA7XG4gIH0gZWxzZSB7XG4gICAgY29uc3Qgcm93cyA9IHJ1bGVzLm1hcChmID0+IHtcbiAgICAgIGNvbnN0IHNyYyA9IGJ1aWxkZXJGaWVsZCgoZi52aXNpYmlsaXR5IGFzIEFwcFZpc2liaWxpdHkpLnNvdXJjZUZpZWxkSWQpO1xuICAgICAgY29uc3QgdmlzID0gZi52aXNpYmlsaXR5IGFzIEFwcFZpc2liaWxpdHk7XG4gICAgICBsZXQgY29uZCA9ICcnO1xuICAgICAgaWYgKHNyYyAmJiBzcmMudHlwZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIGNvbnN0IG0gPSB2aXMubWF0Y2guYm9vbGVhbiB8fCB7IHRydWU6IGZhbHNlLCBmYWxzZTogZmFsc2UgfTtcbiAgICAgICAgY29uc3QgcGFydHMgPSBbXTsgaWYgKG0udHJ1ZSkgcGFydHMucHVzaCgnWWVzJyk7IGlmIChtLmZhbHNlKSBwYXJ0cy5wdXNoKCdObycpO1xuICAgICAgICBjb25kID0gKHNyYy5sYWJlbCB8fCAnKHVudGl0bGVkKScpICsgJyA9ICcgKyAocGFydHMuam9pbignIG9yICcpIHx8ICcobm9uZSknKTtcbiAgICAgIH0gZWxzZSBpZiAoc3JjKSB7XG4gICAgICAgIGNvbnN0IGNob3NlbiA9IHZpcy5tYXRjaC5vcHRpb25JZHMgfHwgW107XG4gICAgICAgIGNvbnN0IGxhYmVscyA9IChzcmMuc2V0dGluZ3Mub3B0aW9ucyB8fCBbXSkuZmlsdGVyKG8gPT4gY2hvc2VuLmluZGV4T2Yoby5pZCkgPj0gMCkubWFwKG8gPT4gby5sYWJlbCk7XG4gICAgICAgIGNvbmQgPSAoc3JjLmxhYmVsIHx8ICcodW50aXRsZWQpJykgKyAnIGlzICcgKyAobGFiZWxzLmpvaW4oJyAvICcpIHx8ICcobm9uZSknKTtcbiAgICAgIH0gZWxzZSB7IGNvbmQgPSAnKHNvdXJjZSByZW1vdmVkKSc7IH1cbiAgICAgIHJldHVybiBgPHRyPjx0ZCBzdHlsZT1cImZvbnQtd2VpZ2h0OjYwMFwiPiR7ZXNjKGZpZWxkUHJldmlld0xhYmVsKGYpKX08L3RkPjx0ZD5zaG93cyB3aGVuPC90ZD48dGQ+JHtlc2MoY29uZCl9PC90ZD48L3RyPmA7XG4gICAgfSkuam9pbignJyk7XG4gICAgYm9keSA9IGA8dGFibGUgY2xhc3M9XCJicy1wYWItbG9naWMtdGFibGVcIj48dGhlYWQ+PHRyPjx0aD5GaWVsZDwvdGg+PHRoPjwvdGg+PHRoPkNvbmRpdGlvbjwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4ke3Jvd3N9PC90Ym9keT48L3RhYmxlPmA7XG4gIH1cbiAgY29uc3QgaHRtbCA9IGA8ZGl2IGNsYXNzPVwiYnMtcGFiLW1vZGFsLW92ZXJsYXlcIiBpZD1cInBhYi1sb2dpY1wiIHN0eWxlPVwiZGlzcGxheTpmbGV4XCIgb25jbGljaz1cImlmKGV2ZW50LnRhcmdldD09PXRoaXMpdW5tb3VudE92ZXJsYXkoJ3BhYi1sb2dpYycpXCI+XG4gICAgPGRpdiBjbGFzcz1cImJzLXBhYi1tb2RhbCBicy1wYWItbG9naWMtbW9kYWxcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJicy1wYWItbW9kYWwtaGVhZGVyXCI+PHNwYW4gY2xhc3M9XCJicy1wYWItbW9kYWwtdGl0bGVcIj5Mb2dpYyBPdmVydmlldzwvc3Bhbj48YnV0dG9uIGNsYXNzPVwiYnMtcGFiLWljb24tYnRuXCIgb25jbGljaz1cInVubW91bnRPdmVybGF5KCdwYWItbG9naWMnKVwiPlx1MjcxNTwvYnV0dG9uPjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImJzLXBhYi1sb2dpYy10YWJsZS13cmFwXCIgc3R5bGU9XCJwYWRkaW5nOjEycHggMjBweDttYXgtaGVpZ2h0Ojcwdmg7b3ZlcmZsb3cteTphdXRvXCI+JHtib2R5fTwvZGl2PlxuICAgIDwvZGl2PlxuICA8L2Rpdj5gO1xuICBtb3VudE92ZXJsYXkoaHRtbCk7XG59XG5cbi8qIC0tLS0gc2F2ZSAvIHB1Ymxpc2ggLS0tLSAqL1xuZnVuY3Rpb24gYnVpbGRlclZhbGlkYXRlKHQ6IEFwcFRlbXBsYXRlKTogc3RyaW5nIHtcbiAgZm9yIChjb25zdCBmIG9mIHQuZmllbGRzKSB7XG4gICAgaWYgKChmLnR5cGUgPT09ICdzaW5nbGVfc2VsZWN0JyB8fCBmLnR5cGUgPT09ICdtdWx0aV9zZWxlY3QnKSkge1xuICAgICAgY29uc3Qgb3B0cyA9IChmLnNldHRpbmdzLm9wdGlvbnMgfHwgW10pLmZpbHRlcihvID0+IG8ubGFiZWwudHJpbSgpKTtcbiAgICAgIGlmICghb3B0cy5sZW5ndGgpIHJldHVybiAnVGhlIGNob2ljZSBxdWVzdGlvbiBcIicgKyAoZi5sYWJlbCB8fCAnVW50aXRsZWQnKSArICdcIiBuZWVkcyBhdCBsZWFzdCBvbmUgb3B0aW9uLic7XG4gICAgfVxuICB9XG4gIHJldHVybiAnJztcbn1cblxuYXN5bmMgZnVuY3Rpb24gYnVpbGRlclNhdmUoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmIChCVUlMREVSLmJ1c3kpIHJldHVybjtcbiAgY29uc3QgdCA9IGJ1aWxkZXJUZW1wbGF0ZSgpO1xuICBCVUlMREVSLmJ1c3kgPSAnc2F2aW5nJztcbiAgYnVpbGRlclNldEJ0bnModHJ1ZSwgJ1NhdmluZ1x1MjAyNicsIG51bGwpO1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGFwaVNhdmVBcHBUZW1wbGF0ZSh0KTtcbiAgICBCVUlMREVSLmxhc3RVcGRhdGVkID0gKHJlcyAmJiByZXMubGFzdFVwZGF0ZWQpIHx8IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICBCVUlMREVSLmRpcnR5ID0gZmFsc2U7XG4gICAgdG9hc3QoJ0RyYWZ0IHNhdmVkJyk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIHRvYXN0KCdTYXZlIGZhaWxlZDogJyArIChlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSkpO1xuICB9IGZpbmFsbHkge1xuICAgIEJVSUxERVIuYnVzeSA9ICcnO1xuICAgIGJ1aWxkZXJTZXRCdG5zKGZhbHNlLCAnU2F2ZSBEcmFmdCcsIEJVSUxERVIuZGlydHkgPyAnVW5zYXZlZCBjaGFuZ2VzJyA6ICdTYXZlZCcpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGJ1aWxkZXJQdWJsaXNoKCk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoQlVJTERFUi5idXN5KSByZXR1cm47XG4gIGNvbnN0IHQgPSBidWlsZGVyVGVtcGxhdGUoKTtcbiAgY29uc3QgcHJvYmxlbSA9IGJ1aWxkZXJWYWxpZGF0ZSh0KTtcbiAgaWYgKHByb2JsZW0pIHsgdG9hc3QocHJvYmxlbSk7IHJldHVybjsgfVxuICBpZiAoIWNvbmZpcm0oJ1B1Ymxpc2ggdGhpcyBhcHBsaWNhdGlvbj8gRmFtaWxpZXMgb3BlbmluZyB0aGVpciBsaW5rIHdpbGwgc2VlIHRoaXMgdmVyc2lvbi4nKSkgcmV0dXJuO1xuICBCVUlMREVSLmJ1c3kgPSAncHVibGlzaGluZyc7XG4gIGJ1aWxkZXJTZXRCdG5zKHRydWUsIG51bGwsICdQdWJsaXNoaW5nXHUyMDI2Jyk7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgYXBpUHVibGlzaEFwcFRlbXBsYXRlKHQpO1xuICAgIEJVSUxERVIubGFzdFB1Ymxpc2hlZCA9IChyZXMgJiYgcmVzLmxhc3RQdWJsaXNoZWQpIHx8IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICBCVUlMREVSLmxhc3RVcGRhdGVkID0gKHJlcyAmJiByZXMubGFzdFVwZGF0ZWQpIHx8IEJVSUxERVIubGFzdFB1Ymxpc2hlZDtcbiAgICBCVUlMREVSLmRpcnR5ID0gZmFsc2U7XG4gICAgdG9hc3QoJ1B1Ymxpc2hlZCcpO1xuICAgIGlmICh0eXBlb2YgcmVuZGVyID09PSAnZnVuY3Rpb24nKSByZW5kZXIoKTtcbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgdG9hc3QoJ1B1Ymxpc2ggZmFpbGVkOiAnICsgKGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpKSk7XG4gIH0gZmluYWxseSB7XG4gICAgQlVJTERFUi5idXN5ID0gJyc7XG4gICAgYnVpbGRlclNldEJ0bnMoZmFsc2UsICdTYXZlIERyYWZ0JywgbnVsbCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gYnVpbGRlclNldEJ0bnMoZGlzYWJsZWQ6IGJvb2xlYW4sIHNhdmVMYWJlbDogc3RyaW5nIHwgbnVsbCwgZGlydHlMYWJlbDogc3RyaW5nIHwgbnVsbCk6IHZvaWQge1xuICBjb25zdCBzYXZlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhYi1zYXZlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuICBjb25zdCBwdWIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGFiLXB1Ymxpc2gnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG4gIGlmIChzYXZlKSB7IHNhdmUuZGlzYWJsZWQgPSBkaXNhYmxlZDsgaWYgKHNhdmVMYWJlbCkgc2F2ZS50ZXh0Q29udGVudCA9ICdcdUQ4M0RcdURDQkUgJyArIHNhdmVMYWJlbDsgfVxuICBpZiAocHViKSBwdWIuZGlzYWJsZWQgPSBkaXNhYmxlZDtcbiAgaWYgKGRpcnR5TGFiZWwgIT09IG51bGwpIHsgY29uc3QgZCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYWItZGlydHknKTsgaWYgKGQpIGQudGV4dENvbnRlbnQgPSBkaXJ0eUxhYmVsOyB9XG59XG5cbi8qIC0tLS0gdGlueSBvdmVybGF5IGhlbHBlcnMgKHNoYXJlZCBtb2RhbCBtb3VudCB1bmRlciA8Ym9keT4pIC0tLS0gKi9cbmZ1bmN0aW9uIG1vdW50T3ZlcmxheShodG1sOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgaG9zdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBob3N0LmlubmVySFRNTCA9IGh0bWw7XG4gIGNvbnN0IG5vZGUgPSBob3N0LmZpcnN0RWxlbWVudENoaWxkO1xuICBpZiAobm9kZSkgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChub2RlKTtcbn1cbmZ1bmN0aW9uIHVubW91bnRPdmVybGF5KGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZCk7XG4gIGlmIChlbCkgZWwucmVtb3ZlKCk7XG59XG5cbi8qIC0tLS0gbWlzYyAtLS0tICovXG5mdW5jdGlvbiBmbXRTdGFtcChpc286IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICghaXNvKSByZXR1cm4gJyc7XG4gIHRyeSB7XG4gICAgLy8gSmF2YSBab25lZERhdGVUaW1lLnRvU3RyaW5nKCkgYXBwZW5kcyBhIFwiW1pvbmVdXCIgc3VmZml4IChlLmcuXG4gICAgLy8gMjAyNi0wNi0zMFQwMDoxNTo1Ny4yMTAtMDY6MDBbVVMvTW91bnRhaW5dKSB0aGF0IERhdGUgY2FuJ3QgcGFyc2UgXHUyMDE0IHN0cmlwIGl0LlxuICAgIGNvbnN0IGNsZWFuID0gaXNvLnJlcGxhY2UoL1xcW1teXFxdXSpcXF1cXHMqJC8sICcnKTtcbiAgICBjb25zdCBkID0gbmV3IERhdGUoY2xlYW4pO1xuICAgIGlmIChpc05hTihkLmdldFRpbWUoKSkpIHJldHVybiBjbGVhbjtcbiAgICByZXR1cm4gZC50b0xvY2FsZURhdGVTdHJpbmcodW5kZWZpbmVkLCB7IG1vbnRoOiAnc2hvcnQnLCBkYXk6ICdudW1lcmljJywgeWVhcjogJ251bWVyaWMnIH0pO1xuICB9IGNhdGNoIChfZSkgeyByZXR1cm4gaXNvOyB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUErREEsTUFBTSxpQkFBcUQ7QUFBQSxFQUN6RCxFQUFFLE9BQU8sSUFBSSxPQUFPLDJCQUFpQjtBQUFBLEVBQ3JDLEVBQUUsT0FBTyxhQUFhLE9BQU8sMkJBQXNCO0FBQUEsRUFDbkQsRUFBRSxPQUFPLFlBQVksT0FBTywwQkFBcUI7QUFBQSxFQUNqRCxFQUFFLE9BQU8sWUFBWSxPQUFPLCtCQUEwQjtBQUFBLEVBQ3RELEVBQUUsT0FBTyxTQUFTLE9BQU8sc0JBQWlCO0FBQUEsRUFDMUMsRUFBRSxPQUFPLE9BQU8sT0FBTyw4QkFBeUI7QUFBQSxFQUNoRCxFQUFFLE9BQU8sUUFBUSxPQUFPLDJCQUFzQjtBQUFBLEVBQzlDLEVBQUUsT0FBTyxhQUFhLE9BQU8sMkJBQXNCO0FBQUEsRUFDbkQsRUFBRSxPQUFPLGVBQWUsT0FBTyw2QkFBd0I7QUFBQSxFQUN2RCxFQUFFLE9BQU8sWUFBWSxPQUFPLHFCQUFnQjtBQUFBLEVBQzVDLEVBQUUsT0FBTyxhQUFhLE9BQU8sc0JBQWlCO0FBQUEsRUFDOUMsRUFBRSxPQUFPLFdBQVcsT0FBTyxvQkFBZTtBQUFBLEVBQzFDLEVBQUUsT0FBTyxPQUFPLE9BQU8sb0JBQWU7QUFBQSxFQUN0QyxFQUFFLE9BQU8sVUFBVSxPQUFPLHVCQUFrQjtBQUFBLEVBQzVDLEVBQUUsT0FBTyxZQUFZLE9BQU8seUJBQW9CO0FBQUEsRUFDaEQsRUFB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
