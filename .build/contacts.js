const CONTACTS_CACHE = {};
function contactsState(cid) {
  if (!CONTACTS_CACHE[cid]) CONTACTS_CACHE[cid] = { list: null, loading: false, error: null };
  return CONTACTS_CACHE[cid];
}
async function loadContacts(cid, force = false) {
  const st = contactsState(cid);
  if (st.loading) return;
  if (st.list && !force) return;
  st.loading = true;
  st.error = null;
  try {
    const rows = await apiListContacts(cid);
    st.list = (Array.isArray(rows) ? rows : []).map(normalizeContact);
  } catch (e) {
    st.error = e && e.message ? e.message : String(e);
    st.list = null;
  } finally {
    st.loading = false;
    if (typeof render === "function") render();
  }
}
function normalizeContact(r) {
  return {
    entryId: String(r.entryId || ""),
    firstName: r.firstName || "",
    lastName: r.lastName || "",
    relationship: r.relationship || "",
    email: r.email || "",
    cell: r.cell || "",
    primary: r.primary === true,
    address: r.address || "",
    city: r.city || "",
    state: r.state || "",
    zip: r.zip || "",
    photoUrl: r.photo || ""
  };
}
function contactsSection(c) {
  const st = contactsState(c.id);
  if (!SETTINGS && !SETTINGS_LOADING) loadSettings();
  const head = `<div class="section-head">
    <div><h3>Contacts</h3><p>Family, guardians, and the treatment team for ${esc(c.first)}.</p></div>
    <button class="btn primary" onclick="openContactModal('${esc(c.id)}')">${ic("plus", 15)} Add contact</button>
  </div>`;
  if (st.list === null) {
    if (!st.loading && !st.error) loadContacts(c.id);
    const body = st.error ? `<div class="card"><div class="empty"><div class="ico">${ic("alert", 22)}</div><b>Couldn't load contacts</b>
         <p>${esc(st.error)}</p><button class="btn primary" onclick="loadContacts('${esc(c.id)}', true)">${ic("clock", 15)} Retry</button></div></div>` : `<div class="card"><div class="empty"><div class="ico">${ic("clock", 22)}</div><b>Loading contacts\u2026</b><p>Fetching from the record.</p></div></div>`;
    return head + body;
  }
  if (!st.list.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic("users", 22)}</div>
      <b>No contacts yet</b><p>Add a parent, guardian, or professional to this record.</p>
      <button class="btn primary" onclick="openContactModal('${esc(c.id)}')">${ic("plus", 15)} Add contact</button></div></div>`;
  }
  const sorted = st.list.slice().sort((a, b) => a.primary === b.primary ? a.lastName.localeCompare(b.lastName) : a.primary ? -1 : 1);
  const cards = sorted.map((ct) => contactCard(c.id, ct)).join("");
  return head + `<div class="contact-grid">${cards}</div>`;
}
function contactCard(cid, ct) {
  const name = (ct.firstName + " " + ct.lastName).trim() || "Unnamed contact";
  const loc = [ct.city, ct.state].filter(Boolean).join(", ");
  const rows = [
    ct.email ? `<div class="c-row">${ic("msg", 14)}<a href="mailto:${esc(ct.email)}">${esc(ct.email)}</a></div>` : "",
    ct.cell ? `<div class="c-row">${ic("bell", 14)}<span>${esc(ct.cell)}</span></div>` : "",
    ct.address || loc ? `<div class="c-row">${ic("map", 14)}<span>${esc([ct.address, loc].filter(Boolean).join(" \xB7 "))}</span></div>` : ""
  ].filter(Boolean).join("");
  return `<div class="card contact-card">
    <div class="cc-top">
      ${avatar(ct.firstName, ct.lastName, 40, 14, ct.photoUrl)}
      <div class="cc-id">
        <div class="cc-name">${esc(name)}${ct.primary ? ' <span class="pill primary"><span class="dot"></span>Primary</span>' : ""}</div>
        <div class="cc-rel">${ct.relationship ? esc(ct.relationship) : '<span style="color:var(--muted-foreground)">No relationship set</span>'}</div>
      </div>
      <div class="cc-acts">
        <button class="ico-mini" title="Edit" onclick="openContactModal('${esc(cid)}','${esc(ct.entryId)}')">${ic("edit", 15)}</button>
        <button class="ico-mini danger" title="Delete" onclick="deleteContactPrompt('${esc(cid)}','${esc(ct.entryId)}')">${ic("trash", 15)}</button>
      </div>
    </div>
    ${rows ? `<div class="cc-body">${rows}</div>` : ""}
  </div>`;
}
const CONTACT_MODAL_FIELDS = [
  { k: "firstName", label: "First name" },
  { k: "lastName", label: "Last name" },
  { k: "relationship", label: "Relationship", type: "relationship", full: true },
  { k: "email", label: "Email", type: "email", placeholder: "name@example.com" },
  { k: "cell", label: "Cell phone", type: "tel", placeholder: "(555) 555-0123" },
  { k: "address", label: "Address", type: "textarea", full: true },
  { k: "city", label: "City" },
  { k: "state", label: "State" },
  { k: "zip", label: "ZIP" },
  { k: "primary", label: "Primary contact", type: "checkbox", full: true }
];
function relationshipControl(current) {
  const opts = relationshipOptions();
  const isOther = !!current && opts.indexOf(current) < 0;
  const sel = isOther ? OTHER_RELATIONSHIP : current || "";
  const choices = [""].concat(opts, [OTHER_RELATIONSHIP]);
  const select = `<select data-k="relationship" data-reln-select onchange="onRelationshipChange(this)">${choices.map((o) => `<option value="${esc(o)}"${o === sel ? " selected" : ""}>${o ? esc(o) : "\u2014"}</option>`).join("")}</select>`;
  const otherText = `<input type="text" data-reln-other placeholder="Specify relationship" autocomplete="off"
    value="${esc(isOther ? current : "")}"${isOther ? "" : " hidden"}>`;
  return `<div class="reln-control">${select}${otherText}</div>`;
}
function onRelationshipChange(sel) {
  const wrap = sel.closest(".reln-control");
  if (!wrap) return;
  const other = wrap.querySelector("[data-reln-other]");
  if (!other) return;
  const show = sel.value === OTHER_RELATIONSHIP;
  other.hidden = !show;
  if (show) other.focus();
}
function contactControl(f, ct) {
  const v = ct ? ct[f.k] : "";
  if (f.type === "relationship") return relationshipControl(v || "");
  if (f.type === "checkbox") {
    return `<label class="chk"><input type="checkbox" data-k="${f.k}"${ct && ct.primary ? " checked" : ""}> ${esc(f.label)}</label>`;
  }
  if (f.type === "textarea") {
    return `<textarea data-k="${f.k}" rows="2" placeholder="${esc(f.placeholder || "")}">${esc(v || "")}</textarea>`;
  }
  const t = f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text";
  return `<input type="${t}" data-k="${f.k}" value="${esc(v || "")}" placeholder="${esc(f.placeholder || "")}" autocomplete="off">`;
}
let CONTACT_PHOTO = { mode: "keep" };
function currentContactPhoto(ct) {
  if (CONTACT_PHOTO.mode === "set") return CONTACT_PHOTO.dataUrl || "";
  if (CONTACT_PHOTO.mode === "remove") return "";
  return ct ? ct.photoUrl : "";
}
function contactPhotoBlock(ct, first, last) {
  const url = currentContactPhoto(ct);
  const inner = url ? `<img src="${esc(url)}" alt="">` : `<span class="ph-initials">${esc(initials(first, last) || "?")}</span>`;
  const has = !!url;
  return `<div class="photo-edit" id="__contactPhotoBlock">
    <div class="photo-frame">${inner}</div>
    <div class="photo-actions">
      <input type="file" accept="image/*" id="__contactPhotoInput" hidden onchange="onContactPhotoPick(this)">
      <div class="photo-btns">
        <button class="btn outline" type="button" onclick="document.getElementById('__contactPhotoInput').click()">${ic("image", 15)} ${has ? "Change photo" : "Add photo"}</button>
        ${has ? `<button class="btn ghost" type="button" onclick="removeContactPhoto()">${ic("trash", 15)} Remove</button>` : ""}
      </div>
      <div class="photo-hint">JPG, PNG, or GIF. Crop &amp; zoom before saving \u2014 applied when you save the contact.</div>
    </div>
  </div>`;
}
function refreshContactPhotoPreview() {
  const block = document.getElementById("__contactPhotoBlock");
  const modal = document.querySelector("#__contactModal .modal-card");
  if (!block || !modal) return;
  const cid = modal.getAttribute("data-cid") || "";
  const entryId = modal.getAttribute("data-entry") || "";
  const st = contactsState(cid);
  const ct = entryId && st.list ? st.list.filter((x) => x.entryId === entryId)[0] || null : null;
  const fn = modal.querySelector('[data-k="firstName"]');
  const ln = modal.querySelector('[data-k="lastName"]');
  block.outerHTML = contactPhotoBlock(ct, fn ? fn.value : ct ? ct.firstName : "", ln ? ln.value : ct ? ct.lastName : "");
}
async function onContactPhotoPick(input) {
  const file = input.files && input.files[0];
  input.value = "";
  if (!file) return;
  if (!/^image\//.test(file.type)) {
    toast("Please choose an image file (JPG, PNG, or GIF).");
    return;
  }
  try {
    const dataUrl = await fileToDataUrl(file);
    openCropper(dataUrl, function(out) {
      CONTACT_PHOTO = { mode: "set", dataUrl: out };
      refreshContactPhotoPreview();
    });
  } catch (e) {
    setContactModalError(e && e.message ? e.message : String(e));
  }
}
function removeContactPhoto() {
  CONTACT_PHOTO = { mode: "remove" };
  refreshContactPhotoPreview();
}
function openContactModal(cid, entryId) {
  if (document.getElementById("__contactModal")) closeContactModal();
  CONTACT_PHOTO = { mode: "keep" };
  const st = contactsState(cid);
  const ct = entryId && st.list ? st.list.filter((x) => x.entryId === entryId)[0] || null : null;
  const editing = !!ct;
  const grid = CONTACT_MODAL_FIELDS.map((f) => {
    if (f.type === "checkbox") return `<div class="field full">${contactControl(f, ct)}</div>`;
    return `<div class="field ${f.full ? "full" : ""}">
      <label>${esc(f.label)}</label>${contactControl(f, ct)}</div>`;
  }).join("");
  const host = document.createElement("div");
  host.className = "modal-overlay";
  host.id = "__contactModal";
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="${editing ? "Edit contact" : "Add contact"}"
      data-cid="${esc(cid)}" data-entry="${esc(entryId || "")}">
    <div class="modal-head">
      <div><b>${editing ? "Edit contact" : "Add contact"}</b><p>${editing ? "Update this contact." : "Add a family member or professional."}</p></div>
      <button class="ico-x" title="Close" onclick="closeContactModal()">${ic("x", 18)}</button>
    </div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      ${contactPhotoBlock(ct, ct ? ct.firstName : "", ct ? ct.lastName : "")}
      <div class="field-grid">${grid}</div>
    </div>
    <div class="modal-foot">
      <span class="modal-status"></span>
      <span style="flex:1"></span>
      <button class="btn ghost" onclick="closeContactModal()">${ic("x", 15)} Cancel</button>
      <button class="btn primary js-save" onclick="saveContact()">${ic("save", 15)} ${editing ? "Save changes" : "Add contact"}</button>
    </div>
  </div>`;
  host.addEventListener("mousedown", (e) => {
    if (e.target === host) closeContactModal();
  });
  document.body.appendChild(host);
  const first = host.querySelector('input[data-k="firstName"]');
  if (first) first.focus();
  document.addEventListener("keydown", contactEscClose);
}
function contactEscClose(e) {
  if (e.key !== "Escape") return;
  if (document.getElementById("__cropModal")) return;
  closeContactModal();
}
function closeContactModal() {
  const m = document.getElementById("__contactModal");
  if (m) m.remove();
  document.removeEventListener("keydown", contactEscClose);
}
function setContactModalError(msg) {
  const el = document.querySelector("#__contactModal .modal-err");
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}
async function saveContact() {
  const modal = document.querySelector("#__contactModal .modal-card");
  if (!modal) return;
  const cid = modal.getAttribute("data-cid") || "";
  const entryId = modal.getAttribute("data-entry") || "";
  if (!cid) {
    setContactModalError("Missing client id.");
    return;
  }
  const fields = {};
  modal.querySelectorAll("[data-k]").forEach((el) => {
    const k = el.dataset.k;
    const input = el;
    if (input.type === "checkbox") fields[k] = input.checked;
    else fields[k] = el.value.trim();
  });
  const relSel = modal.querySelector("[data-reln-select]");
  if (relSel && relSel.value === OTHER_RELATIONSHIP) {
    const otherEl = modal.querySelector("[data-reln-other]");
    const custom = otherEl ? otherEl.value.trim() : "";
    fields.relationship = custom || OTHER_RELATIONSHIP;
  }
  setContactModalError("");
  if (!fields.firstName && !fields.lastName) {
    setContactModalError("Enter at least a first or last name.");
    return;
  }
  const saveBtn = modal.querySelector(".js-save");
  const status = modal.querySelector(".modal-status");
  if (saveBtn) saveBtn.disabled = true;
  if (status) status.textContent = "Saving\u2026";
  try {
    const saved = entryId ? await apiUpdateContact(cid, entryId, fields) : await apiAddContact(cid, fields);
    const savedEntryId = saved && saved.entryId ? String(saved.entryId) : entryId;
    if (savedEntryId && CONTACT_PHOTO.mode === "set" && CONTACT_PHOTO.dataUrl) {
      if (status) status.textContent = "Uploading photo\u2026";
      const dataUrl = CONTACT_PHOTO.dataUrl;
      const comma = dataUrl.indexOf(",");
      const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      await apiSetContactPhoto(cid, savedEntryId, b64, "photo.jpg", "image/jpeg");
    } else if (savedEntryId && CONTACT_PHOTO.mode === "remove") {
      await apiSetContactPhoto(cid, savedEntryId, "", "", "");
    }
    closeContactModal();
    await loadContacts(cid, true);
    toast(entryId ? "Contact updated" : "Contact added");
  } catch (e) {
    if (saveBtn) saveBtn.disabled = false;
    if (status) status.textContent = "";
    setContactModalError(e && e.message ? e.message : String(e));
  }
}
async function deleteContactPrompt(cid, entryId) {
  if (!entryId) return;
  if (!window.confirm("Delete this contact? This can't be undone.")) return;
  try {
    await apiDeleteContact(cid, entryId);
    await loadContacts(cid, true);
    toast("Contact deleted");
  } catch (e) {
    toast("Delete failed: " + (e && e.message ? e.message : String(e)));
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiY29udGFjdHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgY29udGFjdHMudHMgXHUyMDE0IHRoZSBDb250YWN0cyByZWNvcmQgc2VjdGlvbiAobXVsdGktZW50cnksIGxpdmUpLlxuXG4gICBDb250YWN0cyBhcmUgZW50cmllcyBvbiB0aGUgY2xpZW50J3MgYGNvbnRhY3RzYCBNRUYsIHNlcnZlZCBieSB0aGUgbWFlc3Ryb1xuICAgKGxpc3RDb250YWN0cy9hZGRDb250YWN0L3VwZGF0ZUNvbnRhY3QvZGVsZXRlQ29udGFjdCkuIEVhY2ggY29udGFjdCBjYXJyaWVzXG4gICBhbiBgZW50cnlJZGAgdXNlZCB0byB0YXJnZXQgZWRpdHMvZGVsZXRlcy4gVGhlIGByZWxhdGlvbnNoaXBgIGZpZWxkIGlzIGFcbiAgIGZyZWUtdGV4dCBzdG9yZSB3aG9zZSBkcm9wZG93biBjaG9pY2VzIGNvbWUgZnJvbSBvcmcgU2V0dGluZ3NcbiAgIChzZXR0aW5ncy5jb250YWN0cy5yZWxhdGlvbnNoaXBzKSB3aXRoIGEgYnVpbHQtaW4gZmFsbGJhY2sgXHUyMDE0IHNlZSBhcGkudHNcbiAgIHJlbGF0aW9uc2hpcE9wdGlvbnMoKS4gVGhlIGNob3NlbiBsYWJlbCBpcyBzdG9yZWQgdmVyYmF0aW0uXG5cbiAgIFBlciB0aGUgbWVyZ2UtcmVwb3J0IGdvdGNoYSwgaW5qZWN0ZWQgY29udHJvbHMgdXNlIGRhdGEtaywgbmV2ZXIgYG5hbWVgLlxuICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbmludGVyZmFjZSBMaXZlQ29udGFjdCB7XG4gIGVudHJ5SWQ6IHN0cmluZztcbiAgZmlyc3ROYW1lOiBzdHJpbmc7IGxhc3ROYW1lOiBzdHJpbmc7IHJlbGF0aW9uc2hpcDogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nOyBjZWxsOiBzdHJpbmc7IHByaW1hcnk6IGJvb2xlYW47XG4gIGFkZHJlc3M6IHN0cmluZzsgY2l0eTogc3RyaW5nOyBzdGF0ZTogc3RyaW5nOyB6aXA6IHN0cmluZztcbiAgcGhvdG9Vcmw6IHN0cmluZztcbn1cblxuLy8gUGVyLWNsaWVudCBjb250YWN0cyBjYWNoZSBzbyB0aGUgc2VjdGlvbiBkb2Vzbid0IHJlZmV0Y2ggb24gZXZlcnkgcmVuZGVyLlxuaW50ZXJmYWNlIENvbnRhY3RzU3RhdGUgeyBsaXN0OiBMaXZlQ29udGFjdFtdIHwgbnVsbDsgbG9hZGluZzogYm9vbGVhbjsgZXJyb3I6IHN0cmluZyB8IG51bGw7IH1cbmNvbnN0IENPTlRBQ1RTX0NBQ0hFOiB7IFtjbGllbnRJZDogc3RyaW5nXTogQ29udGFjdHNTdGF0ZSB9ID0ge307XG5cbmZ1bmN0aW9uIGNvbnRhY3RzU3RhdGUoY2lkOiBzdHJpbmcpOiBDb250YWN0c1N0YXRlIHtcbiAgaWYgKCFDT05UQUNUU19DQUNIRVtjaWRdKSBDT05UQUNUU19DQUNIRVtjaWRdID0geyBsaXN0OiBudWxsLCBsb2FkaW5nOiBmYWxzZSwgZXJyb3I6IG51bGwgfTtcbiAgcmV0dXJuIENPTlRBQ1RTX0NBQ0hFW2NpZF07XG59XG5cbi8vIExvYWQgKG9yIHJlbG9hZCkgYSBjbGllbnQncyBjb250YWN0cywgdGhlbiByZS1yZW5kZXIuXG5hc3luYyBmdW5jdGlvbiBsb2FkQ29udGFjdHMoY2lkOiBzdHJpbmcsIGZvcmNlID0gZmFsc2UpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgc3QgPSBjb250YWN0c1N0YXRlKGNpZCk7XG4gIGlmIChzdC5sb2FkaW5nKSByZXR1cm47XG4gIGlmIChzdC5saXN0ICYmICFmb3JjZSkgcmV0dXJuO1xuICBzdC5sb2FkaW5nID0gdHJ1ZTsgc3QuZXJyb3IgPSBudWxsO1xuICB0cnkge1xuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCBhcGlMaXN0Q29udGFjdHMoY2lkKTtcbiAgICBzdC5saXN0ID0gKEFycmF5LmlzQXJyYXkocm93cykgPyByb3dzIDogW10pLm1hcChub3JtYWxpemVDb250YWN0KTtcbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgc3QuZXJyb3IgPSBlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKTtcbiAgICBzdC5saXN0ID0gbnVsbDtcbiAgfSBmaW5hbGx5IHtcbiAgICBzdC5sb2FkaW5nID0gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiByZW5kZXIgPT09ICdmdW5jdGlvbicpIHJlbmRlcigpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUNvbnRhY3QocjogYW55KTogTGl2ZUNvbnRhY3Qge1xuICByZXR1cm4ge1xuICAgIGVudHJ5SWQ6IFN0cmluZyhyLmVudHJ5SWQgfHwgJycpLFxuICAgIGZpcnN0TmFtZTogci5maXJzdE5hbWUgfHwgJycsIGxhc3ROYW1lOiByLmxhc3ROYW1lIHx8ICcnLCByZWxhdGlvbnNoaXA6IHIucmVsYXRpb25zaGlwIHx8ICcnLFxuICAgIGVtYWlsOiByLmVtYWlsIHx8ICcnLCBjZWxsOiByLmNlbGwgfHwgJycsIHByaW1hcnk6IHIucHJpbWFyeSA9PT0gdHJ1ZSxcbiAgICBhZGRyZXNzOiByLmFkZHJlc3MgfHwgJycsIGNpdHk6IHIuY2l0eSB8fCAnJywgc3RhdGU6IHIuc3RhdGUgfHwgJycsIHppcDogci56aXAgfHwgJycsXG4gICAgcGhvdG9Vcmw6IHIucGhvdG8gfHwgJycsXG4gIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBzZWN0aW9uIHZpZXcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5mdW5jdGlvbiBjb250YWN0c1NlY3Rpb24oYzogQ2xpZW50KTogc3RyaW5nIHtcbiAgY29uc3Qgc3QgPSBjb250YWN0c1N0YXRlKGMuaWQpO1xuICAvLyBTZXR0aW5ncyBkcml2ZXMgdGhlIHJlbGF0aW9uc2hpcCBkcm9wZG93biBpbiB0aGUgbW9kYWwgXHUyMDE0IG1ha2Ugc3VyZSBpdCBsb2Fkcy5cbiAgaWYgKCFTRVRUSU5HUyAmJiAhU0VUVElOR1NfTE9BRElORykgbG9hZFNldHRpbmdzKCk7XG5cbiAgY29uc3QgaGVhZCA9IGA8ZGl2IGNsYXNzPVwic2VjdGlvbi1oZWFkXCI+XG4gICAgPGRpdj48aDM+Q29udGFjdHM8L2gzPjxwPkZhbWlseSwgZ3VhcmRpYW5zLCBhbmQgdGhlIHRyZWF0bWVudCB0ZWFtIGZvciAke2VzYyhjLmZpcnN0KX0uPC9wPjwvZGl2PlxuICAgIDxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeVwiIG9uY2xpY2s9XCJvcGVuQ29udGFjdE1vZGFsKCcke2VzYyhjLmlkKX0nKVwiPiR7aWMoJ3BsdXMnLCAxNSl9IEFkZCBjb250YWN0PC9idXR0b24+XG4gIDwvZGl2PmA7XG5cbiAgaWYgKHN0Lmxpc3QgPT09IG51bGwpIHtcbiAgICBpZiAoIXN0LmxvYWRpbmcgJiYgIXN0LmVycm9yKSBsb2FkQ29udGFjdHMoYy5pZCk7XG4gICAgY29uc3QgYm9keSA9IHN0LmVycm9yXG4gICAgICA/IGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdhbGVydCcsIDIyKX08L2Rpdj48Yj5Db3VsZG4ndCBsb2FkIGNvbnRhY3RzPC9iPlxuICAgICAgICAgPHA+JHtlc2Moc3QuZXJyb3IpfTwvcD48YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnlcIiBvbmNsaWNrPVwibG9hZENvbnRhY3RzKCcke2VzYyhjLmlkKX0nLCB0cnVlKVwiPiR7aWMoJ2Nsb2NrJywgMTUpfSBSZXRyeTwvYnV0dG9uPjwvZGl2PjwvZGl2PmBcbiAgICAgIDogYDxkaXYgY2xhc3M9XCJjYXJkXCI+PGRpdiBjbGFzcz1cImVtcHR5XCI+PGRpdiBjbGFzcz1cImljb1wiPiR7aWMoJ2Nsb2NrJywgMjIpfTwvZGl2PjxiPkxvYWRpbmcgY29udGFjdHNcdTIwMjY8L2I+PHA+RmV0Y2hpbmcgZnJvbSB0aGUgcmVjb3JkLjwvcD48L2Rpdj48L2Rpdj5gO1xuICAgIHJldHVybiBoZWFkICsgYm9keTtcbiAgfVxuXG4gIGlmICghc3QubGlzdC5sZW5ndGgpIHtcbiAgICByZXR1cm4gaGVhZCArIGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCd1c2VycycsIDIyKX08L2Rpdj5cbiAgICAgIDxiPk5vIGNvbnRhY3RzIHlldDwvYj48cD5BZGQgYSBwYXJlbnQsIGd1YXJkaWFuLCBvciBwcm9mZXNzaW9uYWwgdG8gdGhpcyByZWNvcmQuPC9wPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBwcmltYXJ5XCIgb25jbGljaz1cIm9wZW5Db250YWN0TW9kYWwoJyR7ZXNjKGMuaWQpfScpXCI+JHtpYygncGx1cycsIDE1KX0gQWRkIGNvbnRhY3Q8L2J1dHRvbj48L2Rpdj48L2Rpdj5gO1xuICB9XG5cbiAgLy8gUHJpbWFyeSBmaXJzdCwgdGhlbiBhbHBoYWJldGljYWwgYnkgbGFzdCBuYW1lLlxuICBjb25zdCBzb3J0ZWQgPSBzdC5saXN0LnNsaWNlKCkuc29ydCgoYSwgYikgPT5cbiAgICAoYS5wcmltYXJ5ID09PSBiLnByaW1hcnkpID8gYS5sYXN0TmFtZS5sb2NhbGVDb21wYXJlKGIubGFzdE5hbWUpIDogKGEucHJpbWFyeSA/IC0xIDogMSkpO1xuICBjb25zdCBjYXJkcyA9IHNvcnRlZC5tYXAoY3QgPT4gY29udGFjdENhcmQoYy5pZCwgY3QpKS5qb2luKCcnKTtcbiAgcmV0dXJuIGhlYWQgKyBgPGRpdiBjbGFzcz1cImNvbnRhY3QtZ3JpZFwiPiR7Y2FyZHN9PC9kaXY+YDtcbn1cblxuZnVuY3Rpb24gY29udGFjdENhcmQoY2lkOiBzdHJpbmcsIGN0OiBMaXZlQ29udGFjdCk6IHN0cmluZyB7XG4gIGNvbnN0IG5hbWUgPSAoY3QuZmlyc3ROYW1lICsgJyAnICsgY3QubGFzdE5hbWUpLnRyaW0oKSB8fCAnVW5uYW1lZCBjb250YWN0JztcbiAgY29uc3QgbG9jID0gW2N0LmNpdHksIGN0LnN0YXRlXS5maWx0ZXIoQm9vbGVhbikuam9pbignLCAnKTtcbiAgY29uc3Qgcm93cyA9IFtcbiAgICBjdC5lbWFpbCA/IGA8ZGl2IGNsYXNzPVwiYy1yb3dcIj4ke2ljKCdtc2cnLCAxNCl9PGEgaHJlZj1cIm1haWx0bzoke2VzYyhjdC5lbWFpbCl9XCI+JHtlc2MoY3QuZW1haWwpfTwvYT48L2Rpdj5gIDogJycsXG4gICAgY3QuY2VsbCA/IGA8ZGl2IGNsYXNzPVwiYy1yb3dcIj4ke2ljKCdiZWxsJywgMTQpfTxzcGFuPiR7ZXNjKGN0LmNlbGwpfTwvc3Bhbj48L2Rpdj5gIDogJycsXG4gICAgKGN0LmFkZHJlc3MgfHwgbG9jKSA/IGA8ZGl2IGNsYXNzPVwiYy1yb3dcIj4ke2ljKCdtYXAnLCAxNCl9PHNwYW4+JHtlc2MoW2N0LmFkZHJlc3MsIGxvY10uZmlsdGVyKEJvb2xlYW4pLmpvaW4oJyBcdTAwQjcgJykpfTwvc3Bhbj48L2Rpdj5gIDogJycsXG4gIF0uZmlsdGVyKEJvb2xlYW4pLmpvaW4oJycpO1xuXG4gIHJldHVybiBgPGRpdiBjbGFzcz1cImNhcmQgY29udGFjdC1jYXJkXCI+XG4gICAgPGRpdiBjbGFzcz1cImNjLXRvcFwiPlxuICAgICAgJHthdmF0YXIoY3QuZmlyc3ROYW1lLCBjdC5sYXN0TmFtZSwgNDAsIDE0LCBjdC5waG90b1VybCl9XG4gICAgICA8ZGl2IGNsYXNzPVwiY2MtaWRcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImNjLW5hbWVcIj4ke2VzYyhuYW1lKX0ke2N0LnByaW1hcnkgPyAnIDxzcGFuIGNsYXNzPVwicGlsbCBwcmltYXJ5XCI+PHNwYW4gY2xhc3M9XCJkb3RcIj48L3NwYW4+UHJpbWFyeTwvc3Bhbj4nIDogJyd9PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJjYy1yZWxcIj4ke2N0LnJlbGF0aW9uc2hpcCA/IGVzYyhjdC5yZWxhdGlvbnNoaXApIDogJzxzcGFuIHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQtZm9yZWdyb3VuZClcIj5ObyByZWxhdGlvbnNoaXAgc2V0PC9zcGFuPid9PC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJjYy1hY3RzXCI+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJpY28tbWluaVwiIHRpdGxlPVwiRWRpdFwiIG9uY2xpY2s9XCJvcGVuQ29udGFjdE1vZGFsKCcke2VzYyhjaWQpfScsJyR7ZXNjKGN0LmVudHJ5SWQpfScpXCI+JHtpYygnZWRpdCcsIDE1KX08L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImljby1taW5pIGRhbmdlclwiIHRpdGxlPVwiRGVsZXRlXCIgb25jbGljaz1cImRlbGV0ZUNvbnRhY3RQcm9tcHQoJyR7ZXNjKGNpZCl9JywnJHtlc2MoY3QuZW50cnlJZCl9JylcIj4ke2ljKCd0cmFzaCcsIDE1KX08L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICAgICR7cm93cyA/IGA8ZGl2IGNsYXNzPVwiY2MtYm9keVwiPiR7cm93c308L2Rpdj5gIDogJyd9XG4gIDwvZGl2PmA7XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBhZGQgLyBlZGl0IG1vZGFsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuaW50ZXJmYWNlIENvbnRhY3RGaWVsZERlZiB7IGs6IHN0cmluZzsgbGFiZWw6IHN0cmluZzsgdHlwZT86ICd0ZXh0JyB8ICdlbWFpbCcgfCAndGVsJyB8ICd0ZXh0YXJlYScgfCAncmVsYXRpb25zaGlwJyB8ICdjaGVja2JveCc7IGZ1bGw/OiBib29sZWFuOyBwbGFjZWhvbGRlcj86IHN0cmluZzsgfVxuY29uc3QgQ09OVEFDVF9NT0RBTF9GSUVMRFM6IENvbnRhY3RGaWVsZERlZltdID0gW1xuICB7IGs6ICdmaXJzdE5hbWUnLCBsYWJlbDogJ0ZpcnN0IG5hbWUnIH0sXG4gIHsgazogJ2xhc3ROYW1lJywgbGFiZWw6ICdMYXN0IG5hbWUnIH0sXG4gIHsgazogJ3JlbGF0aW9uc2hpcCcsIGxhYmVsOiAnUmVsYXRpb25zaGlwJywgdHlwZTogJ3JlbGF0aW9uc2hpcCcsIGZ1bGw6IHRydWUgfSxcbiAgeyBrOiAnZW1haWwnLCBsYWJlbDogJ0VtYWlsJywgdHlwZTogJ2VtYWlsJywgcGxhY2Vob2xkZXI6ICduYW1lQGV4YW1wbGUuY29tJyB9LFxuICB7IGs6ICdjZWxsJywgbGFiZWw6ICdDZWxsIHBob25lJywgdHlwZTogJ3RlbCcsIHBsYWNlaG9sZGVyOiAnKDU1NSkgNTU1LTAxMjMnIH0sXG4gIHsgazogJ2FkZHJlc3MnLCBsYWJlbDogJ0FkZHJlc3MnLCB0eXBlOiAndGV4dGFyZWEnLCBmdWxsOiB0cnVlIH0sXG4gIHsgazogJ2NpdHknLCBsYWJlbDogJ0NpdHknIH0sXG4gIHsgazogJ3N0YXRlJywgbGFiZWw6ICdTdGF0ZScgfSxcbiAgeyBrOiAnemlwJywgbGFiZWw6ICdaSVAnIH0sXG4gIHsgazogJ3ByaW1hcnknLCBsYWJlbDogJ1ByaW1hcnkgY29udGFjdCcsIHR5cGU6ICdjaGVja2JveCcsIGZ1bGw6IHRydWUgfSxcbl07XG5cbi8vIFJlbGF0aW9uc2hpcCBjb250cm9sOiBhIDxzZWxlY3Q+IGZlZCBieSBzZXR0aW5ncyB3aXRoIGEgaGFyZC1jb2RlZCwgYWx3YXlzLWxhc3Rcbi8vIFwiT3RoZXJcIiBvcHRpb24uIElmIHRoZSBzdG9yZWQgdmFsdWUgaXNuJ3QgYSBsaXN0IG9wdGlvbiAobGVnYWN5IC8gZnJlZS10eXBlZCksXG4vLyBpdCdzIHRyZWF0ZWQgYXMgT3RoZXIgYW5kIHRoZSB0ZXh0IGJveCBpcyBwcmVmaWxsZWQuIFNlbGVjdGluZyBPdGhlciByZXZlYWxzXG4vLyB0aGUgXCJTcGVjaWZ5IHJlbGF0aW9uc2hpcFwiIGJveDsgaXRzIHRleHQgaXMgd2hhdCBnZXRzIHN0b3JlZCAoc2VlIHNhdmVDb250YWN0KS5cbmZ1bmN0aW9uIHJlbGF0aW9uc2hpcENvbnRyb2woY3VycmVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3Qgb3B0cyA9IHJlbGF0aW9uc2hpcE9wdGlvbnMoKTtcbiAgY29uc3QgaXNPdGhlciA9ICEhY3VycmVudCAmJiBvcHRzLmluZGV4T2YoY3VycmVudCkgPCAwO1xuICBjb25zdCBzZWwgPSBpc090aGVyID8gT1RIRVJfUkVMQVRJT05TSElQIDogKGN1cnJlbnQgfHwgJycpO1xuICBjb25zdCBjaG9pY2VzID0gWycnXS5jb25jYXQob3B0cywgW09USEVSX1JFTEFUSU9OU0hJUF0pO1xuICBjb25zdCBzZWxlY3QgPSBgPHNlbGVjdCBkYXRhLWs9XCJyZWxhdGlvbnNoaXBcIiBkYXRhLXJlbG4tc2VsZWN0IG9uY2hhbmdlPVwib25SZWxhdGlvbnNoaXBDaGFuZ2UodGhpcylcIj4ke2Nob2ljZXMubWFwKG8gPT5cbiAgICBgPG9wdGlvbiB2YWx1ZT1cIiR7ZXNjKG8pfVwiJHtvID09PSBzZWwgPyAnIHNlbGVjdGVkJyA6ICcnfT4ke28gPyBlc2MobykgOiAnXHUyMDE0J308L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD5gO1xuICBjb25zdCBvdGhlclRleHQgPSBgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgZGF0YS1yZWxuLW90aGVyIHBsYWNlaG9sZGVyPVwiU3BlY2lmeSByZWxhdGlvbnNoaXBcIiBhdXRvY29tcGxldGU9XCJvZmZcIlxuICAgIHZhbHVlPVwiJHtlc2MoaXNPdGhlciA/IGN1cnJlbnQgOiAnJyl9XCIke2lzT3RoZXIgPyAnJyA6ICcgaGlkZGVuJ30+YDtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwicmVsbi1jb250cm9sXCI+JHtzZWxlY3R9JHtvdGhlclRleHR9PC9kaXY+YDtcbn1cblxuLy8gU2hvdy9oaWRlIHRoZSBmcmVlLXRleHQgYm94IGFzIHRoZSByZWxhdGlvbnNoaXAgc2VsZWN0IGNoYW5nZXMuXG5mdW5jdGlvbiBvblJlbGF0aW9uc2hpcENoYW5nZShzZWw6IEhUTUxTZWxlY3RFbGVtZW50KTogdm9pZCB7XG4gIGNvbnN0IHdyYXAgPSBzZWwuY2xvc2VzdCgnLnJlbG4tY29udHJvbCcpO1xuICBpZiAoIXdyYXApIHJldHVybjtcbiAgY29uc3Qgb3RoZXIgPSB3cmFwLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXJlbG4tb3RoZXJdJykgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XG4gIGlmICghb3RoZXIpIHJldHVybjtcbiAgY29uc3Qgc2hvdyA9IHNlbC52YWx1ZSA9PT0gT1RIRVJfUkVMQVRJT05TSElQO1xuICBvdGhlci5oaWRkZW4gPSAhc2hvdztcbiAgaWYgKHNob3cpIG90aGVyLmZvY3VzKCk7XG59XG5cbmZ1bmN0aW9uIGNvbnRhY3RDb250cm9sKGY6IENvbnRhY3RGaWVsZERlZiwgY3Q6IExpdmVDb250YWN0IHwgbnVsbCk6IHN0cmluZyB7XG4gIGNvbnN0IHYgPSBjdCA/IChjdCBhcyBhbnkpW2Yua10gOiAnJztcbiAgaWYgKGYudHlwZSA9PT0gJ3JlbGF0aW9uc2hpcCcpIHJldHVybiByZWxhdGlvbnNoaXBDb250cm9sKHYgfHwgJycpO1xuICBpZiAoZi50eXBlID09PSAnY2hlY2tib3gnKSB7XG4gICAgcmV0dXJuIGA8bGFiZWwgY2xhc3M9XCJjaGtcIj48aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgZGF0YS1rPVwiJHtmLmt9XCIke2N0ICYmIGN0LnByaW1hcnkgPyAnIGNoZWNrZWQnIDogJyd9PiAke2VzYyhmLmxhYmVsKX08L2xhYmVsPmA7XG4gIH1cbiAgaWYgKGYudHlwZSA9PT0gJ3RleHRhcmVhJykge1xuICAgIHJldHVybiBgPHRleHRhcmVhIGRhdGEtaz1cIiR7Zi5rfVwiIHJvd3M9XCIyXCIgcGxhY2Vob2xkZXI9XCIke2VzYyhmLnBsYWNlaG9sZGVyIHx8ICcnKX1cIj4ke2VzYyh2IHx8ICcnKX08L3RleHRhcmVhPmA7XG4gIH1cbiAgY29uc3QgdCA9IGYudHlwZSA9PT0gJ2VtYWlsJyA/ICdlbWFpbCcgOiBmLnR5cGUgPT09ICd0ZWwnID8gJ3RlbCcgOiAndGV4dCc7XG4gIHJldHVybiBgPGlucHV0IHR5cGU9XCIke3R9XCIgZGF0YS1rPVwiJHtmLmt9XCIgdmFsdWU9XCIke2VzYyh2IHx8ICcnKX1cIiBwbGFjZWhvbGRlcj1cIiR7ZXNjKGYucGxhY2Vob2xkZXIgfHwgJycpfVwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiPmA7XG59XG5cbi8qIC0tLS0gY29udGFjdCBwaG90byAoYnVmZmVyZWQsIGFwcGxpZWQgb24gU2F2ZSkgLS0tLVxuICAgQSBjb250YWN0J3MgcGhvdG8gaXMgYSBEb2N1bWVudExpbmtGaWVsZCBvbiB0aGUgZW50cnksIHNvIGEgTkVXIGNvbnRhY3QgaGFzIG5vXG4gICBlbnRyeSB0byBhdHRhY2ggdG8gdW50aWwgaXQncyBzYXZlZC4gV2UgdGhlcmVmb3JlIGJ1ZmZlciB0aGUgY3JvcHBlZCBpbWFnZSAob3JcbiAgIGEgcmVtb3ZlIGZsYWcpIGluIENPTlRBQ1RfUEhPVE8gYW5kIGFwcGx5IGl0IGluIHNhdmVDb250YWN0IG9uY2UgdGhlIGVudHJ5IGlkXG4gICBpcyBrbm93biBcdTIwMTQgdW5pZm9ybSBmb3IgYm90aCBhZGQgYW5kIGVkaXQuIG1vZGU6ICdrZWVwJyA9IG5vIGNoYW5nZS4gKi9cbmludGVyZmFjZSBDb250YWN0UGhvdG9TdGF0ZSB7IG1vZGU6ICdrZWVwJyB8ICdzZXQnIHwgJ3JlbW92ZSc7IGRhdGFVcmw/OiBzdHJpbmc7IH1cbmxldCBDT05UQUNUX1BIT1RPOiBDb250YWN0UGhvdG9TdGF0ZSA9IHsgbW9kZTogJ2tlZXAnIH07XG5cbi8vIFRoZSBwaG90byBVUkwgdG8gcHJldmlldyByaWdodCBub3cgKGJ1ZmZlcmVkIGNoYW5nZSB3aW5zIG92ZXIgdGhlIHNhdmVkIHZhbHVlKS5cbmZ1bmN0aW9uIGN1cnJlbnRDb250YWN0UGhvdG8oY3Q6IExpdmVDb250YWN0IHwgbnVsbCk6IHN0cmluZyB7XG4gIGlmIChDT05UQUNUX1BIT1RPLm1vZGUgPT09ICdzZXQnKSByZXR1cm4gQ09OVEFDVF9QSE9UTy5kYXRhVXJsIHx8ICcnO1xuICBpZiAoQ09OVEFDVF9QSE9UTy5tb2RlID09PSAncmVtb3ZlJykgcmV0dXJuICcnO1xuICByZXR1cm4gY3QgPyBjdC5waG90b1VybCA6ICcnO1xufVxuXG5mdW5jdGlvbiBjb250YWN0UGhvdG9CbG9jayhjdDogTGl2ZUNvbnRhY3QgfCBudWxsLCBmaXJzdDogc3RyaW5nLCBsYXN0OiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCB1cmwgPSBjdXJyZW50Q29udGFjdFBob3RvKGN0KTtcbiAgY29uc3QgaW5uZXIgPSB1cmwgPyBgPGltZyBzcmM9XCIke2VzYyh1cmwpfVwiIGFsdD1cIlwiPmAgOiBgPHNwYW4gY2xhc3M9XCJwaC1pbml0aWFsc1wiPiR7ZXNjKGluaXRpYWxzKGZpcnN0LCBsYXN0KSB8fCAnPycpfTwvc3Bhbj5gO1xuICBjb25zdCBoYXMgPSAhIXVybDtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwicGhvdG8tZWRpdFwiIGlkPVwiX19jb250YWN0UGhvdG9CbG9ja1wiPlxuICAgIDxkaXYgY2xhc3M9XCJwaG90by1mcmFtZVwiPiR7aW5uZXJ9PC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cInBob3RvLWFjdGlvbnNcIj5cbiAgICAgIDxpbnB1dCB0eXBlPVwiZmlsZVwiIGFjY2VwdD1cImltYWdlLypcIiBpZD1cIl9fY29udGFjdFBob3RvSW5wdXRcIiBoaWRkZW4gb25jaGFuZ2U9XCJvbkNvbnRhY3RQaG90b1BpY2sodGhpcylcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJwaG90by1idG5zXCI+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gb3V0bGluZVwiIHR5cGU9XCJidXR0b25cIiBvbmNsaWNrPVwiZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fY29udGFjdFBob3RvSW5wdXQnKS5jbGljaygpXCI+JHtpYygnaW1hZ2UnLCAxNSl9ICR7aGFzID8gJ0NoYW5nZSBwaG90bycgOiAnQWRkIHBob3RvJ308L2J1dHRvbj5cbiAgICAgICAgJHtoYXMgPyBgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHR5cGU9XCJidXR0b25cIiBvbmNsaWNrPVwicmVtb3ZlQ29udGFjdFBob3RvKClcIj4ke2ljKCd0cmFzaCcsIDE1KX0gUmVtb3ZlPC9idXR0b24+YCA6ICcnfVxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwicGhvdG8taGludFwiPkpQRywgUE5HLCBvciBHSUYuIENyb3AgJmFtcDsgem9vbSBiZWZvcmUgc2F2aW5nIFx1MjAxNCBhcHBsaWVkIHdoZW4geW91IHNhdmUgdGhlIGNvbnRhY3QuPC9kaXY+XG4gICAgPC9kaXY+XG4gIDwvZGl2PmA7XG59XG5cbi8vIFJlYnVpbGQganVzdCB0aGUgcGhvdG8gYmxvY2sgKGFmdGVyIGNyb3AgLyByZW1vdmUpLCB1c2luZyBsaXZlIG5hbWUgaW5wdXRzLlxuZnVuY3Rpb24gcmVmcmVzaENvbnRhY3RQaG90b1ByZXZpZXcoKTogdm9pZCB7XG4gIGNvbnN0IGJsb2NrID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fY29udGFjdFBob3RvQmxvY2snKTtcbiAgY29uc3QgbW9kYWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjX19jb250YWN0TW9kYWwgLm1vZGFsLWNhcmQnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmICghYmxvY2sgfHwgIW1vZGFsKSByZXR1cm47XG4gIGNvbnN0IGNpZCA9IG1vZGFsLmdldEF0dHJpYnV0ZSgnZGF0YS1jaWQnKSB8fCAnJztcbiAgY29uc3QgZW50cnlJZCA9IG1vZGFsLmdldEF0dHJpYnV0ZSgnZGF0YS1lbnRyeScpIHx8ICcnO1xuICBjb25zdCBzdCA9IGNvbnRhY3RzU3RhdGUoY2lkKTtcbiAgY29uc3QgY3QgPSBlbnRyeUlkICYmIHN0Lmxpc3QgPyAoc3QubGlzdC5maWx0ZXIoeCA9PiB4LmVudHJ5SWQgPT09IGVudHJ5SWQpWzBdIHx8IG51bGwpIDogbnVsbDtcbiAgY29uc3QgZm4gPSAobW9kYWwucXVlcnlTZWxlY3RvcignW2RhdGEtaz1cImZpcnN0TmFtZVwiXScpIGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsKTtcbiAgY29uc3QgbG4gPSAobW9kYWwucXVlcnlTZWxlY3RvcignW2RhdGEtaz1cImxhc3ROYW1lXCJdJykgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGwpO1xuICBibG9jay5vdXRlckhUTUwgPSBjb250YWN0UGhvdG9CbG9jayhjdCwgZm4gPyBmbi52YWx1ZSA6IChjdCA/IGN0LmZpcnN0TmFtZSA6ICcnKSwgbG4gPyBsbi52YWx1ZSA6IChjdCA/IGN0Lmxhc3ROYW1lIDogJycpKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gb25Db250YWN0UGhvdG9QaWNrKGlucHV0OiBIVE1MSW5wdXRFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGZpbGUgPSBpbnB1dC5maWxlcyAmJiBpbnB1dC5maWxlc1swXTtcbiAgaW5wdXQudmFsdWUgPSAnJztcbiAgaWYgKCFmaWxlKSByZXR1cm47XG4gIGlmICghL15pbWFnZVxcLy8udGVzdChmaWxlLnR5cGUpKSB7IHRvYXN0KCdQbGVhc2UgY2hvb3NlIGFuIGltYWdlIGZpbGUgKEpQRywgUE5HLCBvciBHSUYpLicpOyByZXR1cm47IH1cbiAgdHJ5IHtcbiAgICBjb25zdCBkYXRhVXJsID0gYXdhaXQgZmlsZVRvRGF0YVVybChmaWxlKTsgLy8gc2hhcmVkIGhlbHBlciBmcm9tIGZvcm1lZGl0LnRzXG4gICAgb3BlbkNyb3BwZXIoZGF0YVVybCwgZnVuY3Rpb24gKG91dCkgeyBDT05UQUNUX1BIT1RPID0geyBtb2RlOiAnc2V0JywgZGF0YVVybDogb3V0IH07IHJlZnJlc2hDb250YWN0UGhvdG9QcmV2aWV3KCk7IH0pO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBzZXRDb250YWN0TW9kYWxFcnJvcihlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlQ29udGFjdFBob3RvKCk6IHZvaWQge1xuICBDT05UQUNUX1BIT1RPID0geyBtb2RlOiAncmVtb3ZlJyB9O1xuICByZWZyZXNoQ29udGFjdFBob3RvUHJldmlldygpO1xufVxuXG5mdW5jdGlvbiBvcGVuQ29udGFjdE1vZGFsKGNpZDogc3RyaW5nLCBlbnRyeUlkPzogc3RyaW5nKTogdm9pZCB7XG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19jb250YWN0TW9kYWwnKSkgY2xvc2VDb250YWN0TW9kYWwoKTtcbiAgQ09OVEFDVF9QSE9UTyA9IHsgbW9kZTogJ2tlZXAnIH07IC8vIHJlc2V0IGJ1ZmZlcmVkIHBob3RvIGZvciB0aGlzIG1vZGFsIHNlc3Npb25cbiAgY29uc3Qgc3QgPSBjb250YWN0c1N0YXRlKGNpZCk7XG4gIGNvbnN0IGN0ID0gZW50cnlJZCAmJiBzdC5saXN0ID8gKHN0Lmxpc3QuZmlsdGVyKHggPT4geC5lbnRyeUlkID09PSBlbnRyeUlkKVswXSB8fCBudWxsKSA6IG51bGw7XG4gIGNvbnN0IGVkaXRpbmcgPSAhIWN0O1xuXG4gIGNvbnN0IGdyaWQgPSBDT05UQUNUX01PREFMX0ZJRUxEUy5tYXAoZiA9PiB7XG4gICAgaWYgKGYudHlwZSA9PT0gJ2NoZWNrYm94JykgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiZmllbGQgZnVsbFwiPiR7Y29udGFjdENvbnRyb2woZiwgY3QpfTwvZGl2PmA7XG4gICAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiZmllbGQgJHtmLmZ1bGwgPyAnZnVsbCcgOiAnJ31cIj5cbiAgICAgIDxsYWJlbD4ke2VzYyhmLmxhYmVsKX08L2xhYmVsPiR7Y29udGFjdENvbnRyb2woZiwgY3QpfTwvZGl2PmA7XG4gIH0pLmpvaW4oJycpO1xuXG4gIGNvbnN0IGhvc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgaG9zdC5jbGFzc05hbWUgPSAnbW9kYWwtb3ZlcmxheSc7XG4gIGhvc3QuaWQgPSAnX19jb250YWN0TW9kYWwnO1xuICBob3N0LmlubmVySFRNTCA9IGA8ZGl2IGNsYXNzPVwibW9kYWwtY2FyZFwiIHJvbGU9XCJkaWFsb2dcIiBhcmlhLW1vZGFsPVwidHJ1ZVwiIGFyaWEtbGFiZWw9XCIke2VkaXRpbmcgPyAnRWRpdCBjb250YWN0JyA6ICdBZGQgY29udGFjdCd9XCJcbiAgICAgIGRhdGEtY2lkPVwiJHtlc2MoY2lkKX1cIiBkYXRhLWVudHJ5PVwiJHtlc2MoZW50cnlJZCB8fCAnJyl9XCI+XG4gICAgPGRpdiBjbGFzcz1cIm1vZGFsLWhlYWRcIj5cbiAgICAgIDxkaXY+PGI+JHtlZGl0aW5nID8gJ0VkaXQgY29udGFjdCcgOiAnQWRkIGNvbnRhY3QnfTwvYj48cD4ke2VkaXRpbmcgPyAnVXBkYXRlIHRoaXMgY29udGFjdC4nIDogJ0FkZCBhIGZhbWlseSBtZW1iZXIgb3IgcHJvZmVzc2lvbmFsLid9PC9wPjwvZGl2PlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImljby14XCIgdGl0bGU9XCJDbG9zZVwiIG9uY2xpY2s9XCJjbG9zZUNvbnRhY3RNb2RhbCgpXCI+JHtpYygneCcsIDE4KX08L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwibW9kYWwtYm9keVwiPlxuICAgICAgPGRpdiBjbGFzcz1cIm1vZGFsLWVyclwiIGhpZGRlbj48L2Rpdj5cbiAgICAgICR7Y29udGFjdFBob3RvQmxvY2soY3QsIGN0ID8gY3QuZmlyc3ROYW1lIDogJycsIGN0ID8gY3QubGFzdE5hbWUgOiAnJyl9XG4gICAgICA8ZGl2IGNsYXNzPVwiZmllbGQtZ3JpZFwiPiR7Z3JpZH08L2Rpdj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwibW9kYWwtZm9vdFwiPlxuICAgICAgPHNwYW4gY2xhc3M9XCJtb2RhbC1zdGF0dXNcIj48L3NwYW4+XG4gICAgICA8c3BhbiBzdHlsZT1cImZsZXg6MVwiPjwvc3Bhbj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBvbmNsaWNrPVwiY2xvc2VDb250YWN0TW9kYWwoKVwiPiR7aWMoJ3gnLCAxNSl9IENhbmNlbDwvYnV0dG9uPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBwcmltYXJ5IGpzLXNhdmVcIiBvbmNsaWNrPVwic2F2ZUNvbnRhY3QoKVwiPiR7aWMoJ3NhdmUnLCAxNSl9ICR7ZWRpdGluZyA/ICdTYXZlIGNoYW5nZXMnIDogJ0FkZCBjb250YWN0J308L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgPC9kaXY+YDtcbiAgaG9zdC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBlID0+IHsgaWYgKGUudGFyZ2V0ID09PSBob3N0KSBjbG9zZUNvbnRhY3RNb2RhbCgpOyB9KTtcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChob3N0KTtcbiAgY29uc3QgZmlyc3QgPSBob3N0LnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W2RhdGEtaz1cImZpcnN0TmFtZVwiXScpIGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsO1xuICBpZiAoZmlyc3QpIGZpcnN0LmZvY3VzKCk7XG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBjb250YWN0RXNjQ2xvc2UpO1xufVxuXG5mdW5jdGlvbiBjb250YWN0RXNjQ2xvc2UoZTogS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuICBpZiAoZS5rZXkgIT09ICdFc2NhcGUnKSByZXR1cm47XG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19jcm9wTW9kYWwnKSkgcmV0dXJuOyAvLyBsZXQgdGhlIGNyb3BwZXIncyBvd24gRXNjIGhhbmRsZSBpdFxuICBjbG9zZUNvbnRhY3RNb2RhbCgpO1xufVxuXG5mdW5jdGlvbiBjbG9zZUNvbnRhY3RNb2RhbCgpOiB2b2lkIHtcbiAgY29uc3QgbSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX2NvbnRhY3RNb2RhbCcpO1xuICBpZiAobSkgbS5yZW1vdmUoKTtcbiAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGNvbnRhY3RFc2NDbG9zZSk7XG59XG5cbmZ1bmN0aW9uIHNldENvbnRhY3RNb2RhbEVycm9yKG1zZzogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI19fY29udGFjdE1vZGFsIC5tb2RhbC1lcnInKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmICghZWwpIHJldHVybjtcbiAgaWYgKG1zZykgeyBlbC50ZXh0Q29udGVudCA9IG1zZzsgZWwuaGlkZGVuID0gZmFsc2U7IH0gZWxzZSB7IGVsLnRleHRDb250ZW50ID0gJyc7IGVsLmhpZGRlbiA9IHRydWU7IH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc2F2ZUNvbnRhY3QoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IG1vZGFsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI19fY29udGFjdE1vZGFsIC5tb2RhbC1jYXJkJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoIW1vZGFsKSByZXR1cm47XG4gIGNvbnN0IGNpZCA9IG1vZGFsLmdldEF0dHJpYnV0ZSgnZGF0YS1jaWQnKSB8fCAnJztcbiAgY29uc3QgZW50cnlJZCA9IG1vZGFsLmdldEF0dHJpYnV0ZSgnZGF0YS1lbnRyeScpIHx8ICcnO1xuICBpZiAoIWNpZCkgeyBzZXRDb250YWN0TW9kYWxFcnJvcignTWlzc2luZyBjbGllbnQgaWQuJyk7IHJldHVybjsgfVxuXG4gIGNvbnN0IGZpZWxkczogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuICBtb2RhbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1rXScpLmZvckVhY2goZWwgPT4ge1xuICAgIGNvbnN0IGsgPSAoZWwgYXMgSFRNTEVsZW1lbnQpLmRhdGFzZXQuayBhcyBzdHJpbmc7XG4gICAgY29uc3QgaW5wdXQgPSBlbCBhcyBIVE1MSW5wdXRFbGVtZW50O1xuICAgIGlmIChpbnB1dC50eXBlID09PSAnY2hlY2tib3gnKSBmaWVsZHNba10gPSBpbnB1dC5jaGVja2VkO1xuICAgIGVsc2UgZmllbGRzW2tdID0gKGVsIGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50IHwgSFRNTFNlbGVjdEVsZW1lbnQpLnZhbHVlLnRyaW0oKTtcbiAgfSk7XG5cbiAgLy8gXCJPdGhlclwiIHJlbGF0aW9uc2hpcCAtPiBzdG9yZSB0aGUgZnJlZS10ZXh0IHZhbHVlIChmYWxsIGJhY2sgdG8gXCJPdGhlclwiIGlmIGJsYW5rKS5cbiAgY29uc3QgcmVsU2VsID0gbW9kYWwucXVlcnlTZWxlY3RvcignW2RhdGEtcmVsbi1zZWxlY3RdJykgYXMgSFRNTFNlbGVjdEVsZW1lbnQgfCBudWxsO1xuICBpZiAocmVsU2VsICYmIHJlbFNlbC52YWx1ZSA9PT0gT1RIRVJfUkVMQVRJT05TSElQKSB7XG4gICAgY29uc3Qgb3RoZXJFbCA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXJlbG4tb3RoZXJdJykgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XG4gICAgY29uc3QgY3VzdG9tID0gb3RoZXJFbCA/IG90aGVyRWwudmFsdWUudHJpbSgpIDogJyc7XG4gICAgZmllbGRzLnJlbGF0aW9uc2hpcCA9IGN1c3RvbSB8fCBPVEhFUl9SRUxBVElPTlNISVA7XG4gIH1cblxuICBzZXRDb250YWN0TW9kYWxFcnJvcignJyk7XG4gIGlmICghZmllbGRzLmZpcnN0TmFtZSAmJiAhZmllbGRzLmxhc3ROYW1lKSB7IHNldENvbnRhY3RNb2RhbEVycm9yKCdFbnRlciBhdCBsZWFzdCBhIGZpcnN0IG9yIGxhc3QgbmFtZS4nKTsgcmV0dXJuOyB9XG5cbiAgY29uc3Qgc2F2ZUJ0biA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJy5qcy1zYXZlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuICBjb25zdCBzdGF0dXMgPSBtb2RhbC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtc3RhdHVzJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoc2F2ZUJ0bikgc2F2ZUJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICdTYXZpbmdcdTIwMjYnO1xuXG4gIHRyeSB7XG4gICAgLy8gMSkgU2F2ZSB0aGUgY29udGFjdCBmaWVsZHMgKGNyZWF0ZSBvciB1cGRhdGUpIHRvIGdldCB0aGUgZW50cnkgaWQuXG4gICAgY29uc3Qgc2F2ZWQgPSBlbnRyeUlkID8gYXdhaXQgYXBpVXBkYXRlQ29udGFjdChjaWQsIGVudHJ5SWQsIGZpZWxkcykgOiBhd2FpdCBhcGlBZGRDb250YWN0KGNpZCwgZmllbGRzKTtcbiAgICBjb25zdCBzYXZlZEVudHJ5SWQgPSAoc2F2ZWQgJiYgc2F2ZWQuZW50cnlJZCkgPyBTdHJpbmcoc2F2ZWQuZW50cnlJZCkgOiBlbnRyeUlkO1xuXG4gICAgLy8gMikgQXBwbHkgYW55IGJ1ZmZlcmVkIHBob3RvIGNoYW5nZSB0byB0aGF0IGVudHJ5LlxuICAgIGlmIChzYXZlZEVudHJ5SWQgJiYgQ09OVEFDVF9QSE9UTy5tb2RlID09PSAnc2V0JyAmJiBDT05UQUNUX1BIT1RPLmRhdGFVcmwpIHtcbiAgICAgIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICdVcGxvYWRpbmcgcGhvdG9cdTIwMjYnO1xuICAgICAgY29uc3QgZGF0YVVybCA9IENPTlRBQ1RfUEhPVE8uZGF0YVVybDtcbiAgICAgIGNvbnN0IGNvbW1hID0gZGF0YVVybC5pbmRleE9mKCcsJyk7XG4gICAgICBjb25zdCBiNjQgPSBjb21tYSA+PSAwID8gZGF0YVVybC5zbGljZShjb21tYSArIDEpIDogZGF0YVVybDtcbiAgICAgIGF3YWl0IGFwaVNldENvbnRhY3RQaG90byhjaWQsIHNhdmVkRW50cnlJZCwgYjY0LCAncGhvdG8uanBnJywgJ2ltYWdlL2pwZWcnKTtcbiAgICB9IGVsc2UgaWYgKHNhdmVkRW50cnlJZCAmJiBDT05UQUNUX1BIT1RPLm1vZGUgPT09ICdyZW1vdmUnKSB7XG4gICAgICBhd2FpdCBhcGlTZXRDb250YWN0UGhvdG8oY2lkLCBzYXZlZEVudHJ5SWQsICcnLCAnJywgJycpO1xuICAgIH1cblxuICAgIGNsb3NlQ29udGFjdE1vZGFsKCk7XG4gICAgYXdhaXQgbG9hZENvbnRhY3RzKGNpZCwgdHJ1ZSk7XG4gICAgdG9hc3QoZW50cnlJZCA/ICdDb250YWN0IHVwZGF0ZWQnIDogJ0NvbnRhY3QgYWRkZWQnKTtcbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgaWYgKHNhdmVCdG4pIHNhdmVCdG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICBpZiAoc3RhdHVzKSBzdGF0dXMudGV4dENvbnRlbnQgPSAnJztcbiAgICBzZXRDb250YWN0TW9kYWxFcnJvcihlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZGVsZXRlQ29udGFjdFByb21wdChjaWQ6IHN0cmluZywgZW50cnlJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICghZW50cnlJZCkgcmV0dXJuO1xuICBpZiAoIXdpbmRvdy5jb25maXJtKCdEZWxldGUgdGhpcyBjb250YWN0PyBUaGlzIGNhblxcJ3QgYmUgdW5kb25lLicpKSByZXR1cm47XG4gIHRyeSB7XG4gICAgYXdhaXQgYXBpRGVsZXRlQ29udGFjdChjaWQsIGVudHJ5SWQpO1xuICAgIGF3YWl0IGxvYWRDb250YWN0cyhjaWQsIHRydWUpO1xuICAgIHRvYXN0KCdDb250YWN0IGRlbGV0ZWQnKTtcbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgdG9hc3QoJ0RlbGV0ZSBmYWlsZWQ6ICcgKyAoZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpKTtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBdUJBLE1BQU0saUJBQXdELENBQUM7QUFFL0QsU0FBUyxjQUFjLEtBQTRCO0FBQ2pELE1BQUksQ0FBQyxlQUFlLEdBQUcsRUFBRyxnQkFBZSxHQUFHLElBQUksRUFBRSxNQUFNLE1BQU0sU0FBUyxPQUFPLE9BQU8sS0FBSztBQUMxRixTQUFPLGVBQWUsR0FBRztBQUMzQjtBQUdBLGVBQWUsYUFBYSxLQUFhLFFBQVEsT0FBc0I7QUFDckUsUUFBTSxLQUFLLGNBQWMsR0FBRztBQUM1QixNQUFJLEdBQUcsUUFBUztBQUNoQixNQUFJLEdBQUcsUUFBUSxDQUFDLE1BQU87QUFDdkIsS0FBRyxVQUFVO0FBQU0sS0FBRyxRQUFRO0FBQzlCLE1BQUk7QUFDRixVQUFNLE9BQU8sTUFBTSxnQkFBZ0IsR0FBRztBQUN0QyxPQUFHLFFBQVEsTUFBTSxRQUFRLElBQUksSUFBSSxPQUFPLENBQUMsR0FBRyxJQUFJLGdCQUFnQjtBQUFBLEVBQ2xFLFNBQVMsR0FBUTtBQUNmLE9BQUcsUUFBUSxLQUFLLEVBQUUsVUFBVSxFQUFFLFVBQVUsT0FBTyxDQUFDO0FBQ2hELE9BQUcsT0FBTztBQUFBLEVBQ1osVUFBRTtBQUNBLE9BQUcsVUFBVTtBQUNiLFFBQUksT0FBTyxXQUFXLFdBQVksUUFBTztBQUFBLEVBQzNDO0FBQ0Y7QUFFQSxTQUFTLGlCQUFpQixHQUFxQjtBQUM3QyxTQUFPO0FBQUEsSUFDTCxTQUFTLE9BQU8sRUFBRSxXQUFXLEVBQUU7QUFBQSxJQUMvQixXQUFXLEVBQUUsYUFBYTtBQUFBLElBQUksVUFBVSxFQUFFLFlBQVk7QUFBQSxJQUFJLGNBQWMsRUFBRSxnQkFBZ0I7QUFBQSxJQUMxRixPQUFPLEVBQUUsU0FBUztBQUFBLElBQUksTUFBTSxFQUFFLFFBQVE7QUFBQSxJQUFJLFNBQVMsRUFBRSxZQUFZO0FBQUEsSUFDakUsU0FBUyxFQUFFLFdBQVc7QUFBQSxJQUFJLE1BQU0sRUFBRSxRQUFRO0FBQUEsSUFBSSxPQUFPLEVBQUUsU0FBUztBQUFBLElBQUksS0FBSyxFQUFFLE9BQU87QUFBQSxJQUNsRixVQUFVLEVBQUUsU0FBUztBQUFBLEVBQ3ZCO0FBQ0Y7QUFHQSxTQUFTLGdCQUFnQixHQUFtQjtBQUMxQyxRQUFNLEtBQUssY0FBYyxFQUFFLEVBQUU7QUFFN0IsTUFBSSxDQUFDLFlBQVksQ0FBQyxpQkFBa0IsY0FBYTtBQUVqRCxRQUFNLE9BQU87QUFBQSw2RUFDOEQsSUFBSSxFQUFFLEtBQUssQ0FBQztBQUFBLDZEQUM1QixJQUFJLEVBQUUsRUFBRSxDQUFDLE9BQU8sR0FBRyxRQUFRLEVBQUUsQ0FBQztBQUFBO0FBR3pGLE1BQUksR0FBRyxTQUFTLE1BQU07QUFDcEIsUUFBSSxDQUFDLEdBQUcsV0FBVyxDQUFDLEdBQUcsTUFBTyxjQUFhLEVBQUUsRUFBRTtBQUMvQyxVQUFNLE9BQU8sR0FBRyxRQUNaLHlEQUF5RCxHQUFHLFNBQVMsRUFBRSxDQUFDO0FBQUEsY0FDbEUsSUFBSSxHQUFHLEtBQUssQ0FBQywwREFBMEQsSUFBSSxFQUFFLEVBQUUsQ0FBQyxhQUFhLEdBQUcsU0FBUyxFQUFFLENBQUMsZ0NBQ2xILHlEQUF5RCxHQUFHLFNBQVMsRUFBRSxDQUFDO0FBQzVFLFdBQU8sT0FBTztBQUFBLEVBQ2hCO0FBRUEsTUFBSSxDQUFDLEdBQUcsS0FBSyxRQUFRO0FBQ25CLFdBQU8sT0FBTyx5REFBeUQsR0FBRyxTQUFTLEVBQUUsQ0FBQztBQUFBO0FBQUEsK0RBRTNCLElBQUksRUFBRSxFQUFFLENBQUMsT0FBTyxHQUFHLFFBQVEsRUFBRSxDQUFDO0FBQUEsRUFDM0Y7QUFHQSxRQUFNLFNBQVMsR0FBRyxLQUFLLE1BQU0sRUFBRSxLQUFLLENBQUMsR0FBRyxNQUNyQyxFQUFFLFlBQVksRUFBRSxVQUFXLEVBQUUsU0FBUyxjQUFjLEVBQUUsUUFBUSxJQUFLLEVBQUUsVUFBVSxLQUFLLENBQUU7QUFDekYsUUFBTSxRQUFRLE9BQU8sSUFBSSxRQUFNLFlBQVksRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRTtBQUM3RCxTQUFPLE9BQU8sNkJBQTZCLEtBQUs7QUFDbEQ7QUFFQSxTQUFTLFlBQVksS0FBYSxJQUF5QjtBQUN6RCxRQUFNLFFBQVEsR0FBRyxZQUFZLE1BQU0sR0FBRyxVQUFVLEtBQUssS0FBSztBQUMxRCxRQUFNLE1BQU0sQ0FBQyxHQUFHLE1BQU0sR0FBRyxLQUFLLEVBQUUsT0FBTyxPQUFPLEVBQUUsS0FBSyxJQUFJO0FBQ3pELFFBQU0sT0FBTztBQUFBLElBQ1gsR0FBRyxRQUFRLHNCQUFzQixHQUFHLE9BQU8sRUFBRSxDQUFDLG1CQUFtQixJQUFJLEdBQUcsS0FBSyxDQUFDLEtBQUssSUFBSSxHQUFHLEtBQUssQ0FBQyxlQUFlO0FBQUEsSUFDL0csR0FBRyxPQUFPLHNCQUFzQixHQUFHLFFBQVEsRUFBRSxDQUFDLFNBQVMsSUFBSSxHQUFHLElBQUksQ0FBQyxrQkFBa0I7QUFBQSxJQUNwRixHQUFHLFdBQVcsTUFBTyxzQkFBc0IsR0FBRyxPQUFPLEVBQUUsQ0FBQyxTQUFTLElBQUksQ0FBQyxHQUFHLFNBQVMsR0FBRyxFQUFFLE9BQU8sT0FBTyxFQUFFLEtBQUssUUFBSyxDQUFDLENBQUMsa0JBQWtCO0FBQUEsRUFDeEksRUFBRSxPQUFPLE9BQU8sRUFBRSxLQUFLLEVBQUU7QUFFekIsU0FBTztBQUFBO0FBQUEsUUFFRCxPQUFPLEdBQUcsV0FBVyxHQUFHLFVBQVUsSUFBSSxJQUFJLEdBQUcsUUFBUSxDQUFDO0FBQUE7QUFBQSwrQkFFL0IsSUFBSSxJQUFJLENBQUMsR0FBRyxHQUFHLFVBQVUsd0VBQXdFLEVBQUU7QUFBQSw4QkFDcEcsR0FBRyxlQUFlLElBQUksR0FBRyxZQUFZLElBQUksd0VBQXdFO0FBQUE7QUFBQTtBQUFBLDJFQUdwRSxJQUFJLEdBQUcsQ0FBQyxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsT0FBTyxHQUFHLFFBQVEsRUFBRSxDQUFDO0FBQUEsdUZBQ3RDLElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxPQUFPLEdBQUcsU0FBUyxFQUFFLENBQUM7QUFBQTtBQUFBO0FBQUEsTUFHcEksT0FBTyx3QkFBd0IsSUFBSSxXQUFXLEVBQUU7QUFBQTtBQUV0RDtBQUlBLE1BQU0sdUJBQTBDO0FBQUEsRUFDOUMsRUFBRSxHQUFHLGFBQWEsT0FBTyxhQUFhO0FBQUEsRUFDdEMsRUFBRSxHQUFHLFlBQVksT0FBTyxZQUFZO0FBQUEsRUFDcEMsRUFBRSxHQUFHLGdCQUFnQixPQUFPLGdCQUFnQixNQUFNLGdCQUFnQixNQUFNLEtBQUs7QUFBQSxFQUM3RSxFQUFFLEdBQUcsU0FBUyxPQUFPLFNBQVMsTUFBTSxTQUFTLGFBQWEsbUJBQW1CO0FBQUEsRUFDN0UsRUFBRSxHQUFHLFFBQVEsT0FBTyxjQUFjLE1BQU0sT0FBTyxhQUFhLGlCQUFpQjtBQUFBLEVBQzdFLEVBQUUsR0FBRyxXQUFXLE9BQU8sV0FBVyxNQUFNLFlBQVksTUFBTSxLQUFLO0FBQUEsRUFDL0QsRUFBRSxHQUFHLFFBQVEsT0FBTyxPQUFPO0FBQUEsRUFDM0IsRUFBRSxHQUFHLFNBQVMsT0FBTyxRQUFRO0FBQUEsRUFDN0IsRUFBRSxHQUFHLE9BQU8sT0FBTyxNQUFNO0FBQUEsRUFDekIsRUFBRSxHQUFHLFdBQVcsT0FBTyxtQkFBbUIsTUFBTSxZQUFZLE1BQU0sS0FBSztBQUN6RTtBQU1BLFNBQVMsb0JBQW9CLFNBQXlCO0FBQ3BELFFBQU0sT0FBTyxvQkFBb0I7QUFDakMsUUFBTSxVQUFVLENBQUMsQ0FBQyxXQUFXLEtBQUssUUFBUSxPQUFPLElBQUk7QUFDckQsUUFBTSxNQUFNLFVBQVUscUJBQXNCLFdBQVc7QUFDdkQsUUFBTSxVQUFVLENBQUMsRUFBRSxFQUFFLE9BQU8sTUFBTSxDQUFDLGtCQUFrQixDQUFDO0FBQ3RELFFBQU0sU0FBUyx3RkFBd0YsUUFBUSxJQUFJLE9BQ2pILGtCQUFrQixJQUFJLENBQUMsQ0FBQyxJQUFJLE1BQU0sTUFBTSxjQUFjLEVBQUUsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLFFBQUcsV0FBVyxFQUFFLEtBQUssRUFBRSxDQUFDO0FBQ25HLFFBQU0sWUFBWTtBQUFBLGFBQ1AsSUFBSSxVQUFVLFVBQVUsRUFBRSxDQUFDLElBQUksVUFBVSxLQUFLLFNBQVM7QUFDbEUsU0FBTyw2QkFBNkIsTUFBTSxHQUFHLFNBQVM7QUFDeEQ7QUFHQSxTQUFTLHFCQUFxQixLQUE4QjtBQUMxRCxRQUFNLE9BQU8sSUFBSSxRQUFRLGVBQWU7QUFDeEMsTUFBSSxDQUFDLEtBQU07QUFDWCxRQUFNLFFBQVEsS0FBSyxjQUFjLG1CQUFtQjtBQUNwRCxNQUFJLENBQUMsTUFBTztBQUNaLFFBQU0sT0FBTyxJQUFJLFVBQVU7QUFDM0IsUUFBTSxTQUFTLENBQUM7QUFDaEIsTUFBSSxLQUFNLE9BQU0sTUFBTTtBQUN4QjtBQUVBLFNBQVMsZUFBZSxHQUFvQixJQUFnQztBQUMxRSxRQUFNLElBQUksS0FBTSxHQUFXLEVBQUUsQ0FBQyxJQUFJO0FBQ2xDLE1BQUksRUFBRSxTQUFTLGVBQWdCLFFBQU8sb0JBQW9CLEtBQUssRUFBRTtBQUNqRSxNQUFJLEVBQUUsU0FBUyxZQUFZO0FBQ3pCLFdBQU8scURBQXFELEVBQUUsQ0FBQyxJQUFJLE1BQU0sR0FBRyxVQUFVLGFBQWEsRUFBRSxLQUFLLElBQUksRUFBRSxLQUFLLENBQUM7QUFBQSxFQUN4SDtBQUNBLE1BQUksRUFBRSxTQUFTLFlBQVk7QUFDekIsV0FBTyxxQkFBcUIsRUFBRSxDQUFDLDJCQUEyQixJQUFJLEVBQUUsZUFBZSxFQUFFLENBQUMsS0FBSyxJQUFJLEtBQUssRUFBRSxDQUFDO0FBQUEsRUFDckc7QUFDQSxRQUFNLElBQUksRUFBRSxTQUFTLFVBQVUsVUFBVSxFQUFFLFNBQVMsUUFBUSxRQUFRO0FBQ3BFLFNBQU8sZ0JBQWdCLENBQUMsYUFBYSxFQUFFLENBQUMsWUFBWSxJQUFJLEtBQUssRUFBRSxDQUFDLGtCQUFrQixJQUFJLEVBQUUsZUFBZSxFQUFFLENBQUM7QUFDNUc7QUFRQSxJQUFJLGdCQUFtQyxFQUFFLE1BQU0sT0FBTztBQUd0RCxTQUFTLG9CQUFvQixJQUFnQztBQUMzRCxNQUFJLGNBQWMsU0FBUyxNQUFPLFFBQU8sY0FBYyxXQUFXO0FBQ2xFLE1BQUksY0FBYyxTQUFTLFNBQVUsUUFBTztBQUM1QyxTQUFPLEtBQUssR0FBRyxXQUFXO0FBQzVCO0FBRUEsU0FBUyxrQkFBa0IsSUFBd0IsT0FBZSxNQUFzQjtBQUN0RixRQUFNLE1BQU0sb0JBQW9CLEVBQUU7QUFDbEMsUUFBTSxRQUFRLE1BQU0sYUFBYSxJQUFJLEdBQUcsQ0FBQyxjQUFjLDZCQUE2QixJQUFJLFNBQVMsT0FBTyxJQUFJLEtBQUssR0FBRyxDQUFDO0FBQ3JILFFBQU0sTUFBTSxDQUFDLENBQUM7QUFDZCxTQUFPO0FBQUEsK0JBQ3NCLEtBQUs7QUFBQTtBQUFBO0FBQUE7QUFBQSxxSEFJaUYsR0FBRyxTQUFTLEVBQUUsQ0FBQyxJQUFJLE1BQU0saUJBQWlCLFdBQVc7QUFBQSxVQUNoSyxNQUFNLDBFQUEwRSxHQUFHLFNBQVMsRUFBRSxDQUFDLHFCQUFxQixFQUFFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFLaEk7QUFHQSxTQUFTLDZCQUFtQztBQUMxQyxRQUFNLFFBQVEsU0FBUyxlQUFlLHFCQUFxQjtBQUMzRCxRQUFNLFFBQVEsU0FBUyxjQUFjLDZCQUE2QjtBQUNsRSxNQUFJLENBQUMsU0FBUyxDQUFDLE1BQU87QUFDdEIsUUFBTSxNQUFNLE1BQU0sYUFBYSxVQUFVLEtBQUs7QUFDOUMsUUFBTSxVQUFVLE1BQU0sYUFBYSxZQUFZLEtBQUs7QUFDcEQsUUFBTSxLQUFLLGNBQWMsR0FBRztBQUM1QixRQUFNLEtBQUssV0FBVyxHQUFHLE9BQVEsR0FBRyxLQUFLLE9BQU8sT0FBSyxFQUFFLFlBQVksT0FBTyxFQUFFLENBQUMsS0FBSyxPQUFRO0FBQzFGLFFBQU0sS0FBTSxNQUFNLGNBQWMsc0JBQXNCO0FBQ3RELFFBQU0sS0FBTSxNQUFNLGNBQWMscUJBQXFCO0FBQ3JELFFBQU0sWUFBWSxrQkFBa0IsSUFBSSxLQUFLLEdBQUcsUUFBUyxLQUFLLEdBQUcsWUFBWSxJQUFLLEtBQUssR0FBRyxRQUFTLEtBQUssR0FBRyxXQUFXLEVBQUc7QUFDM0g7QUFFQSxlQUFlLG1CQUFtQixPQUF3QztBQUN4RSxRQUFNLE9BQU8sTUFBTSxTQUFTLE1BQU0sTUFBTSxDQUFDO0FBQ3pDLFFBQU0sUUFBUTtBQUNkLE1BQUksQ0FBQyxLQUFNO0FBQ1gsTUFBSSxDQUFDLFdBQVcsS0FBSyxLQUFLLElBQUksR0FBRztBQUFFLFVBQU0saURBQWlEO0FBQUc7QUFBQSxFQUFRO0FBQ3JHLE1BQUk7QUFDRixVQUFNLFVBQVUsTUFBTSxjQUFjLElBQUk7QUFDeEMsZ0JBQVksU0FBUyxTQUFVLEtBQUs7QUFBRSxzQkFBZ0IsRUFBRSxNQUFNLE9BQU8sU0FBUyxJQUFJO0FBQUcsaUNBQTJCO0FBQUEsSUFBRyxDQUFDO0FBQUEsRUFDdEgsU0FBUyxHQUFRO0FBQ2YseUJBQXFCLEtBQUssRUFBRSxVQUFVLEVBQUUsVUFBVSxPQUFPLENBQUMsQ0FBQztBQUFBLEVBQzdEO0FBQ0Y7QUFFQSxTQUFTLHFCQUEyQjtBQUNsQyxrQkFBZ0IsRUFBRSxNQUFNLFNBQVM7QUFDakMsNkJBQTJCO0FBQzdCO0FBRUEsU0FBUyxpQkFBaUIsS0FBYSxTQUF3QjtBQUM3RCxNQUFJLFNBQVMsZUFBZSxnQkFBZ0IsRUFBRyxtQkFBa0I7QUFDakUsa0JBQWdCLEVBQUUsTUFBTSxPQUFPO0FBQy9CLFFBQU0sS0FBSyxjQUFjLEdBQUc7QUFDNUIsUUFBTSxLQUFLLFdBQVcsR0FBRyxPQUFRLEdBQUcsS0FBSyxPQUFPLE9BQUssRUFBRSxZQUFZLE9BQU8sRUFBRSxDQUFDLEtBQUssT0FBUTtBQUMxRixRQUFNLFVBQVUsQ0FBQyxDQUFDO0FBRWxCLFFBQU0sT0FBTyxxQkFBcUIsSUFBSSxPQUFLO0FBQ3pDLFFBQUksRUFBRSxTQUFTLFdBQVksUUFBTywyQkFBMkIsZUFBZSxHQUFHLEVBQUUsQ0FBQztBQUNsRixXQUFPLHFCQUFxQixFQUFFLE9BQU8sU0FBUyxFQUFFO0FBQUEsZUFDckMsSUFBSSxFQUFFLEtBQUssQ0FBQyxXQUFXLGVBQWUsR0FBRyxFQUFFLENBQUM7QUFBQSxFQUN6RCxDQUFDLEVBQUUsS0FBSyxFQUFFO0FBRVYsUUFBTSxPQUFPLFNBQVMsY0FBYyxLQUFLO0FBQ3pDLE9BQUssWUFBWTtBQUNqQixPQUFLLEtBQUs7QUFDVixPQUFLLFlBQVksdUVBQXVFLFVBQVUsaUJBQWlCLGFBQWE7QUFBQSxrQkFDaEgsSUFBSSxHQUFHLENBQUMsaUJBQWlCLElBQUksV0FBVyxFQUFFLENBQUM7QUFBQTtBQUFBLGdCQUU3QyxVQUFVLGlCQUFpQixhQUFhLFVBQVUsVUFBVSx5QkFBeUIsc0NBQXNDO0FBQUEsMEVBQ2pFLEdBQUcsS0FBSyxFQUFFLENBQUM7QUFBQTtBQUFBO0FBQUE7QUFBQSxRQUk3RSxrQkFBa0IsSUFBSSxLQUFLLEdBQUcsWUFBWSxJQUFJLEtBQUssR0FBRyxXQUFXLEVBQUUsQ0FBQztBQUFBLGdDQUM1QyxJQUFJO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxnRUFLNEIsR0FBRyxLQUFLLEVBQUUsQ0FBQztBQUFBLG9FQUNQLEdBQUcsUUFBUSxFQUFFLENBQUMsSUFBSSxVQUFVLGlCQUFpQixhQUFhO0FBQUE7QUFBQTtBQUc1SCxPQUFLLGlCQUFpQixhQUFhLE9BQUs7QUFBRSxRQUFJLEVBQUUsV0FBVyxLQUFNLG1CQUFrQjtBQUFBLEVBQUcsQ0FBQztBQUN2RixXQUFTLEtBQUssWUFBWSxJQUFJO0FBQzlCLFFBQU0sUUFBUSxLQUFLLGNBQWMsMkJBQTJCO0FBQzVELE1BQUksTUFBTyxPQUFNLE1BQU07QUFDdkIsV0FBUyxpQkFBaUIsV0FBVyxlQUFlO0FBQ3REO0FBRUEsU0FBUyxnQkFBZ0IsR0FBd0I7QUFDL0MsTUFBSSxFQUFFLFFBQVEsU0FBVTtBQUN4QixNQUFJLFNBQVMsZUFBZSxhQUFhLEVBQUc7QUFDNUMsb0JBQWtCO0FBQ3BCO0FBRUEsU0FBUyxvQkFBMEI7QUFDakMsUUFBTSxJQUFJLFNBQVMsZUFBZSxnQkFBZ0I7QUFDbEQsTUFBSSxFQUFHLEdBQUUsT0FBTztBQUNoQixXQUFTLG9CQUFvQixXQUFXLGVBQWU7QUFDekQ7QUFFQSxTQUFTLHFCQUFxQixLQUFtQjtBQUMvQyxRQUFNLEtBQUssU0FBUyxjQUFjLDRCQUE0QjtBQUM5RCxNQUFJLENBQUMsR0FBSTtBQUNULE1BQUksS0FBSztBQUFFLE9BQUcsY0FBYztBQUFLLE9BQUcsU0FBUztBQUFBLEVBQU8sT0FBTztBQUFFLE9BQUcsY0FBYztBQUFJLE9BQUcsU0FBUztBQUFBLEVBQU07QUFDdEc7QUFFQSxlQUFlLGNBQTZCO0FBQzFDLFFBQU0sUUFBUSxTQUFTLGNBQWMsNkJBQTZCO0FBQ2xFLE1BQUksQ0FBQyxNQUFPO0FBQ1osUUFBTSxNQUFNLE1BQU0sYUFBYSxVQUFVLEtBQUs7QUFDOUMsUUFBTSxVQUFVLE1BQU0sYUFBYSxZQUFZLEtBQUs7QUFDcEQsTUFBSSxDQUFDLEtBQUs7QUFBRSx5QkFBcUIsb0JBQW9CO0FBQUc7QUFBQSxFQUFRO0FBRWhFLFFBQU0sU0FBOEIsQ0FBQztBQUNyQyxRQUFNLGlCQUFpQixVQUFVLEVBQUUsUUFBUSxRQUFNO0FBQy9DLFVBQU0sSUFBSyxHQUFtQixRQUFRO0FBQ3RDLFVBQU0sUUFBUTtBQUNkLFFBQUksTUFBTSxTQUFTLFdBQVksUUFBTyxDQUFDLElBQUksTUFBTTtBQUFBLFFBQzVDLFFBQU8sQ0FBQyxJQUFLLEdBQWtFLE1BQU0sS0FBSztBQUFBLEVBQ2pHLENBQUM7QUFHRCxRQUFNLFNBQVMsTUFBTSxjQUFjLG9CQUFvQjtBQUN2RCxNQUFJLFVBQVUsT0FBTyxVQUFVLG9CQUFvQjtBQUNqRCxVQUFNLFVBQVUsTUFBTSxjQUFjLG1CQUFtQjtBQUN2RCxVQUFNLFNBQVMsVUFBVSxRQUFRLE1BQU0sS0FBSyxJQUFJO0FBQ2hELFdBQU8sZUFBZSxVQUFVO0FBQUEsRUFDbEM7QUFFQSx1QkFBcUIsRUFBRTtBQUN2QixNQUFJLENBQUMsT0FBTyxhQUFhLENBQUMsT0FBTyxVQUFVO0FBQUUseUJBQXFCLHNDQUFzQztBQUFHO0FBQUEsRUFBUTtBQUVuSCxRQUFNLFVBQVUsTUFBTSxjQUFjLFVBQVU7QUFDOUMsUUFBTSxTQUFTLE1BQU0sY0FBYyxlQUFlO0FBQ2xELE1BQUksUUFBUyxTQUFRLFdBQVc7QUFDaEMsTUFBSSxPQUFRLFFBQU8sY0FBYztBQUVqQyxNQUFJO0FBRUYsVUFBTSxRQUFRLFVBQVUsTUFBTSxpQkFBaUIsS0FBSyxTQUFTLE1BQU0sSUFBSSxNQUFNLGNBQWMsS0FBSyxNQUFNO0FBQ3RHLFVBQU0sZUFBZ0IsU0FBUyxNQUFNLFVBQVcsT0FBTyxNQUFNLE9BQU8sSUFBSTtBQUd4RSxRQUFJLGdCQUFnQixjQUFjLFNBQVMsU0FBUyxjQUFjLFNBQVM7QUFDekUsVUFBSSxPQUFRLFFBQU8sY0FBYztBQUNqQyxZQUFNLFVBQVUsY0FBYztBQUM5QixZQUFNLFFBQVEsUUFBUSxRQUFRLEdBQUc7QUFDakMsWUFBTSxNQUFNLFNBQVMsSUFBSSxRQUFRLE1BQU0sUUFBUSxDQUFDLElBQUk7QUFDcEQsWUFBTSxtQkFBbUIsS0FBSyxjQUFjLEtBQUssYUFBYSxZQUFZO0FBQUEsSUFDNUUsV0FBVyxnQkFBZ0IsY0FBYyxTQUFTLFVBQVU7QUFDMUQsWUFBTSxtQkFBbUIsS0FBSyxjQUFjLElBQUksSUFBSSxFQUFFO0FBQUEsSUFDeEQ7QUFFQSxzQkFBa0I7QUFDbEIsVUFBTSxhQUFhLEtBQUssSUFBSTtBQUM1QixVQUFNLFVBQVUsb0JBQW9CLGVBQWU7QUFBQSxFQUNyRCxTQUFTLEdBQVE7QUFDZixRQUFJLFFBQVMsU0FBUSxXQUFXO0FBQ2hDLFFBQUksT0FBUSxRQUFPLGNBQWM7QUFDakMseUJBQXFCLEtBQUssRUFBRSxVQUFVLEVBQUUsVUFBVSxPQUFPLENBQUMsQ0FBQztBQUFBLEVBQzdEO0FBQ0Y7QUFFQSxlQUFlLG9CQUFvQixLQUFhLFNBQWdDO0FBQzlFLE1BQUksQ0FBQyxRQUFTO0FBQ2QsTUFBSSxDQUFDLE9BQU8sUUFBUSw0Q0FBNkMsRUFBRztBQUNwRSxNQUFJO0FBQ0YsVUFBTSxpQkFBaUIsS0FBSyxPQUFPO0FBQ25DLFVBQU0sYUFBYSxLQUFLLElBQUk7QUFDNUIsVUFBTSxpQkFBaUI7QUFBQSxFQUN6QixTQUFTLEdBQVE7QUFDZixVQUFNLHFCQUFxQixLQUFLLEVBQUUsVUFBVSxFQUFFLFVBQVUsT0FBTyxDQUFDLEVBQUU7QUFBQSxFQUNwRTtBQUNGOyIsCiAgIm5hbWVzIjogW10KfQo=
