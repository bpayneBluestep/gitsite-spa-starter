/* =====================================================================
   agreementbuilder.ts — the Agreement Template builder (route #/agreementbuilder,
   reached straight from Settings ▸ Agreements). Authors reusable e-sign templates
   stored on thisOrg.agreementTemplates via the maestro.

   Template model (bodyJson), schema v2:
     { schemaVersion: 2, title, roles:[{id,label,kind,order}],
       fields:[{id,roleId,type,label,options[],required}], contentHtml }

   contentHtml is rich HTML carrying tokens the signing page + finalize render:
     {{merge:key}}      client/org data
     {{sig:roleId}}     signature      {{date:roleId}}  signed date
     {{name:roleId}}    the name that role TYPED when signing
     {{initials:roleId}}
     {{field:fieldId}}  an author-defined fillable field
   Tokens are inserted as literal text so the render pipeline can find + replace them.

   Why fields live in a registry instead of inside the token: option labels contain
   colons and braces ("Plan A: monthly" / "50% now, 50% on discharge"), which no
   amount of escaping makes safe inside {{...:...}}. The token carries an id; the
   registry carries the data.

   v1 templates are upgraded in memory when opened and persisted on save — never a
   bulk rewrite, so an untouched template keeps working exactly as it did.
   ===================================================================== */

interface AgbState { list: any[] | null; loading: boolean; error: string | null; editing: any | null; }
const AGB: AgbState = { list: null, loading: false, error: null, editing: null };

// consultantName is deliberately absent. It was a merge field, which made it org
// data — but the consultant is a SIGNER, and what belongs in the document is the
// name they typed when they signed it. That is {{name:<their role>}}.
const AGB_MERGE_VARS = ['clientFullName', 'clientFirstName', 'clientLastName', 'clientDob', 'orgName', 'todayDate'];

const AGB_FIELD_TYPES: { v: string; label: string; opts: boolean }[] = [
  { v: 'text', label: 'Text box', opts: false },
  { v: 'checkbox', label: 'Checkboxes', opts: true },
  { v: 'select', label: 'Choose one', opts: true },
  { v: 'multiselect', label: 'Choose many', opts: true },
];

// US Letter with 1in margins, in CSS pixels (96/in). The SAME geometry the PDF
// renderer sets via @page — that shared number is the entire reason the editor can
// predict where a page will break.
const AGB_PAGE_H = 9 * 96;

async function agbLoad(force = false): Promise<void> {
  if (AGB.loading) return;
  if (AGB.list && !force) return;
  AGB.loading = true; AGB.error = null;
  try { AGB.list = await apiListAgreementTemplates() || []; }
  catch (e: any) { AGB.error = e && e.message ? e.message : String(e); }
  AGB.loading = false;
  if (location.hash.indexOf('agreementbuilder') >= 0) render();
}

function viewAgreementBuilder(): string {
  if (AGB.editing) return shell('', agbEditor(AGB.editing));
  if (AGB.list === null) { if (!AGB.loading && !AGB.error) agbLoad(); return shell('', AGB.error ? errorCard(AGB.error) : loadingCard('Loading templates…')); }
  return shell('', agbListView());
}

// ── list view ────────────────────────────────────────────────────────────────
function agbListView(): string {
  const head = `<div class="page-head"><div><h1>Agreement Templates</h1><p>Author reusable e-signature templates. Only <b>Active</b> templates appear when sending.</p></div>
    <div><a class="btn ghost" href="#/settings">${ic('chevR', 14)} Settings</a> <button class="btn primary" onclick="agbNew()">${ic('plus', 15)} New template</button></div></div>`;
  if (!AGB.list || !AGB.list.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic('fileText', 22)}</div><b>No templates yet</b><p>Create your first engagement letter or fee agreement.</p></div></div>`;
  }
  const rows = AGB.list.map((t: any) => {
    const cls = t.status === 'Active' ? 'ok' : t.status === 'Archived' ? 'muted' : 'draft';
    return `<tr class="clickable" onclick="agbEdit('${esc(t.entryId)}')">
      <td><b>${esc(t.name)}</b>${t.description ? `<div class="meta">${esc(t.description)}</div>` : ''}</td>
      <td>${esc(t.category || '—')}</td>
      <td><span class="pill ${cls}">${esc(t.status || 'Draft')}</span></td>
      <td class="muted">v${esc(String(t.version || 1))}</td>
    </tr>`;
  }).join('');
  return head + `<div class="tbl-wrap"><table><thead class="rich"><tr><th>Template</th><th>Category</th><th>Status</th><th>Version</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// Bring any template body up to schema v2 shape. Safe to call repeatedly.
function agbUpgrade(b: any): any {
  const body = b && typeof b === 'object' ? b : {};
  if (!Array.isArray(body.roles)) body.roles = [];
  if (!Array.isArray(body.fields)) body.fields = [];
  if (typeof body.contentHtml !== 'string') body.contentHtml = '';
  body.schemaVersion = 2;
  return body;
}

function agbNew(): void {
  AGB.editing = {
    entryId: null, name: '', description: '', status: 'Draft', category: 'Engagement Letter',
    bodyJson: agbUpgrade({ title: '', roles: [{ id: 'parent1', label: 'Parent / Guardian', kind: 'external', order: 1 }] }),
  };
  render();
}
function agbEdit(entryId: string): void {
  const t = (AGB.list || []).find((x: any) => x.entryId === entryId);
  if (!t) return;
  // deep-ish clone so edits don't mutate the cached list until saved
  AGB.editing = JSON.parse(JSON.stringify(t));
  AGB.editing.bodyJson = agbUpgrade(AGB.editing.bodyJson || { title: t.name });
  render();
}
function agbCancel(): void { AGB.editing = null; render(); }

// ── editor ───────────────────────────────────────────────────────────────────
function agbEditor(t: any): string {
  const b = t.bodyJson || {};
  const cats = ['Engagement Letter', 'Fee Agreement', 'Consent / ROI', 'Other'];
  const catOpts = cats.map(c => `<option value="${esc(c)}"${t.category === c ? ' selected' : ''}>${esc(c)}</option>`).join('');
  const statuses = ['Draft', 'Active', 'Archived'];
  const stOpts = statuses.map(s => `<option value="${esc(s)}"${t.status === s ? ' selected' : ''}>${esc(s)}</option>`).join('');
  const roles = (b.roles || []) as any[];
  const fields = (b.fields || []) as any[];

  const roleRows = roles.map((r, i) => `<div class="agb-role" data-i="${i}">
      <input data-rk="label" value="${esc(r.label || '')}" placeholder="Role label" oninput="agbRoleChange(${i},'label',this.value)">
      <button class="btn ghost sm agb-role-x" onclick="agbRoleRemove(${i})" title="Remove">${ic('trash', 13)}</button>
      <select data-rk="kind" onchange="agbRoleChange(${i},'kind',this.value)">
        <option value="external"${r.kind !== 'consultant' ? ' selected' : ''}>External (email link)</option>
        <option value="consultant"${r.kind === 'consultant' ? ' selected' : ''}>Consultant (signs in-app)</option>
      </select>
    </div>`).join('');

  // Per-role signature/date/name/initials tokens.
  const roleTokens = roles.map(r => `<div class="agb-tok-role"><span class="agb-tok-label">${esc(r.label || r.id)}:</span>
      <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbInsert('{{sig:${esc(r.id)}}}')">${ic('pen', 12)} Signature</button>
      <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbInsert('{{name:${esc(r.id)}}}')">Name</button>
      <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbInsert('{{date:${esc(r.id)}}}')">Date</button>
      <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbInsert('{{initials:${esc(r.id)}}}')">Initials</button>
    </div>`).join('');

  const mergeBtns = AGB_MERGE_VARS.map(v => `<button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbInsert('{{merge:${v}}}')">${v}</button>`).join('');
  const roleOpts = (sel: string) => roles.map(r =>
    `<option value="${esc(r.id)}"${r.id === sel ? ' selected' : ''}>${esc(r.label || r.id)}</option>`).join('');

  const fieldRows = fields.map((f, i) => {
    const typeSel = AGB_FIELD_TYPES.map(ft =>
      `<option value="${ft.v}"${f.type === ft.v ? ' selected' : ''}>${esc(ft.label)}</option>`).join('');
    const needsOpts = f.type !== 'text';
    return `<div class="agb-field">
      <div class="agb-f-top">
        <input class="agb-f-label" value="${esc(f.label || '')}" placeholder="Field label" oninput="agbFieldChange(${i},'label',this.value)">
        <button class="btn ghost sm" onclick="agbFieldRemove(${i})" title="Remove">${ic('trash', 13)}</button>
      </div>
      <div class="agb-f-row">
        <select onchange="agbFieldChange(${i},'type',this.value)">${typeSel}</select>
        <select onchange="agbFieldChange(${i},'roleId',this.value)">${roleOpts(f.roleId)}</select>
      </div>
      ${needsOpts ? `<textarea class="agb-f-opts" rows="3" placeholder="One option per line"
        oninput="agbFieldChange(${i},'optionsText',this.value)">${esc((f.options || []).join('\n'))}</textarea>` : ''}
      <div class="agb-f-row2">
        <label class="agb-f-req"><input type="checkbox"${f.required !== false ? ' checked' : ''}
          onchange="agbFieldChange(${i},'required',this.checked)"> Required</label>
        <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbInsert('{{field:${esc(f.id)}}}')">${ic('plus', 12)} Insert</button>
      </div>
    </div>`;
  }).join('');

  return `<div class="page-head"><div><h1>${t.entryId ? 'Edit' : 'New'} Template</h1><p>Write the agreement, then drop signature and fillable fields where they belong.</p></div>
      <div><button class="btn ghost" onclick="agbCancel()">${ic('x', 14)} Cancel</button>
      <button class="btn primary" onclick="agbSave()" id="agb-save">${ic('save', 15)} Save</button></div></div>
    <div class="agb-grid">
      <div class="agb-side">
        <div class="card">
          <div class="field"><label>Name</label><input id="agb-name" value="${esc(t.name || '')}" placeholder="Engagement Agreement"></div>
          <div class="field"><label>Description</label><input id="agb-desc" value="${esc(t.description || '')}" placeholder="Short description"></div>
          <div class="field"><label>Category</label><select id="agb-cat">${catOpts}</select></div>
          <div class="field"><label>Status</label><select id="agb-status">${stOpts}</select></div>
        </div>
        <div class="card">
          <div class="agb-side-h">Signer roles</div>
          <div id="agb-roles">${roleRows}</div>
          <button class="btn ghost sm" onclick="agbRoleAdd()">${ic('plus', 13)} Add role</button>
        </div>
        <div class="card">
          <div class="agb-side-h">Fillable fields</div>
          ${fields.length ? fieldRows : '<p class="muted agb-f-none">Text boxes and choices the signer fills in. Each one belongs to exactly one signer.</p>'}
          <button class="btn ghost sm" onclick="agbFieldAdd()" ${roles.length ? '' : 'disabled title="Add a signer role first"'}>${ic('plus', 13)} Add field</button>
        </div>
      </div>
      <div class="agb-main">
        <div class="agb-toolbar">
          <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmt('bold')"><b>B</b></button>
          <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmt('italic')"><i>I</i></button>
          <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmt('underline')"><u>U</u></button>
          <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmtBlock('h2')">H</button>
          <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmt('insertUnorderedList')">• List</button>
          <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmt('insertOrderedList')">1. List</button>
          <span class="agb-tb-sep"></span>
          <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbPageBreak()" title="Force a new page here">${ic('fileText', 12)} Page break</button>
        </div>
        <div class="agb-sheet-scroll">
          <div class="agb-sheet">
            <div class="agb-guides" id="agb-guides"></div>
            <div id="agb-body" class="agb-body" contenteditable="true" oninput="agbBodyInput()">${b.contentHtml || '<p></p>'}</div>
          </div>
        </div>
        <div class="card agb-tokens">
          <div class="agb-side-h">Insert merge fields</div>
          <div class="agb-tok-row">${mergeBtns}</div>
          <div class="agb-side-h" style="margin-top:12px">Insert signer fields</div>
          ${roleTokens || '<p class="muted">Add a signer role to insert its fields.</p>'}
        </div>
      </div>
    </div>`;
}

// ── page guides ──────────────────────────────────────────────────────────────
/* Draw a marker at every page boundary and push manual breaks down to the next one.

   This is where the editor earns "what you see is what prints": the boundary
   positions come from AGB_PAGE_H, the same 9in of content the PDF's @page rule
   produces. An AUTOMATIC break can still land a line off, because Chrome and the
   server-side PDF renderer are different layout engines — but a MANUAL break is
   exact, because both sides honour it explicitly. Authors who need a guaranteed
   break insert one. */
function agbDrawGuides(): void {
  const body = document.getElementById('agb-body');
  const guides = document.getElementById('agb-guides');
  if (!body || !guides) return;

  // Manual breaks first — they change the height the guides are measured against.
  const breaks = body.querySelectorAll('.pgbrk');
  for (let i = 0; i < breaks.length; i++) {
    const el = breaks[i] as HTMLElement;
    el.style.marginBottom = '0px';
  }
  for (let i = 0; i < breaks.length; i++) {
    const el = breaks[i] as HTMLElement;
    const top = el.offsetTop;
    const next = Math.ceil((top + 1) / AGB_PAGE_H) * AGB_PAGE_H;
    el.style.marginBottom = Math.max(0, next - top - el.offsetHeight) + 'px';
  }

  const h = Math.max(body.scrollHeight, AGB_PAGE_H);
  const pages = Math.max(1, Math.ceil(h / AGB_PAGE_H));
  let out = '';
  for (let p = 1; p < pages; p++) {
    out += '<div class="agb-guide" style="top:' + (p * AGB_PAGE_H) + 'px"><span>Page ' + (p + 1) + '</span></div>';
  }
  guides.innerHTML = out;
  guides.style.height = (pages * AGB_PAGE_H) + 'px';
  body.style.minHeight = (pages * AGB_PAGE_H) + 'px';
}

let AGB_GUIDE_T: any = null;
function agbBodyInput(): void {
  if (AGB_GUIDE_T) clearTimeout(AGB_GUIDE_T);
  AGB_GUIDE_T = setTimeout(agbDrawGuides, 120);
}

function agbPageBreak(): void {
  agbInsertNode(function () {
    const d = document.createElement('div');
    d.className = 'pgbrk';
    d.setAttribute('contenteditable', 'false');
    return d;
  });
  agbDrawGuides();
}

// keep the editing model in sync with the side inputs on save (read from DOM)
function agbFmt(cmd: string): void { try { document.execCommand(cmd, false); } catch (_e) { /* */ } agbFocusBody(); agbBodyInput(); }
function agbFmtBlock(tag: string): void { try { document.execCommand('formatBlock', false, tag); } catch (_e) { /* */ } agbFocusBody(); agbBodyInput(); }
function agbFocusBody(): void { const el = document.getElementById('agb-body'); if (el) el.focus(); }

// Insert a node at the caret inside the body (falls back to append).
function agbInsertNode(make: () => Node): void {
  const el = document.getElementById('agb-body'); if (!el) return;
  el.focus();
  const node = make();
  const sel = window.getSelection();
  if (sel && sel.rangeCount && el.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    el.appendChild(node);
  }
}

// Insert a token at the caret inside the body.
function agbInsert(token: string): void {
  agbInsertNode(() => document.createTextNode(' ' + token + ' '));
  agbBodyInput();
}

function agbRoleAdd(): void {
  const roles = AGB.editing.bodyJson.roles;
  const n = roles.length + 1;
  roles.push({ id: 'role' + n + '_' + Math.floor(Math.random() * 1000), label: 'Signer ' + n, kind: 'external', order: n });
  agbCaptureBody(); render();
}
function agbRoleRemove(i: number): void {
  const roles = AGB.editing.bodyJson.roles;
  const gone = roles[i];
  roles.splice(i, 1);
  // Fields belonged to that role. Reassign rather than orphan them: an orphaned
  // field renders as nothing and silently drops a clause from the agreement.
  if (gone && roles.length) {
    for (const f of (AGB.editing.bodyJson.fields || [])) if (f.roleId === gone.id) f.roleId = roles[0].id;
  }
  agbCaptureBody(); render();
}
function agbRoleChange(i: number, key: string, val: string): void { if (AGB.editing.bodyJson.roles[i]) AGB.editing.bodyJson.roles[i][key] = val; }

function agbFieldAdd(): void {
  const b = AGB.editing.bodyJson;
  const roles = b.roles || [];
  if (!roles.length) { toast('Add a signer role first — every field belongs to one signer.'); return; }
  b.fields.push({
    id: 'f' + (b.fields.length + 1) + '_' + Math.floor(Math.random() * 1000),
    roleId: roles[0].id,
    type: 'text',
    label: 'Field ' + (b.fields.length + 1),
    options: [],
    required: true,
  });
  agbCaptureBody(); render();
}
function agbFieldRemove(i: number): void { AGB.editing.bodyJson.fields.splice(i, 1); agbCaptureBody(); render(); }
function agbFieldChange(i: number, key: string, val: any): void {
  const f = AGB.editing.bodyJson.fields[i];
  if (!f) return;
  if (key === 'optionsText') {
    f.options = String(val).split('\n').map(s => s.trim()).filter(s => !!s);
    return; // no re-render: it would kill the caret mid-typing
  }
  f[key] = val;
  // Switching to/from a choice type shows or hides the options box.
  if (key === 'type') { agbCaptureBody(); render(); }
}

// Read the contenteditable body into the model (before a re-render would wipe it).
function agbCaptureBody(): void {
  const el = document.getElementById('agb-body');
  if (el && AGB.editing) AGB.editing.bodyJson.contentHtml = el.innerHTML;
}

async function agbSave(): Promise<void> {
  const t = AGB.editing; if (!t) return;
  const name = (document.getElementById('agb-name') as HTMLInputElement).value.trim();
  if (!name) { toast('Give the template a name.'); return; }
  agbCaptureBody();

  // A choice field with no options renders as nothing — an invisible hole in a
  // signed agreement. Refuse the save rather than ship one.
  for (const f of (t.bodyJson.fields || [])) {
    if (f.type !== 'text' && !(f.options || []).length) {
      toast('"' + (f.label || 'A field') + '" needs at least one option to choose from.');
      return;
    }
    if (!String(f.label || '').trim()) { toast('Every fillable field needs a label.'); return; }
  }

  const body = {
    schemaVersion: 2,
    title: name,
    roles: t.bodyJson.roles,
    fields: t.bodyJson.fields,
    contentHtml: t.bodyJson.contentHtml || '',
  };
  const fields = {
    name: name,
    description: (document.getElementById('agb-desc') as HTMLInputElement).value.trim(),
    category: (document.getElementById('agb-cat') as HTMLSelectElement).value,
    status: (document.getElementById('agb-status') as HTMLSelectElement).value,
    bodyJson: body,
  };
  const btn = document.getElementById('agb-save') as HTMLButtonElement | null;
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    await apiSaveAgreementTemplate(t.entryId, fields);
    AGB.editing = null;
    await agbLoad(true);
    toast('Template saved.');
  } catch (e: any) {
    if (btn) { btn.disabled = false; btn.innerHTML = ic('save', 15) + ' Save'; }
    toast('Save failed: ' + (e && e.message ? e.message : String(e)));
  }
}
