const TASK_STATUSES = ["To Do", "In Progress", "Blocked", "Done"];
const TASK_PRIORITIES = ["Low", "Medium", "High"];
const TASK_CATEGORIES = ["General", "Follow-up", "Document", "Call / Email", "Placement", "Admin"];
const TASK_DONE_STATUS = "Done";
const TASKS_CACHE = {};
function tasksState(cid) {
  if (!TASKS_CACHE[cid]) TASKS_CACHE[cid] = { list: null, loading: false, error: null };
  return TASKS_CACHE[cid];
}
async function loadTasks(cid, force = false) {
  const st = tasksState(cid);
  if (st.loading) return;
  if (st.list && !force) return;
  st.loading = true;
  st.error = null;
  try {
    const rows = await apiListTasks(cid);
    st.list = (Array.isArray(rows) ? rows : []).map(normalizeTask);
  } catch (e) {
    st.error = e && e.message ? e.message : String(e);
    st.list = null;
  } finally {
    st.loading = false;
    if (typeof render === "function") render();
  }
}
function normalizeTask(r) {
  return {
    entryId: String(r.entryId || ""),
    title: r.title || "",
    status: r.status || "",
    priority: r.priority || "",
    dueDate: r.dueDate || "",
    assignee: r.assignee || "",
    category: r.category || "",
    details: r.details || "",
    createdBy: r.createdBy || "",
    createdAt: r.createdAt || "",
    completedAt: r.completedAt || ""
  };
}
function taskIsOverdue(t) {
  if (t.status === TASK_DONE_STATUS || !t.dueDate) return false;
  return t.dueDate < todayISO();
}
function tasksSection(c) {
  const st = tasksState(c.id);
  const head = `<div class="section-head">
    <div><h3>Tasks</h3><p>Follow-ups, reminders, and to-dos for ${esc(c.first)}.</p></div>
    <button class="btn primary" onclick="openTaskModal('${esc(c.id)}')">${ic("plus", 15)} Add task</button>
  </div>`;
  if (st.list === null) {
    if (!st.loading && !st.error) loadTasks(c.id);
    const body = st.error ? `<div class="card"><div class="empty"><div class="ico">${ic("alert", 22)}</div><b>Couldn't load tasks</b>
         <p>${esc(st.error)}</p><button class="btn primary" onclick="loadTasks('${esc(c.id)}', true)">${ic("clock", 15)} Retry</button></div></div>` : `<div class="card"><div class="empty"><div class="ico">${ic("clock", 22)}</div><b>Loading tasks\u2026</b></div></div>`;
    return head + body;
  }
  if (!st.list.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic("report", 22)}</div>
      <b>No tasks yet</b><p>Add a follow-up or reminder to start this client's to-do list.</p>
      <button class="btn primary" onclick="openTaskModal('${esc(c.id)}')">${ic("plus", 15)} Add task</button></div></div>`;
  }
  const pOrder = { High: 0, Medium: 1, Low: 2, "": 3 };
  const groups = TASK_STATUSES.map((status) => {
    const items = st.list.filter((t) => (t.status || "To Do") === status);
    if (!items.length) return "";
    items.sort((a, b) => {
      const p = (pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3);
      if (p !== 0) return p;
      return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
    });
    const cards = items.map((t) => taskCard(c.id, t)).join("");
    return `<div class="task-group"><div class="task-group-head">${esc(status)}<span class="task-count">${items.length}</span></div>${cards}</div>`;
  }).join("");
  const known = TASK_STATUSES;
  const orphans = st.list.filter((t) => known.indexOf(t.status || "To Do") === -1);
  const orphanHtml = orphans.length ? `<div class="task-group"><div class="task-group-head">Other<span class="task-count">${orphans.length}</span></div>${orphans.map((t) => taskCard(c.id, t)).join("")}</div>` : "";
  return head + `<div class="task-board">${groups}${orphanHtml}</div>`;
}
function taskCard(cid, t) {
  const done = t.status === TASK_DONE_STATUS;
  const overdue = taskIsOverdue(t);
  const prClass = t.priority === "High" ? "pr-high" : t.priority === "Medium" ? "pr-med" : "pr-low";
  const prChip = t.priority ? `<span class="task-pri ${prClass}">${esc(t.priority)}</span>` : "";
  const catChip = t.category ? `<span class="task-cat">${esc(t.category)}</span>` : "";
  const due = t.dueDate ? `<span class="task-due${overdue ? " overdue" : ""}">${ic("calendar", 13)} ${esc(fmtDate(t.dueDate))}${overdue ? " \xB7 overdue" : ""}</span>` : "";
  const who = t.assignee ? `<span class="task-assignee">${ic("users", 13)} ${esc(t.assignee)}</span>` : "";
  const foot = t.createdBy || t.createdAt ? `<div class="task-foot">Added${t.createdBy ? " by " + esc(t.createdBy) : ""}${t.createdAt ? " \xB7 " + esc(fmtDate(t.createdAt)) : ""}${done && t.completedAt ? " \xB7 done " + esc(fmtDate(t.completedAt)) : ""}</div>` : "";
  const meta = [prChip, catChip, due, who].filter(Boolean).join("");
  return `<div class="card task-card${done ? " done" : ""}">
    <div class="task-top">
      <label class="task-check" title="${done ? "Mark not done" : "Mark done"}">
        <input type="checkbox" ${done ? "checked" : ""} onclick="toggleTaskDone('${esc(cid)}','${esc(t.entryId)}', this.checked)">
        <span class="task-title">${esc(t.title) || '<span style="color:var(--muted-foreground)">(untitled)</span>'}</span>
      </label>
      <span style="flex:1"></span>
      <div class="cc-acts">
        <button class="ico-mini" title="Edit" onclick="openTaskModal('${esc(cid)}','${esc(t.entryId)}')">${ic("edit", 15)}</button>
        <button class="ico-mini danger" title="Delete" onclick="deleteTaskPrompt('${esc(cid)}','${esc(t.entryId)}')">${ic("trash", 15)}</button>
      </div>
    </div>
    ${meta ? `<div class="task-meta">${meta}</div>` : ""}
    ${t.details ? `<div class="task-details">${esc(t.details)}</div>` : ""}
    ${foot}
  </div>`;
}
async function toggleTaskDone(cid, entryId, checked) {
  const status = checked ? TASK_DONE_STATUS : "To Do";
  try {
    await apiUpdateTask(cid, entryId, { status });
    await loadTasks(cid, true);
  } catch (e) {
    toast("Update failed: " + (e && e.message ? e.message : String(e)));
    loadTasks(cid, true);
  }
}
function taskSelectControl(dataK, choices, current, placeholder) {
  const opts = [`<option value="">${esc(placeholder)}</option>`].concat(choices.map((o) => `<option value="${esc(o)}"${o === current ? " selected" : ""}>${esc(o)}</option>`)).join("");
  return `<select data-k="${dataK}">${opts}</select>`;
}
function openTaskModal(cid, entryId) {
  if (document.getElementById("__taskModal")) closeTaskModal();
  const st = tasksState(cid);
  const t = entryId && st.list ? st.list.filter((x) => x.entryId === entryId)[0] || null : null;
  const editing = !!t;
  const host = document.createElement("div");
  host.className = "modal-overlay";
  host.id = "__taskModal";
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="${editing ? "Edit task" : "Add task"}"
      data-cid="${esc(cid)}" data-entry="${esc(entryId || "")}">
    <div class="modal-head">
      <div><b>${editing ? "Edit task" : "Add task"}</b><p>${editing ? "Update this to-do." : "Create a follow-up, reminder, or to-do."}</p></div>
      <button class="ico-x" title="Close" onclick="closeTaskModal()">${ic("x", 18)}</button>
    </div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <div class="field-grid">
        <div class="field full"><label>Title</label><input type="text" data-k="title" value="${esc(t ? t.title : "")}" placeholder="What needs to happen?" autocomplete="off"></div>
        <div class="field"><label>Status</label>${taskSelectControl("status", TASK_STATUSES, t ? t.status : "To Do", "\u2014")}</div>
        <div class="field"><label>Priority</label>${taskSelectControl("priority", TASK_PRIORITIES, t ? t.priority : "Medium", "\u2014")}</div>
        <div class="field"><label>Due date</label><input type="date" data-k="dueDate" value="${esc(t ? t.dueDate : "")}"></div>
        <div class="field"><label>Category</label>${taskSelectControl("category", TASK_CATEGORIES, t ? t.category : "", "\u2014")}</div>
        <div class="field full"><label>Assignee</label><input type="text" data-k="assignee" value="${esc(t ? t.assignee : "")}" placeholder="Who owns this? (defaults to you)" autocomplete="off"></div>
        <div class="field full"><label>Details</label><textarea data-k="details" rows="4" placeholder="Notes (optional)">${esc(t ? t.details : "")}</textarea></div>
      </div>
    </div>
    <div class="modal-foot">
      <span class="modal-status"></span>
      <span style="flex:1"></span>
      <button class="btn ghost" onclick="closeTaskModal()">${ic("x", 15)} Cancel</button>
      <button class="btn primary js-save" onclick="saveTask()">${ic("save", 15)} ${editing ? "Save changes" : "Add task"}</button>
    </div>
  </div>`;
  host.addEventListener("mousedown", (e) => {
    if (e.target === host) closeTaskModal();
  });
  document.body.appendChild(host);
  const title = host.querySelector('input[data-k="title"]');
  if (title) title.focus();
  document.addEventListener("keydown", taskEscClose);
}
function taskEscClose(e) {
  if (e.key === "Escape") closeTaskModal();
}
function closeTaskModal() {
  const m = document.getElementById("__taskModal");
  if (m) m.remove();
  document.removeEventListener("keydown", taskEscClose);
}
function setTaskModalError(msg) {
  const el = document.querySelector("#__taskModal .modal-err");
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}
async function saveTask() {
  const modal = document.querySelector("#__taskModal .modal-card");
  if (!modal) return;
  const cid = modal.getAttribute("data-cid") || "";
  const entryId = modal.getAttribute("data-entry") || "";
  if (!cid) {
    setTaskModalError("Missing client id.");
    return;
  }
  const fields = {};
  modal.querySelectorAll("[data-k]").forEach((el) => {
    const k = el.dataset.k;
    fields[k] = el.value.trim();
  });
  setTaskModalError("");
  if (!fields.title) {
    setTaskModalError("Give the task a title.");
    return;
  }
  const saveBtn = modal.querySelector(".js-save");
  const status = modal.querySelector(".modal-status");
  if (saveBtn) saveBtn.disabled = true;
  if (status) status.textContent = "Saving\u2026";
  try {
    if (entryId) await apiUpdateTask(cid, entryId, fields);
    else await apiAddTask(cid, fields);
    closeTaskModal();
    await loadTasks(cid, true);
    toast(entryId ? "Task updated" : "Task added");
  } catch (e) {
    if (saveBtn) saveBtn.disabled = false;
    if (status) status.textContent = "";
    setTaskModalError(e && e.message ? e.message : String(e));
  }
}
async function deleteTaskPrompt(cid, entryId) {
  if (!entryId) return;
  if (!window.confirm("Delete this task? This can't be undone.")) return;
  try {
    await apiDeleteTask(cid, entryId);
    await loadTasks(cid, true);
    toast("Task deleted");
  } catch (e) {
    toast("Delete failed: " + (e && e.message ? e.message : String(e)));
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidGFza3MudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgdGFza3MudHMgXHUyMDE0IHRoZSBUYXNrcyByZWNvcmQgc2VjdGlvbiAobXVsdGktZW50cnksIGxpdmUpLlxuXG4gICBBIHBlci1jbGllbnQgdG8tZG8gbGlzdCBvbiB0aGUgY2xpZW50J3MgYHRhc2tzYCBNRUYsIHNlcnZlZCBieSB0aGUgbWFlc3Ryb1xuICAgKGxpc3RUYXNrcy9hZGRUYXNrL3VwZGF0ZVRhc2svZGVsZXRlVGFzaykuIEVhY2ggZW50cnkgaGFzIGFuIGVudHJ5SWQgdXNlZCB0b1xuICAgdGFyZ2V0IGVkaXRzL2RlbGV0ZXMvY29tcGxldGUtdG9nZ2xlcy4gY3JlYXRlZEJ5L2NyZWF0ZWRBdCBhcmUgc3RhbXBlZFxuICAgc2VydmVyLXNpZGUgb24gYWRkOyBjb21wbGV0ZWRBdCBpcyBzdGFtcGVkIHdoZW4gc3RhdHVzIG1vdmVzIHRvIFwiRG9uZVwiLlxuXG4gICBUYXNrcyBhcmUgZ3JvdXBlZCBieSBzdGF0dXMgKFRvIERvIFx1MjE5MiBJbiBQcm9ncmVzcyBcdTIxOTIgQmxvY2tlZCBcdTIxOTIgRG9uZSk7IHdpdGhpbiBhXG4gICBncm91cCB0aGV5IHNvcnQgYnkgcHJpb3JpdHkgdGhlbiBkdWUgZGF0ZS4gQSBjaGVja2JveCB0b2dnbGVzIERvbmUgXHUyMTk0IFRvIERvLlxuXG4gICBJbmplY3RlZCBjb250cm9scyB1c2UgZGF0YS1rLCBuZXZlciBgbmFtZWAgKG1lcmdlLXJlcG9ydCBnb3RjaGEpLlxuICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbi8vIFRoZXNlIE1VU1QgbWF0Y2ggdGhlIG9wdGlvbi1saXN0IGxhYmVscyBvbiB0aGUgdGFza3MgZm9ybSAoc2V0QnlOYW1lIHJlc29sdmVzXG4vLyB0aGUgc3RvcmVkIG9wdGlvbiBieSBkaXNwbGF5IG5hbWUpLlxuY29uc3QgVEFTS19TVEFUVVNFUyA9IFsnVG8gRG8nLCAnSW4gUHJvZ3Jlc3MnLCAnQmxvY2tlZCcsICdEb25lJ107XG5jb25zdCBUQVNLX1BSSU9SSVRJRVMgPSBbJ0xvdycsICdNZWRpdW0nLCAnSGlnaCddO1xuY29uc3QgVEFTS19DQVRFR09SSUVTID0gWydHZW5lcmFsJywgJ0ZvbGxvdy11cCcsICdEb2N1bWVudCcsICdDYWxsIC8gRW1haWwnLCAnUGxhY2VtZW50JywgJ0FkbWluJ107XG5jb25zdCBUQVNLX0RPTkVfU1RBVFVTID0gJ0RvbmUnO1xuXG5pbnRlcmZhY2UgTGl2ZVRhc2sge1xuICBlbnRyeUlkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7IHN0YXR1czogc3RyaW5nOyBwcmlvcml0eTogc3RyaW5nOyBkdWVEYXRlOiBzdHJpbmc7XG4gIGFzc2lnbmVlOiBzdHJpbmc7IGNhdGVnb3J5OiBzdHJpbmc7IGRldGFpbHM6IHN0cmluZztcbiAgY3JlYXRlZEJ5OiBzdHJpbmc7IGNyZWF0ZWRBdDogc3RyaW5nOyBjb21wbGV0ZWRBdDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgVGFza3NTdGF0ZSB7IGxpc3Q6IExpdmVUYXNrW10gfCBudWxsOyBsb2FkaW5nOiBib29sZWFuOyBlcnJvcjogc3RyaW5nIHwgbnVsbDsgfVxuY29uc3QgVEFTS1NfQ0FDSEU6IHsgW2NsaWVudElkOiBzdHJpbmddOiBUYXNrc1N0YXRlIH0gPSB7fTtcblxuZnVuY3Rpb24gdGFza3NTdGF0ZShjaWQ6IHN0cmluZyk6IFRhc2tzU3RhdGUge1xuICBpZiAoIVRBU0tTX0NBQ0hFW2NpZF0pIFRBU0tTX0NBQ0hFW2NpZF0gPSB7IGxpc3Q6IG51bGwsIGxvYWRpbmc6IGZhbHNlLCBlcnJvcjogbnVsbCB9O1xuICByZXR1cm4gVEFTS1NfQ0FDSEVbY2lkXTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gbG9hZFRhc2tzKGNpZDogc3RyaW5nLCBmb3JjZSA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHN0ID0gdGFza3NTdGF0ZShjaWQpO1xuICBpZiAoc3QubG9hZGluZykgcmV0dXJuO1xuICBpZiAoc3QubGlzdCAmJiAhZm9yY2UpIHJldHVybjtcbiAgc3QubG9hZGluZyA9IHRydWU7IHN0LmVycm9yID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBjb25zdCByb3dzID0gYXdhaXQgYXBpTGlzdFRhc2tzKGNpZCk7XG4gICAgc3QubGlzdCA9IChBcnJheS5pc0FycmF5KHJvd3MpID8gcm93cyA6IFtdKS5tYXAobm9ybWFsaXplVGFzayk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIHN0LmVycm9yID0gZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSk7XG4gICAgc3QubGlzdCA9IG51bGw7XG4gIH0gZmluYWxseSB7XG4gICAgc3QubG9hZGluZyA9IGZhbHNlO1xuICAgIGlmICh0eXBlb2YgcmVuZGVyID09PSAnZnVuY3Rpb24nKSByZW5kZXIoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBub3JtYWxpemVUYXNrKHI6IGFueSk6IExpdmVUYXNrIHtcbiAgcmV0dXJuIHtcbiAgICBlbnRyeUlkOiBTdHJpbmcoci5lbnRyeUlkIHx8ICcnKSxcbiAgICB0aXRsZTogci50aXRsZSB8fCAnJywgc3RhdHVzOiByLnN0YXR1cyB8fCAnJywgcHJpb3JpdHk6IHIucHJpb3JpdHkgfHwgJycsIGR1ZURhdGU6IHIuZHVlRGF0ZSB8fCAnJyxcbiAgICBhc3NpZ25lZTogci5hc3NpZ25lZSB8fCAnJywgY2F0ZWdvcnk6IHIuY2F0ZWdvcnkgfHwgJycsIGRldGFpbHM6IHIuZGV0YWlscyB8fCAnJyxcbiAgICBjcmVhdGVkQnk6IHIuY3JlYXRlZEJ5IHx8ICcnLCBjcmVhdGVkQXQ6IHIuY3JlYXRlZEF0IHx8ICcnLCBjb21wbGV0ZWRBdDogci5jb21wbGV0ZWRBdCB8fCAnJyxcbiAgfTtcbn1cblxuZnVuY3Rpb24gdGFza0lzT3ZlcmR1ZSh0OiBMaXZlVGFzayk6IGJvb2xlYW4ge1xuICBpZiAodC5zdGF0dXMgPT09IFRBU0tfRE9ORV9TVEFUVVMgfHwgIXQuZHVlRGF0ZSkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gdC5kdWVEYXRlIDwgdG9kYXlJU08oKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIHNlY3Rpb24gdmlldyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmZ1bmN0aW9uIHRhc2tzU2VjdGlvbihjOiBDbGllbnQpOiBzdHJpbmcge1xuICBjb25zdCBzdCA9IHRhc2tzU3RhdGUoYy5pZCk7XG4gIGNvbnN0IGhlYWQgPSBgPGRpdiBjbGFzcz1cInNlY3Rpb24taGVhZFwiPlxuICAgIDxkaXY+PGgzPlRhc2tzPC9oMz48cD5Gb2xsb3ctdXBzLCByZW1pbmRlcnMsIGFuZCB0by1kb3MgZm9yICR7ZXNjKGMuZmlyc3QpfS48L3A+PC9kaXY+XG4gICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBwcmltYXJ5XCIgb25jbGljaz1cIm9wZW5UYXNrTW9kYWwoJyR7ZXNjKGMuaWQpfScpXCI+JHtpYygncGx1cycsIDE1KX0gQWRkIHRhc2s8L2J1dHRvbj5cbiAgPC9kaXY+YDtcblxuICBpZiAoc3QubGlzdCA9PT0gbnVsbCkge1xuICAgIGlmICghc3QubG9hZGluZyAmJiAhc3QuZXJyb3IpIGxvYWRUYXNrcyhjLmlkKTtcbiAgICBjb25zdCBib2R5ID0gc3QuZXJyb3JcbiAgICAgID8gYDxkaXYgY2xhc3M9XCJjYXJkXCI+PGRpdiBjbGFzcz1cImVtcHR5XCI+PGRpdiBjbGFzcz1cImljb1wiPiR7aWMoJ2FsZXJ0JywgMjIpfTwvZGl2PjxiPkNvdWxkbid0IGxvYWQgdGFza3M8L2I+XG4gICAgICAgICA8cD4ke2VzYyhzdC5lcnJvcil9PC9wPjxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeVwiIG9uY2xpY2s9XCJsb2FkVGFza3MoJyR7ZXNjKGMuaWQpfScsIHRydWUpXCI+JHtpYygnY2xvY2snLCAxNSl9IFJldHJ5PC9idXR0b24+PC9kaXY+PC9kaXY+YFxuICAgICAgOiBgPGRpdiBjbGFzcz1cImNhcmRcIj48ZGl2IGNsYXNzPVwiZW1wdHlcIj48ZGl2IGNsYXNzPVwiaWNvXCI+JHtpYygnY2xvY2snLCAyMil9PC9kaXY+PGI+TG9hZGluZyB0YXNrc1x1MjAyNjwvYj48L2Rpdj48L2Rpdj5gO1xuICAgIHJldHVybiBoZWFkICsgYm9keTtcbiAgfVxuXG4gIGlmICghc3QubGlzdC5sZW5ndGgpIHtcbiAgICByZXR1cm4gaGVhZCArIGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdyZXBvcnQnLCAyMil9PC9kaXY+XG4gICAgICA8Yj5ObyB0YXNrcyB5ZXQ8L2I+PHA+QWRkIGEgZm9sbG93LXVwIG9yIHJlbWluZGVyIHRvIHN0YXJ0IHRoaXMgY2xpZW50J3MgdG8tZG8gbGlzdC48L3A+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnlcIiBvbmNsaWNrPVwib3BlblRhc2tNb2RhbCgnJHtlc2MoYy5pZCl9JylcIj4ke2ljKCdwbHVzJywgMTUpfSBBZGQgdGFzazwvYnV0dG9uPjwvZGl2PjwvZGl2PmA7XG4gIH1cblxuICBjb25zdCBwT3JkZXI6IHsgW2s6IHN0cmluZ106IG51bWJlciB9ID0geyBIaWdoOiAwLCBNZWRpdW06IDEsIExvdzogMiwgJyc6IDMgfTtcbiAgY29uc3QgZ3JvdXBzID0gVEFTS19TVEFUVVNFUy5tYXAoc3RhdHVzID0+IHtcbiAgICBjb25zdCBpdGVtcyA9IHN0Lmxpc3QhLmZpbHRlcih0ID0+ICh0LnN0YXR1cyB8fCAnVG8gRG8nKSA9PT0gc3RhdHVzKTtcbiAgICBpZiAoIWl0ZW1zLmxlbmd0aCkgcmV0dXJuICcnO1xuICAgIGl0ZW1zLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIGNvbnN0IHAgPSAocE9yZGVyW2EucHJpb3JpdHldID8/IDMpIC0gKHBPcmRlcltiLnByaW9yaXR5XSA/PyAzKTtcbiAgICAgIGlmIChwICE9PSAwKSByZXR1cm4gcDtcbiAgICAgIHJldHVybiAoYS5kdWVEYXRlIHx8ICc5OTk5JykubG9jYWxlQ29tcGFyZShiLmR1ZURhdGUgfHwgJzk5OTknKTtcbiAgICB9KTtcbiAgICBjb25zdCBjYXJkcyA9IGl0ZW1zLm1hcCh0ID0+IHRhc2tDYXJkKGMuaWQsIHQpKS5qb2luKCcnKTtcbiAgICByZXR1cm4gYDxkaXYgY2xhc3M9XCJ0YXNrLWdyb3VwXCI+PGRpdiBjbGFzcz1cInRhc2stZ3JvdXAtaGVhZFwiPiR7ZXNjKHN0YXR1cyl9PHNwYW4gY2xhc3M9XCJ0YXNrLWNvdW50XCI+JHtpdGVtcy5sZW5ndGh9PC9zcGFuPjwvZGl2PiR7Y2FyZHN9PC9kaXY+YDtcbiAgfSkuam9pbignJyk7XG5cbiAgLy8gQW55IHRhc2tzIHdob3NlIHN0YXR1cyBpc24ndCBvbmUgb2YgdGhlIGtub3duIGNvbHVtbnMgKGRlZmVuc2l2ZSkgXHUyMTkyIHNob3cgYXQgZW5kLlxuICBjb25zdCBrbm93biA9IFRBU0tfU1RBVFVTRVM7XG4gIGNvbnN0IG9ycGhhbnMgPSBzdC5saXN0LmZpbHRlcih0ID0+IGtub3duLmluZGV4T2YodC5zdGF0dXMgfHwgJ1RvIERvJykgPT09IC0xKTtcbiAgY29uc3Qgb3JwaGFuSHRtbCA9IG9ycGhhbnMubGVuZ3RoXG4gICAgPyBgPGRpdiBjbGFzcz1cInRhc2stZ3JvdXBcIj48ZGl2IGNsYXNzPVwidGFzay1ncm91cC1oZWFkXCI+T3RoZXI8c3BhbiBjbGFzcz1cInRhc2stY291bnRcIj4ke29ycGhhbnMubGVuZ3RofTwvc3Bhbj48L2Rpdj4ke29ycGhhbnMubWFwKHQgPT4gdGFza0NhcmQoYy5pZCwgdCkpLmpvaW4oJycpfTwvZGl2PmBcbiAgICA6ICcnO1xuXG4gIHJldHVybiBoZWFkICsgYDxkaXYgY2xhc3M9XCJ0YXNrLWJvYXJkXCI+JHtncm91cHN9JHtvcnBoYW5IdG1sfTwvZGl2PmA7XG59XG5cbmZ1bmN0aW9uIHRhc2tDYXJkKGNpZDogc3RyaW5nLCB0OiBMaXZlVGFzayk6IHN0cmluZyB7XG4gIGNvbnN0IGRvbmUgPSB0LnN0YXR1cyA9PT0gVEFTS19ET05FX1NUQVRVUztcbiAgY29uc3Qgb3ZlcmR1ZSA9IHRhc2tJc092ZXJkdWUodCk7XG4gIGNvbnN0IHByQ2xhc3MgPSB0LnByaW9yaXR5ID09PSAnSGlnaCcgPyAncHItaGlnaCcgOiB0LnByaW9yaXR5ID09PSAnTWVkaXVtJyA/ICdwci1tZWQnIDogJ3ByLWxvdyc7XG4gIGNvbnN0IHByQ2hpcCA9IHQucHJpb3JpdHkgPyBgPHNwYW4gY2xhc3M9XCJ0YXNrLXByaSAke3ByQ2xhc3N9XCI+JHtlc2ModC5wcmlvcml0eSl9PC9zcGFuPmAgOiAnJztcbiAgY29uc3QgY2F0Q2hpcCA9IHQuY2F0ZWdvcnkgPyBgPHNwYW4gY2xhc3M9XCJ0YXNrLWNhdFwiPiR7ZXNjKHQuY2F0ZWdvcnkpfTwvc3Bhbj5gIDogJyc7XG4gIGNvbnN0IGR1ZSA9IHQuZHVlRGF0ZSA/IGA8c3BhbiBjbGFzcz1cInRhc2stZHVlJHtvdmVyZHVlID8gJyBvdmVyZHVlJyA6ICcnfVwiPiR7aWMoJ2NhbGVuZGFyJywgMTMpfSAke2VzYyhmbXREYXRlKHQuZHVlRGF0ZSkpfSR7b3ZlcmR1ZSA/ICcgXHUwMEI3IG92ZXJkdWUnIDogJyd9PC9zcGFuPmAgOiAnJztcbiAgY29uc3Qgd2hvID0gdC5hc3NpZ25lZSA/IGA8c3BhbiBjbGFzcz1cInRhc2stYXNzaWduZWVcIj4ke2ljKCd1c2VycycsIDEzKX0gJHtlc2ModC5hc3NpZ25lZSl9PC9zcGFuPmAgOiAnJztcbiAgY29uc3QgZm9vdCA9ICh0LmNyZWF0ZWRCeSB8fCB0LmNyZWF0ZWRBdClcbiAgICA/IGA8ZGl2IGNsYXNzPVwidGFzay1mb290XCI+QWRkZWQke3QuY3JlYXRlZEJ5ID8gJyBieSAnICsgZXNjKHQuY3JlYXRlZEJ5KSA6ICcnfSR7dC5jcmVhdGVkQXQgPyAnIFx1MDBCNyAnICsgZXNjKGZtdERhdGUodC5jcmVhdGVkQXQpKSA6ICcnfSR7ZG9uZSAmJiB0LmNvbXBsZXRlZEF0ID8gJyBcdTAwQjcgZG9uZSAnICsgZXNjKGZtdERhdGUodC5jb21wbGV0ZWRBdCkpIDogJyd9PC9kaXY+YFxuICAgIDogJyc7XG4gIGNvbnN0IG1ldGEgPSBbcHJDaGlwLCBjYXRDaGlwLCBkdWUsIHdob10uZmlsdGVyKEJvb2xlYW4pLmpvaW4oJycpO1xuXG4gIHJldHVybiBgPGRpdiBjbGFzcz1cImNhcmQgdGFzay1jYXJkJHtkb25lID8gJyBkb25lJyA6ICcnfVwiPlxuICAgIDxkaXYgY2xhc3M9XCJ0YXNrLXRvcFwiPlxuICAgICAgPGxhYmVsIGNsYXNzPVwidGFzay1jaGVja1wiIHRpdGxlPVwiJHtkb25lID8gJ01hcmsgbm90IGRvbmUnIDogJ01hcmsgZG9uZSd9XCI+XG4gICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiAke2RvbmUgPyAnY2hlY2tlZCcgOiAnJ30gb25jbGljaz1cInRvZ2dsZVRhc2tEb25lKCcke2VzYyhjaWQpfScsJyR7ZXNjKHQuZW50cnlJZCl9JywgdGhpcy5jaGVja2VkKVwiPlxuICAgICAgICA8c3BhbiBjbGFzcz1cInRhc2stdGl0bGVcIj4ke2VzYyh0LnRpdGxlKSB8fCAnPHNwYW4gc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZC1mb3JlZ3JvdW5kKVwiPih1bnRpdGxlZCk8L3NwYW4+J308L3NwYW4+XG4gICAgICA8L2xhYmVsPlxuICAgICAgPHNwYW4gc3R5bGU9XCJmbGV4OjFcIj48L3NwYW4+XG4gICAgICA8ZGl2IGNsYXNzPVwiY2MtYWN0c1wiPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwiaWNvLW1pbmlcIiB0aXRsZT1cIkVkaXRcIiBvbmNsaWNrPVwib3BlblRhc2tNb2RhbCgnJHtlc2MoY2lkKX0nLCcke2VzYyh0LmVudHJ5SWQpfScpXCI+JHtpYygnZWRpdCcsIDE1KX08L2J1dHRvbj5cbiAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImljby1taW5pIGRhbmdlclwiIHRpdGxlPVwiRGVsZXRlXCIgb25jbGljaz1cImRlbGV0ZVRhc2tQcm9tcHQoJyR7ZXNjKGNpZCl9JywnJHtlc2ModC5lbnRyeUlkKX0nKVwiPiR7aWMoJ3RyYXNoJywgMTUpfTwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICAgJHttZXRhID8gYDxkaXYgY2xhc3M9XCJ0YXNrLW1ldGFcIj4ke21ldGF9PC9kaXY+YCA6ICcnfVxuICAgICR7dC5kZXRhaWxzID8gYDxkaXYgY2xhc3M9XCJ0YXNrLWRldGFpbHNcIj4ke2VzYyh0LmRldGFpbHMpfTwvZGl2PmAgOiAnJ31cbiAgICAke2Zvb3R9XG4gIDwvZGl2PmA7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRvZ2dsZVRhc2tEb25lKGNpZDogc3RyaW5nLCBlbnRyeUlkOiBzdHJpbmcsIGNoZWNrZWQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgc3RhdHVzID0gY2hlY2tlZCA/IFRBU0tfRE9ORV9TVEFUVVMgOiAnVG8gRG8nO1xuICB0cnkge1xuICAgIGF3YWl0IGFwaVVwZGF0ZVRhc2soY2lkLCBlbnRyeUlkLCB7IHN0YXR1czogc3RhdHVzIH0pO1xuICAgIGF3YWl0IGxvYWRUYXNrcyhjaWQsIHRydWUpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICB0b2FzdCgnVXBkYXRlIGZhaWxlZDogJyArIChlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSkpO1xuICAgIGxvYWRUYXNrcyhjaWQsIHRydWUpOyAvLyByZS1yZW5kZXIgdG8gcmVzZXQgdGhlIGNoZWNrYm94XG4gIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIGFkZCAvIGVkaXQgbW9kYWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5mdW5jdGlvbiB0YXNrU2VsZWN0Q29udHJvbChkYXRhSzogc3RyaW5nLCBjaG9pY2VzOiBzdHJpbmdbXSwgY3VycmVudDogc3RyaW5nLCBwbGFjZWhvbGRlcjogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3Qgb3B0cyA9IFtgPG9wdGlvbiB2YWx1ZT1cIlwiPiR7ZXNjKHBsYWNlaG9sZGVyKX08L29wdGlvbj5gXVxuICAgIC5jb25jYXQoY2hvaWNlcy5tYXAobyA9PiBgPG9wdGlvbiB2YWx1ZT1cIiR7ZXNjKG8pfVwiJHtvID09PSBjdXJyZW50ID8gJyBzZWxlY3RlZCcgOiAnJ30+JHtlc2Mobyl9PC9vcHRpb24+YCkpXG4gICAgLmpvaW4oJycpO1xuICByZXR1cm4gYDxzZWxlY3QgZGF0YS1rPVwiJHtkYXRhS31cIj4ke29wdHN9PC9zZWxlY3Q+YDtcbn1cblxuZnVuY3Rpb24gb3BlblRhc2tNb2RhbChjaWQ6IHN0cmluZywgZW50cnlJZD86IHN0cmluZyk6IHZvaWQge1xuICBpZiAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fdGFza01vZGFsJykpIGNsb3NlVGFza01vZGFsKCk7XG4gIGNvbnN0IHN0ID0gdGFza3NTdGF0ZShjaWQpO1xuICBjb25zdCB0ID0gZW50cnlJZCAmJiBzdC5saXN0ID8gKHN0Lmxpc3QuZmlsdGVyKHggPT4geC5lbnRyeUlkID09PSBlbnRyeUlkKVswXSB8fCBudWxsKSA6IG51bGw7XG4gIGNvbnN0IGVkaXRpbmcgPSAhIXQ7XG5cbiAgY29uc3QgaG9zdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBob3N0LmNsYXNzTmFtZSA9ICdtb2RhbC1vdmVybGF5JztcbiAgaG9zdC5pZCA9ICdfX3Rhc2tNb2RhbCc7XG4gIGhvc3QuaW5uZXJIVE1MID0gYDxkaXYgY2xhc3M9XCJtb2RhbC1jYXJkXCIgcm9sZT1cImRpYWxvZ1wiIGFyaWEtbW9kYWw9XCJ0cnVlXCIgYXJpYS1sYWJlbD1cIiR7ZWRpdGluZyA/ICdFZGl0IHRhc2snIDogJ0FkZCB0YXNrJ31cIlxuICAgICAgZGF0YS1jaWQ9XCIke2VzYyhjaWQpfVwiIGRhdGEtZW50cnk9XCIke2VzYyhlbnRyeUlkIHx8ICcnKX1cIj5cbiAgICA8ZGl2IGNsYXNzPVwibW9kYWwtaGVhZFwiPlxuICAgICAgPGRpdj48Yj4ke2VkaXRpbmcgPyAnRWRpdCB0YXNrJyA6ICdBZGQgdGFzayd9PC9iPjxwPiR7ZWRpdGluZyA/ICdVcGRhdGUgdGhpcyB0by1kby4nIDogJ0NyZWF0ZSBhIGZvbGxvdy11cCwgcmVtaW5kZXIsIG9yIHRvLWRvLid9PC9wPjwvZGl2PlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImljby14XCIgdGl0bGU9XCJDbG9zZVwiIG9uY2xpY2s9XCJjbG9zZVRhc2tNb2RhbCgpXCI+JHtpYygneCcsIDE4KX08L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwibW9kYWwtYm9keVwiPlxuICAgICAgPGRpdiBjbGFzcz1cIm1vZGFsLWVyclwiIGhpZGRlbj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZC1ncmlkXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZCBmdWxsXCI+PGxhYmVsPlRpdGxlPC9sYWJlbD48aW5wdXQgdHlwZT1cInRleHRcIiBkYXRhLWs9XCJ0aXRsZVwiIHZhbHVlPVwiJHtlc2ModCA/IHQudGl0bGUgOiAnJyl9XCIgcGxhY2Vob2xkZXI9XCJXaGF0IG5lZWRzIHRvIGhhcHBlbj9cIiBhdXRvY29tcGxldGU9XCJvZmZcIj48L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImZpZWxkXCI+PGxhYmVsPlN0YXR1czwvbGFiZWw+JHt0YXNrU2VsZWN0Q29udHJvbCgnc3RhdHVzJywgVEFTS19TVEFUVVNFUywgdCA/IHQuc3RhdHVzIDogJ1RvIERvJywgJ1x1MjAxNCcpfTwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmllbGRcIj48bGFiZWw+UHJpb3JpdHk8L2xhYmVsPiR7dGFza1NlbGVjdENvbnRyb2woJ3ByaW9yaXR5JywgVEFTS19QUklPUklUSUVTLCB0ID8gdC5wcmlvcml0eSA6ICdNZWRpdW0nLCAnXHUyMDE0Jyl9PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZFwiPjxsYWJlbD5EdWUgZGF0ZTwvbGFiZWw+PGlucHV0IHR5cGU9XCJkYXRlXCIgZGF0YS1rPVwiZHVlRGF0ZVwiIHZhbHVlPVwiJHtlc2ModCA/IHQuZHVlRGF0ZSA6ICcnKX1cIj48L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImZpZWxkXCI+PGxhYmVsPkNhdGVnb3J5PC9sYWJlbD4ke3Rhc2tTZWxlY3RDb250cm9sKCdjYXRlZ29yeScsIFRBU0tfQ0FURUdPUklFUywgdCA/IHQuY2F0ZWdvcnkgOiAnJywgJ1x1MjAxNCcpfTwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmllbGQgZnVsbFwiPjxsYWJlbD5Bc3NpZ25lZTwvbGFiZWw+PGlucHV0IHR5cGU9XCJ0ZXh0XCIgZGF0YS1rPVwiYXNzaWduZWVcIiB2YWx1ZT1cIiR7ZXNjKHQgPyB0LmFzc2lnbmVlIDogJycpfVwiIHBsYWNlaG9sZGVyPVwiV2hvIG93bnMgdGhpcz8gKGRlZmF1bHRzIHRvIHlvdSlcIiBhdXRvY29tcGxldGU9XCJvZmZcIj48L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImZpZWxkIGZ1bGxcIj48bGFiZWw+RGV0YWlsczwvbGFiZWw+PHRleHRhcmVhIGRhdGEtaz1cImRldGFpbHNcIiByb3dzPVwiNFwiIHBsYWNlaG9sZGVyPVwiTm90ZXMgKG9wdGlvbmFsKVwiPiR7ZXNjKHQgPyB0LmRldGFpbHMgOiAnJyl9PC90ZXh0YXJlYT48L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1mb290XCI+XG4gICAgICA8c3BhbiBjbGFzcz1cIm1vZGFsLXN0YXR1c1wiPjwvc3Bhbj5cbiAgICAgIDxzcGFuIHN0eWxlPVwiZmxleDoxXCI+PC9zcGFuPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIG9uY2xpY2s9XCJjbG9zZVRhc2tNb2RhbCgpXCI+JHtpYygneCcsIDE1KX0gQ2FuY2VsPC9idXR0b24+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnkganMtc2F2ZVwiIG9uY2xpY2s9XCJzYXZlVGFzaygpXCI+JHtpYygnc2F2ZScsIDE1KX0gJHtlZGl0aW5nID8gJ1NhdmUgY2hhbmdlcycgOiAnQWRkIHRhc2snfTwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICA8L2Rpdj5gO1xuICBob3N0LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIGUgPT4geyBpZiAoZS50YXJnZXQgPT09IGhvc3QpIGNsb3NlVGFza01vZGFsKCk7IH0pO1xuICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGhvc3QpO1xuICBjb25zdCB0aXRsZSA9IGhvc3QucXVlcnlTZWxlY3RvcignaW5wdXRbZGF0YS1rPVwidGl0bGVcIl0nKSBhcyBIVE1MSW5wdXRFbGVtZW50IHwgbnVsbDtcbiAgaWYgKHRpdGxlKSB0aXRsZS5mb2N1cygpO1xuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGFza0VzY0Nsb3NlKTtcbn1cblxuZnVuY3Rpb24gdGFza0VzY0Nsb3NlKGU6IEtleWJvYXJkRXZlbnQpOiB2b2lkIHsgaWYgKGUua2V5ID09PSAnRXNjYXBlJykgY2xvc2VUYXNrTW9kYWwoKTsgfVxuZnVuY3Rpb24gY2xvc2VUYXNrTW9kYWwoKTogdm9pZCB7XG4gIGNvbnN0IG0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX190YXNrTW9kYWwnKTtcbiAgaWYgKG0pIG0ucmVtb3ZlKCk7XG4gIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCB0YXNrRXNjQ2xvc2UpO1xufVxuZnVuY3Rpb24gc2V0VGFza01vZGFsRXJyb3IobXNnOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjX190YXNrTW9kYWwgLm1vZGFsLWVycicpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgaWYgKCFlbCkgcmV0dXJuO1xuICBpZiAobXNnKSB7IGVsLnRleHRDb250ZW50ID0gbXNnOyBlbC5oaWRkZW4gPSBmYWxzZTsgfSBlbHNlIHsgZWwudGV4dENvbnRlbnQgPSAnJzsgZWwuaGlkZGVuID0gdHJ1ZTsgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBzYXZlVGFzaygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgbW9kYWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjX190YXNrTW9kYWwgLm1vZGFsLWNhcmQnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmICghbW9kYWwpIHJldHVybjtcbiAgY29uc3QgY2lkID0gbW9kYWwuZ2V0QXR0cmlidXRlKCdkYXRhLWNpZCcpIHx8ICcnO1xuICBjb25zdCBlbnRyeUlkID0gbW9kYWwuZ2V0QXR0cmlidXRlKCdkYXRhLWVudHJ5JykgfHwgJyc7XG4gIGlmICghY2lkKSB7IHNldFRhc2tNb2RhbEVycm9yKCdNaXNzaW5nIGNsaWVudCBpZC4nKTsgcmV0dXJuOyB9XG5cbiAgY29uc3QgZmllbGRzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge307XG4gIG1vZGFsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWtdJykuZm9yRWFjaChlbCA9PiB7XG4gICAgY29uc3QgayA9IChlbCBhcyBIVE1MRWxlbWVudCkuZGF0YXNldC5rIGFzIHN0cmluZztcbiAgICBmaWVsZHNba10gPSAoZWwgYXMgSFRNTElucHV0RWxlbWVudCB8IEhUTUxUZXh0QXJlYUVsZW1lbnQgfCBIVE1MU2VsZWN0RWxlbWVudCkudmFsdWUudHJpbSgpO1xuICB9KTtcblxuICBzZXRUYXNrTW9kYWxFcnJvcignJyk7XG4gIGlmICghZmllbGRzLnRpdGxlKSB7IHNldFRhc2tNb2RhbEVycm9yKCdHaXZlIHRoZSB0YXNrIGEgdGl0bGUuJyk7IHJldHVybjsgfVxuXG4gIGNvbnN0IHNhdmVCdG4gPSBtb2RhbC5xdWVyeVNlbGVjdG9yKCcuanMtc2F2ZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcbiAgY29uc3Qgc3RhdHVzID0gbW9kYWwucXVlcnlTZWxlY3RvcignLm1vZGFsLXN0YXR1cycpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgaWYgKHNhdmVCdG4pIHNhdmVCdG4uZGlzYWJsZWQgPSB0cnVlO1xuICBpZiAoc3RhdHVzKSBzdGF0dXMudGV4dENvbnRlbnQgPSAnU2F2aW5nXHUyMDI2JztcblxuICB0cnkge1xuICAgIGlmIChlbnRyeUlkKSBhd2FpdCBhcGlVcGRhdGVUYXNrKGNpZCwgZW50cnlJZCwgZmllbGRzKTtcbiAgICBlbHNlIGF3YWl0IGFwaUFkZFRhc2soY2lkLCBmaWVsZHMpO1xuICAgIGNsb3NlVGFza01vZGFsKCk7XG4gICAgYXdhaXQgbG9hZFRhc2tzKGNpZCwgdHJ1ZSk7XG4gICAgdG9hc3QoZW50cnlJZCA/ICdUYXNrIHVwZGF0ZWQnIDogJ1Rhc2sgYWRkZWQnKTtcbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgaWYgKHNhdmVCdG4pIHNhdmVCdG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICBpZiAoc3RhdHVzKSBzdGF0dXMudGV4dENvbnRlbnQgPSAnJztcbiAgICBzZXRUYXNrTW9kYWxFcnJvcihlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZGVsZXRlVGFza1Byb21wdChjaWQ6IHN0cmluZywgZW50cnlJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICghZW50cnlJZCkgcmV0dXJuO1xuICBpZiAoIXdpbmRvdy5jb25maXJtKCdEZWxldGUgdGhpcyB0YXNrPyBUaGlzIGNhblxcJ3QgYmUgdW5kb25lLicpKSByZXR1cm47XG4gIHRyeSB7XG4gICAgYXdhaXQgYXBpRGVsZXRlVGFzayhjaWQsIGVudHJ5SWQpO1xuICAgIGF3YWl0IGxvYWRUYXNrcyhjaWQsIHRydWUpO1xuICAgIHRvYXN0KCdUYXNrIGRlbGV0ZWQnKTtcbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgdG9hc3QoJ0RlbGV0ZSBmYWlsZWQ6ICcgKyAoZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpKTtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBZ0JBLE1BQU0sZ0JBQWdCLENBQUMsU0FBUyxlQUFlLFdBQVcsTUFBTTtBQUNoRSxNQUFNLGtCQUFrQixDQUFDLE9BQU8sVUFBVSxNQUFNO0FBQ2hELE1BQU0sa0JBQWtCLENBQUMsV0FBVyxhQUFhLFlBQVksZ0JBQWdCLGFBQWEsT0FBTztBQUNqRyxNQUFNLG1CQUFtQjtBQVV6QixNQUFNLGNBQWtELENBQUM7QUFFekQsU0FBUyxXQUFXLEtBQXlCO0FBQzNDLE1BQUksQ0FBQyxZQUFZLEdBQUcsRUFBRyxhQUFZLEdBQUcsSUFBSSxFQUFFLE1BQU0sTUFB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
