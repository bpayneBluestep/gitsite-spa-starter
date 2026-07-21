/* =====================================================================
   agreementbuilder.ts — the Agreement Template builder (route #/agreementbuilder,
   launched from Settings ▸ Agreements). Authors reusable e-sign templates stored
   on thisOrg.agreementTemplates via the maestro.

   Template model (bodyJson):
     { schemaVersion, title, roles:[{id,label,kind,order}], contentHtml }
   contentHtml is rich HTML carrying tokens the signing page + finalize render:
     {{merge:key}}  → client/consultant/org data
     {{sig:roleId}} → that role's signature   {{date:roleId}} → signed date
     {{initials:roleId}} · {{text:roleId:Label}}
   The consultant writes the body in a contenteditable; tokens are inserted as
   literal text so the render pipeline can find + replace them.
   ===================================================================== */

interface AgbState { list: any[] | null; loading: boolean; error: string | null; editing: any | null; }
const AGB: AgbState = { list: null, loading: false, error: null, editing: null };
const AGB_MERGE_VARS = ['clientFullName', 'clientFirstName', 'clientLastName', 'clientDob', 'consultantName', 'orgName', 'todayDate'];

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
    <div><a class="btn ghost" href="#/settings/agreements">${ic('chevR', 14)} Settings</a> <button class="btn primary" onclick="agbNew()">${ic('plus', 15)} New template</button></div></div>`;
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

function agbNew(): void {
  AGB.editing = { entryId: null, name: '', description: '', status: 'Draft', category: 'Engagement Letter',
    bodyJson: { schemaVersion: 1, title: '', roles: [{ id: 'parent1', label: 'Parent / Guardian', kind: 'external', order: 1 }], contentHtml: '' } };
  render();
}
function agbEdit(entryId: string): void {
  const t = (AGB.list || []).find((x: any) => x.entryId === entryId);
  if (!t) return;
  // deep-ish clone so edits don't mutate the cached list until saved
  AGB.editing = JSON.parse(JSON.stringify(t));
  if (!AGB.editing.bodyJson) AGB.editing.bodyJson = { schemaVersion: 1, title: t.name, roles: [], contentHtml: '' };
  if (!Array.isArray(AGB.editing.bodyJson.roles)) AGB.editing.bodyJson.roles = [];
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
  const roleRows = roles.map((r, i) => `<div class="agb-role" data-i="${i}">
      <input data-rk="label" value="${esc(r.label || '')}" placeholder="Role label" oninput="agbRoleChange(${i},'label',this.value)">
      <select data-rk="kind" onchange="agbRoleChange(${i},'kind',this.value)">
        <option value="external"${r.kind !== 'consultant' ? ' selected' : ''}>External (email link)</option>
        <option value="consultant"${r.kind === 'consultant' ? ' selected' : ''}>Consultant (signs in-app)</option>
      </select>
      <button class="btn ghost sm" onclick="agbRoleRemove(${i})" title="Remove">${ic('trash', 13)}</button>
    </div>`).join('');
  // token insert buttons per role
  const roleTokens = roles.map(r => `<div class="agb-tok-role"><span class="agb-tok-label">${esc(r.label || r.id)}:</span>
      <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbInsert('{{sig:${esc(r.id)}}}')">${ic('pen', 12)} Signature</button>
      <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbInsert('{{date:${esc(r.id)}}}')">Date</button>
      <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbInsert('{{initials:${esc(r.id)}}}')">Initials</button>
    </div>`).join('');
  const mergeBtns = AGB_MERGE_VARS.map(v => `<button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbInsert('{{merge:${v}}}')">${v}</button>`).join('');

  return `<div class="page-head"><div><h1>${t.entryId ? 'Edit' : 'New'} Template</h1><p>Write the agreement body and drop signature/date fields for each signer role.</p></div>
      <div><button class="btn ghost" onclick="agbCancel()">${ic('x', 14)} Cancel</button>
      <button class="btn primary" onclick="agbSave()" id="agb-save">${ic('save', 15)} Save</button></div></div>
    <div class="agb-grid">
      <div class="agb-side">
        <div class="card">
          <div class="field"><label>Name</label><input id="agb-name" value="${esc(t.name || '')}" placeholder="Engagement Agreement"></div>
          <div class="field"><label>Description</label><input id="agb-desc" value="${esc(t.description || '')}" placeholder="Short description"></div>
          <div class="field"><label>Category</label><select id="agb-cat">${catOpts}</select></div>
          <div class="field"><label>Status</label><select id="agb-status">${stOpts}</select><p class="muted" style="margin-top:4px">Set <b>Active</b> to make it sendable.</p></div>
        </div>
        <div class="card">
          <div class="agb-side-h">Signer roles</div>
          <div id="agb-roles">${roleRows}</div>
          <button class="btn ghost sm" onclick="agbRoleAdd()">${ic('plus', 13)} Add role</button>
        </div>
      </div>
      <div class="agb-main">
        <div class="card">
          <div class="agb-toolbar">
            <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmt('bold')"><b>B</b></button>
            <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmt('italic')"><i>I</i></button>
            <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmt('underline')"><u>U</u></button>
            <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmtBlock('h2')">H</button>
            <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmt('insertUnorderedList')">• List</button>
            <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmt('insertOrderedList')">1. List</button>
          </div>
          <div id="agb-body" class="agb-body" contenteditable="true">${b.contentHtml || '<p></p>'}</div>
        </div>
        <div class="card agb-tokens">
          <div class="agb-side-h">Insert merge fields</div>
          <div class="agb-tok-row">${mergeBtns}</div>
          <div class="agb-side-h" style="margin-top:12px">Insert signature / date fields</div>
          ${roleTokens || '<p class="muted">Add a signer role to insert its fields.</p>'}
        </div>
      </div>
    </div>`;
}

// keep the editing model in sync with the side inputs on save (read from DOM)
function agbFmt(cmd: string): void { try { document.execCommand(cmd, false); } catch (_e) { /* */ } agbFocusBody(); }
function agbFmtBlock(tag: string): void { try { document.execCommand('formatBlock', false, tag); } catch (_e) { /* */ } agbFocusBody(); }
function agbFocusBody(): void { const el = document.getElementById('agb-body'); if (el) el.focus(); }

// Insert a token at the caret inside the body (falls back to append).
function agbInsert(token: string): void {
  const el = document.getElementById('agb-body'); if (!el) return;
  el.focus();
  const sel = window.getSelection();
  if (sel && sel.rangeCount && el.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(' ' + token + ' '));
    range.collapse(false);
  } else {
    el.innerHTML += ' ' + token + ' ';
  }
}

function agbRoleAdd(): void {
  const roles = AGB.editing.bodyJson.roles;
  const n = roles.length + 1;
  roles.push({ id: 'role' + n + '_' + Math.floor(Math.random() * 1000), label: 'Signer ' + n, kind: 'external', order: n });
  agbCaptureBody(); render();
}
function agbRoleRemove(i: number): void { AGB.editing.bodyJson.roles.splice(i, 1); agbCaptureBody(); render(); }
function agbRoleChange(i: number, key: string, val: string): void { if (AGB.editing.bodyJson.roles[i]) AGB.editing.bodyJson.roles[i][key] = val; }

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
  const body = {
    schemaVersion: 1,
    title: name,
    roles: t.bodyJson.roles,
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
