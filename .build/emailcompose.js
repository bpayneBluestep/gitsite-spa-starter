function orgEmailTemplates() {
  const s = SETTINGS;
  const arr = s && s.email && Array.isArray(s.email.templates) ? s.email.templates : [];
  return arr.filter((t) => t && t.active !== false).map((t) => ({ id: String(t.id || ""), title: String(t.title || ""), subject: String(t.subject || ""), body: String(t.body || "") }));
}
function joinNames(parts) {
  const clean = parts.map((p) => (p || "").trim()).filter((p) => p.length > 0);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return clean[0] + " and " + clean[1];
  return clean.slice(0, -1).join(", ") + ", and " + clean[clean.length - 1];
}
function substituteVars(template, vars) {
  return template.replace(/\{(\w+)\}/g, (m, key) => Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : m);
}
function composerVars(c, selected) {
  const firsts = selected.map((x) => x.firstName);
  const lasts = selected.map((x) => x.lastName);
  const fulls = selected.map((x) => (x.firstName + (x.lastName ? " " + x.lastName : "")).trim());
  const clientFull = (c.first + (c.last ? " " + c.last : "")).trim();
  return {
    clientFirstName: c.first || "",
    clientPreferredName: c.prefName || c.first || "",
    clientLastName: c.last || "",
    clientFullName: clientFull,
    contactFirstName: joinNames(firsts),
    contactPreferredName: joinNames(firsts),
    contactLastName: joinNames(lasts),
    contactFullName: joinNames(fulls),
    myFirstName: SESSION ? SESSION.firstName : "",
    myLastName: SESSION ? SESSION.lastName : ""
  };
}
function parseAddrList(raw) {
  if (!raw) return [];
  return raw.split(/[,;]/).map((s) => s.trim()).filter((s) => s.length > 0);
}
let COMPOSE_CID = "";
let COMPOSE_SELECTED_IDS = [];
function composeContacts() {
  const list = (contactsState(COMPOSE_CID).list || []).filter((ct) => !!ct.email);
  return list;
}
function composeSelected() {
  const byId = composeContacts();
  const out = [];
  for (const id of COMPOSE_SELECTED_IDS) {
    const ct = byId.filter((x) => x.entryId === id)[0];
    if (ct) out.push(ct);
  }
  return out;
}
function composerConnected() {
  return (EMAIL_STATE.list || []).some((a) => a.connected);
}
async function openEmailComposer(cid, preselectIds) {
  const c = findClient(cid);
  if (!c) {
    toast("Client not found.");
    return;
  }
  await Promise.all([
    contactsState(cid).list === null ? loadContacts(cid) : Promise.resolve(),
    SETTINGS === null ? loadSettings() : Promise.resolve(),
    EMAIL_STATE.list === null ? loadEmailStatus() : Promise.resolve()
  ]);
  COMPOSE_CID = cid;
  const pre = (preselectIds || "").split(",").map((s) => s.trim()).filter(Boolean);
  const valid = composeContacts().map((ct) => ct.entryId);
  COMPOSE_SELECTED_IDS = pre.filter((id) => valid.indexOf(id) !== -1);
  buildComposerModal(c);
}
function buildComposerModal(c) {
  if (document.getElementById("__emailModal")) closeEmailComposer();
  const connected = composerConnected();
  const contactsList = composeContacts();
  const templates = orgEmailTemplates().slice().sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
  const banner = connected ? "" : `<div class="modal-err" style="display:block">Your mailbox isn't connected. Open <b>My Email</b> (top-right account menu) and connect it before sending.</div>`;
  const chips = contactsList.length ? contactsList.map((ct) => {
    const on = COMPOSE_SELECTED_IDS.indexOf(ct.entryId) !== -1;
    const nm = (ct.firstName + " " + ct.lastName).trim() || ct.email;
    return `<button type="button" class="compose-chip${on ? " on" : ""}" data-ceid="${esc(ct.entryId)}" onclick="toggleComposeContact('${esc(ct.entryId)}', this)">
          <span class="cc-nm">${esc(nm)}</span><span class="cc-em">${esc(ct.email)}</span></button>`;
  }).join("") : `<div class="compose-empty">No contacts with an email on file \u2014 type recipients in the To field.</div>`;
  const tmplOpts = ['<option value="">\u2014 insert a template \u2014</option>'].concat(templates.map((t) => `<option value="${esc(t.id)}">${esc(t.title || "(untitled)")}</option>`)).join("");
  const host = document.createElement("div");
  host.className = "modal-overlay";
  host.id = "__emailModal";
  host.innerHTML = `<div class="modal-card compose-card" role="dialog" aria-modal="true" aria-label="Compose email" data-cid="${esc(c.id)}">
    <div class="modal-head">
      <div><b>Compose email</b><p>Send to ${esc(c.first)}'s contacts from your connected mailbox.</p></div>
      <button class="ico-x" title="Close" onclick="closeEmailComposer()">${ic("x", 18)}</button>
    </div>
    <div class="modal-body">
      ${banner}
      <div class="modal-err" hidden></div>
      <div class="compose-pickers">${chips}</div>
      <div class="field full"><label>To</label><input type="text" id="__cTo" placeholder="email@example.com (comma-separated)" autocomplete="off"></div>
      <div class="field-grid">
        <div class="field"><label>CC</label><input type="text" id="__cCc" placeholder="(optional)" autocomplete="off"></div>
        <div class="field"><label>BCC</label><input type="text" id="__cBcc" placeholder="(optional)" autocomplete="off"></div>
      </div>
      <div class="field full"><label>Subject</label><input type="text" id="__cSubject" placeholder="Subject" autocomplete="off"></div>
      <div class="compose-toolbar" role="toolbar" aria-label="Formatting">
        <button type="button" title="Bold" onclick="composeExec('bold')"><b>B</b></button>
        <button type="button" title="Italic" onclick="composeExec('italic')"><i>I</i></button>
        <button type="button" title="Underline" onclick="composeExec('underline')"><u>U</u></button>
        <button type="button" title="Heading" onclick="composeExec('formatBlock','H2')">H</button>
        <button type="button" title="Bulleted list" onclick="composeExec('insertUnorderedList')">&bull; List</button>
        <button type="button" title="Numbered list" onclick="composeExec('insertOrderedList')">1. List</button>
        <button type="button" title="Insert link" onclick="composeExec('createLink')">Link</button>
        <span style="flex:1"></span>
        <label class="compose-tmpl">Template <select id="__cTemplate" onchange="onComposeTemplate(this)">${tmplOpts}</select></label>
      </div>
      <div id="__cBody" class="compose-body" contenteditable="true" aria-label="Email body"></div>
    </div>
    <div class="modal-foot">
      <span class="modal-status"></span>
      <span style="flex:1"></span>
      <button class="btn ghost" onclick="closeEmailComposer()">${ic("x", 15)} Cancel</button>
      <button class="btn primary js-send" onclick="sendComposedEmail()"${connected ? "" : ' disabled title="Connect your mailbox first"'}>${ic("send", 15)} Send</button>
    </div>
  </div>`;
  host.addEventListener("mousedown", (e) => {
    if (e.target === host) closeEmailComposer();
  });
  document.body.appendChild(host);
  composeSyncTo();
  const subj = document.getElementById("__cSubject");
  if (subj) subj.focus();
  document.addEventListener("keydown", composeEscClose);
}
function composeEscClose(e) {
  if (e.key !== "Escape") return;
  closeEmailComposer();
}
function closeEmailComposer() {
  const m = document.getElementById("__emailModal");
  if (m) m.remove();
  document.removeEventListener("keydown", composeEscClose);
}
function composeSyncTo() {
  const to = document.getElementById("__cTo");
  if (!to) return;
  to.value = composeSelected().map((ct) => ct.email).join(", ");
}
function toggleComposeContact(entryId, btn) {
  const idx = COMPOSE_SELECTED_IDS.indexOf(entryId);
  if (idx === -1) {
    COMPOSE_SELECTED_IDS.push(entryId);
    btn.classList.add("on");
  } else {
    COMPOSE_SELECTED_IDS.splice(idx, 1);
    btn.classList.remove("on");
  }
  composeSyncTo();
}
function onComposeTemplate(sel) {
  const id = sel.value;
  if (!id) return;
  const tmpl = orgEmailTemplates().filter((t) => t.id === id)[0];
  if (!tmpl) return;
  const c = findClient(COMPOSE_CID);
  if (!c) return;
  const vars = composerVars(c, composeSelected());
  const subj = document.getElementById("__cSubject");
  const body = document.getElementById("__cBody");
  if (subj) subj.value = substituteVars(tmpl.subject, vars);
  if (body) body.innerHTML = substituteVars(tmpl.body, vars);
}
function composeExec(cmd, arg) {
  const body = document.getElementById("__cBody");
  if (body) body.focus();
  if (cmd === "createLink") {
    const url = window.prompt("Enter URL (https://\u2026):", "https://");
    if (!url) return;
    document.execCommand("createLink", false, url);
  } else if (cmd === "formatBlock" && arg) {
    document.execCommand("formatBlock", false, arg);
  } else {
    document.execCommand(cmd, false);
  }
}
function setComposeError(msg) {
  const errs = document.querySelectorAll("#__emailModal .modal-err");
  const el = errs[errs.length - 1];
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}
async function sendComposedEmail() {
  const modal = document.querySelector("#__emailModal .compose-card");
  if (!modal) return;
  const cid = modal.getAttribute("data-cid") || "";
  const to = parseAddrList(document.getElementById("__cTo").value);
  const cc = parseAddrList(document.getElementById("__cCc").value);
  const bcc = parseAddrList(document.getElementById("__cBcc").value);
  const subject = document.getElementById("__cSubject").value.trim();
  const bodyHtml = document.getElementById("__cBody").innerHTML.trim();
  setComposeError("");
  if (!to.length) {
    setComposeError("Add at least one recipient in the To field.");
    return;
  }
  if (!subject) {
    setComposeError("A subject is required.");
    return;
  }
  if (!bodyHtml || bodyHtml === "<br>") {
    setComposeError("The email body is empty.");
    return;
  }
  const sendBtn = modal.querySelector(".js-send");
  const status = modal.querySelector(".modal-status");
  if (sendBtn) sendBtn.disabled = true;
  if (status) status.textContent = "Sending\u2026";
  try {
    const res = await apiSendEmail({
      clientId: cid,
      provider: orgEmailProvider(),
      to,
      cc,
      bcc,
      subject,
      bodyHtml
    });
    closeEmailComposer();
    if (res && res.commError) toast("Sent \u2713 \u2014 but logging to the record failed: " + res.commError);
    else toast("Email sent \u2713");
    if (typeof loadCommunications === "function") loadCommunications(cid, true);
  } catch (e) {
    if (sendBtn) sendBtn.disabled = false;
    if (status) status.textContent = "";
    setComposeError("Send failed: " + (e && e.message ? e.message : String(e)));
  }
}
function allEmailTemplates() {
  const s = SETTINGS;
  return s && s.email && Array.isArray(s.email.templates) ? s.email.templates.slice() : [];
}
const TEMPLATE_VARS = [
  "clientFirstName",
  "clientPreferredName",
  "clientLastName",
  "clientFullName",
  "contactFirstName",
  "contactPreferredName",
  "contactLastName",
  "contactFullName",
  "myFirstName",
  "myLastName"
];
function emailTemplatesPanel() {
  if (SETTINGS === null && !SETTINGS_LOADING) loadSettings();
  const head = `<div class="section-head">
      <div><h3>Email Templates</h3><p>Reusable templates for the email composer. Use variables like <code>{clientFirstName}</code> \u2014 they fill in when a template is selected.</p></div>
      <button class="btn primary" onclick="openTemplateEditor()">${ic("plus", 15)} New template</button>
    </div>`;
  if (SETTINGS === null) return head + `<div class="card"><div class="empty"><div class="ico">${ic("clock", 22)}</div><b>Loading\u2026</b></div></div>`;
  const list = allEmailTemplates();
  if (!list.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic("msg", 22)}</div><b>No templates yet</b>
      <p>Create a reusable email your team can pick from the composer.</p>
      <button class="btn primary" onclick="openTemplateEditor()">${ic("plus", 15)} New template</button></div></div>`;
  }
  const rows = list.map((t) => {
    const active = t.active !== false;
    return `<div class="card tmpl-row">
      <div class="tmpl-info"><b>${esc(t.title || "(untitled)")}</b><span>${esc(t.subject || "")}</span></div>
      <span class="pill ${active ? "success" : "muted"}">${active ? "Active" : "Inactive"}</span>
      <div class="cc-acts">
        <button class="ico-mini" title="Edit" onclick="openTemplateEditor('${esc(String(t.id))}')">${ic("edit", 15)}</button>
        <button class="ico-mini danger" title="Delete" onclick="deleteTemplate('${esc(String(t.id))}')">${ic("trash", 15)}</button>
      </div>
    </div>`;
  }).join("");
  return head + `<div class="tmpl-list">${rows}</div>`;
}
function tmplExec(cmd, arg) {
  const body = document.getElementById("__tBody");
  if (body) body.focus();
  if (cmd === "createLink") {
    const url = window.prompt("Enter URL (https://\u2026):", "https://");
    if (!url) return;
    document.execCommand("createLink", false, url);
  } else if (cmd === "formatBlock" && arg) {
    document.execCommand("formatBlock", false, arg);
  } else {
    document.execCommand(cmd, false);
  }
}
function insertTmplVar(token) {
  const body = document.getElementById("__tBody");
  if (!body) return;
  body.focus();
  document.execCommand("insertText", false, token);
}
function openTemplateEditor(id) {
  if (document.getElementById("__tmplModal")) closeTemplateEditor();
  const t = id ? allEmailTemplates().filter((x) => String(x.id) === id)[0] : null;
  const editing = !!t;
  const host = document.createElement("div");
  host.className = "modal-overlay";
  host.id = "__tmplModal";
  host.innerHTML = `<div class="modal-card compose-card" role="dialog" aria-modal="true" aria-label="${editing ? "Edit template" : "New template"}" data-id="${esc(id || "")}">
    <div class="modal-head">
      <div><b>${editing ? "Edit template" : "New template"}</b><p>Variables in {curly braces} fill in when the template is chosen.</p></div>
      <button class="ico-x" title="Close" onclick="closeTemplateEditor()">${ic("x", 18)}</button>
    </div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <div class="field full"><label>Template name</label><input type="text" id="__tTitle" value="${esc(t ? t.title || "" : "")}" placeholder="e.g. Intake follow-up" autocomplete="off"></div>
      <div class="field full"><label>Subject</label><input type="text" id="__tSubject" value="${esc(t ? t.subject || "" : "")}" placeholder="Subject (may use {clientFirstName})" autocomplete="off"></div>
      <div class="compose-toolbar" role="toolbar" aria-label="Formatting">
        <button type="button" title="Bold" onclick="tmplExec('bold')"><b>B</b></button>
        <button type="button" title="Italic" onclick="tmplExec('italic')"><i>I</i></button>
        <button type="button" title="Underline" onclick="tmplExec('underline')"><u>U</u></button>
        <button type="button" title="Heading" onclick="tmplExec('formatBlock','H2')">H</button>
        <button type="button" title="Bulleted list" onclick="tmplExec('insertUnorderedList')">&bull; List</button>
        <button type="button" title="Numbered list" onclick="tmplExec('insertOrderedList')">1. List</button>
        <button type="button" title="Insert link" onclick="tmplExec('createLink')">Link</button>
      </div>
      <div id="__tBody" class="compose-body" contenteditable="true" aria-label="Template body"></div>
      <div class="tmpl-vars">Click to insert: ${TEMPLATE_VARS.map((v) => `<code onclick="insertTmplVar('{${v}}')">{${v}}</code>`).join(" ")}</div>
      <label class="tmpl-active"><input type="checkbox" id="__tActive" ${!t || t.active !== false ? "checked" : ""}> Active (show in the composer)</label>
    </div>
    <div class="modal-foot">
      <span class="modal-status"></span><span style="flex:1"></span>
      <button class="btn ghost" onclick="closeTemplateEditor()">${ic("x", 15)} Cancel</button>
      <button class="btn primary js-tsave" onclick="saveTemplateEditor()">${ic("save", 15)} ${editing ? "Save changes" : "Create"}</button>
    </div>
  </div>`;
  host.addEventListener("mousedown", (e) => {
    if (e.target === host) closeTemplateEditor();
  });
  document.body.appendChild(host);
  const body = document.getElementById("__tBody");
  if (body && t) body.innerHTML = t.body || "";
  const title = document.getElementById("__tTitle");
  if (title) title.focus();
  document.addEventListener("keydown", tmplEscClose);
}
function tmplEscClose(e) {
  if (e.key !== "Escape") return;
  closeTemplateEditor();
}
function closeTemplateEditor() {
  const m = document.getElementById("__tmplModal");
  if (m) m.remove();
  document.removeEventListener("keydown", tmplEscClose);
}
function setTmplError(msg) {
  const el = document.querySelector("#__tmplModal .modal-err");
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}
async function saveTemplateEditor() {
  const modal = document.querySelector("#__tmplModal .modal-card");
  if (!modal) return;
  const id = modal.getAttribute("data-id") || "";
  const title = document.getElementById("__tTitle").value.trim();
  const subject = document.getElementById("__tSubject").value.trim();
  const body = document.getElementById("__tBody").innerHTML.trim();
  const active = document.getElementById("__tActive").checked;
  setTmplError("");
  if (!title) {
    setTmplError("Give the template a name.");
    return;
  }
  const list = allEmailTemplates();
  let next;
  if (id) {
    next = list.map((t) => String(t.id) === id ? { id: t.id, title, subject, body, active } : t);
  } else {
    next = list.concat([{ id: "tmpl-" + Date.now(), title, subject, body, active }]);
  }
  const btn = modal.querySelector(".js-tsave");
  const status = modal.querySelector(".modal-status");
  if (btn) btn.disabled = true;
  if (status) status.textContent = "Saving\u2026";
  try {
    const merged = await saveSettingsSection("email", { templates: next });
    SETTINGS = merged || SETTINGS;
    closeTemplateEditor();
    toast("Template saved");
    render();
  } catch (e) {
    if (btn) btn.disabled = false;
    if (status) status.textContent = "";
    setTmplError(e && e.message ? e.message : String(e));
  }
}
async function deleteTemplate(id) {
  if (!window.confirm("Delete this template? This can't be undone.")) return;
  const next = allEmailTemplates().filter((t) => String(t.id) !== id);
  try {
    const merged = await saveSettingsSection("email", { templates: next });
    SETTINGS = merged || SETTINGS;
    toast("Template deleted");
    render();
  } catch (e) {
    toast("Delete failed: " + (e && e.message ? e.message : String(e)));
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiZW1haWxjb21wb3NlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgIGVtYWlsY29tcG9zZS50cyBcdTIwMTQgT3V0Ym91bmQgZW1haWwgY29tcG9zZXIgbW9kYWwgKGZyb20gYSBjbGllbnQgcmVjb3JkKS5cblxuICAgTGF1bmNoZWQgZnJvbSB0aGUgQ29tbXVuaWNhdGlvbnMgc2VjdGlvbiAoYW5kIGEgcGVyLWNvbnRhY3QgXCJFbWFpbFwiIGFjdGlvbikuXG4gICBQaWNrIG9uZSBvciBtb3JlIG9mIHRoZSBjbGllbnQncyBjb250YWN0cywgcGljayBhIHRlbXBsYXRlICh2YXJpYWJsZXNcbiAgIHN1YnN0aXR1dGUgb24gc2VsZWN0aW9uKSwgZWRpdCB0aGUgcmljaC10ZXh0IGJvZHksIGFuZCBzZW5kIHZpYSB0aGUgbG9nZ2VkLWluXG4gICB1c2VyJ3MgY29ubmVjdGVkIG1haWxib3ggKG1hZXN0cm8gYHNlbmRFbWFpbGApLiBBIHN1Y2Nlc3NmdWwgc2VuZCBpcyBsb2dnZWQgYXNcbiAgIGEgQ29tbXVuaWNhdGlvbiAodHlwZSBcIkVtYWlsXCIpIG9uIHRoZSBjbGllbnQgXHUyMDE0IHNvIGl0IGFwcGVhcnMgaW4gdGhlIHRpbWVsaW5lLlxuXG4gICBSZWZlcmVuY2U6IG5ldXJvZGV2LzE0MzQxNTYgY29tcG9zZXIgKEdtYWlsLW9ubHkgbWVyZ2UgcmVwb3J0KSBcdTIwMTQgcmV3b3JrZWQgYXNcbiAgIGFuIFNQQSBtb2RhbCBvbiBvdXIgbWFlc3RybyArIGJvdGggcHJvdmlkZXJzICsgQ29tbXVuaWNhdGlvbnMgbG9nLlxuXG4gICBUZW1wbGF0ZSB2YXJpYWJsZXMgKHN1YnN0aXR1dGVkIG9uIHRlbXBsYXRlIFNFTEVDVElPTiBvbmx5LCBzbyBzd2l0Y2hpbmdcbiAgIGNvbnRhY3RzIGFmdGVyIGVkaXRpbmcgZG9lc24ndCBjbG9iYmVyIGluLXByb2dyZXNzIGVkaXRzIFx1MjAxNCByZXNlbGVjdCB0byByZWRvKTpcbiAgICAge2NsaWVudEZpcnN0TmFtZX0ge2NsaWVudFByZWZlcnJlZE5hbWV9IHtjbGllbnRMYXN0TmFtZX0ge2NsaWVudEZ1bGxOYW1lfVxuICAgICB7Y29udGFjdEZpcnN0TmFtZX0ge2NvbnRhY3RQcmVmZXJyZWROYW1lfSB7Y29udGFjdExhc3ROYW1lfSB7Y29udGFjdEZ1bGxOYW1lfVxuICAgICAgIChPeGZvcmQtY29tbWEgam9pbmVkIGFjcm9zcyBBTEwgc2VsZWN0ZWQgY29udGFjdHMsIGJsYW5rcyBkcm9wcGVkKVxuICAgICB7bXlGaXJzdE5hbWV9IHtteUxhc3ROYW1lfSAgICh0aGUgbG9nZ2VkLWluIHNlbmRlcilcblxuICAgSW5qZWN0ZWQgY29udHJvbHMgdXNlIGRhdGEtayAvIGlkcywgbmV2ZXIgYG5hbWVgIChtZXJnZS1yZXBvcnQgZ290Y2hhKS5cbiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG5pbnRlcmZhY2UgRW1haWxUZW1wbGF0ZSB7IGlkOiBzdHJpbmc7IHRpdGxlOiBzdHJpbmc7IHN1YmplY3Q6IHN0cmluZzsgYm9keTogc3RyaW5nOyB9XG5cbi8vIEFjdGl2ZSB0ZW1wbGF0ZXMgZnJvbSBvcmcgc2V0dGluZ3MgKHNldHRpbmdzLmVtYWlsLnRlbXBsYXRlcykuXG5mdW5jdGlvbiBvcmdFbWFpbFRlbXBsYXRlcygpOiBFbWFpbFRlbXBsYXRlW10ge1xuICBjb25zdCBzOiBhbnkgPSBTRVRUSU5HUztcbiAgY29uc3QgYXJyID0gcyAmJiBzLmVtYWlsICYmIEFycmF5LmlzQXJyYXkocy5lbWFpbC50ZW1wbGF0ZXMpID8gcy5lbWFpbC50ZW1wbGF0ZXMgOiBbXTtcbiAgcmV0dXJuIGFyclxuICAgIC5maWx0ZXIoKHQ6IGFueSkgPT4gdCAmJiB0LmFjdGl2ZSAhPT0gZmFsc2UpXG4gICAgLm1hcCgodDogYW55KSA9PiAoeyBpZDogU3RyaW5nKHQuaWQgfHwgJycpLCB0aXRsZTogU3RyaW5nKHQudGl0bGUgfHwgJycpLCBzdWJqZWN0OiBTdHJpbmcodC5zdWJqZWN0IHx8ICcnKSwgYm9keTogU3RyaW5nKHQuYm9keSB8fCAnJykgfSkpO1xufVxuXG4vLyBHcmFtbWF0aWNhbGx5IGpvaW4gbmFtZXMgd2l0aCBhbiBPeGZvcmQgY29tbWEgKHBvcnRlZCBmcm9tIG5ldXJvZGV2KS5cbmZ1bmN0aW9uIGpvaW5OYW1lcyhwYXJ0czogc3RyaW5nW10pOiBzdHJpbmcge1xuICBjb25zdCBjbGVhbiA9IHBhcnRzLm1hcChwID0+IChwIHx8ICcnKS50cmltKCkpLmZpbHRlcihwID0+IHAubGVuZ3RoID4gMCk7XG4gIGlmIChjbGVhbi5sZW5ndGggPT09IDApIHJldHVybiAnJztcbiAgaWYgKGNsZWFuLmxlbmd0aCA9PT0gMSkgcmV0dXJuIGNsZWFuWzBdO1xuICBpZiAoY2xlYW4ubGVuZ3RoID09PSAyKSByZXR1cm4gY2xlYW5bMF0gKyAnIGFuZCAnICsgY2xlYW5bMV07XG4gIHJldHVybiBjbGVhbi5zbGljZSgwLCAtMSkuam9pbignLCAnKSArICcsIGFuZCAnICsgY2xlYW5bY2xlYW4ubGVuZ3RoIC0gMV07XG59XG5cbmZ1bmN0aW9uIHN1YnN0aXR1dGVWYXJzKHRlbXBsYXRlOiBzdHJpbmcsIHZhcnM6IHsgW2s6IHN0cmluZ106IHN0cmluZyB9KTogc3RyaW5nIHtcbiAgcmV0dXJuIHRlbXBsYXRlLnJlcGxhY2UoL1xceyhcXHcrKVxcfS9nLCAobSwga2V5OiBzdHJpbmcpID0+XG4gICAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHZhcnMsIGtleSkgPyB2YXJzW2tleV0gOiBtKTtcbn1cblxuLy8gQnVpbGQgdGhlIHt2YXJ9IFx1MjE5MiB2YWx1ZSBtYXAgZnJvbSB0aGUgY2xpZW50LCB0aGUgc2VsZWN0ZWQgY29udGFjdHMsIGFuZCB0aGUgc2VuZGVyLlxuLy8gQ29udGFjdHMgaGF2ZSBubyBwcmVmZXJyZWQtbmFtZSBmaWVsZCwgc28gY29udGFjdFByZWZlcnJlZE5hbWUgZmFsbHMgYmFjayB0byBmaXJzdCBuYW1lLlxuZnVuY3Rpb24gY29tcG9zZXJWYXJzKGM6IENsaWVudCwgc2VsZWN0ZWQ6IExpdmVDb250YWN0W10pOiB7IFtrOiBzdHJpbmddOiBzdHJpbmcgfSB7XG4gIGNvbnN0IGZpcnN0cyA9IHNlbGVjdGVkLm1hcCh4ID0+IHguZmlyc3ROYW1lKTtcbiAgY29uc3QgbGFzdHMgPSBzZWxlY3RlZC5tYXAoeCA9PiB4Lmxhc3ROYW1lKTtcbiAgY29uc3QgZnVsbHMgPSBzZWxlY3RlZC5tYXAoeCA9PiAoeC5maXJzdE5hbWUgKyAoeC5sYXN0TmFtZSA/ICcgJyArIHgubGFzdE5hbWUgOiAnJykpLnRyaW0oKSk7XG4gIGNvbnN0IGNsaWVudEZ1bGwgPSAoYy5maXJzdCArIChjLmxhc3QgPyAnICcgKyBjLmxhc3QgOiAnJykpLnRyaW0oKTtcbiAgcmV0dXJuIHtcbiAgICBjbGllbnRGaXJzdE5hbWU6IGMuZmlyc3QgfHwgJycsXG4gICAgY2xpZW50UHJlZmVycmVkTmFtZTogYy5wcmVmTmFtZSB8fCBjLmZpcnN0IHx8ICcnLFxuICAgIGNsaWVudExhc3ROYW1lOiBjLmxhc3QgfHwgJycsXG4gICAgY2xpZW50RnVsbE5hbWU6IGNsaWVudEZ1bGwsXG4gICAgY29udGFjdEZpcnN0TmFtZTogam9pbk5hbWVzKGZpcnN0cyksXG4gICAgY29udGFjdFByZWZlcnJlZE5hbWU6IGpvaW5OYW1lcyhmaXJzdHMpLFxuICAgIGNvbnRhY3RMYXN0TmFtZTogam9pbk5hbWVzKGxhc3RzKSxcbiAgICBjb250YWN0RnVsbE5hbWU6IGpvaW5OYW1lcyhmdWxscyksXG4gICAgbXlGaXJzdE5hbWU6IFNFU1NJT04gPyBTRVNTSU9OLmZpcnN0TmFtZSA6ICcnLFxuICAgIG15TGFzdE5hbWU6IFNFU1NJT04gPyBTRVNTSU9OLmxhc3ROYW1lIDogJycsXG4gIH07XG59XG5cbmZ1bmN0aW9uIHBhcnNlQWRkckxpc3QocmF3OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGlmICghcmF3KSByZXR1cm4gW107XG4gIHJldHVybiByYXcuc3BsaXQoL1ssO10vKS5tYXAocyA9PiBzLnRyaW0oKSkuZmlsdGVyKHMgPT4gcy5sZW5ndGggPiAwKTtcbn1cblxuLy8gT3JkZXJlZCBzZWxlY3Rpb24gb2YgY29udGFjdCBlbnRyeUlkcyBmb3IgdGhlIGN1cnJlbnQgY29tcG9zZXIuXG5sZXQgQ09NUE9TRV9DSUQgPSAnJztcbmxldCBDT01QT1NFX1NFTEVDVEVEX0lEUzogc3RyaW5nW10gPSBbXTtcblxuZnVuY3Rpb24gY29tcG9zZUNvbnRhY3RzKCk6IExpdmVDb250YWN0W10ge1xuICBjb25zdCBsaXN0ID0gKGNvbnRhY3RzU3RhdGUoQ09NUE9TRV9DSUQpLmxpc3QgfHwgW10pLmZpbHRlcihjdCA9PiAhIWN0LmVtYWlsKTtcbiAgcmV0dXJuIGxpc3Q7XG59XG5mdW5jdGlvbiBjb21wb3NlU2VsZWN0ZWQoKTogTGl2ZUNvbnRhY3RbXSB7XG4gIGNvbnN0IGJ5SWQgPSBjb21wb3NlQ29udGFjdHMoKTtcbiAgY29uc3Qgb3V0OiBMaXZlQ29udGFjdFtdID0gW107XG4gIGZvciAoY29uc3QgaWQgb2YgQ09NUE9TRV9TRUxFQ1RFRF9JRFMpIHtcbiAgICBjb25zdCBjdCA9IGJ5SWQuZmlsdGVyKHggPT4geC5lbnRyeUlkID09PSBpZClbMF07XG4gICAgaWYgKGN0KSBvdXQucHVzaChjdCk7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cblxuLy8gVHJ1ZSB3aGVuIHRoZSBsb2dnZWQtaW4gdXNlciBoYXMgYSBjb25uZWN0ZWQgbWFpbGJveCB0byBzZW5kIGZyb20uXG5mdW5jdGlvbiBjb21wb3NlckNvbm5lY3RlZCgpOiBib29sZWFuIHtcbiAgcmV0dXJuIChFTUFJTF9TVEFURS5saXN0IHx8IFtdKS5zb21lKGEgPT4gYS5jb25uZWN0ZWQpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBvcGVuRW1haWxDb21wb3NlcihjaWQ6IHN0cmluZywgcHJlc2VsZWN0SWRzPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGMgPSBmaW5kQ2xpZW50KGNpZCk7XG4gIGlmICghYykgeyB0b2FzdCgnQ2xpZW50IG5vdCBmb3VuZC4nKTsgcmV0dXJuOyB9XG4gIC8vIFdhcm0gdGhlIGRhdGEgdGhlIGNvbXBvc2VyIG5lZWRzIChmYXN0IGlmIGFscmVhZHkgY2FjaGVkKS5cbiAgYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIGNvbnRhY3RzU3RhdGUoY2lkKS5saXN0ID09PSBudWxsID8gbG9hZENvbnRhY3RzKGNpZCkgOiBQcm9taXNlLnJlc29sdmUoKSxcbiAgICBTRVRUSU5HUyA9PT0gbnVsbCA/IGxvYWRTZXR0aW5ncygpIDogUHJvbWlzZS5yZXNvbHZlKCksXG4gICAgRU1BSUxfU1RBVEUubGlzdCA9PT0gbnVsbCA/IGxvYWRFbWFpbFN0YXR1cygpIDogUHJvbWlzZS5yZXNvbHZlKCksXG4gIF0pO1xuICBDT01QT1NFX0NJRCA9IGNpZDtcbiAgY29uc3QgcHJlID0gKHByZXNlbGVjdElkcyB8fCAnJykuc3BsaXQoJywnKS5tYXAocyA9PiBzLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pO1xuICBjb25zdCB2YWxpZCA9IGNvbXBvc2VDb250YWN0cygpLm1hcChjdCA9PiBjdC5lbnRyeUlkKTtcbiAgQ09NUE9TRV9TRUxFQ1RFRF9JRFMgPSBwcmUuZmlsdGVyKGlkID0+IHZhbGlkLmluZGV4T2YoaWQpICE9PSAtMSk7XG4gIGJ1aWxkQ29tcG9zZXJNb2RhbChjKTtcbn1cblxuZnVuY3Rpb24gYnVpbGRDb21wb3Nlck1vZGFsKGM6IENsaWVudCk6IHZvaWQge1xuICBpZiAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fZW1haWxNb2RhbCcpKSBjbG9zZUVtYWlsQ29tcG9zZXIoKTtcbiAgY29uc3QgY29ubmVjdGVkID0gY29tcG9zZXJDb25uZWN0ZWQoKTtcbiAgY29uc3QgY29udGFjdHNMaXN0ID0gY29tcG9zZUNvbnRhY3RzKCk7XG4gIGNvbnN0IHRlbXBsYXRlcyA9IG9yZ0VtYWlsVGVtcGxhdGVzKCkuc2xpY2UoKS5zb3J0KChhLCBiKSA9PiBhLnRpdGxlLnRvTG93ZXJDYXNlKCkubG9jYWxlQ29tcGFyZShiLnRpdGxlLnRvTG93ZXJDYXNlKCkpKTtcblxuICBjb25zdCBiYW5uZXIgPSBjb25uZWN0ZWQgPyAnJyA6XG4gICAgYDxkaXYgY2xhc3M9XCJtb2RhbC1lcnJcIiBzdHlsZT1cImRpc3BsYXk6YmxvY2tcIj5Zb3VyIG1haWxib3ggaXNuJ3QgY29ubmVjdGVkLiBPcGVuIDxiPk15IEVtYWlsPC9iPiAodG9wLXJpZ2h0IGFjY291bnQgbWVudSkgYW5kIGNvbm5lY3QgaXQgYmVmb3JlIHNlbmRpbmcuPC9kaXY+YDtcblxuICBjb25zdCBjaGlwcyA9IGNvbnRhY3RzTGlzdC5sZW5ndGhcbiAgICA/IGNvbnRhY3RzTGlzdC5tYXAoY3QgPT4ge1xuICAgICAgICBjb25zdCBvbiA9IENPTVBPU0VfU0VMRUNURURfSURTLmluZGV4T2YoY3QuZW50cnlJZCkgIT09IC0xO1xuICAgICAgICBjb25zdCBubSA9IChjdC5maXJzdE5hbWUgKyAnICcgKyBjdC5sYXN0TmFtZSkudHJpbSgpIHx8IGN0LmVtYWlsO1xuICAgICAgICByZXR1cm4gYDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiY29tcG9zZS1jaGlwJHtvbiA/ICcgb24nIDogJyd9XCIgZGF0YS1jZWlkPVwiJHtlc2MoY3QuZW50cnlJZCl9XCIgb25jbGljaz1cInRvZ2dsZUNvbXBvc2VDb250YWN0KCcke2VzYyhjdC5lbnRyeUlkKX0nLCB0aGlzKVwiPlxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwiY2Mtbm1cIj4ke2VzYyhubSl9PC9zcGFuPjxzcGFuIGNsYXNzPVwiY2MtZW1cIj4ke2VzYyhjdC5lbWFpbCl9PC9zcGFuPjwvYnV0dG9uPmA7XG4gICAgICB9KS5qb2luKCcnKVxuICAgIDogYDxkaXYgY2xhc3M9XCJjb21wb3NlLWVtcHR5XCI+Tm8gY29udGFjdHMgd2l0aCBhbiBlbWFpbCBvbiBmaWxlIFx1MjAxNCB0eXBlIHJlY2lwaWVudHMgaW4gdGhlIFRvIGZpZWxkLjwvZGl2PmA7XG5cbiAgY29uc3QgdG1wbE9wdHMgPSBbJzxvcHRpb24gdmFsdWU9XCJcIj5cdTIwMTQgaW5zZXJ0IGEgdGVtcGxhdGUgXHUyMDE0PC9vcHRpb24+J11cbiAgICAuY29uY2F0KHRlbXBsYXRlcy5tYXAodCA9PiBgPG9wdGlvbiB2YWx1ZT1cIiR7ZXNjKHQuaWQpfVwiPiR7ZXNjKHQudGl0bGUgfHwgJyh1bnRpdGxlZCknKX08L29wdGlvbj5gKSlcbiAgICAuam9pbignJyk7XG5cbiAgY29uc3QgaG9zdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBob3N0LmNsYXNzTmFtZSA9ICdtb2RhbC1vdmVybGF5JztcbiAgaG9zdC5pZCA9ICdfX2VtYWlsTW9kYWwnO1xuICBob3N0LmlubmVySFRNTCA9IGA8ZGl2IGNsYXNzPVwibW9kYWwtY2FyZCBjb21wb3NlLWNhcmRcIiByb2xlPVwiZGlhbG9nXCIgYXJpYS1tb2RhbD1cInRydWVcIiBhcmlhLWxhYmVsPVwiQ29tcG9zZSBlbWFpbFwiIGRhdGEtY2lkPVwiJHtlc2MoYy5pZCl9XCI+XG4gICAgPGRpdiBjbGFzcz1cIm1vZGFsLWhlYWRcIj5cbiAgICAgIDxkaXY+PGI+Q29tcG9zZSBlbWFpbDwvYj48cD5TZW5kIHRvICR7ZXNjKGMuZmlyc3QpfSdzIGNvbnRhY3RzIGZyb20geW91ciBjb25uZWN0ZWQgbWFpbGJveC48L3A+PC9kaXY+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiaWNvLXhcIiB0aXRsZT1cIkNsb3NlXCIgb25jbGljaz1cImNsb3NlRW1haWxDb21wb3NlcigpXCI+JHtpYygneCcsIDE4KX08L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwibW9kYWwtYm9keVwiPlxuICAgICAgJHtiYW5uZXJ9XG4gICAgICA8ZGl2IGNsYXNzPVwibW9kYWwtZXJyXCIgaGlkZGVuPjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImNvbXBvc2UtcGlja2Vyc1wiPiR7Y2hpcHN9PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiZmllbGQgZnVsbFwiPjxsYWJlbD5UbzwvbGFiZWw+PGlucHV0IHR5cGU9XCJ0ZXh0XCIgaWQ9XCJfX2NUb1wiIHBsYWNlaG9sZGVyPVwiZW1haWxAZXhhbXBsZS5jb20gKGNvbW1hLXNlcGFyYXRlZClcIiBhdXRvY29tcGxldGU9XCJvZmZcIj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZC1ncmlkXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZFwiPjxsYWJlbD5DQzwvbGFiZWw+PGlucHV0IHR5cGU9XCJ0ZXh0XCIgaWQ9XCJfX2NDY1wiIHBsYWNlaG9sZGVyPVwiKG9wdGlvbmFsKVwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiPjwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmllbGRcIj48bGFiZWw+QkNDPC9sYWJlbD48aW5wdXQgdHlwZT1cInRleHRcIiBpZD1cIl9fY0JjY1wiIHBsYWNlaG9sZGVyPVwiKG9wdGlvbmFsKVwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiPjwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiZmllbGQgZnVsbFwiPjxsYWJlbD5TdWJqZWN0PC9sYWJlbD48aW5wdXQgdHlwZT1cInRleHRcIiBpZD1cIl9fY1N1YmplY3RcIiBwbGFjZWhvbGRlcj1cIlN1YmplY3RcIiBhdXRvY29tcGxldGU9XCJvZmZcIj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJjb21wb3NlLXRvb2xiYXJcIiByb2xlPVwidG9vbGJhclwiIGFyaWEtbGFiZWw9XCJGb3JtYXR0aW5nXCI+XG4gICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIHRpdGxlPVwiQm9sZFwiIG9uY2xpY2s9XCJjb21wb3NlRXhlYygnYm9sZCcpXCI+PGI+QjwvYj48L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgdGl0bGU9XCJJdGFsaWNcIiBvbmNsaWNrPVwiY29tcG9zZUV4ZWMoJ2l0YWxpYycpXCI+PGk+STwvaT48L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgdGl0bGU9XCJVbmRlcmxpbmVcIiBvbmNsaWNrPVwiY29tcG9zZUV4ZWMoJ3VuZGVybGluZScpXCI+PHU+VTwvdT48L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgdGl0bGU9XCJIZWFkaW5nXCIgb25jbGljaz1cImNvbXBvc2VFeGVjKCdmb3JtYXRCbG9jaycsJ0gyJylcIj5IPC9idXR0b24+XG4gICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIHRpdGxlPVwiQnVsbGV0ZWQgbGlzdFwiIG9uY2xpY2s9XCJjb21wb3NlRXhlYygnaW5zZXJ0VW5vcmRlcmVkTGlzdCcpXCI+JmJ1bGw7IExpc3Q8L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgdGl0bGU9XCJOdW1iZXJlZCBsaXN0XCIgb25jbGljaz1cImNvbXBvc2VFeGVjKCdpbnNlcnRPcmRlcmVkTGlzdCcpXCI+MS4gTGlzdDwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiB0aXRsZT1cIkluc2VydCBsaW5rXCIgb25jbGljaz1cImNvbXBvc2VFeGVjKCdjcmVhdGVMaW5rJylcIj5MaW5rPC9idXR0b24+XG4gICAgICAgIDxzcGFuIHN0eWxlPVwiZmxleDoxXCI+PC9zcGFuPlxuICAgICAgICA8bGFiZWwgY2xhc3M9XCJjb21wb3NlLXRtcGxcIj5UZW1wbGF0ZSA8c2VsZWN0IGlkPVwiX19jVGVtcGxhdGVcIiBvbmNoYW5nZT1cIm9uQ29tcG9zZVRlbXBsYXRlKHRoaXMpXCI+JHt0bXBsT3B0c308L3NlbGVjdD48L2xhYmVsPlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGlkPVwiX19jQm9keVwiIGNsYXNzPVwiY29tcG9zZS1ib2R5XCIgY29udGVudGVkaXRhYmxlPVwidHJ1ZVwiIGFyaWEtbGFiZWw9XCJFbWFpbCBib2R5XCI+PC9kaXY+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cIm1vZGFsLWZvb3RcIj5cbiAgICAgIDxzcGFuIGNsYXNzPVwibW9kYWwtc3RhdHVzXCI+PC9zcGFuPlxuICAgICAgPHNwYW4gc3R5bGU9XCJmbGV4OjFcIj48L3NwYW4+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgb25jbGljaz1cImNsb3NlRW1haWxDb21wb3NlcigpXCI+JHtpYygneCcsIDE1KX0gQ2FuY2VsPC9idXR0b24+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnkganMtc2VuZFwiIG9uY2xpY2s9XCJzZW5kQ29tcG9zZWRFbWFpbCgpXCIke2Nvbm5lY3RlZCA/ICcnIDogJyBkaXNhYmxlZCB0aXRsZT1cIkNvbm5lY3QgeW91ciBtYWlsYm94IGZpcnN0XCInfT4ke2ljKCdzZW5kJywgMTUpfSBTZW5kPC9idXR0b24+XG4gICAgPC9kaXY+XG4gIDwvZGl2PmA7XG4gIGhvc3QuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgZSA9PiB7IGlmIChlLnRhcmdldCA9PT0gaG9zdCkgY2xvc2VFbWFpbENvbXBvc2VyKCk7IH0pO1xuICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGhvc3QpO1xuICBjb21wb3NlU3luY1RvKCk7XG4gIGNvbnN0IHN1YmogPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19jU3ViamVjdCcpIGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsO1xuICBpZiAoc3Viaikgc3Viai5mb2N1cygpO1xuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgY29tcG9zZUVzY0Nsb3NlKTtcbn1cblxuZnVuY3Rpb24gY29tcG9zZUVzY0Nsb3NlKGU6IEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcbiAgaWYgKGUua2V5ICE9PSAnRXNjYXBlJykgcmV0dXJuO1xuICAvLyBEb24ndCBjbG9zZSBpZiBhIGxpbmsgcHJvbXB0IGlzIG9wZW4gKHByb21wdCBibG9ja3MgYW55d2F5KTsganVzdCBjbG9zZSB0aGUgbW9kYWwuXG4gIGNsb3NlRW1haWxDb21wb3NlcigpO1xufVxuZnVuY3Rpb24gY2xvc2VFbWFpbENvbXBvc2VyKCk6IHZvaWQge1xuICBjb25zdCBtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fZW1haWxNb2RhbCcpO1xuICBpZiAobSkgbS5yZW1vdmUoKTtcbiAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGNvbXBvc2VFc2NDbG9zZSk7XG59XG5cbi8vIEtlZXAgdGhlIFRvIGZpZWxkIGluIHN5bmMgd2l0aCB0aGUgb3JkZXJlZCBjaGlwIHNlbGVjdGlvbi5cbmZ1bmN0aW9uIGNvbXBvc2VTeW5jVG8oKTogdm9pZCB7XG4gIGNvbnN0IHRvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fY1RvJykgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XG4gIGlmICghdG8pIHJldHVybjtcbiAgdG8udmFsdWUgPSBjb21wb3NlU2VsZWN0ZWQoKS5tYXAoY3QgPT4gY3QuZW1haWwpLmpvaW4oJywgJyk7XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZUNvbXBvc2VDb250YWN0KGVudHJ5SWQ6IHN0cmluZywgYnRuOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICBjb25zdCBpZHggPSBDT01QT1NFX1NFTEVDVEVEX0lEUy5pbmRleE9mKGVudHJ5SWQpO1xuICBpZiAoaWR4ID09PSAtMSkgeyBDT01QT1NFX1NFTEVDVEVEX0lEUy5wdXNoKGVudHJ5SWQpOyBidG4uY2xhc3NMaXN0LmFkZCgnb24nKTsgfVxuICBlbHNlIHsgQ09NUE9TRV9TRUxFQ1RFRF9JRFMuc3BsaWNlKGlkeCwgMSk7IGJ0bi5jbGFzc0xpc3QucmVtb3ZlKCdvbicpOyB9XG4gIGNvbXBvc2VTeW5jVG8oKTtcbn1cblxuZnVuY3Rpb24gb25Db21wb3NlVGVtcGxhdGUoc2VsOiBIVE1MU2VsZWN0RWxlbWVudCk6IHZvaWQge1xuICBjb25zdCBpZCA9IHNlbC52YWx1ZTtcbiAgaWYgKCFpZCkgcmV0dXJuO1xuICBjb25zdCB0bXBsID0gb3JnRW1haWxUZW1wbGF0ZXMoKS5maWx0ZXIodCA9PiB0LmlkID09PSBpZClbMF07XG4gIGlmICghdG1wbCkgcmV0dXJuO1xuICBjb25zdCBjID0gZmluZENsaWVudChDT01QT1NFX0NJRCk7XG4gIGlmICghYykgcmV0dXJuO1xuICBjb25zdCB2YXJzID0gY29tcG9zZXJWYXJzKGMsIGNvbXBvc2VTZWxlY3RlZCgpKTtcbiAgY29uc3Qgc3ViaiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX2NTdWJqZWN0JykgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XG4gIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19jQm9keScpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgaWYgKHN1YmopIHN1YmoudmFsdWUgPSBzdWJzdGl0dXRlVmFycyh0bXBsLnN1YmplY3QsIHZhcnMpO1xuICBpZiAoYm9keSkgYm9keS5pbm5lckhUTUwgPSBzdWJzdGl0dXRlVmFycyh0bXBsLmJvZHksIHZhcnMpO1xufVxuXG5mdW5jdGlvbiBjb21wb3NlRXhlYyhjbWQ6IHN0cmluZywgYXJnPzogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19jQm9keScpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgaWYgKGJvZHkpIGJvZHkuZm9jdXMoKTtcbiAgaWYgKGNtZCA9PT0gJ2NyZWF0ZUxpbmsnKSB7XG4gICAgY29uc3QgdXJsID0gd2luZG93LnByb21wdCgnRW50ZXIgVVJMIChodHRwczovL1x1MjAyNik6JywgJ2h0dHBzOi8vJyk7XG4gICAgaWYgKCF1cmwpIHJldHVybjtcbiAgICBkb2N1bWVudC5leGVjQ29tbWFuZCgnY3JlYXRlTGluaycsIGZhbHNlLCB1cmwpO1xuICB9IGVsc2UgaWYgKGNtZCA9PT0gJ2Zvcm1hdEJsb2NrJyAmJiBhcmcpIHtcbiAgICBkb2N1bWVudC5leGVjQ29tbWFuZCgnZm9ybWF0QmxvY2snLCBmYWxzZSwgYXJnKTtcbiAgfSBlbHNlIHtcbiAgICBkb2N1bWVudC5leGVjQ29tbWFuZChjbWQsIGZhbHNlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzZXRDb21wb3NlRXJyb3IobXNnOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgZXJycyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJyNfX2VtYWlsTW9kYWwgLm1vZGFsLWVycicpO1xuICAvLyBUaGUgbGFzdCAubW9kYWwtZXJyIGlzIHRoZSBsaXZlIGVycm9yIHNsb3QgKGZpcnN0IG1heSBiZSB0aGUgc3RhdGljIGJhbm5lcikuXG4gIGNvbnN0IGVsID0gZXJyc1tlcnJzLmxlbmd0aCAtIDFdIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgaWYgKCFlbCkgcmV0dXJuO1xuICBpZiAobXNnKSB7IGVsLnRleHRDb250ZW50ID0gbXNnOyBlbC5oaWRkZW4gPSBmYWxzZTsgfSBlbHNlIHsgZWwudGV4dENvbnRlbnQgPSAnJzsgZWwuaGlkZGVuID0gdHJ1ZTsgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBzZW5kQ29tcG9zZWRFbWFpbCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgbW9kYWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjX19lbWFpbE1vZGFsIC5jb21wb3NlLWNhcmQnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmICghbW9kYWwpIHJldHVybjtcbiAgY29uc3QgY2lkID0gbW9kYWwuZ2V0QXR0cmlidXRlKCdkYXRhLWNpZCcpIHx8ICcnO1xuICBjb25zdCB0byA9IHBhcnNlQWRkckxpc3QoKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX2NUbycpIGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlKTtcbiAgY29uc3QgY2MgPSBwYXJzZUFkZHJMaXN0KChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19jQ2MnKSBhcyBIVE1MSW5wdXRFbGVtZW50KS52YWx1ZSk7XG4gIGNvbnN0IGJjYyA9IHBhcnNlQWRkckxpc3QoKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX2NCY2MnKSBhcyBIVE1MSW5wdXRFbGVtZW50KS52YWx1ZSk7XG4gIGNvbnN0IHN1YmplY3QgPSAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fY1N1YmplY3QnKSBhcyBIVE1MSW5wdXRFbGVtZW50KS52YWx1ZS50cmltKCk7XG4gIGNvbnN0IGJvZHlIdG1sID0gKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX2NCb2R5JykgYXMgSFRNTEVsZW1lbnQpLmlubmVySFRNTC50cmltKCk7XG5cbiAgc2V0Q29tcG9zZUVycm9yKCcnKTtcbiAgaWYgKCF0by5sZW5ndGgpIHsgc2V0Q29tcG9zZUVycm9yKCdBZGQgYXQgbGVhc3Qgb25lIHJlY2lwaWVudCBpbiB0aGUgVG8gZmllbGQuJyk7IHJldHVybjsgfVxuICBpZiAoIXN1YmplY3QpIHsgc2V0Q29tcG9zZUVycm9yKCdBIHN1YmplY3QgaXMgcmVxdWlyZWQuJyk7IHJldHVybjsgfVxuICBpZiAoIWJvZHlIdG1sIHx8IGJvZHlIdG1sID09PSAnPGJyPicpIHsgc2V0Q29tcG9zZUVycm9yKCdUaGUgZW1haWwgYm9keSBpcyBlbXB0eS4nKTsgcmV0dXJuOyB9XG5cbiAgY29uc3Qgc2VuZEJ0biA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJy5qcy1zZW5kJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuICBjb25zdCBzdGF0dXMgPSBtb2RhbC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtc3RhdHVzJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoc2VuZEJ0bikgc2VuZEJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICdTZW5kaW5nXHUyMDI2JztcblxuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGFwaVNlbmRFbWFpbCh7XG4gICAgICBjbGllbnRJZDogY2lkLCBwcm92aWRlcjogb3JnRW1haWxQcm92aWRlcigpLFxuICAgICAgdG86IHRvLCBjYzogY2MsIGJjYzogYmNjLCBzdWJqZWN0OiBzdWJqZWN0LCBib2R5SHRtbDogYm9keUh0bWwsXG4gICAgfSk7XG4gICAgY2xvc2VFbWFpbENvbXBvc2VyKCk7XG4gICAgaWYgKHJlcyAmJiByZXMuY29tbUVycm9yKSB0b2FzdCgnU2VudCBcdTI3MTMgXHUyMDE0IGJ1dCBsb2dnaW5nIHRvIHRoZSByZWNvcmQgZmFpbGVkOiAnICsgcmVzLmNvbW1FcnJvcik7XG4gICAgZWxzZSB0b2FzdCgnRW1haWwgc2VudCBcdTI3MTMnKTtcbiAgICAvLyBSZWZyZXNoIHRoZSBDb21tdW5pY2F0aW9ucyB0aW1lbGluZSBzbyB0aGUgbG9nZ2VkIGVtYWlsIHNob3dzIHVwLlxuICAgIGlmICh0eXBlb2YgbG9hZENvbW11bmljYXRpb25zID09PSAnZnVuY3Rpb24nKSBsb2FkQ29tbXVuaWNhdGlvbnMoY2lkLCB0cnVlKTtcbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgaWYgKHNlbmRCdG4pIHNlbmRCdG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICBpZiAoc3RhdHVzKSBzdGF0dXMudGV4dENvbnRlbnQgPSAnJztcbiAgICBzZXRDb21wb3NlRXJyb3IoJ1NlbmQgZmFpbGVkOiAnICsgKGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpKSk7XG4gIH1cbn1cblxuLyogXHUyNTAwXHUyNTAwIFNldHRpbmdzIFx1MjVCOCBFbWFpbCBUZW1wbGF0ZXMgKG9yZy13aWRlLCBpbiBzZXR0aW5ncy5lbWFpbC50ZW1wbGF0ZXMpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMCAqL1xuXG4vLyBBbGwgdGVtcGxhdGVzIChpbmNsLiBpbmFjdGl2ZSkgZnJvbSBzZXR0aW5ncywgZm9yIHRoZSBhZG1pbiBlZGl0b3IuXG5mdW5jdGlvbiBhbGxFbWFpbFRlbXBsYXRlcygpOiBhbnlbXSB7XG4gIGNvbnN0IHM6IGFueSA9IFNFVFRJTkdTO1xuICByZXR1cm4gcyAmJiBzLmVtYWlsICYmIEFycmF5LmlzQXJyYXkocy5lbWFpbC50ZW1wbGF0ZXMpID8gcy5lbWFpbC50ZW1wbGF0ZXMuc2xpY2UoKSA6IFtdO1xufVxuXG5jb25zdCBURU1QTEFURV9WQVJTID0gW1xuICAnY2xpZW50Rmlyc3ROYW1lJywgJ2NsaWVudFByZWZlcnJlZE5hbWUnLCAnY2xpZW50TGFzdE5hbWUnLCAnY2xpZW50RnVsbE5hbWUnLFxuICAnY29udGFjdEZpcnN0TmFtZScsICdjb250YWN0UHJlZmVycmVkTmFtZScsICdjb250YWN0TGFzdE5hbWUnLCAnY29udGFjdEZ1bGxOYW1lJyxcbiAgJ215Rmlyc3ROYW1lJywgJ215TGFzdE5hbWUnLFxuXTtcblxuLy8gUmVuZGVyZWQgYnkgdGhlIFNldHRpbmdzIHBhbmVsIHJlZ2lzdHJ5IChzZXR0aW5ncy50cykuXG5mdW5jdGlvbiBlbWFpbFRlbXBsYXRlc1BhbmVsKCk6IHN0cmluZyB7XG4gIGlmIChTRVRUSU5HUyA9PT0gbnVsbCAmJiAhU0VUVElOR1NfTE9BRElORykgbG9hZFNldHRpbmdzKCk7XG4gIGNvbnN0IGhlYWQgPSBgPGRpdiBjbGFzcz1cInNlY3Rpb24taGVhZFwiPlxuICAgICAgPGRpdj48aDM+RW1haWwgVGVtcGxhdGVzPC9oMz48cD5SZXVzYWJsZSB0ZW1wbGF0ZXMgZm9yIHRoZSBlbWFpbCBjb21wb3Nlci4gVXNlIHZhcmlhYmxlcyBsaWtlIDxjb2RlPntjbGllbnRGaXJzdE5hbWV9PC9jb2RlPiBcdTIwMTQgdGhleSBmaWxsIGluIHdoZW4gYSB0ZW1wbGF0ZSBpcyBzZWxlY3RlZC48L3A+PC9kaXY+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnlcIiBvbmNsaWNrPVwib3BlblRlbXBsYXRlRWRpdG9yKClcIj4ke2ljKCdwbHVzJywgMTUpfSBOZXcgdGVtcGxhdGU8L2J1dHRvbj5cbiAgICA8L2Rpdj5gO1xuICBpZiAoU0VUVElOR1MgPT09IG51bGwpIHJldHVybiBoZWFkICsgYDxkaXYgY2xhc3M9XCJjYXJkXCI+PGRpdiBjbGFzcz1cImVtcHR5XCI+PGRpdiBjbGFzcz1cImljb1wiPiR7aWMoJ2Nsb2NrJywgMjIpfTwvZGl2PjxiPkxvYWRpbmdcdTIwMjY8L2I+PC9kaXY+PC9kaXY+YDtcbiAgY29uc3QgbGlzdCA9IGFsbEVtYWlsVGVtcGxhdGVzKCk7XG4gIGlmICghbGlzdC5sZW5ndGgpIHtcbiAgICByZXR1cm4gaGVhZCArIGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdtc2cnLCAyMil9PC9kaXY+PGI+Tm8gdGVtcGxhdGVzIHlldDwvYj5cbiAgICAgIDxwPkNyZWF0ZSBhIHJldXNhYmxlIGVtYWlsIHlvdXIgdGVhbSBjYW4gcGljayBmcm9tIHRoZSBjb21wb3Nlci48L3A+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnlcIiBvbmNsaWNrPVwib3BlblRlbXBsYXRlRWRpdG9yKClcIj4ke2ljKCdwbHVzJywgMTUpfSBOZXcgdGVtcGxhdGU8L2J1dHRvbj48L2Rpdj48L2Rpdj5gO1xuICB9XG4gIGNvbnN0IHJvd3MgPSBsaXN0Lm1hcCh0ID0+IHtcbiAgICBjb25zdCBhY3RpdmUgPSB0LmFjdGl2ZSAhPT0gZmFsc2U7XG4gICAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiY2FyZCB0bXBsLXJvd1wiPlxuICAgICAgPGRpdiBjbGFzcz1cInRtcGwtaW5mb1wiPjxiPiR7ZXNjKHQudGl0bGUgfHwgJyh1bnRpdGxlZCknKX08L2I+PHNwYW4+JHtlc2ModC5zdWJqZWN0IHx8ICcnKX08L3NwYW4+PC9kaXY+XG4gICAgICA8c3BhbiBjbGFzcz1cInBpbGwgJHthY3RpdmUgPyAnc3VjY2VzcycgOiAnbXV0ZWQnfVwiPiR7YWN0aXZlID8gJ0FjdGl2ZScgOiAnSW5hY3RpdmUnfTwvc3Bhbj5cbiAgICAgIDxkaXYgY2xhc3M9XCJjYy1hY3RzXCI+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJpY28tbWluaVwiIHRpdGxlPVwiRWRpdFwiIG9uY2xpY2s9XCJvcGVuVGVtcGxhdGVFZGl0b3IoJyR7ZXNjKFN0cmluZyh0LmlkKSl9JylcIj4ke2ljKCdlZGl0JywgMTUpfTwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwiaWNvLW1pbmkgZGFuZ2VyXCIgdGl0bGU9XCJEZWxldGVcIiBvbmNsaWNrPVwiZGVsZXRlVGVtcGxhdGUoJyR7ZXNjKFN0cmluZyh0LmlkKSl9JylcIj4ke2ljKCd0cmFzaCcsIDE1KX08L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PmA7XG4gIH0pLmpvaW4oJycpO1xuICByZXR1cm4gaGVhZCArIGA8ZGl2IGNsYXNzPVwidG1wbC1saXN0XCI+JHtyb3dzfTwvZGl2PmA7XG59XG5cbmZ1bmN0aW9uIHRtcGxFeGVjKGNtZDogc3RyaW5nLCBhcmc/OiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgYm9keSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX3RCb2R5JykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoYm9keSkgYm9keS5mb2N1cygpO1xuICBpZiAoY21kID09PSAnY3JlYXRlTGluaycpIHtcbiAgICBjb25zdCB1cmwgPSB3aW5kb3cucHJvbXB0KCdFbnRlciBVUkwgKGh0dHBzOi8vXHUyMDI2KTonLCAnaHR0cHM6Ly8nKTtcbiAgICBpZiAoIXVybCkgcmV0dXJuO1xuICAgIGRvY3VtZW50LmV4ZWNDb21tYW5kKCdjcmVhdGVMaW5rJywgZmFsc2UsIHVybCk7XG4gIH0gZWxzZSBpZiAoY21kID09PSAnZm9ybWF0QmxvY2snICYmIGFyZykge1xuICAgIGRvY3VtZW50LmV4ZWNDb21tYW5kKCdmb3JtYXRCbG9jaycsIGZhbHNlLCBhcmcpO1xuICB9IGVsc2Uge1xuICAgIGRvY3VtZW50LmV4ZWNDb21tYW5kKGNtZCwgZmFsc2UpO1xuICB9XG59XG5cbi8vIEluc2VydCBhIHt2YXJpYWJsZX0gdG9rZW4gaW50byB0aGUgYm9keSBlZGl0b3IgYXQgdGhlIGNhcmV0LlxuZnVuY3Rpb24gaW5zZXJ0VG1wbFZhcih0b2tlbjogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX190Qm9keScpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgaWYgKCFib2R5KSByZXR1cm47XG4gIGJvZHkuZm9jdXMoKTtcbiAgZG9jdW1lbnQuZXhlY0NvbW1hbmQoJ2luc2VydFRleHQnLCBmYWxzZSwgdG9rZW4pO1xufVxuXG5mdW5jdGlvbiBvcGVuVGVtcGxhdGVFZGl0b3IoaWQ/OiBzdHJpbmcpOiB2b2lkIHtcbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX3RtcGxNb2RhbCcpKSBjbG9zZVRlbXBsYXRlRWRpdG9yKCk7XG4gIGNvbnN0IHQgPSBpZCA/IGFsbEVtYWlsVGVtcGxhdGVzKCkuZmlsdGVyKHggPT4gU3RyaW5nKHguaWQpID09PSBpZClbMF0gOiBudWxsO1xuICBjb25zdCBlZGl0aW5nID0gISF0O1xuICBjb25zdCBob3N0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGhvc3QuY2xhc3NOYW1lID0gJ21vZGFsLW92ZXJsYXknO1xuICBob3N0LmlkID0gJ19fdG1wbE1vZGFsJztcbiAgaG9zdC5pbm5lckhUTUwgPSBgPGRpdiBjbGFzcz1cIm1vZGFsLWNhcmQgY29tcG9zZS1jYXJkXCIgcm9sZT1cImRpYWxvZ1wiIGFyaWEtbW9kYWw9XCJ0cnVlXCIgYXJpYS1sYWJlbD1cIiR7ZWRpdGluZyA/ICdFZGl0IHRlbXBsYXRlJyA6ICdOZXcgdGVtcGxhdGUnfVwiIGRhdGEtaWQ9XCIke2VzYyhpZCB8fCAnJyl9XCI+XG4gICAgPGRpdiBjbGFzcz1cIm1vZGFsLWhlYWRcIj5cbiAgICAgIDxkaXY+PGI+JHtlZGl0aW5nID8gJ0VkaXQgdGVtcGxhdGUnIDogJ05ldyB0ZW1wbGF0ZSd9PC9iPjxwPlZhcmlhYmxlcyBpbiB7Y3VybHkgYnJhY2VzfSBmaWxsIGluIHdoZW4gdGhlIHRlbXBsYXRlIGlzIGNob3Nlbi48L3A+PC9kaXY+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiaWNvLXhcIiB0aXRsZT1cIkNsb3NlXCIgb25jbGljaz1cImNsb3NlVGVtcGxhdGVFZGl0b3IoKVwiPiR7aWMoJ3gnLCAxOCl9PC9idXR0b24+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cIm1vZGFsLWJvZHlcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1lcnJcIiBoaWRkZW4+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiZmllbGQgZnVsbFwiPjxsYWJlbD5UZW1wbGF0ZSBuYW1lPC9sYWJlbD48aW5wdXQgdHlwZT1cInRleHRcIiBpZD1cIl9fdFRpdGxlXCIgdmFsdWU9XCIke2VzYyh0ID8gdC50aXRsZSB8fCAnJyA6ICcnKX1cIiBwbGFjZWhvbGRlcj1cImUuZy4gSW50YWtlIGZvbGxvdy11cFwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiPjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImZpZWxkIGZ1bGxcIj48bGFiZWw+U3ViamVjdDwvbGFiZWw+PGlucHV0IHR5cGU9XCJ0ZXh0XCIgaWQ9XCJfX3RTdWJqZWN0XCIgdmFsdWU9XCIke2VzYyh0ID8gdC5zdWJqZWN0IHx8ICcnIDogJycpfVwiIHBsYWNlaG9sZGVyPVwiU3ViamVjdCAobWF5IHVzZSB7Y2xpZW50Rmlyc3ROYW1lfSlcIiBhdXRvY29tcGxldGU9XCJvZmZcIj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJjb21wb3NlLXRvb2xiYXJcIiByb2xlPVwidG9vbGJhclwiIGFyaWEtbGFiZWw9XCJGb3JtYXR0aW5nXCI+XG4gICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIHRpdGxlPVwiQm9sZFwiIG9uY2xpY2s9XCJ0bXBsRXhlYygnYm9sZCcpXCI+PGI+QjwvYj48L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgdGl0bGU9XCJJdGFsaWNcIiBvbmNsaWNrPVwidG1wbEV4ZWMoJ2l0YWxpYycpXCI+PGk+STwvaT48L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgdGl0bGU9XCJVbmRlcmxpbmVcIiBvbmNsaWNrPVwidG1wbEV4ZWMoJ3VuZGVybGluZScpXCI+PHU+VTwvdT48L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgdGl0bGU9XCJIZWFkaW5nXCIgb25jbGljaz1cInRtcGxFeGVjKCdmb3JtYXRCbG9jaycsJ0gyJylcIj5IPC9idXR0b24+XG4gICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIHRpdGxlPVwiQnVsbGV0ZWQgbGlzdFwiIG9uY2xpY2s9XCJ0bXBsRXhlYygnaW5zZXJ0VW5vcmRlcmVkTGlzdCcpXCI+JmJ1bGw7IExpc3Q8L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgdGl0bGU9XCJOdW1iZXJlZCBsaXN0XCIgb25jbGljaz1cInRtcGxFeGVjKCdpbnNlcnRPcmRlcmVkTGlzdCcpXCI+MS4gTGlzdDwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiB0aXRsZT1cIkluc2VydCBsaW5rXCIgb25jbGljaz1cInRtcGxFeGVjKCdjcmVhdGVMaW5rJylcIj5MaW5rPC9idXR0b24+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgaWQ9XCJfX3RCb2R5XCIgY2xhc3M9XCJjb21wb3NlLWJvZHlcIiBjb250ZW50ZWRpdGFibGU9XCJ0cnVlXCIgYXJpYS1sYWJlbD1cIlRlbXBsYXRlIGJvZHlcIj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJ0bXBsLXZhcnNcIj5DbGljayB0byBpbnNlcnQ6ICR7VEVNUExBVEVfVkFSUy5tYXAodiA9PiBgPGNvZGUgb25jbGljaz1cImluc2VydFRtcGxWYXIoJ3ske3Z9fScpXCI+eyR7dn19PC9jb2RlPmApLmpvaW4oJyAnKX08L2Rpdj5cbiAgICAgIDxsYWJlbCBjbGFzcz1cInRtcGwtYWN0aXZlXCI+PGlucHV0IHR5cGU9XCJjaGVja2JveFwiIGlkPVwiX190QWN0aXZlXCIgJHsoIXQgfHwgdC5hY3RpdmUgIT09IGZhbHNlKSA/ICdjaGVja2VkJyA6ICcnfT4gQWN0aXZlIChzaG93IGluIHRoZSBjb21wb3Nlcik8L2xhYmVsPlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1mb290XCI+XG4gICAgICA8c3BhbiBjbGFzcz1cIm1vZGFsLXN0YXR1c1wiPjwvc3Bhbj48c3BhbiBzdHlsZT1cImZsZXg6MVwiPjwvc3Bhbj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBvbmNsaWNrPVwiY2xvc2VUZW1wbGF0ZUVkaXRvcigpXCI+JHtpYygneCcsIDE1KX0gQ2FuY2VsPC9idXR0b24+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnkganMtdHNhdmVcIiBvbmNsaWNrPVwic2F2ZVRlbXBsYXRlRWRpdG9yKClcIj4ke2ljKCdzYXZlJywgMTUpfSAke2VkaXRpbmcgPyAnU2F2ZSBjaGFuZ2VzJyA6ICdDcmVhdGUnfTwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICA8L2Rpdj5gO1xuICBob3N0LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIGUgPT4geyBpZiAoZS50YXJnZXQgPT09IGhvc3QpIGNsb3NlVGVtcGxhdGVFZGl0b3IoKTsgfSk7XG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaG9zdCk7XG4gIC8vIFNldCB0aGUgYm9keSB2aWEgaW5uZXJIVE1MIEFGVEVSIG1vdW50IChhdm9pZHMgZXNjYXBpbmcgdGhlIHN0b3JlZCBIVE1MIGluIHRoZSB0ZW1wbGF0ZSBzdHJpbmcpLlxuICBjb25zdCBib2R5ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fdEJvZHknKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmIChib2R5ICYmIHQpIGJvZHkuaW5uZXJIVE1MID0gdC5ib2R5IHx8ICcnO1xuICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX3RUaXRsZScpIGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsO1xuICBpZiAodGl0bGUpIHRpdGxlLmZvY3VzKCk7XG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCB0bXBsRXNjQ2xvc2UpO1xufVxuXG5mdW5jdGlvbiB0bXBsRXNjQ2xvc2UoZTogS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuICBpZiAoZS5rZXkgIT09ICdFc2NhcGUnKSByZXR1cm47XG4gIGNsb3NlVGVtcGxhdGVFZGl0b3IoKTtcbn1cbmZ1bmN0aW9uIGNsb3NlVGVtcGxhdGVFZGl0b3IoKTogdm9pZCB7XG4gIGNvbnN0IG0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX190bXBsTW9kYWwnKTtcbiAgaWYgKG0pIG0ucmVtb3ZlKCk7XG4gIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCB0bXBsRXNjQ2xvc2UpO1xufVxuZnVuY3Rpb24gc2V0VG1wbEVycm9yKG1zZzogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI19fdG1wbE1vZGFsIC5tb2RhbC1lcnInKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmICghZWwpIHJldHVybjtcbiAgaWYgKG1zZykgeyBlbC50ZXh0Q29udGVudCA9IG1zZzsgZWwuaGlkZGVuID0gZmFsc2U7IH0gZWxzZSB7IGVsLnRleHRDb250ZW50ID0gJyc7IGVsLmhpZGRlbiA9IHRydWU7IH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc2F2ZVRlbXBsYXRlRWRpdG9yKCk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBtb2RhbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNfX3RtcGxNb2RhbCAubW9kYWwtY2FyZCcpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgaWYgKCFtb2RhbCkgcmV0dXJuO1xuICBjb25zdCBpZCA9IG1vZGFsLmdldEF0dHJpYnV0ZSgnZGF0YS1pZCcpIHx8ICcnO1xuICBjb25zdCB0aXRsZSA9IChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX190VGl0bGUnKSBhcyBIVE1MSW5wdXRFbGVtZW50KS52YWx1ZS50cmltKCk7XG4gIGNvbnN0IHN1YmplY3QgPSAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fdFN1YmplY3QnKSBhcyBIVE1MSW5wdXRFbGVtZW50KS52YWx1ZS50cmltKCk7XG4gIGNvbnN0IGJvZHkgPSAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fdEJvZHknKSBhcyBIVE1MRWxlbWVudCkuaW5uZXJIVE1MLnRyaW0oKTtcbiAgY29uc3QgYWN0aXZlID0gKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX3RBY3RpdmUnKSBhcyBIVE1MSW5wdXRFbGVtZW50KS5jaGVja2VkO1xuICBzZXRUbXBsRXJyb3IoJycpO1xuICBpZiAoIXRpdGxlKSB7IHNldFRtcGxFcnJvcignR2l2ZSB0aGUgdGVtcGxhdGUgYSBuYW1lLicpOyByZXR1cm47IH1cblxuICBjb25zdCBsaXN0ID0gYWxsRW1haWxUZW1wbGF0ZXMoKTtcbiAgbGV0IG5leHQ6IGFueVtdO1xuICBpZiAoaWQpIHtcbiAgICBuZXh0ID0gbGlzdC5tYXAodCA9PiBTdHJpbmcodC5pZCkgPT09IGlkID8geyBpZDogdC5pZCwgdGl0bGU6IHRpdGxlLCBzdWJqZWN0OiBzdWJqZWN0LCBib2R5OiBib2R5LCBhY3RpdmU6IGFjdGl2ZSB9IDogdCk7XG4gIH0gZWxzZSB7XG4gICAgbmV4dCA9IGxpc3QuY29uY2F0KFt7IGlkOiAndG1wbC0nICsgRGF0ZS5ub3coKSwgdGl0bGU6IHRpdGxlLCBzdWJqZWN0OiBzdWJqZWN0LCBib2R5OiBib2R5LCBhY3RpdmU6IGFjdGl2ZSB9XSk7XG4gIH1cblxuICBjb25zdCBidG4gPSBtb2RhbC5xdWVyeVNlbGVjdG9yKCcuanMtdHNhdmUnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG4gIGNvbnN0IHN0YXR1cyA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC1zdGF0dXMnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmIChidG4pIGJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICdTYXZpbmdcdTIwMjYnO1xuICB0cnkge1xuICAgIGNvbnN0IG1lcmdlZCA9IGF3YWl0IHNhdmVTZXR0aW5nc1NlY3Rpb24oJ2VtYWlsJywgeyB0ZW1wbGF0ZXM6IG5leHQgfSk7XG4gICAgU0VUVElOR1MgPSBtZXJnZWQgfHwgU0VUVElOR1M7XG4gICAgY2xvc2VUZW1wbGF0ZUVkaXRvcigpO1xuICAgIHRvYXN0KCdUZW1wbGF0ZSBzYXZlZCcpO1xuICAgIHJlbmRlcigpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBpZiAoYnRuKSBidG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICBpZiAoc3RhdHVzKSBzdGF0dXMudGV4dENvbnRlbnQgPSAnJztcbiAgICBzZXRUbXBsRXJyb3IoZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRlbGV0ZVRlbXBsYXRlKGlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKCF3aW5kb3cuY29uZmlybSgnRGVsZXRlIHRoaXMgdGVtcGxhdGU/IFRoaXMgY2FuXFwndCBiZSB1bmRvbmUuJykpIHJldHVybjtcbiAgY29uc3QgbmV4dCA9IGFsbEVtYWlsVGVtcGxhdGVzKCkuZmlsdGVyKHQgPT4gU3RyaW5nKHQuaWQpICE9PSBpZCk7XG4gIHRyeSB7XG4gICAgY29uc3QgbWVyZ2VkID0gYXdhaXQgc2F2ZVNldHRpbmdzU2VjdGlvbignZW1haWwnLCB7IHRlbXBsYXRlczogbmV4dCB9KTtcbiAgICBTRVRUSU5HUyA9IG1lcmdlZCB8fCBTRVRUSU5HUztcbiAgICB0b2FzdCgnVGVtcGxhdGUgZGVsZXRlZCcpO1xuICAgIHJlbmRlcigpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICB0b2FzdCgnRGVsZXRlIGZhaWxlZDogJyArIChlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSkpO1xuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUF5QkEsU0FBUyxvQkFBcUM7QUFDNUMsUUFBTSxJQUFTO0FBQ2YsUUFBTSxNQUFNLEtBQUssRUFBRSxTQUFTLE1BQU0sUUFBUSxFQUFFLE1BQU0sU0FBUyxJQUFJLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDcEYsU0FBTyxJQUNKLE9BQU8sQ0FBQyxNQUFXLEtBQUssRUFBRSxXQUFXLEtBQUssRUFDMUMsSUFBSSxDQUFDLE9BQVksRUFBRSxJQUFJLE9BQU8sRUFBRSxNQUFNLEVBQUUsR0FBRyxPQUFPLE9BQU8sRUFBRSxTQUFTLEVBQUUsR0FBRyxTQUFTLE9BQU8sRUFBRSxXQUFXLEVBQUUsR0FBRyxNQUFNLE9BQU8sRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFO0FBQzdJO0FBR0EsU0FBUyxVQUFVLE9BQXlCO0FBQzFDLFFBQU0sUUFBUSxNQUFNLElBQUksUUFBTSxLQUFLLElBQUksS0FBSyxDQUFDLEVBQUUsT0FBTyxPQUFLLEVBQUUsU0FBUyxDQUFDO0FBQ3ZFLE1BQUksTUFBTSxXQUFXLEVBQUcsUUFBTztBQUMvQixNQUFJLE1BQU0sV0FBVyxFQUFHLFFBQU8sTUFBTSxDQUFDO0FBQ3RDLE1BQUksTUFBTSxXQUFXLEVBQUcsUUFBTyxNQUFNLENBQUMsSUFBSSxVQUFVLE1BQU0sQ0FBQztBQUMzRCxTQUFPLE1BQU0sTUFBTSxHQUFHLEVBQUUsRUFBRSxLQUFLLElBQUksSUFBSSxXQUFXLE1BQU0sTUFBTSxTQUFTLENBQUM7QUFDMUU7QUFFQSxTQUFTLGVBQWUsVUFBa0IsTUFBdUM7QUFDL0UsU0FBTyxTQUFTLFFBQVEsY0FBYyxDQUFDLEdBQUcsUUFDeEMsT0FBTyxVQUFVLGVBQWUsS0FBSyxNQUFNLEdBQUcsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDO0FBQ25F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
