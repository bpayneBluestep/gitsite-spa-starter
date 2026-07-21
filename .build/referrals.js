const REFERRAL_STATUSES = ["Considering", "Pre-screening", "Referred", "Application Sent", "Accepted", "Declined", "Family Declined", "Waitlisted", "Enrolled"];
const REFERRAL_DECLINE_REASONS = ["Clinical fit", "Acuity too high", "No bed availability", "Insurance not accepted", "Age or gender not served", "Cost", "Family declined", "Other"];
const REFERRAL_DECLINED_STATUSES = ["Declined", "Family Declined"];
const REFERRALS_CACHE = {};
function referralsState(cid) {
  if (!REFERRALS_CACHE[cid]) REFERRALS_CACHE[cid] = { list: null, loading: false, error: null };
  return REFERRALS_CACHE[cid];
}
async function loadReferrals(cid, force = false) {
  const st = referralsState(cid);
  if (st.loading) return;
  if (st.list && !force) return;
  st.loading = true;
  st.error = null;
  try {
    const rows = await apiListReferrals(cid);
    st.list = (Array.isArray(rows) ? rows : []).map(normalizeReferral);
  } catch (e) {
    st.error = e && e.message ? e.message : String(e);
    st.list = null;
  } finally {
    st.loading = false;
    if (typeof render === "function") render();
  }
}
function normalizeReferral(r) {
  return {
    entryId: String(r.entryId || ""),
    programName: r.programName || "",
    programId: r.programId || "",
    status: r.status || "",
    declineReason: r.declineReason || "",
    notes: r.notes || "",
    createdBy: r.createdBy || "",
    createdAt: r.createdAt || ""
  };
}
function referralStatusClass(status) {
  if (status === "Accepted" || status === "Enrolled") return "rf-ok";
  if (REFERRAL_DECLINED_STATUSES.indexOf(status) >= 0) return "rf-no";
  if (status === "Referred" || status === "Application Sent" || status === "Waitlisted") return "rf-active";
  return "rf-neutral";
}
function referralsSection(c) {
  const st = referralsState(c.id);
  const head = `<div class="section-head">
    <div><h3>Referrals</h3><p>Programs ${esc(c.first)} has been referred to, and how they turned out.</p></div>
    <button class="btn primary" onclick="openReferralModal('${esc(c.id)}')">${ic("plus", 15)} Add referral</button>
  </div>`;
  if (st.list === null) {
    if (!st.loading && !st.error) loadReferrals(c.id);
    const body = st.error ? `<div class="card"><div class="empty"><div class="ico">${ic("alert", 22)}</div><b>Couldn't load referrals</b>
         <p>${esc(st.error)}</p><button class="btn primary" onclick="loadReferrals('${esc(c.id)}', true)">${ic("clock", 15)} Retry</button></div></div>` : `<div class="card"><div class="empty"><div class="ico">${ic("clock", 22)}</div><b>Loading referrals\u2026</b></div></div>`;
    return head + body;
  }
  if (!st.list.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic("report", 22)}</div>
      <b>No referrals yet</b><p>Track which programs you've referred ${esc(c.first)} to, and whether they accepted.</p>
      <button class="btn primary" onclick="openReferralModal('${esc(c.id)}')">${ic("plus", 15)} Add referral</button></div></div>`;
  }
  const list = st.list.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const cards = list.map((r) => referralCard(c.id, r)).join("");
  return head + `<div class="rf-list">${cards}</div>`;
}
function referralCard(cid, r) {
  const declined = REFERRAL_DECLINED_STATUSES.indexOf(r.status) >= 0;
  const pill = r.status ? `<span class="rf-status ${referralStatusClass(r.status)}">${esc(r.status)}</span>` : "";
  const declineHtml = declined && r.declineReason ? `<div class="rf-decline">${ic("alert", 13)} Decline reason: <b>${esc(r.declineReason)}</b></div>` : "";
  const notesHtml = r.notes ? `<div class="rf-block">${esc(r.notes)}</div>` : "";
  const foot = r.createdBy || r.createdAt ? `<div class="rf-foot">Added${r.createdBy ? " by " + esc(r.createdBy) : ""}${r.createdAt ? " \xB7 " + esc(fmtDate(r.createdAt)) : ""}</div>` : "";
  return `<div class="card rf-card">
    <div class="rf-top">
      <div class="rf-prog">${ic("folder", 15)} <b>${esc(r.programName) || '<span style="color:var(--muted-foreground)">(no program)</span>'}</b></div>
      ${pill}
      <span style="flex:1"></span>
      <div class="cc-acts">
        <button class="ico-mini" title="Edit" onclick="openReferralModal('${esc(cid)}','${esc(r.entryId)}')">${ic("edit", 15)}</button>
        <button class="ico-mini danger" title="Delete" onclick="deleteReferralPrompt('${esc(cid)}','${esc(r.entryId)}')">${ic("trash", 15)}</button>
      </div>
    </div>
    ${declineHtml}
    ${notesHtml}
    ${foot}
  </div>`;
}
function referralSelectControl(dataK, choices, current, placeholder, extra = "") {
  const opts = [`<option value="">${esc(placeholder)}</option>`].concat(choices.map((o) => `<option value="${esc(o)}"${o === current ? " selected" : ""}>${esc(o)}</option>`)).join("");
  return `<select data-k="${dataK}"${extra}>${opts}</select>`;
}
function openReferralModal(cid, entryId) {
  if (document.getElementById("__referralModal")) closeReferralModal();
  if (!SETTINGS && !SETTINGS_LOADING) loadSettings();
  const st = referralsState(cid);
  const r = entryId && st.list ? st.list.filter((x) => x.entryId === entryId)[0] || null : null;
  const editing = !!r;
  loadPrograms();
  const declineShown = r && REFERRAL_DECLINED_STATUSES.indexOf(r.status) >= 0;
  const host = document.createElement("div");
  host.className = "modal-overlay";
  host.id = "__referralModal";
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="${editing ? "Edit referral" : "Add referral"}"
      data-cid="${esc(cid)}" data-entry="${esc(entryId || "")}">
    <div class="modal-head">
      <div><b>${editing ? "Edit referral" : "Add referral"}</b><p>${editing ? "Update this program referral." : "Record a program you referred this client to."}</p></div>
      <button class="ico-x" title="Close" onclick="closeReferralModal()">${ic("x", 18)}</button>
    </div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <div class="field-grid">
        <div class="field full">
          <label>Program</label>
          <div class="rf-combo">
            <input type="text" data-k="programName" id="__rfProgInput" value="${esc(r ? r.programName : "")}"
                   placeholder="Search programs\u2026" autocomplete="off"
                   oninput="referralProgFilter(this.value)">
            <input type="hidden" data-k="programId" id="__rfProgId" value="${esc(r ? r.programId : "")}">
            <div class="rf-combo-list" id="__rfProgList" hidden></div>
          </div>
        </div>
        <div class="field"><label>Status</label>${referralSelectControl("status", REFERRAL_STATUSES, r ? r.status : "Considering", "\u2014", ' onchange="referralStatusChanged(this.value)"')}</div>
        <div class="field full" id="__rfDeclineWrap"${declineShown ? "" : " hidden"}><label>Decline reason</label>${referralSelectControl("declineReason", declineReasonOptions(), r ? r.declineReason : "", "\u2014")}</div>
        <div class="field full"><label>Notes</label><textarea data-k="notes" rows="5" placeholder="Notes about this referral (optional)">${esc(r ? r.notes : "")}</textarea></div>
      </div>
    </div>
    <div class="modal-foot">
      <span class="modal-status"></span>
      <span style="flex:1"></span>
      <button class="btn ghost" onclick="closeReferralModal()">${ic("x", 15)} Cancel</button>
      <button class="btn primary js-save" onclick="saveReferral()">${ic("save", 15)} ${editing ? "Save changes" : "Add referral"}</button>
    </div>
  </div>`;
  host.addEventListener("mousedown", (e) => {
    if (e.target === host) closeReferralModal();
  });
  document.body.appendChild(host);
  const inp = host.querySelector("#__rfProgInput");
  if (inp && !editing) inp.focus();
  document.addEventListener("keydown", referralEscClose);
}
function referralEscClose(e) {
  if (e.key === "Escape") closeReferralModal();
}
function closeReferralModal() {
  const m = document.getElementById("__referralModal");
  if (m) m.remove();
  document.removeEventListener("keydown", referralEscClose);
}
function setReferralModalError(msg) {
  const el = document.querySelector("#__referralModal .modal-err");
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}
function referralStatusChanged(status) {
  const wrap = document.getElementById("__rfDeclineWrap");
  if (wrap) wrap.hidden = REFERRAL_DECLINED_STATUSES.indexOf(status) < 0;
}
function referralProgFilter(q) {
  const list = document.getElementById("__rfProgList");
  if (!list) return;
  const term = (q || "").trim().toLowerCase();
  if (!term) {
    list.hidden = true;
    list.innerHTML = "";
    return;
  }
  if (PROGRAMS_LOADING && !PROGRAM_STORE) {
    list.innerHTML = `<div class="rf-combo-item muted">Loading programs\u2026</div>`;
    list.hidden = false;
    return;
  }
  const matches = (PROGRAM_STORE || []).filter((p) => (p.programName || "").toLowerCase().indexOf(term) >= 0).slice(0, 40);
  if (!matches.length) {
    list.innerHTML = `<div class="rf-combo-item muted">No matching programs</div>`;
    list.hidden = false;
    return;
  }
  list.innerHTML = matches.map(
    (p) => `<div class="rf-combo-item" onmousedown="referralProgPick('${esc(p.id)}', ${JSON.stringify(p.programName || "").replace(/"/g, "&quot;")})">${esc(p.programName || "(unnamed)")}</div>`
  ).join("");
  list.hidden = false;
}
function referralProgPick(id, name) {
  const inp = document.getElementById("__rfProgInput");
  const idEl = document.getElementById("__rfProgId");
  const list = document.getElementById("__rfProgList");
  if (inp) inp.value = name;
  if (idEl) idEl.value = id;
  if (list) {
    list.hidden = true;
    list.innerHTML = "";
  }
}
async function saveReferral() {
  const modal = document.querySelector("#__referralModal .modal-card");
  if (!modal) return;
  const cid = modal.getAttribute("data-cid") || "";
  const entryId = modal.getAttribute("data-entry") || "";
  if (!cid) {
    setReferralModalError("Missing client id.");
    return;
  }
  const fields = {};
  modal.querySelectorAll("[data-k]").forEach((el) => {
    const k = el.dataset.k;
    fields[k] = el.value.trim();
  });
  setReferralModalError("");
  if (!fields.programName) {
    setReferralModalError("Pick a program (type to search).");
    return;
  }
  if (REFERRAL_DECLINED_STATUSES.indexOf(fields.status) < 0) fields.declineReason = "";
  const saveBtn = modal.querySelector(".js-save");
  const status = modal.querySelector(".modal-status");
  if (saveBtn) saveBtn.disabled = true;
  if (status) status.textContent = "Saving\u2026";
  try {
    if (entryId) await apiUpdateReferral(cid, entryId, fields);
    else await apiAddReferral(cid, fields);
    closeReferralModal();
    await loadReferrals(cid, true);
    toast(entryId ? "Referral updated" : "Referral added");
  } catch (e) {
    if (saveBtn) saveBtn.disabled = false;
    if (status) status.textContent = "";
    setReferralModalError(e && e.message ? e.message : String(e));
  }
}
async function deleteReferralPrompt(cid, entryId) {
  if (!entryId) return;
  if (!window.confirm("Delete this referral? This can't be undone.")) return;
  try {
    await apiDeleteReferral(cid, entryId);
    await loadReferrals(cid, true);
    toast("Referral deleted");
  } catch (e) {
    toast("Delete failed: " + (e && e.message ? e.message : String(e)));
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsicmVmZXJyYWxzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgIHJlZmVycmFscy50cyBcdTIwMTQgdGhlIFJlZmVycmFscyByZWNvcmQgc2VjdGlvbiAobXVsdGktZW50cnksIGxpdmUpLlxuXG4gICBBIHBlci1jbGllbnQgcHJvZ3JhbS1yZWZlcnJhbCB0aW1lbGluZSBvbiB0aGUgY2xpZW50J3MgYHJlZmVycmFsc2AgTUVGLFxuICAgc2VydmVkIGJ5IHRoZSBtYWVzdHJvIChsaXN0UmVmZXJyYWxzL2FkZFJlZmVycmFsL3VwZGF0ZVJlZmVycmFsL2RlbGV0ZVJlZmVycmFsKS5cbiAgIEVhY2ggZW50cnkgcmVmZXJlbmNlcyBhIGRpcmVjdG9yeSBwcm9ncmFtIGJ5IHByb2dyYW1JZCAoRkspICsgcHJvZ3JhbU5hbWVcbiAgIChzbmFwc2hvdCwgc28gdGhlIGxpc3QgbmVlZHMgbm8gY3Jvc3Mtb3JnIGZldGNoKS4gc3RhdHVzICsgZGVjbGluZVJlYXNvblxuICAgY2FwdHVyZSB0aGUgYWNjZXB0L2Rlbnkgb3V0Y29tZTsgY3JlYXRlZEJ5L2NyZWF0ZWRBdCBhcmUgc3RhbXBlZCBzZXJ2ZXItc2lkZS5cblxuICAgVGhlIGFkZC9lZGl0IG1vZGFsJ3MgcHJvZ3JhbSBwaWNrZXIgaXMgYSBsaWdodHdlaWdodCBjb21ib2JveCBvdmVyIHRoZSBjYWNoZWRcbiAgIGRpcmVjdG9yeSBwcm9ncmFtIGxpc3QgKFBST0dSQU1fU1RPUkUsIGxvYWRlZCB2aWEgbG9hZFByb2dyYW1zKCkpLlxuXG4gICBJbmplY3RlZCBjb250cm9scyB1c2UgZGF0YS1rLCBuZXZlciBgbmFtZWAgKG1lcmdlLXJlcG9ydCBnb3RjaGEpLlxuICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbi8vIE1VU1QgbWF0Y2ggdGhlIG9wdGlvbi1saXN0IGxhYmVscyBvbiB0aGUgcmVmZXJyYWxzIGZvcm0gKHNldEJ5TmFtZSByZXNvbHZlcyBieVxuLy8gZGlzcGxheSBuYW1lKS5cbmNvbnN0IFJFRkVSUkFMX1NUQVRVU0VTID0gWydDb25zaWRlcmluZycsICdQcmUtc2NyZWVuaW5nJywgJ1JlZmVycmVkJywgJ0FwcGxpY2F0aW9uIFNlbnQnLCAnQWNjZXB0ZWQnLCAnRGVjbGluZWQnLCAnRmFtaWx5IERlY2xpbmVkJywgJ1dhaXRsaXN0ZWQnLCAnRW5yb2xsZWQnXTtcbmNvbnN0IFJFRkVSUkFMX0RFQ0xJTkVfUkVBU09OUyA9IFsnQ2xpbmljYWwgZml0JywgJ0FjdWl0eSB0b28gaGlnaCcsICdObyBiZWQgYXZhaWxhYmlsaXR5JywgJ0luc3VyYW5jZSBub3QgYWNjZXB0ZWQnLCAnQWdlIG9yIGdlbmRlciBub3Qgc2VydmVkJywgJ0Nvc3QnLCAnRmFtaWx5IGRlY2xpbmVkJywgJ090aGVyJ107XG4vLyBTdGF0dXNlcyB0aGF0IHJlcHJlc2VudCBhIGRlY2xpbmUgb3V0Y29tZSBcdTIxOTIgdGhlIGRlY2xpbmUtcmVhc29uIGZpZWxkIGFwcGxpZXMuXG5jb25zdCBSRUZFUlJBTF9ERUNMSU5FRF9TVEFUVVNFUyA9IFsnRGVjbGluZWQnLCAnRmFtaWx5IERlY2xpbmVkJ107XG5cbmludGVyZmFjZSBMaXZlUmVmZXJyYWwge1xuICBlbnRyeUlkOiBzdHJpbmc7XG4gIHByb2dyYW1OYW1lOiBzdHJpbmc7IHByb2dyYW1JZDogc3RyaW5nOyBzdGF0dXM6IHN0cmluZztcbiAgZGVjbGluZVJlYXNvbjogc3RyaW5nOyBub3Rlczogc3RyaW5nO1xuICBjcmVhdGVkQnk6IHN0cmluZzsgY3JlYXRlZEF0OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBSZWZlcnJhbHNTdGF0ZSB7IGxpc3Q6IExpdmVSZWZlcnJhbFtdIHwgbnVsbDsgbG9hZGluZzogYm9vbGVhbjsgZXJyb3I6IHN0cmluZyB8IG51bGw7IH1cbmNvbnN0IFJFRkVSUkFMU19DQUNIRTogeyBbY2xpZW50SWQ6IHN0cmluZ106IFJlZmVycmFsc1N0YXRlIH0gPSB7fTtcblxuZnVuY3Rpb24gcmVmZXJyYWxzU3RhdGUoY2lkOiBzdHJpbmcpOiBSZWZlcnJhbHNTdGF0ZSB7XG4gIGlmICghUkVGRVJSQUxTX0NBQ0hFW2NpZF0pIFJFRkVSUkFMU19DQUNIRVtjaWRdID0geyBsaXN0OiBudWxsLCBsb2FkaW5nOiBmYWxzZSwgZXJyb3I6IG51bGwgfTtcbiAgcmV0dXJuIFJFRkVSUkFMU19DQUNIRVtjaWRdO1xufVxuXG5hc3luYyBmdW5jdGlvbiBsb2FkUmVmZXJyYWxzKGNpZDogc3RyaW5nLCBmb3JjZSA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHN0ID0gcmVmZXJyYWxzU3RhdGUoY2lkKTtcbiAgaWYgKHN0LmxvYWRpbmcpIHJldHVybjtcbiAgaWYgKHN0Lmxpc3QgJiYgIWZvcmNlKSByZXR1cm47XG4gIHN0LmxvYWRpbmcgPSB0cnVlOyBzdC5lcnJvciA9IG51bGw7XG4gIHRyeSB7XG4gICAgY29uc3Qgcm93cyA9IGF3YWl0IGFwaUxpc3RSZWZlcnJhbHMoY2lkKTtcbiAgICBzdC5saXN0ID0gKEFycmF5LmlzQXJyYXkocm93cykgPyByb3dzIDogW10pLm1hcChub3JtYWxpemVSZWZlcnJhbCk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIHN0LmVycm9yID0gZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSk7XG4gICAgc3QubGlzdCA9IG51bGw7XG4gIH0gZmluYWxseSB7XG4gICAgc3QubG9hZGluZyA9IGZhbHNlO1xuICAgIGlmICh0eXBlb2YgcmVuZGVyID09PSAnZnVuY3Rpb24nKSByZW5kZXIoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBub3JtYWxpemVSZWZlcnJhbChyOiBhbnkpOiBMaXZlUmVmZXJyYWwge1xuICByZXR1cm4ge1xuICAgIGVudHJ5SWQ6IFN0cmluZyhyLmVudHJ5SWQgfHwgJycpLFxuICAgIHByb2dyYW1OYW1lOiByLnByb2dyYW1OYW1lIHx8ICcnLCBwcm9ncmFtSWQ6IHIucHJvZ3JhbUlkIHx8ICcnLCBzdGF0dXM6IHIuc3RhdHVzIHx8ICcnLFxuICAgIGRlY2xpbmVSZWFzb246IHIuZGVjbGluZVJlYXNvbiB8fCAnJywgbm90ZXM6IHIubm90ZXMgfHwgJycsXG4gICAgY3JlYXRlZEJ5OiByLmNyZWF0ZWRCeSB8fCAnJywgY3JlYXRlZEF0OiByLmNyZWF0ZWRBdCB8fCAnJyxcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVmZXJyYWxTdGF0dXNDbGFzcyhzdGF0dXM6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmIChzdGF0dXMgPT09ICdBY2NlcHRlZCcgfHwgc3RhdHVzID09PSAnRW5yb2xsZWQnKSByZXR1cm4gJ3JmLW9rJztcbiAgaWYgKFJFRkVSUkFMX0RFQ0xJTkVEX1NUQVRVU0VTLmluZGV4T2Yoc3RhdHVzKSA+PSAwKSByZXR1cm4gJ3JmLW5vJztcbiAgaWYgKHN0YXR1cyA9PT0gJ1JlZmVycmVkJyB8fCBzdGF0dXMgPT09ICdBcHBsaWNhdGlvbiBTZW50JyB8fCBzdGF0dXMgPT09ICdXYWl0bGlzdGVkJykgcmV0dXJuICdyZi1hY3RpdmUnO1xuICByZXR1cm4gJ3JmLW5ldXRyYWwnO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgc2VjdGlvbiB2aWV3IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZnVuY3Rpb24gcmVmZXJyYWxzU2VjdGlvbihjOiBDbGllbnQpOiBzdHJpbmcge1xuICBjb25zdCBzdCA9IHJlZmVycmFsc1N0YXRlKGMuaWQpO1xuICBjb25zdCBoZWFkID0gYDxkaXYgY2xhc3M9XCJzZWN0aW9uLWhlYWRcIj5cbiAgICA8ZGl2PjxoMz5SZWZlcnJhbHM8L2gzPjxwPlByb2dyYW1zICR7ZXNjKGMuZmlyc3QpfSBoYXMgYmVlbiByZWZlcnJlZCB0bywgYW5kIGhvdyB0aGV5IHR1cm5lZCBvdXQuPC9wPjwvZGl2PlxuICAgIDxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeVwiIG9uY2xpY2s9XCJvcGVuUmVmZXJyYWxNb2RhbCgnJHtlc2MoYy5pZCl9JylcIj4ke2ljKCdwbHVzJywgMTUpfSBBZGQgcmVmZXJyYWw8L2J1dHRvbj5cbiAgPC9kaXY+YDtcblxuICBpZiAoc3QubGlzdCA9PT0gbnVsbCkge1xuICAgIGlmICghc3QubG9hZGluZyAmJiAhc3QuZXJyb3IpIGxvYWRSZWZlcnJhbHMoYy5pZCk7XG4gICAgY29uc3QgYm9keSA9IHN0LmVycm9yXG4gICAgICA/IGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdhbGVydCcsIDIyKX08L2Rpdj48Yj5Db3VsZG4ndCBsb2FkIHJlZmVycmFsczwvYj5cbiAgICAgICAgIDxwPiR7ZXNjKHN0LmVycm9yKX08L3A+PGJ1dHRvbiBjbGFzcz1cImJ0biBwcmltYXJ5XCIgb25jbGljaz1cImxvYWRSZWZlcnJhbHMoJyR7ZXNjKGMuaWQpfScsIHRydWUpXCI+JHtpYygnY2xvY2snLCAxNSl9IFJldHJ5PC9idXR0b24+PC9kaXY+PC9kaXY+YFxuICAgICAgOiBgPGRpdiBjbGFzcz1cImNhcmRcIj48ZGl2IGNsYXNzPVwiZW1wdHlcIj48ZGl2IGNsYXNzPVwiaWNvXCI+JHtpYygnY2xvY2snLCAyMil9PC9kaXY+PGI+TG9hZGluZyByZWZlcnJhbHNcdTIwMjY8L2I+PC9kaXY+PC9kaXY+YDtcbiAgICByZXR1cm4gaGVhZCArIGJvZHk7XG4gIH1cblxuICBpZiAoIXN0Lmxpc3QubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGhlYWQgKyBgPGRpdiBjbGFzcz1cImNhcmRcIj48ZGl2IGNsYXNzPVwiZW1wdHlcIj48ZGl2IGNsYXNzPVwiaWNvXCI+JHtpYygncmVwb3J0JywgMjIpfTwvZGl2PlxuICAgICAgPGI+Tm8gcmVmZXJyYWxzIHlldDwvYj48cD5UcmFjayB3aGljaCBwcm9ncmFtcyB5b3UndmUgcmVmZXJyZWQgJHtlc2MoYy5maXJzdCl9IHRvLCBhbmQgd2hldGhlciB0aGV5IGFjY2VwdGVkLjwvcD5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeVwiIG9uY2xpY2s9XCJvcGVuUmVmZXJyYWxNb2RhbCgnJHtlc2MoYy5pZCl9JylcIj4ke2ljKCdwbHVzJywgMTUpfSBBZGQgcmVmZXJyYWw8L2J1dHRvbj48L2Rpdj48L2Rpdj5gO1xuICB9XG5cbiAgLy8gU29ydDogbW9zdCByZWNlbnRseSBhZGRlZCBmaXJzdC5cbiAgY29uc3QgbGlzdCA9IHN0Lmxpc3Quc2xpY2UoKS5zb3J0KChhLCBiKSA9PiAoYi5jcmVhdGVkQXQgfHwgJycpLmxvY2FsZUNvbXBhcmUoYS5jcmVhdGVkQXQgfHwgJycpKTtcbiAgY29uc3QgY2FyZHMgPSBsaXN0Lm1hcChyID0+IHJlZmVycmFsQ2FyZChjLmlkLCByKSkuam9pbignJyk7XG4gIHJldHVybiBoZWFkICsgYDxkaXYgY2xhc3M9XCJyZi1saXN0XCI+JHtjYXJkc308L2Rpdj5gO1xufVxuXG5mdW5jdGlvbiByZWZlcnJhbENhcmQoY2lkOiBzdHJpbmcsIHI6IExpdmVSZWZlcnJhbCk6IHN0cmluZyB7XG4gIGNvbnN0IGRlY2xpbmVkID0gUkVGRVJSQUxfREVDTElORURfU1RBVFVTRVMuaW5kZXhPZihyLnN0YXR1cykgPj0gMDtcbiAgY29uc3QgcGlsbCA9IHIuc3RhdHVzID8gYDxzcGFuIGNsYXNzPVwicmYtc3RhdHVzICR7cmVmZXJyYWxTdGF0dXNDbGFzcyhyLnN0YXR1cyl9XCI+JHtlc2Moci5zdGF0dXMpfTwvc3Bhbj5gIDogJyc7XG4gIGNvbnN0IGRlY2xpbmVIdG1sID0gKGRlY2xpbmVkICYmIHIuZGVjbGluZVJlYXNvbilcbiAgICA/IGA8ZGl2IGNsYXNzPVwicmYtZGVjbGluZVwiPiR7aWMoJ2FsZXJ0JywgMTMpfSBEZWNsaW5lIHJlYXNvbjogPGI+JHtlc2Moci5kZWNsaW5lUmVhc29uKX08L2I+PC9kaXY+YCA6ICcnO1xuICBjb25zdCBub3Rlc0h0bWwgPSByLm5vdGVzID8gYDxkaXYgY2xhc3M9XCJyZi1ibG9ja1wiPiR7ZXNjKHIubm90ZXMpfTwvZGl2PmAgOiAnJztcbiAgY29uc3QgZm9vdCA9IChyLmNyZWF0ZWRCeSB8fCByLmNyZWF0ZWRBdClcbiAgICA/IGA8ZGl2IGNsYXNzPVwicmYtZm9vdFwiPkFkZGVkJHtyLmNyZWF0ZWRCeSA/ICcgYnkgJyArIGVzYyhyLmNyZWF0ZWRCeSkgOiAnJ30ke3IuY3JlYXRlZEF0ID8gJyBcdTAwQjcgJyArIGVzYyhmbXREYXRlKHIuY3JlYXRlZEF0KSkgOiAnJ308L2Rpdj5gIDogJyc7XG5cbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiY2FyZCByZi1jYXJkXCI+XG4gICAgPGRpdiBjbGFzcz1cInJmLXRvcFwiPlxuICAgICAgPGRpdiBjbGFzcz1cInJmLXByb2dcIj4ke2ljKCdmb2xkZXInLCAxNSl9IDxiPiR7ZXNjKHIucHJvZ3JhbU5hbWUpIHx8ICc8c3BhbiBzdHlsZT1cImNvbG9yOnZhcigtLW11dGVkLWZvcmVncm91bmQpXCI+KG5vIHByb2dyYW0pPC9zcGFuPid9PC9iPjwvZGl2PlxuICAgICAgJHtwaWxsfVxuICAgICAgPHNwYW4gc3R5bGU9XCJmbGV4OjFcIj48L3NwYW4+XG4gICAgICA8ZGl2IGNsYXNzPVwiY2MtYWN0c1wiPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwiaWNvLW1pbmlcIiB0aXRsZT1cIkVkaXRcIiBvbmNsaWNrPVwib3BlblJlZmVycmFsTW9kYWwoJyR7ZXNjKGNpZCl9JywnJHtlc2Moci5lbnRyeUlkKX0nKVwiPiR7aWMoJ2VkaXQnLCAxNSl9PC9idXR0b24+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJpY28tbWluaSBkYW5nZXJcIiB0aXRsZT1cIkRlbGV0ZVwiIG9uY2xpY2s9XCJkZWxldGVSZWZlcnJhbFByb21wdCgnJHtlc2MoY2lkKX0nLCcke2VzYyhyLmVudHJ5SWQpfScpXCI+JHtpYygndHJhc2gnLCAxNSl9PC9idXR0b24+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgICAke2RlY2xpbmVIdG1sfVxuICAgICR7bm90ZXNIdG1sfVxuICAgICR7Zm9vdH1cbiAgPC9kaXY+YDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIGFkZCAvIGVkaXQgbW9kYWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5mdW5jdGlvbiByZWZlcnJhbFNlbGVjdENvbnRyb2woZGF0YUs6IHN0cmluZywgY2hvaWNlczogc3RyaW5nW10sIGN1cnJlbnQ6IHN0cmluZywgcGxhY2Vob2xkZXI6IHN0cmluZywgZXh0cmEgPSAnJyk6IHN0cmluZyB7XG4gIGNvbnN0IG9wdHMgPSBbYDxvcHRpb24gdmFsdWU9XCJcIj4ke2VzYyhwbGFjZWhvbGRlcil9PC9vcHRpb24+YF1cbiAgICAuY29uY2F0KGNob2ljZXMubWFwKG8gPT4gYDxvcHRpb24gdmFsdWU9XCIke2VzYyhvKX1cIiR7byA9PT0gY3VycmVudCA/ICcgc2VsZWN0ZWQnIDogJyd9PiR7ZXNjKG8pfTwvb3B0aW9uPmApKVxuICAgIC5qb2luKCcnKTtcbiAgcmV0dXJuIGA8c2VsZWN0IGRhdGEtaz1cIiR7ZGF0YUt9XCIke2V4dHJhfT4ke29wdHN9PC9zZWxlY3Q+YDtcbn1cblxuZnVuY3Rpb24gb3BlblJlZmVycmFsTW9kYWwoY2lkOiBzdHJpbmcsIGVudHJ5SWQ/OiBzdHJpbmcpOiB2b2lkIHtcbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX3JlZmVycmFsTW9kYWwnKSkgY2xvc2VSZWZlcnJhbE1vZGFsKCk7XG4gIC8vIFNldHRpbmdzIGRyaXZlcyB0aGUgZGVjbGluZS1yZWFzb24gZHJvcGRvd24gXHUyMDE0IG1ha2Ugc3VyZSBpdCdzIGxvYWRlZC5cbiAgaWYgKCFTRVRUSU5HUyAmJiAhU0VUVElOR1NfTE9BRElORykgbG9hZFNldHRpbmdzKCk7XG4gIGNvbnN0IHN0ID0gcmVmZXJyYWxzU3RhdGUoY2lkKTtcbiAgY29uc3QgciA9IGVudHJ5SWQgJiYgc3QubGlzdCA/IChzdC5saXN0LmZpbHRlcih4ID0+IHguZW50cnlJZCA9PT0gZW50cnlJZClbMF0gfHwgbnVsbCkgOiBudWxsO1xuICBjb25zdCBlZGl0aW5nID0gISFyO1xuICBsb2FkUHJvZ3JhbXMoKTsgLy8gZW5zdXJlIHRoZSBwaWNrZXIgaGFzIGRhdGEgKG5vLW9wIGlmIGFscmVhZHkgbG9hZGVkKVxuXG4gIGNvbnN0IGRlY2xpbmVTaG93biA9IHIgJiYgUkVGRVJSQUxfREVDTElORURfU1RBVFVTRVMuaW5kZXhPZihyLnN0YXR1cykgPj0gMDtcblxuICBjb25zdCBob3N0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGhvc3QuY2xhc3NOYW1lID0gJ21vZGFsLW92ZXJsYXknO1xuICBob3N0LmlkID0gJ19fcmVmZXJyYWxNb2RhbCc7XG4gIGhvc3QuaW5uZXJIVE1MID0gYDxkaXYgY2xhc3M9XCJtb2RhbC1jYXJkXCIgcm9sZT1cImRpYWxvZ1wiIGFyaWEtbW9kYWw9XCJ0cnVlXCIgYXJpYS1sYWJlbD1cIiR7ZWRpdGluZyA/ICdFZGl0IHJlZmVycmFsJyA6ICdBZGQgcmVmZXJyYWwnfVwiXG4gICAgICBkYXRhLWNpZD1cIiR7ZXNjKGNpZCl9XCIgZGF0YS1lbnRyeT1cIiR7ZXNjKGVudHJ5SWQgfHwgJycpfVwiPlxuICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1oZWFkXCI+XG4gICAgICA8ZGl2PjxiPiR7ZWRpdGluZyA/ICdFZGl0IHJlZmVycmFsJyA6ICdBZGQgcmVmZXJyYWwnfTwvYj48cD4ke2VkaXRpbmcgPyAnVXBkYXRlIHRoaXMgcHJvZ3JhbSByZWZlcnJhbC4nIDogJ1JlY29yZCBhIHByb2dyYW0geW91IHJlZmVycmVkIHRoaXMgY2xpZW50IHRvLid9PC9wPjwvZGl2PlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImljby14XCIgdGl0bGU9XCJDbG9zZVwiIG9uY2xpY2s9XCJjbG9zZVJlZmVycmFsTW9kYWwoKVwiPiR7aWMoJ3gnLCAxOCl9PC9idXR0b24+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cIm1vZGFsLWJvZHlcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1lcnJcIiBoaWRkZW4+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiZmllbGQtZ3JpZFwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmllbGQgZnVsbFwiPlxuICAgICAgICAgIDxsYWJlbD5Qcm9ncmFtPC9sYWJlbD5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwicmYtY29tYm9cIj5cbiAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwidGV4dFwiIGRhdGEtaz1cInByb2dyYW1OYW1lXCIgaWQ9XCJfX3JmUHJvZ0lucHV0XCIgdmFsdWU9XCIke2VzYyhyID8gci5wcm9ncmFtTmFtZSA6ICcnKX1cIlxuICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiU2VhcmNoIHByb2dyYW1zXHUyMDI2XCIgYXV0b2NvbXBsZXRlPVwib2ZmXCJcbiAgICAgICAgICAgICAgICAgICBvbmlucHV0PVwicmVmZXJyYWxQcm9nRmlsdGVyKHRoaXMudmFsdWUpXCI+XG4gICAgICAgICAgICA8aW5wdXQgdHlwZT1cImhpZGRlblwiIGRhdGEtaz1cInByb2dyYW1JZFwiIGlkPVwiX19yZlByb2dJZFwiIHZhbHVlPVwiJHtlc2MociA/IHIucHJvZ3JhbUlkIDogJycpfVwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInJmLWNvbWJvLWxpc3RcIiBpZD1cIl9fcmZQcm9nTGlzdFwiIGhpZGRlbj48L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZFwiPjxsYWJlbD5TdGF0dXM8L2xhYmVsPiR7cmVmZXJyYWxTZWxlY3RDb250cm9sKCdzdGF0dXMnLCBSRUZFUlJBTF9TVEFUVVNFUywgciA/IHIuc3RhdHVzIDogJ0NvbnNpZGVyaW5nJywgJ1x1MjAxNCcsICcgb25jaGFuZ2U9XCJyZWZlcnJhbFN0YXR1c0NoYW5nZWQodGhpcy52YWx1ZSlcIicpfTwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmllbGQgZnVsbFwiIGlkPVwiX19yZkRlY2xpbmVXcmFwXCIke2RlY2xpbmVTaG93biA/ICcnIDogJyBoaWRkZW4nfT48bGFiZWw+RGVjbGluZSByZWFzb248L2xhYmVsPiR7cmVmZXJyYWxTZWxlY3RDb250cm9sKCdkZWNsaW5lUmVhc29uJywgZGVjbGluZVJlYXNvbk9wdGlvbnMoKSwgciA/IHIuZGVjbGluZVJlYXNvbiA6ICcnLCAnXHUyMDE0Jyl9PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZCBmdWxsXCI+PGxhYmVsPk5vdGVzPC9sYWJlbD48dGV4dGFyZWEgZGF0YS1rPVwibm90ZXNcIiByb3dzPVwiNVwiIHBsYWNlaG9sZGVyPVwiTm90ZXMgYWJvdXQgdGhpcyByZWZlcnJhbCAob3B0aW9uYWwpXCI+JHtlc2MociA/IHIubm90ZXMgOiAnJyl9PC90ZXh0YXJlYT48L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1mb290XCI+XG4gICAgICA8c3BhbiBjbGFzcz1cIm1vZGFsLXN0YXR1c1wiPjwvc3Bhbj5cbiAgICAgIDxzcGFuIHN0eWxlPVwiZmxleDoxXCI+PC9zcGFuPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIG9uY2xpY2s9XCJjbG9zZVJlZmVycmFsTW9kYWwoKVwiPiR7aWMoJ3gnLCAxNSl9IENhbmNlbDwvYnV0dG9uPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBwcmltYXJ5IGpzLXNhdmVcIiBvbmNsaWNrPVwic2F2ZVJlZmVycmFsKClcIj4ke2ljKCdzYXZlJywgMTUpfSAke2VkaXRpbmcgPyAnU2F2ZSBjaGFuZ2VzJyA6ICdBZGQgcmVmZXJyYWwnfTwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICA8L2Rpdj5gO1xuICBob3N0LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIGUgPT4geyBpZiAoZS50YXJnZXQgPT09IGhvc3QpIGNsb3NlUmVmZXJyYWxNb2RhbCgpOyB9KTtcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChob3N0KTtcbiAgY29uc3QgaW5wID0gaG9zdC5xdWVyeVNlbGVjdG9yKCcjX19yZlByb2dJbnB1dCcpIGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsO1xuICBpZiAoaW5wICYmICFlZGl0aW5nKSBpbnAuZm9jdXMoKTtcbiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHJlZmVycmFsRXNjQ2xvc2UpO1xufVxuXG5mdW5jdGlvbiByZWZlcnJhbEVzY0Nsb3NlKGU6IEtleWJvYXJkRXZlbnQpOiB2b2lkIHsgaWYgKGUua2V5ID09PSAnRXNjYXBlJykgY2xvc2VSZWZlcnJhbE1vZGFsKCk7IH1cbmZ1bmN0aW9uIGNsb3NlUmVmZXJyYWxNb2RhbCgpOiB2b2lkIHtcbiAgY29uc3QgbSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX3JlZmVycmFsTW9kYWwnKTtcbiAgaWYgKG0pIG0ucmVtb3ZlKCk7XG4gIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCByZWZlcnJhbEVzY0Nsb3NlKTtcbn1cbmZ1bmN0aW9uIHNldFJlZmVycmFsTW9kYWxFcnJvcihtc2c6IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNfX3JlZmVycmFsTW9kYWwgLm1vZGFsLWVycicpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgaWYgKCFlbCkgcmV0dXJuO1xuICBpZiAobXNnKSB7IGVsLnRleHRDb250ZW50ID0gbXNnOyBlbC5oaWRkZW4gPSBmYWxzZTsgfSBlbHNlIHsgZWwudGV4dENvbnRlbnQgPSAnJzsgZWwuaGlkZGVuID0gdHJ1ZTsgfVxufVxuXG4vLyBUb2dnbGUgdGhlIGRlY2xpbmUtcmVhc29uIGZpZWxkIGJhc2VkIG9uIHRoZSBjaG9zZW4gc3RhdHVzLlxuZnVuY3Rpb24gcmVmZXJyYWxTdGF0dXNDaGFuZ2VkKHN0YXR1czogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IHdyYXAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19yZkRlY2xpbmVXcmFwJyk7XG4gIGlmICh3cmFwKSB3cmFwLmhpZGRlbiA9IFJFRkVSUkFMX0RFQ0xJTkVEX1NUQVRVU0VTLmluZGV4T2Yoc3RhdHVzKSA8IDA7XG59XG5cbi8vIFByb2dyYW0gcGlja2VyOiBmaWx0ZXIgdGhlIGNhY2hlZCBkaXJlY3RvcnkgbGlzdCBhbmQgcmVuZGVyIGNsaWNrYWJsZSBtYXRjaGVzLlxuZnVuY3Rpb24gcmVmZXJyYWxQcm9nRmlsdGVyKHE6IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCBsaXN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fcmZQcm9nTGlzdCcpO1xuICBpZiAoIWxpc3QpIHJldHVybjtcbiAgY29uc3QgdGVybSA9IChxIHx8ICcnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgLy8gTm90aGluZyBzaG93cyB1bnRpbCB0aGUgdXNlciBhY3R1YWxseSB0eXBlcy5cbiAgaWYgKCF0ZXJtKSB7IGxpc3QuaGlkZGVuID0gdHJ1ZTsgbGlzdC5pbm5lckhUTUwgPSAnJzsgcmV0dXJuOyB9XG4gIGlmIChQUk9HUkFNU19MT0FESU5HICYmICFQUk9HUkFNX1NUT1JFKSB7XG4gICAgbGlzdC5pbm5lckhUTUwgPSBgPGRpdiBjbGFzcz1cInJmLWNvbWJvLWl0ZW0gbXV0ZWRcIj5Mb2FkaW5nIHByb2dyYW1zXHUyMDI2PC9kaXY+YDtcbiAgICBsaXN0LmhpZGRlbiA9IGZhbHNlOyByZXR1cm47XG4gIH1cbiAgY29uc3QgbWF0Y2hlcyA9IChQUk9HUkFNX1NUT1JFIHx8IFtdKVxuICAgIC5maWx0ZXIocCA9PiAocC5wcm9ncmFtTmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmRleE9mKHRlcm0pID49IDApXG4gICAgLnNsaWNlKDAsIDQwKTtcbiAgaWYgKCFtYXRjaGVzLmxlbmd0aCkge1xuICAgIGxpc3QuaW5uZXJIVE1MID0gYDxkaXYgY2xhc3M9XCJyZi1jb21iby1pdGVtIG11dGVkXCI+Tm8gbWF0Y2hpbmcgcHJvZ3JhbXM8L2Rpdj5gO1xuICAgIGxpc3QuaGlkZGVuID0gZmFsc2U7IHJldHVybjtcbiAgfVxuICAvLyBOYW1lIG9ubHkgXHUyMDE0IG5vIGxvY2F0aW9uIG9yIG90aGVyIG1ldGFkYXRhLlxuICBsaXN0LmlubmVySFRNTCA9IG1hdGNoZXMubWFwKHAgPT5cbiAgICBgPGRpdiBjbGFzcz1cInJmLWNvbWJvLWl0ZW1cIiBvbm1vdXNlZG93bj1cInJlZmVycmFsUHJvZ1BpY2soJyR7ZXNjKHAuaWQpfScsICR7SlNPTi5zdHJpbmdpZnkocC5wcm9ncmFtTmFtZSB8fCAnJykucmVwbGFjZSgvXCIvZywgJyZxdW90OycpfSlcIj4ke2VzYyhwLnByb2dyYW1OYW1lIHx8ICcodW5uYW1lZCknKX08L2Rpdj5gXG4gICkuam9pbignJyk7XG4gIGxpc3QuaGlkZGVuID0gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIHJlZmVycmFsUHJvZ1BpY2soaWQ6IHN0cmluZywgbmFtZTogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGlucCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX3JmUHJvZ0lucHV0JykgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XG4gIGNvbnN0IGlkRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19yZlByb2dJZCcpIGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsO1xuICBjb25zdCBsaXN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fcmZQcm9nTGlzdCcpO1xuICBpZiAoaW5wKSBpbnAudmFsdWUgPSBuYW1lO1xuICBpZiAoaWRFbCkgaWRFbC52YWx1ZSA9IGlkO1xuICBpZiAobGlzdCkgeyBsaXN0LmhpZGRlbiA9IHRydWU7IGxpc3QuaW5uZXJIVE1MID0gJyc7IH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc2F2ZVJlZmVycmFsKCk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBtb2RhbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNfX3JlZmVycmFsTW9kYWwgLm1vZGFsLWNhcmQnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmICghbW9kYWwpIHJldHVybjtcbiAgY29uc3QgY2lkID0gbW9kYWwuZ2V0QXR0cmlidXRlKCdkYXRhLWNpZCcpIHx8ICcnO1xuICBjb25zdCBlbnRyeUlkID0gbW9kYWwuZ2V0QXR0cmlidXRlKCdkYXRhLWVudHJ5JykgfHwgJyc7XG4gIGlmICghY2lkKSB7IHNldFJlZmVycmFsTW9kYWxFcnJvcignTWlzc2luZyBjbGllbnQgaWQuJyk7IHJldHVybjsgfVxuXG4gIGNvbnN0IGZpZWxkczogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuICBtb2RhbC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1rXScpLmZvckVhY2goZWwgPT4ge1xuICAgIGNvbnN0IGsgPSAoZWwgYXMgSFRNTEVsZW1lbnQpLmRhdGFzZXQuayBhcyBzdHJpbmc7XG4gICAgZmllbGRzW2tdID0gKGVsIGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50IHwgSFRNTFNlbGVjdEVsZW1lbnQpLnZhbHVlLnRyaW0oKTtcbiAgfSk7XG5cbiAgc2V0UmVmZXJyYWxNb2RhbEVycm9yKCcnKTtcbiAgaWYgKCFmaWVsZHMucHJvZ3JhbU5hbWUpIHsgc2V0UmVmZXJyYWxNb2RhbEVycm9yKCdQaWNrIGEgcHJvZ3JhbSAodHlwZSB0byBzZWFyY2gpLicpOyByZXR1cm47IH1cbiAgLy8gQ2xlYXIgYSBzdGFsZSBkZWNsaW5lIHJlYXNvbiBpZiB0aGUgc3RhdHVzIGlzbid0IGEgZGVjbGluZSBvdXRjb21lLlxuICBpZiAoUkVGRVJSQUxfREVDTElORURfU1RBVFVTRVMuaW5kZXhPZihmaWVsZHMuc3RhdHVzKSA8IDApIGZpZWxkcy5kZWNsaW5lUmVhc29uID0gJyc7XG5cbiAgY29uc3Qgc2F2ZUJ0biA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJy5qcy1zYXZlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuICBjb25zdCBzdGF0dXMgPSBtb2RhbC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtc3RhdHVzJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoc2F2ZUJ0bikgc2F2ZUJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICdTYXZpbmdcdTIwMjYnO1xuXG4gIHRyeSB7XG4gICAgaWYgKGVudHJ5SWQpIGF3YWl0IGFwaVVwZGF0ZVJlZmVycmFsKGNpZCwgZW50cnlJZCwgZmllbGRzKTtcbiAgICBlbHNlIGF3YWl0IGFwaUFkZFJlZmVycmFsKGNpZCwgZmllbGRzKTtcbiAgICBjbG9zZVJlZmVycmFsTW9kYWwoKTtcbiAgICBhd2FpdCBsb2FkUmVmZXJyYWxzKGNpZCwgdHJ1ZSk7XG4gICAgdG9hc3QoZW50cnlJZCA/ICdSZWZlcnJhbCB1cGRhdGVkJyA6ICdSZWZlcnJhbCBhZGRlZCcpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBpZiAoc2F2ZUJ0bikgc2F2ZUJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICcnO1xuICAgIHNldFJlZmVycmFsTW9kYWxFcnJvcihlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZGVsZXRlUmVmZXJyYWxQcm9tcHQoY2lkOiBzdHJpbmcsIGVudHJ5SWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoIWVudHJ5SWQpIHJldHVybjtcbiAgaWYgKCF3aW5kb3cuY29uZmlybSgnRGVsZXRlIHRoaXMgcmVmZXJyYWw/IFRoaXMgY2FuXFwndCBiZSB1bmRvbmUuJykpIHJldHVybjtcbiAgdHJ5IHtcbiAgICBhd2FpdCBhcGlEZWxldGVSZWZlcnJhbChjaWQsIGVudHJ5SWQpO1xuICAgIGF3YWl0IGxvYWRSZWZlcnJhbHMoY2lkLCB0cnVlKTtcbiAgICB0b2FzdCgnUmVmZXJyYWwgZGVsZXRlZCcpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICB0b2FzdCgnRGVsZXRlIGZhaWxlZDogJyArIChlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSkpO1xuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFpQkEsTUFBTSxvQkFBb0IsQ0FBQyxlQUFlLGlCQUFpQixZQUFZLG9CQUFvQixZQUFZLFlBQVksbUJBQW1CLGNBQWMsVUFBVTtBQUM5SixNQUFNLDJCQUEyQixDQUFDLGdCQUFnQixtQkFBbUIsdUJBQXVCLDBCQUEwQiw0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
