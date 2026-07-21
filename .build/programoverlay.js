const PROGRAM_NOTE_TYPES = ["General", "Tour", "Call", "Concern", "Update"];
const TOUR_FORMATS = ["In-person", "Virtual"];
const PO_CACHE = {};
function poState(dpid) {
  if (!PO_CACHE[dpid]) PO_CACHE[dpid] = { overlay: void 0, notes: null, ovLoading: false, notesLoading: false, error: null };
  return PO_CACHE[dpid];
}
function poHints(p) {
  return {
    directorySlug: p.aktProfile || p.website || "",
    cachedName: p.programName || "",
    cachedLocation: p.location || "",
    cachedType: p.programType && p.programType[0] || ""
  };
}
const PO_HINTS = {};
async function loadProgramOverlay(dpid, force = false) {
  const st = poState(dpid);
  if (st.ovLoading) return;
  if (st.overlay !== void 0 && !force) return;
  st.ovLoading = true;
  st.error = null;
  try {
    st.overlay = await apiGetProgramOverlay(dpid) || null;
  } catch (e) {
    st.error = e && e.message ? e.message : String(e);
    st.overlay = null;
  } finally {
    st.ovLoading = false;
    if (typeof render === "function") render();
  }
}
async function loadProgramNotes(dpid, force = false) {
  const st = poState(dpid);
  if (st.notesLoading) return;
  if (st.notes && !force) return;
  st.notesLoading = true;
  try {
    const rows = await apiListProgramNotes(dpid);
    st.notes = (Array.isArray(rows) ? rows : []).map(normalizeProgramNote);
  } catch (e) {
    st.error = e && e.message ? e.message : String(e);
    st.notes = null;
  } finally {
    st.notesLoading = false;
    if (typeof render === "function") render();
  }
}
function normalizeProgramNote(r) {
  return {
    entryId: String(r.entryId || ""),
    body: r.body || "",
    noteType: r.noteType || "",
    tourDate: r.tourDate || "",
    tourFormat: r.tourFormat || "",
    createdBy: r.createdBy || "",
    createdAt: r.createdAt || ""
  };
}
function registerProgramHints(p) {
  PO_HINTS[p.id] = poHints(p);
}
function programLogoUrl(dpid) {
  const ov = poState(dpid).overlay;
  return ov && ov.logo ? String(ov.logo) : "";
}
function programLogoUpload(dpid) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    try {
      const dataUrl = await fileToDataUrl(f);
      openCropper(dataUrl, async (out) => {
        const comma = out.indexOf(",");
        const b64 = comma >= 0 ? out.slice(comma + 1) : out;
        try {
          const ov = await apiSetProgramLogo(dpid, PO_HINTS[dpid] || {}, { dataBase64: b64, filename: "logo.png", contentType: "image/png" });
          if (ov) poState(dpid).overlay = ov;
          if (typeof render === "function") render();
          toast("Logo updated");
        } catch (e) {
          toast("Logo upload failed: " + (e && e.message ? e.message : String(e)));
        }
      });
    } catch (_e) {
      toast("Could not read that image.");
    }
  };
  input.click();
}
function summaryProgramSection(p) {
  const dpid = p.id;
  registerProgramHints(p);
  const st = poState(dpid);
  if (st.overlay === void 0 && !st.ovLoading) loadProgramOverlay(dpid);
  const savedRating = st.overlay ? Number(st.overlay.internalRating) || 0 : 0;
  const rating = st.saving && typeof st.pendingRating === "number" ? st.pendingRating : savedRating;
  const summary = st.overlay ? st.overlay.privateSummary || "" : "";
  const stars = [1, 2, 3, 4, 5].map(
    (n) => `<button class="pov-star${n <= rating ? " on" : ""}" title="${n} star${n > 1 ? "s" : ""}" onclick="setProgramRating('${esc(dpid)}',${n})">${ic("star", 20)}</button>`
  ).join("");
  const clearStar = rating ? `<button class="pov-star-clear" title="Clear rating" onclick="setProgramRating('${esc(dpid)}',0)">${ic("x", 14)}</button>` : "";
  const saving = st.saving ? `<span class="pov-saving"><span class="spin"></span>Saving\u2026</span>` : "";
  const pops = (p.populationsRaw || "").trim();
  return `<div class="section-head"><div><h3>Summary</h3><p>Your private rating and take on this program.</p></div></div>
  <div class="card card-pad pov${st.saving ? " saving" : ""}">
    ${saving}
    <div class="pov-rating">
      <span class="pov-label">Your rating</span>
      <span class="pov-stars">${stars}</span>${clearStar}
    </div>
    <div class="pov-summary">
      <label class="pov-label" for="pov-sum-${esc(dpid)}">Private summary</label>
      <textarea id="pov-sum-${esc(dpid)}" class="pov-sum-input" rows="3" placeholder="Your private take on this program\u2026">${esc(summary)}</textarea>
      <div class="pov-sum-actions"><button id="pov-sum-${esc(dpid)}-save" class="btn ghost sm" onclick="saveProgramSummary('${esc(dpid)}')">${ic("check", 14)} Save summary</button></div>
    </div>
  </div>
  ${pops ? `<div class="card card-pad prog-sec"><div class="sec-h">Populations &amp; Specialties</div><div class="sec-body">${esc(pops)}</div></div>` : ""}`;
}
function notesProgramSection(p) {
  const dpid = p.id;
  registerProgramHints(p);
  const st = poState(dpid);
  if (st.notes === null && !st.notesLoading) loadProgramNotes(dpid);
  const head = `<div class="section-head">
    <div><h3>Notes</h3><p>Private notes on this program \u2014 calls, tours, and observations.</p></div>
    <button class="btn primary" onclick="openProgramNoteModal('${esc(dpid)}')">${ic("plus", 15)} Add note</button>
  </div>`;
  return head + renderProgramNotes(dpid, st);
}
function renderProgramNotes(dpid, st) {
  if (st.notes === null) {
    return `<div class="pov-empty">${st.error ? esc(st.error) : "Loading notes\u2026"}</div>`;
  }
  if (!st.notes.length) return `<div class="pov-empty">No notes yet \u2014 add a call, tour, or general note.</div>`;
  const notes = st.notes.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return `<div class="pov-note-list">${notes.map((n) => programNoteCard(dpid, n)).join("")}</div>`;
}
function programNoteCard(dpid, n) {
  const typeMod = n.noteType === "Concern" ? " concern" : n.noteType === "Tour" ? " tour" : "";
  const typeChip = n.noteType ? `<span class="pov-note-type${typeMod}">${esc(n.noteType)}</span>` : "";
  const tourBits = [n.tourDate ? fmtDate(n.tourDate) || n.tourDate : "", n.tourFormat].filter(Boolean).join(" \xB7 ");
  const tour = n.noteType === "Tour" && tourBits ? `<span class="pov-note-tour">${ic("calendar", 12)} ${esc(tourBits)}</span>` : "";
  const foot = n.createdBy || n.createdAt ? `<div class="pov-note-foot">${esc(n.createdBy || "")}${n.createdAt ? " \xB7 " + esc(fmtDate(n.createdAt) || n.createdAt) : ""}</div>` : "";
  return `<div class="pov-note">
    <div class="pov-note-top">${typeChip}${tour}<span style="flex:1"></span>
      <button class="ico-mini" title="Edit" onclick="openProgramNoteModal('${esc(dpid)}','${esc(n.entryId)}')">${ic("edit", 14)}</button>
      <button class="ico-mini danger" title="Delete" onclick="deleteProgramNotePrompt('${esc(dpid)}','${esc(n.entryId)}')">${ic("trash", 14)}</button>
    </div>
    <div class="pov-note-body">${esc(n.body)}</div>
    ${foot}
  </div>`;
}
async function setProgramRating(dpid, n) {
  const st = poState(dpid);
  if (st.saving) return;
  st.saving = true;
  st.pendingRating = n;
  if (typeof render === "function") render();
  try {
    const ov = await apiSaveProgramOverlay(dpid, PO_HINTS[dpid] || {}, { internalRating: n });
    if (ov) st.overlay = ov;
    toast(n ? "Rated " + n + " star" + (n > 1 ? "s" : "") : "Rating cleared");
  } catch (e) {
    toast("Could not save rating: " + (e && e.message ? e.message : String(e)));
  } finally {
    st.saving = false;
    st.pendingRating = void 0;
    if (typeof render === "function") render();
  }
}
async function saveProgramSummary(dpid) {
  const btn = document.getElementById("pov-sum-" + dpid + "-save");
  const ta = document.getElementById("pov-sum-" + dpid);
  const value = ta ? ta.value.trim() : "";
  if (btn) btn.disabled = true;
  try {
    const ov = await apiSaveProgramOverlay(dpid, PO_HINTS[dpid] || {}, { privateSummary: value });
    if (ov) poState(dpid).overlay = ov;
    toast("Summary saved");
  } catch (e) {
    toast("Could not save summary: " + (e && e.message ? e.message : String(e)));
  } finally {
    if (btn) btn.disabled = false;
  }
}
function poSelect(dataK, choices, current, placeholder, extra) {
  const opts = [`<option value="">${esc(placeholder)}</option>`].concat(choices.map((o) => `<option value="${esc(o)}"${o === current ? " selected" : ""}>${esc(o)}</option>`)).join("");
  return `<select data-k="${dataK}"${extra || ""}>${opts}</select>`;
}
function openProgramNoteModal(dpid, entryId) {
  if (document.getElementById("__poNoteModal")) closeProgramNoteModal();
  const st = poState(dpid);
  const n = entryId && st.notes ? st.notes.filter((x) => x.entryId === entryId)[0] || null : null;
  const editing = !!n;
  const noteType = n ? n.noteType || "General" : "General";
  const tourHidden = noteType === "Tour" ? "" : " hidden";
  const host = document.createElement("div");
  host.className = "modal-overlay";
  host.id = "__poNoteModal";
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="${editing ? "Edit note" : "Add note"}" data-dpid="${esc(dpid)}" data-entry="${esc(entryId || "")}">
    <div class="modal-head"><div><b>${editing ? "Edit note" : "Add note"}</b><p>A private note about this program.</p></div>
      <button class="ico-x" title="Close" onclick="closeProgramNoteModal()">${ic("x", 18)}</button></div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <div class="field-grid">
        <div class="field"><label>Type</label>${poSelect("noteType", PROGRAM_NOTE_TYPES, noteType, "\u2014", ' onchange="onProgramNoteTypeChange(this)"')}</div>
        <div class="field pov-tour-wrap"${tourHidden}><label>Tour date</label><input type="date" data-k="tourDate" value="${esc(n ? n.tourDate : "")}"></div>
        <div class="field pov-tour-wrap"${tourHidden}><label>Tour format</label>${poSelect("tourFormat", TOUR_FORMATS, n ? n.tourFormat : "", "\u2014")}</div>
        <div class="field full"><label>Note</label><textarea data-k="body" rows="4" placeholder="What did you learn?" autocomplete="off">${esc(n ? n.body : "")}</textarea></div>
      </div>
    </div>
    <div class="modal-foot"><span class="modal-status"></span><span style="flex:1"></span>
      <button class="btn ghost" onclick="closeProgramNoteModal()">${ic("x", 15)} Cancel</button>
      <button class="btn primary js-save" onclick="saveProgramNote()">${ic("check", 15)} ${editing ? "Save changes" : "Add note"}</button></div>
  </div>`;
  host.addEventListener("mousedown", (e) => {
    if (e.target === host) closeProgramNoteModal();
  });
  document.body.appendChild(host);
  const body = host.querySelector('textarea[data-k="body"]');
  if (body) body.focus();
  document.addEventListener("keydown", poNoteEsc);
}
function poNoteEsc(e) {
  if (e.key === "Escape") closeProgramNoteModal();
}
function closeProgramNoteModal() {
  const m = document.getElementById("__poNoteModal");
  if (m) m.remove();
  document.removeEventListener("keydown", poNoteEsc);
}
function onProgramNoteTypeChange(sel) {
  const card = sel.closest(".modal-card");
  if (!card) return;
  const show = sel.value === "Tour";
  card.querySelectorAll(".pov-tour-wrap").forEach((el) => {
    el.hidden = !show;
  });
}
function setPoNoteErr(msg) {
  const el = document.querySelector("#__poNoteModal .modal-err");
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}
async function saveProgramNote() {
  const modal = document.querySelector("#__poNoteModal .modal-card");
  if (!modal) return;
  const dpid = modal.getAttribute("data-dpid") || "";
  const entryId = modal.getAttribute("data-entry") || "";
  const fields = {};
  modal.querySelectorAll("[data-k]").forEach((el) => {
    const k = el.dataset.k;
    fields[k] = el.value.trim();
  });
  setPoNoteErr("");
  if (!fields.body) {
    setPoNoteErr("Write something in the note.");
    return;
  }
  if (fields.noteType !== "Tour") {
    fields.tourDate = "";
    fields.tourFormat = "";
  }
  const saveBtn = modal.querySelector(".js-save");
  const status = modal.querySelector(".modal-status");
  if (saveBtn) saveBtn.disabled = true;
  if (status) status.textContent = "Saving\u2026";
  try {
    if (entryId) await apiUpdateProgramNote(dpid, entryId, fields);
    else await apiAddProgramNote(dpid, PO_HINTS[dpid] || {}, fields);
    closeProgramNoteModal();
    poState(dpid).overlay = void 0;
    await Promise.all([loadProgramNotes(dpid, true), loadProgramOverlay(dpid, true)]);
    toast(entryId ? "Note updated" : "Note added");
  } catch (e) {
    if (saveBtn) saveBtn.disabled = false;
    if (status) status.textContent = "";
    setPoNoteErr(e && e.message ? e.message : String(e));
  }
}
async function deleteProgramNotePrompt(dpid, entryId) {
  if (!entryId) return;
  if (!window.confirm("Delete this note? This can't be undone.")) return;
  try {
    await apiDeleteProgramNote(dpid, entryId);
    await loadProgramNotes(dpid, true);
    toast("Note deleted");
  } catch (e) {
    toast("Delete failed: " + (e && e.message ? e.message : String(e)));
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsicHJvZ3JhbW92ZXJsYXkudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgcHJvZ3JhbW92ZXJsYXkudHMgXHUyMDE0IFByb2dyYW0gT3ZlcmxheSAoRGlyZWN0b3J5IExheWVyIDIpLlxuXG4gICBDb25zdWx0YW50LVBSSVZBVEUgZGF0YSBvbiBhIGRpcmVjdG9yeSBwcm9ncmFtLCByZW5kZXJlZCBvbiB0aGUgcHJvZ3JhbVxuICAgZGV0YWlsIHBhZ2UgKCMvcHJvZ3JhbXMvPGlkPik6IGEgMVx1MjAxMzUgc3RhciByYXRpbmcsIGEgcHJpdmF0ZSBzdW1tYXJ5LCBhbmRcbiAgIHRpbWVzdGFtcGVkIG5vdGVzICh3aXRoIGEgVG91ciB0eXBlIHRoYXQgcmV2ZWFscyB0b3VyIGRhdGUgKyBmb3JtYXQpLlxuXG4gICBUaGUgZGlyZWN0b3J5IHByb2dyYW0gbGl2ZXMgaW4gYSBTRVBBUkFURSBvcmcgYW5kIGlzIHJlYWQtb25seSBoZXJlOyB0aGVcbiAgIHByaXZhdGUgZGF0YSBsaXZlcyBpbiBhIExPQ0FMIG92ZXJsYXkgcmVjb3JkIHRoYXQgdGhlIG1hZXN0cm8gZmluZC1vci1jcmVhdGVzXG4gICBMQVpJTFkgb24gdGhlIGZpcnN0IHdyaXRlIChyYXRpbmcgLyBzdW1tYXJ5IC8gbm90ZSkuIFRoZSBTUEEgb25seSBldmVyIGhvbGRzXG4gICB0aGUgRElSRUNUT1JZIHByb2dyYW0gaWQgXHUyMDE0IGl0IHBhc3NlcyBkaXNwbGF5IFwiaGludHNcIiBzbyBhIGZpcnN0IHdyaXRlIGNhbiBzZWVkXG4gICB0aGUgbmV3IG92ZXJsYXkgd2l0aG91dCBhIGNyb3NzLW9yZyBmZXRjaC5cblxuICAgRmlsZXMgcmV1c2UgdGhlIHNoYXJlZCBGaWxlcyBzZWN0aW9uIChQaGFzZSBDMikuIEluamVjdGVkIGNvbnRyb2xzIHVzZVxuICAgZGF0YS1rLCBuZXZlciBgbmFtZWAgKG1lcmdlLXJlcG9ydCBnb3RjaGEpLiBTZWUgQlVJTEQtU1RBVEUgXHUwMEE3MjAuXG4gICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuY29uc3QgUFJPR1JBTV9OT1RFX1RZUEVTID0gWydHZW5lcmFsJywgJ1RvdXInLCAnQ2FsbCcsICdDb25jZXJuJywgJ1VwZGF0ZSddO1xuY29uc3QgVE9VUl9GT1JNQVRTID0gWydJbi1wZXJzb24nLCAnVmlydHVhbCddO1xuXG5pbnRlcmZhY2UgUHJvZ3JhbU5vdGUge1xuICBlbnRyeUlkOiBzdHJpbmc7IGJvZHk6IHN0cmluZzsgbm90ZVR5cGU6IHN0cmluZzsgdG91ckRhdGU6IHN0cmluZzsgdG91ckZvcm1hdDogc3RyaW5nO1xuICBjcmVhdGVkQnk6IHN0cmluZzsgY3JlYXRlZEF0OiBzdHJpbmc7XG59XG5pbnRlcmZhY2UgUHJvZ3JhbU92ZXJsYXlEYXRhIHtcbiAgaWQ6IHN0cmluZzsgaW50ZXJuYWxSYXRpbmc6IHN0cmluZzsgcHJpdmF0ZVN1bW1hcnk6IHN0cmluZztcbiAgY2FjaGVkTmFtZTogc3RyaW5nOyBkaXJlY3RvcnlTbHVnOiBzdHJpbmc7IGxvZ28/OiBzdHJpbmc7XG59XG5pbnRlcmZhY2UgUE9TdGF0ZSB7XG4gIG92ZXJsYXk6IFByb2dyYW1PdmVybGF5RGF0YSB8IG51bGwgfCB1bmRlZmluZWQ7IC8vIHVuZGVmaW5lZCA9IHVubG9hZGVkLCBudWxsID0gbm9uZSB5ZXRcbiAgbm90ZXM6IFByb2dyYW1Ob3RlW10gfCBudWxsO1xuICBvdkxvYWRpbmc6IGJvb2xlYW47IG5vdGVzTG9hZGluZzogYm9vbGVhbjsgZXJyb3I6IHN0cmluZyB8IG51bGw7XG4gIHNhdmluZz86IGJvb2xlYW47ICAgICAgICAgICAvLyBhIHJhdGluZy9zdW1tYXJ5IHdyaXRlIGlzIGluIGZsaWdodCAobWF5IGJlIGEgZmlyc3QtdGltZSBjcmVhdGUpXG4gIHBlbmRpbmdSYXRpbmc/OiBudW1iZXI7ICAgICAvLyBvcHRpbWlzdGljIHN0YXIgZmlsbCB3aGlsZSBzYXZpbmdcbn1cbmNvbnN0IFBPX0NBQ0hFOiB7IFtkcGlkOiBzdHJpbmddOiBQT1N0YXRlIH0gPSB7fTtcbmZ1bmN0aW9uIHBvU3RhdGUoZHBpZDogc3RyaW5nKTogUE9TdGF0ZSB7XG4gIGlmICghUE9fQ0FDSEVbZHBpZF0pIFBPX0NBQ0hFW2RwaWRdID0geyBvdmVybGF5OiB1bmRlZmluZWQsIG5vdGVzOiBudWxsLCBvdkxvYWRpbmc6IGZhbHNlLCBub3Rlc0xvYWRpbmc6IGZhbHNlLCBlcnJvcjogbnVsbCB9O1xuICByZXR1cm4gUE9fQ0FDSEVbZHBpZF07XG59XG5mdW5jdGlvbiBwb0hpbnRzKHA6IERpclByb2dyYW0pOiBQcm9ncmFtSGludHMge1xuICByZXR1cm4ge1xuICAgIGRpcmVjdG9yeVNsdWc6IHAuYWt0UHJvZmlsZSB8fCBwLndlYnNpdGUgfHwgJycsXG4gICAgY2FjaGVkTmFtZTogcC5wcm9ncmFtTmFtZSB8fCAnJyxcbiAgICBjYWNoZWRMb2NhdGlvbjogcC5sb2NhdGlvbiB8fCAnJyxcbiAgICBjYWNoZWRUeXBlOiAocC5wcm9ncmFtVHlwZSAmJiBwLnByb2dyYW1UeXBlWzBdKSB8fCAnJyxcbiAgfTtcbn1cbi8vIGRwaWQgLT4gaGludHMsIHNvIG9uY2xpY2sgaGFuZGxlcnMgKHdoaWNoIG9ubHkgY2FycnkgdGhlIGRwaWQpIGNhbiByZWJ1aWxkIHRoZVxuLy8gaGludHMgYSBsYXp5IGNyZWF0ZSBuZWVkcy4gUG9wdWxhdGVkIGVhY2ggcmVuZGVyIGJ5IHJlZ2lzdGVyUHJvZ3JhbUhpbnRzLlxuY29uc3QgUE9fSElOVFM6IHsgW2RwaWQ6IHN0cmluZ106IFByb2dyYW1IaW50cyB9ID0ge307XG5cbmFzeW5jIGZ1bmN0aW9uIGxvYWRQcm9ncmFtT3ZlcmxheShkcGlkOiBzdHJpbmcsIGZvcmNlID0gZmFsc2UpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgc3QgPSBwb1N0YXRlKGRwaWQpO1xuICBpZiAoc3Qub3ZMb2FkaW5nKSByZXR1cm47XG4gIGlmIChzdC5vdmVybGF5ICE9PSB1bmRlZmluZWQgJiYgIWZvcmNlKSByZXR1cm47XG4gIHN0Lm92TG9hZGluZyA9IHRydWU7IHN0LmVycm9yID0gbnVsbDtcbiAgdHJ5IHsgc3Qub3ZlcmxheSA9IChhd2FpdCBhcGlHZXRQcm9ncmFtT3ZlcmxheShkcGlkKSkgfHwgbnVsbDsgfVxuICBjYXRjaCAoZTogYW55KSB7IHN0LmVycm9yID0gZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSk7IHN0Lm92ZXJsYXkgPSBudWxsOyB9XG4gIGZpbmFsbHkgeyBzdC5vdkxvYWRpbmcgPSBmYWxzZTsgaWYgKHR5cGVvZiByZW5kZXIgPT09ICdmdW5jdGlvbicpIHJlbmRlcigpOyB9XG59XG5hc3luYyBmdW5jdGlvbiBsb2FkUHJvZ3JhbU5vdGVzKGRwaWQ6IHN0cmluZywgZm9yY2UgPSBmYWxzZSk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBzdCA9IHBvU3RhdGUoZHBpZCk7XG4gIGlmIChzdC5ub3Rlc0xvYWRpbmcpIHJldHVybjtcbiAgaWYgKHN0Lm5vdGVzICYmICFmb3JjZSkgcmV0dXJuO1xuICBzdC5ub3Rlc0xvYWRpbmcgPSB0cnVlO1xuICB0cnkge1xuICAgIGNvbnN0IHJvd3MgPSBhd2FpdCBhcGlMaXN0UHJvZ3JhbU5vdGVzKGRwaWQpO1xuICAgIHN0Lm5vdGVzID0gKEFycmF5LmlzQXJyYXkocm93cykgPyByb3dzIDogW10pLm1hcChub3JtYWxpemVQcm9ncmFtTm90ZSk7XG4gIH0gY2F0Y2ggKGU6IGFueSkgeyBzdC5lcnJvciA9IGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpOyBzdC5ub3RlcyA9IG51bGw7IH1cbiAgZmluYWxseSB7IHN0Lm5vdGVzTG9hZGluZyA9IGZhbHNlOyBpZiAodHlwZW9mIHJlbmRlciA9PT0gJ2Z1bmN0aW9uJykgcmVuZGVyKCk7IH1cbn1cbmZ1bmN0aW9uIG5vcm1hbGl6ZVByb2dyYW1Ob3RlKHI6IGFueSk6IFByb2dyYW1Ob3RlIHtcbiAgcmV0dXJuIHtcbiAgICBlbnRyeUlkOiBTdHJpbmcoci5lbnRyeUlkIHx8ICcnKSwgYm9keTogci5ib2R5IHx8ICcnLCBub3RlVHlwZTogci5ub3RlVHlwZSB8fCAnJyxcbiAgICB0b3VyRGF0ZTogci50b3VyRGF0ZSB8fCAnJywgdG91ckZvcm1hdDogci50b3VyRm9ybWF0IHx8ICcnLFxuICAgIGNyZWF0ZWRCeTogci5jcmVhdGVkQnkgfHwgJycsIGNyZWF0ZWRBdDogci5jcmVhdGVkQXQgfHwgJycsXG4gIH07XG59XG5cbi8vIENhY2hlIHRoZSBwcm9ncmFtJ3MgZGlzcGxheSBoaW50cyBzbyBvbmNsaWNrIGhhbmRsZXJzICsgdGhlIHNoYXJlZCBGaWxlcyBzZWN0aW9uXG4vLyAod2hpY2ggb25seSBjYXJyeSB0aGUgZGlyZWN0b3J5IGlkKSBjYW4gc2VlZCBhIGxhenkgb3ZlcmxheSBjcmVhdGUuIENhbGxlZCBieVxuLy8gdGhlIHNoZWxsL3NlY3Rpb25zIG9uIGV2ZXJ5IHJlbmRlci5cbmZ1bmN0aW9uIHJlZ2lzdGVyUHJvZ3JhbUhpbnRzKHA6IERpclByb2dyYW0pOiB2b2lkIHsgUE9fSElOVFNbcC5pZF0gPSBwb0hpbnRzKHApOyB9XG5cbi8vIFRoZSBwcm9ncmFtJ3MgbG9nbyBVUkwgZm9yIHRoZSByZWNvcmQtc2hlbGwgaGVhZGVyLCBvciAnJyAoZmFsbHMgYmFjayB0byBpbml0aWFscykuXG5mdW5jdGlvbiBwcm9ncmFtTG9nb1VybChkcGlkOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBvdiA9IHBvU3RhdGUoZHBpZCkub3ZlcmxheTtcbiAgcmV0dXJuIG92ICYmIG92LmxvZ28gPyBTdHJpbmcob3YubG9nbykgOiAnJztcbn1cblxuLy8gQ2xpY2sgdGhlIGhlYWRlciBsb2dvIFx1MjE5MiBwaWNrIGFuIGltYWdlIFx1MjE5MiBzcXVhcmUtY3JvcCAoc2hhcmVkIGNyb3BwZXIpIFx1MjE5MiB1cGxvYWQuXG5mdW5jdGlvbiBwcm9ncmFtTG9nb1VwbG9hZChkcGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgaW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICBpbnB1dC50eXBlID0gJ2ZpbGUnOyBpbnB1dC5hY2NlcHQgPSAnaW1hZ2UvKic7XG4gIGlucHV0Lm9uY2hhbmdlID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IGYgPSBpbnB1dC5maWxlcyAmJiBpbnB1dC5maWxlc1swXTtcbiAgICBpZiAoIWYpIHJldHVybjtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZGF0YVVybCA9IGF3YWl0IGZpbGVUb0RhdGFVcmwoZik7XG4gICAgICBvcGVuQ3JvcHBlcihkYXRhVXJsLCBhc3luYyAob3V0OiBzdHJpbmcpID0+IHtcbiAgICAgICAgY29uc3QgY29tbWEgPSBvdXQuaW5kZXhPZignLCcpO1xuICAgICAgICBjb25zdCBiNjQgPSBjb21tYSA+PSAwID8gb3V0LnNsaWNlKGNvbW1hICsgMSkgOiBvdXQ7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3Qgb3YgPSBhd2FpdCBhcGlTZXRQcm9ncmFtTG9nbyhkcGlkLCBQT19ISU5UU1tkcGlkXSB8fCB7fSwgeyBkYXRhQmFzZTY0OiBiNjQsIGZpbGVuYW1lOiAnbG9nby5wbmcnLCBjb250ZW50VHlwZTogJ2ltYWdlL3BuZycgfSk7XG4gICAgICAgICAgaWYgKG92KSBwb1N0YXRlKGRwaWQpLm92ZXJsYXkgPSBvdjtcbiAgICAgICAgICBpZiAodHlwZW9mIHJlbmRlciA9PT0gJ2Z1bmN0aW9uJykgcmVuZGVyKCk7XG4gICAgICAgICAgdG9hc3QoJ0xvZ28gdXBkYXRlZCcpO1xuICAgICAgICB9IGNhdGNoIChlOiBhbnkpIHsgdG9hc3QoJ0xvZ28gdXBsb2FkIGZhaWxlZDogJyArIChlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSkpOyB9XG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChfZSkgeyB0b2FzdCgnQ291bGQgbm90IHJlYWQgdGhhdCBpbWFnZS4nKTsgfVxuICB9O1xuICBpbnB1dC5jbGljaygpO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgU0VDVElPTjogU3VtbWFyeSAocHJpdmF0ZSByYXRpbmcgKyBzdW1tYXJ5ICsgYXQtYS1nbGFuY2UpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZnVuY3Rpb24gc3VtbWFyeVByb2dyYW1TZWN0aW9uKHA6IERpclByb2dyYW0pOiBzdHJpbmcge1xuICBjb25zdCBkcGlkID0gcC5pZDtcbiAgcmVnaXN0ZXJQcm9ncmFtSGludHMocCk7XG4gIGNvbnN0IHN0ID0gcG9TdGF0ZShkcGlkKTtcbiAgaWYgKHN0Lm92ZXJsYXkgPT09IHVuZGVmaW5lZCAmJiAhc3Qub3ZMb2FkaW5nKSBsb2FkUHJvZ3JhbU92ZXJsYXkoZHBpZCk7XG5cbiAgY29uc3Qgc2F2ZWRSYXRpbmcgPSBzdC5vdmVybGF5ID8gKE51bWJlcihzdC5vdmVybGF5LmludGVybmFsUmF0aW5nKSB8fCAwKSA6IDA7XG4gIGNvbnN0IHJhdGluZyA9IHN0LnNhdmluZyAmJiB0eXBlb2Ygc3QucGVuZGluZ1JhdGluZyA9PT0gJ251bWJlcicgPyBzdC5wZW5kaW5nUmF0aW5nIDogc2F2ZWRSYXRpbmc7XG4gIGNvbnN0IHN1bW1hcnkgPSBzdC5vdmVybGF5ID8gKHN0Lm92ZXJsYXkucHJpdmF0ZVN1bW1hcnkgfHwgJycpIDogJyc7XG5cbiAgY29uc3Qgc3RhcnMgPSBbMSwgMiwgMywgNCwgNV0ubWFwKG4gPT5cbiAgICBgPGJ1dHRvbiBjbGFzcz1cInBvdi1zdGFyJHtuIDw9IHJhdGluZyA/ICcgb24nIDogJyd9XCIgdGl0bGU9XCIke259IHN0YXIke24gPiAxID8gJ3MnIDogJyd9XCIgb25jbGljaz1cInNldFByb2dyYW1SYXRpbmcoJyR7ZXNjKGRwaWQpfScsJHtufSlcIj4ke2ljKCdzdGFyJywgMjApfTwvYnV0dG9uPmBcbiAgKS5qb2luKCcnKTtcbiAgY29uc3QgY2xlYXJTdGFyID0gcmF0aW5nID8gYDxidXR0b24gY2xhc3M9XCJwb3Ytc3Rhci1jbGVhclwiIHRpdGxlPVwiQ2xlYXIgcmF0aW5nXCIgb25jbGljaz1cInNldFByb2dyYW1SYXRpbmcoJyR7ZXNjKGRwaWQpfScsMClcIj4ke2ljKCd4JywgMTQpfTwvYnV0dG9uPmAgOiAnJztcbiAgY29uc3Qgc2F2aW5nID0gc3Quc2F2aW5nID8gYDxzcGFuIGNsYXNzPVwicG92LXNhdmluZ1wiPjxzcGFuIGNsYXNzPVwic3BpblwiPjwvc3Bhbj5TYXZpbmdcdTIwMjY8L3NwYW4+YCA6ICcnO1xuICBjb25zdCBwb3BzID0gKHAucG9wdWxhdGlvbnNSYXcgfHwgJycpLnRyaW0oKTtcblxuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJzZWN0aW9uLWhlYWRcIj48ZGl2PjxoMz5TdW1tYXJ5PC9oMz48cD5Zb3VyIHByaXZhdGUgcmF0aW5nIGFuZCB0YWtlIG9uIHRoaXMgcHJvZ3JhbS48L3A+PC9kaXY+PC9kaXY+XG4gIDxkaXYgY2xhc3M9XCJjYXJkIGNhcmQtcGFkIHBvdiR7c3Quc2F2aW5nID8gJyBzYXZpbmcnIDogJyd9XCI+XG4gICAgJHtzYXZpbmd9XG4gICAgPGRpdiBjbGFzcz1cInBvdi1yYXRpbmdcIj5cbiAgICAgIDxzcGFuIGNsYXNzPVwicG92LWxhYmVsXCI+WW91ciByYXRpbmc8L3NwYW4+XG4gICAgICA8c3BhbiBjbGFzcz1cInBvdi1zdGFyc1wiPiR7c3RhcnN9PC9zcGFuPiR7Y2xlYXJTdGFyfVxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJwb3Ytc3VtbWFyeVwiPlxuICAgICAgPGxhYmVsIGNsYXNzPVwicG92LWxhYmVsXCIgZm9yPVwicG92LXN1bS0ke2VzYyhkcGlkKX1cIj5Qcml2YXRlIHN1bW1hcnk8L2xhYmVsPlxuICAgICAgPHRleHRhcmVhIGlkPVwicG92LXN1bS0ke2VzYyhkcGlkKX1cIiBjbGFzcz1cInBvdi1zdW0taW5wdXRcIiByb3dzPVwiM1wiIHBsYWNlaG9sZGVyPVwiWW91ciBwcml2YXRlIHRha2Ugb24gdGhpcyBwcm9ncmFtXHUyMDI2XCI+JHtlc2Moc3VtbWFyeSl9PC90ZXh0YXJlYT5cbiAgICAgIDxkaXYgY2xhc3M9XCJwb3Ytc3VtLWFjdGlvbnNcIj48YnV0dG9uIGlkPVwicG92LXN1bS0ke2VzYyhkcGlkKX0tc2F2ZVwiIGNsYXNzPVwiYnRuIGdob3N0IHNtXCIgb25jbGljaz1cInNhdmVQcm9ncmFtU3VtbWFyeSgnJHtlc2MoZHBpZCl9JylcIj4ke2ljKCdjaGVjaycsIDE0KX0gU2F2ZSBzdW1tYXJ5PC9idXR0b24+PC9kaXY+XG4gICAgPC9kaXY+XG4gIDwvZGl2PlxuICAke3BvcHMgPyBgPGRpdiBjbGFzcz1cImNhcmQgY2FyZC1wYWQgcHJvZy1zZWNcIj48ZGl2IGNsYXNzPVwic2VjLWhcIj5Qb3B1bGF0aW9ucyAmYW1wOyBTcGVjaWFsdGllczwvZGl2PjxkaXYgY2xhc3M9XCJzZWMtYm9keVwiPiR7ZXNjKHBvcHMpfTwvZGl2PjwvZGl2PmAgOiAnJ31gO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgU0VDVElPTjogTm90ZXMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5mdW5jdGlvbiBub3Rlc1Byb2dyYW1TZWN0aW9uKHA6IERpclByb2dyYW0pOiBzdHJpbmcge1xuICBjb25zdCBkcGlkID0gcC5pZDtcbiAgcmVnaXN0ZXJQcm9ncmFtSGludHMocCk7XG4gIGNvbnN0IHN0ID0gcG9TdGF0ZShkcGlkKTtcbiAgaWYgKHN0Lm5vdGVzID09PSBudWxsICYmICFzdC5ub3Rlc0xvYWRpbmcpIGxvYWRQcm9ncmFtTm90ZXMoZHBpZCk7XG4gIGNvbnN0IGhlYWQgPSBgPGRpdiBjbGFzcz1cInNlY3Rpb24taGVhZFwiPlxuICAgIDxkaXY+PGgzPk5vdGVzPC9oMz48cD5Qcml2YXRlIG5vdGVzIG9uIHRoaXMgcHJvZ3JhbSBcdTIwMTQgY2FsbHMsIHRvdXJzLCBhbmQgb2JzZXJ2YXRpb25zLjwvcD48L2Rpdj5cbiAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnlcIiBvbmNsaWNrPVwib3BlblByb2dyYW1Ob3RlTW9kYWwoJyR7ZXNjKGRwaWQpfScpXCI+JHtpYygncGx1cycsIDE1KX0gQWRkIG5vdGU8L2J1dHRvbj5cbiAgPC9kaXY+YDtcbiAgcmV0dXJuIGhlYWQgKyByZW5kZXJQcm9ncmFtTm90ZXMoZHBpZCwgc3QpO1xufVxuXG5mdW5jdGlvbiByZW5kZXJQcm9ncmFtTm90ZXMoZHBpZDogc3RyaW5nLCBzdDogUE9TdGF0ZSk6IHN0cmluZyB7XG4gIGlmIChzdC5ub3RlcyA9PT0gbnVsbCkge1xuICAgIHJldHVybiBgPGRpdiBjbGFzcz1cInBvdi1lbXB0eVwiPiR7c3QuZXJyb3IgPyBlc2Moc3QuZXJyb3IpIDogJ0xvYWRpbmcgbm90ZXNcdTIwMjYnfTwvZGl2PmA7XG4gIH1cbiAgaWYgKCFzdC5ub3Rlcy5sZW5ndGgpIHJldHVybiBgPGRpdiBjbGFzcz1cInBvdi1lbXB0eVwiPk5vIG5vdGVzIHlldCBcdTIwMTQgYWRkIGEgY2FsbCwgdG91ciwgb3IgZ2VuZXJhbCBub3RlLjwvZGl2PmA7XG4gIGNvbnN0IG5vdGVzID0gc3Qubm90ZXMuc2xpY2UoKS5zb3J0KChhLCBiKSA9PiAoYi5jcmVhdGVkQXQgfHwgJycpLmxvY2FsZUNvbXBhcmUoYS5jcmVhdGVkQXQgfHwgJycpKTtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwicG92LW5vdGUtbGlzdFwiPiR7bm90ZXMubWFwKG4gPT4gcHJvZ3JhbU5vdGVDYXJkKGRwaWQsIG4pKS5qb2luKCcnKX08L2Rpdj5gO1xufVxuXG5mdW5jdGlvbiBwcm9ncmFtTm90ZUNhcmQoZHBpZDogc3RyaW5nLCBuOiBQcm9ncmFtTm90ZSk6IHN0cmluZyB7XG4gIGNvbnN0IHR5cGVNb2QgPSBuLm5vdGVUeXBlID09PSAnQ29uY2VybicgPyAnIGNvbmNlcm4nIDogbi5ub3RlVHlwZSA9PT0gJ1RvdXInID8gJyB0b3VyJyA6ICcnO1xuICBjb25zdCB0eXBlQ2hpcCA9IG4ubm90ZVR5cGUgPyBgPHNwYW4gY2xhc3M9XCJwb3Ytbm90ZS10eXBlJHt0eXBlTW9kfVwiPiR7ZXNjKG4ubm90ZVR5cGUpfTwvc3Bhbj5gIDogJyc7XG4gIGNvbnN0IHRvdXJCaXRzID0gW24udG91ckRhdGUgPyAoZm10RGF0ZShuLnRvdXJEYXRlKSB8fCBuLnRvdXJEYXRlKSA6ICcnLCBuLnRvdXJGb3JtYXRdLmZpbHRlcihCb29sZWFuKS5qb2luKCcgXHUwMEI3ICcpO1xuICBjb25zdCB0b3VyID0gbi5ub3RlVHlwZSA9PT0gJ1RvdXInICYmIHRvdXJCaXRzID8gYDxzcGFuIGNsYXNzPVwicG92LW5vdGUtdG91clwiPiR7aWMoJ2NhbGVuZGFyJywgMTIpfSAke2VzYyh0b3VyQml0cyl9PC9zcGFuPmAgOiAnJztcbiAgY29uc3QgZm9vdCA9IChuLmNyZWF0ZWRCeSB8fCBuLmNyZWF0ZWRBdClcbiAgICA/IGA8ZGl2IGNsYXNzPVwicG92LW5vdGUtZm9vdFwiPiR7ZXNjKG4uY3JlYXRlZEJ5IHx8ICcnKX0ke24uY3JlYXRlZEF0ID8gJyBcdTAwQjcgJyArIGVzYyhmbXREYXRlKG4uY3JlYXRlZEF0KSB8fCBuLmNyZWF0ZWRBdCkgOiAnJ308L2Rpdj5gIDogJyc7XG4gIHJldHVybiBgPGRpdiBjbGFzcz1cInBvdi1ub3RlXCI+XG4gICAgPGRpdiBjbGFzcz1cInBvdi1ub3RlLXRvcFwiPiR7dHlwZUNoaXB9JHt0b3VyfTxzcGFuIHN0eWxlPVwiZmxleDoxXCI+PC9zcGFuPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImljby1taW5pXCIgdGl0bGU9XCJFZGl0XCIgb25jbGljaz1cIm9wZW5Qcm9ncmFtTm90ZU1vZGFsKCcke2VzYyhkcGlkKX0nLCcke2VzYyhuLmVudHJ5SWQpfScpXCI+JHtpYygnZWRpdCcsIDE0KX08L2J1dHRvbj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJpY28tbWluaSBkYW5nZXJcIiB0aXRsZT1cIkRlbGV0ZVwiIG9uY2xpY2s9XCJkZWxldGVQcm9ncmFtTm90ZVByb21wdCgnJHtlc2MoZHBpZCl9JywnJHtlc2Mobi5lbnRyeUlkKX0nKVwiPiR7aWMoJ3RyYXNoJywgMTQpfTwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJwb3Ytbm90ZS1ib2R5XCI+JHtlc2Mobi5ib2R5KX08L2Rpdj5cbiAgICAke2Zvb3R9XG4gIDwvZGl2PmA7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNldFByb2dyYW1SYXRpbmcoZHBpZDogc3RyaW5nLCBuOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgc3QgPSBwb1N0YXRlKGRwaWQpO1xuICBpZiAoc3Quc2F2aW5nKSByZXR1cm47ICAgICAgICAgICAgICAgICAgICAgICAvLyBpZ25vcmUgZG91YmxlLWNsaWNrcyBtaWQtc2F2ZVxuICBzdC5zYXZpbmcgPSB0cnVlOyBzdC5wZW5kaW5nUmF0aW5nID0gbjsgICAgICAvLyBvcHRpbWlzdGljIGZpbGwgKyBzYXZpbmcgaW5kaWNhdG9yXG4gIGlmICh0eXBlb2YgcmVuZGVyID09PSAnZnVuY3Rpb24nKSByZW5kZXIoKTtcbiAgdHJ5IHtcbiAgICBjb25zdCBvdiA9IGF3YWl0IGFwaVNhdmVQcm9ncmFtT3ZlcmxheShkcGlkLCBQT19ISU5UU1tkcGlkXSB8fCB7fSwgeyBpbnRlcm5hbFJhdGluZzogbiB9KTtcbiAgICBpZiAob3YpIHN0Lm92ZXJsYXkgPSBvdjtcbiAgICB0b2FzdChuID8gKCdSYXRlZCAnICsgbiArICcgc3RhcicgKyAobiA+IDEgPyAncycgOiAnJykpIDogJ1JhdGluZyBjbGVhcmVkJyk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIHRvYXN0KCdDb3VsZCBub3Qgc2F2ZSByYXRpbmc6ICcgKyAoZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBzdC5zYXZpbmcgPSBmYWxzZTsgc3QucGVuZGluZ1JhdGluZyA9IHVuZGVmaW5lZDtcbiAgICBpZiAodHlwZW9mIHJlbmRlciA9PT0gJ2Z1bmN0aW9uJykgcmVuZGVyKCk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc2F2ZVByb2dyYW1TdW1tYXJ5KGRwaWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAvLyBEb24ndCByZS1yZW5kZXIgbWlkLXNhdmUgaGVyZSBcdTIwMTQgaXQgd291bGQgcmVzZXQgdGhlIHRleHRhcmVhIHRoZSB1c2VyIGlzIGxvb2tpbmdcbiAgLy8gYXQuIERpc2FibGUgdGhlIGJ1dHRvbiwgc2hvdyBpdHMgb3duIGlubGluZSBcIlNhdmluZ1x1MjAyNlwiLCBhbmQgb25seSB1cGRhdGUgc3RhdGUuXG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwb3Ytc3VtLScgKyBkcGlkICsgJy1zYXZlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuICBjb25zdCB0YSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwb3Ytc3VtLScgKyBkcGlkKSBhcyBIVE1MVGV4dEFyZWFFbGVtZW50IHwgbnVsbDtcbiAgY29uc3QgdmFsdWUgPSB0YSA/IHRhLnZhbHVlLnRyaW0oKSA6ICcnO1xuICBpZiAoYnRuKSBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICB0cnkge1xuICAgIGNvbnN0IG92ID0gYXdhaXQgYXBpU2F2ZVByb2dyYW1PdmVybGF5KGRwaWQsIFBPX0hJTlRTW2RwaWRdIHx8IHt9LCB7IHByaXZhdGVTdW1tYXJ5OiB2YWx1ZSB9KTtcbiAgICBpZiAob3YpIHBvU3RhdGUoZHBpZCkub3ZlcmxheSA9IG92O1xuICAgIHRvYXN0KCdTdW1tYXJ5IHNhdmVkJyk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIHRvYXN0KCdDb3VsZCBub3Qgc2F2ZSBzdW1tYXJ5OiAnICsgKGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpKSk7XG4gIH0gZmluYWxseSB7XG4gICAgaWYgKGJ0bikgYnRuLmRpc2FibGVkID0gZmFsc2U7XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIG5vdGUgYWRkL2VkaXQgbW9kYWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5mdW5jdGlvbiBwb1NlbGVjdChkYXRhSzogc3RyaW5nLCBjaG9pY2VzOiBzdHJpbmdbXSwgY3VycmVudDogc3RyaW5nLCBwbGFjZWhvbGRlcjogc3RyaW5nLCBleHRyYT86IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IG9wdHMgPSBbYDxvcHRpb24gdmFsdWU9XCJcIj4ke2VzYyhwbGFjZWhvbGRlcil9PC9vcHRpb24+YF1cbiAgICAuY29uY2F0KGNob2ljZXMubWFwKG8gPT4gYDxvcHRpb24gdmFsdWU9XCIke2VzYyhvKX1cIiR7byA9PT0gY3VycmVudCA/ICcgc2VsZWN0ZWQnIDogJyd9PiR7ZXNjKG8pfTwvb3B0aW9uPmApKS5qb2luKCcnKTtcbiAgcmV0dXJuIGA8c2VsZWN0IGRhdGEtaz1cIiR7ZGF0YUt9XCIke2V4dHJhIHx8ICcnfT4ke29wdHN9PC9zZWxlY3Q+YDtcbn1cblxuZnVuY3Rpb24gb3BlblByb2dyYW1Ob3RlTW9kYWwoZHBpZDogc3RyaW5nLCBlbnRyeUlkPzogc3RyaW5nKTogdm9pZCB7XG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19wb05vdGVNb2RhbCcpKSBjbG9zZVByb2dyYW1Ob3RlTW9kYWwoKTtcbiAgY29uc3Qgc3QgPSBwb1N0YXRlKGRwaWQpO1xuICBjb25zdCBuID0gZW50cnlJZCAmJiBzdC5ub3RlcyA/IChzdC5ub3Rlcy5maWx0ZXIoeCA9PiB4LmVudHJ5SWQgPT09IGVudHJ5SWQpWzBdIHx8IG51bGwpIDogbnVsbDtcbiAgY29uc3QgZWRpdGluZyA9ICEhbjtcbiAgY29uc3Qgbm90ZVR5cGUgPSBuID8gKG4ubm90ZVR5cGUgfHwgJ0dlbmVyYWwnKSA6ICdHZW5lcmFsJztcbiAgY29uc3QgdG91ckhpZGRlbiA9IG5vdGVUeXBlID09PSAnVG91cicgPyAnJyA6ICcgaGlkZGVuJztcblxuICBjb25zdCBob3N0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGhvc3QuY2xhc3NOYW1lID0gJ21vZGFsLW92ZXJsYXknO1xuICBob3N0LmlkID0gJ19fcG9Ob3RlTW9kYWwnO1xuICBob3N0LmlubmVySFRNTCA9IGA8ZGl2IGNsYXNzPVwibW9kYWwtY2FyZFwiIHJvbGU9XCJkaWFsb2dcIiBhcmlhLW1vZGFsPVwidHJ1ZVwiIGFyaWEtbGFiZWw9XCIke2VkaXRpbmcgPyAnRWRpdCBub3RlJyA6ICdBZGQgbm90ZSd9XCIgZGF0YS1kcGlkPVwiJHtlc2MoZHBpZCl9XCIgZGF0YS1lbnRyeT1cIiR7ZXNjKGVudHJ5SWQgfHwgJycpfVwiPlxuICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1oZWFkXCI+PGRpdj48Yj4ke2VkaXRpbmcgPyAnRWRpdCBub3RlJyA6ICdBZGQgbm90ZSd9PC9iPjxwPkEgcHJpdmF0ZSBub3RlIGFib3V0IHRoaXMgcHJvZ3JhbS48L3A+PC9kaXY+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiaWNvLXhcIiB0aXRsZT1cIkNsb3NlXCIgb25jbGljaz1cImNsb3NlUHJvZ3JhbU5vdGVNb2RhbCgpXCI+JHtpYygneCcsIDE4KX08L2J1dHRvbj48L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwibW9kYWwtYm9keVwiPlxuICAgICAgPGRpdiBjbGFzcz1cIm1vZGFsLWVyclwiIGhpZGRlbj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZC1ncmlkXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZFwiPjxsYWJlbD5UeXBlPC9sYWJlbD4ke3BvU2VsZWN0KCdub3RlVHlwZScsIFBST0dSQU1fTk9URV9UWVBFUywgbm90ZVR5cGUsICdcdTIwMTQnLCAnIG9uY2hhbmdlPVwib25Qcm9ncmFtTm90ZVR5cGVDaGFuZ2UodGhpcylcIicpfTwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmllbGQgcG92LXRvdXItd3JhcFwiJHt0b3VySGlkZGVufT48bGFiZWw+VG91ciBkYXRlPC9sYWJlbD48aW5wdXQgdHlwZT1cImRhdGVcIiBkYXRhLWs9XCJ0b3VyRGF0ZVwiIHZhbHVlPVwiJHtlc2MobiA/IG4udG91ckRhdGUgOiAnJyl9XCI+PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZCBwb3YtdG91ci13cmFwXCIke3RvdXJIaWRkZW59PjxsYWJlbD5Ub3VyIGZvcm1hdDwvbGFiZWw+JHtwb1NlbGVjdCgndG91ckZvcm1hdCcsIFRPVVJfRk9STUFUUywgbiA/IG4udG91ckZvcm1hdCA6ICcnLCAnXHUyMDE0Jyl9PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZCBmdWxsXCI+PGxhYmVsPk5vdGU8L2xhYmVsPjx0ZXh0YXJlYSBkYXRhLWs9XCJib2R5XCIgcm93cz1cIjRcIiBwbGFjZWhvbGRlcj1cIldoYXQgZGlkIHlvdSBsZWFybj9cIiBhdXRvY29tcGxldGU9XCJvZmZcIj4ke2VzYyhuID8gbi5ib2R5IDogJycpfTwvdGV4dGFyZWE+PC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwibW9kYWwtZm9vdFwiPjxzcGFuIGNsYXNzPVwibW9kYWwtc3RhdHVzXCI+PC9zcGFuPjxzcGFuIHN0eWxlPVwiZmxleDoxXCI+PC9zcGFuPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIG9uY2xpY2s9XCJjbG9zZVByb2dyYW1Ob3RlTW9kYWwoKVwiPiR7aWMoJ3gnLCAxNSl9IENhbmNlbDwvYnV0dG9uPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBwcmltYXJ5IGpzLXNhdmVcIiBvbmNsaWNrPVwic2F2ZVByb2dyYW1Ob3RlKClcIj4ke2ljKCdjaGVjaycsIDE1KX0gJHtlZGl0aW5nID8gJ1NhdmUgY2hhbmdlcycgOiAnQWRkIG5vdGUnfTwvYnV0dG9uPjwvZGl2PlxuICA8L2Rpdj5gO1xuICBob3N0LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIGUgPT4geyBpZiAoZS50YXJnZXQgPT09IGhvc3QpIGNsb3NlUHJvZ3JhbU5vdGVNb2RhbCgpOyB9KTtcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChob3N0KTtcbiAgY29uc3QgYm9keSA9IGhvc3QucXVlcnlTZWxlY3RvcigndGV4dGFyZWFbZGF0YS1rPVwiYm9keVwiXScpIGFzIEhUTUxUZXh0QXJlYUVsZW1lbnQgfCBudWxsO1xuICBpZiAoYm9keSkgYm9keS5mb2N1cygpO1xuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgcG9Ob3RlRXNjKTtcbn1cbmZ1bmN0aW9uIHBvTm90ZUVzYyhlOiBLZXlib2FyZEV2ZW50KTogdm9pZCB7IGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIGNsb3NlUHJvZ3JhbU5vdGVNb2RhbCgpOyB9XG5mdW5jdGlvbiBjbG9zZVByb2dyYW1Ob3RlTW9kYWwoKTogdm9pZCB7XG4gIGNvbnN0IG0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19wb05vdGVNb2RhbCcpOyBpZiAobSkgbS5yZW1vdmUoKTtcbiAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHBvTm90ZUVzYyk7XG59XG4vLyBSZXZlYWwgVG91ciBkYXRlL2Zvcm1hdCBvbmx5IGZvciB0aGUgXCJUb3VyXCIgbm90ZSB0eXBlLlxuZnVuY3Rpb24gb25Qcm9ncmFtTm90ZVR5cGVDaGFuZ2Uoc2VsOiBIVE1MU2VsZWN0RWxlbWVudCk6IHZvaWQge1xuICBjb25zdCBjYXJkID0gc2VsLmNsb3Nlc3QoJy5tb2RhbC1jYXJkJyk7IGlmICghY2FyZCkgcmV0dXJuO1xuICBjb25zdCBzaG93ID0gc2VsLnZhbHVlID09PSAnVG91cic7XG4gIGNhcmQucXVlcnlTZWxlY3RvckFsbCgnLnBvdi10b3VyLXdyYXAnKS5mb3JFYWNoKGVsID0+IHsgKGVsIGFzIEhUTUxFbGVtZW50KS5oaWRkZW4gPSAhc2hvdzsgfSk7XG59XG5mdW5jdGlvbiBzZXRQb05vdGVFcnIobXNnOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjX19wb05vdGVNb2RhbCAubW9kYWwtZXJyJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoIWVsKSByZXR1cm47XG4gIGlmIChtc2cpIHsgZWwudGV4dENvbnRlbnQgPSBtc2c7IGVsLmhpZGRlbiA9IGZhbHNlOyB9IGVsc2UgeyBlbC50ZXh0Q29udGVudCA9ICcnOyBlbC5oaWRkZW4gPSB0cnVlOyB9XG59XG5hc3luYyBmdW5jdGlvbiBzYXZlUHJvZ3JhbU5vdGUoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IG1vZGFsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI19fcG9Ob3RlTW9kYWwgLm1vZGFsLWNhcmQnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmICghbW9kYWwpIHJldHVybjtcbiAgY29uc3QgZHBpZCA9IG1vZGFsLmdldEF0dHJpYnV0ZSgnZGF0YS1kcGlkJykgfHwgJyc7XG4gIGNvbnN0IGVudHJ5SWQgPSBtb2RhbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtZW50cnknKSB8fCAnJztcbiAgY29uc3QgZmllbGRzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge307XG4gIG1vZGFsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWtdJykuZm9yRWFjaChlbCA9PiB7XG4gICAgY29uc3QgayA9IChlbCBhcyBIVE1MRWxlbWVudCkuZGF0YXNldC5rIGFzIHN0cmluZztcbiAgICBmaWVsZHNba10gPSAoZWwgYXMgSFRNTElucHV0RWxlbWVudCB8IEhUTUxUZXh0QXJlYUVsZW1lbnQgfCBIVE1MU2VsZWN0RWxlbWVudCkudmFsdWUudHJpbSgpO1xuICB9KTtcbiAgc2V0UG9Ob3RlRXJyKCcnKTtcbiAgaWYgKCFmaWVsZHMuYm9keSkgeyBzZXRQb05vdGVFcnIoJ1dyaXRlIHNvbWV0aGluZyBpbiB0aGUgbm90ZS4nKTsgcmV0dXJuOyB9XG4gIC8vIERyb3AgdG91ciBmaWVsZHMgd2hlbiBpdCBpc24ndCBhIFRvdXIgbm90ZSAoc28gYSB0eXBlIGNoYW5nZSBsZWF2ZXMgbm8gc3RhbGUgZGF0YSkuXG4gIGlmIChmaWVsZHMubm90ZVR5cGUgIT09ICdUb3VyJykgeyBmaWVsZHMudG91ckRhdGUgPSAnJzsgZmllbGRzLnRvdXJGb3JtYXQgPSAnJzsgfVxuXG4gIGNvbnN0IHNhdmVCdG4gPSBtb2RhbC5xdWVyeVNlbGVjdG9yKCcuanMtc2F2ZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcbiAgY29uc3Qgc3RhdHVzID0gbW9kYWwucXVlcnlTZWxlY3RvcignLm1vZGFsLXN0YXR1cycpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgaWYgKHNhdmVCdG4pIHNhdmVCdG4uZGlzYWJsZWQgPSB0cnVlO1xuICBpZiAoc3RhdHVzKSBzdGF0dXMudGV4dENvbnRlbnQgPSAnU2F2aW5nXHUyMDI2JztcbiAgdHJ5IHtcbiAgICBpZiAoZW50cnlJZCkgYXdhaXQgYXBpVXBkYXRlUHJvZ3JhbU5vdGUoZHBpZCwgZW50cnlJZCwgZmllbGRzKTtcbiAgICBlbHNlIGF3YWl0IGFwaUFkZFByb2dyYW1Ob3RlKGRwaWQsIFBPX0hJTlRTW2RwaWRdIHx8IHt9LCBmaWVsZHMpO1xuICAgIGNsb3NlUHJvZ3JhbU5vdGVNb2RhbCgpO1xuICAgIC8vIEEgZmlyc3Qgbm90ZSBtYXkgaGF2ZSBsYXppbHkgY3JlYXRlZCB0aGUgb3ZlcmxheSBcdTIwMTQgcmVsb2FkIHJhdGluZy9zdW1tYXJ5IHRvby5cbiAgICBwb1N0YXRlKGRwaWQpLm92ZXJsYXkgPSB1bmRlZmluZWQ7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW2xvYWRQcm9ncmFtTm90ZXMoZHBpZCwgdHJ1ZSksIGxvYWRQcm9ncmFtT3ZlcmxheShkcGlkLCB0cnVlKV0pO1xuICAgIHRvYXN0KGVudHJ5SWQgPyAnTm90ZSB1cGRhdGVkJyA6ICdOb3RlIGFkZGVkJyk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIGlmIChzYXZlQnRuKSBzYXZlQnRuLmRpc2FibGVkID0gZmFsc2U7XG4gICAgaWYgKHN0YXR1cykgc3RhdHVzLnRleHRDb250ZW50ID0gJyc7XG4gICAgc2V0UG9Ob3RlRXJyKGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpKTtcbiAgfVxufVxuYXN5bmMgZnVuY3Rpb24gZGVsZXRlUHJvZ3JhbU5vdGVQcm9tcHQoZHBpZDogc3RyaW5nLCBlbnRyeUlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKCFlbnRyeUlkKSByZXR1cm47XG4gIGlmICghd2luZG93LmNvbmZpcm0oJ0RlbGV0ZSB0aGlzIG5vdGU/IFRoaXMgY2FuXFwndCBiZSB1bmRvbmUuJykpIHJldHVybjtcbiAgdHJ5IHsgYXdhaXQgYXBpRGVsZXRlUHJvZ3JhbU5vdGUoZHBpZCwgZW50cnlJZCk7IGF3YWl0IGxvYWRQcm9ncmFtTm90ZXMoZHBpZCwgdHJ1ZSk7IHRvYXN0KCdOb3RlIGRlbGV0ZWQnKTsgfVxuICBjYXRjaCAoZTogYW55KSB7IHRvYXN0KCdEZWxldGUgZmFpbGVkOiAnICsgKGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpKSk7IH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQWlCQSxNQUFNLHFCQUFxQixDQUFDLFdBQVcsUUFBUSxRQUFRLFdBQVcsUUFBUTtBQUMxRSxNQUFNLGVBQWUsQ0FBQyxhQUFhLFNBQVM7QUFpQjVDLE1BQU0sV0FBd0MsQ0FBQztBQUMvQyxTQUFTLFFBQVEsTUFBdUI7QUFDdEMsTUFBSSxDQUFDLFNBQVMsSUFBSSxFQUFHLFVBQVMsSUFBSSxJQUFJLEVBQUUsU0FBUyxRQUFXLE9BQU8sTUFBTSxXQUFXLE9BQU8sY0FBYyxPQUFPLE9BQU8sS0FBSztBQUM1SCxTQUFPLFNBQVMsSUFBSTtBQUN0QjtBQUNBLFNBQVMsUUFBUSxHQUE2QjtBQUM1QyxTQUFPO0FBQUEsSUFDTCxlQUFlLEVBQUUsY0FBYyxFQUFFLFdBQVc7QUFBQSxJQUM1QyxZQUFZLEVBQUUsZUFBZTtBQUFBLElBQzdCLGdCQUFnQixFQUFFLFlBQVk7QUFBQSxJQUM5QixZQUFhLEVBQUUsZUFBZSxFQUFFLFlBQVksQ0FBQyxLQUFNO0FBQUEsRUFDckQ7QUFDRjtBQUdBLE1BQU0sV0FBNkMsQ0FBQztBQUVwRCxlQUFlLG1CQUFtQixNQUFjLFFBQVEsT0FBc0I7QUFDNUUsUUFBTSxLQUFLLFFBQVEsSUFBSTtBQUN2QixNQUFJLEdBQUcsVUFBVztBQUNsQixNQUFJLEdBQUcsWUFBWSxVQUFhLENBQUMsTUFBTztBQUN4QyxLQUFHLFlBQVk7QUFBTSxLQUFHLFFBQVE7QUFDaEMsTUFBSTtBQUFFLE9BQUcsVUFBVyxNQUFNLHFCQUFxQixJ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
