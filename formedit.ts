/* =====================================================================
   formedit.ts — editable record-form sections + the Under Construction page.

   Three form sections map 1:1 to the real BlueStep forms on the Client
   record (NEVER combined): Name & Email, Demographics, Contact Info. Each
   renders its live values as inputs, saves a partial update through the
   maestro (api.ts -> /b/maestro updateClient), and refreshes the store.

   Sections with no backing form (Tasks, Contacts, Placements, …) render
   underConstruction() so nothing looks functional when it isn't.

   NOTE: injected controls use data-k / data-mk, never `name` — a named
   control inside the merge-report form would be submitted and trigger
   "problem storing the data".
   ===================================================================== */

type EFType = 'text' | 'email' | 'tel' | 'date' | 'textarea' | 'select' | 'multi';
interface EditField { k: string; label: string; type?: EFType; full?: boolean; req?: boolean; placeholder?: string; optionsKey?: string; }
interface EditFormSpec { key: string; label: string; note: string; fields: EditField[]; }

// Keys here MUST match the maestro CLIENT_FIELDS catalog exactly.
const EDIT_FORMS: { [key: string]: EditFormSpec } = {
  name: {
    key: 'name', label: 'Name & Email', note: 'From the Name & E-mail form.',
    fields: [
      { k: 'firstName', label: 'First name', req: true },
      { k: 'lastName', label: 'Last name', req: true },
      { k: 'prefName', label: 'Preferred name' },
      { k: 'email', label: 'Email', type: 'email', full: true, placeholder: 'name@example.com' },
    ],
  },
  demographics: {
    key: 'demographics', label: 'Demographics', note: 'From the Demographics form.',
    fields: [
      { k: 'dob', label: 'Date of birth', type: 'date' },
      { k: 'sex', label: 'Sex assigned at birth', type: 'select', optionsKey: 'sex' },
      { k: 'gender', label: 'Gender identity', type: 'select', optionsKey: 'gender' },
      { k: 'genderOther', label: 'Specify gender identity' },
      { k: 'pronouns', label: 'Preferred pronouns', type: 'select', optionsKey: 'pronouns' },
      { k: 'pronounsOther', label: 'Specify pronouns' },
      { k: 'race', label: 'Race', type: 'multi', optionsKey: 'race', full: true },
      { k: 'ethnicity', label: 'Ethnicity', type: 'select', optionsKey: 'ethnicity' },
      { k: 'sexualOrientation', label: 'Sexual orientation', type: 'select', optionsKey: 'sexualOrientation' },
      { k: 'sexualOrientationOther', label: 'Specify sexual orientation' },
      { k: 'ssn', label: 'Social Security Number', placeholder: '###-##-####' },
    ],
  },
  contact: {
    key: 'contact', label: 'Contact Info', note: 'From the Contact Information form.',
    fields: [
      { k: 'cell', label: 'Cell phone', type: 'tel', placeholder: '(555) 555-0123' },
      { k: 'homePhone', label: 'Home phone', type: 'tel', placeholder: '(555) 555-0123' },
      { k: 'homeAddress', label: 'Home address', type: 'textarea', full: true },
      { k: 'homeCity', label: 'Home city' },
      { k: 'homeState', label: 'Home state' },
      { k: 'homeZip', label: 'Home ZIP' },
      { k: 'mailingAddress', label: 'Mailing address', type: 'textarea', full: true },
      { k: 'mailingCity', label: 'Mailing city' },
      { k: 'mailingState', label: 'Mailing state' },
      { k: 'mailingZip', label: 'Mailing ZIP' },
    ],
  },
};

function specNeedsMeta(spec: EditFormSpec): boolean {
  return spec.fields.some(f => f.type === 'select' || f.type === 'multi');
}

// Render one control. `value` is a string for most types, string[] for multi.
function efControl(f: EditField, value: any): string {
  if (f.type === 'textarea') {
    return `<textarea data-k="${f.k}" rows="2" placeholder="${esc(f.placeholder || '')}">${esc(value == null ? '' : String(value))}</textarea>`;
  }
  if (f.type === 'select') {
    const cur = value == null ? '' : String(value);
    const opts = metaOptions(f.optionsKey || f.k).slice();
    if (cur && opts.indexOf(cur) < 0) opts.push(cur); // keep an off-list current value selectable
    const choices = [''].concat(opts);
    return `<select data-k="${f.k}">${choices.map(o =>
      `<option value="${esc(o)}"${o === cur ? ' selected' : ''}>${o ? esc(o) : '—'}</option>`).join('')}</select>`;
  }
  if (f.type === 'multi') {
    const sel: string[] = Array.isArray(value) ? value.map(String) : (value ? [String(value)] : []);
    const opts = metaOptions(f.optionsKey || f.k).slice();
    sel.forEach(v => { if (opts.indexOf(v) < 0) opts.push(v); });
    if (!opts.length) return `<div class="fhint">Loading options…</div>`;
    return `<div class="chk-grid">${opts.map(o =>
      `<label class="chk"><input type="checkbox" data-mk="${f.k}" value="${esc(o)}"${sel.indexOf(o) >= 0 ? ' checked' : ''}> ${esc(o)}</label>`).join('')}</div>`;
  }
  const t = f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.type === 'date' ? 'date' : 'text';
  return `<input type="${t}" data-k="${f.k}" value="${esc(value == null ? '' : String(value))}" placeholder="${esc(f.placeholder || '')}" autocomplete="off">`;
}

// The editable section for one form. Pre-filled from the live record (c.raw).
function editFormView(c: Client, formKey: string): string {
  const spec = EDIT_FORMS[formKey];
  if (!spec) return underConstruction(sectionLabel(formKey), '');
  if (specNeedsMeta(spec) && !CLIENT_META && !META_LOADING) loadClientMeta();
  const raw = c.raw || {};

  const grid = spec.fields.map(f => `
    <div class="field ${f.full ? 'full' : ''}">
      <label>${esc(f.label)}${f.req ? '<span class="req">*</span>' : ''}</label>
      ${efControl(f, raw[f.k])}
    </div>`).join('');

  // Age is derived from DOB on the Demographics form — show it read-only.
  const ageRow = (formKey === 'demographics' && raw.age)
    ? `<div class="field"><label>Age</label><div class="ro-val">${esc(String(raw.age))}<span class="muted">calculated</span></div></div>`
    : '';

  const head = `<div class="section-head"><div><h3>${esc(spec.label)}</h3><p>${esc(spec.note)}</p></div></div>`;

  // The Name & Email form owns the record photo (a DocumentLinkField). Render an
  // upload control above its fields; it writes through its own endpoint action.
  const photoBlock = formKey === 'name' ? photoEditBlock(c) : '';

  return head + `<div class="card edit-card" id="__editCard" data-cid="${esc(c.id)}" data-form="${esc(formKey)}">
    <div class="edit-err" hidden></div>
    ${photoBlock}
    <div class="field-grid">${grid}${ageRow}</div>
    <div class="edit-foot">
      <span class="edit-status"></span>
      <span style="flex:1"></span>
      <button class="btn ghost" onclick="render()">${ic('x', 15)} Cancel</button>
      <button class="btn primary js-save" onclick="saveForm()">${ic('save', 15)} Save changes</button>
    </div>
  </div>`;
}

function setEditError(msg: string): void {
  const el = document.querySelector('#__editCard .edit-err') as HTMLElement | null;
  if (!el) return;
  if (msg) { el.textContent = msg; el.hidden = false; } else { el.textContent = ''; el.hidden = true; }
}

// Gather the form's controls and PUT a partial update to the maestro.
async function saveForm(): Promise<void> {
  const card = document.getElementById('__editCard');
  if (!card) return;
  const cid = card.getAttribute('data-cid') || '';
  if (!cid) { setEditError('Missing client id.'); return; }

  const fields: { [k: string]: any } = {};
  card.querySelectorAll('[data-k]').forEach(el => {
    const k = (el as HTMLElement).dataset.k as string;
    fields[k] = (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value.trim();
  });
  // multi-selects: collect checked values per key.
  const multiKeys: { [k: string]: boolean } = {};
  card.querySelectorAll('[data-mk]').forEach(el => { multiKeys[(el as HTMLElement).dataset.mk as string] = true; });
  Object.keys(multiKeys).forEach(k => {
    const vals: string[] = [];
    card.querySelectorAll('[data-mk="' + k + '"]').forEach(el => {
      const cb = el as HTMLInputElement;
      if (cb.checked) vals.push(cb.value);
    });
    fields[k] = vals;
  });

  // Send ONLY changed fields (diff against the original record). This keeps a
  // partial edit from re-writing untouched fields — important when some fields
  // are locked at the privilege level (e.g. the name form's identity fields).
  const orig = CLIENT_STORE ? CLIENT_STORE.filter(c => c.id === cid)[0] : undefined;
  const oraw: { [k: string]: any } = orig && orig.raw ? orig.raw : {};
  const changed: { [k: string]: any } = {};
  Object.keys(fields).forEach(k => {
    const nv = fields[k];
    const ov = oraw[k];
    if (Array.isArray(nv)) {
      const a = nv.slice().sort().join('');
      const b = (Array.isArray(ov) ? ov.slice() : []).sort().join('');
      if (a !== b) changed[k] = nv;
    } else if (String(nv) !== String(ov == null ? '' : ov)) {
      changed[k] = nv;
    }
  });

  setEditError('');
  if (!Object.keys(changed).length) { toast('No changes to save'); return; }
  const saveBtn = card.querySelector('.js-save') as HTMLButtonElement | null;
  const status = card.querySelector('.edit-status') as HTMLElement | null;
  if (saveBtn) saveBtn.disabled = true;
  if (status) status.textContent = 'Saving…';

  try {
    const updated = await apiUpdateClient(cid, changed);
    if (CLIENT_STORE) {
      const idx = CLIENT_STORE.map(c => c.id).indexOf(cid);
      if (idx >= 0) CLIENT_STORE[idx] = realToClient(updated);
    }
    toast('Changes saved');
    render();
  } catch (e: any) {
    if (saveBtn) saveBtn.disabled = false;
    if (status) status.textContent = '';
    setEditError(e && e.message ? e.message : String(e));
  }
}

/* ---------------------------------------------------------------------------
   Record photo (Name & Email form). The photo is a DocumentLinkField; binary
   content can't ride a JSON field value, so it uploads through its own maestro
   action (uploadClientPhoto). Picking a file opens a square pan + zoom cropper
   (hand-rolled — no CDN libraries here); the cropped square is rendered to a
   512px canvas and sent as base64. The store + view refresh on success.
   The file input carries NO `name` attr (a named control inside the host form
   would be submitted → "problem storing the data") and NO `data-k` (so saveForm
   never tries to read it as a field value).
--------------------------------------------------------------------------- */
const PHOTO_OUT = 512;                  // uploaded square edge, px
const PHOTO_HINT = 'JPG, PNG, or GIF. You can crop and zoom before saving.';

function photoEditBlock(c: Client): string {
  const has = !!c.photoUrl;
  const frame = has
    ? `<img src="${esc(c.photoUrl as string)}" alt="${esc(c.first + ' ' + c.last)}">`
    : `<span class="ph-initials">${esc(initials(c.first, c.last))}</span>`;
  return `<div class="photo-edit">
    <div class="photo-frame" id="__photoFrame">${frame}</div>
    <div class="photo-actions">
      <input type="file" accept="image/*" id="__photoInput" hidden onchange="onPhotoFileChange(this)">
      <div class="photo-btns">
        <button class="btn outline" type="button" onclick="document.getElementById('__photoInput').click()">
          ${ic('image', 15)} ${has ? 'Change photo' : 'Add photo'}
        </button>
        ${has ? `<button class="btn ghost" type="button" onclick="removeClientPhoto()">${ic('trash', 15)} Remove</button>` : ''}
      </div>
      <div class="photo-hint" id="__photoHint">${PHOTO_HINT}</div>
    </div>
  </div>`;
}

function setPhotoBusy(busy: boolean, msg?: string): void {
  const hint = document.getElementById('__photoHint');
  if (hint && msg != null) hint.textContent = msg;
  const block = document.querySelector('.photo-edit');
  if (block) block.classList.toggle('busy', busy);
}

// Persist an updated record into the store, in place, by id.
function refreshClientInStore(cid: string, updated: any): void {
  if (!CLIENT_STORE) return;
  const idx = CLIENT_STORE.map(c => c.id).indexOf(cid);
  if (idx >= 0) CLIENT_STORE[idx] = realToClient(updated);
}

// Read a File into a data: URL (used as the cropper's source image).
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

async function onPhotoFileChange(input: HTMLInputElement): Promise<void> {
  const card = document.getElementById('__editCard');
  const cid = card ? card.getAttribute('data-cid') || '' : '';
  const file = input.files && input.files[0];
  input.value = ''; // let the same file be re-picked later
  if (!file || !cid) return;
  if (!/^image\//.test(file.type)) { setPhotoBusy(false, 'Please choose an image file (JPG, PNG, or GIF).'); return; }

  setEditError('');
  try {
    const dataUrl = await fileToDataUrl(file);
    openCropper(dataUrl, function (out) { return uploadPhotoDataUrl(cid, out); });
  } catch (e: any) {
    setEditError(e && e.message ? e.message : String(e));
  }
}

// Strip the data: prefix, POST the base64 to the maestro, refresh + re-render.
async function uploadPhotoDataUrl(cid: string, dataUrl: string): Promise<void> {
  setPhotoBusy(true, 'Uploading photo…');
  try {
    const comma = dataUrl.indexOf(',');
    const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const updated = await apiSetClientPhoto(cid, b64, 'photo.jpg', 'image/jpeg');
    refreshClientInStore(cid, updated);
    toast('Photo updated');
    render();
  } catch (e: any) {
    setPhotoBusy(false, PHOTO_HINT);
    setEditError(e && e.message ? e.message : String(e));
  }
}

async function removeClientPhoto(): Promise<void> {
  const card = document.getElementById('__editCard');
  const cid = card ? card.getAttribute('data-cid') || '' : '';
  if (!cid) return;
  setEditError('');
  setPhotoBusy(true, 'Removing photo…');
  try {
    const updated = await apiSetClientPhoto(cid, '', '', '');
    refreshClientInStore(cid, updated);
    toast('Photo removed');
    render();
  } catch (e: any) {
    setPhotoBusy(false, PHOTO_HINT);
    setEditError(e && e.message ? e.message : String(e));
  }
}

/* ---------------------------------------------------------------------------
   Square pan + zoom cropper. A fixed VIEW×VIEW stage shows the image positioned
   by a CSS transform (translate then scale, origin 0,0). Drag pans; the slider
   and wheel zoom around the stage centre. On confirm we map the stage back to
   source pixels and drawImage() a square crop into a PHOTO_OUT canvas.
   Geometry: a source point p maps to stage point s = t + p*scale, so the visible
   source rect is sx=-tx/scale, sy=-ty/scale, side=VIEW/scale.
--------------------------------------------------------------------------- */
const CROP_VIEW = 280; // on-screen crop stage edge, px

// onApply receives the cropped JPEG data URL — the caller decides what to do
// with it (upload immediately, or buffer it for a later save). This is the seam
// that lets the same cropper serve the client photo AND contact photos.
interface CropState {
  img: HTMLImageElement; onApply: (dataUrl: string) => any;
  scale: number; minScale: number; maxScale: number;
  tx: number; ty: number;
  drag: { active: boolean; x: number; y: number; tx: number; ty: number };
}
let CROP: CropState | null = null;

function openCropper(dataUrl: string, onApply: (dataUrl: string) => any): void {
  const img = new Image();
  img.onerror = () => { setEditError('That image could not be loaded.'); };
  img.onload = () => {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) { setEditError('That image has no dimensions.'); return; }
    const minScale = CROP_VIEW / Math.min(iw, ih);   // smallest scale that still covers the square
    CROP = {
      img, onApply,
      scale: minScale, minScale, maxScale: minScale * 5,
      tx: (CROP_VIEW - iw * minScale) / 2,
      ty: (CROP_VIEW - ih * minScale) / 2,
      drag: { active: false, x: 0, y: 0, tx: 0, ty: 0 },
    };
    mountCropper();
  };
  img.src = dataUrl;
}

function cropModalHtml(): string {
  return `<div class="modal-card crop-card" role="dialog" aria-modal="true" aria-label="Crop photo">
    <div class="modal-head">
      <div><b>Crop photo</b><p>Drag to reposition, slide to zoom in on the face.</p></div>
      <button class="ico-x" title="Close" onclick="closeCropper()">${ic('x', 18)}</button>
    </div>
    <div class="modal-body crop-body">
      <div class="modal-err" hidden></div>
      <div class="crop-stage" id="__cropStage" style="width:${CROP_VIEW}px;height:${CROP_VIEW}px">
        <div class="crop-img-wrap" id="__cropImgWrap"></div>
        <div class="crop-ring"></div>
      </div>
      <div class="crop-zoom">
        ${ic('image', 14)}
        <input type="range" id="__cropZoom" min="0" max="1000" value="0" oninput="onCropZoom(this)" aria-label="Zoom">
        ${ic('search', 15)}
      </div>
    </div>
    <div class="modal-foot">
      <span class="modal-status"></span>
      <span style="flex:1"></span>
      <button class="btn ghost" onclick="closeCropper()">${ic('x', 15)} Cancel</button>
      <button class="btn primary" onclick="applyCrop()">${ic('check', 15)} Use photo</button>
    </div>
  </div>`;
}

function mountCropper(): void {
  if (!CROP) return;
  if (document.getElementById('__cropModal')) closeCropper();
  const host = document.createElement('div');
  host.className = 'modal-overlay';
  host.id = '__cropModal';
  host.innerHTML = cropModalHtml();
  host.addEventListener('mousedown', e => { if (e.target === host) closeCropper(); });
  document.body.appendChild(host);

  const wrap = document.getElementById('__cropImgWrap') as HTMLElement;
  const img = CROP.img;
  img.draggable = false;
  img.className = 'crop-img';
  img.style.width = (img.naturalWidth || img.width) + 'px';
  img.style.height = (img.naturalHeight || img.height) + 'px';
  wrap.appendChild(img);
  applyCropTransform();

  const stage = document.getElementById('__cropStage') as HTMLElement;
  stage.addEventListener('pointerdown', cropPointerDown);
  stage.addEventListener('pointermove', cropPointerMove);
  stage.addEventListener('pointerup', cropPointerUp);
  stage.addEventListener('pointercancel', cropPointerUp);
  stage.addEventListener('wheel', cropWheel, { passive: false });

  document.addEventListener('keydown', cropEscClose);
}

function applyCropTransform(): void {
  if (!CROP) return;
  CROP.img.style.transform = `translate(${CROP.tx}px, ${CROP.ty}px) scale(${CROP.scale})`;
}

function clampCropPan(): void {
  if (!CROP) return;
  const w = (CROP.img.naturalWidth || CROP.img.width) * CROP.scale;
  const h = (CROP.img.naturalHeight || CROP.img.height) * CROP.scale;
  CROP.tx = Math.min(0, Math.max(CROP_VIEW - w, CROP.tx));
  CROP.ty = Math.min(0, Math.max(CROP_VIEW - h, CROP.ty));
}

// Set zoom while keeping the stage-centre point fixed in the image.
function setCropScale(next: number): void {
  if (!CROP) return;
  const s = Math.min(CROP.maxScale, Math.max(CROP.minScale, next));
  const c = CROP_VIEW / 2;
  const px = (c - CROP.tx) / CROP.scale;
  const py = (c - CROP.ty) / CROP.scale;
  CROP.scale = s;
  CROP.tx = c - px * s;
  CROP.ty = c - py * s;
  clampCropPan();
  applyCropTransform();
}

function syncCropSlider(): void {
  if (!CROP) return;
  const slider = document.getElementById('__cropZoom') as HTMLInputElement | null;
  if (!slider) return;
  const frac = (CROP.scale - CROP.minScale) / (CROP.maxScale - CROP.minScale || 1);
  slider.value = String(Math.round(frac * 1000));
}

function onCropZoom(slider: HTMLInputElement): void {
  if (!CROP) return;
  const frac = Number(slider.value) / 1000;
  setCropScale(CROP.minScale + frac * (CROP.maxScale - CROP.minScale));
}

function cropPointerDown(e: PointerEvent): void {
  if (!CROP) return;
  CROP.drag = { active: true, x: e.clientX, y: e.clientY, tx: CROP.tx, ty: CROP.ty };
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  e.preventDefault();
}
function cropPointerMove(e: PointerEvent): void {
  if (!CROP || !CROP.drag.active) return;
  CROP.tx = CROP.drag.tx + (e.clientX - CROP.drag.x);
  CROP.ty = CROP.drag.ty + (e.clientY - CROP.drag.y);
  clampCropPan();
  applyCropTransform();
}
function cropPointerUp(_e: PointerEvent): void {
  if (CROP) CROP.drag.active = false;
}
function cropWheel(e: WheelEvent): void {
  if (!CROP) return;
  e.preventDefault();
  setCropScale(CROP.scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
  syncCropSlider();
}

function cropEscClose(e: KeyboardEvent): void { if (e.key === 'Escape') closeCropper(); }

function closeCropper(): void {
  const m = document.getElementById('__cropModal');
  if (m) m.remove();
  document.removeEventListener('keydown', cropEscClose);
  CROP = null;
}

// Render the visible square to a PHOTO_OUT canvas and hand it to onApply.
async function applyCrop(): Promise<void> {
  if (!CROP) return;
  const { img, scale, tx, ty, onApply } = CROP;
  const sx = -tx / scale, sy = -ty / scale, side = CROP_VIEW / scale;
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_OUT; canvas.height = PHOTO_OUT;
  const ctx = canvas.getContext('2d');
  if (!ctx) { setCropModalError('Canvas is unavailable in this browser.'); return; }
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, PHOTO_OUT, PHOTO_OUT);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_OUT, PHOTO_OUT);
  let dataUrl: string;
  try { dataUrl = canvas.toDataURL('image/jpeg', 0.9); }
  catch (e: any) { setCropModalError(e && e.message ? e.message : String(e)); return; }
  closeCropper();
  await onApply(dataUrl);
}

function setCropModalError(msg: string): void {
  const el = document.querySelector('#__cropModal .modal-err') as HTMLElement | null;
  if (!el) return;
  if (msg) { el.textContent = msg; el.hidden = false; } else { el.textContent = ''; el.hidden = true; }
}

// Honest placeholder for record sections that have no backing form yet.
function underConstruction(label: string, note: string): string {
  const msg = note || "This section doesn't have a backing form yet — it'll light up once the data model is built.";
  return `<div class="section-head"><div><h3>${esc(label)}</h3><p>Not yet wired to live data.</p></div></div>
    <div class="card"><div class="empty uc">
      <div class="ico">${ic('settings', 24)}</div>
      <b>Under construction</b>
      <p>${esc(msg)}</p>
      <span class="uc-tag">Coming soon</span>
    </div></div>`;
}
