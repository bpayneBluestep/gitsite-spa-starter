/* =====================================================================
   clientform.ts — "New Client" modal + toast.
   Collects the fields the basic Client form supports today, POSTs them to
   the maestro (api.ts -> /b/maestro createClient), and on success optimistically
   prepends the new client to the list and re-renders.
   NOTE: injected inputs use data-k, never `name` — a named control inside the
   merge-report form would be submitted and trigger "problem storing the data".
   ===================================================================== */

const NEW_CLIENT_FIELDS: { k: string; label: string; req?: boolean; full?: boolean; placeholder?: string }[] = [
  { k: 'firstName', label: 'First name', req: true },
  { k: 'lastName', label: 'Last name', req: true },
  { k: 'prefName', label: 'Preferred name' },
  { k: 'email', label: 'Email', full: true, placeholder: 'name@example.com' },
  { k: 'cell', label: 'Cell phone', placeholder: '(555) 555-0123' },
  { k: 'homePhone', label: 'Home phone' },
  { k: 'homeCity', label: 'City' },
  { k: 'homeState', label: 'State' },
];

function newClientModalHtml(entity: string, label: string): string {
  const fields = NEW_CLIENT_FIELDS.map(f => `
    <div class="field ${f.full ? 'full' : ''}">
      <label>${esc(f.label)}${f.req ? '<span class="req">*</span>' : ''}</label>
      <input data-k="${f.k}" placeholder="${esc(f.placeholder || '')}" autocomplete="off">
    </div>`).join('');
  const lc = label.toLowerCase();
  return `<div class="modal-card" role="dialog" aria-modal="true" aria-label="New ${esc(lc)}" data-entity="${esc(entity)}" data-label="${esc(label)}">
    <div class="modal-head">
      <div><b>New ${esc(label)}</b><p>Create ${lc === 'inquiry' ? 'an' : 'a'} ${esc(lc)} record. You can fill in the rest later.</p></div>
      <button class="ico-x js-cancel" title="Close" onclick="closeNewClient()">${ic('x', 18)}</button>
    </div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <div class="field-grid">${fields}</div>
    </div>
    <div class="modal-foot">
      <span class="modal-status"></span>
      <span style="flex:1"></span>
      <button class="btn ghost js-cancel" onclick="closeNewClient()">${ic('x', 15)} Cancel</button>
      <button class="btn primary js-save" onclick="submitNewClient()">${ic('plus', 15)} Create ${esc(lc)}</button>
    </div>
  </div>`;
}

function openNewClient(entity?: string): void {
  if (document.getElementById('__newClientModal')) return;
  const ent = entity || 'client';
  const label = ent === 'inquiry' ? 'Inquiry' : ent === 'alumni' ? 'Alumnus' : 'Client';
  const host = document.createElement('div');
  host.className = 'modal-overlay';
  host.id = '__newClientModal';
  host.innerHTML = newClientModalHtml(ent, label);
  // click on the backdrop (not the card) closes
  host.addEventListener('mousedown', e => { if (e.target === host) closeNewClient(); });
  document.body.appendChild(host);
  const first = host.querySelector('input[data-k="firstName"]') as HTMLInputElement | null;
  if (first) first.focus();
  document.addEventListener('keydown', escClose);
}

function escClose(e: KeyboardEvent): void { if (e.key === 'Escape') closeNewClient(); }

function closeNewClient(): void {
  const m = document.getElementById('__newClientModal');
  if (m) m.remove();
  document.removeEventListener('keydown', escClose);
}

function setModalError(msg: string): void {
  const el = document.querySelector('#__newClientModal .modal-err') as HTMLElement | null;
  if (!el) return;
  if (msg) { el.textContent = msg; el.hidden = false; } else { el.textContent = ''; el.hidden = true; }
}

async function submitNewClient(): Promise<void> {
  const modal = document.getElementById('__newClientModal');
  if (!modal) return;
  const card = modal.querySelector('.modal-card') as HTMLElement | null;
  const entity = (card && card.getAttribute('data-entity')) || 'client';
  const label = (card && card.getAttribute('data-label')) || 'Client';
  const data: Record<string, string> = {};
  modal.querySelectorAll('input[data-k]').forEach(el => {
    const inp = el as HTMLInputElement;
    data[inp.dataset.k as string] = inp.value.trim();
  });
  setModalError('');
  if (!data.firstName || !data.lastName) { setModalError('First name and last name are required.'); return; }

  const saveBtn = modal.querySelector('.js-save') as HTMLButtonElement | null;
  const status = modal.querySelector('.modal-status') as HTMLElement | null;
  if (saveBtn) saveBtn.disabled = true;
  if (status) status.textContent = 'Saving…';

  try {
    const created = await apiCreatePerson(entity, data);
    closeNewClient();
    // re-pull the matching live store so the new record appears in its tab
    if (entity === 'inquiry') await loadInquiries(true);
    else if (entity === 'alumni') await loadAlumni(true);
    else await loadClients(true);
    toast(label + ' created — ' + data.firstName + ' ' + data.lastName + ' (#' + (created.shortId || '?') + ')');
  } catch (e: any) {
    if (saveBtn) saveBtn.disabled = false;
    if (status) status.textContent = '';
    setModalError(e && e.message ? e.message : String(e));
  }
}

// Lightweight transient toast (bottom-right).
function toast(msg: string): void {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = ic('check', 16) + '<span>' + esc(msg) + '</span>';
  document.body.appendChild(t);
  setTimeout(() => { t.classList.add('show'); }, 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 4200);
}
