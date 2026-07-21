/* =====================================================================
   tasks.ts — the Tasks record section (multi-entry, live).

   A per-client to-do list on the client's `tasks` MEF, served by the maestro
   (listTasks/addTask/updateTask/deleteTask). Each entry has an entryId used to
   target edits/deletes/complete-toggles. createdBy/createdAt are stamped
   server-side on add; completedAt is stamped when status moves to "Done".

   Tasks are grouped by status (To Do → In Progress → Blocked → Done); within a
   group they sort by priority then due date. A checkbox toggles Done ↔ To Do.

   Injected controls use data-k, never `name` (merge-report gotcha).
   ===================================================================== */

// These MUST match the option-list labels on the tasks form (setByName resolves
// the stored option by display name).
const TASK_STATUSES = ['To Do', 'In Progress', 'Blocked', 'Done'];
const TASK_PRIORITIES = ['Low', 'Medium', 'High'];
const TASK_CATEGORIES = ['General', 'Follow-up', 'Document', 'Call / Email', 'Placement', 'Admin'];
const TASK_DONE_STATUS = 'Done';

interface LiveTask {
  entryId: string;
  title: string; status: string; priority: string; dueDate: string;
  assignee: string; category: string; details: string;
  createdBy: string; createdAt: string; completedAt: string;
}

interface TasksState { list: LiveTask[] | null; loading: boolean; error: string | null; }
const TASKS_CACHE: { [clientId: string]: TasksState } = {};

function tasksState(cid: string): TasksState {
  if (!TASKS_CACHE[cid]) TASKS_CACHE[cid] = { list: null, loading: false, error: null };
  return TASKS_CACHE[cid];
}

async function loadTasks(cid: string, force = false): Promise<void> {
  const st = tasksState(cid);
  if (st.loading) return;
  if (st.list && !force) return;
  st.loading = true; st.error = null;
  try {
    const rows = await apiListTasks(cid);
    st.list = (Array.isArray(rows) ? rows : []).map(normalizeTask);
  } catch (e: any) {
    st.error = e && e.message ? e.message : String(e);
    st.list = null;
  } finally {
    st.loading = false;
    if (typeof render === 'function') render();
  }
}

function normalizeTask(r: any): LiveTask {
  return {
    entryId: String(r.entryId || ''),
    title: r.title || '', status: r.status || '', priority: r.priority || '', dueDate: r.dueDate || '',
    assignee: r.assignee || '', category: r.category || '', details: r.details || '',
    createdBy: r.createdBy || '', createdAt: r.createdAt || '', completedAt: r.completedAt || '',
  };
}

function taskIsOverdue(t: LiveTask): boolean {
  if (t.status === TASK_DONE_STATUS || !t.dueDate) return false;
  return t.dueDate < todayISO();
}

// ── section view ─────────────────────────────────────────────────────────────
function tasksSection(c: Client): string {
  const st = tasksState(c.id);
  const head = `<div class="section-head">
    <div><h3>Tasks</h3><p>Follow-ups, reminders, and to-dos for ${esc(c.first)}.</p></div>
    <button class="btn primary" onclick="openTaskModal('${esc(c.id)}')">${ic('plus', 15)} Add task</button>
  </div>`;

  if (st.list === null) {
    if (!st.loading && !st.error) loadTasks(c.id);
    const body = st.error
      ? `<div class="card"><div class="empty"><div class="ico">${ic('alert', 22)}</div><b>Couldn't load tasks</b>
         <p>${esc(st.error)}</p><button class="btn primary" onclick="loadTasks('${esc(c.id)}', true)">${ic('clock', 15)} Retry</button></div></div>`
      : `<div class="card"><div class="empty"><div class="ico">${ic('clock', 22)}</div><b>Loading tasks…</b></div></div>`;
    return head + body;
  }

  if (!st.list.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic('report', 22)}</div>
      <b>No tasks yet</b><p>Add a follow-up or reminder to start this client's to-do list.</p>
      <button class="btn primary" onclick="openTaskModal('${esc(c.id)}')">${ic('plus', 15)} Add task</button></div></div>`;
  }

  const pOrder: { [k: string]: number } = { High: 0, Medium: 1, Low: 2, '': 3 };
  const groups = TASK_STATUSES.map(status => {
    const items = st.list!.filter(t => (t.status || 'To Do') === status);
    if (!items.length) return '';
    items.sort((a, b) => {
      const p = (pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3);
      if (p !== 0) return p;
      return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
    });
    const cards = items.map(t => taskCard(c.id, t)).join('');
    return `<div class="task-group"><div class="task-group-head">${esc(status)}<span class="task-count">${items.length}</span></div>${cards}</div>`;
  }).join('');

  // Any tasks whose status isn't one of the known columns (defensive) → show at end.
  const known = TASK_STATUSES;
  const orphans = st.list.filter(t => known.indexOf(t.status || 'To Do') === -1);
  const orphanHtml = orphans.length
    ? `<div class="task-group"><div class="task-group-head">Other<span class="task-count">${orphans.length}</span></div>${orphans.map(t => taskCard(c.id, t)).join('')}</div>`
    : '';

  return head + `<div class="task-board">${groups}${orphanHtml}</div>`;
}

function taskCard(cid: string, t: LiveTask): string {
  const done = t.status === TASK_DONE_STATUS;
  const overdue = taskIsOverdue(t);
  const prClass = t.priority === 'High' ? 'pr-high' : t.priority === 'Medium' ? 'pr-med' : 'pr-low';
  const prChip = t.priority ? `<span class="task-pri ${prClass}">${esc(t.priority)}</span>` : '';
  const catChip = t.category ? `<span class="task-cat">${esc(t.category)}</span>` : '';
  const due = t.dueDate ? `<span class="task-due${overdue ? ' overdue' : ''}">${ic('calendar', 13)} ${esc(fmtDate(t.dueDate))}${overdue ? ' · overdue' : ''}</span>` : '';
  const who = t.assignee ? `<span class="task-assignee">${ic('users', 13)} ${esc(t.assignee)}</span>` : '';
  const foot = (t.createdBy || t.createdAt)
    ? `<div class="task-foot">Added${t.createdBy ? ' by ' + esc(t.createdBy) : ''}${t.createdAt ? ' · ' + esc(fmtDate(t.createdAt)) : ''}${done && t.completedAt ? ' · done ' + esc(fmtDate(t.completedAt)) : ''}</div>`
    : '';
  const meta = [prChip, catChip, due, who].filter(Boolean).join('');

  return `<div class="card task-card${done ? ' done' : ''}">
    <div class="task-top">
      <label class="task-check" title="${done ? 'Mark not done' : 'Mark done'}">
        <input type="checkbox" ${done ? 'checked' : ''} onclick="toggleTaskDone('${esc(cid)}','${esc(t.entryId)}', this.checked)">
        <span class="task-title">${esc(t.title) || '<span style="color:var(--muted-foreground)">(untitled)</span>'}</span>
      </label>
      <span style="flex:1"></span>
      <div class="cc-acts">
        <button class="ico-mini" title="Edit" onclick="openTaskModal('${esc(cid)}','${esc(t.entryId)}')">${ic('edit', 15)}</button>
        <button class="ico-mini danger" title="Delete" onclick="deleteTaskPrompt('${esc(cid)}','${esc(t.entryId)}')">${ic('trash', 15)}</button>
      </div>
    </div>
    ${meta ? `<div class="task-meta">${meta}</div>` : ''}
    ${t.details ? `<div class="task-details">${esc(t.details)}</div>` : ''}
    ${foot}
  </div>`;
}

async function toggleTaskDone(cid: string, entryId: string, checked: boolean): Promise<void> {
  const status = checked ? TASK_DONE_STATUS : 'To Do';
  try {
    await apiUpdateTask(cid, entryId, { status: status });
    await loadTasks(cid, true);
  } catch (e: any) {
    toast('Update failed: ' + (e && e.message ? e.message : String(e)));
    loadTasks(cid, true); // re-render to reset the checkbox
  }
}

// ── add / edit modal ─────────────────────────────────────────────────────────
function taskSelectControl(dataK: string, choices: string[], current: string, placeholder: string): string {
  const opts = [`<option value="">${esc(placeholder)}</option>`]
    .concat(choices.map(o => `<option value="${esc(o)}"${o === current ? ' selected' : ''}>${esc(o)}</option>`))
    .join('');
  return `<select data-k="${dataK}">${opts}</select>`;
}

function openTaskModal(cid: string, entryId?: string): void {
  if (document.getElementById('__taskModal')) closeTaskModal();
  const st = tasksState(cid);
  const t = entryId && st.list ? (st.list.filter(x => x.entryId === entryId)[0] || null) : null;
  const editing = !!t;

  const host = document.createElement('div');
  host.className = 'modal-overlay';
  host.id = '__taskModal';
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="${editing ? 'Edit task' : 'Add task'}"
      data-cid="${esc(cid)}" data-entry="${esc(entryId || '')}">
    <div class="modal-head">
      <div><b>${editing ? 'Edit task' : 'Add task'}</b><p>${editing ? 'Update this to-do.' : 'Create a follow-up, reminder, or to-do.'}</p></div>
      <button class="ico-x" title="Close" onclick="closeTaskModal()">${ic('x', 18)}</button>
    </div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <div class="field-grid">
        <div class="field full"><label>Title</label><input type="text" data-k="title" value="${esc(t ? t.title : '')}" placeholder="What needs to happen?" autocomplete="off"></div>
        <div class="field"><label>Status</label>${taskSelectControl('status', TASK_STATUSES, t ? t.status : 'To Do', '—')}</div>
        <div class="field"><label>Priority</label>${taskSelectControl('priority', TASK_PRIORITIES, t ? t.priority : 'Medium', '—')}</div>
        <div class="field"><label>Due date</label><input type="date" data-k="dueDate" value="${esc(t ? t.dueDate : '')}"></div>
        <div class="field"><label>Category</label>${taskSelectControl('category', TASK_CATEGORIES, t ? t.category : '', '—')}</div>
        <div class="field full"><label>Assignee</label><input type="text" data-k="assignee" value="${esc(t ? t.assignee : '')}" placeholder="Who owns this? (defaults to you)" autocomplete="off"></div>
        <div class="field full"><label>Details</label><textarea data-k="details" rows="4" placeholder="Notes (optional)">${esc(t ? t.details : '')}</textarea></div>
      </div>
    </div>
    <div class="modal-foot">
      <span class="modal-status"></span>
      <span style="flex:1"></span>
      <button class="btn ghost" onclick="closeTaskModal()">${ic('x', 15)} Cancel</button>
      <button class="btn primary js-save" onclick="saveTask()">${ic('save', 15)} ${editing ? 'Save changes' : 'Add task'}</button>
    </div>
  </div>`;
  host.addEventListener('mousedown', e => { if (e.target === host) closeTaskModal(); });
  document.body.appendChild(host);
  const title = host.querySelector('input[data-k="title"]') as HTMLInputElement | null;
  if (title) title.focus();
  document.addEventListener('keydown', taskEscClose);
}

function taskEscClose(e: KeyboardEvent): void { if (e.key === 'Escape') closeTaskModal(); }
function closeTaskModal(): void {
  const m = document.getElementById('__taskModal');
  if (m) m.remove();
  document.removeEventListener('keydown', taskEscClose);
}
function setTaskModalError(msg: string): void {
  const el = document.querySelector('#__taskModal .modal-err') as HTMLElement | null;
  if (!el) return;
  if (msg) { el.textContent = msg; el.hidden = false; } else { el.textContent = ''; el.hidden = true; }
}

async function saveTask(): Promise<void> {
  const modal = document.querySelector('#__taskModal .modal-card') as HTMLElement | null;
  if (!modal) return;
  const cid = modal.getAttribute('data-cid') || '';
  const entryId = modal.getAttribute('data-entry') || '';
  if (!cid) { setTaskModalError('Missing client id.'); return; }

  const fields: Record<string, any> = {};
  modal.querySelectorAll('[data-k]').forEach(el => {
    const k = (el as HTMLElement).dataset.k as string;
    fields[k] = (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value.trim();
  });

  setTaskModalError('');
  if (!fields.title) { setTaskModalError('Give the task a title.'); return; }

  const saveBtn = modal.querySelector('.js-save') as HTMLButtonElement | null;
  const status = modal.querySelector('.modal-status') as HTMLElement | null;
  if (saveBtn) saveBtn.disabled = true;
  if (status) status.textContent = 'Saving…';

  try {
    if (entryId) await apiUpdateTask(cid, entryId, fields);
    else await apiAddTask(cid, fields);
    closeTaskModal();
    await loadTasks(cid, true);
    toast(entryId ? 'Task updated' : 'Task added');
  } catch (e: any) {
    if (saveBtn) saveBtn.disabled = false;
    if (status) status.textContent = '';
    setTaskModalError(e && e.message ? e.message : String(e));
  }
}

async function deleteTaskPrompt(cid: string, entryId: string): Promise<void> {
  if (!entryId) return;
  if (!window.confirm('Delete this task? This can\'t be undone.')) return;
  try {
    await apiDeleteTask(cid, entryId);
    await loadTasks(cid, true);
    toast('Task deleted');
  } catch (e: any) {
    toast('Delete failed: ' + (e && e.message ? e.message : String(e)));
  }
}
