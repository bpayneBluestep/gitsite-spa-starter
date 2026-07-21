const AGB = { list: null, loading: false, error: null, editing: null };
const AGB_MERGE_VARS = ["clientFullName", "clientFirstName", "clientLastName", "clientDob", "consultantName", "orgName", "todayDate"];
async function agbLoad(force = false) {
  if (AGB.loading) return;
  if (AGB.list && !force) return;
  AGB.loading = true;
  AGB.error = null;
  try {
    AGB.list = await apiListAgreementTemplates() || [];
  } catch (e) {
    AGB.error = e && e.message ? e.message : String(e);
  }
  AGB.loading = false;
  if (location.hash.indexOf("agreementbuilder") >= 0) render();
}
function viewAgreementBuilder() {
  if (AGB.editing) return shell("", agbEditor(AGB.editing));
  if (AGB.list === null) {
    if (!AGB.loading && !AGB.error) agbLoad();
    return shell("", AGB.error ? errorCard(AGB.error) : loadingCard("Loading templates\u2026"));
  }
  return shell("", agbListView());
}
function agbListView() {
  const head = `<div class="page-head"><div><h1>Agreement Templates</h1><p>Author reusable e-signature templates. Only <b>Active</b> templates appear when sending.</p></div>
    <div><a class="btn ghost" href="#/settings/agreements">${ic("chevR", 14)} Settings</a> <button class="btn primary" onclick="agbNew()">${ic("plus", 15)} New template</button></div></div>`;
  if (!AGB.list || !AGB.list.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic("fileText", 22)}</div><b>No templates yet</b><p>Create your first engagement letter or fee agreement.</p></div></div>`;
  }
  const rows = AGB.list.map((t) => {
    const cls = t.status === "Active" ? "ok" : t.status === "Archived" ? "muted" : "draft";
    return `<tr class="clickable" onclick="agbEdit('${esc(t.entryId)}')">
      <td><b>${esc(t.name)}</b>${t.description ? `<div class="meta">${esc(t.description)}</div>` : ""}</td>
      <td>${esc(t.category || "\u2014")}</td>
      <td><span class="pill ${cls}">${esc(t.status || "Draft")}</span></td>
      <td class="muted">v${esc(String(t.version || 1))}</td>
    </tr>`;
  }).join("");
  return head + `<div class="tbl-wrap"><table><thead class="rich"><tr><th>Template</th><th>Category</th><th>Status</th><th>Version</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function agbNew() {
  AGB.editing = {
    entryId: null,
    name: "",
    description: "",
    status: "Draft",
    category: "Engagement Letter",
    bodyJson: { schemaVersion: 1, title: "", roles: [{ id: "parent1", label: "Parent / Guardian", kind: "external", order: 1 }], contentHtml: "" }
  };
  render();
}
function agbEdit(entryId) {
  const t = (AGB.list || []).find((x) => x.entryId === entryId);
  if (!t) return;
  AGB.editing = JSON.parse(JSON.stringify(t));
  if (!AGB.editing.bodyJson) AGB.editing.bodyJson = { schemaVersion: 1, title: t.name, roles: [], contentHtml: "" };
  if (!Array.isArray(AGB.editing.bodyJson.roles)) AGB.editing.bodyJson.roles = [];
  render();
}
function agbCancel() {
  AGB.editing = null;
  render();
}
function agbEditor(t) {
  const b = t.bodyJson || {};
  const cats = ["Engagement Letter", "Fee Agreement", "Consent / ROI", "Other"];
  const catOpts = cats.map((c) => `<option value="${esc(c)}"${t.category === c ? " selected" : ""}>${esc(c)}</option>`).join("");
  const statuses = ["Draft", "Active", "Archived"];
  const stOpts = statuses.map((s) => `<option value="${esc(s)}"${t.status === s ? " selected" : ""}>${esc(s)}</option>`).join("");
  const roles = b.roles || [];
  const roleRows = roles.map((r, i) => `<div class="agb-role" data-i="${i}">
      <input data-rk="label" value="${esc(r.label || "")}" placeholder="Role label" oninput="agbRoleChange(${i},'label',this.value)">
      <select data-rk="kind" onchange="agbRoleChange(${i},'kind',this.value)">
        <option value="external"${r.kind !== "consultant" ? " selected" : ""}>External (email link)</option>
        <option value="consultant"${r.kind === "consultant" ? " selected" : ""}>Consultant (signs in-app)</option>
      </select>
      <button class="btn ghost sm" onclick="agbRoleRemove(${i})" title="Remove">${ic("trash", 13)}</button>
    </div>`).join("");
  const roleTokens = roles.map((r) => `<div class="agb-tok-role"><span class="agb-tok-label">${esc(r.label || r.id)}:</span>
      <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbInsert('{{sig:${esc(r.id)}}}')">${ic("pen", 12)} Signature</button>
      <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbInsert('{{date:${esc(r.id)}}}')">Date</button>
      <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbInsert('{{initials:${esc(r.id)}}}')">Initials</button>
    </div>`).join("");
  const mergeBtns = AGB_MERGE_VARS.map((v) => `<button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbInsert('{{merge:${v}}}')">${v}</button>`).join("");
  return `<div class="page-head"><div><h1>${t.entryId ? "Edit" : "New"} Template</h1><p>Write the agreement body and drop signature/date fields for each signer role.</p></div>
      <div><button class="btn ghost" onclick="agbCancel()">${ic("x", 14)} Cancel</button>
      <button class="btn primary" onclick="agbSave()" id="agb-save">${ic("save", 15)} Save</button></div></div>
    <div class="agb-grid">
      <div class="agb-side">
        <div class="card">
          <div class="field"><label>Name</label><input id="agb-name" value="${esc(t.name || "")}" placeholder="Engagement Agreement"></div>
          <div class="field"><label>Description</label><input id="agb-desc" value="${esc(t.description || "")}" placeholder="Short description"></div>
          <div class="field"><label>Category</label><select id="agb-cat">${catOpts}</select></div>
          <div class="field"><label>Status</label><select id="agb-status">${stOpts}</select><p class="muted" style="margin-top:4px">Set <b>Active</b> to make it sendable.</p></div>
        </div>
        <div class="card">
          <div class="agb-side-h">Signer roles</div>
          <div id="agb-roles">${roleRows}</div>
          <button class="btn ghost sm" onclick="agbRoleAdd()">${ic("plus", 13)} Add role</button>
        </div>
      </div>
      <div class="agb-main">
        <div class="card">
          <div class="agb-toolbar">
            <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmt('bold')"><b>B</b></button>
            <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmt('italic')"><i>I</i></button>
            <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmt('underline')"><u>U</u></button>
            <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmtBlock('h2')">H</button>
            <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmt('insertUnorderedList')">\u2022 List</button>
            <button class="btn ghost sm" onmousedown="event.preventDefault()" onclick="agbFmt('insertOrderedList')">1. List</button>
          </div>
          <div id="agb-body" class="agb-body" contenteditable="true">${b.contentHtml || "<p></p>"}</div>
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
function agbFmt(cmd) {
  try {
    document.execCommand(cmd, false);
  } catch (_e) {
  }
  agbFocusBody();
}
function agbFmtBlock(tag) {
  try {
    document.execCommand("formatBlock", false, tag);
  } catch (_e) {
  }
  agbFocusBody();
}
function agbFocusBody() {
  const el = document.getElementById("agb-body");
  if (el) el.focus();
}
function agbInsert(token) {
  const el = document.getElementById("agb-body");
  if (!el) return;
  el.focus();
  const sel = window.getSelection();
  if (sel && sel.rangeCount && el.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(" " + token + " "));
    range.collapse(false);
  } else {
    el.innerHTML += " " + token + " ";
  }
}
function agbRoleAdd() {
  const roles = AGB.editing.bodyJson.roles;
  const n = roles.length + 1;
  roles.push({ id: "role" + n + "_" + Math.floor(Math.random() * 1e3), label: "Signer " + n, kind: "external", order: n });
  agbCaptureBody();
  render();
}
function agbRoleRemove(i) {
  AGB.editing.bodyJson.roles.splice(i, 1);
  agbCaptureBody();
  render();
}
function agbRoleChange(i, key, val) {
  if (AGB.editing.bodyJson.roles[i]) AGB.editing.bodyJson.roles[i][key] = val;
}
function agbCaptureBody() {
  const el = document.getElementById("agb-body");
  if (el && AGB.editing) AGB.editing.bodyJson.contentHtml = el.innerHTML;
}
async function agbSave() {
  const t = AGB.editing;
  if (!t) return;
  const name = document.getElementById("agb-name").value.trim();
  if (!name) {
    toast("Give the template a name.");
    return;
  }
  agbCaptureBody();
  const body = {
    schemaVersion: 1,
    title: name,
    roles: t.bodyJson.roles,
    contentHtml: t.bodyJson.contentHtml || ""
  };
  const fields = {
    name,
    description: document.getElementById("agb-desc").value.trim(),
    category: document.getElementById("agb-cat").value,
    status: document.getElementById("agb-status").value,
    bodyJson: body
  };
  const btn = document.getElementById("agb-save");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Saving\u2026";
  }
  try {
    await apiSaveAgreementTemplate(t.entryId, fields);
    AGB.editing = null;
    await agbLoad(true);
    toast("Template saved.");
  } catch (e) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = ic("save", 15) + " Save";
    }
    toast("Save failed: " + (e && e.message ? e.message : String(e)));
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiYWdyZWVtZW50YnVpbGRlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICBhZ3JlZW1lbnRidWlsZGVyLnRzIFx1MjAxNCB0aGUgQWdyZWVtZW50IFRlbXBsYXRlIGJ1aWxkZXIgKHJvdXRlICMvYWdyZWVtZW50YnVpbGRlcixcbiAgIGxhdW5jaGVkIGZyb20gU2V0dGluZ3MgXHUyNUI4IEFncmVlbWVudHMpLiBBdXRob3JzIHJldXNhYmxlIGUtc2lnbiB0ZW1wbGF0ZXMgc3RvcmVkXG4gICBvbiB0aGlzT3JnLmFncmVlbWVudFRlbXBsYXRlcyB2aWEgdGhlIG1hZXN0cm8uXG5cbiAgIFRlbXBsYXRlIG1vZGVsIChib2R5SnNvbik6XG4gICAgIHsgc2NoZW1hVmVyc2lvbiwgdGl0bGUsIHJvbGVzOlt7aWQsbGFiZWwsa2luZCxvcmRlcn1dLCBjb250ZW50SHRtbCB9XG4gICBjb250ZW50SHRtbCBpcyByaWNoIEhUTUwgY2FycnlpbmcgdG9rZW5zIHRoZSBzaWduaW5nIHBhZ2UgKyBmaW5hbGl6ZSByZW5kZXI6XG4gICAgIHt7bWVyZ2U6a2V5fX0gIFx1MjE5MiBjbGllbnQvY29uc3VsdGFudC9vcmcgZGF0YVxuICAgICB7e3NpZzpyb2xlSWR9fSBcdTIxOTIgdGhhdCByb2xlJ3Mgc2lnbmF0dXJlICAge3tkYXRlOnJvbGVJZH19IFx1MjE5MiBzaWduZWQgZGF0ZVxuICAgICB7e2luaXRpYWxzOnJvbGVJZH19IFx1MDBCNyB7e3RleHQ6cm9sZUlkOkxhYmVsfX1cbiAgIFRoZSBjb25zdWx0YW50IHdyaXRlcyB0aGUgYm9keSBpbiBhIGNvbnRlbnRlZGl0YWJsZTsgdG9rZW5zIGFyZSBpbnNlcnRlZCBhc1xuICAgbGl0ZXJhbCB0ZXh0IHNvIHRoZSByZW5kZXIgcGlwZWxpbmUgY2FuIGZpbmQgKyByZXBsYWNlIHRoZW0uXG4gICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuaW50ZXJmYWNlIEFnYlN0YXRlIHsgbGlzdDogYW55W10gfCBudWxsOyBsb2FkaW5nOiBib29sZWFuOyBlcnJvcjogc3RyaW5nIHwgbnVsbDsgZWRpdGluZzogYW55IHwgbnVsbDsgfVxuY29uc3QgQUdCOiBBZ2JTdGF0ZSA9IHsgbGlzdDogbnVsbCwgbG9hZGluZzogZmFsc2UsIGVycm9yOiBudWxsLCBlZGl0aW5nOiBudWxsIH07XG5jb25zdCBBR0JfTUVSR0VfVkFSUyA9IFsnY2xpZW50RnVsbE5hbWUnLCAnY2xpZW50Rmlyc3ROYW1lJywgJ2NsaWVudExhc3ROYW1lJywgJ2NsaWVudERvYicsICdjb25zdWx0YW50TmFtZScsICdvcmdOYW1lJywgJ3RvZGF5RGF0ZSddO1xuXG5hc3luYyBmdW5jdGlvbiBhZ2JMb2FkKGZvcmNlID0gZmFsc2UpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKEFHQi5sb2FkaW5nKSByZXR1cm47XG4gIGlmIChBR0IubGlzdCAmJiAhZm9yY2UpIHJldHVybjtcbiAgQUdCLmxvYWRpbmcgPSB0cnVlOyBBR0IuZXJyb3IgPSBudWxsO1xuICB0cnkgeyBBR0IubGlzdCA9IGF3YWl0IGFwaUxpc3RBZ3JlZW1lbnRUZW1wbGF0ZXMoKSB8fCBbXTsgfVxuICBjYXRjaCAoZTogYW55KSB7IEFHQi5lcnJvciA9IGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpOyB9XG4gIEFHQi5sb2FkaW5nID0gZmFsc2U7XG4gIGlmIChsb2NhdGlvbi5oYXNoLmluZGV4T2YoJ2FncmVlbWVudGJ1aWxkZXInKSA+PSAwKSByZW5kZXIoKTtcbn1cblxuZnVuY3Rpb24gdmlld0FncmVlbWVudEJ1aWxkZXIoKTogc3RyaW5nIHtcbiAgaWYgKEFHQi5lZGl0aW5nKSByZXR1cm4gc2hlbGwoJycsIGFnYkVkaXRvcihBR0IuZWRpdGluZykpO1xuICBpZiAoQUdCLmxpc3QgPT09IG51bGwpIHsgaWYgKCFBR0IubG9hZGluZyAmJiAhQUdCLmVycm9yKSBhZ2JMb2FkKCk7IHJldHVybiBzaGVsbCgnJywgQUdCLmVycm9yID8gZXJyb3JDYXJkKEFHQi5lcnJvcikgOiBsb2FkaW5nQ2FyZCgnTG9hZGluZyB0ZW1wbGF0ZXNcdTIwMjYnKSk7IH1cbiAgcmV0dXJuIHNoZWxsKCcnLCBhZ2JMaXN0VmlldygpKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIGxpc3QgdmlldyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmZ1bmN0aW9uIGFnYkxpc3RWaWV3KCk6IHN0cmluZyB7XG4gIGNvbnN0IGhlYWQgPSBgPGRpdiBjbGFzcz1cInBhZ2UtaGVhZFwiPjxkaXY+PGgxPkFncmVlbWVudCBUZW1wbGF0ZXM8L2gxPjxwPkF1dGhvciByZXVzYWJsZSBlLXNpZ25hdHVyZSB0ZW1wbGF0ZXMuIE9ubHkgPGI+QWN0aXZlPC9iPiB0ZW1wbGF0ZXMgYXBwZWFyIHdoZW4gc2VuZGluZy48L3A+PC9kaXY+XG4gICAgPGRpdj48YSBjbGFzcz1cImJ0biBnaG9zdFwiIGhyZWY9XCIjL3NldHRpbmdzL2FncmVlbWVudHNcIj4ke2ljKCdjaGV2UicsIDE0KX0gU2V0dGluZ3M8L2E+IDxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeVwiIG9uY2xpY2s9XCJhZ2JOZXcoKVwiPiR7aWMoJ3BsdXMnLCAxNSl9IE5ldyB0ZW1wbGF0ZTwvYnV0dG9uPjwvZGl2PjwvZGl2PmA7XG4gIGlmICghQUdCLmxpc3QgfHwgIUFHQi5saXN0Lmxlbmd0aCkge1xuICAgIHJldHVybiBoZWFkICsgYDxkaXYgY2xhc3M9XCJjYXJkXCI+PGRpdiBjbGFzcz1cImVtcHR5XCI+PGRpdiBjbGFzcz1cImljb1wiPiR7aWMoJ2ZpbGVUZXh0JywgMjIpfTwvZGl2PjxiPk5vIHRlbXBsYXRlcyB5ZXQ8L2I+PHA+Q3JlYXRlIHlvdXIgZmlyc3QgZW5nYWdlbWVudCBsZXR0ZXIgb3IgZmVlIGFncmVlbWVudC48L3A+PC9kaXY+PC9kaXY+YDtcbiAgfVxuICBjb25zdCByb3dzID0gQUdCLmxpc3QubWFwKCh0OiBhbnkpID0+IHtcbiAgICBjb25zdCBjbHMgPSB0LnN0YXR1cyA9PT0gJ0FjdGl2ZScgPyAnb2snIDogdC5zdGF0dXMgPT09ICdBcmNoaXZlZCcgPyAnbXV0ZWQnIDogJ2RyYWZ0JztcbiAgICByZXR1cm4gYDx0ciBjbGFzcz1cImNsaWNrYWJsZVwiIG9uY2xpY2s9XCJhZ2JFZGl0KCcke2VzYyh0LmVudHJ5SWQpfScpXCI+XG4gICAgICA8dGQ+PGI+JHtlc2ModC5uYW1lKX08L2I+JHt0LmRlc2NyaXB0aW9uID8gYDxkaXYgY2xhc3M9XCJtZXRhXCI+JHtlc2ModC5kZXNjcmlwdGlvbil9PC9kaXY+YCA6ICcnfTwvdGQ+XG4gICAgICA8dGQ+JHtlc2ModC5jYXRlZ29yeSB8fCAnXHUyMDE0Jyl9PC90ZD5cbiAgICAgIDx0ZD48c3BhbiBjbGFzcz1cInBpbGwgJHtjbHN9XCI+JHtlc2ModC5zdGF0dXMgfHwgJ0RyYWZ0Jyl9PC9zcGFuPjwvdGQ+XG4gICAgICA8dGQgY2xhc3M9XCJtdXRlZFwiPnYke2VzYyhTdHJpbmcodC52ZXJzaW9uIHx8IDEpKX08L3RkPlxuICAgIDwvdHI+YDtcbiAgfSkuam9pbignJyk7XG4gIHJldHVybiBoZWFkICsgYDxkaXYgY2xhc3M9XCJ0Ymwtd3JhcFwiPjx0YWJsZT48dGhlYWQgY2xhc3M9XCJyaWNoXCI+PHRyPjx0aD5UZW1wbGF0ZTwvdGg+PHRoPkNhdGVnb3J5PC90aD48dGg+U3RhdHVzPC90aD48dGg+VmVyc2lvbjwvdGg+PC90cj48L3RoZWFkPjx0Ym9keT4ke3Jvd3N9PC90Ym9keT48L3RhYmxlPjwvZGl2PmA7XG59XG5cbmZ1bmN0aW9uIGFnYk5ldygpOiB2b2lkIHtcbiAgQUdCLmVkaXRpbmcgPSB7IGVudHJ5SWQ6IG51bGwsIG5hbWU6ICcnLCBkZXNjcmlwdGlvbjogJycsIHN0YXR1czogJ0RyYWZ0JywgY2F0ZWdvcnk6ICdFbmdhZ2VtZW50IExldHRlcicsXG4gICAgYm9keUpzb246IHsgc2NoZW1hVmVyc2lvbjogMSwgdGl0bGU6ICcnLCByb2xlczogW3sgaWQ6ICdwYXJlbnQxJywgbGFiZWw6ICdQYXJlbnQgLyBHdWFyZGlhbicsIGtpbmQ6ICdleHRlcm5hbCcsIG9yZGVyOiAxIH1dLCBjb250ZW50SHRtbDogJycgfSB9O1xuICByZW5kZXIoKTtcbn1cbmZ1bmN0aW9uIGFnYkVkaXQoZW50cnlJZDogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IHQgPSAoQUdCLmxpc3QgfHwgW10pLmZpbmQoKHg6IGFueSkgPT4geC5lbnRyeUlkID09PSBlbnRyeUlkKTtcbiAgaWYgKCF0KSByZXR1cm47XG4gIC8vIGRlZXAtaXNoIGNsb25lIHNvIGVkaXRzIGRvbid0IG11dGF0ZSB0aGUgY2FjaGVkIGxpc3QgdW50aWwgc2F2ZWRcbiAgQUdCLmVkaXRpbmcgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHQpKTtcbiAgaWYgKCFBR0IuZWRpdGluZy5ib2R5SnNvbikgQUdCLmVkaXRpbmcuYm9keUpzb24gPSB7IHNjaGVtYVZlcnNpb246IDEsIHRpdGxlOiB0Lm5hbWUsIHJvbGVzOiBbXSwgY29udGVudEh0bWw6ICcnIH07XG4gIGlmICghQXJyYXkuaXNBcnJheShBR0IuZWRpdGluZy5ib2R5SnNvbi5yb2xlcykpIEFHQi5lZGl0aW5nLmJvZHlKc29uLnJvbGVzID0gW107XG4gIHJlbmRlcigpO1xufVxuZnVuY3Rpb24gYWdiQ2FuY2VsKCk6IHZvaWQgeyBBR0IuZWRpdGluZyA9IG51bGw7IHJlbmRlcigpOyB9XG5cbi8vIFx1MjUwMFx1MjUwMCBlZGl0b3IgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5mdW5jdGlvbiBhZ2JFZGl0b3IodDogYW55KTogc3RyaW5nIHtcbiAgY29uc3QgYiA9IHQuYm9keUpzb24gfHwge307XG4gIGNvbnN0IGNhdHMgPSBbJ0VuZ2FnZW1lbnQgTGV0dGVyJywgJ0ZlZSBBZ3JlZW1lbnQnLCAnQ29uc2VudCAvIFJPSScsICdPdGhlciddO1xuICBjb25zdCBjYXRPcHRzID0gY2F0cy5tYXAoYyA9PiBgPG9wdGlvbiB2YWx1ZT1cIiR7ZXNjKGMpfVwiJHt0LmNhdGVnb3J5ID09PSBjID8gJyBzZWxlY3RlZCcgOiAnJ30+JHtlc2MoYyl9PC9vcHRpb24+YCkuam9pbignJyk7XG4gIGNvbnN0IHN0YXR1c2VzID0gWydEcmFmdCcsICdBY3RpdmUnLCAnQXJjaGl2ZWQnXTtcbiAgY29uc3Qgc3RPcHRzID0gc3RhdHVzZXMubWFwKHMgPT4gYDxvcHRpb24gdmFsdWU9XCIke2VzYyhzKX1cIiR7dC5zdGF0dXMgPT09IHMgPyAnIHNlbGVjdGVkJyA6ICcnfT4ke2VzYyhzKX08L29wdGlvbj5gKS5qb2luKCcnKTtcbiAgY29uc3Qgcm9sZXMgPSAoYi5yb2xlcyB8fCBbXSkgYXMgYW55W107XG4gIGNvbnN0IHJvbGVSb3dzID0gcm9sZXMubWFwKChyLCBpKSA9PiBgPGRpdiBjbGFzcz1cImFnYi1yb2xlXCIgZGF0YS1pPVwiJHtpfVwiPlxuICAgICAgPGlucHV0IGRhdGEtcms9XCJsYWJlbFwiIHZhbHVlPVwiJHtlc2Moci5sYWJlbCB8fCAnJyl9XCIgcGxhY2Vob2xkZXI9XCJSb2xlIGxhYmVsXCIgb25pbnB1dD1cImFnYlJvbGVDaGFuZ2UoJHtpfSwnbGFiZWwnLHRoaXMudmFsdWUpXCI+XG4gICAgICA8c2VsZWN0IGRhdGEtcms9XCJraW5kXCIgb25jaGFuZ2U9XCJhZ2JSb2xlQ2hhbmdlKCR7aX0sJ2tpbmQnLHRoaXMudmFsdWUpXCI+XG4gICAgICAgIDxvcHRpb24gdmFsdWU9XCJleHRlcm5hbFwiJHtyLmtpbmQgIT09ICdjb25zdWx0YW50JyA/ICcgc2VsZWN0ZWQnIDogJyd9PkV4dGVybmFsIChlbWFpbCBsaW5rKTwvb3B0aW9uPlxuICAgICAgICA8b3B0aW9uIHZhbHVlPVwiY29uc3VsdGFudFwiJHtyLmtpbmQgPT09ICdjb25zdWx0YW50JyA/ICcgc2VsZWN0ZWQnIDogJyd9PkNvbnN1bHRhbnQgKHNpZ25zIGluLWFwcCk8L29wdGlvbj5cbiAgICAgIDwvc2VsZWN0PlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdCBzbVwiIG9uY2xpY2s9XCJhZ2JSb2xlUmVtb3ZlKCR7aX0pXCIgdGl0bGU9XCJSZW1vdmVcIj4ke2ljKCd0cmFzaCcsIDEzKX08L2J1dHRvbj5cbiAgICA8L2Rpdj5gKS5qb2luKCcnKTtcbiAgLy8gdG9rZW4gaW5zZXJ0IGJ1dHRvbnMgcGVyIHJvbGVcbiAgY29uc3Qgcm9sZVRva2VucyA9IHJvbGVzLm1hcChyID0+IGA8ZGl2IGNsYXNzPVwiYWdiLXRvay1yb2xlXCI+PHNwYW4gY2xhc3M9XCJhZ2ItdG9rLWxhYmVsXCI+JHtlc2Moci5sYWJlbCB8fCByLmlkKX06PC9zcGFuPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdCBzbVwiIG9ubW91c2Vkb3duPVwiZXZlbnQucHJldmVudERlZmF1bHQoKVwiIG9uY2xpY2s9XCJhZ2JJbnNlcnQoJ3t7c2lnOiR7ZXNjKHIuaWQpfX19JylcIj4ke2ljKCdwZW4nLCAxMil9IFNpZ25hdHVyZTwvYnV0dG9uPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdCBzbVwiIG9ubW91c2Vkb3duPVwiZXZlbnQucHJldmVudERlZmF1bHQoKVwiIG9uY2xpY2s9XCJhZ2JJbnNlcnQoJ3t7ZGF0ZToke2VzYyhyLmlkKX19fScpXCI+RGF0ZTwvYnV0dG9uPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdCBzbVwiIG9ubW91c2Vkb3duPVwiZXZlbnQucHJldmVudERlZmF1bHQoKVwiIG9uY2xpY2s9XCJhZ2JJbnNlcnQoJ3t7aW5pdGlhbHM6JHtlc2Moci5pZCl9fX0nKVwiPkluaXRpYWxzPC9idXR0b24+XG4gICAgPC9kaXY+YCkuam9pbignJyk7XG4gIGNvbnN0IG1lcmdlQnRucyA9IEFHQl9NRVJHRV9WQVJTLm1hcCh2ID0+IGA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0IHNtXCIgb25tb3VzZWRvd249XCJldmVudC5wcmV2ZW50RGVmYXVsdCgpXCIgb25jbGljaz1cImFnYkluc2VydCgne3ttZXJnZToke3Z9fX0nKVwiPiR7dn08L2J1dHRvbj5gKS5qb2luKCcnKTtcblxuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJwYWdlLWhlYWRcIj48ZGl2PjxoMT4ke3QuZW50cnlJZCA/ICdFZGl0JyA6ICdOZXcnfSBUZW1wbGF0ZTwvaDE+PHA+V3JpdGUgdGhlIGFncmVlbWVudCBib2R5IGFuZCBkcm9wIHNpZ25hdHVyZS9kYXRlIGZpZWxkcyBmb3IgZWFjaCBzaWduZXIgcm9sZS48L3A+PC9kaXY+XG4gICAgICA8ZGl2PjxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBvbmNsaWNrPVwiYWdiQ2FuY2VsKClcIj4ke2ljKCd4JywgMTQpfSBDYW5jZWw8L2J1dHRvbj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeVwiIG9uY2xpY2s9XCJhZ2JTYXZlKClcIiBpZD1cImFnYi1zYXZlXCI+JHtpYygnc2F2ZScsIDE1KX0gU2F2ZTwvYnV0dG9uPjwvZGl2PjwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJhZ2ItZ3JpZFwiPlxuICAgICAgPGRpdiBjbGFzcz1cImFnYi1zaWRlXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZpZWxkXCI+PGxhYmVsPk5hbWU8L2xhYmVsPjxpbnB1dCBpZD1cImFnYi1uYW1lXCIgdmFsdWU9XCIke2VzYyh0Lm5hbWUgfHwgJycpfVwiIHBsYWNlaG9sZGVyPVwiRW5nYWdlbWVudCBBZ3JlZW1lbnRcIj48L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmllbGRcIj48bGFiZWw+RGVzY3JpcHRpb248L2xhYmVsPjxpbnB1dCBpZD1cImFnYi1kZXNjXCIgdmFsdWU9XCIke2VzYyh0LmRlc2NyaXB0aW9uIHx8ICcnKX1cIiBwbGFjZWhvbGRlcj1cIlNob3J0IGRlc2NyaXB0aW9uXCI+PC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImZpZWxkXCI+PGxhYmVsPkNhdGVnb3J5PC9sYWJlbD48c2VsZWN0IGlkPVwiYWdiLWNhdFwiPiR7Y2F0T3B0c308L3NlbGVjdD48L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZmllbGRcIj48bGFiZWw+U3RhdHVzPC9sYWJlbD48c2VsZWN0IGlkPVwiYWdiLXN0YXR1c1wiPiR7c3RPcHRzfTwvc2VsZWN0PjxwIGNsYXNzPVwibXV0ZWRcIiBzdHlsZT1cIm1hcmdpbi10b3A6NHB4XCI+U2V0IDxiPkFjdGl2ZTwvYj4gdG8gbWFrZSBpdCBzZW5kYWJsZS48L3A+PC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiY2FyZFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJhZ2Itc2lkZS1oXCI+U2lnbmVyIHJvbGVzPC9kaXY+XG4gICAgICAgICAgPGRpdiBpZD1cImFnYi1yb2xlc1wiPiR7cm9sZVJvd3N9PC9kaXY+XG4gICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdCBzbVwiIG9uY2xpY2s9XCJhZ2JSb2xlQWRkKClcIj4ke2ljKCdwbHVzJywgMTMpfSBBZGQgcm9sZTwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImFnYi1tYWluXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJjYXJkXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImFnYi10b29sYmFyXCI+XG4gICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0IHNtXCIgb25tb3VzZWRvd249XCJldmVudC5wcmV2ZW50RGVmYXVsdCgpXCIgb25jbGljaz1cImFnYkZtdCgnYm9sZCcpXCI+PGI+QjwvYj48L2J1dHRvbj5cbiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3Qgc21cIiBvbm1vdXNlZG93bj1cImV2ZW50LnByZXZlbnREZWZhdWx0KClcIiBvbmNsaWNrPVwiYWdiRm10KCdpdGFsaWMnKVwiPjxpPkk8L2k+PC9idXR0b24+XG4gICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0IHNtXCIgb25tb3VzZWRvd249XCJldmVudC5wcmV2ZW50RGVmYXVsdCgpXCIgb25jbGljaz1cImFnYkZtdCgndW5kZXJsaW5lJylcIj48dT5VPC91PjwvYnV0dG9uPlxuICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdCBzbVwiIG9ubW91c2Vkb3duPVwiZXZlbnQucHJldmVudERlZmF1bHQoKVwiIG9uY2xpY2s9XCJhZ2JGbXRCbG9jaygnaDInKVwiPkg8L2J1dHRvbj5cbiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3Qgc21cIiBvbm1vdXNlZG93bj1cImV2ZW50LnByZXZlbnREZWZhdWx0KClcIiBvbmNsaWNrPVwiYWdiRm10KCdpbnNlcnRVbm9yZGVyZWRMaXN0JylcIj5cdTIwMjIgTGlzdDwvYnV0dG9uPlxuICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdCBzbVwiIG9ubW91c2Vkb3duPVwiZXZlbnQucHJldmVudERlZmF1bHQoKVwiIG9uY2xpY2s9XCJhZ2JGbXQoJ2luc2VydE9yZGVyZWRMaXN0JylcIj4xLiBMaXN0PC9idXR0b24+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBpZD1cImFnYi1ib2R5XCIgY2xhc3M9XCJhZ2ItYm9keVwiIGNvbnRlbnRlZGl0YWJsZT1cInRydWVcIj4ke2IuY29udGVudEh0bWwgfHwgJzxwPjwvcD4nfTwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImNhcmQgYWdiLXRva2Vuc1wiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJhZ2Itc2lkZS1oXCI+SW5zZXJ0IG1lcmdlIGZpZWxkczwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJhZ2ItdG9rLXJvd1wiPiR7bWVyZ2VCdG5zfTwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJhZ2Itc2lkZS1oXCIgc3R5bGU9XCJtYXJnaW4tdG9wOjEycHhcIj5JbnNlcnQgc2lnbmF0dXJlIC8gZGF0ZSBmaWVsZHM8L2Rpdj5cbiAgICAgICAgICAke3JvbGVUb2tlbnMgfHwgJzxwIGNsYXNzPVwibXV0ZWRcIj5BZGQgYSBzaWduZXIgcm9sZSB0byBpbnNlcnQgaXRzIGZpZWxkcy48L3A+J31cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5gO1xufVxuXG4vLyBrZWVwIHRoZSBlZGl0aW5nIG1vZGVsIGluIHN5bmMgd2l0aCB0aGUgc2lkZSBpbnB1dHMgb24gc2F2ZSAocmVhZCBmcm9tIERPTSlcbmZ1bmN0aW9uIGFnYkZtdChjbWQ6IHN0cmluZyk6IHZvaWQgeyB0cnkgeyBkb2N1bWVudC5leGVjQ29tbWFuZChjbWQsIGZhbHNlKTsgfSBjYXRjaCAoX2UpIHsgLyogKi8gfSBhZ2JGb2N1c0JvZHkoKTsgfVxuZnVuY3Rpb24gYWdiRm10QmxvY2sodGFnOiBzdHJpbmcpOiB2b2lkIHsgdHJ5IHsgZG9jdW1lbnQuZXhlY0NvbW1hbmQoJ2Zvcm1hdEJsb2NrJywgZmFsc2UsIHRhZyk7IH0gY2F0Y2ggKF9lKSB7IC8qICovIH0gYWdiRm9jdXNCb2R5KCk7IH1cbmZ1bmN0aW9uIGFnYkZvY3VzQm9keSgpOiB2b2lkIHsgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWdiLWJvZHknKTsgaWYgKGVsKSBlbC5mb2N1cygpOyB9XG5cbi8vIEluc2VydCBhIHRva2VuIGF0IHRoZSBjYXJldCBpbnNpZGUgdGhlIGJvZHkgKGZhbGxzIGJhY2sgdG8gYXBwZW5kKS5cbmZ1bmN0aW9uIGFnYkluc2VydCh0b2tlbjogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FnYi1ib2R5Jyk7IGlmICghZWwpIHJldHVybjtcbiAgZWwuZm9jdXMoKTtcbiAgY29uc3Qgc2VsID0gd2luZG93LmdldFNlbGVjdGlvbigpO1xuICBpZiAoc2VsICYmIHNlbC5yYW5nZUNvdW50ICYmIGVsLmNvbnRhaW5zKHNlbC5hbmNob3JOb2RlKSkge1xuICAgIGNvbnN0IHJhbmdlID0gc2VsLmdldFJhbmdlQXQoMCk7XG4gICAgcmFuZ2UuZGVsZXRlQ29udGVudHMoKTtcbiAgICByYW5nZS5pbnNlcnROb2RlKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcgJyArIHRva2VuICsgJyAnKSk7XG4gICAgcmFuZ2UuY29sbGFwc2UoZmFsc2UpO1xuICB9IGVsc2Uge1xuICAgIGVsLmlubmVySFRNTCArPSAnICcgKyB0b2tlbiArICcgJztcbiAgfVxufVxuXG5mdW5jdGlvbiBhZ2JSb2xlQWRkKCk6IHZvaWQge1xuICBjb25zdCByb2xlcyA9IEFHQi5lZGl0aW5nLmJvZHlKc29uLnJvbGVzO1xuICBjb25zdCBuID0gcm9sZXMubGVuZ3RoICsgMTtcbiAgcm9sZXMucHVzaCh7IGlkOiAncm9sZScgKyBuICsgJ18nICsgTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMCksIGxhYmVsOiAnU2lnbmVyICcgKyBuLCBraW5kOiAnZXh0ZXJuYWwnLCBvcmRlcjogbiB9KTtcbiAgYWdiQ2FwdHVyZUJvZHkoKTsgcmVuZGVyKCk7XG59XG5mdW5jdGlvbiBhZ2JSb2xlUmVtb3ZlKGk6IG51bWJlcik6IHZvaWQgeyBBR0IuZWRpdGluZy5ib2R5SnNvbi5yb2xlcy5zcGxpY2UoaSwgMSk7IGFnYkNhcHR1cmVCb2R5KCk7IHJlbmRlcigpOyB9XG5mdW5jdGlvbiBhZ2JSb2xlQ2hhbmdlKGk6IG51bWJlciwga2V5OiBzdHJpbmcsIHZhbDogc3RyaW5nKTogdm9pZCB7IGlmIChBR0IuZWRpdGluZy5ib2R5SnNvbi5yb2xlc1tpXSkgQUdCLmVkaXRpbmcuYm9keUpzb24ucm9sZXNbaV1ba2V5XSA9IHZhbDsgfVxuXG4vLyBSZWFkIHRoZSBjb250ZW50ZWRpdGFibGUgYm9keSBpbnRvIHRoZSBtb2RlbCAoYmVmb3JlIGEgcmUtcmVuZGVyIHdvdWxkIHdpcGUgaXQpLlxuZnVuY3Rpb24gYWdiQ2FwdHVyZUJvZHkoKTogdm9pZCB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FnYi1ib2R5Jyk7XG4gIGlmIChlbCAmJiBBR0IuZWRpdGluZykgQUdCLmVkaXRpbmcuYm9keUpzb24uY29udGVudEh0bWwgPSBlbC5pbm5lckhUTUw7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGFnYlNhdmUoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHQgPSBBR0IuZWRpdGluZzsgaWYgKCF0KSByZXR1cm47XG4gIGNvbnN0IG5hbWUgPSAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FnYi1uYW1lJykgYXMgSFRNTElucHV0RWxlbWVudCkudmFsdWUudHJpbSgpO1xuICBpZiAoIW5hbWUpIHsgdG9hc3QoJ0dpdmUgdGhlIHRlbXBsYXRlIGEgbmFtZS4nKTsgcmV0dXJuOyB9XG4gIGFnYkNhcHR1cmVCb2R5KCk7XG4gIGNvbnN0IGJvZHkgPSB7XG4gICAgc2NoZW1hVmVyc2lvbjogMSxcbiAgICB0aXRsZTogbmFtZSxcbiAgICByb2xlczogdC5ib2R5SnNvbi5yb2xlcyxcbiAgICBjb250ZW50SHRtbDogdC5ib2R5SnNvbi5jb250ZW50SHRtbCB8fCAnJyxcbiAgfTtcbiAgY29uc3QgZmllbGRzID0ge1xuICAgIG5hbWU6IG5hbWUsXG4gICAgZGVzY3JpcHRpb246IChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWdiLWRlc2MnKSBhcyBIVE1MSW5wdXRFbGVtZW50KS52YWx1ZS50cmltKCksXG4gICAgY2F0ZWdvcnk6IChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWdiLWNhdCcpIGFzIEhUTUxTZWxlY3RFbGVtZW50KS52YWx1ZSxcbiAgICBzdGF0dXM6IChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWdiLXN0YXR1cycpIGFzIEhUTUxTZWxlY3RFbGVtZW50KS52YWx1ZSxcbiAgICBib2R5SnNvbjogYm9keSxcbiAgfTtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FnYi1zYXZlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuICBpZiAoYnRuKSB7IGJ0bi5kaXNhYmxlZCA9IHRydWU7IGJ0bi50ZXh0Q29udGVudCA9ICdTYXZpbmdcdTIwMjYnOyB9XG4gIHRyeSB7XG4gICAgYXdhaXQgYXBpU2F2ZUFncmVlbWVudFRlbXBsYXRlKHQuZW50cnlJZCwgZmllbGRzKTtcbiAgICBBR0IuZWRpdGluZyA9IG51bGw7XG4gICAgYXdhaXQgYWdiTG9hZCh0cnVlKTtcbiAgICB0b2FzdCgnVGVtcGxhdGUgc2F2ZWQuJyk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIGlmIChidG4pIHsgYnRuLmRpc2FibGVkID0gZmFsc2U7IGJ0bi5pbm5lckhUTUwgPSBpYygnc2F2ZScsIDE1KSArICcgU2F2ZSc7IH1cbiAgICB0b2FzdCgnU2F2ZSBmYWlsZWQ6ICcgKyAoZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpKTtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBZ0JBLE1BQU0sTUFBZ0IsRUFBRSxNQUFNLE1BQU0sU0FBUyxPQUFPLE9BQU8sTUFBTSxTQUFTLEtBQUs7QUFDL0UsTUFBTSxpQkFBaUIsQ0FBQyxrQkFBa0IsbUJBQW1CLGtCQUFrQixhQUFhLGtCQUFrQixXQUFXLFdBQVc7QUFFcEksZUFBZSxRQUFRLFFBQVEsT0FBc0I7QUFDbkQsTUFBSSxJQUFJLFFBQVM7QUFDakIsTUFBSSxJQUFJLFFBQVEsQ0FBQyxNQUFPO0FBQ3hCLE1BQUksVUFBVTtBQUFNLE1BQUksUUFBUTtBQUNoQyxNQUFJO0FBQUUsUUFBSSxPQUFPLE1BQU0sMEJBQTBCLEtBQUssQ0FBQztBQUFBLEVBQUcsU0FDbkQsR0FBUTtBQUFFLFFBQUksUUFBUSxLQUFLLEVBQUUsVUFBVSxFQUFFLFVBQVUsT0FBTyxDQUFDO0FBQUEsRUFBRztBQUNyRSxNQUFJLFVBQVU7QUFDZCxNQUFJLFNBQVMsS0FBSyxRQUFRLGtCQUFrQixLQUFLLEVBQUcsUUFBTztBQUM3RDtBQUVBLFNBQVMsdUJBQStCO0FBQ3RDLE1BQUksSUFBSSxRQUFTLFFBQU8sTUFBTSxJQUFJLFVBQVUsSUFBSSxPQUFPLENBQUM7QUFDeEQsTUFBSSxJQUFJLFNBQVMsTUFBTTtBQUFFLFFBQUksQ0FBQyxJQUFJLFdBQVcsQ0FBQyxJQUFJLE1BQU8sU0FBUTtBQUFHLFdBQU8sTUFB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
