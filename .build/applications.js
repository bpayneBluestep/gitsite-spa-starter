const APPLICATIONS_CACHE = {};
const APPLICATION_DATA = {};
function applicationsState(cid) {
  if (!APPLICATIONS_CACHE[cid]) APPLICATIONS_CACHE[cid] = { list: null, loading: false, error: null, busy: false, openEntryId: null };
  return APPLICATIONS_CACHE[cid];
}
async function loadApplications(cid, force = false) {
  const st = applicationsState(cid);
  if (st.loading) return;
  if (st.list && !force) return;
  st.loading = true;
  st.error = null;
  try {
    const rows = await apiListApplications(cid);
    st.list = (Array.isArray(rows) ? rows : []).map(normalizeApplication);
  } catch (e) {
    st.error = e && e.message ? e.message : String(e);
    st.list = null;
  } finally {
    st.loading = false;
    if (typeof render === "function") render();
  }
}
function normalizeApplication(r) {
  return {
    entryId: String(r.entryId || ""),
    status: r.status || "Open",
    token: r.token || "",
    url: r.url || "",
    dateCreated: r.dateCreated || "",
    completedTimestamp: r.completedTimestamp || "",
    notes: r.notes || "",
    hasData: r.hasData === true
  };
}
function appStatusPill(status) {
  const s = (status || "").toLowerCase();
  if (s === "complete") return `<span class="pill success"><span class="dot"></span>Complete</span>`;
  if (s === "closed") return `<span class="pill muted"><span class="dot"></span>Closed</span>`;
  return `<span class="pill warning"><span class="dot"></span>Open</span>`;
}
function applicationsSection(c) {
  const st = applicationsState(c.id);
  if (st.openEntryId) return applicationReaderView(c, st.openEntryId);
  const interpReady = !!appInterpreterUrl();
  const head = `<div class="section-head">
    <div><h3>Parent Application</h3><p>Send ${esc(c.first)}'s family the intake application and track its status.</p></div>
    <button class="btn primary" onclick="sendApplication('${esc(c.id)}')"${st.busy ? " disabled" : ""}>${ic("send", 15)} Send application</button>
  </div>`;
  if (st.list === null) {
    if (!st.loading && !st.error) loadApplications(c.id);
    const body = st.error ? `<div class="card"><div class="empty"><div class="ico">${ic("alert", 22)}</div><b>Couldn't load applications</b>
         <p>${esc(st.error)}</p><button class="btn primary" onclick="loadApplications('${esc(c.id)}', true)">${ic("clock", 15)} Retry</button></div></div>` : `<div class="card"><div class="empty"><div class="ico">${ic("clock", 22)}</div><b>Loading applications\u2026</b></div></div>`;
    return head + body;
  }
  const warn = interpReady ? "" : `<div class="card" style="border-color:var(--warning);margin-bottom:12px"><div style="padding:12px 16px;display:flex;gap:10px;align-items:center">
      ${ic("alert", 18)}<div style="flex:1;font-size:13px">No public interpreter URL is set, so application links won't work yet.
      <a href="#/settings/applications">Set it in Settings \u25B8 Applications</a>.</div></div></div>`;
  if (!st.list.length) {
    return head + warn + `<div class="card"><div class="empty"><div class="ico">${ic("file", 22)}</div>
      <b>No applications sent yet</b><p>Send the family a link to complete ${esc(c.first)}'s intake application.</p>
      <button class="btn primary" onclick="sendApplication('${esc(c.id)}')"${st.busy ? " disabled" : ""}>${ic("send", 15)} Send application</button></div></div>`;
  }
  const sorted = st.list.slice().sort((a, b) => (b.dateCreated || "").localeCompare(a.dateCreated || ""));
  const rows = sorted.map((a) => applicationRow(c.id, a)).join("");
  return head + warn + `<div class="app-list">${rows}</div>`;
}
function applicationRow(cid, a) {
  const created = a.dateCreated ? fmtDate(a.dateCreated) : "";
  const completed = a.completedTimestamp ? fmtStamp(a.completedTimestamp) : "";
  const meta = [];
  if (created) meta.push("Sent " + created);
  if (a.status.toLowerCase() === "complete" && completed) meta.push("Submitted " + completed);
  if (a.notes) meta.push(esc(a.notes));
  const actions = [];
  if (a.hasData) actions.push(`<button class="btn outline sm" onclick="openApplication('${esc(cid)}','${esc(a.entryId)}')">${ic("eye", 14)} View results</button>`);
  if (a.url && a.status.toLowerCase() !== "closed") {
    actions.push(`<button class="btn ghost sm" onclick="copyApplicationLink('${esc(a.url)}')">${ic("link", 14)} Copy link</button>`);
    actions.push(`<a class="btn ghost sm" href="${esc(a.url)}" target="_blank" rel="noopener">${ic("external", 14)} Open</a>`);
  }
  if (a.status.toLowerCase() === "closed") {
    actions.push(`<button class="btn ghost sm" onclick="setApplicationState('${esc(cid)}','${esc(a.entryId)}','Open')">${ic("clock", 14)} Reopen</button>`);
  } else {
    actions.push(`<button class="btn ghost sm" onclick="setApplicationState('${esc(cid)}','${esc(a.entryId)}','Closed')">${ic("x", 14)} Close</button>`);
  }
  return `<div class="card app-row">
    <div class="app-row-main">
      <div class="app-row-status">${appStatusPill(a.status)}</div>
      <div class="app-row-body">
        <div class="app-row-title">Parent Application</div>
        <div class="app-row-meta">${meta.join(" \xB7 ") || "Not sent yet"}</div>
      </div>
    </div>
    <div class="app-row-actions">${actions.join("")}</div>
  </div>`;
}
async function sendApplication(cid) {
  const st = applicationsState(cid);
  if (st.busy) return;
  st.busy = true;
  if (typeof render === "function") render();
  try {
    const created = await apiCreateApplication(cid);
    if (st.list) st.list.unshift(normalizeApplication(created));
    const url = created && created.url ? String(created.url) : "";
    if (url) {
      copyApplicationLink(url);
      toast("Application created \u2014 link copied");
    } else {
      toast("Application created. Set the interpreter URL in Settings to generate a link.");
    }
  } catch (e) {
    toast("Could not create application: " + (e && e.message ? e.message : String(e)));
  } finally {
    st.busy = false;
    loadApplications(cid, true);
  }
}
async function setApplicationState(cid, entryId, status) {
  const st = applicationsState(cid);
  if (st.busy) return;
  st.busy = true;
  if (typeof render === "function") render();
  try {
    await apiSetApplicationStatus(cid, entryId, status);
    toast(status === "Closed" ? "Application closed" : "Application reopened");
  } catch (e) {
    toast("Could not update status: " + (e && e.message ? e.message : String(e)));
  } finally {
    st.busy = false;
    loadApplications(cid, true);
  }
}
function copyApplicationLink(url) {
  if (!url) {
    toast("No link available yet");
    return;
  }
  const nav = navigator;
  if (nav && nav.clipboard && nav.clipboard.writeText) {
    nav.clipboard.writeText(url).then(() => toast("Link copied"), () => fallbackCopy(url));
  } else {
    fallbackCopy(url);
  }
}
function fallbackCopy(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    toast("Link copied");
  } catch (_e) {
    toast("Copy failed \u2014 select the link manually");
  }
}
function openApplication(cid, entryId) {
  applicationsState(cid).openEntryId = entryId;
  if (!APPLICATION_DATA[entryId]) loadApplicationData(cid, entryId);
  if (typeof render === "function") render();
}
function closeApplicationReader(cid) {
  applicationsState(cid).openEntryId = null;
  if (typeof render === "function") render();
}
async function loadApplicationData(cid, entryId) {
  if (APPLICATION_DATA[entryId] && APPLICATION_DATA[entryId].loading) return;
  APPLICATION_DATA[entryId] = { loading: true, error: null, data: null };
  try {
    const entry = await apiGetApplication(cid, entryId);
    APPLICATION_DATA[entryId] = { loading: false, error: null, data: entry && entry.rawdata || null };
  } catch (e) {
    APPLICATION_DATA[entryId] = { loading: false, error: e && e.message ? e.message : String(e), data: null };
  } finally {
    if (typeof render === "function") render();
  }
}
function applicationReaderView(c, entryId) {
  const head = `<div class="section-head">
    <div><h3>Application results</h3><p>Submitted answers for ${esc(c.first)}'s parent application.</p></div>
    <button class="btn outline" onclick="closeApplicationReader('${esc(c.id)}')">${ic("chevR", 15)} Back to applications</button>
  </div>`;
  const slot = APPLICATION_DATA[entryId];
  if (!slot || slot.loading) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic("clock", 22)}</div><b>Loading answers\u2026</b></div></div>`;
  }
  if (slot.error) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic("alert", 22)}</div><b>Couldn't load answers</b>
      <p>${esc(slot.error)}</p><button class="btn primary" onclick="loadApplicationData('${esc(c.id)}','${esc(entryId)}')">${ic("clock", 15)} Retry</button></div></div>`;
  }
  const data = slot.data;
  if (!data || !Array.isArray(data.answers) || !data.answers.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic("file", 22)}</div><b>No answers recorded</b>
      <p>This application doesn't have stored results.</p></div></div>`;
  }
  return head + applicationAnswersHtml(data);
}
function applicationAnswersHtml(data) {
  const submitted = data.submittedAtUtc ? fmtStamp(data.submittedAtUtc) : "";
  const blocks = [];
  let openRows = [];
  let sectionTitle = "";
  const flush = () => {
    if (!openRows.length && !sectionTitle) return;
    blocks.push(`<div class="card sum-card app-read-card">
      ${sectionTitle ? `<div class="hd"><b>${esc(sectionTitle)}</b></div>` : ""}
      ${openRows.join("") || '<div class="app-read-empty">No questions in this section.</div>'}
    </div>`);
    openRows = [];
  };
  data.answers.forEach((a) => {
    if (!a || !a.type) return;
    if (a.type === "header") {
      flush();
      sectionTitle = a.label || "Section";
      return;
    }
    if (a.type === "static_text") return;
    const label = a.label || "(question)";
    const display = answerDisplay(a);
    openRows.push(`<div class="sum-row"><span class="k">${esc(label)}</span><span class="v">${display}</span></div>`);
  });
  flush();
  const headerCard = `<div class="card" style="margin-bottom:12px"><div style="padding:14px 18px">
    <b style="font-size:15px">${esc(data.templateTitle || "Parent Application")}</b>
    ${submitted ? `<div style="font-size:12.5px;color:var(--muted-foreground);margin-top:2px">Submitted ${esc(submitted)}</div>` : ""}
  </div></div>`;
  return headerCard + blocks.join("");
}
function answerDisplay(a) {
  const v = a.value;
  if (v == null || v === "") return dash;
  if (Array.isArray(v)) return v.length ? v.map(esc).join(", ") : dash;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (a.type === "doc_upload") {
    return esc(String(v)) + ` <span class="pill muted" style="margin-left:6px">in Files</span>`;
  }
  if (a.type === "date") {
    const d = fmtDate(String(v));
    return d ? esc(d) : esc(String(v));
  }
  return esc(String(v));
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiYXBwbGljYXRpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgIGFwcGxpY2F0aW9ucy50cyBcdTIwMTQgdGhlIFBhcmVudCBBcHBsaWNhdGlvbiByZWNvcmQgc2VjdGlvbiAobGl2ZSkuXG5cbiAgIEVhY2ggcm93IGlzIGFuIGVudHJ5IG9uIHRoZSBjbGllbnQncyBgYXBwbGljYXRpb25gIE1FRiAoc2VydmVkIGJ5IHRoZVxuICAgbWFlc3RybyBsaXN0L2dldC9jcmVhdGUvc2V0QXBwbGljYXRpb25TdGF0dXMgYWN0aW9ucykuIFwiU2VuZCBhcHBsaWNhdGlvblwiXG4gICBtaW50cyBhIG5ldyBPcGVuIGluc3RhbmNlICsgYSB0b2tlbi1nYXRlZCBwdWJsaWMgbGluayB0aGUgZmFtaWx5IGZpbGxzIG91dFxuICAgb24gdGhlIHNhdGVsbGl0ZS1zaXRlIGludGVycHJldGVyLiBXaGVuIHRoZXkgc3VibWl0LCB0aGUgaW5nZXN0ZXIgd3JpdGVzIHRoZVxuICAgYW5zd2VycyBiYWNrLCBmbGlwcyBzdGF0dXMgdG8gQ29tcGxldGUsIGFuZCB0aGUgcm93J3MgXCJWaWV3IHJlc3VsdHNcIiBvcGVuc1xuICAgdGhlIGluLVNQQSByZWFkZXIgKG5vIHNlcGFyYXRlIHJlcG9ydCkgXHUyMDE0IGdldEFwcGxpY2F0aW9uIHJldHVybnMgdGhlIHJhd2RhdGEuXG5cbiAgIExpZmVjeWNsZS9zdGF0dXM6IE9wZW4gKHdhaXRpbmcpIFx1MDBCNyBDb21wbGV0ZSAoc3VibWl0dGVkKSBcdTAwQjcgQ2xvc2VkIChsaW5rXG4gICBtYW51YWxseSBleHBpcmVkKS4gUmVhZGVyIHZzIGxpc3QgaXMgYSBwZXItY2xpZW50IHZpZXcgZmxhZywgbGlrZSBmaWxlcy50cy5cbiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG5pbnRlcmZhY2UgTGl2ZUFwcGxpY2F0aW9uIHtcbiAgZW50cnlJZDogc3RyaW5nO1xuICBzdGF0dXM6IHN0cmluZzsgICAgICAgICAgICAvLyBPcGVuIHwgQ29tcGxldGUgfCBDbG9zZWRcbiAgdG9rZW46IHN0cmluZztcbiAgdXJsOiBzdHJpbmc7ICAgICAgICAgICAgICAgLy8gdG9rZW4tZ2F0ZWQgcHVibGljIGxpbmsgKCcnIGlmIGludGVycHJldGVyIFVSTCB1bnNldClcbiAgZGF0ZUNyZWF0ZWQ6IHN0cmluZztcbiAgY29tcGxldGVkVGltZXN0YW1wOiBzdHJpbmc7XG4gIG5vdGVzOiBzdHJpbmc7XG4gIGhhc0RhdGE6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBBcHBsaWNhdGlvbnNTdGF0ZSB7XG4gIGxpc3Q6IExpdmVBcHBsaWNhdGlvbltdIHwgbnVsbDtcbiAgbG9hZGluZzogYm9vbGVhbjtcbiAgZXJyb3I6IHN0cmluZyB8IG51bGw7XG4gIGJ1c3k6IGJvb2xlYW47ICAgICAgICAgICAgIC8vIGNyZWF0ZS9zdGF0dXMgaW4gZmxpZ2h0XG4gIG9wZW5FbnRyeUlkOiBzdHJpbmcgfCBudWxsOyAvLyB3aGVuIHNldCwgdGhlIHJlYWRlciBpcyBzaG93aW5nIHRoaXMgZW50cnlcbn1cbmNvbnN0IEFQUExJQ0FUSU9OU19DQUNIRTogeyBbY2xpZW50SWQ6IHN0cmluZ106IEFwcGxpY2F0aW9uc1N0YXRlIH0gPSB7fTtcbi8vIFJlYWRlciBkYXRhIGNhY2hlOiBwYXJzZWQgcmF3ZGF0YSBwZXIgZW50cnlJZC5cbmNvbnN0IEFQUExJQ0FUSU9OX0RBVEE6IHsgW2VudHJ5SWQ6IHN0cmluZ106IHsgbG9hZGluZzogYm9vbGVhbjsgZXJyb3I6IHN0cmluZyB8IG51bGw7IGRhdGE6IGFueSB9IH0gPSB7fTtcblxuZnVuY3Rpb24gYXBwbGljYXRpb25zU3RhdGUoY2lkOiBzdHJpbmcpOiBBcHBsaWNhdGlvbnNTdGF0ZSB7XG4gIGlmICghQVBQTElDQVRJT05TX0NBQ0hFW2NpZF0pIEFQUExJQ0FUSU9OU19DQUNIRVtjaWRdID0geyBsaXN0OiBudWxsLCBsb2FkaW5nOiBmYWxzZSwgZXJyb3I6IG51bGwsIGJ1c3k6IGZhbHNlLCBvcGVuRW50cnlJZDogbnVsbCB9O1xuICByZXR1cm4gQVBQTElDQVRJT05TX0NBQ0hFW2NpZF07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGxvYWRBcHBsaWNhdGlvbnMoY2lkOiBzdHJpbmcsIGZvcmNlID0gZmFsc2UpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgc3QgPSBhcHBsaWNhdGlvbnNTdGF0ZShjaWQpO1xuICBpZiAoc3QubG9hZGluZykgcmV0dXJuO1xuICBpZiAoc3QubGlzdCAmJiAhZm9yY2UpIHJldHVybjtcbiAgc3QubG9hZGluZyA9IHRydWU7IHN0LmVycm9yID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBjb25zdCByb3dzID0gYXdhaXQgYXBpTGlzdEFwcGxpY2F0aW9ucyhjaWQpO1xuICAgIHN0Lmxpc3QgPSAoQXJyYXkuaXNBcnJheShyb3dzKSA/IHJvd3MgOiBbXSkubWFwKG5vcm1hbGl6ZUFwcGxpY2F0aW9uKTtcbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgc3QuZXJyb3IgPSBlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKTtcbiAgICBzdC5saXN0ID0gbnVsbDtcbiAgfSBmaW5hbGx5IHtcbiAgICBzdC5sb2FkaW5nID0gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiByZW5kZXIgPT09ICdmdW5jdGlvbicpIHJlbmRlcigpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUFwcGxpY2F0aW9uKHI6IGFueSk6IExpdmVBcHBsaWNhdGlvbiB7XG4gIHJldHVybiB7XG4gICAgZW50cnlJZDogU3RyaW5nKHIuZW50cnlJZCB8fCAnJyksXG4gICAgc3RhdHVzOiByLnN0YXR1cyB8fCAnT3BlbicsXG4gICAgdG9rZW46IHIudG9rZW4gfHwgJycsXG4gICAgdXJsOiByLnVybCB8fCAnJyxcbiAgICBkYXRlQ3JlYXRlZDogci5kYXRlQ3JlYXRlZCB8fCAnJyxcbiAgICBjb21wbGV0ZWRUaW1lc3RhbXA6IHIuY29tcGxldGVkVGltZXN0YW1wIHx8ICcnLFxuICAgIG5vdGVzOiByLm5vdGVzIHx8ICcnLFxuICAgIGhhc0RhdGE6IHIuaGFzRGF0YSA9PT0gdHJ1ZSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gYXBwU3RhdHVzUGlsbChzdGF0dXM6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHMgPSAoc3RhdHVzIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICBpZiAocyA9PT0gJ2NvbXBsZXRlJykgcmV0dXJuIGA8c3BhbiBjbGFzcz1cInBpbGwgc3VjY2Vzc1wiPjxzcGFuIGNsYXNzPVwiZG90XCI+PC9zcGFuPkNvbXBsZXRlPC9zcGFuPmA7XG4gIGlmIChzID09PSAnY2xvc2VkJykgcmV0dXJuIGA8c3BhbiBjbGFzcz1cInBpbGwgbXV0ZWRcIj48c3BhbiBjbGFzcz1cImRvdFwiPjwvc3Bhbj5DbG9zZWQ8L3NwYW4+YDtcbiAgcmV0dXJuIGA8c3BhbiBjbGFzcz1cInBpbGwgd2FybmluZ1wiPjxzcGFuIGNsYXNzPVwiZG90XCI+PC9zcGFuPk9wZW48L3NwYW4+YDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIHNlY3Rpb24gdmlldyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmZ1bmN0aW9uIGFwcGxpY2F0aW9uc1NlY3Rpb24oYzogQ2xpZW50KTogc3RyaW5nIHtcbiAgY29uc3Qgc3QgPSBhcHBsaWNhdGlvbnNTdGF0ZShjLmlkKTtcblxuICAvLyBSZWFkZXIgdGFrZXMgb3ZlciB0aGUgc2VjdGlvbiB3aGVuIGFuIGVudHJ5IGlzIG9wZW4uXG4gIGlmIChzdC5vcGVuRW50cnlJZCkgcmV0dXJuIGFwcGxpY2F0aW9uUmVhZGVyVmlldyhjLCBzdC5vcGVuRW50cnlJZCk7XG5cbiAgY29uc3QgaW50ZXJwUmVhZHkgPSAhIWFwcEludGVycHJldGVyVXJsKCk7XG4gIGNvbnN0IGhlYWQgPSBgPGRpdiBjbGFzcz1cInNlY3Rpb24taGVhZFwiPlxuICAgIDxkaXY+PGgzPlBhcmVudCBBcHBsaWNhdGlvbjwvaDM+PHA+U2VuZCAke2VzYyhjLmZpcnN0KX0ncyBmYW1pbHkgdGhlIGludGFrZSBhcHBsaWNhdGlvbiBhbmQgdHJhY2sgaXRzIHN0YXR1cy48L3A+PC9kaXY+XG4gICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBwcmltYXJ5XCIgb25jbGljaz1cInNlbmRBcHBsaWNhdGlvbignJHtlc2MoYy5pZCl9JylcIiR7c3QuYnVzeSA/ICcgZGlzYWJsZWQnIDogJyd9PiR7aWMoJ3NlbmQnLCAxNSl9IFNlbmQgYXBwbGljYXRpb248L2J1dHRvbj5cbiAgPC9kaXY+YDtcblxuICBpZiAoc3QubGlzdCA9PT0gbnVsbCkge1xuICAgIGlmICghc3QubG9hZGluZyAmJiAhc3QuZXJyb3IpIGxvYWRBcHBsaWNhdGlvbnMoYy5pZCk7XG4gICAgY29uc3QgYm9keSA9IHN0LmVycm9yXG4gICAgICA/IGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdhbGVydCcsIDIyKX08L2Rpdj48Yj5Db3VsZG4ndCBsb2FkIGFwcGxpY2F0aW9uczwvYj5cbiAgICAgICAgIDxwPiR7ZXNjKHN0LmVycm9yKX08L3A+PGJ1dHRvbiBjbGFzcz1cImJ0biBwcmltYXJ5XCIgb25jbGljaz1cImxvYWRBcHBsaWNhdGlvbnMoJyR7ZXNjKGMuaWQpfScsIHRydWUpXCI+JHtpYygnY2xvY2snLCAxNSl9IFJldHJ5PC9idXR0b24+PC9kaXY+PC9kaXY+YFxuICAgICAgOiBgPGRpdiBjbGFzcz1cImNhcmRcIj48ZGl2IGNsYXNzPVwiZW1wdHlcIj48ZGl2IGNsYXNzPVwiaWNvXCI+JHtpYygnY2xvY2snLCAyMil9PC9kaXY+PGI+TG9hZGluZyBhcHBsaWNhdGlvbnNcdTIwMjY8L2I+PC9kaXY+PC9kaXY+YDtcbiAgICByZXR1cm4gaGVhZCArIGJvZHk7XG4gIH1cblxuICBjb25zdCB3YXJuID0gaW50ZXJwUmVhZHkgPyAnJyA6XG4gICAgYDxkaXYgY2xhc3M9XCJjYXJkXCIgc3R5bGU9XCJib3JkZXItY29sb3I6dmFyKC0td2FybmluZyk7bWFyZ2luLWJvdHRvbToxMnB4XCI+PGRpdiBzdHlsZT1cInBhZGRpbmc6MTJweCAxNnB4O2Rpc3BsYXk6ZmxleDtnYXA6MTBweDthbGlnbi1pdGVtczpjZW50ZXJcIj5cbiAgICAgICR7aWMoJ2FsZXJ0JywgMTgpfTxkaXYgc3R5bGU9XCJmbGV4OjE7Zm9udC1zaXplOjEzcHhcIj5ObyBwdWJsaWMgaW50ZXJwcmV0ZXIgVVJMIGlzIHNldCwgc28gYXBwbGljYXRpb24gbGlua3Mgd29uJ3Qgd29yayB5ZXQuXG4gICAgICA8YSBocmVmPVwiIy9zZXR0aW5ncy9hcHBsaWNhdGlvbnNcIj5TZXQgaXQgaW4gU2V0dGluZ3MgXHUyNUI4IEFwcGxpY2F0aW9uczwvYT4uPC9kaXY+PC9kaXY+PC9kaXY+YDtcblxuICBpZiAoIXN0Lmxpc3QubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGhlYWQgKyB3YXJuICsgYDxkaXYgY2xhc3M9XCJjYXJkXCI+PGRpdiBjbGFzcz1cImVtcHR5XCI+PGRpdiBjbGFzcz1cImljb1wiPiR7aWMoJ2ZpbGUnLCAyMil9PC9kaXY+XG4gICAgICA8Yj5ObyBhcHBsaWNhdGlvbnMgc2VudCB5ZXQ8L2I+PHA+U2VuZCB0aGUgZmFtaWx5IGEgbGluayB0byBjb21wbGV0ZSAke2VzYyhjLmZpcnN0KX0ncyBpbnRha2UgYXBwbGljYXRpb24uPC9wPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBwcmltYXJ5XCIgb25jbGljaz1cInNlbmRBcHBsaWNhdGlvbignJHtlc2MoYy5pZCl9JylcIiR7c3QuYnVzeSA/ICcgZGlzYWJsZWQnIDogJyd9PiR7aWMoJ3NlbmQnLCAxNSl9IFNlbmQgYXBwbGljYXRpb248L2J1dHRvbj48L2Rpdj48L2Rpdj5gO1xuICB9XG5cbiAgLy8gTmV3ZXN0IGZpcnN0IGJ5IGNyZWF0aW9uIGRhdGUuXG4gIGNvbnN0IHNvcnRlZCA9IHN0Lmxpc3Quc2xpY2UoKS5zb3J0KChhLCBiKSA9PiAoYi5kYXRlQ3JlYXRlZCB8fCAnJykubG9jYWxlQ29tcGFyZShhLmRhdGVDcmVhdGVkIHx8ICcnKSk7XG4gIGNvbnN0IHJvd3MgPSBzb3J0ZWQubWFwKGEgPT4gYXBwbGljYXRpb25Sb3coYy5pZCwgYSkpLmpvaW4oJycpO1xuICByZXR1cm4gaGVhZCArIHdhcm4gKyBgPGRpdiBjbGFzcz1cImFwcC1saXN0XCI+JHtyb3dzfTwvZGl2PmA7XG59XG5cbmZ1bmN0aW9uIGFwcGxpY2F0aW9uUm93KGNpZDogc3RyaW5nLCBhOiBMaXZlQXBwbGljYXRpb24pOiBzdHJpbmcge1xuICBjb25zdCBjcmVhdGVkID0gYS5kYXRlQ3JlYXRlZCA/IGZtdERhdGUoYS5kYXRlQ3JlYXRlZCkgOiAnJztcbiAgY29uc3QgY29tcGxldGVkID0gYS5jb21wbGV0ZWRUaW1lc3RhbXAgPyBmbXRTdGFtcChhLmNvbXBsZXRlZFRpbWVzdGFtcCkgOiAnJztcbiAgY29uc3QgbWV0YTogc3RyaW5nW10gPSBbXTtcbiAgaWYgKGNyZWF0ZWQpIG1ldGEucHVzaCgnU2VudCAnICsgY3JlYXRlZCk7XG4gIGlmIChhLnN0YXR1cy50b0xvd2VyQ2FzZSgpID09PSAnY29tcGxldGUnICYmIGNvbXBsZXRlZCkgbWV0YS5wdXNoKCdTdWJtaXR0ZWQgJyArIGNvbXBsZXRlZCk7XG4gIGlmIChhLm5vdGVzKSBtZXRhLnB1c2goZXNjKGEubm90ZXMpKTtcblxuICBjb25zdCBhY3Rpb25zOiBzdHJpbmdbXSA9IFtdO1xuICBpZiAoYS5oYXNEYXRhKSBhY3Rpb25zLnB1c2goYDxidXR0b24gY2xhc3M9XCJidG4gb3V0bGluZSBzbVwiIG9uY2xpY2s9XCJvcGVuQXBwbGljYXRpb24oJyR7ZXNjKGNpZCl9JywnJHtlc2MoYS5lbnRyeUlkKX0nKVwiPiR7aWMoJ2V5ZScsIDE0KX0gVmlldyByZXN1bHRzPC9idXR0b24+YCk7XG4gIGlmIChhLnVybCAmJiBhLnN0YXR1cy50b0xvd2VyQ2FzZSgpICE9PSAnY2xvc2VkJykge1xuICAgIGFjdGlvbnMucHVzaChgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdCBzbVwiIG9uY2xpY2s9XCJjb3B5QXBwbGljYXRpb25MaW5rKCcke2VzYyhhLnVybCl9JylcIj4ke2ljKCdsaW5rJywgMTQpfSBDb3B5IGxpbms8L2J1dHRvbj5gKTtcbiAgICBhY3Rpb25zLnB1c2goYDxhIGNsYXNzPVwiYnRuIGdob3N0IHNtXCIgaHJlZj1cIiR7ZXNjKGEudXJsKX1cIiB0YXJnZXQ9XCJfYmxhbmtcIiByZWw9XCJub29wZW5lclwiPiR7aWMoJ2V4dGVybmFsJywgMTQpfSBPcGVuPC9hPmApO1xuICB9XG4gIGlmIChhLnN0YXR1cy50b0xvd2VyQ2FzZSgpID09PSAnY2xvc2VkJykge1xuICAgIGFjdGlvbnMucHVzaChgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdCBzbVwiIG9uY2xpY2s9XCJzZXRBcHBsaWNhdGlvblN0YXRlKCcke2VzYyhjaWQpfScsJyR7ZXNjKGEuZW50cnlJZCl9JywnT3BlbicpXCI+JHtpYygnY2xvY2snLCAxNCl9IFJlb3BlbjwvYnV0dG9uPmApO1xuICB9IGVsc2Uge1xuICAgIGFjdGlvbnMucHVzaChgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdCBzbVwiIG9uY2xpY2s9XCJzZXRBcHBsaWNhdGlvblN0YXRlKCcke2VzYyhjaWQpfScsJyR7ZXNjKGEuZW50cnlJZCl9JywnQ2xvc2VkJylcIj4ke2ljKCd4JywgMTQpfSBDbG9zZTwvYnV0dG9uPmApO1xuICB9XG5cbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiY2FyZCBhcHAtcm93XCI+XG4gICAgPGRpdiBjbGFzcz1cImFwcC1yb3ctbWFpblwiPlxuICAgICAgPGRpdiBjbGFzcz1cImFwcC1yb3ctc3RhdHVzXCI+JHthcHBTdGF0dXNQaWxsKGEuc3RhdHVzKX08L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJhcHAtcm93LWJvZHlcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImFwcC1yb3ctdGl0bGVcIj5QYXJlbnQgQXBwbGljYXRpb248L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImFwcC1yb3ctbWV0YVwiPiR7bWV0YS5qb2luKCcgXHUwMEI3ICcpIHx8ICdOb3Qgc2VudCB5ZXQnfTwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cImFwcC1yb3ctYWN0aW9uc1wiPiR7YWN0aW9ucy5qb2luKCcnKX08L2Rpdj5cbiAgPC9kaXY+YDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIHNlbmQgLyBzdGF0dXMgLyBsaW5rIGFjdGlvbnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5hc3luYyBmdW5jdGlvbiBzZW5kQXBwbGljYXRpb24oY2lkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgc3QgPSBhcHBsaWNhdGlvbnNTdGF0ZShjaWQpO1xuICBpZiAoc3QuYnVzeSkgcmV0dXJuO1xuICBzdC5idXN5ID0gdHJ1ZTtcbiAgaWYgKHR5cGVvZiByZW5kZXIgPT09ICdmdW5jdGlvbicpIHJlbmRlcigpO1xuICB0cnkge1xuICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBhcGlDcmVhdGVBcHBsaWNhdGlvbihjaWQpO1xuICAgIC8vIE9wdGltaXN0aWNhbGx5IHByZXBlbmQ7IHJlbG9hZCB0byBzdGF5IGF1dGhvcml0YXRpdmUuXG4gICAgaWYgKHN0Lmxpc3QpIHN0Lmxpc3QudW5zaGlmdChub3JtYWxpemVBcHBsaWNhdGlvbihjcmVhdGVkKSk7XG4gICAgY29uc3QgdXJsID0gY3JlYXRlZCAmJiBjcmVhdGVkLnVybCA/IFN0cmluZyhjcmVhdGVkLnVybCkgOiAnJztcbiAgICBpZiAodXJsKSB7XG4gICAgICBjb3B5QXBwbGljYXRpb25MaW5rKHVybCk7XG4gICAgICB0b2FzdCgnQXBwbGljYXRpb24gY3JlYXRlZCBcdTIwMTQgbGluayBjb3BpZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdG9hc3QoJ0FwcGxpY2F0aW9uIGNyZWF0ZWQuIFNldCB0aGUgaW50ZXJwcmV0ZXIgVVJMIGluIFNldHRpbmdzIHRvIGdlbmVyYXRlIGEgbGluay4nKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIHRvYXN0KCdDb3VsZCBub3QgY3JlYXRlIGFwcGxpY2F0aW9uOiAnICsgKGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpKSk7XG4gIH0gZmluYWxseSB7XG4gICAgc3QuYnVzeSA9IGZhbHNlO1xuICAgIGxvYWRBcHBsaWNhdGlvbnMoY2lkLCB0cnVlKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBzZXRBcHBsaWNhdGlvblN0YXRlKGNpZDogc3RyaW5nLCBlbnRyeUlkOiBzdHJpbmcsIHN0YXR1czogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHN0ID0gYXBwbGljYXRpb25zU3RhdGUoY2lkKTtcbiAgaWYgKHN0LmJ1c3kpIHJldHVybjtcbiAgc3QuYnVzeSA9IHRydWU7XG4gIGlmICh0eXBlb2YgcmVuZGVyID09PSAnZnVuY3Rpb24nKSByZW5kZXIoKTtcbiAgdHJ5IHtcbiAgICBhd2FpdCBhcGlTZXRBcHBsaWNhdGlvblN0YXR1cyhjaWQsIGVudHJ5SWQsIHN0YXR1cyk7XG4gICAgdG9hc3Qoc3RhdHVzID09PSAnQ2xvc2VkJyA/ICdBcHBsaWNhdGlvbiBjbG9zZWQnIDogJ0FwcGxpY2F0aW9uIHJlb3BlbmVkJyk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIHRvYXN0KCdDb3VsZCBub3QgdXBkYXRlIHN0YXR1czogJyArIChlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSkpO1xuICB9IGZpbmFsbHkge1xuICAgIHN0LmJ1c3kgPSBmYWxzZTtcbiAgICBsb2FkQXBwbGljYXRpb25zKGNpZCwgdHJ1ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gY29weUFwcGxpY2F0aW9uTGluayh1cmw6IHN0cmluZyk6IHZvaWQge1xuICBpZiAoIXVybCkgeyB0b2FzdCgnTm8gbGluayBhdmFpbGFibGUgeWV0Jyk7IHJldHVybjsgfVxuICBjb25zdCBuYXY6IGFueSA9IG5hdmlnYXRvcjtcbiAgaWYgKG5hdiAmJiBuYXYuY2xpcGJvYXJkICYmIG5hdi5jbGlwYm9hcmQud3JpdGVUZXh0KSB7XG4gICAgbmF2LmNsaXBib2FyZC53cml0ZVRleHQodXJsKS50aGVuKCgpID0+IHRvYXN0KCdMaW5rIGNvcGllZCcpLCAoKSA9PiBmYWxsYmFja0NvcHkodXJsKSk7XG4gIH0gZWxzZSB7XG4gICAgZmFsbGJhY2tDb3B5KHVybCk7XG4gIH1cbn1cbmZ1bmN0aW9uIGZhbGxiYWNrQ29weSh0ZXh0OiBzdHJpbmcpOiB2b2lkIHtcbiAgdHJ5IHtcbiAgICBjb25zdCB0YSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RleHRhcmVhJyk7XG4gICAgdGEudmFsdWUgPSB0ZXh0OyB0YS5zdHlsZS5wb3NpdGlvbiA9ICdmaXhlZCc7IHRhLnN0eWxlLm9wYWNpdHkgPSAnMCc7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0YSk7IHRhLnNlbGVjdCgpO1xuICAgIGRvY3VtZW50LmV4ZWNDb21tYW5kKCdjb3B5Jyk7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh0YSk7XG4gICAgdG9hc3QoJ0xpbmsgY29waWVkJyk7XG4gIH0gY2F0Y2ggKF9lKSB7IHRvYXN0KCdDb3B5IGZhaWxlZCBcdTIwMTQgc2VsZWN0IHRoZSBsaW5rIG1hbnVhbGx5Jyk7IH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIHJlYWRlciAoaW4tU1BBLCByZXBsYWNlcyB0aGUgZmxhZ3NoaXAncyBzZXBhcmF0ZSByZXBvcnQpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZnVuY3Rpb24gb3BlbkFwcGxpY2F0aW9uKGNpZDogc3RyaW5nLCBlbnRyeUlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgYXBwbGljYXRpb25zU3RhdGUoY2lkKS5vcGVuRW50cnlJZCA9IGVudHJ5SWQ7XG4gIGlmICghQVBQTElDQVRJT05fREFUQVtlbnRyeUlkXSkgbG9hZEFwcGxpY2F0aW9uRGF0YShjaWQsIGVudHJ5SWQpO1xuICBpZiAodHlwZW9mIHJlbmRlciA9PT0gJ2Z1bmN0aW9uJykgcmVuZGVyKCk7XG59XG5mdW5jdGlvbiBjbG9zZUFwcGxpY2F0aW9uUmVhZGVyKGNpZDogc3RyaW5nKTogdm9pZCB7XG4gIGFwcGxpY2F0aW9uc1N0YXRlKGNpZCkub3BlbkVudHJ5SWQgPSBudWxsO1xuICBpZiAodHlwZW9mIHJlbmRlciA9PT0gJ2Z1bmN0aW9uJykgcmVuZGVyKCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGxvYWRBcHBsaWNhdGlvbkRhdGEoY2lkOiBzdHJpbmcsIGVudHJ5SWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoQVBQTElDQVRJT05fREFUQVtlbnRyeUlkXSAmJiBBUFBMSUNBVElPTl9EQVRBW2VudHJ5SWRdLmxvYWRpbmcpIHJldHVybjtcbiAgQVBQTElDQVRJT05fREFUQVtlbnRyeUlkXSA9IHsgbG9hZGluZzogdHJ1ZSwgZXJyb3I6IG51bGwsIGRhdGE6IG51bGwgfTtcbiAgdHJ5IHtcbiAgICBjb25zdCBlbnRyeSA9IGF3YWl0IGFwaUdldEFwcGxpY2F0aW9uKGNpZCwgZW50cnlJZCk7XG4gICAgQVBQTElDQVRJT05fREFUQVtlbnRyeUlkXSA9IHsgbG9hZGluZzogZmFsc2UsIGVycm9yOiBudWxsLCBkYXRhOiAoZW50cnkgJiYgZW50cnkucmF3ZGF0YSkgfHwgbnVsbCB9O1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBBUFBMSUNBVElPTl9EQVRBW2VudHJ5SWRdID0geyBsb2FkaW5nOiBmYWxzZSwgZXJyb3I6IGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpLCBkYXRhOiBudWxsIH07XG4gIH0gZmluYWxseSB7XG4gICAgaWYgKHR5cGVvZiByZW5kZXIgPT09ICdmdW5jdGlvbicpIHJlbmRlcigpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFwcGxpY2F0aW9uUmVhZGVyVmlldyhjOiBDbGllbnQsIGVudHJ5SWQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IGhlYWQgPSBgPGRpdiBjbGFzcz1cInNlY3Rpb24taGVhZFwiPlxuICAgIDxkaXY+PGgzPkFwcGxpY2F0aW9uIHJlc3VsdHM8L2gzPjxwPlN1Ym1pdHRlZCBhbnN3ZXJzIGZvciAke2VzYyhjLmZpcnN0KX0ncyBwYXJlbnQgYXBwbGljYXRpb24uPC9wPjwvZGl2PlxuICAgIDxidXR0b24gY2xhc3M9XCJidG4gb3V0bGluZVwiIG9uY2xpY2s9XCJjbG9zZUFwcGxpY2F0aW9uUmVhZGVyKCcke2VzYyhjLmlkKX0nKVwiPiR7aWMoJ2NoZXZSJywgMTUpfSBCYWNrIHRvIGFwcGxpY2F0aW9uczwvYnV0dG9uPlxuICA8L2Rpdj5gO1xuICBjb25zdCBzbG90ID0gQVBQTElDQVRJT05fREFUQVtlbnRyeUlkXTtcbiAgaWYgKCFzbG90IHx8IHNsb3QubG9hZGluZykge1xuICAgIHJldHVybiBoZWFkICsgYDxkaXYgY2xhc3M9XCJjYXJkXCI+PGRpdiBjbGFzcz1cImVtcHR5XCI+PGRpdiBjbGFzcz1cImljb1wiPiR7aWMoJ2Nsb2NrJywgMjIpfTwvZGl2PjxiPkxvYWRpbmcgYW5zd2Vyc1x1MjAyNjwvYj48L2Rpdj48L2Rpdj5gO1xuICB9XG4gIGlmIChzbG90LmVycm9yKSB7XG4gICAgcmV0dXJuIGhlYWQgKyBgPGRpdiBjbGFzcz1cImNhcmRcIj48ZGl2IGNsYXNzPVwiZW1wdHlcIj48ZGl2IGNsYXNzPVwiaWNvXCI+JHtpYygnYWxlcnQnLCAyMil9PC9kaXY+PGI+Q291bGRuJ3QgbG9hZCBhbnN3ZXJzPC9iPlxuICAgICAgPHA+JHtlc2Moc2xvdC5lcnJvcil9PC9wPjxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeVwiIG9uY2xpY2s9XCJsb2FkQXBwbGljYXRpb25EYXRhKCcke2VzYyhjLmlkKX0nLCcke2VzYyhlbnRyeUlkKX0nKVwiPiR7aWMoJ2Nsb2NrJywgMTUpfSBSZXRyeTwvYnV0dG9uPjwvZGl2PjwvZGl2PmA7XG4gIH1cbiAgY29uc3QgZGF0YSA9IHNsb3QuZGF0YTtcbiAgaWYgKCFkYXRhIHx8ICFBcnJheS5pc0FycmF5KGRhdGEuYW5zd2VycykgfHwgIWRhdGEuYW5zd2Vycy5sZW5ndGgpIHtcbiAgICByZXR1cm4gaGVhZCArIGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdmaWxlJywgMjIpfTwvZGl2PjxiPk5vIGFuc3dlcnMgcmVjb3JkZWQ8L2I+XG4gICAgICA8cD5UaGlzIGFwcGxpY2F0aW9uIGRvZXNuJ3QgaGF2ZSBzdG9yZWQgcmVzdWx0cy48L3A+PC9kaXY+PC9kaXY+YDtcbiAgfVxuICByZXR1cm4gaGVhZCArIGFwcGxpY2F0aW9uQW5zd2Vyc0h0bWwoZGF0YSk7XG59XG5cbi8vIFJlbmRlciB0aGUgc3RvcmVkIHN1Ym1pc3Npb24gcmVhZGFibHk6IHNlY3Rpb24gaGVhZGVycyBicmVhayB0aGUgbGlzdCwgZWFjaFxuLy8gYW5zd2VyZWQgZmllbGQgc2hvd3MgbGFiZWwgXHUyMTkyIHZhbHVlIChtdWx0aS1zZWxlY3RzIGpvaW5lZCwgYmxhbmtzIGRhc2hlZCkuXG5mdW5jdGlvbiBhcHBsaWNhdGlvbkFuc3dlcnNIdG1sKGRhdGE6IGFueSk6IHN0cmluZyB7XG4gIGNvbnN0IHN1Ym1pdHRlZCA9IGRhdGEuc3VibWl0dGVkQXRVdGMgPyBmbXRTdGFtcChkYXRhLnN1Ym1pdHRlZEF0VXRjKSA6ICcnO1xuICBjb25zdCBibG9ja3M6IHN0cmluZ1tdID0gW107XG4gIGxldCBvcGVuUm93czogc3RyaW5nW10gPSBbXTtcbiAgbGV0IHNlY3Rpb25UaXRsZSA9ICcnO1xuXG4gIGNvbnN0IGZsdXNoID0gKCkgPT4ge1xuICAgIGlmICghb3BlblJvd3MubGVuZ3RoICYmICFzZWN0aW9uVGl0bGUpIHJldHVybjtcbiAgICBibG9ja3MucHVzaChgPGRpdiBjbGFzcz1cImNhcmQgc3VtLWNhcmQgYXBwLXJlYWQtY2FyZFwiPlxuICAgICAgJHtzZWN0aW9uVGl0bGUgPyBgPGRpdiBjbGFzcz1cImhkXCI+PGI+JHtlc2Moc2VjdGlvblRpdGxlKX08L2I+PC9kaXY+YCA6ICcnfVxuICAgICAgJHtvcGVuUm93cy5qb2luKCcnKSB8fCAnPGRpdiBjbGFzcz1cImFwcC1yZWFkLWVtcHR5XCI+Tm8gcXVlc3Rpb25zIGluIHRoaXMgc2VjdGlvbi48L2Rpdj4nfVxuICAgIDwvZGl2PmApO1xuICAgIG9wZW5Sb3dzID0gW107XG4gIH07XG5cbiAgKGRhdGEuYW5zd2VycyBhcyBhbnlbXSkuZm9yRWFjaChhID0+IHtcbiAgICBpZiAoIWEgfHwgIWEudHlwZSkgcmV0dXJuO1xuICAgIGlmIChhLnR5cGUgPT09ICdoZWFkZXInKSB7IGZsdXNoKCk7IHNlY3Rpb25UaXRsZSA9IGEubGFiZWwgfHwgJ1NlY3Rpb24nOyByZXR1cm47IH1cbiAgICBpZiAoYS50eXBlID09PSAnc3RhdGljX3RleHQnKSByZXR1cm47IC8vIGluc3RydWN0aW9ucyBhcmVuJ3QgYW5zd2Vyc1xuICAgIGNvbnN0IGxhYmVsID0gYS5sYWJlbCB8fCAnKHF1ZXN0aW9uKSc7XG4gICAgY29uc3QgZGlzcGxheSA9IGFuc3dlckRpc3BsYXkoYSk7XG4gICAgb3BlblJvd3MucHVzaChgPGRpdiBjbGFzcz1cInN1bS1yb3dcIj48c3BhbiBjbGFzcz1cImtcIj4ke2VzYyhsYWJlbCl9PC9zcGFuPjxzcGFuIGNsYXNzPVwidlwiPiR7ZGlzcGxheX08L3NwYW4+PC9kaXY+YCk7XG4gIH0pO1xuICBmbHVzaCgpO1xuXG4gIGNvbnN0IGhlYWRlckNhcmQgPSBgPGRpdiBjbGFzcz1cImNhcmRcIiBzdHlsZT1cIm1hcmdpbi1ib3R0b206MTJweFwiPjxkaXYgc3R5bGU9XCJwYWRkaW5nOjE0cHggMThweFwiPlxuICAgIDxiIHN0eWxlPVwiZm9udC1zaXplOjE1cHhcIj4ke2VzYyhkYXRhLnRlbXBsYXRlVGl0bGUgfHwgJ1BhcmVudCBBcHBsaWNhdGlvbicpfTwvYj5cbiAgICAke3N1Ym1pdHRlZCA/IGA8ZGl2IHN0eWxlPVwiZm9udC1zaXplOjEyLjVweDtjb2xvcjp2YXIoLS1tdXRlZC1mb3JlZ3JvdW5kKTttYXJnaW4tdG9wOjJweFwiPlN1Ym1pdHRlZCAke2VzYyhzdWJtaXR0ZWQpfTwvZGl2PmAgOiAnJ31cbiAgPC9kaXY+PC9kaXY+YDtcblxuICByZXR1cm4gaGVhZGVyQ2FyZCArIGJsb2Nrcy5qb2luKCcnKTtcbn1cblxuZnVuY3Rpb24gYW5zd2VyRGlzcGxheShhOiBhbnkpOiBzdHJpbmcge1xuICBjb25zdCB2ID0gYS52YWx1ZTtcbiAgaWYgKHYgPT0gbnVsbCB8fCB2ID09PSAnJykgcmV0dXJuIGRhc2g7XG4gIGlmIChBcnJheS5pc0FycmF5KHYpKSByZXR1cm4gdi5sZW5ndGggPyB2Lm1hcChlc2MpLmpvaW4oJywgJykgOiBkYXNoO1xuICBpZiAodHlwZW9mIHYgPT09ICdib29sZWFuJykgcmV0dXJuIHYgPyAnWWVzJyA6ICdObyc7XG4gIGlmIChhLnR5cGUgPT09ICdkb2NfdXBsb2FkJykge1xuICAgIC8vIHZhbHVlIGNhcnJpZXMgdGhlIHVwbG9hZGVkIGZpbGVuYW1lKHMpOyB0aGUgZmlsZSBpdHNlbGYgbGFuZHMgaW4gdGhlXG4gICAgLy8gY2xpZW50J3MgRmlsZXMgKEFwcGxpY2F0aW9uIEF0dGFjaG1lbnRzKS5cbiAgICByZXR1cm4gZXNjKFN0cmluZyh2KSkgKyBgIDxzcGFuIGNsYXNzPVwicGlsbCBtdXRlZFwiIHN0eWxlPVwibWFyZ2luLWxlZnQ6NnB4XCI+aW4gRmlsZXM8L3NwYW4+YDtcbiAgfVxuICBpZiAoYS50eXBlID09PSAnZGF0ZScpIHsgY29uc3QgZCA9IGZtdERhdGUoU3RyaW5nKHYpKTsgcmV0dXJuIGQgPyBlc2MoZCkgOiBlc2MoU3RyaW5nKHYpKTsgfVxuICByZXR1cm4gZXNjKFN0cmluZyh2KSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFnQ0EsTUFBTSxxQkFBZ0UsQ0FBQztBQUV2RSxNQUFNLG1CQUFpRyxDQUFDO0FBRXhHLFNBQVMsa0JBQWtCLEtBQWdDO0FBQ3pELE1BQUksQ0FBQyxtQkFBbUIsR0FBRyxFQUFHLG9CQUFtQixHQUFHLElBQUksRUFBRSxNQUFNLE1BQU0sU0FBUyxPQUFPLE9BQU8sTUFBTSxNQUFNLE9BQU8sYUFBYSxLQUFLO0FBQ2xJLFNBQU8sbUJBQW1CLEdBQUc7QUFDL0I7QUFFQSxlQUFlLGlCQUFpQixLQUFhLFFBQVEsT0FBc0I7QUFDekUsUUFBTSxLQUFLLGtCQUFrQixHQUFHO0FBQ2hDLE1BQUksR0FBRyxR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
