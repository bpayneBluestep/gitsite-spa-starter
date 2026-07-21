/* =====================================================================
   contacts.ts — the Contacts record section (multi-entry, live).

   Contacts are entries on the client's `contacts` MEF, served by the maestro
   (listContacts/addContact/updateContact/deleteContact). Each contact carries
   an `entryId` used to target edits/deletes. The `relationship` field is a
   free-text store whose dropdown choices come from org Settings
   (settings.contacts.relationships) with a built-in fallback — see api.ts
   relationshipOptions(). The chosen label is stored verbatim.

   Per the merge-report gotcha, injected controls use data-k, never `name`.
   ===================================================================== */

interface LiveContact {
  entryId: string;
  firstName: string; lastName: string; relationship: string;
  email: string; cell: string; primary: boolean;
  address: string; city: string; state: string; zip: string;
  photoUrl: string;
}

// Per-client contacts cache so the section doesn't refetch on every render.
interface ContactsState { list: LiveContact[] | null; loading: boolean; error: string | null; }
const CONTACTS_CACHE: { [clientId: string]: ContactsState } = {};

function contactsState(cid: string): ContactsState {
  if (!CONTACTS_CACHE[cid]) CONTACTS_CACHE[cid] = { list: null, loading: false, error: null };
  return CONTACTS_CACHE[cid];
}

// Load (or reload) a client's contacts, then re-render.
async function loadContacts(cid: string, force = false): Promise<void> {
  const st = contactsState(cid);
  if (st.loading) return;
  if (st.list && !force) return;
  st.loading = true; st.error = null;
  try {
    const rows = await apiListContacts(cid);
    st.list = (Array.isArray(rows) ? rows : []).map(normalizeContact);
  } catch (e: any) {
    st.error = e && e.message ? e.message : String(e);
    st.list = null;
  } finally {
    st.loading = false;
    if (typeof render === 'function') render();
  }
}

function normalizeContact(r: any): LiveContact {
  return {
    entryId: String(r.entryId || ''),
    firstName: r.firstName || '', lastName: r.lastName || '', relationship: r.relationship || '',
    email: r.email || '', cell: r.cell || '', primary: r.primary === true,
    address: r.address || '', city: r.city || '', state: r.state || '', zip: r.zip || '',
    photoUrl: r.photo || '',
  };
}

// ── section view ─────────────────────────────────────────────────────────────
function contactsSection(c: Client): string {
  const st = contactsState(c.id);
  // Settings drives the relationship dropdown in the modal — make sure it loads.
  if (!SETTINGS && !SETTINGS_LOADING) loadSettings();

  const head = `<div class="section-head">
    <div><h3>Contacts</h3><p>Family, guardians, and the treatment team for ${esc(c.first)}.</p></div>
    <button class="btn primary" onclick="openContactModal('${esc(c.id)}')">${ic('plus', 15)} Add contact</button>
  </div>`;

  if (st.list === null) {
    if (!st.loading && !st.error) loadContacts(c.id);
    const body = st.error
      ? `<div class="card"><div class="empty"><div class="ico">${ic('alert', 22)}</div><b>Couldn't load contacts</b>
         <p>${esc(st.error)}</p><button class="btn primary" onclick="loadContacts('${esc(c.id)}', true)">${ic('clock', 15)} Retry</button></div></div>`
      : `<div class="card"><div class="empty"><div class="ico">${ic('clock', 22)}</div><b>Loading contacts…</b><p>Fetching from the record.</p></div></div>`;
    return head + body;
  }

  if (!st.list.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic('users', 22)}</div>
      <b>No contacts yet</b><p>Add a parent, guardian, or professional to this record.</p>
      <button class="btn primary" onclick="openContactModal('${esc(c.id)}')">${ic('plus', 15)} Add contact</button></div></div>`;
  }

  // Primary first, then alphabetical by last name.
  const sorted = st.list.slice().sort((a, b) =>
    (a.primary === b.primary) ? a.lastName.localeCompare(b.lastName) : (a.primary ? -1 : 1));
  const cards = sorted.map(ct => contactCard(c.id, ct)).join('');
  return head + `<div class="contact-grid">${cards}</div>`;
}

function contactCard(cid: string, ct: LiveContact): string {
  const name = (ct.firstName + ' ' + ct.lastName).trim() || 'Unnamed contact';
  const loc = [ct.city, ct.state].filter(Boolean).join(', ');
  const rows = [
    ct.email ? `<div class="c-row">${ic('msg', 14)}<a href="mailto:${esc(ct.email)}">${esc(ct.email)}</a></div>` : '',
    ct.cell ? `<div class="c-row">${ic('bell', 14)}<span>${esc(ct.cell)}</span></div>` : '',
    (ct.address || loc) ? `<div class="c-row">${ic('map', 14)}<span>${esc([ct.address, loc].filter(Boolean).join(' · '))}</span></div>` : '',
  ].filter(Boolean).join('');

  return `<div class="card contact-card">
    <div class="cc-top">
      ${avatar(ct.firstName, ct.lastName, 40, 14, ct.photoUrl)}
      <div class="cc-id">
        <div class="cc-name">${esc(name)}${ct.primary ? ' <span class="pill primary"><span class="dot"></span>Primary</span>' : ''}</div>
        <div class="cc-rel">${ct.relationship ? esc(ct.relationship) : '<span style="color:var(--muted-foreground)">No relationship set</span>'}</div>
      </div>
      <div class="cc-acts">
        <button class="ico-mini" title="Edit" onclick="openContactModal('${esc(cid)}','${esc(ct.entryId)}')">${ic('edit', 15)}</button>
        <button class="ico-mini danger" title="Delete" onclick="deleteContactPrompt('${esc(cid)}','${esc(ct.entryId)}')">${ic('trash', 15)}</button>
      </div>
    </div>
    ${rows ? `<div class="cc-body">${rows}</div>` : ''}
  </div>`;
}

// ── add / edit modal ─────────────────────────────────────────────────────────
interface ContactFieldDef { k: string; label: string; type?: 'text' | 'email' | 'tel' | 'textarea' | 'relationship' | 'checkbox'; full?: boolean; placeholder?: string; }
const CONTACT_MODAL_FIELDS: ContactFieldDef[] = [
  { k: 'firstName', label: 'First name' },
  { k: 'lastName', label: 'Last name' },
  { k: 'relationship', label: 'Relationship', type: 'relationship', full: true },
  { k: 'email', label: 'Email', type: 'email', placeholder: 'name@example.com' },
  { k: 'cell', label: 'Cell phone', type: 'tel', placeholder: '(555) 555-0123' },
  { k: 'address', label: 'Address', type: 'textarea', full: true },
  { k: 'city', label: 'City' },
  { k: 'state', label: 'State' },
  { k: 'zip', label: 'ZIP' },
  { k: 'primary', label: 'Primary contact', type: 'checkbox', full: true },
];

// Relationship control: a <select> fed by settings with a hard-coded, always-last
// "Other" option. If the stored value isn't a list option (legacy / free-typed),
// it's treated as Other and the text box is prefilled. Selecting Other reveals
// the "Specify relationship" box; its text is what gets stored (see saveContact).
function relationshipControl(current: string): string {
  const opts = relationshipOptions();
  const isOther = !!current && opts.indexOf(current) < 0;
  const sel = isOther ? OTHER_RELATIONSHIP : (current || '');
  const choices = [''].concat(opts, [OTHER_RELATIONSHIP]);
  const select = `<select data-k="relationship" data-reln-select onchange="onRelationshipChange(this)">${choices.map(o =>
    `<option value="${esc(o)}"${o === sel ? ' selected' : ''}>${o ? esc(o) : '—'}</option>`).join('')}</select>`;
  const otherText = `<input type="text" data-reln-other placeholder="Specify relationship" autocomplete="off"
    value="${esc(isOther ? current : '')}"${isOther ? '' : ' hidden'}>`;
  return `<div class="reln-control">${select}${otherText}</div>`;
}

// Show/hide the free-text box as the relationship select changes.
function onRelationshipChange(sel: HTMLSelectElement): void {
  const wrap = sel.closest('.reln-control');
  if (!wrap) return;
  const other = wrap.querySelector('[data-reln-other]') as HTMLInputElement | null;
  if (!other) return;
  const show = sel.value === OTHER_RELATIONSHIP;
  other.hidden = !show;
  if (show) other.focus();
}

function contactControl(f: ContactFieldDef, ct: LiveContact | null): string {
  const v = ct ? (ct as any)[f.k] : '';
  if (f.type === 'relationship') return relationshipControl(v || '');
  if (f.type === 'checkbox') {
    return `<label class="chk"><input type="checkbox" data-k="${f.k}"${ct && ct.primary ? ' checked' : ''}> ${esc(f.label)}</label>`;
  }
  if (f.type === 'textarea') {
    return `<textarea data-k="${f.k}" rows="2" placeholder="${esc(f.placeholder || '')}">${esc(v || '')}</textarea>`;
  }
  const t = f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text';
  return `<input type="${t}" data-k="${f.k}" value="${esc(v || '')}" placeholder="${esc(f.placeholder || '')}" autocomplete="off">`;
}

/* ---- contact photo (buffered, applied on Save) ----
   A contact's photo is a DocumentLinkField on the entry, so a NEW contact has no
   entry to attach to until it's saved. We therefore buffer the cropped image (or
   a remove flag) in CONTACT_PHOTO and apply it in saveContact once the entry id
   is known — uniform for both add and edit. mode: 'keep' = no change. */
interface ContactPhotoState { mode: 'keep' | 'set' | 'remove'; dataUrl?: string; }
let CONTACT_PHOTO: ContactPhotoState = { mode: 'keep' };

// The photo URL to preview right now (buffered change wins over the saved value).
function currentContactPhoto(ct: LiveContact | null): string {
  if (CONTACT_PHOTO.mode === 'set') return CONTACT_PHOTO.dataUrl || '';
  if (CONTACT_PHOTO.mode === 'remove') return '';
  return ct ? ct.photoUrl : '';
}

function contactPhotoBlock(ct: LiveContact | null, first: string, last: string): string {
  const url = currentContactPhoto(ct);
  const inner = url ? `<img src="${esc(url)}" alt="">` : `<span class="ph-initials">${esc(initials(first, last) || '?')}</span>`;
  const has = !!url;
  return `<div class="photo-edit" id="__contactPhotoBlock">
    <div class="photo-frame">${inner}</div>
    <div class="photo-actions">
      <input type="file" accept="image/*" id="__contactPhotoInput" hidden onchange="onContactPhotoPick(this)">
      <div class="photo-btns">
        <button class="btn outline" type="button" onclick="document.getElementById('__contactPhotoInput').click()">${ic('image', 15)} ${has ? 'Change photo' : 'Add photo'}</button>
        ${has ? `<button class="btn ghost" type="button" onclick="removeContactPhoto()">${ic('trash', 15)} Remove</button>` : ''}
      </div>
      <div class="photo-hint">JPG, PNG, or GIF. Crop &amp; zoom before saving — applied when you save the contact.</div>
    </div>
  </div>`;
}

// Rebuild just the photo block (after crop / remove), using live name inputs.
function refreshContactPhotoPreview(): void {
  const block = document.getElementById('__contactPhotoBlock');
  const modal = document.querySelector('#__contactModal .modal-card') as HTMLElement | null;
  if (!block || !modal) return;
  const cid = modal.getAttribute('data-cid') || '';
  const entryId = modal.getAttribute('data-entry') || '';
  const st = contactsState(cid);
  const ct = entryId && st.list ? (st.list.filter(x => x.entryId === entryId)[0] || null) : null;
  const fn = (modal.querySelector('[data-k="firstName"]') as HTMLInputElement | null);
  const ln = (modal.querySelector('[data-k="lastName"]') as HTMLInputElement | null);
  block.outerHTML = contactPhotoBlock(ct, fn ? fn.value : (ct ? ct.firstName : ''), ln ? ln.value : (ct ? ct.lastName : ''));
}

async function onContactPhotoPick(input: HTMLInputElement): Promise<void> {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  if (!/^image\//.test(file.type)) { toast('Please choose an image file (JPG, PNG, or GIF).'); return; }
  try {
    const dataUrl = await fileToDataUrl(file); // shared helper from formedit.ts
    openCropper(dataUrl, function (out) { CONTACT_PHOTO = { mode: 'set', dataUrl: out }; refreshContactPhotoPreview(); });
  } catch (e: any) {
    setContactModalError(e && e.message ? e.message : String(e));
  }
}

function removeContactPhoto(): void {
  CONTACT_PHOTO = { mode: 'remove' };
  refreshContactPhotoPreview();
}

function openContactModal(cid: string, entryId?: string): void {
  if (document.getElementById('__contactModal')) closeContactModal();
  CONTACT_PHOTO = { mode: 'keep' }; // reset buffered photo for this modal session
  const st = contactsState(cid);
  const ct = entryId && st.list ? (st.list.filter(x => x.entryId === entryId)[0] || null) : null;
  const editing = !!ct;

  const grid = CONTACT_MODAL_FIELDS.map(f => {
    if (f.type === 'checkbox') return `<div class="field full">${contactControl(f, ct)}</div>`;
    return `<div class="field ${f.full ? 'full' : ''}">
      <label>${esc(f.label)}</label>${contactControl(f, ct)}</div>`;
  }).join('');

  const host = document.createElement('div');
  host.className = 'modal-overlay';
  host.id = '__contactModal';
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="${editing ? 'Edit contact' : 'Add contact'}"
      data-cid="${esc(cid)}" data-entry="${esc(entryId || '')}">
    <div class="modal-head">
      <div><b>${editing ? 'Edit contact' : 'Add contact'}</b><p>${editing ? 'Update this contact.' : 'Add a family member or professional.'}</p></div>
      <button class="ico-x" title="Close" onclick="closeContactModal()">${ic('x', 18)}</button>
    </div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      ${contactPhotoBlock(ct, ct ? ct.firstName : '', ct ? ct.lastName : '')}
      <div class="field-grid">${grid}</div>
    </div>
    <div class="modal-foot">
      <span class="modal-status"></span>
      <span style="flex:1"></span>
      <button class="btn ghost" onclick="closeContactModal()">${ic('x', 15)} Cancel</button>
      <button class="btn primary js-save" onclick="saveContact()">${ic('save', 15)} ${editing ? 'Save changes' : 'Add contact'}</button>
    </div>
  </div>`;
  host.addEventListener('mousedown', e => { if (e.target === host) closeContactModal(); });
  document.body.appendChild(host);
  const first = host.querySelector('input[data-k="firstName"]') as HTMLInputElement | null;
  if (first) first.focus();
  document.addEventListener('keydown', contactEscClose);
}

function contactEscClose(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  if (document.getElementById('__cropModal')) return; // let the cropper's own Esc handle it
  closeContactModal();
}

function closeContactModal(): void {
  const m = document.getElementById('__contactModal');
  if (m) m.remove();
  document.removeEventListener('keydown', contactEscClose);
}

function setContactModalError(msg: string): void {
  const el = document.querySelector('#__contactModal .modal-err') as HTMLElement | null;
  if (!el) return;
  if (msg) { el.textContent = msg; el.hidden = false; } else { el.textContent = ''; el.hidden = true; }
}

async function saveContact(): Promise<void> {
  const modal = document.querySelector('#__contactModal .modal-card') as HTMLElement | null;
  if (!modal) return;
  const cid = modal.getAttribute('data-cid') || '';
  const entryId = modal.getAttribute('data-entry') || '';
  if (!cid) { setContactModalError('Missing client id.'); return; }

  const fields: Record<string, any> = {};
  modal.querySelectorAll('[data-k]').forEach(el => {
    const k = (el as HTMLElement).dataset.k as string;
    const input = el as HTMLInputElement;
    if (input.type === 'checkbox') fields[k] = input.checked;
    else fields[k] = (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value.trim();
  });

  // "Other" relationship -> store the free-text value (fall back to "Other" if blank).
  const relSel = modal.querySelector('[data-reln-select]') as HTMLSelectElement | null;
  if (relSel && relSel.value === OTHER_RELATIONSHIP) {
    const otherEl = modal.querySelector('[data-reln-other]') as HTMLInputElement | null;
    const custom = otherEl ? otherEl.value.trim() : '';
    fields.relationship = custom || OTHER_RELATIONSHIP;
  }

  setContactModalError('');
  if (!fields.firstName && !fields.lastName) { setContactModalError('Enter at least a first or last name.'); return; }

  const saveBtn = modal.querySelector('.js-save') as HTMLButtonElement | null;
  const status = modal.querySelector('.modal-status') as HTMLElement | null;
  if (saveBtn) saveBtn.disabled = true;
  if (status) status.textContent = 'Saving…';

  try {
    // 1) Save the contact fields (create or update) to get the entry id.
    const saved = entryId ? await apiUpdateContact(cid, entryId, fields) : await apiAddContact(cid, fields);
    const savedEntryId = (saved && saved.entryId) ? String(saved.entryId) : entryId;

    // 2) Apply any buffered photo change to that entry.
    if (savedEntryId && CONTACT_PHOTO.mode === 'set' && CONTACT_PHOTO.dataUrl) {
      if (status) status.textContent = 'Uploading photo…';
      const dataUrl = CONTACT_PHOTO.dataUrl;
      const comma = dataUrl.indexOf(',');
      const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      await apiSetContactPhoto(cid, savedEntryId, b64, 'photo.jpg', 'image/jpeg');
    } else if (savedEntryId && CONTACT_PHOTO.mode === 'remove') {
      await apiSetContactPhoto(cid, savedEntryId, '', '', '');
    }

    closeContactModal();
    await loadContacts(cid, true);
    toast(entryId ? 'Contact updated' : 'Contact added');
  } catch (e: any) {
    if (saveBtn) saveBtn.disabled = false;
    if (status) status.textContent = '';
    setContactModalError(e && e.message ? e.message : String(e));
  }
}

async function deleteContactPrompt(cid: string, entryId: string): Promise<void> {
  if (!entryId) return;
  if (!window.confirm('Delete this contact? This can\'t be undone.')) return;
  try {
    await apiDeleteContact(cid, entryId);
    await loadContacts(cid, true);
    toast('Contact deleted');
  } catch (e: any) {
    toast('Delete failed: ' + (e && e.message ? e.message : String(e)));
  }
}
