/* =====================================================================
   emailcompose.ts — Outbound email composer modal (from a client record).

   Launched from the Communications section (and a per-contact "Email" action).
   Pick one or more of the client's contacts, pick a template (variables
   substitute on selection), edit the rich-text body, and send via the logged-in
   user's connected mailbox (maestro `sendEmail`). A successful send is logged as
   a Communication (type "Email") on the client — so it appears in the timeline.

   Reference: neurodev/1434156 composer (Gmail-only merge report) — reworked as
   an SPA modal on our maestro + both providers + Communications log.

   Template variables (substituted on template SELECTION only, so switching
   contacts after editing doesn't clobber in-progress edits — reselect to redo):
     {clientFirstName} {clientPreferredName} {clientLastName} {clientFullName}
     {contactFirstName} {contactPreferredName} {contactLastName} {contactFullName}
       (Oxford-comma joined across ALL selected contacts, blanks dropped)
     {myFirstName} {myLastName}   (the logged-in sender)

   Injected controls use data-k / ids, never `name` (merge-report gotcha).
   ===================================================================== */

interface EmailTemplate { id: string; title: string; subject: string; body: string; }

// Active templates from org settings (settings.email.templates).
function orgEmailTemplates(): EmailTemplate[] {
  const s: any = SETTINGS;
  const arr = s && s.email && Array.isArray(s.email.templates) ? s.email.templates : [];
  return arr
    .filter((t: any) => t && t.active !== false)
    .map((t: any) => ({ id: String(t.id || ''), title: String(t.title || ''), subject: String(t.subject || ''), body: String(t.body || '') }));
}

// Grammatically join names with an Oxford comma (ported from neurodev).
function joinNames(parts: string[]): string {
  const clean = parts.map(p => (p || '').trim()).filter(p => p.length > 0);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return clean[0] + ' and ' + clean[1];
  return clean.slice(0, -1).join(', ') + ', and ' + clean[clean.length - 1];
}

function substituteVars(template: string, vars: { [k: string]: string }): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : m);
}

// Build the {var} → value map from the client, the selected contacts, and the sender.
// Contacts have no preferred-name field, so contactPreferredName falls back to first name.
function composerVars(c: Client, selected: LiveContact[]): { [k: string]: string } {
  const firsts = selected.map(x => x.firstName);
  const lasts = selected.map(x => x.lastName);
  const fulls = selected.map(x => (x.firstName + (x.lastName ? ' ' + x.lastName : '')).trim());
  const clientFull = (c.first + (c.last ? ' ' + c.last : '')).trim();
  return {
    clientFirstName: c.first || '',
    clientPreferredName: c.prefName || c.first || '',
    clientLastName: c.last || '',
    clientFullName: clientFull,
    contactFirstName: joinNames(firsts),
    contactPreferredName: joinNames(firsts),
    contactLastName: joinNames(lasts),
    contactFullName: joinNames(fulls),
    myFirstName: SESSION ? SESSION.firstName : '',
    myLastName: SESSION ? SESSION.lastName : '',
  };
}

function parseAddrList(raw: string): string[] {
  if (!raw) return [];
  return raw.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
}

// Ordered selection of contact entryIds for the current composer.
let COMPOSE_CID = '';
let COMPOSE_SELECTED_IDS: string[] = [];

function composeContacts(): LiveContact[] {
  const list = (contactsState(COMPOSE_CID).list || []).filter(ct => !!ct.email);
  return list;
}
function composeSelected(): LiveContact[] {
  const byId = composeContacts();
  const out: LiveContact[] = [];
  for (const id of COMPOSE_SELECTED_IDS) {
    const ct = byId.filter(x => x.entryId === id)[0];
    if (ct) out.push(ct);
  }
  return out;
}

// True when the logged-in user has a connected mailbox to send from.
function composerConnected(): boolean {
  return (EMAIL_STATE.list || []).some(a => a.connected);
}

async function openEmailComposer(cid: string, preselectIds?: string): Promise<void> {
  const c = findClient(cid);
  if (!c) { toast('Client not found.'); return; }
  // Warm the data the composer needs (fast if already cached).
  await Promise.all([
    contactsState(cid).list === null ? loadContacts(cid) : Promise.resolve(),
    SETTINGS === null ? loadSettings() : Promise.resolve(),
    EMAIL_STATE.list === null ? loadEmailStatus() : Promise.resolve(),
  ]);
  COMPOSE_CID = cid;
  const pre = (preselectIds || '').split(',').map(s => s.trim()).filter(Boolean);
  const valid = composeContacts().map(ct => ct.entryId);
  COMPOSE_SELECTED_IDS = pre.filter(id => valid.indexOf(id) !== -1);
  buildComposerModal(c);
}

function buildComposerModal(c: Client): void {
  if (document.getElementById('__emailModal')) closeEmailComposer();
  const connected = composerConnected();
  const contactsList = composeContacts();
  const templates = orgEmailTemplates().slice().sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));

  const banner = connected ? '' :
    `<div class="modal-err" style="display:block">Your mailbox isn't connected. Open <b>My Email</b> (top-right account menu) and connect it before sending.</div>`;

  const chips = contactsList.length
    ? contactsList.map(ct => {
        const on = COMPOSE_SELECTED_IDS.indexOf(ct.entryId) !== -1;
        const nm = (ct.firstName + ' ' + ct.lastName).trim() || ct.email;
        return `<button type="button" class="compose-chip${on ? ' on' : ''}" data-ceid="${esc(ct.entryId)}" onclick="toggleComposeContact('${esc(ct.entryId)}', this)">
          <span class="cc-nm">${esc(nm)}</span><span class="cc-em">${esc(ct.email)}</span></button>`;
      }).join('')
    : `<div class="compose-empty">No contacts with an email on file — type recipients in the To field.</div>`;

  const tmplOpts = ['<option value="">— insert a template —</option>']
    .concat(templates.map(t => `<option value="${esc(t.id)}">${esc(t.title || '(untitled)')}</option>`))
    .join('');

  const host = document.createElement('div');
  host.className = 'modal-overlay';
  host.id = '__emailModal';
  host.innerHTML = `<div class="modal-card compose-card" role="dialog" aria-modal="true" aria-label="Compose email" data-cid="${esc(c.id)}">
    <div class="modal-head">
      <div><b>Compose email</b><p>Send to ${esc(c.first)}'s contacts from your connected mailbox.</p></div>
      <button class="ico-x" title="Close" onclick="closeEmailComposer()">${ic('x', 18)}</button>
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
      <button class="btn ghost" onclick="closeEmailComposer()">${ic('x', 15)} Cancel</button>
      <button class="btn primary js-send" onclick="sendComposedEmail()"${connected ? '' : ' disabled title="Connect your mailbox first"'}>${ic('send', 15)} Send</button>
    </div>
  </div>`;
  host.addEventListener('mousedown', e => { if (e.target === host) closeEmailComposer(); });
  document.body.appendChild(host);
  composeSyncTo();
  const subj = document.getElementById('__cSubject') as HTMLInputElement | null;
  if (subj) subj.focus();
  document.addEventListener('keydown', composeEscClose);
}

function composeEscClose(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  // Don't close if a link prompt is open (prompt blocks anyway); just close the modal.
  closeEmailComposer();
}
function closeEmailComposer(): void {
  const m = document.getElementById('__emailModal');
  if (m) m.remove();
  document.removeEventListener('keydown', composeEscClose);
}

// Keep the To field in sync with the ordered chip selection.
function composeSyncTo(): void {
  const to = document.getElementById('__cTo') as HTMLInputElement | null;
  if (!to) return;
  to.value = composeSelected().map(ct => ct.email).join(', ');
}

function toggleComposeContact(entryId: string, btn: HTMLElement): void {
  const idx = COMPOSE_SELECTED_IDS.indexOf(entryId);
  if (idx === -1) { COMPOSE_SELECTED_IDS.push(entryId); btn.classList.add('on'); }
  else { COMPOSE_SELECTED_IDS.splice(idx, 1); btn.classList.remove('on'); }
  composeSyncTo();
}

function onComposeTemplate(sel: HTMLSelectElement): void {
  const id = sel.value;
  if (!id) return;
  const tmpl = orgEmailTemplates().filter(t => t.id === id)[0];
  if (!tmpl) return;
  const c = findClient(COMPOSE_CID);
  if (!c) return;
  const vars = composerVars(c, composeSelected());
  const subj = document.getElementById('__cSubject') as HTMLInputElement | null;
  const body = document.getElementById('__cBody') as HTMLElement | null;
  if (subj) subj.value = substituteVars(tmpl.subject, vars);
  if (body) body.innerHTML = substituteVars(tmpl.body, vars);
}

function composeExec(cmd: string, arg?: string): void {
  const body = document.getElementById('__cBody') as HTMLElement | null;
  if (body) body.focus();
  if (cmd === 'createLink') {
    const url = window.prompt('Enter URL (https://…):', 'https://');
    if (!url) return;
    document.execCommand('createLink', false, url);
  } else if (cmd === 'formatBlock' && arg) {
    document.execCommand('formatBlock', false, arg);
  } else {
    document.execCommand(cmd, false);
  }
}

function setComposeError(msg: string): void {
  const errs = document.querySelectorAll('#__emailModal .modal-err');
  // The last .modal-err is the live error slot (first may be the static banner).
  const el = errs[errs.length - 1] as HTMLElement | null;
  if (!el) return;
  if (msg) { el.textContent = msg; el.hidden = false; } else { el.textContent = ''; el.hidden = true; }
}

async function sendComposedEmail(): Promise<void> {
  const modal = document.querySelector('#__emailModal .compose-card') as HTMLElement | null;
  if (!modal) return;
  const cid = modal.getAttribute('data-cid') || '';
  const to = parseAddrList((document.getElementById('__cTo') as HTMLInputElement).value);
  const cc = parseAddrList((document.getElementById('__cCc') as HTMLInputElement).value);
  const bcc = parseAddrList((document.getElementById('__cBcc') as HTMLInputElement).value);
  const subject = (document.getElementById('__cSubject') as HTMLInputElement).value.trim();
  const bodyHtml = (document.getElementById('__cBody') as HTMLElement).innerHTML.trim();

  setComposeError('');
  if (!to.length) { setComposeError('Add at least one recipient in the To field.'); return; }
  if (!subject) { setComposeError('A subject is required.'); return; }
  if (!bodyHtml || bodyHtml === '<br>') { setComposeError('The email body is empty.'); return; }

  const sendBtn = modal.querySelector('.js-send') as HTMLButtonElement | null;
  const status = modal.querySelector('.modal-status') as HTMLElement | null;
  if (sendBtn) sendBtn.disabled = true;
  if (status) status.textContent = 'Sending…';

  try {
    const res = await apiSendEmail({
      clientId: cid, provider: orgEmailProvider(),
      to: to, cc: cc, bcc: bcc, subject: subject, bodyHtml: bodyHtml,
    });
    closeEmailComposer();
    if (res && res.commError) toast('Sent ✓ — but logging to the record failed: ' + res.commError);
    else toast('Email sent ✓');
    // Refresh the Communications timeline so the logged email shows up.
    if (typeof loadCommunications === 'function') loadCommunications(cid, true);
  } catch (e: any) {
    if (sendBtn) sendBtn.disabled = false;
    if (status) status.textContent = '';
    setComposeError('Send failed: ' + (e && e.message ? e.message : String(e)));
  }
}

/* ── Settings ▸ Email Templates (org-wide, in settings.email.templates) ──────── */

// All templates (incl. inactive) from settings, for the admin editor.
function allEmailTemplates(): any[] {
  const s: any = SETTINGS;
  return s && s.email && Array.isArray(s.email.templates) ? s.email.templates.slice() : [];
}

const TEMPLATE_VARS = [
  'clientFirstName', 'clientPreferredName', 'clientLastName', 'clientFullName',
  'contactFirstName', 'contactPreferredName', 'contactLastName', 'contactFullName',
  'myFirstName', 'myLastName',
];

// Rendered by the Settings panel registry (settings.ts).
function emailTemplatesPanel(): string {
  if (SETTINGS === null && !SETTINGS_LOADING) loadSettings();
  const head = `<div class="section-head">
      <div><h3>Email Templates</h3><p>Reusable templates for the email composer. Use variables like <code>{clientFirstName}</code> — they fill in when a template is selected.</p></div>
      <button class="btn primary" onclick="openTemplateEditor()">${ic('plus', 15)} New template</button>
    </div>`;
  if (SETTINGS === null) return head + `<div class="card"><div class="empty"><div class="ico">${ic('clock', 22)}</div><b>Loading…</b></div></div>`;
  const list = allEmailTemplates();
  if (!list.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic('msg', 22)}</div><b>No templates yet</b>
      <p>Create a reusable email your team can pick from the composer.</p>
      <button class="btn primary" onclick="openTemplateEditor()">${ic('plus', 15)} New template</button></div></div>`;
  }
  const rows = list.map(t => {
    const active = t.active !== false;
    return `<div class="card tmpl-row">
      <div class="tmpl-info"><b>${esc(t.title || '(untitled)')}</b><span>${esc(t.subject || '')}</span></div>
      <span class="pill ${active ? 'success' : 'muted'}">${active ? 'Active' : 'Inactive'}</span>
      <div class="cc-acts">
        <button class="ico-mini" title="Edit" onclick="openTemplateEditor('${esc(String(t.id))}')">${ic('edit', 15)}</button>
        <button class="ico-mini danger" title="Delete" onclick="deleteTemplate('${esc(String(t.id))}')">${ic('trash', 15)}</button>
      </div>
    </div>`;
  }).join('');
  return head + `<div class="tmpl-list">${rows}</div>`;
}

function tmplExec(cmd: string, arg?: string): void {
  const body = document.getElementById('__tBody') as HTMLElement | null;
  if (body) body.focus();
  if (cmd === 'createLink') {
    const url = window.prompt('Enter URL (https://…):', 'https://');
    if (!url) return;
    document.execCommand('createLink', false, url);
  } else if (cmd === 'formatBlock' && arg) {
    document.execCommand('formatBlock', false, arg);
  } else {
    document.execCommand(cmd, false);
  }
}

// Insert a {variable} token into the body editor at the caret.
function insertTmplVar(token: string): void {
  const body = document.getElementById('__tBody') as HTMLElement | null;
  if (!body) return;
  body.focus();
  document.execCommand('insertText', false, token);
}

function openTemplateEditor(id?: string): void {
  if (document.getElementById('__tmplModal')) closeTemplateEditor();
  const t = id ? allEmailTemplates().filter(x => String(x.id) === id)[0] : null;
  const editing = !!t;
  const host = document.createElement('div');
  host.className = 'modal-overlay';
  host.id = '__tmplModal';
  host.innerHTML = `<div class="modal-card compose-card" role="dialog" aria-modal="true" aria-label="${editing ? 'Edit template' : 'New template'}" data-id="${esc(id || '')}">
    <div class="modal-head">
      <div><b>${editing ? 'Edit template' : 'New template'}</b><p>Variables in {curly braces} fill in when the template is chosen.</p></div>
      <button class="ico-x" title="Close" onclick="closeTemplateEditor()">${ic('x', 18)}</button>
    </div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <div class="field full"><label>Template name</label><input type="text" id="__tTitle" value="${esc(t ? t.title || '' : '')}" placeholder="e.g. Intake follow-up" autocomplete="off"></div>
      <div class="field full"><label>Subject</label><input type="text" id="__tSubject" value="${esc(t ? t.subject || '' : '')}" placeholder="Subject (may use {clientFirstName})" autocomplete="off"></div>
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
      <div class="tmpl-vars">Click to insert: ${TEMPLATE_VARS.map(v => `<code onclick="insertTmplVar('{${v}}')">{${v}}</code>`).join(' ')}</div>
      <label class="tmpl-active"><input type="checkbox" id="__tActive" ${(!t || t.active !== false) ? 'checked' : ''}> Active (show in the composer)</label>
    </div>
    <div class="modal-foot">
      <span class="modal-status"></span><span style="flex:1"></span>
      <button class="btn ghost" onclick="closeTemplateEditor()">${ic('x', 15)} Cancel</button>
      <button class="btn primary js-tsave" onclick="saveTemplateEditor()">${ic('save', 15)} ${editing ? 'Save changes' : 'Create'}</button>
    </div>
  </div>`;
  host.addEventListener('mousedown', e => { if (e.target === host) closeTemplateEditor(); });
  document.body.appendChild(host);
  // Set the body via innerHTML AFTER mount (avoids escaping the stored HTML in the template string).
  const body = document.getElementById('__tBody') as HTMLElement | null;
  if (body && t) body.innerHTML = t.body || '';
  const title = document.getElementById('__tTitle') as HTMLInputElement | null;
  if (title) title.focus();
  document.addEventListener('keydown', tmplEscClose);
}

function tmplEscClose(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  closeTemplateEditor();
}
function closeTemplateEditor(): void {
  const m = document.getElementById('__tmplModal');
  if (m) m.remove();
  document.removeEventListener('keydown', tmplEscClose);
}
function setTmplError(msg: string): void {
  const el = document.querySelector('#__tmplModal .modal-err') as HTMLElement | null;
  if (!el) return;
  if (msg) { el.textContent = msg; el.hidden = false; } else { el.textContent = ''; el.hidden = true; }
}

async function saveTemplateEditor(): Promise<void> {
  const modal = document.querySelector('#__tmplModal .modal-card') as HTMLElement | null;
  if (!modal) return;
  const id = modal.getAttribute('data-id') || '';
  const title = (document.getElementById('__tTitle') as HTMLInputElement).value.trim();
  const subject = (document.getElementById('__tSubject') as HTMLInputElement).value.trim();
  const body = (document.getElementById('__tBody') as HTMLElement).innerHTML.trim();
  const active = (document.getElementById('__tActive') as HTMLInputElement).checked;
  setTmplError('');
  if (!title) { setTmplError('Give the template a name.'); return; }

  const list = allEmailTemplates();
  let next: any[];
  if (id) {
    next = list.map(t => String(t.id) === id ? { id: t.id, title: title, subject: subject, body: body, active: active } : t);
  } else {
    next = list.concat([{ id: 'tmpl-' + Date.now(), title: title, subject: subject, body: body, active: active }]);
  }

  const btn = modal.querySelector('.js-tsave') as HTMLButtonElement | null;
  const status = modal.querySelector('.modal-status') as HTMLElement | null;
  if (btn) btn.disabled = true;
  if (status) status.textContent = 'Saving…';
  try {
    const merged = await saveSettingsSection('email', { templates: next });
    SETTINGS = merged || SETTINGS;
    closeTemplateEditor();
    toast('Template saved');
    render();
  } catch (e: any) {
    if (btn) btn.disabled = false;
    if (status) status.textContent = '';
    setTmplError(e && e.message ? e.message : String(e));
  }
}

async function deleteTemplate(id: string): Promise<void> {
  if (!window.confirm('Delete this template? This can\'t be undone.')) return;
  const next = allEmailTemplates().filter(t => String(t.id) !== id);
  try {
    const merged = await saveSettingsSection('email', { templates: next });
    SETTINGS = merged || SETTINGS;
    toast('Template deleted');
    render();
  } catch (e: any) {
    toast('Delete failed: ' + (e && e.message ? e.message : String(e)));
  }
}
