const COMM_TYPES = ["Call", "Email", "Text", "In-person / Meeting", "Video Call", "Note"];
const COMMS_CACHE = {};
function commsState(cid) {
  if (!COMMS_CACHE[cid]) COMMS_CACHE[cid] = { list: null, loading: false, error: null };
  return COMMS_CACHE[cid];
}
async function loadCommunications(cid, force = false) {
  const st = commsState(cid);
  if (st.loading) return;
  if (st.list && !force) return;
  st.loading = true;
  st.error = null;
  try {
    const rows = await apiListCommunications(cid);
    st.list = (Array.isArray(rows) ? rows : []).map(normalizeComm);
  } catch (e) {
    st.error = e && e.message ? e.message : String(e);
    st.list = null;
  } finally {
    st.loading = false;
    if (typeof render === "function") render();
  }
}
function normalizeComm(r) {
  return {
    entryId: String(r.entryId || ""),
    date: r.date || "",
    type: r.type || "",
    subject: r.subject || "",
    notes: r.notes || "",
    contact: r.contact || "",
    loggedBy: r.loggedBy || "",
    loggedAt: r.loggedAt || ""
  };
}
function fmtCommStamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) + " \xB7 " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function communicationsSection(c) {
  const st = commsState(c.id);
  const cst = contactsState(c.id);
  if (cst.list === null && !cst.loading && !cst.error) loadContacts(c.id);
  const head = `<div class="section-head">
    <div><h3>Communications</h3><p>Calls, emails, texts, and notes logged for ${esc(c.first)}.</p></div>
    <div class="sec-actions">
      <button class="btn outline" onclick="openEmailComposer('${esc(c.id)}')">${ic("send", 15)} Send email</button>
      <button class="btn primary" onclick="openCommModal('${esc(c.id)}')">${ic("plus", 15)} Log communication</button>
    </div>
  </div>`;
  if (st.list === null) {
    if (!st.loading && !st.error) loadCommunications(c.id);
    const body = st.error ? `<div class="card"><div class="empty"><div class="ico">${ic("alert", 22)}</div><b>Couldn't load communications</b>
         <p>${esc(st.error)}</p><button class="btn primary" onclick="loadCommunications('${esc(c.id)}', true)">${ic("clock", 15)} Retry</button></div></div>` : `<div class="card"><div class="empty"><div class="ico">${ic("clock", 22)}</div><b>Loading communications\u2026</b><p>Fetching from the record.</p></div></div>`;
    return head + body;
  }
  if (!st.list.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic("msg", 22)}</div>
      <b>No communications yet</b><p>Log a call, email, or note to start the history for this client.</p>
      <button class="btn primary" onclick="openCommModal('${esc(c.id)}')">${ic("plus", 15)} Log communication</button></div></div>`;
  }
  const sorted = st.list.slice().sort((a, b) => {
    const d = (b.date || "").localeCompare(a.date || "");
    return d !== 0 ? d : (b.loggedAt || "").localeCompare(a.loggedAt || "");
  });
  const rows = sorted.map((cm) => commCard(c.id, cm)).join("");
  return head + `<div class="comm-list">${rows}</div>`;
}
function renderCommNotes(notes) {
  if (!notes) return "";
  const looksHtml = /<\/?(br|b|i|u|p|div|span|ul|ol|li|a|strong|em|h[1-6]|blockquote|table|tr|td)\b[^>]*>/i.test(notes);
  return looksHtml ? notes : esc(notes).replace(/\n/g, "<br>");
}
function commCard(cid, cm) {
  const when = fmtDate(cm.date) || "\u2014";
  const typeChip = cm.type ? `<span class="comm-type">${esc(cm.type)}</span>` : "";
  const subject = cm.subject ? esc(cm.subject) : '<span style="color:var(--muted-foreground)">(no subject)</span>';
  const meta = [
    cm.contact ? `${ic("users", 13)}<span>${esc(cm.contact)}</span>` : ""
  ].filter(Boolean).join("");
  const stamp = cm.loggedBy || cm.loggedAt ? `<div class="comm-foot">Logged${cm.loggedBy ? " by " + esc(cm.loggedBy) : ""}${cm.loggedAt ? " \xB7 " + esc(fmtCommStamp(cm.loggedAt)) : ""}</div>` : "";
  return `<div class="card comm-card">
    <div class="comm-top">
      <div class="comm-date">${ic("calendar", 14)}<span>${esc(when)}</span></div>
      ${typeChip}
      <span style="flex:1"></span>
      <div class="cc-acts">
        <button class="ico-mini" title="Edit" onclick="openCommModal('${esc(cid)}','${esc(cm.entryId)}')">${ic("edit", 15)}</button>
        <button class="ico-mini danger" title="Delete" onclick="deleteCommPrompt('${esc(cid)}','${esc(cm.entryId)}')">${ic("trash", 15)}</button>
      </div>
    </div>
    <div class="comm-subject">${subject}</div>
    ${cm.notes ? `<div class="comm-notes">${renderCommNotes(cm.notes)}</div>` : ""}
    ${meta ? `<div class="comm-meta">${meta}</div>` : ""}
    ${stamp}
  </div>`;
}
function commContactControl(cid, current) {
  const cst = contactsState(cid);
  const names = (cst.list || []).map((ct) => (ct.firstName + " " + ct.lastName).trim()).filter(Boolean);
  const opts = names.map((n) => `<option value="${esc(n)}"></option>`).join("");
  return `<input type="text" data-k="contact" list="__commContacts" value="${esc(current || "")}"
    placeholder="Who was this with? (optional)" autocomplete="off">
    <datalist id="__commContacts">${opts}</datalist>`;
}
function commTypeControl(current) {
  const choices = [""].concat(COMM_TYPES);
  return `<select data-k="type">${choices.map((o) => `<option value="${esc(o)}"${o === current ? " selected" : ""}>${o ? esc(o) : "\u2014"}</option>`).join("")}</select>`;
}
function todayISO() {
  const d = /* @__PURE__ */ new Date();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}
function openCommModal(cid, entryId) {
  if (document.getElementById("__commModal")) closeCommModal();
  const st = commsState(cid);
  const cm = entryId && st.list ? st.list.filter((x) => x.entryId === entryId)[0] || null : null;
  const editing = !!cm;
  const dateVal = cm ? cm.date : todayISO();
  const host = document.createElement("div");
  host.className = "modal-overlay";
  host.id = "__commModal";
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="${editing ? "Edit communication" : "Log communication"}"
      data-cid="${esc(cid)}" data-entry="${esc(entryId || "")}">
    <div class="modal-head">
      <div><b>${editing ? "Edit communication" : "Log communication"}</b><p>${editing ? "Update this log entry." : "Record a call, email, text, meeting, or note."}</p></div>
      <button class="ico-x" title="Close" onclick="closeCommModal()">${ic("x", 18)}</button>
    </div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <div class="field-grid">
        <div class="field"><label>Date</label><input type="date" data-k="date" value="${esc(dateVal)}"></div>
        <div class="field"><label>Type</label>${commTypeControl(cm ? cm.type : "")}</div>
        <div class="field full"><label>Who was this with?</label>${commContactControl(cid, cm ? cm.contact : "")}</div>
        <div class="field full"><label>Subject</label><input type="text" data-k="subject" value="${esc(cm ? cm.subject : "")}" placeholder="Short summary" autocomplete="off"></div>
        <div class="field full"><label>Notes</label><textarea data-k="notes" rows="5" placeholder="What was discussed?">${esc(cm ? cm.notes : "")}</textarea></div>
      </div>
    </div>
    <div class="modal-foot">
      <span class="modal-status"></span>
      <span style="flex:1"></span>
      <button class="btn ghost" onclick="closeCommModal()">${ic("x", 15)} Cancel</button>
      <button class="btn primary js-save" onclick="saveCommunication()">${ic("save", 15)} ${editing ? "Save changes" : "Log it"}</button>
    </div>
  </div>`;
  host.addEventListener("mousedown", (e) => {
    if (e.target === host) closeCommModal();
  });
  document.body.appendChild(host);
  const subj = host.querySelector('input[data-k="subject"]');
  if (subj) subj.focus();
  document.addEventListener("keydown", commEscClose);
}
function commEscClose(e) {
  if (e.key !== "Escape") return;
  closeCommModal();
}
function closeCommModal() {
  const m = document.getElementById("__commModal");
  if (m) m.remove();
  document.removeEventListener("keydown", commEscClose);
}
function setCommModalError(msg) {
  const el = document.querySelector("#__commModal .modal-err");
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}
async function saveCommunication() {
  const modal = document.querySelector("#__commModal .modal-card");
  if (!modal) return;
  const cid = modal.getAttribute("data-cid") || "";
  const entryId = modal.getAttribute("data-entry") || "";
  if (!cid) {
    setCommModalError("Missing client id.");
    return;
  }
  const fields = {};
  modal.querySelectorAll("[data-k]").forEach((el) => {
    const k = el.dataset.k;
    fields[k] = el.value.trim();
  });
  setCommModalError("");
  if (!fields.subject && !fields.notes) {
    setCommModalError("Enter a subject or some notes.");
    return;
  }
  const saveBtn = modal.querySelector(".js-save");
  const status = modal.querySelector(".modal-status");
  if (saveBtn) saveBtn.disabled = true;
  if (status) status.textContent = "Saving\u2026";
  try {
    if (entryId) await apiUpdateCommunication(cid, entryId, fields);
    else await apiAddCommunication(cid, fields);
    closeCommModal();
    await loadCommunications(cid, true);
    toast(entryId ? "Communication updated" : "Communication logged");
  } catch (e) {
    if (saveBtn) saveBtn.disabled = false;
    if (status) status.textContent = "";
    setCommModalError(e && e.message ? e.message : String(e));
  }
}
async function deleteCommPrompt(cid, entryId) {
  if (!entryId) return;
  if (!window.confirm("Delete this communication? This can't be undone.")) return;
  try {
    await apiDeleteCommunication(cid, entryId);
    await loadCommunications(cid, true);
    toast("Communication deleted");
  } catch (e) {
    toast("Delete failed: " + (e && e.message ? e.message : String(e)));
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiY29tbXVuaWNhdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgY29tbXVuaWNhdGlvbnMudHMgXHUyMDE0IHRoZSBDb21tdW5pY2F0aW9ucyByZWNvcmQgc2VjdGlvbiAobXVsdGktZW50cnksIGxpdmUpLlxuXG4gICBBIHNpbXBsZSBjb21tdW5pY2F0aW9uIGxvZzogZWFjaCBlbnRyeSBpcyBhIGxvZ2dlZCBjYWxsL2VtYWlsL3RleHQvbWVldGluZy9cbiAgIG5vdGUgb24gdGhlIGNsaWVudCdzIGBjb21tdW5pY2F0aW9uc2AgTUVGLCBzZXJ2ZWQgYnkgdGhlIG1hZXN0cm9cbiAgIChsaXN0Q29tbXVuaWNhdGlvbnMvYWRkQ29tbXVuaWNhdGlvbi91cGRhdGVDb21tdW5pY2F0aW9uL2RlbGV0ZUNvbW11bmljYXRpb24pLlxuICAgRWFjaCBlbnRyeSBjYXJyaWVzIGFuIGBlbnRyeUlkYCB1c2VkIHRvIHRhcmdldCBlZGl0cy9kZWxldGVzLiBgbG9nZ2VkQnlgIGFuZFxuICAgYGxvZ2dlZEF0YCBhcmUgc3RhbXBlZCBzZXJ2ZXItc2lkZSBvbiBhZGQgKHRoZSBsb2dnZWQtaW4gdXNlciArIHRoZSBpbnN0YW50KTtcbiAgIHRoZXkncmUgc2hvd24gcmVhZC1vbmx5IGluIHRoZSBlbnRyeSBmb290ZXIuIGBjb250YWN0YCBpcyBmcmVlIHRleHQgd2hvc2VcbiAgIHN1Z2dlc3Rpb25zIGNvbWUgZnJvbSB0aGUgY2xpZW50J3MgZXhpc3RpbmcgY29udGFjdHMgKGEgZGF0YWxpc3QpIFx1MjAxNCB0aGUgdHlwZWRcbiAgIG9yIHBpY2tlZCBsYWJlbCBpcyBzdG9yZWQgdmVyYmF0aW0uXG5cbiAgIFBlciB0aGUgbWVyZ2UtcmVwb3J0IGdvdGNoYSwgaW5qZWN0ZWQgY29udHJvbHMgdXNlIGRhdGEtaywgbmV2ZXIgYG5hbWVgLlxuICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbi8vIFRoZSBUeXBlIG9wdGlvbiBsaXN0IChtdXN0IG1hdGNoIHRoZSBcIkNvbW11bmljYXRpb24gVHlwZVwiIG9wdGlvbiBsaXN0IGxhYmVsc1xuLy8gZXhhY3RseSBcdTIwMTQgdGhlIG1hZXN0cm8gc2V0QnlOYW1lIHJlc29sdmVzIHRoZSBzdG9yZWQgb3B0aW9uIGJ5IGRpc3BsYXkgbmFtZSkuXG5jb25zdCBDT01NX1RZUEVTID0gWydDYWxsJywgJ0VtYWlsJywgJ1RleHQnLCAnSW4tcGVyc29uIC8gTWVldGluZycsICdWaWRlbyBDYWxsJywgJ05vdGUnXTtcblxuaW50ZXJmYWNlIExpdmVDb21tIHtcbiAgZW50cnlJZDogc3RyaW5nO1xuICBkYXRlOiBzdHJpbmc7IHR5cGU6IHN0cmluZzsgc3ViamVjdDogc3RyaW5nOyBub3Rlczogc3RyaW5nOyBjb250YWN0OiBzdHJpbmc7XG4gIGxvZ2dlZEJ5OiBzdHJpbmc7IGxvZ2dlZEF0OiBzdHJpbmc7XG59XG5cbi8vIFBlci1jbGllbnQgY29tbXVuaWNhdGlvbnMgY2FjaGUgc28gdGhlIHNlY3Rpb24gZG9lc24ndCByZWZldGNoIG9uIGV2ZXJ5IHJlbmRlci5cbmludGVyZmFjZSBDb21tc1N0YXRlIHsgbGlzdDogTGl2ZUNvbW1bXSB8IG51bGw7IGxvYWRpbmc6IGJvb2xlYW47IGVycm9yOiBzdHJpbmcgfCBudWxsOyB9XG5jb25zdCBDT01NU19DQUNIRTogeyBbY2xpZW50SWQ6IHN0cmluZ106IENvbW1zU3RhdGUgfSA9IHt9O1xuXG5mdW5jdGlvbiBjb21tc1N0YXRlKGNpZDogc3RyaW5nKTogQ29tbXNTdGF0ZSB7XG4gIGlmICghQ09NTVNfQ0FDSEVbY2lkXSkgQ09NTVNfQ0FDSEVbY2lkXSA9IHsgbGlzdDogbnVsbCwgbG9hZGluZzogZmFsc2UsIGVycm9yOiBudWxsIH07XG4gIHJldHVybiBDT01NU19DQUNIRVtjaWRdO1xufVxuXG4vLyBMb2FkIChvciByZWxvYWQpIGEgY2xpZW50J3MgY29tbXVuaWNhdGlvbnMsIHRoZW4gcmUtcmVuZGVyLlxuYXN5bmMgZnVuY3Rpb24gbG9hZENvbW11bmljYXRpb25zKGNpZDogc3RyaW5nLCBmb3JjZSA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHN0ID0gY29tbXNTdGF0ZShjaWQpO1xuICBpZiAoc3QubG9hZGluZykgcmV0dXJuO1xuICBpZiAoc3QubGlzdCAmJiAhZm9yY2UpIHJldHVybjtcbiAgc3QubG9hZGluZyA9IHRydWU7IHN0LmVycm9yID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBjb25zdCByb3dzID0gYXdhaXQgYXBpTGlzdENvbW11bmljYXRpb25zKGNpZCk7XG4gICAgc3QubGlzdCA9IChBcnJheS5pc0FycmF5KHJvd3MpID8gcm93cyA6IFtdKS5tYXAobm9ybWFsaXplQ29tbSk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIHN0LmVycm9yID0gZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSk7XG4gICAgc3QubGlzdCA9IG51bGw7XG4gIH0gZmluYWxseSB7XG4gICAgc3QubG9hZGluZyA9IGZhbHNlO1xuICAgIGlmICh0eXBlb2YgcmVuZGVyID09PSAnZnVuY3Rpb24nKSByZW5kZXIoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBub3JtYWxpemVDb21tKHI6IGFueSk6IExpdmVDb21tIHtcbiAgcmV0dXJuIHtcbiAgICBlbnRyeUlkOiBTdHJpbmcoci5lbnRyeUlkIHx8ICcnKSxcbiAgICBkYXRlOiByLmRhdGUgfHwgJycsIHR5cGU6IHIudHlwZSB8fCAnJywgc3ViamVjdDogci5zdWJqZWN0IHx8ICcnLFxuICAgIG5vdGVzOiByLm5vdGVzIHx8ICcnLCBjb250YWN0OiByLmNvbnRhY3QgfHwgJycsXG4gICAgbG9nZ2VkQnk6IHIubG9nZ2VkQnkgfHwgJycsIGxvZ2dlZEF0OiByLmxvZ2dlZEF0IHx8ICcnLFxuICB9O1xufVxuXG4vLyBsb2dnZWRBdCBjb21lcyBiYWNrIGFzIGFuIElTTy04NjAxIFpvbmVkRGF0ZVRpbWUgc3RyaW5nOyByZW5kZXIgaXQgY29tcGFjdGx5LlxuZnVuY3Rpb24gZm10Q29tbVN0YW1wKGlzbzogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKCFpc28pIHJldHVybiAnJztcbiAgY29uc3QgZCA9IG5ldyBEYXRlKGlzbyk7XG4gIGlmIChpc05hTihkLmdldFRpbWUoKSkpIHJldHVybiAnJztcbiAgcmV0dXJuIGQudG9Mb2NhbGVEYXRlU3RyaW5nKCdlbi1VUycsIHsgbW9udGg6ICdzaG9ydCcsIGRheTogJzItZGlnaXQnLCB5ZWFyOiAnbnVtZXJpYycgfSlcbiAgICArICcgXHUwMEI3ICcgKyBkLnRvTG9jYWxlVGltZVN0cmluZygnZW4tVVMnLCB7IGhvdXI6ICdudW1lcmljJywgbWludXRlOiAnMi1kaWdpdCcgfSk7XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBzZWN0aW9uIHZpZXcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5mdW5jdGlvbiBjb21tdW5pY2F0aW9uc1NlY3Rpb24oYzogQ2xpZW50KTogc3RyaW5nIHtcbiAgY29uc3Qgc3QgPSBjb21tc1N0YXRlKGMuaWQpO1xuICAvLyBUaGUgY29udGFjdCBkYXRhbGlzdCBpbiB0aGUgbW9kYWwgaXMgZmVkIGJ5IHRoZSBjbGllbnQncyBjb250YWN0cyBcdTIwMTQgd2FybSBpdC5cbiAgY29uc3QgY3N0ID0gY29udGFjdHNTdGF0ZShjLmlkKTtcbiAgaWYgKGNzdC5saXN0ID09PSBudWxsICYmICFjc3QubG9hZGluZyAmJiAhY3N0LmVycm9yKSBsb2FkQ29udGFjdHMoYy5pZCk7XG5cbiAgY29uc3QgaGVhZCA9IGA8ZGl2IGNsYXNzPVwic2VjdGlvbi1oZWFkXCI+XG4gICAgPGRpdj48aDM+Q29tbXVuaWNhdGlvbnM8L2gzPjxwPkNhbGxzLCBlbWFpbHMsIHRleHRzLCBhbmQgbm90ZXMgbG9nZ2VkIGZvciAke2VzYyhjLmZpcnN0KX0uPC9wPjwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJzZWMtYWN0aW9uc1wiPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBvdXRsaW5lXCIgb25jbGljaz1cIm9wZW5FbWFpbENvbXBvc2VyKCcke2VzYyhjLmlkKX0nKVwiPiR7aWMoJ3NlbmQnLCAxNSl9IFNlbmQgZW1haWw8L2J1dHRvbj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeVwiIG9uY2xpY2s9XCJvcGVuQ29tbU1vZGFsKCcke2VzYyhjLmlkKX0nKVwiPiR7aWMoJ3BsdXMnLCAxNSl9IExvZyBjb21tdW5pY2F0aW9uPC9idXR0b24+XG4gICAgPC9kaXY+XG4gIDwvZGl2PmA7XG5cbiAgaWYgKHN0Lmxpc3QgPT09IG51bGwpIHtcbiAgICBpZiAoIXN0LmxvYWRpbmcgJiYgIXN0LmVycm9yKSBsb2FkQ29tbXVuaWNhdGlvbnMoYy5pZCk7XG4gICAgY29uc3QgYm9keSA9IHN0LmVycm9yXG4gICAgICA/IGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdhbGVydCcsIDIyKX08L2Rpdj48Yj5Db3VsZG4ndCBsb2FkIGNvbW11bmljYXRpb25zPC9iPlxuICAgICAgICAgPHA+JHtlc2Moc3QuZXJyb3IpfTwvcD48YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnlcIiBvbmNsaWNrPVwibG9hZENvbW11bmljYXRpb25zKCcke2VzYyhjLmlkKX0nLCB0cnVlKVwiPiR7aWMoJ2Nsb2NrJywgMTUpfSBSZXRyeTwvYnV0dG9uPjwvZGl2PjwvZGl2PmBcbiAgICAgIDogYDxkaXYgY2xhc3M9XCJjYXJkXCI+PGRpdiBjbGFzcz1cImVtcHR5XCI+PGRpdiBjbGFzcz1cImljb1wiPiR7aWMoJ2Nsb2NrJywgMjIpfTwvZGl2PjxiPkxvYWRpbmcgY29tbXVuaWNhdGlvbnNcdTIwMjY8L2I+PHA+RmV0Y2hpbmcgZnJvbSB0aGUgcmVjb3JkLjwvcD48L2Rpdj48L2Rpdj5gO1xuICAgIHJldHVybiBoZWFkICsgYm9keTtcbiAgfVxuXG4gIGlmICghc3QubGlzdC5sZW5ndGgpIHtcbiAgICByZXR1cm4gaGVhZCArIGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdtc2cnLCAyMil9PC9kaXY+XG4gICAgICA8Yj5ObyBjb21tdW5pY2F0aW9ucyB5ZXQ8L2I+PHA+TG9nIGEgY2FsbCwgZW1haWwsIG9yIG5vdGUgdG8gc3RhcnQgdGhlIGhpc3RvcnkgZm9yIHRoaXMgY2xpZW50LjwvcD5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeVwiIG9uY2xpY2s9XCJvcGVuQ29tbU1vZGFsKCcke2VzYyhjLmlkKX0nKVwiPiR7aWMoJ3BsdXMnLCAxNSl9IExvZyBjb21tdW5pY2F0aW9uPC9idXR0b24+PC9kaXY+PC9kaXY+YDtcbiAgfVxuXG4gIC8vIE1vc3QgcmVjZW50IGZpcnN0IFx1MjAxNCBieSBjb21tdW5pY2F0aW9uIGRhdGUsIHRoZW4gYnkgbG9nZ2VkLWF0IGFzIGEgdGllYnJlYWsuXG4gIGNvbnN0IHNvcnRlZCA9IHN0Lmxpc3Quc2xpY2UoKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgY29uc3QgZCA9IChiLmRhdGUgfHwgJycpLmxvY2FsZUNvbXBhcmUoYS5kYXRlIHx8ICcnKTtcbiAgICByZXR1cm4gZCAhPT0gMCA/IGQgOiAoYi5sb2dnZWRBdCB8fCAnJykubG9jYWxlQ29tcGFyZShhLmxvZ2dlZEF0IHx8ICcnKTtcbiAgfSk7XG4gIGNvbnN0IHJvd3MgPSBzb3J0ZWQubWFwKGNtID0+IGNvbW1DYXJkKGMuaWQsIGNtKSkuam9pbignJyk7XG4gIHJldHVybiBoZWFkICsgYDxkaXYgY2xhc3M9XCJjb21tLWxpc3RcIj4ke3Jvd3N9PC9kaXY+YDtcbn1cblxuLy8gTm90ZXMgbWVtb3MgaG9sZCByaWNoIHRleHQ6IGVtYWlsIHNlbmRzIHN0b3JlIEhUTUwgKDxiPiwgPGJyPiwgbGlua3MpLCB3aGlsZVxuLy8gbWFudWFsbHktbG9nZ2VkIG5vdGVzIGNvbWUgZnJvbSBhIHBsYWluIHRleHRhcmVhLiBSZW5kZXIgSFRNTCBhcy1pczsgZXNjYXBlXG4vLyBwbGFpbiB0ZXh0IGFuZCB0dXJuIGl0cyBuZXdsaW5lcyBpbnRvIDxicj4gc28gbGluZSBicmVha3Mgc3Vydml2ZS5cbmZ1bmN0aW9uIHJlbmRlckNvbW1Ob3Rlcyhub3Rlczogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKCFub3RlcykgcmV0dXJuICcnO1xuICBjb25zdCBsb29rc0h0bWwgPSAvPFxcLz8oYnJ8YnxpfHV8cHxkaXZ8c3Bhbnx1bHxvbHxsaXxhfHN0cm9uZ3xlbXxoWzEtNl18YmxvY2txdW90ZXx0YWJsZXx0cnx0ZClcXGJbXj5dKj4vaS50ZXN0KG5vdGVzKTtcbiAgcmV0dXJuIGxvb2tzSHRtbCA/IG5vdGVzIDogZXNjKG5vdGVzKS5yZXBsYWNlKC9cXG4vZywgJzxicj4nKTtcbn1cblxuZnVuY3Rpb24gY29tbUNhcmQoY2lkOiBzdHJpbmcsIGNtOiBMaXZlQ29tbSk6IHN0cmluZyB7XG4gIGNvbnN0IHdoZW4gPSBmbXREYXRlKGNtLmRhdGUpIHx8ICdcdTIwMTQnO1xuICBjb25zdCB0eXBlQ2hpcCA9IGNtLnR5cGUgPyBgPHNwYW4gY2xhc3M9XCJjb21tLXR5cGVcIj4ke2VzYyhjbS50eXBlKX08L3NwYW4+YCA6ICcnO1xuICBjb25zdCBzdWJqZWN0ID0gY20uc3ViamVjdCA/IGVzYyhjbS5zdWJqZWN0KSA6ICc8c3BhbiBzdHlsZT1cImNvbG9yOnZhcigtLW11dGVkLWZvcmVncm91bmQpXCI+KG5vIHN1YmplY3QpPC9zcGFuPic7XG4gIGNvbnN0IG1ldGEgPSBbXG4gICAgY20uY29udGFjdCA/IGAke2ljKCd1c2VycycsIDEzKX08c3Bhbj4ke2VzYyhjbS5jb250YWN0KX08L3NwYW4+YCA6ICcnLFxuICBdLmZpbHRlcihCb29sZWFuKS5qb2luKCcnKTtcbiAgY29uc3Qgc3RhbXAgPSBjbS5sb2dnZWRCeSB8fCBjbS5sb2dnZWRBdFxuICAgID8gYDxkaXYgY2xhc3M9XCJjb21tLWZvb3RcIj5Mb2dnZWQke2NtLmxvZ2dlZEJ5ID8gJyBieSAnICsgZXNjKGNtLmxvZ2dlZEJ5KSA6ICcnfSR7Y20ubG9nZ2VkQXQgPyAnIFx1MDBCNyAnICsgZXNjKGZtdENvbW1TdGFtcChjbS5sb2dnZWRBdCkpIDogJyd9PC9kaXY+YFxuICAgIDogJyc7XG5cbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiY2FyZCBjb21tLWNhcmRcIj5cbiAgICA8ZGl2IGNsYXNzPVwiY29tbS10b3BcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJjb21tLWRhdGVcIj4ke2ljKCdjYWxlbmRhcicsIDE0KX08c3Bhbj4ke2VzYyh3aGVuKX08L3NwYW4+PC9kaXY+XG4gICAgICAke3R5cGVDaGlwfVxuICAgICAgPHNwYW4gc3R5bGU9XCJmbGV4OjFcIj48L3NwYW4+XG4gICAgICA8ZGl2IGNsYXNzPVwiY2MtYWN0c1wiPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwiaWNvLW1pbmlcIiB0aXRsZT1cIkVkaXRcIiBvbmNsaWNrPVwib3BlbkNvbW1Nb2RhbCgnJHtlc2MoY2lkKX0nLCcke2VzYyhjbS5lbnRyeUlkKX0nKVwiPiR7aWMoJ2VkaXQnLCAxNSl9PC9idXR0b24+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJpY28tbWluaSBkYW5nZXJcIiB0aXRsZT1cIkRlbGV0ZVwiIG9uY2xpY2s9XCJkZWxldGVDb21tUHJvbXB0KCcke2VzYyhjaWQpfScsJyR7ZXNjKGNtLmVudHJ5SWQpfScpXCI+JHtpYygndHJhc2gnLCAxNSl9PC9idXR0b24+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwiY29tbS1zdWJqZWN0XCI+JHtzdWJqZWN0fTwvZGl2PlxuICAgICR7Y20ubm90ZXMgPyBgPGRpdiBjbGFzcz1cImNvbW0tbm90ZXNcIj4ke3JlbmRlckNvbW1Ob3RlcyhjbS5ub3Rlcyl9PC9kaXY+YCA6ICcnfVxuICAgICR7bWV0YSA/IGA8ZGl2IGNsYXNzPVwiY29tbS1tZXRhXCI+JHttZXRhfTwvZGl2PmAgOiAnJ31cbiAgICAke3N0YW1wfVxuICA8L2Rpdj5gO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgYWRkIC8gZWRpdCBtb2RhbCBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIFRoZSBjb250YWN0IGNvbnRyb2wgaXMgYSBmcmVlLXRleHQgaW5wdXQgYmFja2VkIGJ5IGEgPGRhdGFsaXN0PiBvZiB0aGVcbi8vIGNsaWVudCdzIGV4aXN0aW5nIGNvbnRhY3RzIFx1MjAxNCBwaWNrIG9uZSBvciB0eXBlIGFueXRoaW5nOyB0aGUgdmFsdWUgaXMgc3RvcmVkXG4vLyB2ZXJiYXRpbSAoc2FtZSBcInN0b3JlIHRoZSBsYWJlbFwiIGFwcHJvYWNoIGFzIHRoZSBjb250YWN0cyByZWxhdGlvbnNoaXAgZmllbGQpLlxuZnVuY3Rpb24gY29tbUNvbnRhY3RDb250cm9sKGNpZDogc3RyaW5nLCBjdXJyZW50OiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBjc3QgPSBjb250YWN0c1N0YXRlKGNpZCk7XG4gIGNvbnN0IG5hbWVzID0gKGNzdC5saXN0IHx8IFtdKVxuICAgIC5tYXAoY3QgPT4gKGN0LmZpcnN0TmFtZSArICcgJyArIGN0Lmxhc3ROYW1lKS50cmltKCkpXG4gICAgLmZpbHRlcihCb29sZWFuKTtcbiAgY29uc3Qgb3B0cyA9IG5hbWVzLm1hcChuID0+IGA8b3B0aW9uIHZhbHVlPVwiJHtlc2Mobil9XCI+PC9vcHRpb24+YCkuam9pbignJyk7XG4gIHJldHVybiBgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgZGF0YS1rPVwiY29udGFjdFwiIGxpc3Q9XCJfX2NvbW1Db250YWN0c1wiIHZhbHVlPVwiJHtlc2MoY3VycmVudCB8fCAnJyl9XCJcbiAgICBwbGFjZWhvbGRlcj1cIldobyB3YXMgdGhpcyB3aXRoPyAob3B0aW9uYWwpXCIgYXV0b2NvbXBsZXRlPVwib2ZmXCI+XG4gICAgPGRhdGFsaXN0IGlkPVwiX19jb21tQ29udGFjdHNcIj4ke29wdHN9PC9kYXRhbGlzdD5gO1xufVxuXG5mdW5jdGlvbiBjb21tVHlwZUNvbnRyb2woY3VycmVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgY2hvaWNlcyA9IFsnJ10uY29uY2F0KENPTU1fVFlQRVMpO1xuICByZXR1cm4gYDxzZWxlY3QgZGF0YS1rPVwidHlwZVwiPiR7Y2hvaWNlcy5tYXAobyA9PlxuICAgIGA8b3B0aW9uIHZhbHVlPVwiJHtlc2Mobyl9XCIke28gPT09IGN1cnJlbnQgPyAnIHNlbGVjdGVkJyA6ICcnfT4ke28gPyBlc2MobykgOiAnXHUyMDE0J308L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD5gO1xufVxuXG5mdW5jdGlvbiB0b2RheUlTTygpOiBzdHJpbmcge1xuICBjb25zdCBkID0gbmV3IERhdGUoKTtcbiAgY29uc3QgbSA9IChkLmdldE1vbnRoKCkgKyAxKS50b1N0cmluZygpLnBhZFN0YXJ0KDIsICcwJyk7XG4gIGNvbnN0IGRheSA9IGQuZ2V0RGF0ZSgpLnRvU3RyaW5nKCkucGFkU3RhcnQoMiwgJzAnKTtcbiAgcmV0dXJuIGQuZ2V0RnVsbFllYXIoKSArICctJyArIG0gKyAnLScgKyBkYXk7XG59XG5cbmZ1bmN0aW9uIG9wZW5Db21tTW9kYWwoY2lkOiBzdHJpbmcsIGVudHJ5SWQ/OiBzdHJpbmcpOiB2b2lkIHtcbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX2NvbW1Nb2RhbCcpKSBjbG9zZUNvbW1Nb2RhbCgpO1xuICBjb25zdCBzdCA9IGNvbW1zU3RhdGUoY2lkKTtcbiAgY29uc3QgY20gPSBlbnRyeUlkICYmIHN0Lmxpc3QgPyAoc3QubGlzdC5maWx0ZXIoeCA9PiB4LmVudHJ5SWQgPT09IGVudHJ5SWQpWzBdIHx8IG51bGwpIDogbnVsbDtcbiAgY29uc3QgZWRpdGluZyA9ICEhY207XG4gIGNvbnN0IGRhdGVWYWwgPSBjbSA/IGNtLmRhdGUgOiB0b2RheUlTTygpO1xuXG4gIGNvbnN0IGhvc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgaG9zdC5jbGFzc05hbWUgPSAnbW9kYWwtb3ZlcmxheSc7XG4gIGhvc3QuaWQgPSAnX19jb21tTW9kYWwnO1xuICBob3N0LmlubmVySFRNTCA9IGA8ZGl2IGNsYXNzPVwibW9kYWwtY2FyZFwiIHJvbGU9XCJkaWFsb2dcIiBhcmlhLW1vZGFsPVwidHJ1ZVwiIGFyaWEtbGFiZWw9XCIke2VkaXRpbmcgPyAnRWRpdCBjb21tdW5pY2F0aW9uJyA6ICdMb2cgY29tbXVuaWNhdGlvbid9XCJcbiAgICAgIGRhdGEtY2lkPVwiJHtlc2MoY2lkKX1cIiBkYXRhLWVudHJ5PVwiJHtlc2MoZW50cnlJZCB8fCAnJyl9XCI+XG4gICAgPGRpdiBjbGFzcz1cIm1vZGFsLWhlYWRcIj5cbiAgICAgIDxkaXY+PGI+JHtlZGl0aW5nID8gJ0VkaXQgY29tbXVuaWNhdGlvbicgOiAnTG9nIGNvbW11bmljYXRpb24nfTwvYj48cD4ke2VkaXRpbmcgPyAnVXBkYXRlIHRoaXMgbG9nIGVudHJ5LicgOiAnUmVjb3JkIGEgY2FsbCwgZW1haWwsIHRleHQsIG1lZXRpbmcsIG9yIG5vdGUuJ308L3A+PC9kaXY+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiaWNvLXhcIiB0aXRsZT1cIkNsb3NlXCIgb25jbGljaz1cImNsb3NlQ29tbU1vZGFsKClcIj4ke2ljKCd4JywgMTgpfTwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1ib2R5XCI+XG4gICAgICA8ZGl2IGNsYXNzPVwibW9kYWwtZXJyXCIgaGlkZGVuPjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImZpZWxkLWdyaWRcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImZpZWxkXCI+PGxhYmVsPkRhdGU8L2xhYmVsPjxpbnB1dCB0eXBlPVwiZGF0ZVwiIGRhdGEtaz1cImRhdGVcIiB2YWx1ZT1cIiR7ZXNjKGRhdGVWYWwpfVwiPjwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmllbGRcIj48bGFiZWw+VHlwZTwvbGFiZWw+JHtjb21tVHlwZUNvbnRyb2woY20gPyBjbS50eXBlIDogJycpfTwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmllbGQgZnVsbFwiPjxsYWJlbD5XaG8gd2FzIHRoaXMgd2l0aD88L2xhYmVsPiR7Y29tbUNvbnRhY3RDb250cm9sKGNpZCwgY20gPyBjbS5jb250YWN0IDogJycpfTwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmllbGQgZnVsbFwiPjxsYWJlbD5TdWJqZWN0PC9sYWJlbD48aW5wdXQgdHlwZT1cInRleHRcIiBkYXRhLWs9XCJzdWJqZWN0XCIgdmFsdWU9XCIke2VzYyhjbSA/IGNtLnN1YmplY3QgOiAnJyl9XCIgcGxhY2Vob2xkZXI9XCJTaG9ydCBzdW1tYXJ5XCIgYXV0b2NvbXBsZXRlPVwib2ZmXCI+PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZCBmdWxsXCI+PGxhYmVsPk5vdGVzPC9sYWJlbD48dGV4dGFyZWEgZGF0YS1rPVwibm90ZXNcIiByb3dzPVwiNVwiIHBsYWNlaG9sZGVyPVwiV2hhdCB3YXMgZGlzY3Vzc2VkP1wiPiR7ZXNjKGNtID8gY20ubm90ZXMgOiAnJyl9PC90ZXh0YXJlYT48L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1mb290XCI+XG4gICAgICA8c3BhbiBjbGFzcz1cIm1vZGFsLXN0YXR1c1wiPjwvc3Bhbj5cbiAgICAgIDxzcGFuIHN0eWxlPVwiZmxleDoxXCI+PC9zcGFuPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIG9uY2xpY2s9XCJjbG9zZUNvbW1Nb2RhbCgpXCI+JHtpYygneCcsIDE1KX0gQ2FuY2VsPC9idXR0b24+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnkganMtc2F2ZVwiIG9uY2xpY2s9XCJzYXZlQ29tbXVuaWNhdGlvbigpXCI+JHtpYygnc2F2ZScsIDE1KX0gJHtlZGl0aW5nID8gJ1NhdmUgY2hhbmdlcycgOiAnTG9nIGl0J308L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgPC9kaXY+YDtcbiAgaG9zdC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBlID0+IHsgaWYgKGUudGFyZ2V0ID09PSBob3N0KSBjbG9zZUNvbW1Nb2RhbCgpOyB9KTtcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChob3N0KTtcbiAgY29uc3Qgc3ViaiA9IGhvc3QucXVlcnlTZWxlY3RvcignaW5wdXRbZGF0YS1rPVwic3ViamVjdFwiXScpIGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsO1xuICBpZiAoc3Viaikgc3Viai5mb2N1cygpO1xuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgY29tbUVzY0Nsb3NlKTtcbn1cblxuZnVuY3Rpb24gY29tbUVzY0Nsb3NlKGU6IEtleWJvYXJkRXZlbnQpOiB2b2lkIHtcbiAgaWYgKGUua2V5ICE9PSAnRXNjYXBlJykgcmV0dXJuO1xuICBjbG9zZUNvbW1Nb2RhbCgpO1xufVxuXG5mdW5jdGlvbiBjbG9zZUNvbW1Nb2RhbCgpOiB2b2lkIHtcbiAgY29uc3QgbSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX2NvbW1Nb2RhbCcpO1xuICBpZiAobSkgbS5yZW1vdmUoKTtcbiAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGNvbW1Fc2NDbG9zZSk7XG59XG5cbmZ1bmN0aW9uIHNldENvbW1Nb2RhbEVycm9yKG1zZzogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI19fY29tbU1vZGFsIC5tb2RhbC1lcnInKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmICghZWwpIHJldHVybjtcbiAgaWYgKG1zZykgeyBlbC50ZXh0Q29udGVudCA9IG1zZzsgZWwuaGlkZGVuID0gZmFsc2U7IH0gZWxzZSB7IGVsLnRleHRDb250ZW50ID0gJyc7IGVsLmhpZGRlbiA9IHRydWU7IH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc2F2ZUNvbW11bmljYXRpb24oKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IG1vZGFsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI19fY29tbU1vZGFsIC5tb2RhbC1jYXJkJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoIW1vZGFsKSByZXR1cm47XG4gIGNvbnN0IGNpZCA9IG1vZGFsLmdldEF0dHJpYnV0ZSgnZGF0YS1jaWQnKSB8fCAnJztcbiAgY29uc3QgZW50cnlJZCA9IG1vZGFsLmdldEF0dHJpYnV0ZSgnZGF0YS1lbnRyeScpIHx8ICcnO1xuICBpZiAoIWNpZCkgeyBzZXRDb21tTW9kYWxFcnJvcignTWlzc2luZyBjbGllbnQgaWQuJyk7IHJldHVybjsgfVxuXG4gIGNvbnN0IGZpZWxkczogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuICBtb2RhbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1rXScpLmZvckVhY2goZWwgPT4ge1xuICAgIGNvbnN0IGsgPSAoZWwgYXMgSFRNTEVsZW1lbnQpLmRhdGFzZXQuayBhcyBzdHJpbmc7XG4gICAgZmllbGRzW2tdID0gKGVsIGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50IHwgSFRNTFNlbGVjdEVsZW1lbnQpLnZhbHVlLnRyaW0oKTtcbiAgfSk7XG5cbiAgc2V0Q29tbU1vZGFsRXJyb3IoJycpO1xuICBpZiAoIWZpZWxkcy5zdWJqZWN0ICYmICFmaWVsZHMubm90ZXMpIHsgc2V0Q29tbU1vZGFsRXJyb3IoJ0VudGVyIGEgc3ViamVjdCBvciBzb21lIG5vdGVzLicpOyByZXR1cm47IH1cblxuICBjb25zdCBzYXZlQnRuID0gbW9kYWwucXVlcnlTZWxlY3RvcignLmpzLXNhdmUnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG4gIGNvbnN0IHN0YXR1cyA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC1zdGF0dXMnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmIChzYXZlQnRuKSBzYXZlQnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgaWYgKHN0YXR1cykgc3RhdHVzLnRleHRDb250ZW50ID0gJ1NhdmluZ1x1MjAyNic7XG5cbiAgdHJ5IHtcbiAgICBpZiAoZW50cnlJZCkgYXdhaXQgYXBpVXBkYXRlQ29tbXVuaWNhdGlvbihjaWQsIGVudHJ5SWQsIGZpZWxkcyk7XG4gICAgZWxzZSBhd2FpdCBhcGlBZGRDb21tdW5pY2F0aW9uKGNpZCwgZmllbGRzKTtcbiAgICBjbG9zZUNvbW1Nb2RhbCgpO1xuICAgIGF3YWl0IGxvYWRDb21tdW5pY2F0aW9ucyhjaWQsIHRydWUpO1xuICAgIHRvYXN0KGVudHJ5SWQgPyAnQ29tbXVuaWNhdGlvbiB1cGRhdGVkJyA6ICdDb21tdW5pY2F0aW9uIGxvZ2dlZCcpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBpZiAoc2F2ZUJ0bikgc2F2ZUJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICcnO1xuICAgIHNldENvbW1Nb2RhbEVycm9yKGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBkZWxldGVDb21tUHJvbXB0KGNpZDogc3RyaW5nLCBlbnRyeUlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKCFlbnRyeUlkKSByZXR1cm47XG4gIGlmICghd2luZG93LmNvbmZpcm0oJ0RlbGV0ZSB0aGlzIGNvbW11bmljYXRpb24/IFRoaXMgY2FuXFwndCBiZSB1bmRvbmUuJykpIHJldHVybjtcbiAgdHJ5IHtcbiAgICBhd2FpdCBhcGlEZWxldGVDb21tdW5pY2F0aW9uKGNpZCwgZW50cnlJZCk7XG4gICAgYXdhaXQgbG9hZENvbW11bmljYXRpb25zKGNpZCwgdHJ1ZSk7XG4gICAgdG9hc3QoJ0NvbW11bmljYXRpb24gZGVsZXRlZCcpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICB0b2FzdCgnRGVsZXRlIGZhaWxlZDogJyArIChlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSkpO1xuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFpQkEsTUFBTSxhQUFhLENBQUMsUUFBUSxTQUFTLFFBQVEsdUJBQXVCLGNBQWMsTUFBTTtBQVV4RixNQUFNLGNBQWtELENBQUM7QUFFekQsU0FBUyxXQUFXLEtBQXlCO0FBQzNDLE1BQUksQ0FBQyxZQUFZLEdBQUcsRUFBRyxhQUFZLEdBQUcsSUFBSSxFQUFFLE1B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
