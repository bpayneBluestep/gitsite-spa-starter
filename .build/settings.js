const SETTINGS_PANELS = [
  { key: "appearance", label: "Appearance", icon: "eye", render: () => appearancePanel() },
  { key: "contacts", label: "Contacts", icon: "users", render: () => listEditorPanel("contacts.relationships") },
  { key: "referrals", label: "Referrals", icon: "send", render: () => listEditorPanel("referrals.declineReasons") },
  { key: "files", label: "Files", icon: "file", render: () => filesSettingsPanel() },
  { key: "applications", label: "Applications", icon: "file", render: () => applicationsSettingsPanel() },
  { key: "agreements", label: "Agreements", icon: "fileText", render: () => agreementsSettingsPanel() },
  { key: "email", label: "Email Integration", icon: "msg", render: () => emailConfigPanel() },
  { key: "email-templates", label: "Email Templates", icon: "send", render: () => emailTemplatesPanel() },
  // BlueIQ seat management — only visible to BlueIQ admins (or global supers).
  { key: "blueiq", label: "BlueIQ", icon: "msg", adminOnly: true, render: () => blueiqAdminPanel() },
  { key: "organization", label: "Organization", icon: "building", render: () => organizationPanel() },
  {
    key: "defaults",
    label: "Defaults",
    icon: "settings",
    render: () => panelSoon("Defaults", "Default client status, assigned consultant, and workflow options applied to new records.")
  }
];
function viewSettings(panelKey) {
  const visible = SETTINGS_PANELS.filter((p) => !p.adminOnly || biqCanAdmin());
  const active = visible.filter((p) => p.key === panelKey)[0] || visible[0];
  const nav = visible.map((p) => `<a href="#/settings/${p.key}" class="${p.key === active.key ? "active" : ""}">${ic(p.icon, 16)}<span>${esc(p.label)}</span></a>`).join("");
  const body = `${crumb([{ t: orgLabel(), h: "#/dashboard" }, { t: "Settings", h: "#/settings" }, { t: active.label }])}
    ${pageHead("Settings", "Configure your workspace. These apply across your whole organization.")}
    <div class="settings-layout">
      <nav class="settings-nav">${nav}</nav>
      <div class="settings-panel">${active.render()}</div>
    </div>`;
  return shell("settings", body);
}
function panelSoon(title, note) {
  return `<div class="section-head"><div><h3>${esc(title)}</h3><p>Not built yet.</p></div></div>
    <div class="card"><div class="empty uc">
      <div class="ico">${ic("settings", 24)}</div>
      <b>Coming soon</b><p>${esc(note)}</p>
      <span class="uc-tag">Planned</span>
    </div></div>`;
}
function organizationPanel() {
  const name = SESSION && SESSION.orgName ? SESSION.orgName : "";
  const logo = SESSION && SESSION.logoUrl ? SESSION.logoUrl : "";
  const preview = logo ? `<img src="${esc(logo)}" alt="${esc(name)}" style="max-height:72px;max-width:200px;object-fit:contain">` : `<div class="org-badge" style="width:56px;height:56px;font-size:18px;border-radius:10px">${esc(orgInitials())}</div>`;
  return `<div class="section-head"><div><h3>Organization</h3><p>Your agency name and logo appear in the top-left of the workspace.</p></div></div>
    <div class="card edit-card" id="__orgCard">
      <div class="edit-err" hidden></div>
      <div class="field" style="margin-bottom:18px">
        <label>Organization name</label>
        <div class="ro-val">${name ? esc(name) : '<span class="muted">Loading\u2026</span>'}<span class="muted">Managed in BlueStep</span></div>
      </div>
      <div class="photo-edit" id="__orgLogoEdit">
        <div class="photo-frame" style="width:auto;min-width:88px;height:88px;padding:0 10px">${preview}</div>
        <div class="photo-actions">
          <div class="photo-btns">
            <button class="btn outline" onclick="orgLogoPick()">${ic("upload", 15)} ${logo ? "Replace logo" : "Upload logo"}</button>
            ${logo ? `<button class="btn ghost danger" onclick="orgLogoRemove()">${ic("trash", 15)} Remove</button>` : ""}
          </div>
          <div class="photo-hint">PNG or JPG. Shown ~28px tall in the header \u2014 wide logos are fine, the aspect ratio is preserved.</div>
        </div>
      </div>
    </div>`;
}
function setOrgLogoError(msg) {
  const el = document.querySelector("#__orgCard .edit-err");
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}
function setOrgLogoBusy(busy) {
  const edit = document.getElementById("__orgLogoEdit");
  if (edit) edit.classList.toggle("busy", busy);
  if (busy) setOrgLogoError("");
}
function downscaleDataUrl(dataUrl, maxEdge) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) {
        resolve(dataUrl);
        return;
      }
      const scale = Math.min(1, maxEdge / Math.max(w, h));
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      try {
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, cw, ch);
        resolve(canvas.toDataURL("image/png"));
      } catch (_e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
function orgLogoPick() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) {
      setOrgLogoError("Please choose an image file (PNG or JPG).");
      return;
    }
    setOrgLogoError("");
    try {
      const dataUrl = await fileToDataUrl(f);
      const down = await downscaleDataUrl(dataUrl, 512);
      await uploadOrgLogoDataUrl(down);
    } catch (e) {
      setOrgLogoError(e && e.message ? e.message : String(e));
    }
  };
  input.click();
}
async function uploadOrgLogoDataUrl(dataUrl) {
  setOrgLogoBusy(true);
  try {
    const comma = dataUrl.indexOf(",");
    const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const res = await apiUploadOrgLogo(b64, "logo.png", "image/png");
    if (SESSION) SESSION.logoUrl = res && res.logoUrl || "";
    toast("Logo updated");
    render();
  } catch (e) {
    setOrgLogoBusy(false);
    setOrgLogoError(e && e.message ? e.message : String(e));
  }
}
async function orgLogoRemove() {
  setOrgLogoBusy(true);
  try {
    const res = await apiRemoveOrgLogo();
    if (SESSION) SESSION.logoUrl = res && res.logoUrl || "";
    toast("Logo removed");
    render();
  } catch (e) {
    setOrgLogoBusy(false);
    setOrgLogoError(e && e.message ? e.message : String(e));
  }
}
function appearancePanel() {
  const activeTheme = getTheme();
  const cards = THEMES.map((t) => {
    const on = t.id === activeTheme;
    const chips = t.swatch.map((c) => `<i style="background:${c}"></i>`).join("");
    return `<button type="button" class="theme-card${on ? " on" : ""}" onclick="pickTheme('${t.id}')"${on ? ' aria-current="true"' : ""}>
      ${on ? `<span class="theme-applied">${ic("check", 13)} Applied</span>` : ""}
      <div class="theme-swatch">${chips}</div>
      <div class="theme-meta"><b>${esc(t.label)}</b><span>${esc(t.description)}</span></div>
    </button>`;
  }).join("");
  return `<div class="section-head"><div><h3>Appearance</h3><p>The organization-wide color scheme. Your personal light/dark mode lives in the account menu (top-right).</p></div></div>
    <div class="appearance-sec" style="margin-bottom:0">
      <div class="cfg-h">Color scheme \xB7 applies to everyone</div>
      <div class="theme-grid">${cards}</div>
      <p class="fhint" style="margin-top:10px">The color scheme is a shared, organization-wide setting \u2014 changing it updates the palette for every consultant.</p>
    </div>`;
}
function pickMode(mode) {
  applyMode(mode);
  render();
}
async function pickTheme(id) {
  applyTheme(id);
  render();
  try {
    const merged = await saveSettingsSection("appearance", { theme: id });
    SETTINGS = merged || SETTINGS;
    toast("Color scheme applied for everyone");
  } catch (e) {
    toast("Applied here, but couldn\u2019t save org-wide: " + (e && e.message ? e.message : String(e)));
  }
}
const LIST_EDITORS = {};
const LIST_DRAFTS = {};
function registerListEditor(spec) {
  LIST_EDITORS[spec.key] = spec;
}
function listDraft(key) {
  if (!LIST_DRAFTS[key]) {
    const spec = LIST_EDITORS[key];
    const saved = spec ? spec.read() : [];
    LIST_DRAFTS[key] = (saved.length ? saved : spec ? spec.fallback : []).slice();
  }
  return LIST_DRAFTS[key];
}
function listEditorPanel(key) {
  const spec = LIST_EDITORS[key];
  if (!spec) return panelSoon("Unknown", "No editor registered for " + esc(key) + ".");
  if (!SETTINGS && !SETTINGS_LOADING) loadSettings();
  if (!SETTINGS) {
    return `<div class="section-head"><div><h3>${esc(spec.title)}</h3><p>Loading settings\u2026</p></div></div>
      <div class="card"><div class="empty"><div class="ico">${ic("clock", 22)}</div><b>Loading\u2026</b></div></div>`;
  }
  const usingDefaults = !spec.read().length;
  return `<div class="section-head">
      <div><h3>${esc(spec.title)}</h3><p>${esc(spec.hint(usingDefaults))}</p></div>
    </div>
    <div class="card edit-card list-editor" data-list="${esc(key)}">
      <div class="edit-err" hidden></div>
      <div class="reln-list" data-list-rows>${listRowsHtml(key)}</div>
      <button class="btn ghost reln-add" onclick="listAdd('${esc(key)}')">${ic("plus", 15)} Add</button>
      <div class="edit-foot">
        <span class="edit-status"></span>
        <span style="flex:1"></span>
        <button class="btn primary js-save" onclick="listSave('${esc(key)}')">${ic("save", 15)} Save</button>
      </div>
    </div>`;
}
function listRowsHtml(key) {
  const list = listDraft(key);
  const spec = LIST_EDITORS[key];
  const ph = spec ? spec.placeholder : "";
  if (!list.length) return `<div class="reln-empty">Nothing yet \u2014 add one below.</div>`;
  const last = list.length - 1;
  return list.map((val, i) => `<div class="reln-row">
    <input type="text" data-listitem value="${esc(val)}" placeholder="${esc(ph)}" autocomplete="off">
    <div class="reln-move">
      <button class="ico-mini" title="Move up" onclick="listMove('${esc(key)}',${i},-1)"${i === 0 ? " disabled" : ""}>${ic("chevU", 14)}</button>
      <button class="ico-mini" title="Move down" onclick="listMove('${esc(key)}',${i},1)"${i === last ? " disabled" : ""}>${ic("chevD", 14)}</button>
    </div>
    <button class="ico-mini danger" title="Remove" onclick="listRemove('${esc(key)}',${i})">${ic("trash", 14)}</button>
  </div>`).join("");
}
function listCard(key) {
  return document.querySelector('.list-editor[data-list="' + key + '"]');
}
function listSyncFromDom(key) {
  const card = listCard(key);
  if (!card) return;
  const vals = [];
  card.querySelectorAll("[data-listitem]").forEach((el) => vals.push(el.value));
  LIST_DRAFTS[key] = vals;
}
function listRerender(key) {
  const card = listCard(key);
  const rows = card ? card.querySelector("[data-list-rows]") : null;
  if (rows) rows.innerHTML = listRowsHtml(key);
}
function listAdd(key) {
  listSyncFromDom(key);
  listDraft(key).push("");
  listRerender(key);
  const card = listCard(key);
  const inputs = card ? card.querySelectorAll("[data-listitem]") : null;
  const lastInput = inputs && inputs.length ? inputs[inputs.length - 1] : null;
  if (lastInput) lastInput.focus();
}
function listRemove(key, i) {
  listSyncFromDom(key);
  const d = listDraft(key);
  if (i >= 0 && i < d.length) d.splice(i, 1);
  listRerender(key);
}
function listMove(key, i, dir) {
  listSyncFromDom(key);
  const d = listDraft(key);
  const j = i + dir;
  if (j < 0 || j >= d.length) return;
  const tmp = d[i];
  d[i] = d[j];
  d[j] = tmp;
  listRerender(key);
}
function setListError(key, msg) {
  const card = listCard(key);
  const el = card ? card.querySelector(".edit-err") : null;
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}
async function listSave(key) {
  const spec = LIST_EDITORS[key];
  if (!spec) return;
  listSyncFromDom(key);
  const cleaned = [];
  const seen = {};
  (LIST_DRAFTS[key] || []).forEach((v) => {
    const t = (v || "").trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    cleaned.push(t);
  });
  LIST_DRAFTS[key] = cleaned;
  setListError(key, "");
  const card = listCard(key);
  const saveBtn = card ? card.querySelector(".js-save") : null;
  const status = card ? card.querySelector(".edit-status") : null;
  if (saveBtn) saveBtn.disabled = true;
  if (status) status.textContent = "Saving\u2026";
  try {
    const merged = await spec.save(cleaned);
    SETTINGS = merged || SETTINGS;
    LIST_DRAFTS[key] = void 0;
    toast("Saved");
    render();
  } catch (e) {
    if (saveBtn) saveBtn.disabled = false;
    if (status) status.textContent = "";
    setListError(key, e && e.message ? e.message : String(e));
  }
}
function saveSettingsSection(section, patch) {
  const cur = SETTINGS && SETTINGS[section] && typeof SETTINGS[section] === "object" ? SETTINGS[section] : {};
  const merged = {};
  merged[section] = Object.assign({}, cur, patch);
  return apiSaveSettings(merged);
}
function savedRelationships() {
  const s = SETTINGS;
  const list = s && s.contacts && Array.isArray(s.contacts.relationships) ? s.contacts.relationships.filter((x) => typeof x === "string") : [];
  return list.filter((o) => o.trim().toLowerCase() !== OTHER_RELATIONSHIP.toLowerCase());
}
registerListEditor({
  key: "contacts.relationships",
  title: "Contact relationships",
  placeholder: "Relationship label",
  hint: (usingDefaults) => usingDefaults ? 'Starter defaults. Edit them and Save to make them your own. ("Other" is always available.)' : 'These appear in the relationship dropdown when adding or editing a contact. ("Other" is always available.)',
  read: () => savedRelationships(),
  fallback: DEFAULT_RELATIONSHIPS,
  save: (vals) => saveSettingsSection("contacts", { relationships: vals })
});
function savedDeclineReasons() {
  const s = SETTINGS;
  return s && s.referrals && Array.isArray(s.referrals.declineReasons) ? s.referrals.declineReasons.filter((x) => typeof x === "string") : [];
}
registerListEditor({
  key: "referrals.declineReasons",
  title: "Referral decline reasons",
  placeholder: "Decline reason",
  hint: (usingDefaults) => usingDefaults ? "Starter defaults. Edit them and Save to make them your own." : "These appear in the decline-reason dropdown when a referral is marked declined.",
  read: () => savedDeclineReasons(),
  fallback: DEFAULT_DECLINE_REASONS,
  save: (vals) => saveSettingsSection("referrals", { declineReasons: vals })
});
function appInterpreterUrl() {
  const s = SETTINGS;
  return s && s.application && typeof s.application.interpreterUrl === "string" ? s.application.interpreterUrl : "";
}
function agreementSignUrl() {
  const s = SETTINGS;
  return s && s.agreements && typeof s.agreements.signUrl === "string" ? s.agreements.signUrl : "";
}
function agreementsSettingsPanel() {
  if (!SETTINGS && !SETTINGS_LOADING) loadSettings();
  const url = agreementSignUrl();
  const urlState = url ? `<span class="pill success">Configured</span>` : `<span class="pill warning">Not set \u2014 signing links won't generate</span>`;
  return `<div class="section-head">
      <div><h3>Agreements</h3><p>Author e-signature templates and connect the public signing page.</p></div>
    </div>
    <div class="card" style="padding:18px 20px;display:flex;align-items:center;gap:16px">
      <div class="ico" style="flex:0 0 auto">${ic("fileText", 24)}</div>
      <div style="flex:1">
        <b style="display:block;font-size:15px">Agreement Template Builder</b>
        <p style="margin:2px 0 0;font-size:13px;color:var(--muted-foreground)">Create engagement letters, fee agreements, and consents with signer roles + signature fields.</p>
      </div>
      <a class="btn primary" href="#/agreementbuilder">${ic("edit", 15)} Open builder</a>
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
        <button class="btn primary js-save-signurl" onclick="saveAgreementSignUrl()">${ic("save", 15)} Save</button>
      </div>
    </div>`;
}
async function saveAgreementSignUrl() {
  const input = document.getElementById("agr-sign-url");
  if (!input) return;
  const url = input.value.trim();
  const btn = document.querySelector(".js-save-signurl");
  const status = document.querySelector(".edit-card .edit-status");
  if (btn) btn.disabled = true;
  if (status) status.textContent = "Saving\u2026";
  try {
    const merged = await saveSettingsSection("agreements", { signUrl: url });
    SETTINGS = merged || SETTINGS;
    toast("Saved");
    render();
  } catch (e) {
    if (btn) btn.disabled = false;
    if (status) status.textContent = "";
    toast("Save failed: " + (e && e.message ? e.message : String(e)));
  }
}
function applicationsSettingsPanel() {
  if (!SETTINGS && !SETTINGS_LOADING) loadSettings();
  const url = appInterpreterUrl();
  const urlState = url ? `<span class="pill success">Configured</span>` : `<span class="pill warning">Not set \u2014 links won't generate</span>`;
  return `<div class="section-head">
      <div><h3>Parent Application</h3><p>Design the family intake application and connect the public link.</p></div>
    </div>
    <div class="card" style="padding:18px 20px;display:flex;align-items:center;gap:16px">
      <div class="ico" style="flex:0 0 auto">${ic("file", 24)}</div>
      <div style="flex:1">
        <b style="display:block;font-size:15px">Application Builder</b>
        <p style="margin:2px 0 0;font-size:13px;color:var(--muted-foreground)">Add questions, choices, conditional logic, and record mapping \u2014 then publish.</p>
      </div>
      <a class="btn primary" href="#/builder">${ic("edit", 15)} Open builder</a>
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
        <button class="btn primary js-save-interp" onclick="saveInterpreterUrl()">${ic("save", 15)} Save</button>
      </div>
    </div>`;
}
async function saveInterpreterUrl() {
  const input = document.getElementById("app-interp-url");
  if (!input) return;
  const url = input.value.trim();
  const btn = document.querySelector(".js-save-interp");
  const status = document.querySelector(".edit-card .edit-status");
  if (btn) btn.disabled = true;
  if (status) status.textContent = "Saving\u2026";
  try {
    const merged = await saveSettingsSection("application", { interpreterUrl: url });
    SETTINGS = merged || SETTINGS;
    toast("Saved");
    render();
  } catch (e) {
    if (btn) btn.disabled = false;
    if (status) status.textContent = "";
    const err = document.querySelector(".edit-card .edit-err");
    if (err) {
      err.textContent = e && e.message ? e.message : String(e);
      err.hidden = false;
    }
  }
}
function filesSettingsPanel() {
  return listEditorPanel("files.defaultFolders") + listEditorPanel("files.programDefaultFolders");
}
registerListEditor({
  key: "files.defaultFolders",
  title: "Client default folders",
  placeholder: "Folder name (use / for subfolders, e.g. Medical/Labs)",
  hint: (usingDefaults) => usingDefaults ? "Starter defaults. Edit and Save to set the folders that auto-appear on every client\u2019s Files tab." : 'These folders automatically appear on every client\u2019s Files tab. Use "/" for subfolders, e.g. Medical/Labs.',
  read: () => defaultFolders(),
  fallback: DEFAULT_FOLDERS_SEED,
  save: (vals) => saveSettingsSection("files", { defaultFolders: vals })
});
registerListEditor({
  key: "files.programDefaultFolders",
  title: "Program default folders",
  placeholder: "Folder name (use / for subfolders, e.g. Tours/2026)",
  hint: (usingDefaults) => usingDefaults ? "Starter defaults. Edit and Save to set the folders that auto-appear on every program\u2019s Files tab." : 'These folders automatically appear on every program\u2019s Files tab. Use "/" for subfolders, e.g. Tours/2026.',
  read: () => programDefaultFolders(),
  fallback: PROGRAM_DEFAULT_FOLDERS_SEED,
  save: (vals) => saveSettingsSection("files", { programDefaultFolders: vals })
});
let BIQ_CTX = null;
let BIQ_CTX_LOADING = false;
async function loadBiqCtx() {
  if (BIQ_CTX_LOADING || BIQ_CTX) return;
  BIQ_CTX_LOADING = true;
  try {
    const c = await apiBlueiqAdminContext();
    BIQ_CTX = { isSuper: !!c.isSuper, isAdmin: !!c.isAdmin, enabled: !!c.enabled };
  } catch (_e) {
    BIQ_CTX = { isSuper: false, isAdmin: false, enabled: false };
  } finally {
    BIQ_CTX_LOADING = false;
    if (typeof render === "function") render();
  }
}
function biqCanAdmin() {
  if (SESSION && SESSION.isSuper) return true;
  if (BIQ_CTX) return BIQ_CTX.isAdmin;
  loadBiqCtx();
  return false;
}
const BIQ_ADMIN = { users: [], defaultCredits: 5e3, loading: false, error: null, loaded: false };
async function loadBiqAdmin(force = false) {
  if (BIQ_ADMIN.loading) return;
  if (BIQ_ADMIN.loaded && !force) return;
  BIQ_ADMIN.loading = true;
  BIQ_ADMIN.error = null;
  try {
    const d = await apiBlueiqListUsers();
    BIQ_ADMIN.users = (d && d.users || []).map((u) => ({
      userId: String(u.userId || ""),
      name: String(u.name || ""),
      email: String(u.email || ""),
      enabled: u.enabled === true,
      monthlyCredits: Number(u.monthlyCredits) || 0,
      role: String(u.role || ""),
      hasRow: u.hasRow === true
    }));
    BIQ_ADMIN.defaultCredits = Number(d && d.defaultMonthlyCredits) || 5e3;
    BIQ_ADMIN.loaded = true;
  } catch (e) {
    BIQ_ADMIN.error = e && e.message ? e.message : String(e);
  } finally {
    BIQ_ADMIN.loading = false;
    if (typeof render === "function") render();
  }
}
function blueiqAdminPanel() {
  const head = `<div class="section-head"><div><h3>BlueIQ</h3><p>Turn BlueIQ on or off for each person and set their monthly usage limit. Each active seat is billed at $15/mo.</p></div></div>`;
  if (!biqCanAdmin()) return head + panelSoon("BlueIQ", "Only a BlueIQ administrator can manage seats.");
  if (!BIQ_ADMIN.loaded && !BIQ_ADMIN.loading) loadBiqAdmin();
  if (BIQ_ADMIN.loading && !BIQ_ADMIN.loaded) return head + `<div class="card"><div class="empty"><b>Loading users\u2026</b></div></div>`;
  if (BIQ_ADMIN.error) return head + `<div class="card"><div class="edit-err">${esc(BIQ_ADMIN.error)}</div></div>`;
  const enabledCount = BIQ_ADMIN.users.filter((u) => u.enabled).length;
  const rows = BIQ_ADMIN.users.map((u) => biqRowHtml(u)).join("");
  const summary = `${enabledCount} seat${enabledCount === 1 ? "" : "s"} active \xB7 default limit ${BIQ_ADMIN.defaultCredits.toLocaleString()} credits/mo`;
  return head + `<div class="card">
    <div class="biq-admin-summary">${esc(summary)}</div>
    <table class="biq-admin-table">
      <thead><tr><th>User</th><th>BlueIQ</th><th>Monthly credits</th><th>Role</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="muted" style="padding:16px">No users found.</td></tr>'}</tbody>
    </table>
    <p class="muted" style="margin-top:10px;font-size:12px">Leave the credit limit blank to use the default (${BIQ_ADMIN.defaultCredits.toLocaleString()}). The limit is a safety cap \u2014 a typical user uses far less.</p>
  </div>`;
}
function biqRowHtml(u) {
  const creditsVal = u.monthlyCredits > 0 ? String(u.monthlyCredits) : "";
  const dis = u.enabled ? "" : "disabled";
  return `<tr data-uid="${esc(u.userId)}">
    <td><div class="biq-u-name">${esc(u.name || u.userId)}</div>${u.email ? `<div class="biq-u-email muted">${esc(u.email)}</div>` : ""}</td>
    <td><input type="checkbox" class="biq-en" ${u.enabled ? "checked" : ""} onchange="biqToggle('${esc(u.userId)}', this.checked)"></td>
    <td><input class="biq-credits" type="number" min="0" step="100" value="${esc(creditsVal)}" placeholder="${BIQ_ADMIN.defaultCredits}" ${dis} onchange="biqSetLimit('${esc(u.userId)}', this.value)"></td>
    <td><select class="biq-role" ${dis} onchange="biqSetRole('${esc(u.userId)}', this.value)">
      <option value="member" ${u.role === "admin" ? "" : "selected"}>Member</option>
      <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
    </select></td>
    <td>${u.hasRow ? `<button class="btn-icon" title="Remove BlueIQ seat" onclick="biqRemove('${esc(u.userId)}')">${ic("trash", 15)}</button>` : ""}</td>
  </tr>`;
}
function biqRow(userId) {
  const m = BIQ_ADMIN.users.filter((x) => x.userId === userId);
  return m.length ? m[0] : null;
}
async function biqToggle(userId, enabled) {
  const u = biqRow(userId);
  try {
    const payload = { userId, enabled };
    if (u) {
      payload.userName = u.name;
      if (u.email) payload.email = u.email;
    }
    const d = await apiBlueiqSetSubscription(payload);
    if (u && d && d.subscription) {
      u.enabled = d.subscription.enabled === true;
      u.role = String(d.subscription.role || u.role);
      u.monthlyCredits = Number(d.subscription.monthlyCredits) || 0;
      u.hasRow = true;
    }
    toast(enabled ? "BlueIQ enabled" : "BlueIQ disabled");
    render();
  } catch (e) {
    toast("Could not update: " + (e && e.message ? e.message : String(e)));
    loadBiqAdmin(true);
  }
}
async function biqSetLimit(userId, val) {
  const n = parseInt(String(val), 10);
  const credits = isFinite(n) && n > 0 ? n : 0;
  const u = biqRow(userId);
  try {
    await apiBlueiqSetSubscription({ userId, monthlyCredits: credits });
    if (u) u.monthlyCredits = credits;
    toast("Limit saved");
  } catch (e) {
    toast("Could not save limit: " + (e && e.message ? e.message : String(e)));
  }
}
async function biqSetRole(userId, role) {
  const u = biqRow(userId);
  try {
    await apiBlueiqSetSubscription({ userId, role });
    if (u) u.role = role;
    toast("Role saved");
  } catch (e) {
    toast("Could not save role: " + (e && e.message ? e.message : String(e)));
  }
}
async function biqRemove(userId) {
  if (!window.confirm("Remove this BlueIQ seat? The user will lose access to BlueIQ.")) return;
  try {
    await apiBlueiqRemoveSubscription(userId);
    await loadBiqAdmin(true);
    toast("Seat removed");
  } catch (e) {
    toast("Could not remove: " + (e && e.message ? e.message : String(e)));
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic2V0dGluZ3MudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgc2V0dGluZ3MudHMgXHUyMDE0IHRoZSBTZXR0aW5ncyBwYWdlOiBhIHBhbmVsIGZyYW1ld29yayBvdmVyIG9yZyBTZXR0aW5ncy5cblxuICAgQWxsIG9yZy13aWRlIGNvbmZpZyBsaXZlcyBpbiBvbmUgSlNPTiBtZW1vIG9uIHRoZSBvcmcgcmVjb3JkLCBmZWF0dXJlLVxuICAgbmFtZXNwYWNlZCAoZS5nLiBzZXR0aW5ncy5jb250YWN0cy5yZWxhdGlvbnNoaXBzLCBzZXR0aW5ncy5maWxlcy5kZWZhdWx0Rm9sZGVycykuXG4gICBUaGUgcGFnZSBpcyBhIGxlZnQgcGFuZWwtbmF2ICsgdGhlIGFjdGl2ZSBwYW5lbCBvbiB0aGUgcmlnaHQuIEFkZGluZyBhIGZ1dHVyZVxuICAgc2V0dGluZ3MgYXJlYSA9IG9uZSBlbnRyeSBpbiBTRVRUSU5HU19QQU5FTFMgKyBhIHJlbmRlciBmbi5cblxuICAgTW9zdCBwYW5lbHMgYXJlIGp1c3QgYW4gZWRpdGFibGUgc3RyaW5nIGxpc3QgKHJlbGF0aW9uc2hpcCBvcHRpb25zLCBkZWZhdWx0XG4gICBmb2xkZXJzLCBcdTIwMjYpLCBzbyB0aGVyZSdzIE9ORSBnZW5lcmljIGxpc3QgZWRpdG9yIHJlZ2lzdGVyZWQgYnkga2V5IFx1MjAxNCBzZWVcbiAgIExJU1RfRURJVE9SUyAvIGxpc3RFZGl0b3JQYW5lbC5cblxuICAgUm91dGU6ICMvc2V0dGluZ3NbLzxwYW5lbEtleT5dXG4gICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuaW50ZXJmYWNlIFNldHRpbmdzUGFuZWwgeyBrZXk6IHN0cmluZzsgbGFiZWw6IHN0cmluZzsgaWNvbjogc3RyaW5nOyByZW5kZXI6ICgpID0+IHN0cmluZzsgYWRtaW5Pbmx5PzogYm9vbGVhbjsgfVxuY29uc3QgU0VUVElOR1NfUEFORUxTOiBTZXR0aW5nc1BhbmVsW10gPSBbXG4gIHsga2V5OiAnYXBwZWFyYW5jZScsIGxhYmVsOiAnQXBwZWFyYW5jZScsIGljb246ICdleWUnLCByZW5kZXI6ICgpID0+IGFwcGVhcmFuY2VQYW5lbCgpIH0sXG4gIHsga2V5OiAnY29udGFjdHMnLCBsYWJlbDogJ0NvbnRhY3RzJywgaWNvbjogJ3VzZXJzJywgcmVuZGVyOiAoKSA9PiBsaXN0RWRpdG9yUGFuZWwoJ2NvbnRhY3RzLnJlbGF0aW9uc2hpcHMnKSB9LFxuICB7IGtleTogJ3JlZmVycmFscycsIGxhYmVsOiAnUmVmZXJyYWxzJywgaWNvbjogJ3NlbmQnLCByZW5kZXI6ICgpID0+IGxpc3RFZGl0b3JQYW5lbCgncmVmZXJyYWxzLmRlY2xpbmVSZWFzb25zJykgfSxcbiAgeyBrZXk6ICdmaWxlcycsIGxhYmVsOiAnRmlsZXMnLCBpY29uOiAnZmlsZScsIHJlbmRlcjogKCkgPT4gZmlsZXNTZXR0aW5nc1BhbmVsKCkgfSxcbiAgeyBrZXk6ICdhcHBsaWNhdGlvbnMnLCBsYWJlbDogJ0FwcGxpY2F0aW9ucycsIGljb246ICdmaWxlJywgcmVuZGVyOiAoKSA9PiBhcHBsaWNhdGlvbnNTZXR0aW5nc1BhbmVsKCkgfSxcbiAgeyBrZXk6ICdhZ3JlZW1lbnRzJywgbGFiZWw6ICdBZ3JlZW1lbnRzJywgaWNvbjogJ2ZpbGVUZXh0JywgcmVuZGVyOiAoKSA9PiBhZ3JlZW1lbnRzU2V0dGluZ3NQYW5lbCgpIH0sXG4gIHsga2V5OiAnZW1haWwnLCBsYWJlbDogJ0VtYWlsIEludGVncmF0aW9uJywgaWNvbjogJ21zZycsIHJlbmRlcjogKCkgPT4gZW1haWxDb25maWdQYW5lbCgpIH0sXG4gIHsga2V5OiAnZW1haWwtdGVtcGxhdGVzJywgbGFiZWw6ICdFbWFpbCBUZW1wbGF0ZXMnLCBpY29uOiAnc2VuZCcsIHJlbmRlcjogKCkgPT4gZW1haWxUZW1wbGF0ZXNQYW5lbCgpIH0sXG4gIC8vIEJsdWVJUSBzZWF0IG1hbmFnZW1lbnQgXHUyMDE0IG9ubHkgdmlzaWJsZSB0byBCbHVlSVEgYWRtaW5zIChvciBnbG9iYWwgc3VwZXJzKS5cbiAgeyBrZXk6ICdibHVlaXEnLCBsYWJlbDogJ0JsdWVJUScsIGljb246ICdtc2cnLCBhZG1pbk9ubHk6IHRydWUsIHJlbmRlcjogKCkgPT4gYmx1ZWlxQWRtaW5QYW5lbCgpIH0sXG4gIHsga2V5OiAnb3JnYW5pemF0aW9uJywgbGFiZWw6ICdPcmdhbml6YXRpb24nLCBpY29uOiAnYnVpbGRpbmcnLCByZW5kZXI6ICgpID0+IG9yZ2FuaXphdGlvblBhbmVsKCkgfSxcbiAgeyBrZXk6ICdkZWZhdWx0cycsIGxhYmVsOiAnRGVmYXVsdHMnLCBpY29uOiAnc2V0dGluZ3MnLFxuICAgIHJlbmRlcjogKCkgPT4gcGFuZWxTb29uKCdEZWZhdWx0cycsICdEZWZhdWx0IGNsaWVudCBzdGF0dXMsIGFzc2lnbmVkIGNvbnN1bHRhbnQsIGFuZCB3b3JrZmxvdyBvcHRpb25zIGFwcGxpZWQgdG8gbmV3IHJlY29yZHMuJykgfSxcbl07XG5cbmZ1bmN0aW9uIHZpZXdTZXR0aW5ncyhwYW5lbEtleT86IHN0cmluZyk6IHN0cmluZyB7XG4gIC8vIEhpZGUgYWRtaW4tb25seSBwYW5lbHMgKEJsdWVJUSBzZWF0cykgdW5sZXNzIHRoZSB1c2VyIGNhbiBhZG1pbmlzdGVyIHRoZW0uXG4gIGNvbnN0IHZpc2libGUgPSBTRVRUSU5HU19QQU5FTFMuZmlsdGVyKHAgPT4gIXAuYWRtaW5Pbmx5IHx8IGJpcUNhbkFkbWluKCkpO1xuICBjb25zdCBhY3RpdmUgPSB2aXNpYmxlLmZpbHRlcihwID0+IHAua2V5ID09PSBwYW5lbEtleSlbMF0gfHwgdmlzaWJsZVswXTtcbiAgY29uc3QgbmF2ID0gdmlzaWJsZS5tYXAocCA9PlxuICAgIGA8YSBocmVmPVwiIy9zZXR0aW5ncy8ke3Aua2V5fVwiIGNsYXNzPVwiJHtwLmtleSA9PT0gYWN0aXZlLmtleSA/ICdhY3RpdmUnIDogJyd9XCI+JHtpYyhwLmljb24sIDE2KX08c3Bhbj4ke2VzYyhwLmxhYmVsKX08L3NwYW4+PC9hPmApLmpvaW4oJycpO1xuICBjb25zdCBib2R5ID0gYCR7Y3J1bWIoW3sgdDogb3JnTGFiZWwoKSwgaDogJyMvZGFzaGJvYXJkJyB9LCB7IHQ6ICdTZXR0aW5ncycsIGg6ICcjL3NldHRpbmdzJyB9LCB7IHQ6IGFjdGl2ZS5sYWJlbCB9XSl9XG4gICAgJHtwYWdlSGVhZCgnU2V0dGluZ3MnLCAnQ29uZmlndXJlIHlvdXIgd29ya3NwYWNlLiBUaGVzZSBhcHBseSBhY3Jvc3MgeW91ciB3aG9sZSBvcmdhbml6YXRpb24uJyl9XG4gICAgPGRpdiBjbGFzcz1cInNldHRpbmdzLWxheW91dFwiPlxuICAgICAgPG5hdiBjbGFzcz1cInNldHRpbmdzLW5hdlwiPiR7bmF2fTwvbmF2PlxuICAgICAgPGRpdiBjbGFzcz1cInNldHRpbmdzLXBhbmVsXCI+JHthY3RpdmUucmVuZGVyKCl9PC9kaXY+XG4gICAgPC9kaXY+YDtcbiAgcmV0dXJuIHNoZWxsKCdzZXR0aW5ncycsIGJvZHkpO1xufVxuXG5mdW5jdGlvbiBwYW5lbFNvb24odGl0bGU6IHN0cmluZywgbm90ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwic2VjdGlvbi1oZWFkXCI+PGRpdj48aDM+JHtlc2ModGl0bGUpfTwvaDM+PHA+Tm90IGJ1aWx0IHlldC48L3A+PC9kaXY+PC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cImNhcmRcIj48ZGl2IGNsYXNzPVwiZW1wdHkgdWNcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdzZXR0aW5ncycsIDI0KX08L2Rpdj5cbiAgICAgIDxiPkNvbWluZyBzb29uPC9iPjxwPiR7ZXNjKG5vdGUpfTwvcD5cbiAgICAgIDxzcGFuIGNsYXNzPVwidWMtdGFnXCI+UGxhbm5lZDwvc3Bhbj5cbiAgICA8L2Rpdj48L2Rpdj5gO1xufVxuXG4vKiAtLS0tIE9yZ2FuaXphdGlvbiBwYW5lbDogcmVhbCBvcmcgbmFtZSAocmVhZC1vbmx5KSArIHVwbG9hZGFibGUgbG9nbyAtLS0tXG4gICBUaGUgb3JnIG5hbWUgaXMgQmx1ZVN0ZXAncyBvcmcgZGlzcGxheSBuYW1lICh2aWEgdGhlIHNlc3Npb24pLiBUaGUgbG9nbyBpcyBhXG4gICBEb2N1bWVudExpbmtGaWVsZCBvbiB0aGUgb3JnIHJlY29yZCwgdXBsb2FkZWQgdGhyb3VnaCB0aGUgbWFlc3RybydzXG4gICB1cGxvYWRPcmdMb2dvIGFjdGlvbiAobWlycm9ycyBjbGllbnQvcHJvZ3JhbSBwaG90bykuIEl0IHJlcGxhY2VzIHRoZSBpbml0aWFsc1xuICAgYmFkZ2UgaW4gdGhlIHRvcC1sZWZ0IGlkZW50aXR5LiBMb2dvcyBhcmVuJ3Qgc3F1YXJlLCBzbyB3ZSBkb3duc2NhbGUgKGFzcGVjdC1cbiAgIHByZXNlcnZpbmcpIHJhdGhlciB0aGFuIGNyb3AuICovXG5mdW5jdGlvbiBvcmdhbml6YXRpb25QYW5lbCgpOiBzdHJpbmcge1xuICBjb25zdCBuYW1lID0gU0VTU0lPTiAmJiBTRVNTSU9OLm9yZ05hbWUgPyBTRVNTSU9OLm9yZ05hbWUgOiAnJztcbiAgY29uc3QgbG9nbyA9IFNFU1NJT04gJiYgU0VTU0lPTi5sb2dvVXJsID8gU0VTU0lPTi5sb2dvVXJsIDogJyc7XG4gIGNvbnN0IHByZXZpZXcgPSBsb2dvXG4gICAgPyBgPGltZyBzcmM9XCIke2VzYyhsb2dvKX1cIiBhbHQ9XCIke2VzYyhuYW1lKX1cIiBzdHlsZT1cIm1heC1oZWlnaHQ6NzJweDttYXgtd2lkdGg6MjAwcHg7b2JqZWN0LWZpdDpjb250YWluXCI+YFxuICAgIDogYDxkaXYgY2xhc3M9XCJvcmctYmFkZ2VcIiBzdHlsZT1cIndpZHRoOjU2cHg7aGVpZ2h0OjU2cHg7Zm9udC1zaXplOjE4cHg7Ym9yZGVyLXJhZGl1czoxMHB4XCI+JHtlc2Mob3JnSW5pdGlhbHMoKSl9PC9kaXY+YDtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwic2VjdGlvbi1oZWFkXCI+PGRpdj48aDM+T3JnYW5pemF0aW9uPC9oMz48cD5Zb3VyIGFnZW5jeSBuYW1lIGFuZCBsb2dvIGFwcGVhciBpbiB0aGUgdG9wLWxlZnQgb2YgdGhlIHdvcmtzcGFjZS48L3A+PC9kaXY+PC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cImNhcmQgZWRpdC1jYXJkXCIgaWQ9XCJfX29yZ0NhcmRcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJlZGl0LWVyclwiIGhpZGRlbj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZFwiIHN0eWxlPVwibWFyZ2luLWJvdHRvbToxOHB4XCI+XG4gICAgICAgIDxsYWJlbD5Pcmdhbml6YXRpb24gbmFtZTwvbGFiZWw+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJyby12YWxcIj4ke25hbWUgPyBlc2MobmFtZSkgOiAnPHNwYW4gY2xhc3M9XCJtdXRlZFwiPkxvYWRpbmdcdTIwMjY8L3NwYW4+J308c3BhbiBjbGFzcz1cIm11dGVkXCI+TWFuYWdlZCBpbiBCbHVlU3RlcDwvc3Bhbj48L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cInBob3RvLWVkaXRcIiBpZD1cIl9fb3JnTG9nb0VkaXRcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInBob3RvLWZyYW1lXCIgc3R5bGU9XCJ3aWR0aDphdXRvO21pbi13aWR0aDo4OHB4O2hlaWdodDo4OHB4O3BhZGRpbmc6MCAxMHB4XCI+JHtwcmV2aWV3fTwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwicGhvdG8tYWN0aW9uc1wiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJwaG90by1idG5zXCI+XG4gICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIG91dGxpbmVcIiBvbmNsaWNrPVwib3JnTG9nb1BpY2soKVwiPiR7aWMoJ3VwbG9hZCcsIDE1KX0gJHtsb2dvID8gJ1JlcGxhY2UgbG9nbycgOiAnVXBsb2FkIGxvZ28nfTwvYnV0dG9uPlxuICAgICAgICAgICAgJHtsb2dvID8gYDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3QgZGFuZ2VyXCIgb25jbGljaz1cIm9yZ0xvZ29SZW1vdmUoKVwiPiR7aWMoJ3RyYXNoJywgMTUpfSBSZW1vdmU8L2J1dHRvbj5gIDogJyd9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cInBob3RvLWhpbnRcIj5QTkcgb3IgSlBHLiBTaG93biB+MjhweCB0YWxsIGluIHRoZSBoZWFkZXIgXHUyMDE0IHdpZGUgbG9nb3MgYXJlIGZpbmUsIHRoZSBhc3BlY3QgcmF0aW8gaXMgcHJlc2VydmVkLjwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PmA7XG59XG5cbmZ1bmN0aW9uIHNldE9yZ0xvZ29FcnJvcihtc2c6IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNfX29yZ0NhcmQgLmVkaXQtZXJyJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoIWVsKSByZXR1cm47XG4gIGlmIChtc2cpIHsgZWwudGV4dENvbnRlbnQgPSBtc2c7IGVsLmhpZGRlbiA9IGZhbHNlOyB9IGVsc2UgeyBlbC50ZXh0Q29udGVudCA9ICcnOyBlbC5oaWRkZW4gPSB0cnVlOyB9XG59XG5mdW5jdGlvbiBzZXRPcmdMb2dvQnVzeShidXN5OiBib29sZWFuKTogdm9pZCB7XG4gIGNvbnN0IGVkaXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19vcmdMb2dvRWRpdCcpO1xuICBpZiAoZWRpdCkgZWRpdC5jbGFzc0xpc3QudG9nZ2xlKCdidXN5JywgYnVzeSk7XG4gIGlmIChidXN5KSBzZXRPcmdMb2dvRXJyb3IoJycpO1xufVxuXG4vLyBEb3duc2NhbGUgYSBkYXRhLVVSTCBpbWFnZSBzbyBpdHMgbG9uZ2VzdCBlZGdlIGlzIDw9IG1heEVkZ2UsIHByZXNlcnZpbmcgYXNwZWN0XG4vLyByYXRpby4gUmV0dXJucyBhIFBORyBkYXRhIFVSTDsgZmFsbHMgYmFjayB0byB0aGUgb3JpZ2luYWwgb24gYW55IGZhaWx1cmUuXG5mdW5jdGlvbiBkb3duc2NhbGVEYXRhVXJsKGRhdGFVcmw6IHN0cmluZywgbWF4RWRnZTogbnVtYmVyKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgIGNvbnN0IGltZyA9IG5ldyBJbWFnZSgpO1xuICAgIGltZy5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICBjb25zdCB3ID0gaW1nLm5hdHVyYWxXaWR0aCB8fCBpbWcud2lkdGg7XG4gICAgICBjb25zdCBoID0gaW1nLm5hdHVyYWxIZWlnaHQgfHwgaW1nLmhlaWdodDtcbiAgICAgIGlmICghdyB8fCAhaCkgeyByZXNvbHZlKGRhdGFVcmwpOyByZXR1cm47IH1cbiAgICAgIGNvbnN0IHNjYWxlID0gTWF0aC5taW4oMSwgbWF4RWRnZSAvIE1hdGgubWF4KHcsIGgpKTtcbiAgICAgIGNvbnN0IGN3ID0gTWF0aC5tYXgoMSwgTWF0aC5yb3VuZCh3ICogc2NhbGUpKTtcbiAgICAgIGNvbnN0IGNoID0gTWF0aC5tYXgoMSwgTWF0aC5yb3VuZChoICogc2NhbGUpKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgICBjYW52YXMud2lkdGggPSBjdzsgY2FudmFzLmhlaWdodCA9IGNoO1xuICAgICAgICBjb25zdCBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICAgICAgaWYgKCFjdHgpIHsgcmVzb2x2ZShkYXRhVXJsKTsgcmV0dXJuOyB9XG4gICAgICAgIGN0eC5kcmF3SW1hZ2UoaW1nLCAwLCAwLCBjdywgY2gpO1xuICAgICAgICByZXNvbHZlKGNhbnZhcy50b0RhdGFVUkwoJ2ltYWdlL3BuZycpKTtcbiAgICAgIH0gY2F0Y2ggKF9lKSB7IHJlc29sdmUoZGF0YVVybCk7IH1cbiAgICB9O1xuICAgIGltZy5vbmVycm9yID0gKCkgPT4gcmVzb2x2ZShkYXRhVXJsKTtcbiAgICBpbWcuc3JjID0gZGF0YVVybDtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIG9yZ0xvZ29QaWNrKCk6IHZvaWQge1xuICBjb25zdCBpbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG4gIGlucHV0LnR5cGUgPSAnZmlsZSc7XG4gIGlucHV0LmFjY2VwdCA9ICdpbWFnZS8qJztcbiAgaW5wdXQub25jaGFuZ2UgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgZiA9IGlucHV0LmZpbGVzICYmIGlucHV0LmZpbGVzWzBdO1xuICAgIGlmICghZikgcmV0dXJuO1xuICAgIGlmICghL15pbWFnZVxcLy8udGVzdChmLnR5cGUpKSB7IHNldE9yZ0xvZ29FcnJvcignUGxlYXNlIGNob29zZSBhbiBpbWFnZSBmaWxlIChQTkcgb3IgSlBHKS4nKTsgcmV0dXJuOyB9XG4gICAgc2V0T3JnTG9nb0Vycm9yKCcnKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZGF0YVVybCA9IGF3YWl0IGZpbGVUb0RhdGFVcmwoZik7XG4gICAgICBjb25zdCBkb3duID0gYXdhaXQgZG93bnNjYWxlRGF0YVVybChkYXRhVXJsLCA1MTIpO1xuICAgICAgYXdhaXQgdXBsb2FkT3JnTG9nb0RhdGFVcmwoZG93bik7XG4gICAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgICBzZXRPcmdMb2dvRXJyb3IoZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpO1xuICAgIH1cbiAgfTtcbiAgaW5wdXQuY2xpY2soKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdXBsb2FkT3JnTG9nb0RhdGFVcmwoZGF0YVVybDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIHNldE9yZ0xvZ29CdXN5KHRydWUpO1xuICB0cnkge1xuICAgIGNvbnN0IGNvbW1hID0gZGF0YVVybC5pbmRleE9mKCcsJyk7XG4gICAgY29uc3QgYjY0ID0gY29tbWEgPj0gMCA/IGRhdGFVcmwuc2xpY2UoY29tbWEgKyAxKSA6IGRhdGFVcmw7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgYXBpVXBsb2FkT3JnTG9nbyhiNjQsICdsb2dvLnBuZycsICdpbWFnZS9wbmcnKTtcbiAgICBpZiAoU0VTU0lPTikgU0VTU0lPTi5sb2dvVXJsID0gKHJlcyAmJiByZXMubG9nb1VybCkgfHwgJyc7XG4gICAgdG9hc3QoJ0xvZ28gdXBkYXRlZCcpO1xuICAgIHJlbmRlcigpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBzZXRPcmdMb2dvQnVzeShmYWxzZSk7XG4gICAgc2V0T3JnTG9nb0Vycm9yKGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBvcmdMb2dvUmVtb3ZlKCk6IFByb21pc2U8dm9pZD4ge1xuICBzZXRPcmdMb2dvQnVzeSh0cnVlKTtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBhcGlSZW1vdmVPcmdMb2dvKCk7XG4gICAgaWYgKFNFU1NJT04pIFNFU1NJT04ubG9nb1VybCA9IChyZXMgJiYgcmVzLmxvZ29VcmwpIHx8ICcnO1xuICAgIHRvYXN0KCdMb2dvIHJlbW92ZWQnKTtcbiAgICByZW5kZXIoKTtcbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgc2V0T3JnTG9nb0J1c3koZmFsc2UpO1xuICAgIHNldE9yZ0xvZ29FcnJvcihlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSk7XG4gIH1cbn1cblxuLyogLS0tLSBBcHBlYXJhbmNlIHBhbmVsOiBwZXItdXNlciBsaWdodC9kYXJrIG1vZGUgKyBvcmctd2lkZSBjb2xvciBzY2hlbWUgLS0tLVxuICAgTW9kZSBpcyBwZXJzb25hbCAobG9jYWxTdG9yYWdlLCBhcHBsaWVkIGluc3RhbnRseSwgbm8gc2VydmVyKS4gVGhlIGNvbG9yXG4gICBzY2hlbWUgaXMgb3JnLXdpZGUgXHUyMDE0IGl0IHBlcnNpc3RzIHRvIHNldHRpbmdzLmFwcGVhcmFuY2UudGhlbWUgc28gaXQgYXBwbGllc1xuICAgdG8gZXZlcnkgY29uc3VsdGFudC4gQm90aCByZS10aGVtZSB0aGUgd2hvbGUgU1BBIGxpdmUgYnkgc3dhcHBpbmcgdGhlXG4gICBkYXRhLXRoZW1lIC8gZGF0YS1tb2RlIGF0dHJpYnV0ZXMgKHNlZSB0aGVtZS50cyArIHRva2Vucy5jc3MpLiAqL1xuZnVuY3Rpb24gYXBwZWFyYW5jZVBhbmVsKCk6IHN0cmluZyB7XG4gIGNvbnN0IGFjdGl2ZVRoZW1lID0gZ2V0VGhlbWUoKTtcbiAgY29uc3QgY2FyZHMgPSBUSEVNRVMubWFwKHQgPT4ge1xuICAgIGNvbnN0IG9uID0gdC5pZCA9PT0gYWN0aXZlVGhlbWU7XG4gICAgY29uc3QgY2hpcHMgPSB0LnN3YXRjaC5tYXAoYyA9PiBgPGkgc3R5bGU9XCJiYWNrZ3JvdW5kOiR7Y31cIj48L2k+YCkuam9pbignJyk7XG4gICAgcmV0dXJuIGA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInRoZW1lLWNhcmQke29uID8gJyBvbicgOiAnJ31cIiBvbmNsaWNrPVwicGlja1RoZW1lKCcke3QuaWR9JylcIiR7b24gPyAnIGFyaWEtY3VycmVudD1cInRydWVcIicgOiAnJ30+XG4gICAgICAke29uID8gYDxzcGFuIGNsYXNzPVwidGhlbWUtYXBwbGllZFwiPiR7aWMoJ2NoZWNrJywgMTMpfSBBcHBsaWVkPC9zcGFuPmAgOiAnJ31cbiAgICAgIDxkaXYgY2xhc3M9XCJ0aGVtZS1zd2F0Y2hcIj4ke2NoaXBzfTwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cInRoZW1lLW1ldGFcIj48Yj4ke2VzYyh0LmxhYmVsKX08L2I+PHNwYW4+JHtlc2ModC5kZXNjcmlwdGlvbil9PC9zcGFuPjwvZGl2PlxuICAgIDwvYnV0dG9uPmA7XG4gIH0pLmpvaW4oJycpO1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJzZWN0aW9uLWhlYWRcIj48ZGl2PjxoMz5BcHBlYXJhbmNlPC9oMz48cD5UaGUgb3JnYW5pemF0aW9uLXdpZGUgY29sb3Igc2NoZW1lLiBZb3VyIHBlcnNvbmFsIGxpZ2h0L2RhcmsgbW9kZSBsaXZlcyBpbiB0aGUgYWNjb3VudCBtZW51ICh0b3AtcmlnaHQpLjwvcD48L2Rpdj48L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwiYXBwZWFyYW5jZS1zZWNcIiBzdHlsZT1cIm1hcmdpbi1ib3R0b206MFwiPlxuICAgICAgPGRpdiBjbGFzcz1cImNmZy1oXCI+Q29sb3Igc2NoZW1lIFx1MDBCNyBhcHBsaWVzIHRvIGV2ZXJ5b25lPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwidGhlbWUtZ3JpZFwiPiR7Y2FyZHN9PC9kaXY+XG4gICAgICA8cCBjbGFzcz1cImZoaW50XCIgc3R5bGU9XCJtYXJnaW4tdG9wOjEwcHhcIj5UaGUgY29sb3Igc2NoZW1lIGlzIGEgc2hhcmVkLCBvcmdhbml6YXRpb24td2lkZSBzZXR0aW5nIFx1MjAxNCBjaGFuZ2luZyBpdCB1cGRhdGVzIHRoZSBwYWxldHRlIGZvciBldmVyeSBjb25zdWx0YW50LjwvcD5cbiAgICA8L2Rpdj5gO1xufVxuXG4vLyBQaWNrIHRoZSBwZXItdXNlciBkaXNwbGF5IG1vZGU6IGluc3RhbnQsIGxvY2FsIG9ubHkuXG5mdW5jdGlvbiBwaWNrTW9kZShtb2RlOiBzdHJpbmcpOiB2b2lkIHtcbiAgYXBwbHlNb2RlKG1vZGUpO1xuICByZW5kZXIoKTsgLy8gcmVmbGVjdCB0aGUgYWN0aXZlIHNlZ21lbnQgKyByZS1yZW5kZXIgaW4gdGhlIG5ldyBtb2RlXG59XG5cbi8vIFBpY2sgdGhlIG9yZy13aWRlIGNvbG9yIHNjaGVtZTogcHJldmlldyBpbnN0YW50bHksIHRoZW4gcGVyc2lzdCBmb3IgZXZlcnlvbmUuXG5hc3luYyBmdW5jdGlvbiBwaWNrVGhlbWUoaWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBhcHBseVRoZW1lKGlkKTsgLy8gaW5zdGFudCwgd2hvbGUtYXBwIHByZXZpZXdcbiAgcmVuZGVyKCk7ICAgICAgIC8vIG1vdmUgdGhlIFwiQXBwbGllZFwiIGJhZGdlICsgcmVwYWludCB0aGVtZS1kcml2ZW4gVUlcbiAgdHJ5IHtcbiAgICBjb25zdCBtZXJnZWQgPSBhd2FpdCBzYXZlU2V0dGluZ3NTZWN0aW9uKCdhcHBlYXJhbmNlJywgeyB0aGVtZTogaWQgfSk7XG4gICAgU0VUVElOR1MgPSBtZXJnZWQgfHwgU0VUVElOR1M7XG4gICAgdG9hc3QoJ0NvbG9yIHNjaGVtZSBhcHBsaWVkIGZvciBldmVyeW9uZScpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICB0b2FzdCgnQXBwbGllZCBoZXJlLCBidXQgY291bGRuXHUyMDE5dCBzYXZlIG9yZy13aWRlOiAnICsgKGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpKSk7XG4gIH1cbn1cblxuLyogLS0tLSBnZW5lcmljIHN0cmluZy1saXN0IGVkaXRvciAocmVsYXRpb25zaGlwIG9wdGlvbnMsIGRlZmF1bHQgZm9sZGVycywgXHUyMDI2KSAtLS0tXG4gICBFYWNoIGVkaXRvciBpcyByZWdpc3RlcmVkIGJ5IGEgdW5pcXVlIGtleS4gQW4gaW4tcHJvZ3Jlc3MgZHJhZnQgcGVyIGtleSBpc1xuICAgc3luY2VkIGZyb20gdGhlIERPTSBiZWZvcmUgYW55IHN0cnVjdHVyYWwgY2hhbmdlLCBzbyBlZGl0cyBzdXJ2aXZlIHJlLXJlbmRlcnMuICovXG5pbnRlcmZhY2UgTGlzdEVkaXRvclNwZWMge1xuICBrZXk6IHN0cmluZzsgdGl0bGU6IHN0cmluZzsgcGxhY2Vob2xkZXI6IHN0cmluZztcbiAgaGludDogKHVzaW5nRGVmYXVsdHM6IGJvb2xlYW4pID0+IHN0cmluZztcbiAgcmVhZDogKCkgPT4gc3RyaW5nW107ICAgICAgLy8gc2F2ZWQgdmFsdWVzXG4gIGZhbGxiYWNrOiBzdHJpbmdbXTsgICAgICAgIC8vIHNlZWQgc2hvd24gdW50aWwgdGhlIG9yZyBzYXZlcyBpdHMgb3duXG4gIHNhdmU6ICh2YWxzOiBzdHJpbmdbXSkgPT4gUHJvbWlzZTxhbnk+OyAvLyBwZXJzaXN0czsgcmVzb2x2ZXMgdG8gdXBkYXRlZCBzZXR0aW5nc1xufVxuY29uc3QgTElTVF9FRElUT1JTOiB7IFtrZXk6IHN0cmluZ106IExpc3RFZGl0b3JTcGVjIH0gPSB7fTtcbmNvbnN0IExJU1RfRFJBRlRTOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZ1tdIHwgdW5kZWZpbmVkIH0gPSB7fTtcblxuZnVuY3Rpb24gcmVnaXN0ZXJMaXN0RWRpdG9yKHNwZWM6IExpc3RFZGl0b3JTcGVjKTogdm9pZCB7IExJU1RfRURJVE9SU1tzcGVjLmtleV0gPSBzcGVjOyB9XG5cbmZ1bmN0aW9uIGxpc3REcmFmdChrZXk6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgaWYgKCFMSVNUX0RSQUZUU1trZXldKSB7XG4gICAgY29uc3Qgc3BlYyA9IExJU1RfRURJVE9SU1trZXldO1xuICAgIGNvbnN0IHNhdmVkID0gc3BlYyA/IHNwZWMucmVhZCgpIDogW107XG4gICAgTElTVF9EUkFGVFNba2V5XSA9IChzYXZlZC5sZW5ndGggPyBzYXZlZCA6IChzcGVjID8gc3BlYy5mYWxsYmFjayA6IFtdKSkuc2xpY2UoKTtcbiAgfVxuICByZXR1cm4gTElTVF9EUkFGVFNba2V5XSBhcyBzdHJpbmdbXTtcbn1cblxuZnVuY3Rpb24gbGlzdEVkaXRvclBhbmVsKGtleTogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3Qgc3BlYyA9IExJU1RfRURJVE9SU1trZXldO1xuICBpZiAoIXNwZWMpIHJldHVybiBwYW5lbFNvb24oJ1Vua25vd24nLCAnTm8gZWRpdG9yIHJlZ2lzdGVyZWQgZm9yICcgKyBlc2Moa2V5KSArICcuJyk7XG4gIGlmICghU0VUVElOR1MgJiYgIVNFVFRJTkdTX0xPQURJTkcpIGxvYWRTZXR0aW5ncygpO1xuICBpZiAoIVNFVFRJTkdTKSB7XG4gICAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwic2VjdGlvbi1oZWFkXCI+PGRpdj48aDM+JHtlc2Moc3BlYy50aXRsZSl9PC9oMz48cD5Mb2FkaW5nIHNldHRpbmdzXHUyMDI2PC9wPjwvZGl2PjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImNhcmRcIj48ZGl2IGNsYXNzPVwiZW1wdHlcIj48ZGl2IGNsYXNzPVwiaWNvXCI+JHtpYygnY2xvY2snLCAyMil9PC9kaXY+PGI+TG9hZGluZ1x1MjAyNjwvYj48L2Rpdj48L2Rpdj5gO1xuICB9XG4gIGNvbnN0IHVzaW5nRGVmYXVsdHMgPSAhc3BlYy5yZWFkKCkubGVuZ3RoO1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJzZWN0aW9uLWhlYWRcIj5cbiAgICAgIDxkaXY+PGgzPiR7ZXNjKHNwZWMudGl0bGUpfTwvaDM+PHA+JHtlc2Moc3BlYy5oaW50KHVzaW5nRGVmYXVsdHMpKX08L3A+PC9kaXY+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cImNhcmQgZWRpdC1jYXJkIGxpc3QtZWRpdG9yXCIgZGF0YS1saXN0PVwiJHtlc2Moa2V5KX1cIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJlZGl0LWVyclwiIGhpZGRlbj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJyZWxuLWxpc3RcIiBkYXRhLWxpc3Qtcm93cz4ke2xpc3RSb3dzSHRtbChrZXkpfTwvZGl2PlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdCByZWxuLWFkZFwiIG9uY2xpY2s9XCJsaXN0QWRkKCcke2VzYyhrZXkpfScpXCI+JHtpYygncGx1cycsIDE1KX0gQWRkPC9idXR0b24+XG4gICAgICA8ZGl2IGNsYXNzPVwiZWRpdC1mb290XCI+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwiZWRpdC1zdGF0dXNcIj48L3NwYW4+XG4gICAgICAgIDxzcGFuIHN0eWxlPVwiZmxleDoxXCI+PC9zcGFuPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnkganMtc2F2ZVwiIG9uY2xpY2s9XCJsaXN0U2F2ZSgnJHtlc2Moa2V5KX0nKVwiPiR7aWMoJ3NhdmUnLCAxNSl9IFNhdmU8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PmA7XG59XG5cbmZ1bmN0aW9uIGxpc3RSb3dzSHRtbChrZXk6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IGxpc3QgPSBsaXN0RHJhZnQoa2V5KTtcbiAgY29uc3Qgc3BlYyA9IExJU1RfRURJVE9SU1trZXldO1xuICBjb25zdCBwaCA9IHNwZWMgPyBzcGVjLnBsYWNlaG9sZGVyIDogJyc7XG4gIGlmICghbGlzdC5sZW5ndGgpIHJldHVybiBgPGRpdiBjbGFzcz1cInJlbG4tZW1wdHlcIj5Ob3RoaW5nIHlldCBcdTIwMTQgYWRkIG9uZSBiZWxvdy48L2Rpdj5gO1xuICBjb25zdCBsYXN0ID0gbGlzdC5sZW5ndGggLSAxO1xuICByZXR1cm4gbGlzdC5tYXAoKHZhbCwgaSkgPT4gYDxkaXYgY2xhc3M9XCJyZWxuLXJvd1wiPlxuICAgIDxpbnB1dCB0eXBlPVwidGV4dFwiIGRhdGEtbGlzdGl0ZW0gdmFsdWU9XCIke2VzYyh2YWwpfVwiIHBsYWNlaG9sZGVyPVwiJHtlc2MocGgpfVwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiPlxuICAgIDxkaXYgY2xhc3M9XCJyZWxuLW1vdmVcIj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJpY28tbWluaVwiIHRpdGxlPVwiTW92ZSB1cFwiIG9uY2xpY2s9XCJsaXN0TW92ZSgnJHtlc2Moa2V5KX0nLCR7aX0sLTEpXCIke2kgPT09IDAgPyAnIGRpc2FibGVkJyA6ICcnfT4ke2ljKCdjaGV2VScsIDE0KX08L2J1dHRvbj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJpY28tbWluaVwiIHRpdGxlPVwiTW92ZSBkb3duXCIgb25jbGljaz1cImxpc3RNb3ZlKCcke2VzYyhrZXkpfScsJHtpfSwxKVwiJHtpID09PSBsYXN0ID8gJyBkaXNhYmxlZCcgOiAnJ30+JHtpYygnY2hldkQnLCAxNCl9PC9idXR0b24+XG4gICAgPC9kaXY+XG4gICAgPGJ1dHRvbiBjbGFzcz1cImljby1taW5pIGRhbmdlclwiIHRpdGxlPVwiUmVtb3ZlXCIgb25jbGljaz1cImxpc3RSZW1vdmUoJyR7ZXNjKGtleSl9Jywke2l9KVwiPiR7aWMoJ3RyYXNoJywgMTQpfTwvYnV0dG9uPlxuICA8L2Rpdj5gKS5qb2luKCcnKTtcbn1cblxuZnVuY3Rpb24gbGlzdENhcmQoa2V5OiBzdHJpbmcpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmxpc3QtZWRpdG9yW2RhdGEtbGlzdD1cIicgKyBrZXkgKyAnXCJdJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xufVxuXG5mdW5jdGlvbiBsaXN0U3luY0Zyb21Eb20oa2V5OiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgY2FyZCA9IGxpc3RDYXJkKGtleSk7XG4gIGlmICghY2FyZCkgcmV0dXJuO1xuICBjb25zdCB2YWxzOiBzdHJpbmdbXSA9IFtdO1xuICBjYXJkLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWxpc3RpdGVtXScpLmZvckVhY2goZWwgPT4gdmFscy5wdXNoKChlbCBhcyBIVE1MSW5wdXRFbGVtZW50KS52YWx1ZSkpO1xuICBMSVNUX0RSQUZUU1trZXldID0gdmFscztcbn1cblxuZnVuY3Rpb24gbGlzdFJlcmVuZGVyKGtleTogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGNhcmQgPSBsaXN0Q2FyZChrZXkpO1xuICBjb25zdCByb3dzID0gY2FyZCA/IChjYXJkLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWxpc3Qtcm93c10nKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpIDogbnVsbDtcbiAgaWYgKHJvd3MpIHJvd3MuaW5uZXJIVE1MID0gbGlzdFJvd3NIdG1sKGtleSk7XG59XG5cbmZ1bmN0aW9uIGxpc3RBZGQoa2V5OiBzdHJpbmcpOiB2b2lkIHtcbiAgbGlzdFN5bmNGcm9tRG9tKGtleSk7XG4gIGxpc3REcmFmdChrZXkpLnB1c2goJycpO1xuICBsaXN0UmVyZW5kZXIoa2V5KTtcbiAgY29uc3QgY2FyZCA9IGxpc3RDYXJkKGtleSk7XG4gIGNvbnN0IGlucHV0cyA9IGNhcmQgPyBjYXJkLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWxpc3RpdGVtXScpIDogbnVsbDtcbiAgY29uc3QgbGFzdElucHV0ID0gaW5wdXRzICYmIGlucHV0cy5sZW5ndGggPyBpbnB1dHNbaW5wdXRzLmxlbmd0aCAtIDFdIGFzIEhUTUxJbnB1dEVsZW1lbnQgOiBudWxsO1xuICBpZiAobGFzdElucHV0KSBsYXN0SW5wdXQuZm9jdXMoKTtcbn1cblxuZnVuY3Rpb24gbGlzdFJlbW92ZShrZXk6IHN0cmluZywgaTogbnVtYmVyKTogdm9pZCB7XG4gIGxpc3RTeW5jRnJvbURvbShrZXkpO1xuICBjb25zdCBkID0gbGlzdERyYWZ0KGtleSk7XG4gIGlmIChpID49IDAgJiYgaSA8IGQubGVuZ3RoKSBkLnNwbGljZShpLCAxKTtcbiAgbGlzdFJlcmVuZGVyKGtleSk7XG59XG5cbmZ1bmN0aW9uIGxpc3RNb3ZlKGtleTogc3RyaW5nLCBpOiBudW1iZXIsIGRpcjogbnVtYmVyKTogdm9pZCB7XG4gIGxpc3RTeW5jRnJvbURvbShrZXkpO1xuICBjb25zdCBkID0gbGlzdERyYWZ0KGtleSk7XG4gIGNvbnN0IGogPSBpICsgZGlyO1xuICBpZiAoaiA8IDAgfHwgaiA+PSBkLmxlbmd0aCkgcmV0dXJuO1xuICBjb25zdCB0bXAgPSBkW2ldOyBkW2ldID0gZFtqXTsgZFtqXSA9IHRtcDtcbiAgbGlzdFJlcmVuZGVyKGtleSk7XG59XG5cbmZ1bmN0aW9uIHNldExpc3RFcnJvcihrZXk6IHN0cmluZywgbXNnOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgY2FyZCA9IGxpc3RDYXJkKGtleSk7XG4gIGNvbnN0IGVsID0gY2FyZCA/IChjYXJkLnF1ZXJ5U2VsZWN0b3IoJy5lZGl0LWVycicpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCkgOiBudWxsO1xuICBpZiAoIWVsKSByZXR1cm47XG4gIGlmIChtc2cpIHsgZWwudGV4dENvbnRlbnQgPSBtc2c7IGVsLmhpZGRlbiA9IGZhbHNlOyB9IGVsc2UgeyBlbC50ZXh0Q29udGVudCA9ICcnOyBlbC5oaWRkZW4gPSB0cnVlOyB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGxpc3RTYXZlKGtleTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHNwZWMgPSBMSVNUX0VESVRPUlNba2V5XTtcbiAgaWYgKCFzcGVjKSByZXR1cm47XG4gIGxpc3RTeW5jRnJvbURvbShrZXkpO1xuICAvLyBUcmltLCBkcm9wIGJsYW5rcywgZGUtZHVwZSAoY2FzZS1pbnNlbnNpdGl2ZSwgZmlyc3Qgd2lucykuXG4gIGNvbnN0IGNsZWFuZWQ6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IHNlZW46IHsgW2s6IHN0cmluZ106IGJvb2xlYW4gfSA9IHt9O1xuICAoTElTVF9EUkFGVFNba2V5XSB8fCBbXSkuZm9yRWFjaCh2ID0+IHtcbiAgICBjb25zdCB0ID0gKHYgfHwgJycpLnRyaW0oKTtcbiAgICBpZiAoIXQpIHJldHVybjtcbiAgICBjb25zdCBrID0gdC50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChzZWVuW2tdKSByZXR1cm47XG4gICAgc2VlbltrXSA9IHRydWU7XG4gICAgY2xlYW5lZC5wdXNoKHQpO1xuICB9KTtcbiAgTElTVF9EUkFGVFNba2V5XSA9IGNsZWFuZWQ7XG5cbiAgc2V0TGlzdEVycm9yKGtleSwgJycpO1xuICBjb25zdCBjYXJkID0gbGlzdENhcmQoa2V5KTtcbiAgY29uc3Qgc2F2ZUJ0biA9IGNhcmQgPyAoY2FyZC5xdWVyeVNlbGVjdG9yKCcuanMtc2F2ZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbCkgOiBudWxsO1xuICBjb25zdCBzdGF0dXMgPSBjYXJkID8gKGNhcmQucXVlcnlTZWxlY3RvcignLmVkaXQtc3RhdHVzJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsKSA6IG51bGw7XG4gIGlmIChzYXZlQnRuKSBzYXZlQnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgaWYgKHN0YXR1cykgc3RhdHVzLnRleHRDb250ZW50ID0gJ1NhdmluZ1x1MjAyNic7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBtZXJnZWQgPSBhd2FpdCBzcGVjLnNhdmUoY2xlYW5lZCk7XG4gICAgU0VUVElOR1MgPSBtZXJnZWQgfHwgU0VUVElOR1M7XG4gICAgTElTVF9EUkFGVFNba2V5XSA9IHVuZGVmaW5lZDsgLy8gcmUtZGVyaXZlIGZyb20gZnJlc2hseSBzYXZlZCBzZXR0aW5nc1xuICAgIHRvYXN0KCdTYXZlZCcpO1xuICAgIHJlbmRlcigpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBpZiAoc2F2ZUJ0bikgc2F2ZUJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICcnO1xuICAgIHNldExpc3RFcnJvcihrZXksIGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpKTtcbiAgfVxufVxuXG4vLyBTYXZlIGhlbHBlcjogbWVyZ2UgYSBzdWItb2JqZWN0IGludG8gb25lIGZlYXR1cmUgbmFtZXNwYWNlIHdpdGhvdXQgY2xvYmJlcmluZ1xuLy8gc2libGluZyBrZXlzLCBwZXJzaXN0LCBhbmQgcmV0dXJuIHRoZSB1cGRhdGVkIHNldHRpbmdzLlxuZnVuY3Rpb24gc2F2ZVNldHRpbmdzU2VjdGlvbihzZWN0aW9uOiBzdHJpbmcsIHBhdGNoOiB7IFtrOiBzdHJpbmddOiBhbnkgfSk6IFByb21pc2U8YW55PiB7XG4gIGNvbnN0IGN1ciA9IChTRVRUSU5HUyAmJiAoU0VUVElOR1MgYXMgYW55KVtzZWN0aW9uXSAmJiB0eXBlb2YgKFNFVFRJTkdTIGFzIGFueSlbc2VjdGlvbl0gPT09ICdvYmplY3QnKSA/IChTRVRUSU5HUyBhcyBhbnkpW3NlY3Rpb25dIDoge307XG4gIGNvbnN0IG1lcmdlZDogeyBbazogc3RyaW5nXTogYW55IH0gPSB7fTtcbiAgbWVyZ2VkW3NlY3Rpb25dID0gT2JqZWN0LmFzc2lnbih7fSwgY3VyLCBwYXRjaCk7XG4gIHJldHVybiBhcGlTYXZlU2V0dGluZ3MobWVyZ2VkKTtcbn1cblxuLy8gVGhlIG9yZydzIHNhdmVkIHJlbGF0aW9uc2hpcCBsaXN0IChlbXB0eSBpZiBub25lIHNhdmVkKS4gXCJPdGhlclwiIGlzIGhhcmQtY29kZWRcbi8vIGluIHRoZSBkcm9wZG93biwgc28gaXQncyBuZXZlciBwYXJ0IG9mIHRoZSBlZGl0YWJsZSBsaXN0LlxuZnVuY3Rpb24gc2F2ZWRSZWxhdGlvbnNoaXBzKCk6IHN0cmluZ1tdIHtcbiAgY29uc3QgczogYW55ID0gU0VUVElOR1M7XG4gIGNvbnN0IGxpc3Q6IHN0cmluZ1tdID0gcyAmJiBzLmNvbnRhY3RzICYmIEFycmF5LmlzQXJyYXkocy5jb250YWN0cy5yZWxhdGlvbnNoaXBzKVxuICAgID8gcy5jb250YWN0cy5yZWxhdGlvbnNoaXBzLmZpbHRlcigoeDogYW55KSA9PiB0eXBlb2YgeCA9PT0gJ3N0cmluZycpXG4gICAgOiBbXTtcbiAgcmV0dXJuIGxpc3QuZmlsdGVyKG8gPT4gby50cmltKCkudG9Mb3dlckNhc2UoKSAhPT0gT1RIRVJfUkVMQVRJT05TSElQLnRvTG93ZXJDYXNlKCkpO1xufVxuXG4vKiAtLS0tIHJlZ2lzdGVyIHRoZSBlZGl0b3JzIC0tLS0gKi9cbnJlZ2lzdGVyTGlzdEVkaXRvcih7XG4gIGtleTogJ2NvbnRhY3RzLnJlbGF0aW9uc2hpcHMnLFxuICB0aXRsZTogJ0NvbnRhY3QgcmVsYXRpb25zaGlwcycsXG4gIHBsYWNlaG9sZGVyOiAnUmVsYXRpb25zaGlwIGxhYmVsJyxcbiAgaGludDogdXNpbmdEZWZhdWx0cyA9PiB1c2luZ0RlZmF1bHRzXG4gICAgPyAnU3RhcnRlciBkZWZhdWx0cy4gRWRpdCB0aGVtIGFuZCBTYXZlIHRvIG1ha2UgdGhlbSB5b3VyIG93bi4gKFwiT3RoZXJcIiBpcyBhbHdheXMgYXZhaWxhYmxlLiknXG4gICAgOiAnVGhlc2UgYXBwZWFyIGluIHRoZSByZWxhdGlvbnNoaXAgZHJvcGRvd24gd2hlbiBhZGRpbmcgb3IgZWRpdGluZyBhIGNvbnRhY3QuIChcIk90aGVyXCIgaXMgYWx3YXlzIGF2YWlsYWJsZS4pJyxcbiAgcmVhZDogKCkgPT4gc2F2ZWRSZWxhdGlvbnNoaXBzKCksXG4gIGZhbGxiYWNrOiBERUZBVUxUX1JFTEFUSU9OU0hJUFMsXG4gIHNhdmU6IHZhbHMgPT4gc2F2ZVNldHRpbmdzU2VjdGlvbignY29udGFjdHMnLCB7IHJlbGF0aW9uc2hpcHM6IHZhbHMgfSksXG59KTtcblxuLy8gVGhlIG9yZydzIHNhdmVkIHJlZmVycmFsIGRlY2xpbmUtcmVhc29uIGxpc3QgKGVtcHR5IGlmIG5vbmUgc2F2ZWQpLlxuZnVuY3Rpb24gc2F2ZWREZWNsaW5lUmVhc29ucygpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHM6IGFueSA9IFNFVFRJTkdTO1xuICByZXR1cm4gcyAmJiBzLnJlZmVycmFscyAmJiBBcnJheS5pc0FycmF5KHMucmVmZXJyYWxzLmRlY2xpbmVSZWFzb25zKVxuICAgID8gcy5yZWZlcnJhbHMuZGVjbGluZVJlYXNvbnMuZmlsdGVyKCh4OiBhbnkpID0+IHR5cGVvZiB4ID09PSAnc3RyaW5nJylcbiAgICA6IFtdO1xufVxucmVnaXN0ZXJMaXN0RWRpdG9yKHtcbiAga2V5OiAncmVmZXJyYWxzLmRlY2xpbmVSZWFzb25zJyxcbiAgdGl0bGU6ICdSZWZlcnJhbCBkZWNsaW5lIHJlYXNvbnMnLFxuICBwbGFjZWhvbGRlcjogJ0RlY2xpbmUgcmVhc29uJyxcbiAgaGludDogdXNpbmdEZWZhdWx0cyA9PiB1c2luZ0RlZmF1bHRzXG4gICAgPyAnU3RhcnRlciBkZWZhdWx0cy4gRWRpdCB0aGVtIGFuZCBTYXZlIHRvIG1ha2UgdGhlbSB5b3VyIG93bi4nXG4gICAgOiAnVGhlc2UgYXBwZWFyIGluIHRoZSBkZWNsaW5lLXJlYXNvbiBkcm9wZG93biB3aGVuIGEgcmVmZXJyYWwgaXMgbWFya2VkIGRlY2xpbmVkLicsXG4gIHJlYWQ6ICgpID0+IHNhdmVkRGVjbGluZVJlYXNvbnMoKSxcbiAgZmFsbGJhY2s6IERFRkFVTFRfREVDTElORV9SRUFTT05TLFxuICBzYXZlOiB2YWxzID0+IHNhdmVTZXR0aW5nc1NlY3Rpb24oJ3JlZmVycmFscycsIHsgZGVjbGluZVJlYXNvbnM6IHZhbHMgfSksXG59KTtcbi8qIC0tLS0gQXBwbGljYXRpb25zIHBhbmVsOiBsYXVuY2ggdGhlIGJ1aWxkZXIgKyBzZXQgdGhlIHB1YmxpYyBpbnRlcnByZXRlciBVUkwgLS0tLVxuICAgVGhlIGludGVycHJldGVyIFVSTCBpcyB0aGUgcHVibGljIChzYXRlbGxpdGUtc2l0ZSkgcGFnZSB3aGVyZSB0aGUgQXBwbGljYXRpb25cbiAgIEludGVycHJldGVyIG1lcmdlIHJlcG9ydCBpcyBtb3VudGVkOyB0aGUgbWFlc3RybyBzdGl0Y2hlcyBjbGllbnQvdG9rZW4gcXVlcnlcbiAgIHBhcmFtcyBvbnRvIGl0IHRvIG1pbnQgZWFjaCBmYW1pbHkncyBsaW5rLiBXaXRob3V0IGl0LCBcIlNlbmQgYXBwbGljYXRpb25cIlxuICAgY2FuJ3QgcHJvZHVjZSBhIHdvcmtpbmcgbGluay4gKi9cbmZ1bmN0aW9uIGFwcEludGVycHJldGVyVXJsKCk6IHN0cmluZyB7XG4gIGNvbnN0IHM6IGFueSA9IFNFVFRJTkdTO1xuICByZXR1cm4gcyAmJiBzLmFwcGxpY2F0aW9uICYmIHR5cGVvZiBzLmFwcGxpY2F0aW9uLmludGVycHJldGVyVXJsID09PSAnc3RyaW5nJyA/IHMuYXBwbGljYXRpb24uaW50ZXJwcmV0ZXJVcmwgOiAnJztcbn1cblxuZnVuY3Rpb24gYWdyZWVtZW50U2lnblVybCgpOiBzdHJpbmcge1xuICBjb25zdCBzOiBhbnkgPSBTRVRUSU5HUztcbiAgcmV0dXJuIHMgJiYgcy5hZ3JlZW1lbnRzICYmIHR5cGVvZiBzLmFncmVlbWVudHMuc2lnblVybCA9PT0gJ3N0cmluZycgPyBzLmFncmVlbWVudHMuc2lnblVybCA6ICcnO1xufVxuXG5mdW5jdGlvbiBhZ3JlZW1lbnRzU2V0dGluZ3NQYW5lbCgpOiBzdHJpbmcge1xuICBpZiAoIVNFVFRJTkdTICYmICFTRVRUSU5HU19MT0FESU5HKSBsb2FkU2V0dGluZ3MoKTtcbiAgY29uc3QgdXJsID0gYWdyZWVtZW50U2lnblVybCgpO1xuICBjb25zdCB1cmxTdGF0ZSA9IHVybCA/IGA8c3BhbiBjbGFzcz1cInBpbGwgc3VjY2Vzc1wiPkNvbmZpZ3VyZWQ8L3NwYW4+YCA6IGA8c3BhbiBjbGFzcz1cInBpbGwgd2FybmluZ1wiPk5vdCBzZXQgXHUyMDE0IHNpZ25pbmcgbGlua3Mgd29uJ3QgZ2VuZXJhdGU8L3NwYW4+YDtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwic2VjdGlvbi1oZWFkXCI+XG4gICAgICA8ZGl2PjxoMz5BZ3JlZW1lbnRzPC9oMz48cD5BdXRob3IgZS1zaWduYXR1cmUgdGVtcGxhdGVzIGFuZCBjb25uZWN0IHRoZSBwdWJsaWMgc2lnbmluZyBwYWdlLjwvcD48L2Rpdj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwiY2FyZFwiIHN0eWxlPVwicGFkZGluZzoxOHB4IDIwcHg7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTZweFwiPlxuICAgICAgPGRpdiBjbGFzcz1cImljb1wiIHN0eWxlPVwiZmxleDowIDAgYXV0b1wiPiR7aWMoJ2ZpbGVUZXh0JywgMjQpfTwvZGl2PlxuICAgICAgPGRpdiBzdHlsZT1cImZsZXg6MVwiPlxuICAgICAgICA8YiBzdHlsZT1cImRpc3BsYXk6YmxvY2s7Zm9udC1zaXplOjE1cHhcIj5BZ3JlZW1lbnQgVGVtcGxhdGUgQnVpbGRlcjwvYj5cbiAgICAgICAgPHAgc3R5bGU9XCJtYXJnaW46MnB4IDAgMDtmb250LXNpemU6MTNweDtjb2xvcjp2YXIoLS1tdXRlZC1mb3JlZ3JvdW5kKVwiPkNyZWF0ZSBlbmdhZ2VtZW50IGxldHRlcnMsIGZlZSBhZ3JlZW1lbnRzLCBhbmQgY29uc2VudHMgd2l0aCBzaWduZXIgcm9sZXMgKyBzaWduYXR1cmUgZmllbGRzLjwvcD5cbiAgICAgIDwvZGl2PlxuICAgICAgPGEgY2xhc3M9XCJidG4gcHJpbWFyeVwiIGhyZWY9XCIjL2FncmVlbWVudGJ1aWxkZXJcIj4ke2ljKCdlZGl0JywgMTUpfSBPcGVuIGJ1aWxkZXI8L2E+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cImNhcmQgZWRpdC1jYXJkXCIgc3R5bGU9XCJtYXJnaW4tdG9wOjE0cHhcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJlZGl0LWVyclwiIGhpZGRlbj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJwYWItZmxkXCI+XG4gICAgICAgIDxsYWJlbCBzdHlsZT1cImRpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjhweFwiPlB1YmxpYyBzaWduaW5nIFVSTCAke3VybFN0YXRlfTwvbGFiZWw+XG4gICAgICAgIDxpbnB1dCB0eXBlPVwidGV4dFwiIGlkPVwiYWdyLXNpZ24tdXJsXCIgdmFsdWU9XCIke2VzYyh1cmwpfVwiIHBsYWNlaG9sZGVyPVwiaHR0cHM6Ly9jb25uZWN0LmV4YW1wbGUub3JnL3NpZ25cIiBhdXRvY29tcGxldGU9XCJvZmZcIiBzdHlsZT1cIndpZHRoOjEwMCU7Ym94LXNpemluZzpib3JkZXItYm94XCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJwYWItaGludFwiPlRoZSBzYXRlbGxpdGUtc2l0ZSBwYWdlIGhvc3RpbmcgdGhlIEFncmVlbWVudCBzaWduaW5nIHJlcG9ydC4gRW50aXR5LCBjbGllbnQsIGxvZyAmYW1wOyB0b2tlbiBwYXJhbXMgYXJlIGFwcGVuZGVkIGF1dG9tYXRpY2FsbHkgcGVyIHNpZ25lci48L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImVkaXQtZm9vdFwiPlxuICAgICAgICA8c3BhbiBjbGFzcz1cImVkaXQtc3RhdHVzXCI+PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxleDoxXCI+PC9zcGFuPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnkganMtc2F2ZS1zaWdudXJsXCIgb25jbGljaz1cInNhdmVBZ3JlZW1lbnRTaWduVXJsKClcIj4ke2ljKCdzYXZlJywgMTUpfSBTYXZlPC9idXR0b24+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5gO1xufVxuXG5hc3luYyBmdW5jdGlvbiBzYXZlQWdyZWVtZW50U2lnblVybCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgaW5wdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWdyLXNpZ24tdXJsJykgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XG4gIGlmICghaW5wdXQpIHJldHVybjtcbiAgY29uc3QgdXJsID0gaW5wdXQudmFsdWUudHJpbSgpO1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuanMtc2F2ZS1zaWdudXJsJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuICBjb25zdCBzdGF0dXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuZWRpdC1jYXJkIC5lZGl0LXN0YXR1cycpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgaWYgKGJ0bikgYnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgaWYgKHN0YXR1cykgc3RhdHVzLnRleHRDb250ZW50ID0gJ1NhdmluZ1x1MjAyNic7XG4gIHRyeSB7XG4gICAgY29uc3QgbWVyZ2VkID0gYXdhaXQgc2F2ZVNldHRpbmdzU2VjdGlvbignYWdyZWVtZW50cycsIHsgc2lnblVybDogdXJsIH0pO1xuICAgIFNFVFRJTkdTID0gbWVyZ2VkIHx8IFNFVFRJTkdTO1xuICAgIHRvYXN0KCdTYXZlZCcpO1xuICAgIHJlbmRlcigpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBpZiAoYnRuKSBidG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICBpZiAoc3RhdHVzKSBzdGF0dXMudGV4dENvbnRlbnQgPSAnJztcbiAgICB0b2FzdCgnU2F2ZSBmYWlsZWQ6ICcgKyAoZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhcHBsaWNhdGlvbnNTZXR0aW5nc1BhbmVsKCk6IHN0cmluZyB7XG4gIGlmICghU0VUVElOR1MgJiYgIVNFVFRJTkdTX0xPQURJTkcpIGxvYWRTZXR0aW5ncygpO1xuICBjb25zdCB1cmwgPSBhcHBJbnRlcnByZXRlclVybCgpO1xuICBjb25zdCB1cmxTdGF0ZSA9IHVybFxuICAgID8gYDxzcGFuIGNsYXNzPVwicGlsbCBzdWNjZXNzXCI+Q29uZmlndXJlZDwvc3Bhbj5gXG4gICAgOiBgPHNwYW4gY2xhc3M9XCJwaWxsIHdhcm5pbmdcIj5Ob3Qgc2V0IFx1MjAxNCBsaW5rcyB3b24ndCBnZW5lcmF0ZTwvc3Bhbj5gO1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJzZWN0aW9uLWhlYWRcIj5cbiAgICAgIDxkaXY+PGgzPlBhcmVudCBBcHBsaWNhdGlvbjwvaDM+PHA+RGVzaWduIHRoZSBmYW1pbHkgaW50YWtlIGFwcGxpY2F0aW9uIGFuZCBjb25uZWN0IHRoZSBwdWJsaWMgbGluay48L3A+PC9kaXY+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cImNhcmRcIiBzdHlsZT1cInBhZGRpbmc6MThweCAyMHB4O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjE2cHhcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJpY29cIiBzdHlsZT1cImZsZXg6MCAwIGF1dG9cIj4ke2ljKCdmaWxlJywgMjQpfTwvZGl2PlxuICAgICAgPGRpdiBzdHlsZT1cImZsZXg6MVwiPlxuICAgICAgICA8YiBzdHlsZT1cImRpc3BsYXk6YmxvY2s7Zm9udC1zaXplOjE1cHhcIj5BcHBsaWNhdGlvbiBCdWlsZGVyPC9iPlxuICAgICAgICA8cCBzdHlsZT1cIm1hcmdpbjoycHggMCAwO2ZvbnQtc2l6ZToxM3B4O2NvbG9yOnZhcigtLW11dGVkLWZvcmVncm91bmQpXCI+QWRkIHF1ZXN0aW9ucywgY2hvaWNlcywgY29uZGl0aW9uYWwgbG9naWMsIGFuZCByZWNvcmQgbWFwcGluZyBcdTIwMTQgdGhlbiBwdWJsaXNoLjwvcD5cbiAgICAgIDwvZGl2PlxuICAgICAgPGEgY2xhc3M9XCJidG4gcHJpbWFyeVwiIGhyZWY9XCIjL2J1aWxkZXJcIj4ke2ljKCdlZGl0JywgMTUpfSBPcGVuIGJ1aWxkZXI8L2E+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cImNhcmQgZWRpdC1jYXJkXCIgc3R5bGU9XCJtYXJnaW4tdG9wOjE0cHhcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJlZGl0LWVyclwiIGhpZGRlbj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJwYWItZmxkXCI+XG4gICAgICAgIDxsYWJlbCBzdHlsZT1cImRpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjhweFwiPlB1YmxpYyBpbnRlcnByZXRlciBVUkwgJHt1cmxTdGF0ZX08L2xhYmVsPlxuICAgICAgICA8aW5wdXQgdHlwZT1cInRleHRcIiBpZD1cImFwcC1pbnRlcnAtdXJsXCIgdmFsdWU9XCIke2VzYyh1cmwpfVwiIHBsYWNlaG9sZGVyPVwiaHR0cHM6Ly9jb25uZWN0LmV4YW1wbGUub3JnL2ludGFrZVwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiXG4gICAgICAgICAgc3R5bGU9XCJ3aWR0aDoxMDAlO2JveC1zaXppbmc6Ym9yZGVyLWJveFwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwicGFiLWhpbnRcIj5UaGUgc2F0ZWxsaXRlLXNpdGUgcGFnZSBob3N0aW5nIHRoZSBBcHBsaWNhdGlvbiBJbnRlcnByZXRlci4gQ2xpZW50ICZhbXA7IHRva2VuIHBhcmFtcyBhcmUgYXBwZW5kZWQgYXV0b21hdGljYWxseS48L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImVkaXQtZm9vdFwiPlxuICAgICAgICA8c3BhbiBjbGFzcz1cImVkaXQtc3RhdHVzXCI+PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxleDoxXCI+PC9zcGFuPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnkganMtc2F2ZS1pbnRlcnBcIiBvbmNsaWNrPVwic2F2ZUludGVycHJldGVyVXJsKClcIj4ke2ljKCdzYXZlJywgMTUpfSBTYXZlPC9idXR0b24+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5gO1xufVxuXG5hc3luYyBmdW5jdGlvbiBzYXZlSW50ZXJwcmV0ZXJVcmwoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGlucHV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FwcC1pbnRlcnAtdXJsJykgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XG4gIGlmICghaW5wdXQpIHJldHVybjtcbiAgY29uc3QgdXJsID0gaW5wdXQudmFsdWUudHJpbSgpO1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuanMtc2F2ZS1pbnRlcnAnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG4gIGNvbnN0IHN0YXR1cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5lZGl0LWNhcmQgLmVkaXQtc3RhdHVzJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoYnRuKSBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICBpZiAoc3RhdHVzKSBzdGF0dXMudGV4dENvbnRlbnQgPSAnU2F2aW5nXHUyMDI2JztcbiAgdHJ5IHtcbiAgICBjb25zdCBtZXJnZWQgPSBhd2FpdCBzYXZlU2V0dGluZ3NTZWN0aW9uKCdhcHBsaWNhdGlvbicsIHsgaW50ZXJwcmV0ZXJVcmw6IHVybCB9KTtcbiAgICBTRVRUSU5HUyA9IG1lcmdlZCB8fCBTRVRUSU5HUztcbiAgICB0b2FzdCgnU2F2ZWQnKTtcbiAgICByZW5kZXIoKTtcbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgaWYgKGJ0bikgYnRuLmRpc2FibGVkID0gZmFsc2U7XG4gICAgaWYgKHN0YXR1cykgc3RhdHVzLnRleHRDb250ZW50ID0gJyc7XG4gICAgY29uc3QgZXJyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmVkaXQtY2FyZCAuZWRpdC1lcnInKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gICAgaWYgKGVycikgeyBlcnIudGV4dENvbnRlbnQgPSBlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKTsgZXJyLmhpZGRlbiA9IGZhbHNlOyB9XG4gIH1cbn1cblxuLy8gVGhlIEZpbGVzIHBhbmVsIGhvc3RzIHR3byBpbmRlcGVuZGVudCBkZWZhdWx0LWZvbGRlciBzZXRzOiBvbmUgZm9yIGNsaWVudFxuLy8gcmVjb3Jkcywgb25lIGZvciBwcm9ncmFtcy4gRWFjaCBpcyBhIHN0YW5kYXJkIGxpc3QgZWRpdG9yIHN0YWNrZWQgaW4gdGhlIHBhbmVsLlxuZnVuY3Rpb24gZmlsZXNTZXR0aW5nc1BhbmVsKCk6IHN0cmluZyB7XG4gIHJldHVybiBsaXN0RWRpdG9yUGFuZWwoJ2ZpbGVzLmRlZmF1bHRGb2xkZXJzJykgKyBsaXN0RWRpdG9yUGFuZWwoJ2ZpbGVzLnByb2dyYW1EZWZhdWx0Rm9sZGVycycpO1xufVxuXG5yZWdpc3Rlckxpc3RFZGl0b3Ioe1xuICBrZXk6ICdmaWxlcy5kZWZhdWx0Rm9sZGVycycsXG4gIHRpdGxlOiAnQ2xpZW50IGRlZmF1bHQgZm9sZGVycycsXG4gIHBsYWNlaG9sZGVyOiAnRm9sZGVyIG5hbWUgKHVzZSAvIGZvciBzdWJmb2xkZXJzLCBlLmcuIE1lZGljYWwvTGFicyknLFxuICBoaW50OiB1c2luZ0RlZmF1bHRzID0+IHVzaW5nRGVmYXVsdHNcbiAgICA/ICdTdGFydGVyIGRlZmF1bHRzLiBFZGl0IGFuZCBTYXZlIHRvIHNldCB0aGUgZm9sZGVycyB0aGF0IGF1dG8tYXBwZWFyIG9uIGV2ZXJ5IGNsaWVudFx1MjAxOXMgRmlsZXMgdGFiLidcbiAgICA6ICdUaGVzZSBmb2xkZXJzIGF1dG9tYXRpY2FsbHkgYXBwZWFyIG9uIGV2ZXJ5IGNsaWVudFx1MjAxOXMgRmlsZXMgdGFiLiBVc2UgXCIvXCIgZm9yIHN1YmZvbGRlcnMsIGUuZy4gTWVkaWNhbC9MYWJzLicsXG4gIHJlYWQ6ICgpID0+IGRlZmF1bHRGb2xkZXJzKCksXG4gIGZhbGxiYWNrOiBERUZBVUxUX0ZPTERFUlNfU0VFRCxcbiAgc2F2ZTogdmFscyA9PiBzYXZlU2V0dGluZ3NTZWN0aW9uKCdmaWxlcycsIHsgZGVmYXVsdEZvbGRlcnM6IHZhbHMgfSksXG59KTtcblxucmVnaXN0ZXJMaXN0RWRpdG9yKHtcbiAga2V5OiAnZmlsZXMucHJvZ3JhbURlZmF1bHRGb2xkZXJzJyxcbiAgdGl0bGU6ICdQcm9ncmFtIGRlZmF1bHQgZm9sZGVycycsXG4gIHBsYWNlaG9sZGVyOiAnRm9sZGVyIG5hbWUgKHVzZSAvIGZvciBzdWJmb2xkZXJzLCBlLmcuIFRvdXJzLzIwMjYpJyxcbiAgaGludDogdXNpbmdEZWZhdWx0cyA9PiB1c2luZ0RlZmF1bHRzXG4gICAgPyAnU3RhcnRlciBkZWZhdWx0cy4gRWRpdCBhbmQgU2F2ZSB0byBzZXQgdGhlIGZvbGRlcnMgdGhhdCBhdXRvLWFwcGVhciBvbiBldmVyeSBwcm9ncmFtXHUyMDE5cyBGaWxlcyB0YWIuJ1xuICAgIDogJ1RoZXNlIGZvbGRlcnMgYXV0b21hdGljYWxseSBhcHBlYXIgb24gZXZlcnkgcHJvZ3JhbVx1MjAxOXMgRmlsZXMgdGFiLiBVc2UgXCIvXCIgZm9yIHN1YmZvbGRlcnMsIGUuZy4gVG91cnMvMjAyNi4nLFxuICByZWFkOiAoKSA9PiBwcm9ncmFtRGVmYXVsdEZvbGRlcnMoKSxcbiAgZmFsbGJhY2s6IFBST0dSQU1fREVGQVVMVF9GT0xERVJTX1NFRUQsXG4gIHNhdmU6IHZhbHMgPT4gc2F2ZVNldHRpbmdzU2VjdGlvbignZmlsZXMnLCB7IHByb2dyYW1EZWZhdWx0Rm9sZGVyczogdmFscyB9KSxcbn0pO1xuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgIEJsdWVJUSBwYW5lbCBcdTIwMTQgcGVyLXVzZXIgc2VhdCBtYW5hZ2VtZW50IChhZG1pbiBvbmx5KS5cbiAgIEJhY2tlZCBieSAvYi9ibHVlaXFBZG1pbiAocnVuQXNTdXBlciwgYWRtaW4tZ2F0ZWQpLiBUdXJuIEJsdWVJUSBvbi9vZmZcbiAgIHBlciB1c2VyIGFuZCBzZXQgZWFjaCBwZXJzb24ncyBtb250aGx5IGNyZWRpdCBjYXAuIFZpc2libGUgb25seSB0byBhXG4gICBCbHVlSVEgYWRtaW4gb3IgYSBnbG9iYWwgc3VwZXIgKHNlZSBTRVRUSU5HU19QQU5FTFMgYWRtaW5Pbmx5ICsgdmlld1NldHRpbmdzKS5cbiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuaW50ZXJmYWNlIEJpcUN0eCB7IGlzU3VwZXI6IGJvb2xlYW47IGlzQWRtaW46IGJvb2xlYW47IGVuYWJsZWQ6IGJvb2xlYW47IH1cbmxldCBCSVFfQ1RYOiBCaXFDdHggfCBudWxsID0gbnVsbDtcbmxldCBCSVFfQ1RYX0xPQURJTkcgPSBmYWxzZTtcblxuLy8gTG9hZGVkIG9uY2UgKGxhemlseSkgdG8gZGVjaWRlIHdoZXRoZXIgdG8gc2hvdyB0aGUgQmx1ZUlRIHNldHRpbmdzIHRhYiBmb3IgYVxuLy8gbm9uLXN1cGVyIHVzZXIuIFN1cGVycyBhcmUga25vd24gc3luY2hyb25vdXNseSBmcm9tIFNFU1NJT04uXG5hc3luYyBmdW5jdGlvbiBsb2FkQmlxQ3R4KCk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoQklRX0NUWF9MT0FESU5HIHx8IEJJUV9DVFgpIHJldHVybjtcbiAgQklRX0NUWF9MT0FESU5HID0gdHJ1ZTtcbiAgdHJ5IHtcbiAgICBjb25zdCBjID0gYXdhaXQgYXBpQmx1ZWlxQWRtaW5Db250ZXh0KCk7XG4gICAgQklRX0NUWCA9IHsgaXNTdXBlcjogISFjLmlzU3VwZXIsIGlzQWRtaW46ICEhYy5pc0FkbWluLCBlbmFibGVkOiAhIWMuZW5hYmxlZCB9O1xuICB9IGNhdGNoIChfZSkge1xuICAgIEJJUV9DVFggPSB7IGlzU3VwZXI6IGZhbHNlLCBpc0FkbWluOiBmYWxzZSwgZW5hYmxlZDogZmFsc2UgfTtcbiAgfSBmaW5hbGx5IHtcbiAgICBCSVFfQ1RYX0xPQURJTkcgPSBmYWxzZTtcbiAgICBpZiAodHlwZW9mIHJlbmRlciA9PT0gJ2Z1bmN0aW9uJykgcmVuZGVyKCk7XG4gIH1cbn1cblxuLy8gU3luY2hyb25vdXMgXCJjYW4gdGhpcyB1c2VyIG1hbmFnZSBCbHVlSVEgc2VhdHM/XCIgXHUyMDE0IHN1cGVycyBhbHdheXM7IG90aGVycyBvbmNlXG4vLyBjb250ZXh0IHJlc29sdmVzLiBLaWNrcyBvZmYgdGhlIGNvbnRleHQgbG9hZCBvbiBmaXJzdCBtaXNzLlxuZnVuY3Rpb24gYmlxQ2FuQWRtaW4oKTogYm9vbGVhbiB7XG4gIGlmIChTRVNTSU9OICYmIFNFU1NJT04uaXNTdXBlcikgcmV0dXJuIHRydWU7XG4gIGlmIChCSVFfQ1RYKSByZXR1cm4gQklRX0NUWC5pc0FkbWluO1xuICBsb2FkQmlxQ3R4KCk7XG4gIHJldHVybiBmYWxzZTtcbn1cblxuaW50ZXJmYWNlIEJpcVVzZXJSb3cgeyB1c2VySWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nOyBlbWFpbDogc3RyaW5nOyBlbmFibGVkOiBib29sZWFuOyBtb250aGx5Q3JlZGl0czogbnVtYmVyOyByb2xlOiBzdHJpbmc7IGhhc1JvdzogYm9vbGVhbjsgfVxuY29uc3QgQklRX0FETUlOOiB7IHVzZXJzOiBCaXFVc2VyUm93W107IGRlZmF1bHRDcmVkaXRzOiBudW1iZXI7IGxvYWRpbmc6IGJvb2xlYW47IGVycm9yOiBzdHJpbmcgfCBudWxsOyBsb2FkZWQ6IGJvb2xlYW4gfSA9XG4gIHsgdXNlcnM6IFtdLCBkZWZhdWx0Q3JlZGl0czogNTAwMCwgbG9hZGluZzogZmFsc2UsIGVycm9yOiBudWxsLCBsb2FkZWQ6IGZhbHNlIH07XG5cbmFzeW5jIGZ1bmN0aW9uIGxvYWRCaXFBZG1pbihmb3JjZSA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmIChCSVFfQURNSU4ubG9hZGluZykgcmV0dXJuO1xuICBpZiAoQklRX0FETUlOLmxvYWRlZCAmJiAhZm9yY2UpIHJldHVybjtcbiAgQklRX0FETUlOLmxvYWRpbmcgPSB0cnVlOyBCSVFfQURNSU4uZXJyb3IgPSBudWxsO1xuICB0cnkge1xuICAgIGNvbnN0IGQgPSBhd2FpdCBhcGlCbHVlaXFMaXN0VXNlcnMoKTtcbiAgICBCSVFfQURNSU4udXNlcnMgPSAoKGQgJiYgZC51c2VycykgfHwgW10pLm1hcCgodTogYW55KSA9PiAoe1xuICAgICAgdXNlcklkOiBTdHJpbmcodS51c2VySWQgfHwgJycpLCBuYW1lOiBTdHJpbmcodS5uYW1lIHx8ICcnKSwgZW1haWw6IFN0cmluZyh1LmVtYWlsIHx8ICcnKSxcbiAgICAgIGVuYWJsZWQ6IHUuZW5hYmxlZCA9PT0gdHJ1ZSwgbW9udGhseUNyZWRpdHM6IE51bWJlcih1Lm1vbnRobHlDcmVkaXRzKSB8fCAwLFxuICAgICAgcm9sZTogU3RyaW5nKHUucm9sZSB8fCAnJyksIGhhc1JvdzogdS5oYXNSb3cgPT09IHRydWVcbiAgICB9KSk7XG4gICAgQklRX0FETUlOLmRlZmF1bHRDcmVkaXRzID0gTnVtYmVyKGQgJiYgZC5kZWZhdWx0TW9udGhseUNyZWRpdHMpIHx8IDUwMDA7XG4gICAgQklRX0FETUlOLmxvYWRlZCA9IHRydWU7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIEJJUV9BRE1JTi5lcnJvciA9IGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpO1xuICB9IGZpbmFsbHkge1xuICAgIEJJUV9BRE1JTi5sb2FkaW5nID0gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiByZW5kZXIgPT09ICdmdW5jdGlvbicpIHJlbmRlcigpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGJsdWVpcUFkbWluUGFuZWwoKTogc3RyaW5nIHtcbiAgY29uc3QgaGVhZCA9IGA8ZGl2IGNsYXNzPVwic2VjdGlvbi1oZWFkXCI+PGRpdj48aDM+Qmx1ZUlRPC9oMz48cD5UdXJuIEJsdWVJUSBvbiBvciBvZmYgZm9yIGVhY2ggcGVyc29uIGFuZCBzZXQgdGhlaXIgbW9udGhseSB1c2FnZSBsaW1pdC4gRWFjaCBhY3RpdmUgc2VhdCBpcyBiaWxsZWQgYXQgJDE1L21vLjwvcD48L2Rpdj48L2Rpdj5gO1xuICBpZiAoIWJpcUNhbkFkbWluKCkpIHJldHVybiBoZWFkICsgcGFuZWxTb29uKCdCbHVlSVEnLCAnT25seSBhIEJsdWVJUSBhZG1pbmlzdHJhdG9yIGNhbiBtYW5hZ2Ugc2VhdHMuJyk7XG4gIGlmICghQklRX0FETUlOLmxvYWRlZCAmJiAhQklRX0FETUlOLmxvYWRpbmcpIGxvYWRCaXFBZG1pbigpO1xuICBpZiAoQklRX0FETUlOLmxvYWRpbmcgJiYgIUJJUV9BRE1JTi5sb2FkZWQpIHJldHVybiBoZWFkICsgYDxkaXYgY2xhc3M9XCJjYXJkXCI+PGRpdiBjbGFzcz1cImVtcHR5XCI+PGI+TG9hZGluZyB1c2Vyc1x1MjAyNjwvYj48L2Rpdj48L2Rpdj5gO1xuICBpZiAoQklRX0FETUlOLmVycm9yKSByZXR1cm4gaGVhZCArIGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlZGl0LWVyclwiPiR7ZXNjKEJJUV9BRE1JTi5lcnJvcil9PC9kaXY+PC9kaXY+YDtcblxuICBjb25zdCBlbmFibGVkQ291bnQgPSBCSVFfQURNSU4udXNlcnMuZmlsdGVyKHUgPT4gdS5lbmFibGVkKS5sZW5ndGg7XG4gIGNvbnN0IHJvd3MgPSBCSVFfQURNSU4udXNlcnMubWFwKHUgPT4gYmlxUm93SHRtbCh1KSkuam9pbignJyk7XG4gIGNvbnN0IHN1bW1hcnkgPSBgJHtlbmFibGVkQ291bnR9IHNlYXQke2VuYWJsZWRDb3VudCA9PT0gMSA/ICcnIDogJ3MnfSBhY3RpdmUgXHUwMEI3IGRlZmF1bHQgbGltaXQgJHtCSVFfQURNSU4uZGVmYXVsdENyZWRpdHMudG9Mb2NhbGVTdHJpbmcoKX0gY3JlZGl0cy9tb2A7XG4gIHJldHVybiBoZWFkICsgYDxkaXYgY2xhc3M9XCJjYXJkXCI+XG4gICAgPGRpdiBjbGFzcz1cImJpcS1hZG1pbi1zdW1tYXJ5XCI+JHtlc2Moc3VtbWFyeSl9PC9kaXY+XG4gICAgPHRhYmxlIGNsYXNzPVwiYmlxLWFkbWluLXRhYmxlXCI+XG4gICAgICA8dGhlYWQ+PHRyPjx0aD5Vc2VyPC90aD48dGg+Qmx1ZUlRPC90aD48dGg+TW9udGhseSBjcmVkaXRzPC90aD48dGg+Um9sZTwvdGg+PHRoPjwvdGg+PC90cj48L3RoZWFkPlxuICAgICAgPHRib2R5PiR7cm93cyB8fCAnPHRyPjx0ZCBjb2xzcGFuPVwiNVwiIGNsYXNzPVwibXV0ZWRcIiBzdHlsZT1cInBhZGRpbmc6MTZweFwiPk5vIHVzZXJzIGZvdW5kLjwvdGQ+PC90cj4nfTwvdGJvZHk+XG4gICAgPC90YWJsZT5cbiAgICA8cCBjbGFzcz1cIm11dGVkXCIgc3R5bGU9XCJtYXJnaW4tdG9wOjEwcHg7Zm9udC1zaXplOjEycHhcIj5MZWF2ZSB0aGUgY3JlZGl0IGxpbWl0IGJsYW5rIHRvIHVzZSB0aGUgZGVmYXVsdCAoJHtCSVFfQURNSU4uZGVmYXVsdENyZWRpdHMudG9Mb2NhbGVTdHJpbmcoKX0pLiBUaGUgbGltaXQgaXMgYSBzYWZldHkgY2FwIFx1MjAxNCBhIHR5cGljYWwgdXNlciB1c2VzIGZhciBsZXNzLjwvcD5cbiAgPC9kaXY+YDtcbn1cblxuZnVuY3Rpb24gYmlxUm93SHRtbCh1OiBCaXFVc2VyUm93KTogc3RyaW5nIHtcbiAgY29uc3QgY3JlZGl0c1ZhbCA9IHUubW9udGhseUNyZWRpdHMgPiAwID8gU3RyaW5nKHUubW9udGhseUNyZWRpdHMpIDogJyc7XG4gIGNvbnN0IGRpcyA9IHUuZW5hYmxlZCA/ICcnIDogJ2Rpc2FibGVkJztcbiAgcmV0dXJuIGA8dHIgZGF0YS11aWQ9XCIke2VzYyh1LnVzZXJJZCl9XCI+XG4gICAgPHRkPjxkaXYgY2xhc3M9XCJiaXEtdS1uYW1lXCI+JHtlc2ModS5uYW1lIHx8IHUudXNlcklkKX08L2Rpdj4ke3UuZW1haWwgPyBgPGRpdiBjbGFzcz1cImJpcS11LWVtYWlsIG11dGVkXCI+JHtlc2ModS5lbWFpbCl9PC9kaXY+YCA6ICcnfTwvdGQ+XG4gICAgPHRkPjxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBjbGFzcz1cImJpcS1lblwiICR7dS5lbmFibGVkID8gJ2NoZWNrZWQnIDogJyd9IG9uY2hhbmdlPVwiYmlxVG9nZ2xlKCcke2VzYyh1LnVzZXJJZCl9JywgdGhpcy5jaGVja2VkKVwiPjwvdGQ+XG4gICAgPHRkPjxpbnB1dCBjbGFzcz1cImJpcS1jcmVkaXRzXCIgdHlwZT1cIm51bWJlclwiIG1pbj1cIjBcIiBzdGVwPVwiMTAwXCIgdmFsdWU9XCIke2VzYyhjcmVkaXRzVmFsKX1cIiBwbGFjZWhvbGRlcj1cIiR7QklRX0FETUlOLmRlZmF1bHRDcmVkaXRzfVwiICR7ZGlzfSBvbmNoYW5nZT1cImJpcVNldExpbWl0KCcke2VzYyh1LnVzZXJJZCl9JywgdGhpcy52YWx1ZSlcIj48L3RkPlxuICAgIDx0ZD48c2VsZWN0IGNsYXNzPVwiYmlxLXJvbGVcIiAke2Rpc30gb25jaGFuZ2U9XCJiaXFTZXRSb2xlKCcke2VzYyh1LnVzZXJJZCl9JywgdGhpcy52YWx1ZSlcIj5cbiAgICAgIDxvcHRpb24gdmFsdWU9XCJtZW1iZXJcIiAke3Uucm9sZSA9PT0gJ2FkbWluJyA/ICcnIDogJ3NlbGVjdGVkJ30+TWVtYmVyPC9vcHRpb24+XG4gICAgICA8b3B0aW9uIHZhbHVlPVwiYWRtaW5cIiAke3Uucm9sZSA9PT0gJ2FkbWluJyA/ICdzZWxlY3RlZCcgOiAnJ30+QWRtaW48L29wdGlvbj5cbiAgICA8L3NlbGVjdD48L3RkPlxuICAgIDx0ZD4ke3UuaGFzUm93ID8gYDxidXR0b24gY2xhc3M9XCJidG4taWNvblwiIHRpdGxlPVwiUmVtb3ZlIEJsdWVJUSBzZWF0XCIgb25jbGljaz1cImJpcVJlbW92ZSgnJHtlc2ModS51c2VySWQpfScpXCI+JHtpYygndHJhc2gnLCAxNSl9PC9idXR0b24+YCA6ICcnfTwvdGQ+XG4gIDwvdHI+YDtcbn1cblxuZnVuY3Rpb24gYmlxUm93KHVzZXJJZDogc3RyaW5nKTogQmlxVXNlclJvdyB8IG51bGwge1xuICBjb25zdCBtID0gQklRX0FETUlOLnVzZXJzLmZpbHRlcih4ID0+IHgudXNlcklkID09PSB1c2VySWQpO1xuICByZXR1cm4gbS5sZW5ndGggPyBtWzBdIDogbnVsbDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYmlxVG9nZ2xlKHVzZXJJZDogc3RyaW5nLCBlbmFibGVkOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHUgPSBiaXFSb3codXNlcklkKTtcbiAgdHJ5IHtcbiAgICBjb25zdCBwYXlsb2FkOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHsgdXNlcklkOiB1c2VySWQsIGVuYWJsZWQ6IGVuYWJsZWQgfTtcbiAgICBpZiAodSkgeyBwYXlsb2FkLnVzZXJOYW1lID0gdS5uYW1lOyBpZiAodS5lbWFpbCkgcGF5bG9hZC5lbWFpbCA9IHUuZW1haWw7IH1cbiAgICBjb25zdCBkID0gYXdhaXQgYXBpQmx1ZWlxU2V0U3Vic2NyaXB0aW9uKHBheWxvYWQpO1xuICAgIGlmICh1ICYmIGQgJiYgZC5zdWJzY3JpcHRpb24pIHtcbiAgICAgIHUuZW5hYmxlZCA9IGQuc3Vic2NyaXB0aW9uLmVuYWJsZWQgPT09IHRydWU7XG4gICAgICB1LnJvbGUgPSBTdHJpbmcoZC5zdWJzY3JpcHRpb24ucm9sZSB8fCB1LnJvbGUpO1xuICAgICAgdS5tb250aGx5Q3JlZGl0cyA9IE51bWJlcihkLnN1YnNjcmlwdGlvbi5tb250aGx5Q3JlZGl0cykgfHwgMDtcbiAgICAgIHUuaGFzUm93ID0gdHJ1ZTtcbiAgICB9XG4gICAgdG9hc3QoZW5hYmxlZCA/ICdCbHVlSVEgZW5hYmxlZCcgOiAnQmx1ZUlRIGRpc2FibGVkJyk7XG4gICAgcmVuZGVyKCk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIHRvYXN0KCdDb3VsZCBub3QgdXBkYXRlOiAnICsgKGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpKSk7XG4gICAgbG9hZEJpcUFkbWluKHRydWUpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGJpcVNldExpbWl0KHVzZXJJZDogc3RyaW5nLCB2YWw6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBuID0gcGFyc2VJbnQoU3RyaW5nKHZhbCksIDEwKTtcbiAgY29uc3QgY3JlZGl0cyA9IGlzRmluaXRlKG4pICYmIG4gPiAwID8gbiA6IDA7IC8vIDAgPT4gc2VydmVyIHVzZXMgdGhlIGRlZmF1bHRcbiAgY29uc3QgdSA9IGJpcVJvdyh1c2VySWQpO1xuICB0cnkge1xuICAgIGF3YWl0IGFwaUJsdWVpcVNldFN1YnNjcmlwdGlvbih7IHVzZXJJZDogdXNlcklkLCBtb250aGx5Q3JlZGl0czogY3JlZGl0cyB9KTtcbiAgICBpZiAodSkgdS5tb250aGx5Q3JlZGl0cyA9IGNyZWRpdHM7XG4gICAgdG9hc3QoJ0xpbWl0IHNhdmVkJyk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIHRvYXN0KCdDb3VsZCBub3Qgc2F2ZSBsaW1pdDogJyArIChlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSkpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGJpcVNldFJvbGUodXNlcklkOiBzdHJpbmcsIHJvbGU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCB1ID0gYmlxUm93KHVzZXJJZCk7XG4gIHRyeSB7XG4gICAgYXdhaXQgYXBpQmx1ZWlxU2V0U3Vic2NyaXB0aW9uKHsgdXNlcklkOiB1c2VySWQsIHJvbGU6IHJvbGUgfSk7XG4gICAgaWYgKHUpIHUucm9sZSA9IHJvbGU7XG4gICAgdG9hc3QoJ1JvbGUgc2F2ZWQnKTtcbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgdG9hc3QoJ0NvdWxkIG5vdCBzYXZlIHJvbGU6ICcgKyAoZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBiaXFSZW1vdmUodXNlcklkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKCF3aW5kb3cuY29uZmlybSgnUmVtb3ZlIHRoaXMgQmx1ZUlRIHNlYXQ/IFRoZSB1c2VyIHdpbGwgbG9zZSBhY2Nlc3MgdG8gQmx1ZUlRLicpKSByZXR1cm47XG4gIHRyeSB7XG4gICAgYXdhaXQgYXBpQmx1ZWlxUmVtb3ZlU3Vic2NyaXB0aW9uKHVzZXJJZCk7XG4gICAgYXdhaXQgbG9hZEJpcUFkbWluKHRydWUpO1xuICAgIHRvYXN0KCdTZWF0IHJlbW92ZWQnKTtcbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgdG9hc3QoJ0NvdWxkIG5vdCByZW1vdmU6ICcgKyAoZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpKTtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBZ0JBLE1BQU0sa0JBQW1DO0FBQUEsRUFDdkMsRUFBRSxLQUFLLGNBQWMsT0FBTyxjQUFjLE1BQU0sT0FBTyxRQUFRLE1BQU0sZ0JBQWdCLEVBQUU7QUFBQSxFQUN2RixFQUFFLEtBQUssWUFBWSxPQUFPLFlBQVksTUFBTSxTQUFTLFFBQVEsTUFBTSxnQkFBZ0Isd0JBQXdCLEVBQUU7QUFBQSxFQUM3RyxFQUFFLEtBQUssYUFBYSxPQUFPLGFBQWEsTUFBTSxRQUFRLFFBQVEsTUFBTSxnQkFBZ0IsMEJBQTBCLEVBQUU7QUFBQSxFQUNoSCxFQUFFLEtBQUssU0FBUyxPQUFPLFNBQVMsTUFBTSxRQUFRLFFBQVEsTUFBTSxtQkFBbUIsRUFBRTtBQUFBLEVBQ2pGLEVBQUUsS0FBSyxnQkFBZ0IsT0FBTyxnQkFBZ0IsTUFBTSxRQUFRLFFBQVEsTUFBTSwwQkFBMEIsRUFBRTtBQUFBLEVBQ3RHLEVBQUUsS0FBSyxjQUFjLE9BQU8sY0FBYyxNQUFNLFlBQVksUUFBUSxNQUFNLHdCQUF3QixFQUFFO0FBQUEsRUFDcEcsRUFBRSxLQUFLLFNBQVMsT0FBTyxxQkFBcUIsTUFBTSxPQUFPLFFBQVEsTUFBTSxpQkFBaUIsRUFBRTtBQUFBLEVBQzFGLEVBQUUsS0FBSyxtQkFBbUIsT0FBTyxtQkFBbUIsTUFBTSxRQUFRLFFBQVEsTUFBTSxvQkFBb0IsRUFBRTtBQUFBO0FBQUEsRUFFdEcsRUFBRSxLQUFLLFVBQVUsT0FBTyxVQUFVLE1BQU0sT0FBTyxXQUFXLE1BQU0sUUFBUSxNQUFNLGlCQUFpQixFQUFFO0FBQUEsRUFDakcsRUFBRSxLQUFLLGdCQUFnQixPQUFPLGdCQUFnQixNQUFNLFlBQVks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
