/* =====================================================================
   settings.ts — the Settings page: a panel framework over org Settings.

   All org-wide config lives in one JSON memo on the org record, feature-
   namespaced (e.g. settings.contacts.relationships, settings.files.defaultFolders).
   The page is a left panel-nav + the active panel on the right. Adding a future
   settings area = one entry in SETTINGS_PANELS + a render fn.

   Most panels are just an editable string list (relationship options, default
   folders, …), so there's ONE generic list editor registered by key — see
   LIST_EDITORS / listEditorPanel.

   Route: #/settings[/<panelKey>]
   ===================================================================== */

interface SettingsPanel { key: string; label: string; icon: string; render: () => string; adminOnly?: boolean; }
const SETTINGS_PANELS: SettingsPanel[] = [
  { key: 'appearance', label: 'Appearance', icon: 'eye', render: () => appearancePanel() },
  { key: 'contacts', label: 'Contacts', icon: 'users', render: () => listEditorPanel('contacts.relationships') },
  { key: 'referrals', label: 'Referrals', icon: 'send', render: () => listEditorPanel('referrals.declineReasons') },
  { key: 'files', label: 'Files', icon: 'file', render: () => filesSettingsPanel() },
  { key: 'applications', label: 'Applications', icon: 'file', render: () => applicationsSettingsPanel() },
  { key: 'agreements', label: 'Agreements', icon: 'fileText', render: () => agreementsSettingsPanel() },
  { key: 'email', label: 'Email Integration', icon: 'msg', render: () => emailConfigPanel() },
  { key: 'email-templates', label: 'Email Templates', icon: 'send', render: () => emailTemplatesPanel() },
  // BlueIQ seat management — only visible to BlueIQ admins (or global supers).
  { key: 'blueiq', label: 'BlueIQ', icon: 'msg', adminOnly: true, render: () => blueiqAdminPanel() },
  { key: 'organization', label: 'Organization', icon: 'building', render: () => organizationPanel() },
  { key: 'defaults', label: 'Defaults', icon: 'settings',
    render: () => panelSoon('Defaults', 'Default client status, assigned consultant, and workflow options applied to new records.') },
];

function viewSettings(panelKey?: string): string {
  // Hide admin-only panels (BlueIQ seats) unless the user can administer them.
  const visible = SETTINGS_PANELS.filter(p => !p.adminOnly || biqCanAdmin());
  const active = visible.filter(p => p.key === panelKey)[0] || visible[0];
  const nav = visible.map(p =>
    `<a href="#/settings/${p.key}" class="${p.key === active.key ? 'active' : ''}">${ic(p.icon, 16)}<span>${esc(p.label)}</span></a>`).join('');
  const body = `${crumb([{ t: orgLabel(), h: '#/dashboard' }, { t: 'Settings', h: '#/settings' }, { t: active.label }])}
    ${pageHead('Settings', 'Configure your workspace. These apply across your whole organization.')}
    <div class="settings-layout">
      <nav class="settings-nav">${nav}</nav>
      <div class="settings-panel">${active.render()}</div>
    </div>`;
  return shell('settings', body);
}

function panelSoon(title: string, note: string): string {
  return `<div class="section-head"><div><h3>${esc(title)}</h3><p>Not built yet.</p></div></div>
    <div class="card"><div class="empty uc">
      <div class="ico">${ic('settings', 24)}</div>
      <b>Coming soon</b><p>${esc(note)}</p>
      <span class="uc-tag">Planned</span>
    </div></div>`;
}

/* ---- Organization panel: real org name (read-only) + uploadable logo ----
   The org name is BlueStep's org display name (via the session). The logo is a
   DocumentLinkField on the org record, uploaded through the maestro's
   uploadOrgLogo action (mirrors client/program photo). It replaces the initials
   badge in the top-left identity. Logos aren't square, so we downscale (aspect-
   preserving) rather than crop. */
function organizationPanel(): string {
  const name = SESSION && SESSION.orgName ? SESSION.orgName : '';
  const logo = SESSION && SESSION.logoUrl ? SESSION.logoUrl : '';
  const preview = logo
    ? `<img src="${esc(logo)}" alt="${esc(name)}" style="max-height:72px;max-width:200px;object-fit:contain">`
    : `<div class="org-badge" style="width:56px;height:56px;font-size:18px;border-radius:10px">${esc(orgInitials())}</div>`;
  return `<div class="section-head"><div><h3>Organization</h3><p>Your agency name and logo appear in the top-left of the workspace.</p></div></div>
    <div class="card edit-card" id="__orgCard">
      <div class="edit-err" hidden></div>
      <div class="field" style="margin-bottom:18px">
        <label>Organization name</label>
        <div class="ro-val">${name ? esc(name) : '<span class="muted">Loading…</span>'}<span class="muted">Managed in BlueStep</span></div>
      </div>
      <div class="photo-edit" id="__orgLogoEdit">
        <div class="photo-frame" style="width:auto;min-width:88px;height:88px;padding:0 10px">${preview}</div>
        <div class="photo-actions">
          <div class="photo-btns">
            <button class="btn outline" onclick="orgLogoPick()">${ic('upload', 15)} ${logo ? 'Replace logo' : 'Upload logo'}</button>
            ${logo ? `<button class="btn ghost danger" onclick="orgLogoRemove()">${ic('trash', 15)} Remove</button>` : ''}
          </div>
          <div class="photo-hint">PNG or JPG. Shown ~28px tall in the header — wide logos are fine, the aspect ratio is preserved.</div>
        </div>
      </div>
    </div>`;
}

function setOrgLogoError(msg: string): void {
  const el = document.querySelector('#__orgCard .edit-err') as HTMLElement | null;
  if (!el) return;
  if (msg) { el.textContent = msg; el.hidden = false; } else { el.textContent = ''; el.hidden = true; }
}
function setOrgLogoBusy(busy: boolean): void {
  const edit = document.getElementById('__orgLogoEdit');
  if (edit) edit.classList.toggle('busy', busy);
  if (busy) setOrgLogoError('');
}

// Downscale a data-URL image so its longest edge is <= maxEdge, preserving aspect
// ratio. Returns a PNG data URL; falls back to the original on any failure.
function downscaleDataUrl(dataUrl: string, maxEdge: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) { resolve(dataUrl); return; }
      const scale = Math.min(1, maxEdge / Math.max(w, h));
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      try {
        const canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, cw, ch);
        resolve(canvas.toDataURL('image/png'));
      } catch (_e) { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function orgLogoPick(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { setOrgLogoError('Please choose an image file (PNG or JPG).'); return; }
    setOrgLogoError('');
    try {
      const dataUrl = await fileToDataUrl(f);
      const down = await downscaleDataUrl(dataUrl, 512);
      await uploadOrgLogoDataUrl(down);
    } catch (e: any) {
      setOrgLogoError(e && e.message ? e.message : String(e));
    }
  };
  input.click();
}

async function uploadOrgLogoDataUrl(dataUrl: string): Promise<void> {
  setOrgLogoBusy(true);
  try {
    const comma = dataUrl.indexOf(',');
    const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const res = await apiUploadOrgLogo(b64, 'logo.png', 'image/png');
    if (SESSION) SESSION.logoUrl = (res && res.logoUrl) || '';
    toast('Logo updated');
    render();
  } catch (e: any) {
    setOrgLogoBusy(false);
    setOrgLogoError(e && e.message ? e.message : String(e));
  }
}

async function orgLogoRemove(): Promise<void> {
  setOrgLogoBusy(true);
  try {
    const res = await apiRemoveOrgLogo();
    if (SESSION) SESSION.logoUrl = (res && res.logoUrl) || '';
    toast('Logo removed');
    render();
  } catch (e: any) {
    setOrgLogoBusy(false);
    setOrgLogoError(e && e.message ? e.message : String(e));
  }
}

/* ---- Appearance panel: per-user light/dark mode + org-wide color scheme ----
   Mode is personal (localStorage, applied instantly, no server). The color
   scheme is org-wide — it persists to settings.appearance.theme so it applies
   to every consultant. Both re-theme the whole SPA live by swapping the
   data-theme / data-mode attributes (see theme.ts + tokens.css). */
function appearancePanel(): string {
  const activeTheme = getTheme();
  const cards = THEMES.map(t => {
    const on = t.id === activeTheme;
    const chips = t.swatch.map(c => `<i style="background:${c}"></i>`).join('');
    return `<button type="button" class="theme-card${on ? ' on' : ''}" onclick="pickTheme('${t.id}')"${on ? ' aria-current="true"' : ''}>
      ${on ? `<span class="theme-applied">${ic('check', 13)} Applied</span>` : ''}
      <div class="theme-swatch">${chips}</div>
      <div class="theme-meta"><b>${esc(t.label)}</b><span>${esc(t.description)}</span></div>
    </button>`;
  }).join('');
  return `<div class="section-head"><div><h3>Appearance</h3><p>The organization-wide color scheme. Your personal light/dark mode lives in the account menu (top-right).</p></div></div>
    <div class="appearance-sec" style="margin-bottom:0">
      <div class="cfg-h">Color scheme · applies to everyone</div>
      <div class="theme-grid">${cards}</div>
      <p class="fhint" style="margin-top:10px">The color scheme is a shared, organization-wide setting — changing it updates the palette for every consultant.</p>
    </div>`;
}

// Pick the per-user display mode: instant, local only.
function pickMode(mode: string): void {
  applyMode(mode);
  render(); // reflect the active segment + re-render in the new mode
}

// Pick the org-wide color scheme: preview instantly, then persist for everyone.
async function pickTheme(id: string): Promise<void> {
  applyTheme(id); // instant, whole-app preview
  render();       // move the "Applied" badge + repaint theme-driven UI
  try {
    const merged = await saveSettingsSection('appearance', { theme: id });
    SETTINGS = merged || SETTINGS;
    toast('Color scheme applied for everyone');
  } catch (e: any) {
    toast('Applied here, but couldn’t save org-wide: ' + (e && e.message ? e.message : String(e)));
  }
}

/* ---- generic string-list editor (relationship options, default folders, …) ----
   Each editor is registered by a unique key. An in-progress draft per key is
   synced from the DOM before any structural change, so edits survive re-renders. */
interface ListEditorSpec {
  key: string; title: string; placeholder: string;
  hint: (usingDefaults: boolean) => string;
  read: () => string[];      // saved values
  fallback: string[];        // seed shown until the org saves its own
  save: (vals: string[]) => Promise<any>; // persists; resolves to updated settings
}
const LIST_EDITORS: { [key: string]: ListEditorSpec } = {};
const LIST_DRAFTS: { [key: string]: string[] | undefined } = {};

function registerListEditor(spec: ListEditorSpec): void { LIST_EDITORS[spec.key] = spec; }

function listDraft(key: string): string[] {
  if (!LIST_DRAFTS[key]) {
    const spec = LIST_EDITORS[key];
    const saved = spec ? spec.read() : [];
    LIST_DRAFTS[key] = (saved.length ? saved : (spec ? spec.fallback : [])).slice();
  }
  return LIST_DRAFTS[key] as string[];
}

function listEditorPanel(key: string): string {
  const spec = LIST_EDITORS[key];
  if (!spec) return panelSoon('Unknown', 'No editor registered for ' + esc(key) + '.');
  if (!SETTINGS && !SETTINGS_LOADING) loadSettings();
  if (!SETTINGS) {
    return `<div class="section-head"><div><h3>${esc(spec.title)}</h3><p>Loading settings…</p></div></div>
      <div class="card"><div class="empty"><div class="ico">${ic('clock', 22)}</div><b>Loading…</b></div></div>`;
  }
  const usingDefaults = !spec.read().length;
  return `<div class="section-head">
      <div><h3>${esc(spec.title)}</h3><p>${esc(spec.hint(usingDefaults))}</p></div>
    </div>
    <div class="card edit-card list-editor" data-list="${esc(key)}">
      <div class="edit-err" hidden></div>
      <div class="reln-list" data-list-rows>${listRowsHtml(key)}</div>
      <button class="btn ghost reln-add" onclick="listAdd('${esc(key)}')">${ic('plus', 15)} Add</button>
      <div class="edit-foot">
        <span class="edit-status"></span>
        <span style="flex:1"></span>
        <button class="btn primary js-save" onclick="listSave('${esc(key)}')">${ic('save', 15)} Save</button>
      </div>
    </div>`;
}

function listRowsHtml(key: string): string {
  const list = listDraft(key);
  const spec = LIST_EDITORS[key];
  const ph = spec ? spec.placeholder : '';
  if (!list.length) return `<div class="reln-empty">Nothing yet — add one below.</div>`;
  const last = list.length - 1;
  return list.map((val, i) => `<div class="reln-row">
    <input type="text" data-listitem value="${esc(val)}" placeholder="${esc(ph)}" autocomplete="off">
    <div class="reln-move">
      <button class="ico-mini" title="Move up" onclick="listMove('${esc(key)}',${i},-1)"${i === 0 ? ' disabled' : ''}>${ic('chevU', 14)}</button>
      <button class="ico-mini" title="Move down" onclick="listMove('${esc(key)}',${i},1)"${i === last ? ' disabled' : ''}>${ic('chevD', 14)}</button>
    </div>
    <button class="ico-mini danger" title="Remove" onclick="listRemove('${esc(key)}',${i})">${ic('trash', 14)}</button>
  </div>`).join('');
}

function listCard(key: string): HTMLElement | null {
  return document.querySelector('.list-editor[data-list="' + key + '"]') as HTMLElement | null;
}

function listSyncFromDom(key: string): void {
  const card = listCard(key);
  if (!card) return;
  const vals: string[] = [];
  card.querySelectorAll('[data-listitem]').forEach(el => vals.push((el as HTMLInputElement).value));
  LIST_DRAFTS[key] = vals;
}

function listRerender(key: string): void {
  const card = listCard(key);
  const rows = card ? (card.querySelector('[data-list-rows]') as HTMLElement | null) : null;
  if (rows) rows.innerHTML = listRowsHtml(key);
}

function listAdd(key: string): void {
  listSyncFromDom(key);
  listDraft(key).push('');
  listRerender(key);
  const card = listCard(key);
  const inputs = card ? card.querySelectorAll('[data-listitem]') : null;
  const lastInput = inputs && inputs.length ? inputs[inputs.length - 1] as HTMLInputElement : null;
  if (lastInput) lastInput.focus();
}

function listRemove(key: string, i: number): void {
  listSyncFromDom(key);
  const d = listDraft(key);
  if (i >= 0 && i < d.length) d.splice(i, 1);
  listRerender(key);
}

function listMove(key: string, i: number, dir: number): void {
  listSyncFromDom(key);
  const d = listDraft(key);
  const j = i + dir;
  if (j < 0 || j >= d.length) return;
  const tmp = d[i]; d[i] = d[j]; d[j] = tmp;
  listRerender(key);
}

function setListError(key: string, msg: string): void {
  const card = listCard(key);
  const el = card ? (card.querySelector('.edit-err') as HTMLElement | null) : null;
  if (!el) return;
  if (msg) { el.textContent = msg; el.hidden = false; } else { el.textContent = ''; el.hidden = true; }
}

async function listSave(key: string): Promise<void> {
  const spec = LIST_EDITORS[key];
  if (!spec) return;
  listSyncFromDom(key);
  // Trim, drop blanks, de-dupe (case-insensitive, first wins).
  const cleaned: string[] = [];
  const seen: { [k: string]: boolean } = {};
  (LIST_DRAFTS[key] || []).forEach(v => {
    const t = (v || '').trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    cleaned.push(t);
  });
  LIST_DRAFTS[key] = cleaned;

  setListError(key, '');
  const card = listCard(key);
  const saveBtn = card ? (card.querySelector('.js-save') as HTMLButtonElement | null) : null;
  const status = card ? (card.querySelector('.edit-status') as HTMLElement | null) : null;
  if (saveBtn) saveBtn.disabled = true;
  if (status) status.textContent = 'Saving…';

  try {
    const merged = await spec.save(cleaned);
    SETTINGS = merged || SETTINGS;
    LIST_DRAFTS[key] = undefined; // re-derive from freshly saved settings
    toast('Saved');
    render();
  } catch (e: any) {
    if (saveBtn) saveBtn.disabled = false;
    if (status) status.textContent = '';
    setListError(key, e && e.message ? e.message : String(e));
  }
}

// Save helper: merge a sub-object into one feature namespace without clobbering
// sibling keys, persist, and return the updated settings.
function saveSettingsSection(section: string, patch: { [k: string]: any }): Promise<any> {
  const cur = (SETTINGS && (SETTINGS as any)[section] && typeof (SETTINGS as any)[section] === 'object') ? (SETTINGS as any)[section] : {};
  const merged: { [k: string]: any } = {};
  merged[section] = Object.assign({}, cur, patch);
  return apiSaveSettings(merged);
}

// The org's saved relationship list (empty if none saved). "Other" is hard-coded
// in the dropdown, so it's never part of the editable list.
function savedRelationships(): string[] {
  const s: any = SETTINGS;
  const list: string[] = s && s.contacts && Array.isArray(s.contacts.relationships)
    ? s.contacts.relationships.filter((x: any) => typeof x === 'string')
    : [];
  return list.filter(o => o.trim().toLowerCase() !== OTHER_RELATIONSHIP.toLowerCase());
}

/* ---- register the editors ---- */
registerListEditor({
  key: 'contacts.relationships',
  title: 'Contact relationships',
  placeholder: 'Relationship label',
  hint: usingDefaults => usingDefaults
    ? 'Starter defaults. Edit them and Save to make them your own. ("Other" is always available.)'
    : 'These appear in the relationship dropdown when adding or editing a contact. ("Other" is always available.)',
  read: () => savedRelationships(),
  fallback: DEFAULT_RELATIONSHIPS,
  save: vals => saveSettingsSection('contacts', { relationships: vals }),
});

// The org's saved referral decline-reason list (empty if none saved).
function savedDeclineReasons(): string[] {
  const s: any = SETTINGS;
  return s && s.referrals && Array.isArray(s.referrals.declineReasons)
    ? s.referrals.declineReasons.filter((x: any) => typeof x === 'string')
    : [];
}
registerListEditor({
  key: 'referrals.declineReasons',
  title: 'Referral decline reasons',
  placeholder: 'Decline reason',
  hint: usingDefaults => usingDefaults
    ? 'Starter defaults. Edit them and Save to make them your own.'
    : 'These appear in the decline-reason dropdown when a referral is marked declined.',
  read: () => savedDeclineReasons(),
  fallback: DEFAULT_DECLINE_REASONS,
  save: vals => saveSettingsSection('referrals', { declineReasons: vals }),
});
/* ---- Applications panel: launch the builder + set the public interpreter URL ----
   The interpreter URL is the public (satellite-site) page where the Application
   Interpreter merge report is mounted; the maestro stitches client/token query
   params onto it to mint each family's link. Without it, "Send application"
   can't produce a working link. */
function appInterpreterUrl(): string {
  const s: any = SETTINGS;
  return s && s.application && typeof s.application.interpreterUrl === 'string' ? s.application.interpreterUrl : '';
}

function agreementSignUrl(): string {
  const s: any = SETTINGS;
  return s && s.agreements && typeof s.agreements.signUrl === 'string' ? s.agreements.signUrl : '';
}

function agreementsSettingsPanel(): string {
  if (!SETTINGS && !SETTINGS_LOADING) loadSettings();
  const url = agreementSignUrl();
  const urlState = url ? `<span class="pill success">Configured</span>` : `<span class="pill warning">Not set — signing links won't generate</span>`;
  return `<div class="section-head">
      <div><h3>Agreements</h3><p>Author e-signature templates and connect the public signing page.</p></div>
    </div>
    <div class="card" style="padding:18px 20px;display:flex;align-items:center;gap:16px">
      <div class="ico" style="flex:0 0 auto">${ic('fileText', 24)}</div>
      <div style="flex:1">
        <b style="display:block;font-size:15px">Agreement Template Builder</b>
        <p style="margin:2px 0 0;font-size:13px;color:var(--muted-foreground)">Create engagement letters, fee agreements, and consents with signer roles + signature fields.</p>
      </div>
      <a class="btn primary" href="#/agreementbuilder">${ic('edit', 15)} Open builder</a>
    </div>
    <div class="card edit-card" style="margin-top:14px">
      <div class="edit-err" hidden></div>
      <div class="pab-fld">
        <label style="display:flex;align-items:center;gap:8px">Public signing URL ${urlState}</label>
        <input type="text" id="agr-sign-url" value="${esc(url)}" placeholder="https://connect.example.org/sign" autocomplete="off" style="width:100%;box-sizing:border-box">
        <div class="pab-hint">The satellite-site page hosting the Agreement signing report. Entity, client, log &amp; token params are appended automatically per signer.</div>
      </div>
      <div class="edit-foot">
        <span class="edit-status"></span><span style="flex:1"></span>
        <button class="btn primary js-save-signurl" onclick="saveAgreementSignUrl()">${ic('save', 15)} Save</button>
      </div>
    </div>`;
}

async function saveAgreementSignUrl(): Promise<void> {
  const input = document.getElementById('agr-sign-url') as HTMLInputElement | null;
  if (!input) return;
  const url = input.value.trim();
  const btn = document.querySelector('.js-save-signurl') as HTMLButtonElement | null;
  const status = document.querySelector('.edit-card .edit-status') as HTMLElement | null;
  if (btn) btn.disabled = true;
  if (status) status.textContent = 'Saving…';
  try {
    const merged = await saveSettingsSection('agreements', { signUrl: url });
    SETTINGS = merged || SETTINGS;
    toast('Saved');
    render();
  } catch (e: any) {
    if (btn) btn.disabled = false;
    if (status) status.textContent = '';
    toast('Save failed: ' + (e && e.message ? e.message : String(e)));
  }
}

function applicationsSettingsPanel(): string {
  if (!SETTINGS && !SETTINGS_LOADING) loadSettings();
  const url = appInterpreterUrl();
  const urlState = url
    ? `<span class="pill success">Configured</span>`
    : `<span class="pill warning">Not set — links won't generate</span>`;
  return `<div class="section-head">
      <div><h3>Parent Application</h3><p>Design the family intake application and connect the public link.</p></div>
    </div>
    <div class="card" style="padding:18px 20px;display:flex;align-items:center;gap:16px">
      <div class="ico" style="flex:0 0 auto">${ic('file', 24)}</div>
      <div style="flex:1">
        <b style="display:block;font-size:15px">Application Builder</b>
        <p style="margin:2px 0 0;font-size:13px;color:var(--muted-foreground)">Add questions, choices, conditional logic, and record mapping — then publish.</p>
      </div>
      <a class="btn primary" href="#/builder">${ic('edit', 15)} Open builder</a>
    </div>
    <div class="card edit-card" style="margin-top:14px">
      <div class="edit-err" hidden></div>
      <div class="pab-fld">
        <label style="display:flex;align-items:center;gap:8px">Public interpreter URL ${urlState}</label>
        <input type="text" id="app-interp-url" value="${esc(url)}" placeholder="https://connect.example.org/intake" autocomplete="off"
          style="width:100%;box-sizing:border-box">
        <div class="pab-hint">The satellite-site page hosting the Application Interpreter. Client &amp; token params are appended automatically.</div>
      </div>
      <div class="edit-foot">
        <span class="edit-status"></span><span style="flex:1"></span>
        <button class="btn primary js-save-interp" onclick="saveInterpreterUrl()">${ic('save', 15)} Save</button>
      </div>
    </div>`;
}

async function saveInterpreterUrl(): Promise<void> {
  const input = document.getElementById('app-interp-url') as HTMLInputElement | null;
  if (!input) return;
  const url = input.value.trim();
  const btn = document.querySelector('.js-save-interp') as HTMLButtonElement | null;
  const status = document.querySelector('.edit-card .edit-status') as HTMLElement | null;
  if (btn) btn.disabled = true;
  if (status) status.textContent = 'Saving…';
  try {
    const merged = await saveSettingsSection('application', { interpreterUrl: url });
    SETTINGS = merged || SETTINGS;
    toast('Saved');
    render();
  } catch (e: any) {
    if (btn) btn.disabled = false;
    if (status) status.textContent = '';
    const err = document.querySelector('.edit-card .edit-err') as HTMLElement | null;
    if (err) { err.textContent = e && e.message ? e.message : String(e); err.hidden = false; }
  }
}

// The Files panel hosts two independent default-folder sets: one for client
// records, one for programs. Each is a standard list editor stacked in the panel.
function filesSettingsPanel(): string {
  return listEditorPanel('files.defaultFolders') + listEditorPanel('files.programDefaultFolders');
}

registerListEditor({
  key: 'files.defaultFolders',
  title: 'Client default folders',
  placeholder: 'Folder name (use / for subfolders, e.g. Medical/Labs)',
  hint: usingDefaults => usingDefaults
    ? 'Starter defaults. Edit and Save to set the folders that auto-appear on every client’s Files tab.'
    : 'These folders automatically appear on every client’s Files tab. Use "/" for subfolders, e.g. Medical/Labs.',
  read: () => defaultFolders(),
  fallback: DEFAULT_FOLDERS_SEED,
  save: vals => saveSettingsSection('files', { defaultFolders: vals }),
});

registerListEditor({
  key: 'files.programDefaultFolders',
  title: 'Program default folders',
  placeholder: 'Folder name (use / for subfolders, e.g. Tours/2026)',
  hint: usingDefaults => usingDefaults
    ? 'Starter defaults. Edit and Save to set the folders that auto-appear on every program’s Files tab.'
    : 'These folders automatically appear on every program’s Files tab. Use "/" for subfolders, e.g. Tours/2026.',
  read: () => programDefaultFolders(),
  fallback: PROGRAM_DEFAULT_FOLDERS_SEED,
  save: vals => saveSettingsSection('files', { programDefaultFolders: vals }),
});

/* =====================================================================
   BlueIQ panel — per-user seat management (admin only).
   Backed by /b/blueiqAdmin (runAsSuper, admin-gated). Turn BlueIQ on/off
   per user and set each person's monthly credit cap. Visible only to a
   BlueIQ admin or a global super (see SETTINGS_PANELS adminOnly + viewSettings).
   ===================================================================== */
interface BiqCtx { isSuper: boolean; isAdmin: boolean; enabled: boolean; }
let BIQ_CTX: BiqCtx | null = null;
let BIQ_CTX_LOADING = false;

// Loaded once (lazily) to decide whether to show the BlueIQ settings tab for a
// non-super user. Supers are known synchronously from SESSION.
async function loadBiqCtx(): Promise<void> {
  if (BIQ_CTX_LOADING || BIQ_CTX) return;
  BIQ_CTX_LOADING = true;
  try {
    const c = await apiBlueiqAdminContext();
    BIQ_CTX = { isSuper: !!c.isSuper, isAdmin: !!c.isAdmin, enabled: !!c.enabled };
  } catch (_e) {
    BIQ_CTX = { isSuper: false, isAdmin: false, enabled: false };
  } finally {
    BIQ_CTX_LOADING = false;
    if (typeof render === 'function') render();
  }
}

// Synchronous "can this user manage BlueIQ seats?" — supers always; others once
// context resolves. Kicks off the context load on first miss.
function biqCanAdmin(): boolean {
  if (SESSION && SESSION.isSuper) return true;
  if (BIQ_CTX) return BIQ_CTX.isAdmin;
  loadBiqCtx();
  return false;
}

interface BiqUserRow { userId: string; name: string; email: string; enabled: boolean; monthlyCredits: number; role: string; hasRow: boolean; }
const BIQ_ADMIN: { users: BiqUserRow[]; defaultCredits: number; loading: boolean; error: string | null; loaded: boolean } =
  { users: [], defaultCredits: 5000, loading: false, error: null, loaded: false };

async function loadBiqAdmin(force = false): Promise<void> {
  if (BIQ_ADMIN.loading) return;
  if (BIQ_ADMIN.loaded && !force) return;
  BIQ_ADMIN.loading = true; BIQ_ADMIN.error = null;
  try {
    const d = await apiBlueiqListUsers();
    BIQ_ADMIN.users = ((d && d.users) || []).map((u: any) => ({
      userId: String(u.userId || ''), name: String(u.name || ''), email: String(u.email || ''),
      enabled: u.enabled === true, monthlyCredits: Number(u.monthlyCredits) || 0,
      role: String(u.role || ''), hasRow: u.hasRow === true
    }));
    BIQ_ADMIN.defaultCredits = Number(d && d.defaultMonthlyCredits) || 5000;
    BIQ_ADMIN.loaded = true;
  } catch (e: any) {
    BIQ_ADMIN.error = e && e.message ? e.message : String(e);
  } finally {
    BIQ_ADMIN.loading = false;
    if (typeof render === 'function') render();
  }
}

function blueiqAdminPanel(): string {
  const head = `<div class="section-head"><div><h3>BlueIQ</h3><p>Turn BlueIQ on or off for each person and set their monthly usage limit. Each active seat is billed at $15/mo.</p></div></div>`;
  if (!biqCanAdmin()) return head + panelSoon('BlueIQ', 'Only a BlueIQ administrator can manage seats.');
  if (!BIQ_ADMIN.loaded && !BIQ_ADMIN.loading) loadBiqAdmin();
  if (BIQ_ADMIN.loading && !BIQ_ADMIN.loaded) return head + `<div class="card"><div class="empty"><b>Loading users…</b></div></div>`;
  if (BIQ_ADMIN.error) return head + `<div class="card"><div class="edit-err">${esc(BIQ_ADMIN.error)}</div></div>`;

  const enabledCount = BIQ_ADMIN.users.filter(u => u.enabled).length;
  const rows = BIQ_ADMIN.users.map(u => biqRowHtml(u)).join('');
  const summary = `${enabledCount} seat${enabledCount === 1 ? '' : 's'} active · default limit ${BIQ_ADMIN.defaultCredits.toLocaleString()} credits/mo`;
  return head + `<div class="card">
    <div class="biq-admin-summary">${esc(summary)}</div>
    <table class="biq-admin-table">
      <thead><tr><th>User</th><th>BlueIQ</th><th>Monthly credits</th><th>Role</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="muted" style="padding:16px">No users found.</td></tr>'}</tbody>
    </table>
    <p class="muted" style="margin-top:10px;font-size:12px">Leave the credit limit blank to use the default (${BIQ_ADMIN.defaultCredits.toLocaleString()}). The limit is a safety cap — a typical user uses far less.</p>
  </div>`;
}

function biqRowHtml(u: BiqUserRow): string {
  const creditsVal = u.monthlyCredits > 0 ? String(u.monthlyCredits) : '';
  const dis = u.enabled ? '' : 'disabled';
  return `<tr data-uid="${esc(u.userId)}">
    <td><div class="biq-u-name">${esc(u.name || u.userId)}</div>${u.email ? `<div class="biq-u-email muted">${esc(u.email)}</div>` : ''}</td>
    <td><input type="checkbox" class="biq-en" ${u.enabled ? 'checked' : ''} onchange="biqToggle('${esc(u.userId)}', this.checked)"></td>
    <td><input class="biq-credits" type="number" min="0" step="100" value="${esc(creditsVal)}" placeholder="${BIQ_ADMIN.defaultCredits}" ${dis} onchange="biqSetLimit('${esc(u.userId)}', this.value)"></td>
    <td><select class="biq-role" ${dis} onchange="biqSetRole('${esc(u.userId)}', this.value)">
      <option value="member" ${u.role === 'admin' ? '' : 'selected'}>Member</option>
      <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
    </select></td>
    <td>${u.hasRow ? `<button class="btn-icon" title="Remove BlueIQ seat" onclick="biqRemove('${esc(u.userId)}')">${ic('trash', 15)}</button>` : ''}</td>
  </tr>`;
}

function biqRow(userId: string): BiqUserRow | null {
  const m = BIQ_ADMIN.users.filter(x => x.userId === userId);
  return m.length ? m[0] : null;
}

async function biqToggle(userId: string, enabled: boolean): Promise<void> {
  const u = biqRow(userId);
  try {
    const payload: Record<string, unknown> = { userId: userId, enabled: enabled };
    if (u) { payload.userName = u.name; if (u.email) payload.email = u.email; }
    const d = await apiBlueiqSetSubscription(payload);
    if (u && d && d.subscription) {
      u.enabled = d.subscription.enabled === true;
      u.role = String(d.subscription.role || u.role);
      u.monthlyCredits = Number(d.subscription.monthlyCredits) || 0;
      u.hasRow = true;
    }
    toast(enabled ? 'BlueIQ enabled' : 'BlueIQ disabled');
    render();
  } catch (e: any) {
    toast('Could not update: ' + (e && e.message ? e.message : String(e)));
    loadBiqAdmin(true);
  }
}

async function biqSetLimit(userId: string, val: string): Promise<void> {
  const n = parseInt(String(val), 10);
  const credits = isFinite(n) && n > 0 ? n : 0; // 0 => server uses the default
  const u = biqRow(userId);
  try {
    await apiBlueiqSetSubscription({ userId: userId, monthlyCredits: credits });
    if (u) u.monthlyCredits = credits;
    toast('Limit saved');
  } catch (e: any) {
    toast('Could not save limit: ' + (e && e.message ? e.message : String(e)));
  }
}

async function biqSetRole(userId: string, role: string): Promise<void> {
  const u = biqRow(userId);
  try {
    await apiBlueiqSetSubscription({ userId: userId, role: role });
    if (u) u.role = role;
    toast('Role saved');
  } catch (e: any) {
    toast('Could not save role: ' + (e && e.message ? e.message : String(e)));
  }
}

async function biqRemove(userId: string): Promise<void> {
  if (!window.confirm('Remove this BlueIQ seat? The user will lose access to BlueIQ.')) return;
  try {
    await apiBlueiqRemoveSubscription(userId);
    await loadBiqAdmin(true);
    toast('Seat removed');
  } catch (e: any) {
    toast('Could not remove: ' + (e && e.message ? e.message : String(e)));
  }
}
