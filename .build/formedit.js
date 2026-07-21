const EDIT_FORMS = {
  name: {
    key: "name",
    label: "Name & Email",
    note: "From the Name & E-mail form.",
    fields: [
      { k: "firstName", label: "First name", req: true },
      { k: "lastName", label: "Last name", req: true },
      { k: "prefName", label: "Preferred name" },
      { k: "email", label: "Email", type: "email", full: true, placeholder: "name@example.com" }
    ]
  },
  demographics: {
    key: "demographics",
    label: "Demographics",
    note: "From the Demographics form.",
    fields: [
      { k: "dob", label: "Date of birth", type: "date" },
      { k: "sex", label: "Sex assigned at birth", type: "select", optionsKey: "sex" },
      { k: "gender", label: "Gender identity", type: "select", optionsKey: "gender" },
      { k: "genderOther", label: "Specify gender identity" },
      { k: "pronouns", label: "Preferred pronouns", type: "select", optionsKey: "pronouns" },
      { k: "pronounsOther", label: "Specify pronouns" },
      { k: "race", label: "Race", type: "multi", optionsKey: "race", full: true },
      { k: "ethnicity", label: "Ethnicity", type: "select", optionsKey: "ethnicity" },
      { k: "sexualOrientation", label: "Sexual orientation", type: "select", optionsKey: "sexualOrientation" },
      { k: "sexualOrientationOther", label: "Specify sexual orientation" },
      { k: "ssn", label: "Social Security Number", placeholder: "###-##-####" }
    ]
  },
  contact: {
    key: "contact",
    label: "Contact Info",
    note: "From the Contact Information form.",
    fields: [
      { k: "cell", label: "Cell phone", type: "tel", placeholder: "(555) 555-0123" },
      { k: "homePhone", label: "Home phone", type: "tel", placeholder: "(555) 555-0123" },
      { k: "homeAddress", label: "Home address", type: "textarea", full: true },
      { k: "homeCity", label: "Home city" },
      { k: "homeState", label: "Home state" },
      { k: "homeZip", label: "Home ZIP" },
      { k: "mailingAddress", label: "Mailing address", type: "textarea", full: true },
      { k: "mailingCity", label: "Mailing city" },
      { k: "mailingState", label: "Mailing state" },
      { k: "mailingZip", label: "Mailing ZIP" }
    ]
  }
};
function specNeedsMeta(spec) {
  return spec.fields.some((f) => f.type === "select" || f.type === "multi");
}
function efControl(f, value) {
  if (f.type === "textarea") {
    return `<textarea data-k="${f.k}" rows="2" placeholder="${esc(f.placeholder || "")}">${esc(value == null ? "" : String(value))}</textarea>`;
  }
  if (f.type === "select") {
    const cur = value == null ? "" : String(value);
    const opts = metaOptions(f.optionsKey || f.k).slice();
    if (cur && opts.indexOf(cur) < 0) opts.push(cur);
    const choices = [""].concat(opts);
    return `<select data-k="${f.k}">${choices.map((o) => `<option value="${esc(o)}"${o === cur ? " selected" : ""}>${o ? esc(o) : "\u2014"}</option>`).join("")}</select>`;
  }
  if (f.type === "multi") {
    const sel = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
    const opts = metaOptions(f.optionsKey || f.k).slice();
    sel.forEach((v) => {
      if (opts.indexOf(v) < 0) opts.push(v);
    });
    if (!opts.length) return `<div class="fhint">Loading options\u2026</div>`;
    return `<div class="chk-grid">${opts.map((o) => `<label class="chk"><input type="checkbox" data-mk="${f.k}" value="${esc(o)}"${sel.indexOf(o) >= 0 ? " checked" : ""}> ${esc(o)}</label>`).join("")}</div>`;
  }
  const t = f.type === "email" ? "email" : f.type === "tel" ? "tel" : f.type === "date" ? "date" : "text";
  return `<input type="${t}" data-k="${f.k}" value="${esc(value == null ? "" : String(value))}" placeholder="${esc(f.placeholder || "")}" autocomplete="off">`;
}
function editFormView(c, formKey) {
  const spec = EDIT_FORMS[formKey];
  if (!spec) return underConstruction(sectionLabel(formKey), "");
  if (specNeedsMeta(spec) && !CLIENT_META && !META_LOADING) loadClientMeta();
  const raw = c.raw || {};
  const grid = spec.fields.map((f) => `
    <div class="field ${f.full ? "full" : ""}">
      <label>${esc(f.label)}${f.req ? '<span class="req">*</span>' : ""}</label>
      ${efControl(f, raw[f.k])}
    </div>`).join("");
  const ageRow = formKey === "demographics" && raw.age ? `<div class="field"><label>Age</label><div class="ro-val">${esc(String(raw.age))}<span class="muted">calculated</span></div></div>` : "";
  const head = `<div class="section-head"><div><h3>${esc(spec.label)}</h3><p>${esc(spec.note)}</p></div></div>`;
  const photoBlock = formKey === "name" ? photoEditBlock(c) : "";
  return head + `<div class="card edit-card" id="__editCard" data-cid="${esc(c.id)}" data-form="${esc(formKey)}">
    <div class="edit-err" hidden></div>
    ${photoBlock}
    <div class="field-grid">${grid}${ageRow}</div>
    <div class="edit-foot">
      <span class="edit-status"></span>
      <span style="flex:1"></span>
      <button class="btn ghost" onclick="render()">${ic("x", 15)} Cancel</button>
      <button class="btn primary js-save" onclick="saveForm()">${ic("save", 15)} Save changes</button>
    </div>
  </div>`;
}
function setEditError(msg) {
  const el = document.querySelector("#__editCard .edit-err");
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}
async function saveForm() {
  const card = document.getElementById("__editCard");
  if (!card) return;
  const cid = card.getAttribute("data-cid") || "";
  if (!cid) {
    setEditError("Missing client id.");
    return;
  }
  const fields = {};
  card.querySelectorAll("[data-k]").forEach((el) => {
    const k = el.dataset.k;
    fields[k] = el.value.trim();
  });
  const multiKeys = {};
  card.querySelectorAll("[data-mk]").forEach((el) => {
    multiKeys[el.dataset.mk] = true;
  });
  Object.keys(multiKeys).forEach((k) => {
    const vals = [];
    card.querySelectorAll('[data-mk="' + k + '"]').forEach((el) => {
      const cb = el;
      if (cb.checked) vals.push(cb.value);
    });
    fields[k] = vals;
  });
  const orig = CLIENT_STORE ? CLIENT_STORE.filter((c) => c.id === cid)[0] : void 0;
  const oraw = orig && orig.raw ? orig.raw : {};
  const changed = {};
  Object.keys(fields).forEach((k) => {
    const nv = fields[k];
    const ov = oraw[k];
    if (Array.isArray(nv)) {
      const a = nv.slice().sort().join("");
      const b = (Array.isArray(ov) ? ov.slice() : []).sort().join("");
      if (a !== b) changed[k] = nv;
    } else if (String(nv) !== String(ov == null ? "" : ov)) {
      changed[k] = nv;
    }
  });
  setEditError("");
  if (!Object.keys(changed).length) {
    toast("No changes to save");
    return;
  }
  const saveBtn = card.querySelector(".js-save");
  const status = card.querySelector(".edit-status");
  if (saveBtn) saveBtn.disabled = true;
  if (status) status.textContent = "Saving\u2026";
  try {
    const updated = await apiUpdateClient(cid, changed);
    if (CLIENT_STORE) {
      const idx = CLIENT_STORE.map((c) => c.id).indexOf(cid);
      if (idx >= 0) CLIENT_STORE[idx] = realToClient(updated);
    }
    toast("Changes saved");
    render();
  } catch (e) {
    if (saveBtn) saveBtn.disabled = false;
    if (status) status.textContent = "";
    setEditError(e && e.message ? e.message : String(e));
  }
}
const PHOTO_OUT = 512;
const PHOTO_HINT = "JPG, PNG, or GIF. You can crop and zoom before saving.";
function photoEditBlock(c) {
  const has = !!c.photoUrl;
  const frame = has ? `<img src="${esc(c.photoUrl)}" alt="${esc(c.first + " " + c.last)}">` : `<span class="ph-initials">${esc(initials(c.first, c.last))}</span>`;
  return `<div class="photo-edit">
    <div class="photo-frame" id="__photoFrame">${frame}</div>
    <div class="photo-actions">
      <input type="file" accept="image/*" id="__photoInput" hidden onchange="onPhotoFileChange(this)">
      <div class="photo-btns">
        <button class="btn outline" type="button" onclick="document.getElementById('__photoInput').click()">
          ${ic("image", 15)} ${has ? "Change photo" : "Add photo"}
        </button>
        ${has ? `<button class="btn ghost" type="button" onclick="removeClientPhoto()">${ic("trash", 15)} Remove</button>` : ""}
      </div>
      <div class="photo-hint" id="__photoHint">${PHOTO_HINT}</div>
    </div>
  </div>`;
}
function setPhotoBusy(busy, msg) {
  const hint = document.getElementById("__photoHint");
  if (hint && msg != null) hint.textContent = msg;
  const block = document.querySelector(".photo-edit");
  if (block) block.classList.toggle("busy", busy);
}
function refreshClientInStore(cid, updated) {
  if (!CLIENT_STORE) return;
  const idx = CLIENT_STORE.map((c) => c.id).indexOf(cid);
  if (idx >= 0) CLIENT_STORE[idx] = realToClient(updated);
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}
async function onPhotoFileChange(input) {
  const card = document.getElementById("__editCard");
  const cid = card ? card.getAttribute("data-cid") || "" : "";
  const file = input.files && input.files[0];
  input.value = "";
  if (!file || !cid) return;
  if (!/^image\//.test(file.type)) {
    setPhotoBusy(false, "Please choose an image file (JPG, PNG, or GIF).");
    return;
  }
  setEditError("");
  try {
    const dataUrl = await fileToDataUrl(file);
    openCropper(dataUrl, function(out) {
      return uploadPhotoDataUrl(cid, out);
    });
  } catch (e) {
    setEditError(e && e.message ? e.message : String(e));
  }
}
async function uploadPhotoDataUrl(cid, dataUrl) {
  setPhotoBusy(true, "Uploading photo\u2026");
  try {
    const comma = dataUrl.indexOf(",");
    const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const updated = await apiSetClientPhoto(cid, b64, "photo.jpg", "image/jpeg");
    refreshClientInStore(cid, updated);
    toast("Photo updated");
    render();
  } catch (e) {
    setPhotoBusy(false, PHOTO_HINT);
    setEditError(e && e.message ? e.message : String(e));
  }
}
async function removeClientPhoto() {
  const card = document.getElementById("__editCard");
  const cid = card ? card.getAttribute("data-cid") || "" : "";
  if (!cid) return;
  setEditError("");
  setPhotoBusy(true, "Removing photo\u2026");
  try {
    const updated = await apiSetClientPhoto(cid, "", "", "");
    refreshClientInStore(cid, updated);
    toast("Photo removed");
    render();
  } catch (e) {
    setPhotoBusy(false, PHOTO_HINT);
    setEditError(e && e.message ? e.message : String(e));
  }
}
const CROP_VIEW = 280;
let CROP = null;
function openCropper(dataUrl, onApply) {
  const img = new Image();
  img.onerror = () => {
    setEditError("That image could not be loaded.");
  };
  img.onload = () => {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) {
      setEditError("That image has no dimensions.");
      return;
    }
    const minScale = CROP_VIEW / Math.min(iw, ih);
    CROP = {
      img,
      onApply,
      scale: minScale,
      minScale,
      maxScale: minScale * 5,
      tx: (CROP_VIEW - iw * minScale) / 2,
      ty: (CROP_VIEW - ih * minScale) / 2,
      drag: { active: false, x: 0, y: 0, tx: 0, ty: 0 }
    };
    mountCropper();
  };
  img.src = dataUrl;
}
function cropModalHtml() {
  return `<div class="modal-card crop-card" role="dialog" aria-modal="true" aria-label="Crop photo">
    <div class="modal-head">
      <div><b>Crop photo</b><p>Drag to reposition, slide to zoom in on the face.</p></div>
      <button class="ico-x" title="Close" onclick="closeCropper()">${ic("x", 18)}</button>
    </div>
    <div class="modal-body crop-body">
      <div class="modal-err" hidden></div>
      <div class="crop-stage" id="__cropStage" style="width:${CROP_VIEW}px;height:${CROP_VIEW}px">
        <div class="crop-img-wrap" id="__cropImgWrap"></div>
        <div class="crop-ring"></div>
      </div>
      <div class="crop-zoom">
        ${ic("image", 14)}
        <input type="range" id="__cropZoom" min="0" max="1000" value="0" oninput="onCropZoom(this)" aria-label="Zoom">
        ${ic("search", 15)}
      </div>
    </div>
    <div class="modal-foot">
      <span class="modal-status"></span>
      <span style="flex:1"></span>
      <button class="btn ghost" onclick="closeCropper()">${ic("x", 15)} Cancel</button>
      <button class="btn primary" onclick="applyCrop()">${ic("check", 15)} Use photo</button>
    </div>
  </div>`;
}
function mountCropper() {
  if (!CROP) return;
  if (document.getElementById("__cropModal")) closeCropper();
  const host = document.createElement("div");
  host.className = "modal-overlay";
  host.id = "__cropModal";
  host.innerHTML = cropModalHtml();
  host.addEventListener("mousedown", (e) => {
    if (e.target === host) closeCropper();
  });
  document.body.appendChild(host);
  const wrap = document.getElementById("__cropImgWrap");
  const img = CROP.img;
  img.draggable = false;
  img.className = "crop-img";
  img.style.width = (img.naturalWidth || img.width) + "px";
  img.style.height = (img.naturalHeight || img.height) + "px";
  wrap.appendChild(img);
  applyCropTransform();
  const stage = document.getElementById("__cropStage");
  stage.addEventListener("pointerdown", cropPointerDown);
  stage.addEventListener("pointermove", cropPointerMove);
  stage.addEventListener("pointerup", cropPointerUp);
  stage.addEventListener("pointercancel", cropPointerUp);
  stage.addEventListener("wheel", cropWheel, { passive: false });
  document.addEventListener("keydown", cropEscClose);
}
function applyCropTransform() {
  if (!CROP) return;
  CROP.img.style.transform = `translate(${CROP.tx}px, ${CROP.ty}px) scale(${CROP.scale})`;
}
function clampCropPan() {
  if (!CROP) return;
  const w = (CROP.img.naturalWidth || CROP.img.width) * CROP.scale;
  const h = (CROP.img.naturalHeight || CROP.img.height) * CROP.scale;
  CROP.tx = Math.min(0, Math.max(CROP_VIEW - w, CROP.tx));
  CROP.ty = Math.min(0, Math.max(CROP_VIEW - h, CROP.ty));
}
function setCropScale(next) {
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
function syncCropSlider() {
  if (!CROP) return;
  const slider = document.getElementById("__cropZoom");
  if (!slider) return;
  const frac = (CROP.scale - CROP.minScale) / (CROP.maxScale - CROP.minScale || 1);
  slider.value = String(Math.round(frac * 1e3));
}
function onCropZoom(slider) {
  if (!CROP) return;
  const frac = Number(slider.value) / 1e3;
  setCropScale(CROP.minScale + frac * (CROP.maxScale - CROP.minScale));
}
function cropPointerDown(e) {
  if (!CROP) return;
  CROP.drag = { active: true, x: e.clientX, y: e.clientY, tx: CROP.tx, ty: CROP.ty };
  e.currentTarget.setPointerCapture(e.pointerId);
  e.preventDefault();
}
function cropPointerMove(e) {
  if (!CROP || !CROP.drag.active) return;
  CROP.tx = CROP.drag.tx + (e.clientX - CROP.drag.x);
  CROP.ty = CROP.drag.ty + (e.clientY - CROP.drag.y);
  clampCropPan();
  applyCropTransform();
}
function cropPointerUp(_e) {
  if (CROP) CROP.drag.active = false;
}
function cropWheel(e) {
  if (!CROP) return;
  e.preventDefault();
  setCropScale(CROP.scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
  syncCropSlider();
}
function cropEscClose(e) {
  if (e.key === "Escape") closeCropper();
}
function closeCropper() {
  const m = document.getElementById("__cropModal");
  if (m) m.remove();
  document.removeEventListener("keydown", cropEscClose);
  CROP = null;
}
async function applyCrop() {
  if (!CROP) return;
  const { img, scale, tx, ty, onApply } = CROP;
  const sx = -tx / scale, sy = -ty / scale, side = CROP_VIEW / scale;
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_OUT;
  canvas.height = PHOTO_OUT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    setCropModalError("Canvas is unavailable in this browser.");
    return;
  }
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, PHOTO_OUT, PHOTO_OUT);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_OUT, PHOTO_OUT);
  let dataUrl;
  try {
    dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  } catch (e) {
    setCropModalError(e && e.message ? e.message : String(e));
    return;
  }
  closeCropper();
  await onApply(dataUrl);
}
function setCropModalError(msg) {
  const el = document.querySelector("#__cropModal .modal-err");
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}
function underConstruction(label, note) {
  const msg = note || "This section doesn't have a backing form yet \u2014 it'll light up once the data model is built.";
  return `<div class="section-head"><div><h3>${esc(label)}</h3><p>Not yet wired to live data.</p></div></div>
    <div class="card"><div class="empty uc">
      <div class="ico">${ic("settings", 24)}</div>
      <b>Under construction</b>
      <p>${esc(msg)}</p>
      <span class="uc-tag">Coming soon</span>
    </div></div>`;
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiZm9ybWVkaXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgZm9ybWVkaXQudHMgXHUyMDE0IGVkaXRhYmxlIHJlY29yZC1mb3JtIHNlY3Rpb25zICsgdGhlIFVuZGVyIENvbnN0cnVjdGlvbiBwYWdlLlxuXG4gICBUaHJlZSBmb3JtIHNlY3Rpb25zIG1hcCAxOjEgdG8gdGhlIHJlYWwgQmx1ZVN0ZXAgZm9ybXMgb24gdGhlIENsaWVudFxuICAgcmVjb3JkIChORVZFUiBjb21iaW5lZCk6IE5hbWUgJiBFbWFpbCwgRGVtb2dyYXBoaWNzLCBDb250YWN0IEluZm8uIEVhY2hcbiAgIHJlbmRlcnMgaXRzIGxpdmUgdmFsdWVzIGFzIGlucHV0cywgc2F2ZXMgYSBwYXJ0aWFsIHVwZGF0ZSB0aHJvdWdoIHRoZVxuICAgbWFlc3RybyAoYXBpLnRzIC0+IC9iL21hZXN0cm8gdXBkYXRlQ2xpZW50KSwgYW5kIHJlZnJlc2hlcyB0aGUgc3RvcmUuXG5cbiAgIFNlY3Rpb25zIHdpdGggbm8gYmFja2luZyBmb3JtIChUYXNrcywgQ29udGFjdHMsIFBsYWNlbWVudHMsIFx1MjAyNikgcmVuZGVyXG4gICB1bmRlckNvbnN0cnVjdGlvbigpIHNvIG5vdGhpbmcgbG9va3MgZnVuY3Rpb25hbCB3aGVuIGl0IGlzbid0LlxuXG4gICBOT1RFOiBpbmplY3RlZCBjb250cm9scyB1c2UgZGF0YS1rIC8gZGF0YS1taywgbmV2ZXIgYG5hbWVgIFx1MjAxNCBhIG5hbWVkXG4gICBjb250cm9sIGluc2lkZSB0aGUgbWVyZ2UtcmVwb3J0IGZvcm0gd291bGQgYmUgc3VibWl0dGVkIGFuZCB0cmlnZ2VyXG4gICBcInByb2JsZW0gc3RvcmluZyB0aGUgZGF0YVwiLlxuICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbnR5cGUgRUZUeXBlID0gJ3RleHQnIHwgJ2VtYWlsJyB8ICd0ZWwnIHwgJ2RhdGUnIHwgJ3RleHRhcmVhJyB8ICdzZWxlY3QnIHwgJ211bHRpJztcbmludGVyZmFjZSBFZGl0RmllbGQgeyBrOiBzdHJpbmc7IGxhYmVsOiBzdHJpbmc7IHR5cGU/OiBFRlR5cGU7IGZ1bGw/OiBib29sZWFuOyByZXE/OiBib29sZWFuOyBwbGFjZWhvbGRlcj86IHN0cmluZzsgb3B0aW9uc0tleT86IHN0cmluZzsgfVxuaW50ZXJmYWNlIEVkaXRGb3JtU3BlYyB7IGtleTogc3RyaW5nOyBsYWJlbDogc3RyaW5nOyBub3RlOiBzdHJpbmc7IGZpZWxkczogRWRpdEZpZWxkW107IH1cblxuLy8gS2V5cyBoZXJlIE1VU1QgbWF0Y2ggdGhlIG1hZXN0cm8gQ0xJRU5UX0ZJRUxEUyBjYXRhbG9nIGV4YWN0bHkuXG5jb25zdCBFRElUX0ZPUk1TOiB7IFtrZXk6IHN0cmluZ106IEVkaXRGb3JtU3BlYyB9ID0ge1xuICBuYW1lOiB7XG4gICAga2V5OiAnbmFtZScsIGxhYmVsOiAnTmFtZSAmIEVtYWlsJywgbm90ZTogJ0Zyb20gdGhlIE5hbWUgJiBFLW1haWwgZm9ybS4nLFxuICAgIGZpZWxkczogW1xuICAgICAgeyBrOiAnZmlyc3ROYW1lJywgbGFiZWw6ICdGaXJzdCBuYW1lJywgcmVxOiB0cnVlIH0sXG4gICAgICB7IGs6ICdsYXN0TmFtZScsIGxhYmVsOiAnTGFzdCBuYW1lJywgcmVxOiB0cnVlIH0sXG4gICAgICB7IGs6ICdwcmVmTmFtZScsIGxhYmVsOiAnUHJlZmVycmVkIG5hbWUnIH0sXG4gICAgICB7IGs6ICdlbWFpbCcsIGxhYmVsOiAnRW1haWwnLCB0eXBlOiAnZW1haWwnLCBmdWxsOiB0cnVlLCBwbGFjZWhvbGRlcjogJ25hbWVAZXhhbXBsZS5jb20nIH0sXG4gICAgXSxcbiAgfSxcbiAgZGVtb2dyYXBoaWNzOiB7XG4gICAga2V5OiAnZGVtb2dyYXBoaWNzJywgbGFiZWw6ICdEZW1vZ3JhcGhpY3MnLCBub3RlOiAnRnJvbSB0aGUgRGVtb2dyYXBoaWNzIGZvcm0uJyxcbiAgICBmaWVsZHM6IFtcbiAgICAgIHsgazogJ2RvYicsIGxhYmVsOiAnRGF0ZSBvZiBiaXJ0aCcsIHR5cGU6ICdkYXRlJyB9LFxuICAgICAgeyBrOiAnc2V4JywgbGFiZWw6ICdTZXggYXNzaWduZWQgYXQgYmlydGgnLCB0eXBlOiAnc2VsZWN0Jywgb3B0aW9uc0tleTogJ3NleCcgfSxcbiAgICAgIHsgazogJ2dlbmRlcicsIGxhYmVsOiAnR2VuZGVyIGlkZW50aXR5JywgdHlwZTogJ3NlbGVjdCcsIG9wdGlvbnNLZXk6ICdnZW5kZXInIH0sXG4gICAgICB7IGs6ICdnZW5kZXJPdGhlcicsIGxhYmVsOiAnU3BlY2lmeSBnZW5kZXIgaWRlbnRpdHknIH0sXG4gICAgICB7IGs6ICdwcm9ub3VucycsIGxhYmVsOiAnUHJlZmVycmVkIHByb25vdW5zJywgdHlwZTogJ3NlbGVjdCcsIG9wdGlvbnNLZXk6ICdwcm9ub3VucycgfSxcbiAgICAgIHsgazogJ3Byb25vdW5zT3RoZXInLCBsYWJlbDogJ1NwZWNpZnkgcHJvbm91bnMnIH0sXG4gICAgICB7IGs6ICdyYWNlJywgbGFiZWw6ICdSYWNlJywgdHlwZTogJ211bHRpJywgb3B0aW9uc0tleTogJ3JhY2UnLCBmdWxsOiB0cnVlIH0sXG4gICAgICB7IGs6ICdldGhuaWNpdHknLCBsYWJlbDogJ0V0aG5pY2l0eScsIHR5cGU6ICdzZWxlY3QnLCBvcHRpb25zS2V5OiAnZXRobmljaXR5JyB9LFxuICAgICAgeyBrOiAnc2V4dWFsT3JpZW50YXRpb24nLCBsYWJlbDogJ1NleHVhbCBvcmllbnRhdGlvbicsIHR5cGU6ICdzZWxlY3QnLCBvcHRpb25zS2V5OiAnc2V4dWFsT3JpZW50YXRpb24nIH0sXG4gICAgICB7IGs6ICdzZXh1YWxPcmllbnRhdGlvbk90aGVyJywgbGFiZWw6ICdTcGVjaWZ5IHNleHVhbCBvcmllbnRhdGlvbicgfSxcbiAgICAgIHsgazogJ3NzbicsIGxhYmVsOiAnU29jaWFsIFNlY3VyaXR5IE51bWJlcicsIHBsYWNlaG9sZGVyOiAnIyMjLSMjLSMjIyMnIH0sXG4gICAgXSxcbiAgfSxcbiAgY29udGFjdDoge1xuICAgIGtleTogJ2NvbnRhY3QnLCBsYWJlbDogJ0NvbnRhY3QgSW5mbycsIG5vdGU6ICdGcm9tIHRoZSBDb250YWN0IEluZm9ybWF0aW9uIGZvcm0uJyxcbiAgICBmaWVsZHM6IFtcbiAgICAgIHsgazogJ2NlbGwnLCBsYWJlbDogJ0NlbGwgcGhvbmUnLCB0eXBlOiAndGVsJywgcGxhY2Vob2xkZXI6ICcoNTU1KSA1NTUtMDEyMycgfSxcbiAgICAgIHsgazogJ2hvbWVQaG9uZScsIGxhYmVsOiAnSG9tZSBwaG9uZScsIHR5cGU6ICd0ZWwnLCBwbGFjZWhvbGRlcjogJyg1NTUpIDU1NS0wMTIzJyB9LFxuICAgICAgeyBrOiAnaG9tZUFkZHJlc3MnLCBsYWJlbDogJ0hvbWUgYWRkcmVzcycsIHR5cGU6ICd0ZXh0YXJlYScsIGZ1bGw6IHRydWUgfSxcbiAgICAgIHsgazogJ2hvbWVDaXR5JywgbGFiZWw6ICdIb21lIGNpdHknIH0sXG4gICAgICB7IGs6ICdob21lU3RhdGUnLCBsYWJlbDogJ0hvbWUgc3RhdGUnIH0sXG4gICAgICB7IGs6ICdob21lWmlwJywgbGFiZWw6ICdIb21lIFpJUCcgfSxcbiAgICAgIHsgazogJ21haWxpbmdBZGRyZXNzJywgbGFiZWw6ICdNYWlsaW5nIGFkZHJlc3MnLCB0eXBlOiAndGV4dGFyZWEnLCBmdWxsOiB0cnVlIH0sXG4gICAgICB7IGs6ICdtYWlsaW5nQ2l0eScsIGxhYmVsOiAnTWFpbGluZyBjaXR5JyB9LFxuICAgICAgeyBrOiAnbWFpbGluZ1N0YXRlJywgbGFiZWw6ICdNYWlsaW5nIHN0YXRlJyB9LFxuICAgICAgeyBrOiAnbWFpbGluZ1ppcCcsIGxhYmVsOiAnTWFpbGluZyBaSVAnIH0sXG4gICAgXSxcbiAgfSxcbn07XG5cbmZ1bmN0aW9uIHNwZWNOZWVkc01ldGEoc3BlYzogRWRpdEZvcm1TcGVjKTogYm9vbGVhbiB7XG4gIHJldHVybiBzcGVjLmZpZWxkcy5zb21lKGYgPT4gZi50eXBlID09PSAnc2VsZWN0JyB8fCBmLnR5cGUgPT09ICdtdWx0aScpO1xufVxuXG4vLyBSZW5kZXIgb25lIGNvbnRyb2wuIGB2YWx1ZWAgaXMgYSBzdHJpbmcgZm9yIG1vc3QgdHlwZXMsIHN0cmluZ1tdIGZvciBtdWx0aS5cbmZ1bmN0aW9uIGVmQ29udHJvbChmOiBFZGl0RmllbGQsIHZhbHVlOiBhbnkpOiBzdHJpbmcge1xuICBpZiAoZi50eXBlID09PSAndGV4dGFyZWEnKSB7XG4gICAgcmV0dXJuIGA8dGV4dGFyZWEgZGF0YS1rPVwiJHtmLmt9XCIgcm93cz1cIjJcIiBwbGFjZWhvbGRlcj1cIiR7ZXNjKGYucGxhY2Vob2xkZXIgfHwgJycpfVwiPiR7ZXNjKHZhbHVlID09IG51bGwgPyAnJyA6IFN0cmluZyh2YWx1ZSkpfTwvdGV4dGFyZWE+YDtcbiAgfVxuICBpZiAoZi50eXBlID09PSAnc2VsZWN0Jykge1xuICAgIGNvbnN0IGN1ciA9IHZhbHVlID09IG51bGwgPyAnJyA6IFN0cmluZyh2YWx1ZSk7XG4gICAgY29uc3Qgb3B0cyA9IG1ldGFPcHRpb25zKGYub3B0aW9uc0tleSB8fCBmLmspLnNsaWNlKCk7XG4gICAgaWYgKGN1ciAmJiBvcHRzLmluZGV4T2YoY3VyKSA8IDApIG9wdHMucHVzaChjdXIpOyAvLyBrZWVwIGFuIG9mZi1saXN0IGN1cnJlbnQgdmFsdWUgc2VsZWN0YWJsZVxuICAgIGNvbnN0IGNob2ljZXMgPSBbJyddLmNvbmNhdChvcHRzKTtcbiAgICByZXR1cm4gYDxzZWxlY3QgZGF0YS1rPVwiJHtmLmt9XCI+JHtjaG9pY2VzLm1hcChvID0+XG4gICAgICBgPG9wdGlvbiB2YWx1ZT1cIiR7ZXNjKG8pfVwiJHtvID09PSBjdXIgPyAnIHNlbGVjdGVkJyA6ICcnfT4ke28gPyBlc2MobykgOiAnXHUyMDE0J308L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD5gO1xuICB9XG4gIGlmIChmLnR5cGUgPT09ICdtdWx0aScpIHtcbiAgICBjb25zdCBzZWw6IHN0cmluZ1tdID0gQXJyYXkuaXNBcnJheSh2YWx1ZSkgPyB2YWx1ZS5tYXAoU3RyaW5nKSA6ICh2YWx1ZSA/IFtTdHJpbmcodmFsdWUpXSA6IFtdKTtcbiAgICBjb25zdCBvcHRzID0gbWV0YU9wdGlvbnMoZi5vcHRpb25zS2V5IHx8IGYuaykuc2xpY2UoKTtcbiAgICBzZWwuZm9yRWFjaCh2ID0+IHsgaWYgKG9wdHMuaW5kZXhPZih2KSA8IDApIG9wdHMucHVzaCh2KTsgfSk7XG4gICAgaWYgKCFvcHRzLmxlbmd0aCkgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiZmhpbnRcIj5Mb2FkaW5nIG9wdGlvbnNcdTIwMjY8L2Rpdj5gO1xuICAgIHJldHVybiBgPGRpdiBjbGFzcz1cImNoay1ncmlkXCI+JHtvcHRzLm1hcChvID0+XG4gICAgICBgPGxhYmVsIGNsYXNzPVwiY2hrXCI+PGlucHV0IHR5cGU9XCJjaGVja2JveFwiIGRhdGEtbWs9XCIke2Yua31cIiB2YWx1ZT1cIiR7ZXNjKG8pfVwiJHtzZWwuaW5kZXhPZihvKSA+PSAwID8gJyBjaGVja2VkJyA6ICcnfT4gJHtlc2Mobyl9PC9sYWJlbD5gKS5qb2luKCcnKX08L2Rpdj5gO1xuICB9XG4gIGNvbnN0IHQgPSBmLnR5cGUgPT09ICdlbWFpbCcgPyAnZW1haWwnIDogZi50eXBlID09PSAndGVsJyA/ICd0ZWwnIDogZi50eXBlID09PSAnZGF0ZScgPyAnZGF0ZScgOiAndGV4dCc7XG4gIHJldHVybiBgPGlucHV0IHR5cGU9XCIke3R9XCIgZGF0YS1rPVwiJHtmLmt9XCIgdmFsdWU9XCIke2VzYyh2YWx1ZSA9PSBudWxsID8gJycgOiBTdHJpbmcodmFsdWUpKX1cIiBwbGFjZWhvbGRlcj1cIiR7ZXNjKGYucGxhY2Vob2xkZXIgfHwgJycpfVwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiPmA7XG59XG5cbi8vIFRoZSBlZGl0YWJsZSBzZWN0aW9uIGZvciBvbmUgZm9ybS4gUHJlLWZpbGxlZCBmcm9tIHRoZSBsaXZlIHJlY29yZCAoYy5yYXcpLlxuZnVuY3Rpb24gZWRpdEZvcm1WaWV3KGM6IENsaWVudCwgZm9ybUtleTogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3Qgc3BlYyA9IEVESVRfRk9STVNbZm9ybUtleV07XG4gIGlmICghc3BlYykgcmV0dXJuIHVuZGVyQ29uc3RydWN0aW9uKHNlY3Rpb25MYWJlbChmb3JtS2V5KSwgJycpO1xuICBpZiAoc3BlY05lZWRzTWV0YShzcGVjKSAmJiAhQ0xJRU5UX01FVEEgJiYgIU1FVEFfTE9BRElORykgbG9hZENsaWVudE1ldGEoKTtcbiAgY29uc3QgcmF3ID0gYy5yYXcgfHwge307XG5cbiAgY29uc3QgZ3JpZCA9IHNwZWMuZmllbGRzLm1hcChmID0+IGBcbiAgICA8ZGl2IGNsYXNzPVwiZmllbGQgJHtmLmZ1bGwgPyAnZnVsbCcgOiAnJ31cIj5cbiAgICAgIDxsYWJlbD4ke2VzYyhmLmxhYmVsKX0ke2YucmVxID8gJzxzcGFuIGNsYXNzPVwicmVxXCI+Kjwvc3Bhbj4nIDogJyd9PC9sYWJlbD5cbiAgICAgICR7ZWZDb250cm9sKGYsIHJhd1tmLmtdKX1cbiAgICA8L2Rpdj5gKS5qb2luKCcnKTtcblxuICAvLyBBZ2UgaXMgZGVyaXZlZCBmcm9tIERPQiBvbiB0aGUgRGVtb2dyYXBoaWNzIGZvcm0gXHUyMDE0IHNob3cgaXQgcmVhZC1vbmx5LlxuICBjb25zdCBhZ2VSb3cgPSAoZm9ybUtleSA9PT0gJ2RlbW9ncmFwaGljcycgJiYgcmF3LmFnZSlcbiAgICA/IGA8ZGl2IGNsYXNzPVwiZmllbGRcIj48bGFiZWw+QWdlPC9sYWJlbD48ZGl2IGNsYXNzPVwicm8tdmFsXCI+JHtlc2MoU3RyaW5nKHJhdy5hZ2UpKX08c3BhbiBjbGFzcz1cIm11dGVkXCI+Y2FsY3VsYXRlZDwvc3Bhbj48L2Rpdj48L2Rpdj5gXG4gICAgOiAnJztcblxuICBjb25zdCBoZWFkID0gYDxkaXYgY2xhc3M9XCJzZWN0aW9uLWhlYWRcIj48ZGl2PjxoMz4ke2VzYyhzcGVjLmxhYmVsKX08L2gzPjxwPiR7ZXNjKHNwZWMubm90ZSl9PC9wPjwvZGl2PjwvZGl2PmA7XG5cbiAgLy8gVGhlIE5hbWUgJiBFbWFpbCBmb3JtIG93bnMgdGhlIHJlY29yZCBwaG90byAoYSBEb2N1bWVudExpbmtGaWVsZCkuIFJlbmRlciBhblxuICAvLyB1cGxvYWQgY29udHJvbCBhYm92ZSBpdHMgZmllbGRzOyBpdCB3cml0ZXMgdGhyb3VnaCBpdHMgb3duIGVuZHBvaW50IGFjdGlvbi5cbiAgY29uc3QgcGhvdG9CbG9jayA9IGZvcm1LZXkgPT09ICduYW1lJyA/IHBob3RvRWRpdEJsb2NrKGMpIDogJyc7XG5cbiAgcmV0dXJuIGhlYWQgKyBgPGRpdiBjbGFzcz1cImNhcmQgZWRpdC1jYXJkXCIgaWQ9XCJfX2VkaXRDYXJkXCIgZGF0YS1jaWQ9XCIke2VzYyhjLmlkKX1cIiBkYXRhLWZvcm09XCIke2VzYyhmb3JtS2V5KX1cIj5cbiAgICA8ZGl2IGNsYXNzPVwiZWRpdC1lcnJcIiBoaWRkZW4+PC9kaXY+XG4gICAgJHtwaG90b0Jsb2NrfVxuICAgIDxkaXYgY2xhc3M9XCJmaWVsZC1ncmlkXCI+JHtncmlkfSR7YWdlUm93fTwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJlZGl0LWZvb3RcIj5cbiAgICAgIDxzcGFuIGNsYXNzPVwiZWRpdC1zdGF0dXNcIj48L3NwYW4+XG4gICAgICA8c3BhbiBzdHlsZT1cImZsZXg6MVwiPjwvc3Bhbj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBvbmNsaWNrPVwicmVuZGVyKClcIj4ke2ljKCd4JywgMTUpfSBDYW5jZWw8L2J1dHRvbj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeSBqcy1zYXZlXCIgb25jbGljaz1cInNhdmVGb3JtKClcIj4ke2ljKCdzYXZlJywgMTUpfSBTYXZlIGNoYW5nZXM8L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgPC9kaXY+YDtcbn1cblxuZnVuY3Rpb24gc2V0RWRpdEVycm9yKG1zZzogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI19fZWRpdENhcmQgLmVkaXQtZXJyJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoIWVsKSByZXR1cm47XG4gIGlmIChtc2cpIHsgZWwudGV4dENvbnRlbnQgPSBtc2c7IGVsLmhpZGRlbiA9IGZhbHNlOyB9IGVsc2UgeyBlbC50ZXh0Q29udGVudCA9ICcnOyBlbC5oaWRkZW4gPSB0cnVlOyB9XG59XG5cbi8vIEdhdGhlciB0aGUgZm9ybSdzIGNvbnRyb2xzIGFuZCBQVVQgYSBwYXJ0aWFsIHVwZGF0ZSB0byB0aGUgbWFlc3Ryby5cbmFzeW5jIGZ1bmN0aW9uIHNhdmVGb3JtKCk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBjYXJkID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fZWRpdENhcmQnKTtcbiAgaWYgKCFjYXJkKSByZXR1cm47XG4gIGNvbnN0IGNpZCA9IGNhcmQuZ2V0QXR0cmlidXRlKCdkYXRhLWNpZCcpIHx8ICcnO1xuICBpZiAoIWNpZCkgeyBzZXRFZGl0RXJyb3IoJ01pc3NpbmcgY2xpZW50IGlkLicpOyByZXR1cm47IH1cblxuICBjb25zdCBmaWVsZHM6IHsgW2s6IHN0cmluZ106IGFueSB9ID0ge307XG4gIGNhcmQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEta10nKS5mb3JFYWNoKGVsID0+IHtcbiAgICBjb25zdCBrID0gKGVsIGFzIEhUTUxFbGVtZW50KS5kYXRhc2V0LmsgYXMgc3RyaW5nO1xuICAgIGZpZWxkc1trXSA9IChlbCBhcyBIVE1MSW5wdXRFbGVtZW50IHwgSFRNTFRleHRBcmVhRWxlbWVudCB8IEhUTUxTZWxlY3RFbGVtZW50KS52YWx1ZS50cmltKCk7XG4gIH0pO1xuICAvLyBtdWx0aS1zZWxlY3RzOiBjb2xsZWN0IGNoZWNrZWQgdmFsdWVzIHBlciBrZXkuXG4gIGNvbnN0IG11bHRpS2V5czogeyBbazogc3RyaW5nXTogYm9vbGVhbiB9ID0ge307XG4gIGNhcmQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtbWtdJykuZm9yRWFjaChlbCA9PiB7IG11bHRpS2V5c1soZWwgYXMgSFRNTEVsZW1lbnQpLmRhdGFzZXQubWsgYXMgc3RyaW5nXSA9IHRydWU7IH0pO1xuICBPYmplY3Qua2V5cyhtdWx0aUtleXMpLmZvckVhY2goayA9PiB7XG4gICAgY29uc3QgdmFsczogc3RyaW5nW10gPSBbXTtcbiAgICBjYXJkLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLW1rPVwiJyArIGsgKyAnXCJdJykuZm9yRWFjaChlbCA9PiB7XG4gICAgICBjb25zdCBjYiA9IGVsIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgICBpZiAoY2IuY2hlY2tlZCkgdmFscy5wdXNoKGNiLnZhbHVlKTtcbiAgICB9KTtcbiAgICBmaWVsZHNba10gPSB2YWxzO1xuICB9KTtcblxuICAvLyBTZW5kIE9OTFkgY2hhbmdlZCBmaWVsZHMgKGRpZmYgYWdhaW5zdCB0aGUgb3JpZ2luYWwgcmVjb3JkKS4gVGhpcyBrZWVwcyBhXG4gIC8vIHBhcnRpYWwgZWRpdCBmcm9tIHJlLXdyaXRpbmcgdW50b3VjaGVkIGZpZWxkcyBcdTIwMTQgaW1wb3J0YW50IHdoZW4gc29tZSBmaWVsZHNcbiAgLy8gYXJlIGxvY2tlZCBhdCB0aGUgcHJpdmlsZWdlIGxldmVsIChlLmcuIHRoZSBuYW1lIGZvcm0ncyBpZGVudGl0eSBmaWVsZHMpLlxuICBjb25zdCBvcmlnID0gQ0xJRU5UX1NUT1JFID8gQ0xJRU5UX1NUT1JFLmZpbHRlcihjID0+IGMuaWQgPT09IGNpZClbMF0gOiB1bmRlZmluZWQ7XG4gIGNvbnN0IG9yYXc6IHsgW2s6IHN0cmluZ106IGFueSB9ID0gb3JpZyAmJiBvcmlnLnJhdyA/IG9yaWcucmF3IDoge307XG4gIGNvbnN0IGNoYW5nZWQ6IHsgW2s6IHN0cmluZ106IGFueSB9ID0ge307XG4gIE9iamVjdC5rZXlzKGZpZWxkcykuZm9yRWFjaChrID0+IHtcbiAgICBjb25zdCBudiA9IGZpZWxkc1trXTtcbiAgICBjb25zdCBvdiA9IG9yYXdba107XG4gICAgaWYgKEFycmF5LmlzQXJyYXkobnYpKSB7XG4gICAgICBjb25zdCBhID0gbnYuc2xpY2UoKS5zb3J0KCkuam9pbignXHUwMDAxJyk7XG4gICAgICBjb25zdCBiID0gKEFycmF5LmlzQXJyYXkob3YpID8gb3Yuc2xpY2UoKSA6IFtdKS5zb3J0KCkuam9pbignXHUwMDAxJyk7XG4gICAgICBpZiAoYSAhPT0gYikgY2hhbmdlZFtrXSA9IG52O1xuICAgIH0gZWxzZSBpZiAoU3RyaW5nKG52KSAhPT0gU3RyaW5nKG92ID09IG51bGwgPyAnJyA6IG92KSkge1xuICAgICAgY2hhbmdlZFtrXSA9IG52O1xuICAgIH1cbiAgfSk7XG5cbiAgc2V0RWRpdEVycm9yKCcnKTtcbiAgaWYgKCFPYmplY3Qua2V5cyhjaGFuZ2VkKS5sZW5ndGgpIHsgdG9hc3QoJ05vIGNoYW5nZXMgdG8gc2F2ZScpOyByZXR1cm47IH1cbiAgY29uc3Qgc2F2ZUJ0biA9IGNhcmQucXVlcnlTZWxlY3RvcignLmpzLXNhdmUnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG4gIGNvbnN0IHN0YXR1cyA9IGNhcmQucXVlcnlTZWxlY3RvcignLmVkaXQtc3RhdHVzJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoc2F2ZUJ0bikgc2F2ZUJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICdTYXZpbmdcdTIwMjYnO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IGFwaVVwZGF0ZUNsaWVudChjaWQsIGNoYW5nZWQpO1xuICAgIGlmIChDTElFTlRfU1RPUkUpIHtcbiAgICAgIGNvbnN0IGlkeCA9IENMSUVOVF9TVE9SRS5tYXAoYyA9PiBjLmlkKS5pbmRleE9mKGNpZCk7XG4gICAgICBpZiAoaWR4ID49IDApIENMSUVOVF9TVE9SRVtpZHhdID0gcmVhbFRvQ2xpZW50KHVwZGF0ZWQpO1xuICAgIH1cbiAgICB0b2FzdCgnQ2hhbmdlcyBzYXZlZCcpO1xuICAgIHJlbmRlcigpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBpZiAoc2F2ZUJ0bikgc2F2ZUJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICcnO1xuICAgIHNldEVkaXRFcnJvcihlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSk7XG4gIH1cbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICBSZWNvcmQgcGhvdG8gKE5hbWUgJiBFbWFpbCBmb3JtKS4gVGhlIHBob3RvIGlzIGEgRG9jdW1lbnRMaW5rRmllbGQ7IGJpbmFyeVxuICAgY29udGVudCBjYW4ndCByaWRlIGEgSlNPTiBmaWVsZCB2YWx1ZSwgc28gaXQgdXBsb2FkcyB0aHJvdWdoIGl0cyBvd24gbWFlc3Ryb1xuICAgYWN0aW9uICh1cGxvYWRDbGllbnRQaG90bykuIFBpY2tpbmcgYSBmaWxlIG9wZW5zIGEgc3F1YXJlIHBhbiArIHpvb20gY3JvcHBlclxuICAgKGhhbmQtcm9sbGVkIFx1MjAxNCBubyBDRE4gbGlicmFyaWVzIGhlcmUpOyB0aGUgY3JvcHBlZCBzcXVhcmUgaXMgcmVuZGVyZWQgdG8gYVxuICAgNTEycHggY2FudmFzIGFuZCBzZW50IGFzIGJhc2U2NC4gVGhlIHN0b3JlICsgdmlldyByZWZyZXNoIG9uIHN1Y2Nlc3MuXG4gICBUaGUgZmlsZSBpbnB1dCBjYXJyaWVzIE5PIGBuYW1lYCBhdHRyIChhIG5hbWVkIGNvbnRyb2wgaW5zaWRlIHRoZSBob3N0IGZvcm1cbiAgIHdvdWxkIGJlIHN1Ym1pdHRlZCBcdTIxOTIgXCJwcm9ibGVtIHN0b3JpbmcgdGhlIGRhdGFcIikgYW5kIE5PIGBkYXRhLWtgIChzbyBzYXZlRm9ybVxuICAgbmV2ZXIgdHJpZXMgdG8gcmVhZCBpdCBhcyBhIGZpZWxkIHZhbHVlKS5cbi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuY29uc3QgUEhPVE9fT1VUID0gNTEyOyAgICAgICAgICAgICAgICAgIC8vIHVwbG9hZGVkIHNxdWFyZSBlZGdlLCBweFxuY29uc3QgUEhPVE9fSElOVCA9ICdKUEcsIFBORywgb3IgR0lGLiBZb3UgY2FuIGNyb3AgYW5kIHpvb20gYmVmb3JlIHNhdmluZy4nO1xuXG5mdW5jdGlvbiBwaG90b0VkaXRCbG9jayhjOiBDbGllbnQpOiBzdHJpbmcge1xuICBjb25zdCBoYXMgPSAhIWMucGhvdG9Vcmw7XG4gIGNvbnN0IGZyYW1lID0gaGFzXG4gICAgPyBgPGltZyBzcmM9XCIke2VzYyhjLnBob3RvVXJsIGFzIHN0cmluZyl9XCIgYWx0PVwiJHtlc2MoYy5maXJzdCArICcgJyArIGMubGFzdCl9XCI+YFxuICAgIDogYDxzcGFuIGNsYXNzPVwicGgtaW5pdGlhbHNcIj4ke2VzYyhpbml0aWFscyhjLmZpcnN0LCBjLmxhc3QpKX08L3NwYW4+YDtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwicGhvdG8tZWRpdFwiPlxuICAgIDxkaXYgY2xhc3M9XCJwaG90by1mcmFtZVwiIGlkPVwiX19waG90b0ZyYW1lXCI+JHtmcmFtZX08L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwicGhvdG8tYWN0aW9uc1wiPlxuICAgICAgPGlucHV0IHR5cGU9XCJmaWxlXCIgYWNjZXB0PVwiaW1hZ2UvKlwiIGlkPVwiX19waG90b0lucHV0XCIgaGlkZGVuIG9uY2hhbmdlPVwib25QaG90b0ZpbGVDaGFuZ2UodGhpcylcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJwaG90by1idG5zXCI+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gb3V0bGluZVwiIHR5cGU9XCJidXR0b25cIiBvbmNsaWNrPVwiZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fcGhvdG9JbnB1dCcpLmNsaWNrKClcIj5cbiAgICAgICAgICAke2ljKCdpbWFnZScsIDE1KX0gJHtoYXMgPyAnQ2hhbmdlIHBob3RvJyA6ICdBZGQgcGhvdG8nfVxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgJHtoYXMgPyBgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHR5cGU9XCJidXR0b25cIiBvbmNsaWNrPVwicmVtb3ZlQ2xpZW50UGhvdG8oKVwiPiR7aWMoJ3RyYXNoJywgMTUpfSBSZW1vdmU8L2J1dHRvbj5gIDogJyd9XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJwaG90by1oaW50XCIgaWQ9XCJfX3Bob3RvSGludFwiPiR7UEhPVE9fSElOVH08L2Rpdj5cbiAgICA8L2Rpdj5cbiAgPC9kaXY+YDtcbn1cblxuZnVuY3Rpb24gc2V0UGhvdG9CdXN5KGJ1c3k6IGJvb2xlYW4sIG1zZz86IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCBoaW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fcGhvdG9IaW50Jyk7XG4gIGlmIChoaW50ICYmIG1zZyAhPSBudWxsKSBoaW50LnRleHRDb250ZW50ID0gbXNnO1xuICBjb25zdCBibG9jayA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5waG90by1lZGl0Jyk7XG4gIGlmIChibG9jaykgYmxvY2suY2xhc3NMaXN0LnRvZ2dsZSgnYnVzeScsIGJ1c3kpO1xufVxuXG4vLyBQZXJzaXN0IGFuIHVwZGF0ZWQgcmVjb3JkIGludG8gdGhlIHN0b3JlLCBpbiBwbGFjZSwgYnkgaWQuXG5mdW5jdGlvbiByZWZyZXNoQ2xpZW50SW5TdG9yZShjaWQ6IHN0cmluZywgdXBkYXRlZDogYW55KTogdm9pZCB7XG4gIGlmICghQ0xJRU5UX1NUT1JFKSByZXR1cm47XG4gIGNvbnN0IGlkeCA9IENMSUVOVF9TVE9SRS5tYXAoYyA9PiBjLmlkKS5pbmRleE9mKGNpZCk7XG4gIGlmIChpZHggPj0gMCkgQ0xJRU5UX1NUT1JFW2lkeF0gPSByZWFsVG9DbGllbnQodXBkYXRlZCk7XG59XG5cbi8vIFJlYWQgYSBGaWxlIGludG8gYSBkYXRhOiBVUkwgKHVzZWQgYXMgdGhlIGNyb3BwZXIncyBzb3VyY2UgaW1hZ2UpLlxuZnVuY3Rpb24gZmlsZVRvRGF0YVVybChmaWxlOiBGaWxlKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgIHJlYWRlci5vbmVycm9yID0gKCkgPT4gcmVqZWN0KG5ldyBFcnJvcignQ291bGQgbm90IHJlYWQgdGhlIGZpbGUuJykpO1xuICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiByZXNvbHZlKHJlYWRlci5yZXN1bHQgYXMgc3RyaW5nKTtcbiAgICByZWFkZXIucmVhZEFzRGF0YVVSTChmaWxlKTtcbiAgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG9uUGhvdG9GaWxlQ2hhbmdlKGlucHV0OiBIVE1MSW5wdXRFbGVtZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGNhcmQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19lZGl0Q2FyZCcpO1xuICBjb25zdCBjaWQgPSBjYXJkID8gY2FyZC5nZXRBdHRyaWJ1dGUoJ2RhdGEtY2lkJykgfHwgJycgOiAnJztcbiAgY29uc3QgZmlsZSA9IGlucHV0LmZpbGVzICYmIGlucHV0LmZpbGVzWzBdO1xuICBpbnB1dC52YWx1ZSA9ICcnOyAvLyBsZXQgdGhlIHNhbWUgZmlsZSBiZSByZS1waWNrZWQgbGF0ZXJcbiAgaWYgKCFmaWxlIHx8ICFjaWQpIHJldHVybjtcbiAgaWYgKCEvXmltYWdlXFwvLy50ZXN0KGZpbGUudHlwZSkpIHsgc2V0UGhvdG9CdXN5KGZhbHNlLCAnUGxlYXNlIGNob29zZSBhbiBpbWFnZSBmaWxlIChKUEcsIFBORywgb3IgR0lGKS4nKTsgcmV0dXJuOyB9XG5cbiAgc2V0RWRpdEVycm9yKCcnKTtcbiAgdHJ5IHtcbiAgICBjb25zdCBkYXRhVXJsID0gYXdhaXQgZmlsZVRvRGF0YVVybChmaWxlKTtcbiAgICBvcGVuQ3JvcHBlcihkYXRhVXJsLCBmdW5jdGlvbiAob3V0KSB7IHJldHVybiB1cGxvYWRQaG90b0RhdGFVcmwoY2lkLCBvdXQpOyB9KTtcbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgc2V0RWRpdEVycm9yKGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpKTtcbiAgfVxufVxuXG4vLyBTdHJpcCB0aGUgZGF0YTogcHJlZml4LCBQT1NUIHRoZSBiYXNlNjQgdG8gdGhlIG1hZXN0cm8sIHJlZnJlc2ggKyByZS1yZW5kZXIuXG5hc3luYyBmdW5jdGlvbiB1cGxvYWRQaG90b0RhdGFVcmwoY2lkOiBzdHJpbmcsIGRhdGFVcmw6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBzZXRQaG90b0J1c3kodHJ1ZSwgJ1VwbG9hZGluZyBwaG90b1x1MjAyNicpO1xuICB0cnkge1xuICAgIGNvbnN0IGNvbW1hID0gZGF0YVVybC5pbmRleE9mKCcsJyk7XG4gICAgY29uc3QgYjY0ID0gY29tbWEgPj0gMCA/IGRhdGFVcmwuc2xpY2UoY29tbWEgKyAxKSA6IGRhdGFVcmw7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IGFwaVNldENsaWVudFBob3RvKGNpZCwgYjY0LCAncGhvdG8uanBnJywgJ2ltYWdlL2pwZWcnKTtcbiAgICByZWZyZXNoQ2xpZW50SW5TdG9yZShjaWQsIHVwZGF0ZWQpO1xuICAgIHRvYXN0KCdQaG90byB1cGRhdGVkJyk7XG4gICAgcmVuZGVyKCk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIHNldFBob3RvQnVzeShmYWxzZSwgUEhPVE9fSElOVCk7XG4gICAgc2V0RWRpdEVycm9yKGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiByZW1vdmVDbGllbnRQaG90bygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgY2FyZCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX2VkaXRDYXJkJyk7XG4gIGNvbnN0IGNpZCA9IGNhcmQgPyBjYXJkLmdldEF0dHJpYnV0ZSgnZGF0YS1jaWQnKSB8fCAnJyA6ICcnO1xuICBpZiAoIWNpZCkgcmV0dXJuO1xuICBzZXRFZGl0RXJyb3IoJycpO1xuICBzZXRQaG90b0J1c3kodHJ1ZSwgJ1JlbW92aW5nIHBob3RvXHUyMDI2Jyk7XG4gIHRyeSB7XG4gICAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IGFwaVNldENsaWVudFBob3RvKGNpZCwgJycsICcnLCAnJyk7XG4gICAgcmVmcmVzaENsaWVudEluU3RvcmUoY2lkLCB1cGRhdGVkKTtcbiAgICB0b2FzdCgnUGhvdG8gcmVtb3ZlZCcpO1xuICAgIHJlbmRlcigpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBzZXRQaG90b0J1c3koZmFsc2UsIFBIT1RPX0hJTlQpO1xuICAgIHNldEVkaXRFcnJvcihlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSk7XG4gIH1cbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICBTcXVhcmUgcGFuICsgem9vbSBjcm9wcGVyLiBBIGZpeGVkIFZJRVdcdTAwRDdWSUVXIHN0YWdlIHNob3dzIHRoZSBpbWFnZSBwb3NpdGlvbmVkXG4gICBieSBhIENTUyB0cmFuc2Zvcm0gKHRyYW5zbGF0ZSB0aGVuIHNjYWxlLCBvcmlnaW4gMCwwKS4gRHJhZyBwYW5zOyB0aGUgc2xpZGVyXG4gICBhbmQgd2hlZWwgem9vbSBhcm91bmQgdGhlIHN0YWdlIGNlbnRyZS4gT24gY29uZmlybSB3ZSBtYXAgdGhlIHN0YWdlIGJhY2sgdG9cbiAgIHNvdXJjZSBwaXhlbHMgYW5kIGRyYXdJbWFnZSgpIGEgc3F1YXJlIGNyb3AgaW50byBhIFBIT1RPX09VVCBjYW52YXMuXG4gICBHZW9tZXRyeTogYSBzb3VyY2UgcG9pbnQgcCBtYXBzIHRvIHN0YWdlIHBvaW50IHMgPSB0ICsgcCpzY2FsZSwgc28gdGhlIHZpc2libGVcbiAgIHNvdXJjZSByZWN0IGlzIHN4PS10eC9zY2FsZSwgc3k9LXR5L3NjYWxlLCBzaWRlPVZJRVcvc2NhbGUuXG4tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cbmNvbnN0IENST1BfVklFVyA9IDI4MDsgLy8gb24tc2NyZWVuIGNyb3Agc3RhZ2UgZWRnZSwgcHhcblxuLy8gb25BcHBseSByZWNlaXZlcyB0aGUgY3JvcHBlZCBKUEVHIGRhdGEgVVJMIFx1MjAxNCB0aGUgY2FsbGVyIGRlY2lkZXMgd2hhdCB0byBkb1xuLy8gd2l0aCBpdCAodXBsb2FkIGltbWVkaWF0ZWx5LCBvciBidWZmZXIgaXQgZm9yIGEgbGF0ZXIgc2F2ZSkuIFRoaXMgaXMgdGhlIHNlYW1cbi8vIHRoYXQgbGV0cyB0aGUgc2FtZSBjcm9wcGVyIHNlcnZlIHRoZSBjbGllbnQgcGhvdG8gQU5EIGNvbnRhY3QgcGhvdG9zLlxuaW50ZXJmYWNlIENyb3BTdGF0ZSB7XG4gIGltZzogSFRNTEltYWdlRWxlbWVudDsgb25BcHBseTogKGRhdGFVcmw6IHN0cmluZykgPT4gYW55O1xuICBzY2FsZTogbnVtYmVyOyBtaW5TY2FsZTogbnVtYmVyOyBtYXhTY2FsZTogbnVtYmVyO1xuICB0eDogbnVtYmVyOyB0eTogbnVtYmVyO1xuICBkcmFnOiB7IGFjdGl2ZTogYm9vbGVhbjsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHR4OiBudW1iZXI7IHR5OiBudW1iZXIgfTtcbn1cbmxldCBDUk9QOiBDcm9wU3RhdGUgfCBudWxsID0gbnVsbDtcblxuZnVuY3Rpb24gb3BlbkNyb3BwZXIoZGF0YVVybDogc3RyaW5nLCBvbkFwcGx5OiAoZGF0YVVybDogc3RyaW5nKSA9PiBhbnkpOiB2b2lkIHtcbiAgY29uc3QgaW1nID0gbmV3IEltYWdlKCk7XG4gIGltZy5vbmVycm9yID0gKCkgPT4geyBzZXRFZGl0RXJyb3IoJ1RoYXQgaW1hZ2UgY291bGQgbm90IGJlIGxvYWRlZC4nKTsgfTtcbiAgaW1nLm9ubG9hZCA9ICgpID0+IHtcbiAgICBjb25zdCBpdyA9IGltZy5uYXR1cmFsV2lkdGggfHwgaW1nLndpZHRoO1xuICAgIGNvbnN0IGloID0gaW1nLm5hdHVyYWxIZWlnaHQgfHwgaW1nLmhlaWdodDtcbiAgICBpZiAoIWl3IHx8ICFpaCkgeyBzZXRFZGl0RXJyb3IoJ1RoYXQgaW1hZ2UgaGFzIG5vIGRpbWVuc2lvbnMuJyk7IHJldHVybjsgfVxuICAgIGNvbnN0IG1pblNjYWxlID0gQ1JPUF9WSUVXIC8gTWF0aC5taW4oaXcsIGloKTsgICAvLyBzbWFsbGVzdCBzY2FsZSB0aGF0IHN0aWxsIGNvdmVycyB0aGUgc3F1YXJlXG4gICAgQ1JPUCA9IHtcbiAgICAgIGltZywgb25BcHBseSxcbiAgICAgIHNjYWxlOiBtaW5TY2FsZSwgbWluU2NhbGUsIG1heFNjYWxlOiBtaW5TY2FsZSAqIDUsXG4gICAgICB0eDogKENST1BfVklFVyAtIGl3ICogbWluU2NhbGUpIC8gMixcbiAgICAgIHR5OiAoQ1JPUF9WSUVXIC0gaWggKiBtaW5TY2FsZSkgLyAyLFxuICAgICAgZHJhZzogeyBhY3RpdmU6IGZhbHNlLCB4OiAwLCB5OiAwLCB0eDogMCwgdHk6IDAgfSxcbiAgICB9O1xuICAgIG1vdW50Q3JvcHBlcigpO1xuICB9O1xuICBpbWcuc3JjID0gZGF0YVVybDtcbn1cblxuZnVuY3Rpb24gY3JvcE1vZGFsSHRtbCgpOiBzdHJpbmcge1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJtb2RhbC1jYXJkIGNyb3AtY2FyZFwiIHJvbGU9XCJkaWFsb2dcIiBhcmlhLW1vZGFsPVwidHJ1ZVwiIGFyaWEtbGFiZWw9XCJDcm9wIHBob3RvXCI+XG4gICAgPGRpdiBjbGFzcz1cIm1vZGFsLWhlYWRcIj5cbiAgICAgIDxkaXY+PGI+Q3JvcCBwaG90bzwvYj48cD5EcmFnIHRvIHJlcG9zaXRpb24sIHNsaWRlIHRvIHpvb20gaW4gb24gdGhlIGZhY2UuPC9wPjwvZGl2PlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImljby14XCIgdGl0bGU9XCJDbG9zZVwiIG9uY2xpY2s9XCJjbG9zZUNyb3BwZXIoKVwiPiR7aWMoJ3gnLCAxOCl9PC9idXR0b24+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cIm1vZGFsLWJvZHkgY3JvcC1ib2R5XCI+XG4gICAgICA8ZGl2IGNsYXNzPVwibW9kYWwtZXJyXCIgaGlkZGVuPjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImNyb3Atc3RhZ2VcIiBpZD1cIl9fY3JvcFN0YWdlXCIgc3R5bGU9XCJ3aWR0aDoke0NST1BfVklFV31weDtoZWlnaHQ6JHtDUk9QX1ZJRVd9cHhcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImNyb3AtaW1nLXdyYXBcIiBpZD1cIl9fY3JvcEltZ1dyYXBcIj48L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImNyb3AtcmluZ1wiPjwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiY3JvcC16b29tXCI+XG4gICAgICAgICR7aWMoJ2ltYWdlJywgMTQpfVxuICAgICAgICA8aW5wdXQgdHlwZT1cInJhbmdlXCIgaWQ9XCJfX2Nyb3Bab29tXCIgbWluPVwiMFwiIG1heD1cIjEwMDBcIiB2YWx1ZT1cIjBcIiBvbmlucHV0PVwib25Dcm9wWm9vbSh0aGlzKVwiIGFyaWEtbGFiZWw9XCJab29tXCI+XG4gICAgICAgICR7aWMoJ3NlYXJjaCcsIDE1KX1cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1mb290XCI+XG4gICAgICA8c3BhbiBjbGFzcz1cIm1vZGFsLXN0YXR1c1wiPjwvc3Bhbj5cbiAgICAgIDxzcGFuIHN0eWxlPVwiZmxleDoxXCI+PC9zcGFuPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIG9uY2xpY2s9XCJjbG9zZUNyb3BwZXIoKVwiPiR7aWMoJ3gnLCAxNSl9IENhbmNlbDwvYnV0dG9uPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBwcmltYXJ5XCIgb25jbGljaz1cImFwcGx5Q3JvcCgpXCI+JHtpYygnY2hlY2snLCAxNSl9IFVzZSBwaG90bzwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICA8L2Rpdj5gO1xufVxuXG5mdW5jdGlvbiBtb3VudENyb3BwZXIoKTogdm9pZCB7XG4gIGlmICghQ1JPUCkgcmV0dXJuO1xuICBpZiAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fY3JvcE1vZGFsJykpIGNsb3NlQ3JvcHBlcigpO1xuICBjb25zdCBob3N0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGhvc3QuY2xhc3NOYW1lID0gJ21vZGFsLW92ZXJsYXknO1xuICBob3N0LmlkID0gJ19fY3JvcE1vZGFsJztcbiAgaG9zdC5pbm5lckhUTUwgPSBjcm9wTW9kYWxIdG1sKCk7XG4gIGhvc3QuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgZSA9PiB7IGlmIChlLnRhcmdldCA9PT0gaG9zdCkgY2xvc2VDcm9wcGVyKCk7IH0pO1xuICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGhvc3QpO1xuXG4gIGNvbnN0IHdyYXAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19jcm9wSW1nV3JhcCcpIGFzIEhUTUxFbGVtZW50O1xuICBjb25zdCBpbWcgPSBDUk9QLmltZztcbiAgaW1nLmRyYWdnYWJsZSA9IGZhbHNlO1xuICBpbWcuY2xhc3NOYW1lID0gJ2Nyb3AtaW1nJztcbiAgaW1nLnN0eWxlLndpZHRoID0gKGltZy5uYXR1cmFsV2lkdGggfHwgaW1nLndpZHRoKSArICdweCc7XG4gIGltZy5zdHlsZS5oZWlnaHQgPSAoaW1nLm5hdHVyYWxIZWlnaHQgfHwgaW1nLmhlaWdodCkgKyAncHgnO1xuICB3cmFwLmFwcGVuZENoaWxkKGltZyk7XG4gIGFwcGx5Q3JvcFRyYW5zZm9ybSgpO1xuXG4gIGNvbnN0IHN0YWdlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fY3JvcFN0YWdlJykgYXMgSFRNTEVsZW1lbnQ7XG4gIHN0YWdlLmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJkb3duJywgY3JvcFBvaW50ZXJEb3duKTtcbiAgc3RhZ2UuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcm1vdmUnLCBjcm9wUG9pbnRlck1vdmUpO1xuICBzdGFnZS5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVydXAnLCBjcm9wUG9pbnRlclVwKTtcbiAgc3RhZ2UuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcmNhbmNlbCcsIGNyb3BQb2ludGVyVXApO1xuICBzdGFnZS5hZGRFdmVudExpc3RlbmVyKCd3aGVlbCcsIGNyb3BXaGVlbCwgeyBwYXNzaXZlOiBmYWxzZSB9KTtcblxuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgY3JvcEVzY0Nsb3NlKTtcbn1cblxuZnVuY3Rpb24gYXBwbHlDcm9wVHJhbnNmb3JtKCk6IHZvaWQge1xuICBpZiAoIUNST1ApIHJldHVybjtcbiAgQ1JPUC5pbWcuc3R5bGUudHJhbnNmb3JtID0gYHRyYW5zbGF0ZSgke0NST1AudHh9cHgsICR7Q1JPUC50eX1weCkgc2NhbGUoJHtDUk9QLnNjYWxlfSlgO1xufVxuXG5mdW5jdGlvbiBjbGFtcENyb3BQYW4oKTogdm9pZCB7XG4gIGlmICghQ1JPUCkgcmV0dXJuO1xuICBjb25zdCB3ID0gKENST1AuaW1nLm5hdHVyYWxXaWR0aCB8fCBDUk9QLmltZy53aWR0aCkgKiBDUk9QLnNjYWxlO1xuICBjb25zdCBoID0gKENST1AuaW1nLm5hdHVyYWxIZWlnaHQgfHwgQ1JPUC5pbWcuaGVpZ2h0KSAqIENST1Auc2NhbGU7XG4gIENST1AudHggPSBNYXRoLm1pbigwLCBNYXRoLm1heChDUk9QX1ZJRVcgLSB3LCBDUk9QLnR4KSk7XG4gIENST1AudHkgPSBNYXRoLm1pbigwLCBNYXRoLm1heChDUk9QX1ZJRVcgLSBoLCBDUk9QLnR5KSk7XG59XG5cbi8vIFNldCB6b29tIHdoaWxlIGtlZXBpbmcgdGhlIHN0YWdlLWNlbnRyZSBwb2ludCBmaXhlZCBpbiB0aGUgaW1hZ2UuXG5mdW5jdGlvbiBzZXRDcm9wU2NhbGUobmV4dDogbnVtYmVyKTogdm9pZCB7XG4gIGlmICghQ1JPUCkgcmV0dXJuO1xuICBjb25zdCBzID0gTWF0aC5taW4oQ1JPUC5tYXhTY2FsZSwgTWF0aC5tYXgoQ1JPUC5taW5TY2FsZSwgbmV4dCkpO1xuICBjb25zdCBjID0gQ1JPUF9WSUVXIC8gMjtcbiAgY29uc3QgcHggPSAoYyAtIENST1AudHgpIC8gQ1JPUC5zY2FsZTtcbiAgY29uc3QgcHkgPSAoYyAtIENST1AudHkpIC8gQ1JPUC5zY2FsZTtcbiAgQ1JPUC5zY2FsZSA9IHM7XG4gIENST1AudHggPSBjIC0gcHggKiBzO1xuICBDUk9QLnR5ID0gYyAtIHB5ICogcztcbiAgY2xhbXBDcm9wUGFuKCk7XG4gIGFwcGx5Q3JvcFRyYW5zZm9ybSgpO1xufVxuXG5mdW5jdGlvbiBzeW5jQ3JvcFNsaWRlcigpOiB2b2lkIHtcbiAgaWYgKCFDUk9QKSByZXR1cm47XG4gIGNvbnN0IHNsaWRlciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX2Nyb3Bab29tJykgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XG4gIGlmICghc2xpZGVyKSByZXR1cm47XG4gIGNvbnN0IGZyYWMgPSAoQ1JPUC5zY2FsZSAtIENST1AubWluU2NhbGUpIC8gKENST1AubWF4U2NhbGUgLSBDUk9QLm1pblNjYWxlIHx8IDEpO1xuICBzbGlkZXIudmFsdWUgPSBTdHJpbmcoTWF0aC5yb3VuZChmcmFjICogMTAwMCkpO1xufVxuXG5mdW5jdGlvbiBvbkNyb3Bab29tKHNsaWRlcjogSFRNTElucHV0RWxlbWVudCk6IHZvaWQge1xuICBpZiAoIUNST1ApIHJldHVybjtcbiAgY29uc3QgZnJhYyA9IE51bWJlcihzbGlkZXIudmFsdWUpIC8gMTAwMDtcbiAgc2V0Q3JvcFNjYWxlKENST1AubWluU2NhbGUgKyBmcmFjICogKENST1AubWF4U2NhbGUgLSBDUk9QLm1pblNjYWxlKSk7XG59XG5cbmZ1bmN0aW9uIGNyb3BQb2ludGVyRG93bihlOiBQb2ludGVyRXZlbnQpOiB2b2lkIHtcbiAgaWYgKCFDUk9QKSByZXR1cm47XG4gIENST1AuZHJhZyA9IHsgYWN0aXZlOiB0cnVlLCB4OiBlLmNsaWVudFgsIHk6IGUuY2xpZW50WSwgdHg6IENST1AudHgsIHR5OiBDUk9QLnR5IH07XG4gIChlLmN1cnJlbnRUYXJnZXQgYXMgSFRNTEVsZW1lbnQpLnNldFBvaW50ZXJDYXB0dXJlKGUucG9pbnRlcklkKTtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpO1xufVxuZnVuY3Rpb24gY3JvcFBvaW50ZXJNb3ZlKGU6IFBvaW50ZXJFdmVudCk6IHZvaWQge1xuICBpZiAoIUNST1AgfHwgIUNST1AuZHJhZy5hY3RpdmUpIHJldHVybjtcbiAgQ1JPUC50eCA9IENST1AuZHJhZy50eCArIChlLmNsaWVudFggLSBDUk9QLmRyYWcueCk7XG4gIENST1AudHkgPSBDUk9QLmRyYWcudHkgKyAoZS5jbGllbnRZIC0gQ1JPUC5kcmFnLnkpO1xuICBjbGFtcENyb3BQYW4oKTtcbiAgYXBwbHlDcm9wVHJhbnNmb3JtKCk7XG59XG5mdW5jdGlvbiBjcm9wUG9pbnRlclVwKF9lOiBQb2ludGVyRXZlbnQpOiB2b2lkIHtcbiAgaWYgKENST1ApIENST1AuZHJhZy5hY3RpdmUgPSBmYWxzZTtcbn1cbmZ1bmN0aW9uIGNyb3BXaGVlbChlOiBXaGVlbEV2ZW50KTogdm9pZCB7XG4gIGlmICghQ1JPUCkgcmV0dXJuO1xuICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIHNldENyb3BTY2FsZShDUk9QLnNjYWxlICogKGUuZGVsdGFZIDwgMCA/IDEuMDggOiAxIC8gMS4wOCkpO1xuICBzeW5jQ3JvcFNsaWRlcigpO1xufVxuXG5mdW5jdGlvbiBjcm9wRXNjQ2xvc2UoZTogS2V5Ym9hcmRFdmVudCk6IHZvaWQgeyBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSBjbG9zZUNyb3BwZXIoKTsgfVxuXG5mdW5jdGlvbiBjbG9zZUNyb3BwZXIoKTogdm9pZCB7XG4gIGNvbnN0IG0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19jcm9wTW9kYWwnKTtcbiAgaWYgKG0pIG0ucmVtb3ZlKCk7XG4gIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBjcm9wRXNjQ2xvc2UpO1xuICBDUk9QID0gbnVsbDtcbn1cblxuLy8gUmVuZGVyIHRoZSB2aXNpYmxlIHNxdWFyZSB0byBhIFBIT1RPX09VVCBjYW52YXMgYW5kIGhhbmQgaXQgdG8gb25BcHBseS5cbmFzeW5jIGZ1bmN0aW9uIGFwcGx5Q3JvcCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKCFDUk9QKSByZXR1cm47XG4gIGNvbnN0IHsgaW1nLCBzY2FsZSwgdHgsIHR5LCBvbkFwcGx5IH0gPSBDUk9QO1xuICBjb25zdCBzeCA9IC10eCAvIHNjYWxlLCBzeSA9IC10eSAvIHNjYWxlLCBzaWRlID0gQ1JPUF9WSUVXIC8gc2NhbGU7XG4gIGNvbnN0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICBjYW52YXMud2lkdGggPSBQSE9UT19PVVQ7IGNhbnZhcy5oZWlnaHQgPSBQSE9UT19PVVQ7XG4gIGNvbnN0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICBpZiAoIWN0eCkgeyBzZXRDcm9wTW9kYWxFcnJvcignQ2FudmFzIGlzIHVuYXZhaWxhYmxlIGluIHRoaXMgYnJvd3Nlci4nKTsgcmV0dXJuOyB9XG4gIGN0eC5maWxsU3R5bGUgPSAnI2ZmZic7XG4gIGN0eC5maWxsUmVjdCgwLCAwLCBQSE9UT19PVVQsIFBIT1RPX09VVCk7XG4gIGN0eC5kcmF3SW1hZ2UoaW1nLCBzeCwgc3ksIHNpZGUsIHNpZGUsIDAsIDAsIFBIT1RPX09VVCwgUEhPVE9fT1VUKTtcbiAgbGV0IGRhdGFVcmw6IHN0cmluZztcbiAgdHJ5IHsgZGF0YVVybCA9IGNhbnZhcy50b0RhdGFVUkwoJ2ltYWdlL2pwZWcnLCAwLjkpOyB9XG4gIGNhdGNoIChlOiBhbnkpIHsgc2V0Q3JvcE1vZGFsRXJyb3IoZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpOyByZXR1cm47IH1cbiAgY2xvc2VDcm9wcGVyKCk7XG4gIGF3YWl0IG9uQXBwbHkoZGF0YVVybCk7XG59XG5cbmZ1bmN0aW9uIHNldENyb3BNb2RhbEVycm9yKG1zZzogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI19fY3JvcE1vZGFsIC5tb2RhbC1lcnInKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmICghZWwpIHJldHVybjtcbiAgaWYgKG1zZykgeyBlbC50ZXh0Q29udGVudCA9IG1zZzsgZWwuaGlkZGVuID0gZmFsc2U7IH0gZWxzZSB7IGVsLnRleHRDb250ZW50ID0gJyc7IGVsLmhpZGRlbiA9IHRydWU7IH1cbn1cblxuLy8gSG9uZXN0IHBsYWNlaG9sZGVyIGZvciByZWNvcmQgc2VjdGlvbnMgdGhhdCBoYXZlIG5vIGJhY2tpbmcgZm9ybSB5ZXQuXG5mdW5jdGlvbiB1bmRlckNvbnN0cnVjdGlvbihsYWJlbDogc3RyaW5nLCBub3RlOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBtc2cgPSBub3RlIHx8IFwiVGhpcyBzZWN0aW9uIGRvZXNuJ3QgaGF2ZSBhIGJhY2tpbmcgZm9ybSB5ZXQgXHUyMDE0IGl0J2xsIGxpZ2h0IHVwIG9uY2UgdGhlIGRhdGEgbW9kZWwgaXMgYnVpbHQuXCI7XG4gIHJldHVybiBgPGRpdiBjbGFzcz1cInNlY3Rpb24taGVhZFwiPjxkaXY+PGgzPiR7ZXNjKGxhYmVsKX08L2gzPjxwPk5vdCB5ZXQgd2lyZWQgdG8gbGl2ZSBkYXRhLjwvcD48L2Rpdj48L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eSB1Y1wiPlxuICAgICAgPGRpdiBjbGFzcz1cImljb1wiPiR7aWMoJ3NldHRpbmdzJywgMjQpfTwvZGl2PlxuICAgICAgPGI+VW5kZXIgY29uc3RydWN0aW9uPC9iPlxuICAgICAgPHA+JHtlc2MobXNnKX08L3A+XG4gICAgICA8c3BhbiBjbGFzcz1cInVjLXRhZ1wiPkNvbWluZyBzb29uPC9zcGFuPlxuICAgIDwvZGl2PjwvZGl2PmA7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFxQkEsTUFBTSxhQUE4QztBQUFBLEVBQ2xELE1BQU07QUFBQSxJQUNKLEtBQUs7QUFBQSxJQUFRLE9BQU87QUFBQSxJQUFnQixNQUFNO0FBQUEsSUFDMUMsUUFBUTtBQUFBLE1BQ04sRUFBRSxHQUFHLGFBQWEsT0FBTyxjQUFjLEtBQUssS0FBSztBQUFBLE1BQ2pELEVBQUUsR0FBRyxZQUFZLE9BQU8sYUFBYSxLQUFLLEtBQUs7QUFBQSxNQUMvQyxFQUFFLEdBQUcsWUFBWSxPQUFPLGlCQUFpQjtBQUFBLE1BQ3pDLEVBQUUsR0FBRyxTQUFTLE9BQU8sU0FBUyxNQUFNLFNBQVMsTUFBTSxNQUFNLGFBQWEsbUJBQW1CO0FBQUEsSUFDM0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixLQUFLO0FBQUEsSUFBZ0IsT0FBTztBQUFBLElBQWdCLE1BQU07QUFBQSxJQUNsRCxRQUFRO0FBQUEsTUFDTixFQUFFLEdBQUcsT0FBTyxPQUFPLGlCQUFpQixNQUFNLE9BQU87QUFBQSxNQUNqRCxFQUFFLEdBQUcsT0FBTyxPQUFPLHlCQUF5QixNQUFNLFVBQVUsWUFBWSxNQUFNO0FBQUEsTUFDOUUsRUFBRSxHQUFHLFVBQVUsT0FBTyxtQkFBbUIsTUFBTSxVQUFVLFlBQVksU0FBUztBQUFBLE1BQzlFLEVBQUUsR0FBRyxlQUFlLE9BQU8sMEJBQTBCO0FBQUEsTUFDckQsRUFBRSxHQUFHLFlBQVksT0FBTyxzQkFBc0IsTUFBTSxVQUFVLFlBQVksV0FBVztBQUFBLE1BQ3JGLEVBQUUsR0FBRyxpQkFBaUIsT0FBTyxtQkFBbUI7QUFBQSxNQUNoRCxFQUFFLEdBQUcsUUFBUSxPQUFPLFFBQVEsTUFBTSxTQUFTLFlBQVksUUFBUSxN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
