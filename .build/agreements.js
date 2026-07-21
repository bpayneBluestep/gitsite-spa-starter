const AGR_CACHE = {};
let AGR_TEMPLATES = null;
function agrState(cid) {
  if (!AGR_CACHE[cid]) AGR_CACHE[cid] = { list: null, loading: false, error: null };
  return AGR_CACHE[cid];
}
async function loadAgreements(cid, force = false) {
  const st = agrState(cid);
  if (st.loading) return;
  if (st.list && !force) return;
  st.loading = true;
  st.error = null;
  try {
    const rows = await apiListAgreements(cid);
    st.list = (rows || []).slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  } catch (e) {
    st.error = e && e.message ? e.message : String(e);
  }
  st.loading = false;
  if (location.hash.indexOf("/agreements") >= 0) render();
}
function agrStatusClass(s) {
  if (s === "Completed") return "ok";
  if (s === "Voided" || s === "Declined") return "muted";
  if (s === "Partially Signed") return "warn";
  if (s === "Sent") return "info";
  return "draft";
}
function signerProgress(a) {
  const total = (a.signers || []).length;
  const signed = (a.signers || []).filter((s) => s.status === "signed").length;
  return signed + "/" + total + " signed";
}
function agreementsSection(c) {
  const st = agrState(c.id);
  if (st.list === null) {
    if (!st.loading && !st.error) loadAgreements(c.id);
    return sectionHead("Agreements", "E-signature agreements for " + esc(c.first) + ".") + (st.error ? errorCard(st.error) : loadingCard("Loading agreements\u2026"));
  }
  const head = `<div class="section-head"><div><h3>Agreements</h3><p>Send templates for e-signature and track who has signed.</p></div>
    <button class="btn primary" onclick="agrOpenNew('${esc(c.id)}')">${ic("plus", 15)} New agreement</button></div>`;
  if (!st.list.length) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic("fileText", 22)}</div><b>No agreements yet</b>
      <p>Create one from a template to send for signature.</p></div></div>`;
  }
  const cards = st.list.map((a) => {
    const cls = agrStatusClass(a.status);
    const signers = (a.signers || []).map((s) => {
      const badge = s.status === "signed" ? `<span class="agr-s-ok">${ic("check", 12)} signed</span>` : s.status === "declined" ? `<span class="agr-s-no">declined</span>` : s.kind === "consultant" ? `<span class="agr-s-wait">awaiting you</span>` : `<span class="agr-s-wait">pending</span>`;
      return `<div class="agr-signer"><span class="agr-s-name">${esc(s.name || s.role)}${s.kind === "consultant" ? ' <span class="muted">(you)</span>' : ""}</span>${badge}</div>`;
    }).join("");
    const actions = [];
    const consultantPending = (a.signers || []).some((s) => s.kind === "consultant" && s.status !== "signed" && s.status !== "declined");
    if ((a.status === "Sent" || a.status === "Partially Signed") && consultantPending) actions.push(`<button class="btn primary sm" onclick="agrSignSelf('${esc(c.id)}','${esc(a.entryId)}')">${ic("pen", 14)} Sign now</button>`);
    if (a.status === "Draft") actions.push(`<button class="btn primary sm" onclick="agrSend('${esc(c.id)}','${esc(a.entryId)}')">${ic("mail", 14)} Send</button>`);
    if (a.status === "Sent" || a.status === "Partially Signed") actions.push(`<button class="btn outline sm" onclick="agrSend('${esc(c.id)}','${esc(a.entryId)}')">${ic("mail", 14)} Resend / links</button>`);
    if (a.status === "Completed" && a.signedPdf) actions.push(`<a class="btn primary sm" href="${esc(a.signedPdf)}" target="_blank" rel="noopener">${ic("download", 14)} Signed PDF</a>`);
    else if (a.status === "Completed") actions.push(`<button class="btn outline sm" onclick="agrGetPdf('${esc(c.id)}','${esc(a.entryId)}',this)" title="The signed PDF is being generated in the background; click to check if it's ready.">${ic("download", 14)} PDF generating\u2026</button>`);
    if (a.status !== "Completed" && a.status !== "Voided") actions.push(`<button class="btn ghost sm" onclick="agrVoid('${esc(c.id)}','${esc(a.entryId)}')">${ic("trash", 14)} Void</button>`);
    const linksBlock = a.links && a.links.length ? `<div class="agr-links">${a.links.filter((l) => l.kind === "external" && l.link).map((l) => `<div class="agr-link-row"><span>${esc(l.name || l.role)}</span><input readonly value="${esc(l.link)}" onclick="this.select()"><button class="btn ghost sm" onclick="agrCopy('${esc(l.link)}')">Copy</button></div>`).join("")}</div>` : "";
    return `<div class="card agr-card">
      <div class="agr-top">
        <div><b>${esc(a.title)}</b><div class="agr-sub">${esc(a.templateName || "")} \xB7 ${signerProgress(a)}</div></div>
        <span class="pill ${cls}">${esc(a.status)}</span>
      </div>
      <div class="agr-signers">${signers}</div>
      ${linksBlock}
      <div class="agr-actions">${actions.join("")}</div>
    </div>`;
  }).join("");
  return head + `<div class="agr-list">${cards}</div>`;
}
function sectionHead(title, desc) {
  return `<div class="section-head"><div><h3>${esc(title)}</h3><p>${esc(desc)}</p></div></div>`;
}
async function agrOpenNew(cid) {
  if (document.getElementById("__agrModal")) return;
  if (AGR_TEMPLATES === null) {
    try {
      AGR_TEMPLATES = (await apiListAgreementTemplates() || []).filter((t) => (t.status || "") === "Active");
    } catch (e) {
      AGR_TEMPLATES = [];
    }
  }
  const host = document.createElement("div");
  host.className = "modal-overlay";
  host.id = "__agrModal";
  host.innerHTML = agrModalHtml(cid);
  host.addEventListener("mousedown", (e) => {
    if (e.target === host) agrCloseNew();
  });
  document.body.appendChild(host);
  document.addEventListener("keydown", agrEsc);
}
function agrEsc(e) {
  if (e.key === "Escape") agrCloseNew();
}
function agrCloseNew() {
  const m = document.getElementById("__agrModal");
  if (m) m.remove();
  document.removeEventListener("keydown", agrEsc);
}
function agrModalHtml(cid) {
  const opts = (AGR_TEMPLATES || []).map((t) => `<option value="${esc(t.entryId)}">${esc(t.name)}</option>`).join("");
  const picker = AGR_TEMPLATES && AGR_TEMPLATES.length ? `<select data-k="templateRef" onchange="agrTemplatePicked('${esc(cid)}')"><option value="">Choose a template\u2026</option>${opts}</select>` : `<div class="muted">No Active templates yet. Create one in <b>Settings \u25B8 Agreements</b>.</div>`;
  return `<div class="modal-card" role="dialog" aria-modal="true" aria-label="New agreement">
    <div class="modal-head"><div><b>New Agreement</b><p>Pick a template and assign signers.</p></div>
      <button class="ico-x" onclick="agrCloseNew()">${ic("x", 18)}</button></div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <div class="field full"><label>Template</label>${picker}</div>
      <div class="field full"><label>Title</label><input data-k="title" placeholder="e.g. Engagement Agreement \u2014 Chen"></div>
      <div id="agr-signers-wrap"></div>
    </div>
    <div class="modal-foot"><span class="modal-status"></span><span style="flex:1"></span>
      <button class="btn ghost" onclick="agrCloseNew()">${ic("x", 15)} Cancel</button>
      <button class="btn primary" onclick="agrCreateSubmit('${esc(cid)}')" id="agr-create-btn" disabled>${ic("plus", 15)} Create</button>
    </div>
  </div>`;
}
function agrTemplatePicked(cid) {
  const modal = document.getElementById("__agrModal");
  if (!modal) return;
  const sel = modal.querySelector('select[data-k="templateRef"]');
  const wrap = modal.querySelector("#agr-signers-wrap");
  const btn = modal.querySelector("#agr-create-btn");
  const titleInput = modal.querySelector('input[data-k="title"]');
  if (!sel || !wrap) return;
  const tpl = (AGR_TEMPLATES || []).find((t) => t.entryId === sel.value);
  if (!tpl) {
    wrap.innerHTML = "";
    if (btn) btn.disabled = true;
    return;
  }
  if (titleInput && !titleInput.value) titleInput.value = tpl.name || "Agreement";
  const roles = tpl.bodyJson && Array.isArray(tpl.bodyJson.roles) ? tpl.bodyJson.roles : [];
  const me = typeof SESSION !== "undefined" && SESSION && SESSION.fullName ? SESSION.fullName : ME.first + " " + ME.last;
  wrap.innerHTML = '<div class="agr-roles-h">Signers</div>' + roles.map((r, i) => {
    if (r.kind === "consultant") {
      return `<div class="agr-role" data-role="${esc(r.id)}" data-kind="consultant" data-name="${esc(me)}">
        <div class="agr-role-label">${esc(r.label || r.id)} <span class="muted">\u2014 you (${esc(me)}), sign in-app</span></div></div>`;
    }
    return `<div class="agr-role" data-role="${esc(r.id)}" data-kind="external">
      <div class="agr-role-label">${esc(r.label || r.id)}</div>
      <div class="agr-role-inputs">
        <input data-rk="name" placeholder="Full name">
        <input data-rk="email" placeholder="email@example.com" oninput="agrValidate()">
      </div></div>`;
  }).join("");
  agrValidate();
}
function agrValidate() {
  const modal = document.getElementById("__agrModal");
  if (!modal) return;
  const btn = modal.querySelector("#agr-create-btn");
  const roles = Array.from(modal.querySelectorAll(".agr-role"));
  let ok = roles.length > 0;
  roles.forEach((r) => {
    if (r.getAttribute("data-kind") === "external") {
      const email = r.querySelector('input[data-rk="email"]');
      const name = r.querySelector('input[data-rk="name"]');
      if (!email || !name || !name.value.trim() || !/.+@.+\..+/.test(email.value.trim())) ok = false;
    }
  });
  if (btn) btn.disabled = !ok;
}
async function agrCreateSubmit(cid) {
  const modal = document.getElementById("__agrModal");
  if (!modal) return;
  const sel = modal.querySelector('select[data-k="templateRef"]');
  const titleInput = modal.querySelector('input[data-k="title"]');
  const status = modal.querySelector(".modal-status");
  const err = modal.querySelector(".modal-err");
  if (!sel || !sel.value) {
    if (err) {
      err.textContent = "Pick a template.";
      err.hidden = false;
    }
    return;
  }
  const roles = Array.from(modal.querySelectorAll(".agr-role"));
  const signers = roles.map((r, i) => {
    const kind = r.getAttribute("data-kind") || "external";
    if (kind === "consultant") return { role: r.getAttribute("data-role"), name: r.getAttribute("data-name") || "", email: "", kind: "consultant", order: i + 1 };
    return {
      role: r.getAttribute("data-role"),
      name: r.querySelector('input[data-rk="name"]').value.trim(),
      email: r.querySelector('input[data-rk="email"]').value.trim(),
      kind: "external",
      order: i + 1
    };
  });
  if (err) err.hidden = true;
  if (status) status.textContent = "Creating\u2026";
  try {
    await apiCreateAgreement(cid, sel.value, titleInput ? titleInput.value.trim() : "", signers);
    agrCloseNew();
    await loadAgreements(cid, true);
    toast("Agreement created \u2014 send it when ready.");
  } catch (e) {
    if (status) status.textContent = "";
    if (err) {
      err.textContent = e && e.message ? e.message : String(e);
      err.hidden = false;
    }
  }
}
async function agrSend(cid, entryId) {
  try {
    const res = await apiSendAgreement(cid, entryId);
    const st = agrState(cid);
    if (st.list) {
      const i = st.list.findIndex((a) => a.entryId === entryId);
      if (i >= 0) st.list[i] = res;
    }
    render();
    toast("Agreement sent \u2014 signing links emailed.");
  } catch (e) {
    toast("Send failed: " + (e && e.message ? e.message : String(e)));
  }
}
async function agrVoid(cid, entryId) {
  if (!window.confirm("Void this agreement? Signers will no longer be able to sign. This can't be undone.")) return;
  try {
    await apiVoidAgreement(cid, entryId, "");
    await loadAgreements(cid, true);
    toast("Agreement voided.");
  } catch (e) {
    toast("Void failed: " + (e && e.message ? e.message : String(e)));
  }
}
function agrCopy(link) {
  try {
    navigator.clipboard.writeText(link);
    toast("Link copied.");
  } catch (_e) {
    toast("Copy failed \u2014 select the text manually.");
  }
}
async function agrGetPdf(cid, entryId, btn) {
  const orig = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "Checking\u2026";
  }
  try {
    const a = await apiGetAgreement(cid, entryId);
    if (a && a.signedPdf) {
      window.open(a.signedPdf, "_blank");
    } else {
      toast("Your signed PDF is being generated in the background \u2014 it should appear here within a few minutes. Check back shortly.");
    }
  } catch (e) {
    toast("Could not check the signed PDF right now \u2014 please try again in a moment.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  }
}
let AGR_SIGN_DRAWN = false;
function agrSignSelf(cid, entryId) {
  if (document.getElementById("__agrSignModal")) return;
  AGR_SIGN_DRAWN = false;
  const host = document.createElement("div");
  host.className = "modal-overlay";
  host.id = "__agrSignModal";
  host.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="Sign agreement">
    <div class="modal-head"><div><b>Sign this agreement</b><p>Draw your signature to adopt it.</p></div>
      <button class="ico-x" onclick="agrSignClose()">${ic("x", 18)}</button></div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <canvas id="agr-sign-pad" class="pl-sig" width="440" height="150" style="width:100%"></canvas>
      <div style="margin-top:8px"><button class="btn outline sm" onclick="agrSignClear()">${ic("trash", 13)} Clear</button></div>
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;margin-top:12px">
        <input type="checkbox" id="agr-sign-consent" style="margin-top:3px"> I adopt this signature and agree it is legally binding.</label>
    </div>
    <div class="modal-foot"><span class="modal-status"></span><span style="flex:1"></span>
      <button class="btn ghost" onclick="agrSignClose()">${ic("x", 15)} Cancel</button>
      <button class="btn primary" onclick="agrSignSubmit('${esc(cid)}','${esc(entryId)}')">${ic("pen", 15)} Adopt &amp; Sign</button></div>
  </div>`;
  host.addEventListener("mousedown", (e) => {
    if (e.target === host) agrSignClose();
  });
  document.body.appendChild(host);
  agrSignSetupPad();
}
function agrSignClose() {
  const m = document.getElementById("__agrSignModal");
  if (m) m.remove();
}
function agrSignSetupPad() {
  const cv = document.getElementById("agr-sign-pad");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#12325a";
  let drawing = false, lx = 0, ly = 0;
  const pos = (e) => {
    const r = cv.getBoundingClientRect();
    const t = e.touches && e.touches[0] || e;
    return { x: (t.clientX - r.left) * (cv.width / r.width), y: (t.clientY - r.top) * (cv.height / r.height) };
  };
  const start = (e) => {
    drawing = true;
    const p = pos(e);
    lx = p.x;
    ly = p.y;
    e.preventDefault();
  };
  const move = (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lx = p.x;
    ly = p.y;
    AGR_SIGN_DRAWN = true;
    e.preventDefault();
  };
  const end = () => {
    drawing = false;
  };
  cv.onmousedown = start;
  cv.onmousemove = move;
  window.onmouseup = end;
  cv.ontouchstart = start;
  cv.ontouchmove = move;
  cv.ontouchend = end;
}
function agrSignClear() {
  const cv = document.getElementById("agr-sign-pad");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
  AGR_SIGN_DRAWN = false;
}
async function agrSignSubmit(cid, entryId) {
  const modal = document.getElementById("__agrSignModal");
  if (!modal) return;
  const consent = modal.querySelector("#agr-sign-consent");
  const err = modal.querySelector(".modal-err");
  const cv = modal.querySelector("#agr-sign-pad");
  const status = modal.querySelector(".modal-status");
  if (!consent || !consent.checked) {
    if (err) {
      err.textContent = "Please check the consent box.";
      err.hidden = false;
    }
    return;
  }
  if (!AGR_SIGN_DRAWN) {
    if (err) {
      err.textContent = "Please draw your signature.";
      err.hidden = false;
    }
    return;
  }
  if (status) status.textContent = "Signing\u2026";
  try {
    await apiCountersignAgreement(cid, entryId, cv ? cv.toDataURL("image/png") : "");
    agrSignClose();
    await loadAgreements(cid, true);
    toast("Signed.");
  } catch (e) {
    if (status) status.textContent = "";
    if (err) {
      err.textContent = e && e.message ? e.message : String(e);
      err.hidden = false;
    }
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiYWdyZWVtZW50cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICBhZ3JlZW1lbnRzLnRzIFx1MjAxNCB0aGUgQWdyZWVtZW50cyAoZS1zaWduYXR1cmUpIHJlY29yZCBzZWN0aW9uIChsaXZlKS5cblxuICAgUGVyIGNsaWVudCwgbGlzdHMgYWdyZWVtZW50IGluc3RhbmNlcyBmcm9tIHRoZSBgYWdyZWVtZW50c2AgTUVGIChtYWVzdHJvXG4gICBsaXN0QWdyZWVtZW50cy9nZXRBZ3JlZW1lbnQvY3JlYXRlQWdyZWVtZW50L3NlbmRBZ3JlZW1lbnQvdm9pZEFncmVlbWVudCkuXG4gICBGbG93OiBOZXcgYWdyZWVtZW50IC0+IHBpY2sgYW4gQWN0aXZlIHRlbXBsYXRlIC0+IGFzc2lnbiB0aGUgdGVtcGxhdGUncyBzaWduZXJcbiAgIHJvbGVzIHRvIHJlYWwgcGVvcGxlIChleHRlcm5hbCBzaWduZXJzIGdldCBuYW1lK2VtYWlsOyBjb25zdWx0YW50IHJvbGVzIGFyZVxuICAgdGhlIGxvZ2dlZC1pbiB1c2VyLCBzaWduZWQgaW4tYXBwKSAtPiBDcmVhdGUgKERyYWZ0KSAtPiBTZW5kIChtaW50cyBwZXItc2lnbmVyXG4gICB0b2tlbnMsIGVtYWlscyBsaW5rcyB2aWEgdGhlIG1hZXN0cm8sIHNob3dzIGNvcHktbGluayBmYWxsYmFjaykuXG5cbiAgIFNpZ25hdHVyZXMgYXJlIGNvbGxlY3RlZCBvbiB0aGUgcHVibGljIHNpZ25pbmcgcGFnZSAoc2F0ZWxsaXRlIHNpdGUpIHZpYSB0aGVcbiAgIGRlZGljYXRlZCBpbmdlc3RlcjsgdGhlIGNvbnN1bHRhbnQgY291bnRlcnNpZ25zIGluLWFwcCAoXHUwMEE3IGNvdW50ZXJzaWduLCBhZGRlZFxuICAgd2l0aCBGaW5hbGl6ZSkuIEluamVjdGVkIGNvbnRyb2xzIHVzZSBkYXRhLWssIG5ldmVyIGBuYW1lYC5cbiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG5pbnRlcmZhY2UgQWdyU2lnbmVyIHsgaWQ6IHN0cmluZzsgcm9sZTogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IGVtYWlsOiBzdHJpbmc7IGtpbmQ6IHN0cmluZzsgb3JkZXI6IG51bWJlcjsgc3RhdHVzOiBzdHJpbmc7IHNpZ25lZEF0Pzogc3RyaW5nOyBoYXNUb2tlbj86IGJvb2xlYW47IH1cbmludGVyZmFjZSBMaXZlQWdyZWVtZW50IHtcbiAgZW50cnlJZDogc3RyaW5nOyB0aXRsZTogc3RyaW5nOyB0ZW1wbGF0ZVJlZjogc3RyaW5nOyB0ZW1wbGF0ZU5hbWU6IHN0cmluZztcbiAgc3RhdHVzOiBzdHJpbmc7IHNpZ25lcnM6IEFnclNpZ25lcltdOyBhdWRpdDogYW55W107XG4gIHNpZ25lZFBkZj86IHN0cmluZzsgZG9jdW1lbnRIYXNoPzogc3RyaW5nOyBzZW50QXQ/OiBzdHJpbmc7IGNvbXBsZXRlZEF0Pzogc3RyaW5nOyBjcmVhdGVkQXQ/OiBzdHJpbmc7IHZvaWRSZWFzb24/OiBzdHJpbmc7XG4gIGxpbmtzPzogeyBpZDogc3RyaW5nOyByb2xlOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgZW1haWw/OiBzdHJpbmc7IGtpbmQ6IHN0cmluZzsgbGluazogc3RyaW5nIH1bXTtcbn1cblxuaW50ZXJmYWNlIEFnclN0YXRlIHsgbGlzdDogTGl2ZUFncmVlbWVudFtdIHwgbnVsbDsgbG9hZGluZzogYm9vbGVhbjsgZXJyb3I6IHN0cmluZyB8IG51bGw7IH1cbmNvbnN0IEFHUl9DQUNIRTogeyBbY2xpZW50SWQ6IHN0cmluZ106IEFnclN0YXRlIH0gPSB7fTtcbmxldCBBR1JfVEVNUExBVEVTOiBhbnlbXSB8IG51bGwgPSBudWxsOyAvLyBhY3RpdmUgdGVtcGxhdGVzLCBsb2FkZWQgb25jZSBmb3IgdGhlIHBpY2tlclxuXG5mdW5jdGlvbiBhZ3JTdGF0ZShjaWQ6IHN0cmluZyk6IEFnclN0YXRlIHtcbiAgaWYgKCFBR1JfQ0FDSEVbY2lkXSkgQUdSX0NBQ0hFW2NpZF0gPSB7IGxpc3Q6IG51bGwsIGxvYWRpbmc6IGZhbHNlLCBlcnJvcjogbnVsbCB9O1xuICByZXR1cm4gQUdSX0NBQ0hFW2NpZF07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGxvYWRBZ3JlZW1lbnRzKGNpZDogc3RyaW5nLCBmb3JjZSA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHN0ID0gYWdyU3RhdGUoY2lkKTtcbiAgaWYgKHN0LmxvYWRpbmcpIHJldHVybjtcbiAgaWYgKHN0Lmxpc3QgJiYgIWZvcmNlKSByZXR1cm47XG4gIHN0LmxvYWRpbmcgPSB0cnVlOyBzdC5lcnJvciA9IG51bGw7XG4gIHRyeSB7XG4gICAgY29uc3Qgcm93cyA9IGF3YWl0IGFwaUxpc3RBZ3JlZW1lbnRzKGNpZCk7XG4gICAgc3QubGlzdCA9IChyb3dzIHx8IFtdKS5zbGljZSgpLnNvcnQoKGE6IGFueSwgYjogYW55KSA9PiBTdHJpbmcoYi5jcmVhdGVkQXQgfHwgJycpLmxvY2FsZUNvbXBhcmUoU3RyaW5nKGEuY3JlYXRlZEF0IHx8ICcnKSkpO1xuICB9IGNhdGNoIChlOiBhbnkpIHsgc3QuZXJyb3IgPSBlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKTsgfVxuICBzdC5sb2FkaW5nID0gZmFsc2U7XG4gIGlmIChsb2NhdGlvbi5oYXNoLmluZGV4T2YoJy9hZ3JlZW1lbnRzJykgPj0gMCkgcmVuZGVyKCk7XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBzdGF0dXMgcGlsbCBzdHlsaW5nIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZnVuY3Rpb24gYWdyU3RhdHVzQ2xhc3Moczogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKHMgPT09ICdDb21wbGV0ZWQnKSByZXR1cm4gJ29rJztcbiAgaWYgKHMgPT09ICdWb2lkZWQnIHx8IHMgPT09ICdEZWNsaW5lZCcpIHJldHVybiAnbXV0ZWQnO1xuICBpZiAocyA9PT0gJ1BhcnRpYWxseSBTaWduZWQnKSByZXR1cm4gJ3dhcm4nO1xuICBpZiAocyA9PT0gJ1NlbnQnKSByZXR1cm4gJ2luZm8nO1xuICByZXR1cm4gJ2RyYWZ0Jztcbn1cblxuZnVuY3Rpb24gc2lnbmVyUHJvZ3Jlc3MoYTogTGl2ZUFncmVlbWVudCk6IHN0cmluZyB7XG4gIGNvbnN0IHRvdGFsID0gKGEuc2lnbmVycyB8fCBbXSkubGVuZ3RoO1xuICBjb25zdCBzaWduZWQgPSAoYS5zaWduZXJzIHx8IFtdKS5maWx0ZXIocyA9PiBzLnN0YXR1cyA9PT0gJ3NpZ25lZCcpLmxlbmd0aDtcbiAgcmV0dXJuIHNpZ25lZCArICcvJyArIHRvdGFsICsgJyBzaWduZWQnO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgc2VjdGlvbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmZ1bmN0aW9uIGFncmVlbWVudHNTZWN0aW9uKGM6IENsaWVudCk6IHN0cmluZyB7XG4gIGNvbnN0IHN0ID0gYWdyU3RhdGUoYy5pZCk7XG4gIGlmIChzdC5saXN0ID09PSBudWxsKSB7XG4gICAgaWYgKCFzdC5sb2FkaW5nICYmICFzdC5lcnJvcikgbG9hZEFncmVlbWVudHMoYy5pZCk7XG4gICAgcmV0dXJuIHNlY3Rpb25IZWFkKCdBZ3JlZW1lbnRzJywgJ0Utc2lnbmF0dXJlIGFncmVlbWVudHMgZm9yICcgKyBlc2MoYy5maXJzdCkgKyAnLicpXG4gICAgICArIChzdC5lcnJvciA/IGVycm9yQ2FyZChzdC5lcnJvcikgOiBsb2FkaW5nQ2FyZCgnTG9hZGluZyBhZ3JlZW1lbnRzXHUyMDI2JykpO1xuICB9XG4gIGNvbnN0IGhlYWQgPSBgPGRpdiBjbGFzcz1cInNlY3Rpb24taGVhZFwiPjxkaXY+PGgzPkFncmVlbWVudHM8L2gzPjxwPlNlbmQgdGVtcGxhdGVzIGZvciBlLXNpZ25hdHVyZSBhbmQgdHJhY2sgd2hvIGhhcyBzaWduZWQuPC9wPjwvZGl2PlxuICAgIDxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeVwiIG9uY2xpY2s9XCJhZ3JPcGVuTmV3KCcke2VzYyhjLmlkKX0nKVwiPiR7aWMoJ3BsdXMnLCAxNSl9IE5ldyBhZ3JlZW1lbnQ8L2J1dHRvbj48L2Rpdj5gO1xuXG4gIGlmICghc3QubGlzdC5sZW5ndGgpIHtcbiAgICByZXR1cm4gaGVhZCArIGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdmaWxlVGV4dCcsIDIyKX08L2Rpdj48Yj5ObyBhZ3JlZW1lbnRzIHlldDwvYj5cbiAgICAgIDxwPkNyZWF0ZSBvbmUgZnJvbSBhIHRlbXBsYXRlIHRvIHNlbmQgZm9yIHNpZ25hdHVyZS48L3A+PC9kaXY+PC9kaXY+YDtcbiAgfVxuXG4gIGNvbnN0IGNhcmRzID0gc3QubGlzdC5tYXAoYSA9PiB7XG4gICAgY29uc3QgY2xzID0gYWdyU3RhdHVzQ2xhc3MoYS5zdGF0dXMpO1xuICAgIGNvbnN0IHNpZ25lcnMgPSAoYS5zaWduZXJzIHx8IFtdKS5tYXAocyA9PiB7XG4gICAgICBjb25zdCBiYWRnZSA9IHMuc3RhdHVzID09PSAnc2lnbmVkJyA/IGA8c3BhbiBjbGFzcz1cImFnci1zLW9rXCI+JHtpYygnY2hlY2snLCAxMil9IHNpZ25lZDwvc3Bhbj5gXG4gICAgICAgIDogcy5zdGF0dXMgPT09ICdkZWNsaW5lZCcgPyBgPHNwYW4gY2xhc3M9XCJhZ3Itcy1ub1wiPmRlY2xpbmVkPC9zcGFuPmBcbiAgICAgICAgOiBzLmtpbmQgPT09ICdjb25zdWx0YW50JyA/IGA8c3BhbiBjbGFzcz1cImFnci1zLXdhaXRcIj5hd2FpdGluZyB5b3U8L3NwYW4+YFxuICAgICAgICA6IGA8c3BhbiBjbGFzcz1cImFnci1zLXdhaXRcIj5wZW5kaW5nPC9zcGFuPmA7XG4gICAgICByZXR1cm4gYDxkaXYgY2xhc3M9XCJhZ3Itc2lnbmVyXCI+PHNwYW4gY2xhc3M9XCJhZ3Itcy1uYW1lXCI+JHtlc2Mocy5uYW1lIHx8IHMucm9sZSl9JHtzLmtpbmQgPT09ICdjb25zdWx0YW50JyA/ICcgPHNwYW4gY2xhc3M9XCJtdXRlZFwiPih5b3UpPC9zcGFuPicgOiAnJ308L3NwYW4+JHtiYWRnZX08L2Rpdj5gO1xuICAgIH0pLmpvaW4oJycpO1xuICAgIGNvbnN0IGFjdGlvbnM6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgY29uc3VsdGFudFBlbmRpbmcgPSAoYS5zaWduZXJzIHx8IFtdKS5zb21lKHMgPT4gcy5raW5kID09PSAnY29uc3VsdGFudCcgJiYgcy5zdGF0dXMgIT09ICdzaWduZWQnICYmIHMuc3RhdHVzICE9PSAnZGVjbGluZWQnKTtcbiAgICBpZiAoKGEuc3RhdHVzID09PSAnU2VudCcgfHwgYS5zdGF0dXMgPT09ICdQYXJ0aWFsbHkgU2lnbmVkJykgJiYgY29uc3VsdGFudFBlbmRpbmcpIGFjdGlvbnMucHVzaChgPGJ1dHRvbiBjbGFzcz1cImJ0biBwcmltYXJ5IHNtXCIgb25jbGljaz1cImFnclNpZ25TZWxmKCcke2VzYyhjLmlkKX0nLCcke2VzYyhhLmVudHJ5SWQpfScpXCI+JHtpYygncGVuJywgMTQpfSBTaWduIG5vdzwvYnV0dG9uPmApO1xuICAgIGlmIChhLnN0YXR1cyA9PT0gJ0RyYWZ0JykgYWN0aW9ucy5wdXNoKGA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnkgc21cIiBvbmNsaWNrPVwiYWdyU2VuZCgnJHtlc2MoYy5pZCl9JywnJHtlc2MoYS5lbnRyeUlkKX0nKVwiPiR7aWMoJ21haWwnLCAxNCl9IFNlbmQ8L2J1dHRvbj5gKTtcbiAgICBpZiAoYS5zdGF0dXMgPT09ICdTZW50JyB8fCBhLnN0YXR1cyA9PT0gJ1BhcnRpYWxseSBTaWduZWQnKSBhY3Rpb25zLnB1c2goYDxidXR0b24gY2xhc3M9XCJidG4gb3V0bGluZSBzbVwiIG9uY2xpY2s9XCJhZ3JTZW5kKCcke2VzYyhjLmlkKX0nLCcke2VzYyhhLmVudHJ5SWQpfScpXCI+JHtpYygnbWFpbCcsIDE0KX0gUmVzZW5kIC8gbGlua3M8L2J1dHRvbj5gKTtcbiAgICBpZiAoYS5zdGF0dXMgPT09ICdDb21wbGV0ZWQnICYmIGEuc2lnbmVkUGRmKSBhY3Rpb25zLnB1c2goYDxhIGNsYXNzPVwiYnRuIHByaW1hcnkgc21cIiBocmVmPVwiJHtlc2MoYS5zaWduZWRQZGYpfVwiIHRhcmdldD1cIl9ibGFua1wiIHJlbD1cIm5vb3BlbmVyXCI+JHtpYygnZG93bmxvYWQnLCAxNCl9IFNpZ25lZCBQREY8L2E+YCk7XG4gICAgZWxzZSBpZiAoYS5zdGF0dXMgPT09ICdDb21wbGV0ZWQnKSBhY3Rpb25zLnB1c2goYDxidXR0b24gY2xhc3M9XCJidG4gb3V0bGluZSBzbVwiIG9uY2xpY2s9XCJhZ3JHZXRQZGYoJyR7ZXNjKGMuaWQpfScsJyR7ZXNjKGEuZW50cnlJZCl9Jyx0aGlzKVwiIHRpdGxlPVwiVGhlIHNpZ25lZCBQREYgaXMgYmVpbmcgZ2VuZXJhdGVkIGluIHRoZSBiYWNrZ3JvdW5kOyBjbGljayB0byBjaGVjayBpZiBpdCdzIHJlYWR5LlwiPiR7aWMoJ2Rvd25sb2FkJywgMTQpfSBQREYgZ2VuZXJhdGluZ1x1MjAyNjwvYnV0dG9uPmApO1xuICAgIGlmIChhLnN0YXR1cyAhPT0gJ0NvbXBsZXRlZCcgJiYgYS5zdGF0dXMgIT09ICdWb2lkZWQnKSBhY3Rpb25zLnB1c2goYDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3Qgc21cIiBvbmNsaWNrPVwiYWdyVm9pZCgnJHtlc2MoYy5pZCl9JywnJHtlc2MoYS5lbnRyeUlkKX0nKVwiPiR7aWMoJ3RyYXNoJywgMTQpfSBWb2lkPC9idXR0b24+YCk7XG4gICAgY29uc3QgbGlua3NCbG9jayA9IGEubGlua3MgJiYgYS5saW5rcy5sZW5ndGhcbiAgICAgID8gYDxkaXYgY2xhc3M9XCJhZ3ItbGlua3NcIj4ke2EubGlua3MuZmlsdGVyKGwgPT4gbC5raW5kID09PSAnZXh0ZXJuYWwnICYmIGwubGluaykubWFwKGwgPT4gYDxkaXYgY2xhc3M9XCJhZ3ItbGluay1yb3dcIj48c3Bhbj4ke2VzYyhsLm5hbWUgfHwgbC5yb2xlKX08L3NwYW4+PGlucHV0IHJlYWRvbmx5IHZhbHVlPVwiJHtlc2MobC5saW5rKX1cIiBvbmNsaWNrPVwidGhpcy5zZWxlY3QoKVwiPjxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3Qgc21cIiBvbmNsaWNrPVwiYWdyQ29weSgnJHtlc2MobC5saW5rKX0nKVwiPkNvcHk8L2J1dHRvbj48L2Rpdj5gKS5qb2luKCcnKX08L2Rpdj5gXG4gICAgICA6ICcnO1xuICAgIHJldHVybiBgPGRpdiBjbGFzcz1cImNhcmQgYWdyLWNhcmRcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJhZ3ItdG9wXCI+XG4gICAgICAgIDxkaXY+PGI+JHtlc2MoYS50aXRsZSl9PC9iPjxkaXYgY2xhc3M9XCJhZ3Itc3ViXCI+JHtlc2MoYS50ZW1wbGF0ZU5hbWUgfHwgJycpfSBcdTAwQjcgJHtzaWduZXJQcm9ncmVzcyhhKX08L2Rpdj48L2Rpdj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJwaWxsICR7Y2xzfVwiPiR7ZXNjKGEuc3RhdHVzKX08L3NwYW4+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJhZ3Itc2lnbmVyc1wiPiR7c2lnbmVyc308L2Rpdj5cbiAgICAgICR7bGlua3NCbG9ja31cbiAgICAgIDxkaXYgY2xhc3M9XCJhZ3ItYWN0aW9uc1wiPiR7YWN0aW9ucy5qb2luKCcnKX08L2Rpdj5cbiAgICA8L2Rpdj5gO1xuICB9KS5qb2luKCcnKTtcbiAgcmV0dXJuIGhlYWQgKyBgPGRpdiBjbGFzcz1cImFnci1saXN0XCI+JHtjYXJkc308L2Rpdj5gO1xufVxuXG4vLyBzbWFsbCBoZWxwZXI6IGEgc2VjdGlvbiBoZWFkZXIgKG1hdGNoZXMgdGhlIGFwcCdzIC5zZWN0aW9uLWhlYWQpXG5mdW5jdGlvbiBzZWN0aW9uSGVhZCh0aXRsZTogc3RyaW5nLCBkZXNjOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJzZWN0aW9uLWhlYWRcIj48ZGl2PjxoMz4ke2VzYyh0aXRsZSl9PC9oMz48cD4ke2VzYyhkZXNjKX08L3A+PC9kaXY+PC9kaXY+YDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIE5ldy1hZ3JlZW1lbnQgbW9kYWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5hc3luYyBmdW5jdGlvbiBhZ3JPcGVuTmV3KGNpZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19hZ3JNb2RhbCcpKSByZXR1cm47XG4gIC8vIGxvYWQgYWN0aXZlIHRlbXBsYXRlcyBmb3IgdGhlIHBpY2tlclxuICBpZiAoQUdSX1RFTVBMQVRFUyA9PT0gbnVsbCkge1xuICAgIHRyeSB7IEFHUl9URU1QTEFURVMgPSAoYXdhaXQgYXBpTGlzdEFncmVlbWVudFRlbXBsYXRlcygpIHx8IFtdKS5maWx0ZXIoKHQ6IGFueSkgPT4gKHQuc3RhdHVzIHx8ICcnKSA9PT0gJ0FjdGl2ZScpOyB9XG4gICAgY2F0Y2ggKGUpIHsgQUdSX1RFTVBMQVRFUyA9IFtdOyB9XG4gIH1cbiAgY29uc3QgaG9zdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBob3N0LmNsYXNzTmFtZSA9ICdtb2RhbC1vdmVybGF5JztcbiAgaG9zdC5pZCA9ICdfX2Fnck1vZGFsJztcbiAgaG9zdC5pbm5lckhUTUwgPSBhZ3JNb2RhbEh0bWwoY2lkKTtcbiAgaG9zdC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBlID0+IHsgaWYgKGUudGFyZ2V0ID09PSBob3N0KSBhZ3JDbG9zZU5ldygpOyB9KTtcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChob3N0KTtcbiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGFnckVzYyk7XG59XG5mdW5jdGlvbiBhZ3JFc2MoZTogS2V5Ym9hcmRFdmVudCk6IHZvaWQgeyBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSBhZ3JDbG9zZU5ldygpOyB9XG5mdW5jdGlvbiBhZ3JDbG9zZU5ldygpOiB2b2lkIHsgY29uc3QgbSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX2Fnck1vZGFsJyk7IGlmIChtKSBtLnJlbW92ZSgpOyBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywgYWdyRXNjKTsgfVxuXG5mdW5jdGlvbiBhZ3JNb2RhbEh0bWwoY2lkOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBvcHRzID0gKEFHUl9URU1QTEFURVMgfHwgW10pLm1hcCgodDogYW55KSA9PiBgPG9wdGlvbiB2YWx1ZT1cIiR7ZXNjKHQuZW50cnlJZCl9XCI+JHtlc2ModC5uYW1lKX08L29wdGlvbj5gKS5qb2luKCcnKTtcbiAgY29uc3QgcGlja2VyID0gKEFHUl9URU1QTEFURVMgJiYgQUdSX1RFTVBMQVRFUy5sZW5ndGgpXG4gICAgPyBgPHNlbGVjdCBkYXRhLWs9XCJ0ZW1wbGF0ZVJlZlwiIG9uY2hhbmdlPVwiYWdyVGVtcGxhdGVQaWNrZWQoJyR7ZXNjKGNpZCl9JylcIj48b3B0aW9uIHZhbHVlPVwiXCI+Q2hvb3NlIGEgdGVtcGxhdGVcdTIwMjY8L29wdGlvbj4ke29wdHN9PC9zZWxlY3Q+YFxuICAgIDogYDxkaXYgY2xhc3M9XCJtdXRlZFwiPk5vIEFjdGl2ZSB0ZW1wbGF0ZXMgeWV0LiBDcmVhdGUgb25lIGluIDxiPlNldHRpbmdzIFx1MjVCOCBBZ3JlZW1lbnRzPC9iPi48L2Rpdj5gO1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJtb2RhbC1jYXJkXCIgcm9sZT1cImRpYWxvZ1wiIGFyaWEtbW9kYWw9XCJ0cnVlXCIgYXJpYS1sYWJlbD1cIk5ldyBhZ3JlZW1lbnRcIj5cbiAgICA8ZGl2IGNsYXNzPVwibW9kYWwtaGVhZFwiPjxkaXY+PGI+TmV3IEFncmVlbWVudDwvYj48cD5QaWNrIGEgdGVtcGxhdGUgYW5kIGFzc2lnbiBzaWduZXJzLjwvcD48L2Rpdj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJpY28teFwiIG9uY2xpY2s9XCJhZ3JDbG9zZU5ldygpXCI+JHtpYygneCcsIDE4KX08L2J1dHRvbj48L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwibW9kYWwtYm9keVwiPlxuICAgICAgPGRpdiBjbGFzcz1cIm1vZGFsLWVyclwiIGhpZGRlbj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZCBmdWxsXCI+PGxhYmVsPlRlbXBsYXRlPC9sYWJlbD4ke3BpY2tlcn08L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZCBmdWxsXCI+PGxhYmVsPlRpdGxlPC9sYWJlbD48aW5wdXQgZGF0YS1rPVwidGl0bGVcIiBwbGFjZWhvbGRlcj1cImUuZy4gRW5nYWdlbWVudCBBZ3JlZW1lbnQgXHUyMDE0IENoZW5cIj48L2Rpdj5cbiAgICAgIDxkaXYgaWQ9XCJhZ3Itc2lnbmVycy13cmFwXCI+PC9kaXY+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cIm1vZGFsLWZvb3RcIj48c3BhbiBjbGFzcz1cIm1vZGFsLXN0YXR1c1wiPjwvc3Bhbj48c3BhbiBzdHlsZT1cImZsZXg6MVwiPjwvc3Bhbj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBvbmNsaWNrPVwiYWdyQ2xvc2VOZXcoKVwiPiR7aWMoJ3gnLCAxNSl9IENhbmNlbDwvYnV0dG9uPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBwcmltYXJ5XCIgb25jbGljaz1cImFnckNyZWF0ZVN1Ym1pdCgnJHtlc2MoY2lkKX0nKVwiIGlkPVwiYWdyLWNyZWF0ZS1idG5cIiBkaXNhYmxlZD4ke2ljKCdwbHVzJywgMTUpfSBDcmVhdGU8L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgPC9kaXY+YDtcbn1cblxuLy8gV2hlbiBhIHRlbXBsYXRlIGlzIHBpY2tlZCwgcmVuZGVyIGEgc2lnbmVyIHJvdyBwZXIgcm9sZSArIGRlZmF1bHQgdGhlIHRpdGxlLlxuZnVuY3Rpb24gYWdyVGVtcGxhdGVQaWNrZWQoY2lkOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgbW9kYWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19hZ3JNb2RhbCcpOyBpZiAoIW1vZGFsKSByZXR1cm47XG4gIGNvbnN0IHNlbCA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJ3NlbGVjdFtkYXRhLWs9XCJ0ZW1wbGF0ZVJlZlwiXScpIGFzIEhUTUxTZWxlY3RFbGVtZW50IHwgbnVsbDtcbiAgY29uc3Qgd3JhcCA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJyNhZ3Itc2lnbmVycy13cmFwJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBjb25zdCBidG4gPSBtb2RhbC5xdWVyeVNlbGVjdG9yKCcjYWdyLWNyZWF0ZS1idG4nKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG4gIGNvbnN0IHRpdGxlSW5wdXQgPSBtb2RhbC5xdWVyeVNlbGVjdG9yKCdpbnB1dFtkYXRhLWs9XCJ0aXRsZVwiXScpIGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBudWxsO1xuICBpZiAoIXNlbCB8fCAhd3JhcCkgcmV0dXJuO1xuICBjb25zdCB0cGwgPSAoQUdSX1RFTVBMQVRFUyB8fCBbXSkuZmluZCgodDogYW55KSA9PiB0LmVudHJ5SWQgPT09IHNlbC52YWx1ZSk7XG4gIGlmICghdHBsKSB7IHdyYXAuaW5uZXJIVE1MID0gJyc7IGlmIChidG4pIGJ0bi5kaXNhYmxlZCA9IHRydWU7IHJldHVybjsgfVxuICBpZiAodGl0bGVJbnB1dCAmJiAhdGl0bGVJbnB1dC52YWx1ZSkgdGl0bGVJbnB1dC52YWx1ZSA9IHRwbC5uYW1lIHx8ICdBZ3JlZW1lbnQnO1xuICBjb25zdCByb2xlcyA9ICh0cGwuYm9keUpzb24gJiYgQXJyYXkuaXNBcnJheSh0cGwuYm9keUpzb24ucm9sZXMpKSA/IHRwbC5ib2R5SnNvbi5yb2xlcyA6IFtdO1xuICBjb25zdCBtZSA9ICh0eXBlb2YgU0VTU0lPTiAhPT0gJ3VuZGVmaW5lZCcgJiYgU0VTU0lPTiAmJiBTRVNTSU9OLmZ1bGxOYW1lKSA/IFNFU1NJT04uZnVsbE5hbWUgOiAoTUUuZmlyc3QgKyAnICcgKyBNRS5sYXN0KTtcbiAgd3JhcC5pbm5lckhUTUwgPSAnPGRpdiBjbGFzcz1cImFnci1yb2xlcy1oXCI+U2lnbmVyczwvZGl2PicgKyByb2xlcy5tYXAoKHI6IGFueSwgaTogbnVtYmVyKSA9PiB7XG4gICAgaWYgKHIua2luZCA9PT0gJ2NvbnN1bHRhbnQnKSB7XG4gICAgICByZXR1cm4gYDxkaXYgY2xhc3M9XCJhZ3Itcm9sZVwiIGRhdGEtcm9sZT1cIiR7ZXNjKHIuaWQpfVwiIGRhdGEta2luZD1cImNvbnN1bHRhbnRcIiBkYXRhLW5hbWU9XCIke2VzYyhtZSl9XCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJhZ3Itcm9sZS1sYWJlbFwiPiR7ZXNjKHIubGFiZWwgfHwgci5pZCl9IDxzcGFuIGNsYXNzPVwibXV0ZWRcIj5cdTIwMTQgeW91ICgke2VzYyhtZSl9KSwgc2lnbiBpbi1hcHA8L3NwYW4+PC9kaXY+PC9kaXY+YDtcbiAgICB9XG4gICAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiYWdyLXJvbGVcIiBkYXRhLXJvbGU9XCIke2VzYyhyLmlkKX1cIiBkYXRhLWtpbmQ9XCJleHRlcm5hbFwiPlxuICAgICAgPGRpdiBjbGFzcz1cImFnci1yb2xlLWxhYmVsXCI+JHtlc2Moci5sYWJlbCB8fCByLmlkKX08L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJhZ3Itcm9sZS1pbnB1dHNcIj5cbiAgICAgICAgPGlucHV0IGRhdGEtcms9XCJuYW1lXCIgcGxhY2Vob2xkZXI9XCJGdWxsIG5hbWVcIj5cbiAgICAgICAgPGlucHV0IGRhdGEtcms9XCJlbWFpbFwiIHBsYWNlaG9sZGVyPVwiZW1haWxAZXhhbXBsZS5jb21cIiBvbmlucHV0PVwiYWdyVmFsaWRhdGUoKVwiPlxuICAgICAgPC9kaXY+PC9kaXY+YDtcbiAgfSkuam9pbignJyk7XG4gIGFnclZhbGlkYXRlKCk7XG59XG5cbi8vIEVuYWJsZSBDcmVhdGUgb25seSB3aGVuIGV2ZXJ5IGV4dGVybmFsIHNpZ25lciBoYXMgYSBuYW1lICsgZW1haWwuXG5mdW5jdGlvbiBhZ3JWYWxpZGF0ZSgpOiB2b2lkIHtcbiAgY29uc3QgbW9kYWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19hZ3JNb2RhbCcpOyBpZiAoIW1vZGFsKSByZXR1cm47XG4gIGNvbnN0IGJ0biA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJyNhZ3ItY3JlYXRlLWJ0bicpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcbiAgY29uc3Qgcm9sZXMgPSBBcnJheS5mcm9tKG1vZGFsLnF1ZXJ5U2VsZWN0b3JBbGwoJy5hZ3Itcm9sZScpKSBhcyBIVE1MRWxlbWVudFtdO1xuICBsZXQgb2sgPSByb2xlcy5sZW5ndGggPiAwO1xuICByb2xlcy5mb3JFYWNoKHIgPT4ge1xuICAgIGlmIChyLmdldEF0dHJpYnV0ZSgnZGF0YS1raW5kJykgPT09ICdleHRlcm5hbCcpIHtcbiAgICAgIGNvbnN0IGVtYWlsID0gKHIucXVlcnlTZWxlY3RvcignaW5wdXRbZGF0YS1yaz1cImVtYWlsXCJdJykgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGwpO1xuICAgICAgY29uc3QgbmFtZSA9IChyLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W2RhdGEtcms9XCJuYW1lXCJdJykgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGwpO1xuICAgICAgaWYgKCFlbWFpbCB8fCAhbmFtZSB8fCAhbmFtZS52YWx1ZS50cmltKCkgfHwgIS8uK0AuK1xcLi4rLy50ZXN0KGVtYWlsLnZhbHVlLnRyaW0oKSkpIG9rID0gZmFsc2U7XG4gICAgfVxuICB9KTtcbiAgaWYgKGJ0bikgYnRuLmRpc2FibGVkID0gIW9rO1xufVxuXG5hc3luYyBmdW5jdGlvbiBhZ3JDcmVhdGVTdWJtaXQoY2lkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgbW9kYWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19hZ3JNb2RhbCcpOyBpZiAoIW1vZGFsKSByZXR1cm47XG4gIGNvbnN0IHNlbCA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJ3NlbGVjdFtkYXRhLWs9XCJ0ZW1wbGF0ZVJlZlwiXScpIGFzIEhUTUxTZWxlY3RFbGVtZW50IHwgbnVsbDtcbiAgY29uc3QgdGl0bGVJbnB1dCA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W2RhdGEtaz1cInRpdGxlXCJdJykgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XG4gIGNvbnN0IHN0YXR1cyA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC1zdGF0dXMnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGNvbnN0IGVyciA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC1lcnInKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmICghc2VsIHx8ICFzZWwudmFsdWUpIHsgaWYgKGVycikgeyBlcnIudGV4dENvbnRlbnQgPSAnUGljayBhIHRlbXBsYXRlLic7IGVyci5oaWRkZW4gPSBmYWxzZTsgfSByZXR1cm47IH1cbiAgY29uc3Qgcm9sZXMgPSBBcnJheS5mcm9tKG1vZGFsLnF1ZXJ5U2VsZWN0b3JBbGwoJy5hZ3Itcm9sZScpKSBhcyBIVE1MRWxlbWVudFtdO1xuICBjb25zdCBzaWduZXJzID0gcm9sZXMubWFwKChyLCBpKSA9PiB7XG4gICAgY29uc3Qga2luZCA9IHIuZ2V0QXR0cmlidXRlKCdkYXRhLWtpbmQnKSB8fCAnZXh0ZXJuYWwnO1xuICAgIGlmIChraW5kID09PSAnY29uc3VsdGFudCcpIHJldHVybiB7IHJvbGU6IHIuZ2V0QXR0cmlidXRlKCdkYXRhLXJvbGUnKSwgbmFtZTogci5nZXRBdHRyaWJ1dGUoJ2RhdGEtbmFtZScpIHx8ICcnLCBlbWFpbDogJycsIGtpbmQ6ICdjb25zdWx0YW50Jywgb3JkZXI6IGkgKyAxIH07XG4gICAgcmV0dXJuIHtcbiAgICAgIHJvbGU6IHIuZ2V0QXR0cmlidXRlKCdkYXRhLXJvbGUnKSxcbiAgICAgIG5hbWU6IChyLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W2RhdGEtcms9XCJuYW1lXCJdJykgYXMgSFRNTElucHV0RWxlbWVudCkudmFsdWUudHJpbSgpLFxuICAgICAgZW1haWw6IChyLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W2RhdGEtcms9XCJlbWFpbFwiXScpIGFzIEhUTUxJbnB1dEVsZW1lbnQpLnZhbHVlLnRyaW0oKSxcbiAgICAgIGtpbmQ6ICdleHRlcm5hbCcsIG9yZGVyOiBpICsgMSxcbiAgICB9O1xuICB9KTtcbiAgaWYgKGVycikgZXJyLmhpZGRlbiA9IHRydWU7XG4gIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICdDcmVhdGluZ1x1MjAyNic7XG4gIHRyeSB7XG4gICAgYXdhaXQgYXBpQ3JlYXRlQWdyZWVtZW50KGNpZCwgc2VsLnZhbHVlLCB0aXRsZUlucHV0ID8gdGl0bGVJbnB1dC52YWx1ZS50cmltKCkgOiAnJywgc2lnbmVycyk7XG4gICAgYWdyQ2xvc2VOZXcoKTtcbiAgICBhd2FpdCBsb2FkQWdyZWVtZW50cyhjaWQsIHRydWUpO1xuICAgIHRvYXN0KCdBZ3JlZW1lbnQgY3JlYXRlZCBcdTIwMTQgc2VuZCBpdCB3aGVuIHJlYWR5LicpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBpZiAoc3RhdHVzKSBzdGF0dXMudGV4dENvbnRlbnQgPSAnJztcbiAgICBpZiAoZXJyKSB7IGVyci50ZXh0Q29udGVudCA9IGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpOyBlcnIuaGlkZGVuID0gZmFsc2U7IH1cbiAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgc2VuZCAvIHZvaWQgLyBjb3B5IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuYXN5bmMgZnVuY3Rpb24gYWdyU2VuZChjaWQ6IHN0cmluZywgZW50cnlJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgYXBpU2VuZEFncmVlbWVudChjaWQsIGVudHJ5SWQpO1xuICAgIGNvbnN0IHN0ID0gYWdyU3RhdGUoY2lkKTtcbiAgICBpZiAoc3QubGlzdCkgeyBjb25zdCBpID0gc3QubGlzdC5maW5kSW5kZXgoYSA9PiBhLmVudHJ5SWQgPT09IGVudHJ5SWQpOyBpZiAoaSA+PSAwKSBzdC5saXN0W2ldID0gcmVzOyB9XG4gICAgcmVuZGVyKCk7XG4gICAgdG9hc3QoJ0FncmVlbWVudCBzZW50IFx1MjAxNCBzaWduaW5nIGxpbmtzIGVtYWlsZWQuJyk7XG4gIH0gY2F0Y2ggKGU6IGFueSkgeyB0b2FzdCgnU2VuZCBmYWlsZWQ6ICcgKyAoZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpKTsgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBhZ3JWb2lkKGNpZDogc3RyaW5nLCBlbnRyeUlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKCF3aW5kb3cuY29uZmlybSgnVm9pZCB0aGlzIGFncmVlbWVudD8gU2lnbmVycyB3aWxsIG5vIGxvbmdlciBiZSBhYmxlIHRvIHNpZ24uIFRoaXMgY2FuXFwndCBiZSB1bmRvbmUuJykpIHJldHVybjtcbiAgdHJ5IHtcbiAgICBhd2FpdCBhcGlWb2lkQWdyZWVtZW50KGNpZCwgZW50cnlJZCwgJycpO1xuICAgIGF3YWl0IGxvYWRBZ3JlZW1lbnRzKGNpZCwgdHJ1ZSk7XG4gICAgdG9hc3QoJ0FncmVlbWVudCB2b2lkZWQuJyk7XG4gIH0gY2F0Y2ggKGU6IGFueSkgeyB0b2FzdCgnVm9pZCBmYWlsZWQ6ICcgKyAoZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpKTsgfVxufVxuXG5mdW5jdGlvbiBhZ3JDb3B5KGxpbms6IHN0cmluZyk6IHZvaWQge1xuICB0cnkgeyBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChsaW5rKTsgdG9hc3QoJ0xpbmsgY29waWVkLicpOyB9XG4gIGNhdGNoIChfZSkgeyB0b2FzdCgnQ29weSBmYWlsZWQgXHUyMDE0IHNlbGVjdCB0aGUgdGV4dCBtYW51YWxseS4nKTsgfVxufVxuXG4vLyBEb3dubG9hZCB0aGUgc2lnbmVkIFBERi4gR2VuZXJhdGVkIG9uIGRlbWFuZCBzZXJ2ZXItc2lkZSAoZ2V0U2lnbmVkUGRmKSBcdTIwMTQgdGhlXG4vLyBmaXJzdCBjbGljayBtYXkgdGFrZSBhIGZldyBzZWNvbmRzIHdoaWxlIGl0IHJlbmRlcnMgKyBjYWNoZXM7IGxhdGVyIGNsaWNrcyBhcmVcbi8vIGluc3RhbnQuIElmIFBERiBnZW5lcmF0aW9uIGlzIG1vbWVudGFyaWx5IHVuYXZhaWxhYmxlLCB0aGUgc2lnbmF0dXJlIGlzIGFscmVhZHlcbi8vIHNhZmVseSByZWNvcmRlZCwgc28gYSByZXRyeSBzdWNjZWVkcy5cbi8vIFNpZ25lZC1QREYgYnV0dG9uLiBCLmlvLnBkZiBoYW5ncyB1bmRlciBsb2FkLCBzbyBhIHVzZXIgY2xpY2sgbXVzdCBORVZFUiB0cmlnZ2VyXG4vLyBhIHN5bmNocm9ub3VzIHJlbmRlciBcdTIwMTQgdGhlIHNjaGVkdWxlZCBiYWNrZ3JvdW5kIHdvcmtlciBvd25zIHJlbmRlcmluZy4gVGhpcyBkb2VzIGFcbi8vIHJlYWQtb25seSByZS1jaGVjayAoZ2V0QWdyZWVtZW50IGJhY2tmaWxscyBzaWduZWRQZGYgZnJvbSBGaWxlcyBvbmNlIHRoZSB3b3JrZXIgaGFzXG4vLyBwcm9kdWNlZCBpdCk6IGlmIHRoZSBQREYgZXhpc3RzIHdlIG9wZW4gaXQsIG90aGVyd2lzZSB3ZSByZXBvcnQgaXQncyBzdGlsbCBxdWV1ZWQuXG5hc3luYyBmdW5jdGlvbiBhZ3JHZXRQZGYoY2lkOiBzdHJpbmcsIGVudHJ5SWQ6IHN0cmluZywgYnRuPzogSFRNTEJ1dHRvbkVsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgb3JpZyA9IGJ0biA/IGJ0bi5pbm5lckhUTUwgOiAnJztcbiAgaWYgKGJ0bikgeyBidG4uZGlzYWJsZWQgPSB0cnVlOyBidG4uaW5uZXJIVE1MID0gJ0NoZWNraW5nXHUyMDI2JzsgfVxuICB0cnkge1xuICAgIGNvbnN0IGEgPSBhd2FpdCBhcGlHZXRBZ3JlZW1lbnQoY2lkLCBlbnRyeUlkKTtcbiAgICBpZiAoYSAmJiBhLnNpZ25lZFBkZikgeyB3aW5kb3cub3BlbihhLnNpZ25lZFBkZiwgJ19ibGFuaycpOyB9XG4gICAgZWxzZSB7IHRvYXN0KCdZb3VyIHNpZ25lZCBQREYgaXMgYmVpbmcgZ2VuZXJhdGVkIGluIHRoZSBiYWNrZ3JvdW5kIFx1MjAxNCBpdCBzaG91bGQgYXBwZWFyIGhlcmUgd2l0aGluIGEgZmV3IG1pbnV0ZXMuIENoZWNrIGJhY2sgc2hvcnRseS4nKTsgfVxuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICB0b2FzdCgnQ291bGQgbm90IGNoZWNrIHRoZSBzaWduZWQgUERGIHJpZ2h0IG5vdyBcdTIwMTQgcGxlYXNlIHRyeSBhZ2FpbiBpbiBhIG1vbWVudC4nKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAoYnRuKSB7IGJ0bi5kaXNhYmxlZCA9IGZhbHNlOyBidG4uaW5uZXJIVE1MID0gb3JpZzsgfVxuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBjb25zdWx0YW50IGluLWFwcCBjb3VudGVyc2lnbiAoc2lnbmF0dXJlIHBhZCBtb2RhbCkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5sZXQgQUdSX1NJR05fRFJBV04gPSBmYWxzZTtcbmZ1bmN0aW9uIGFnclNpZ25TZWxmKGNpZDogc3RyaW5nLCBlbnRyeUlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX2FnclNpZ25Nb2RhbCcpKSByZXR1cm47XG4gIEFHUl9TSUdOX0RSQVdOID0gZmFsc2U7XG4gIGNvbnN0IGhvc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgaG9zdC5jbGFzc05hbWUgPSAnbW9kYWwtb3ZlcmxheSc7XG4gIGhvc3QuaWQgPSAnX19hZ3JTaWduTW9kYWwnO1xuICBob3N0LmlubmVySFRNTCA9IGA8ZGl2IGNsYXNzPVwibW9kYWwtY2FyZFwiIHJvbGU9XCJkaWFsb2dcIiBhcmlhLW1vZGFsPVwidHJ1ZVwiIGFyaWEtbGFiZWw9XCJTaWduIGFncmVlbWVudFwiPlxuICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1oZWFkXCI+PGRpdj48Yj5TaWduIHRoaXMgYWdyZWVtZW50PC9iPjxwPkRyYXcgeW91ciBzaWduYXR1cmUgdG8gYWRvcHQgaXQuPC9wPjwvZGl2PlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImljby14XCIgb25jbGljaz1cImFnclNpZ25DbG9zZSgpXCI+JHtpYygneCcsIDE4KX08L2J1dHRvbj48L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwibW9kYWwtYm9keVwiPlxuICAgICAgPGRpdiBjbGFzcz1cIm1vZGFsLWVyclwiIGhpZGRlbj48L2Rpdj5cbiAgICAgIDxjYW52YXMgaWQ9XCJhZ3Itc2lnbi1wYWRcIiBjbGFzcz1cInBsLXNpZ1wiIHdpZHRoPVwiNDQwXCIgaGVpZ2h0PVwiMTUwXCIgc3R5bGU9XCJ3aWR0aDoxMDAlXCI+PC9jYW52YXM+XG4gICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLXRvcDo4cHhcIj48YnV0dG9uIGNsYXNzPVwiYnRuIG91dGxpbmUgc21cIiBvbmNsaWNrPVwiYWdyU2lnbkNsZWFyKClcIj4ke2ljKCd0cmFzaCcsIDEzKX0gQ2xlYXI8L2J1dHRvbj48L2Rpdj5cbiAgICAgIDxsYWJlbCBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6OHB4O2FsaWduLWl0ZW1zOmZsZXgtc3RhcnQ7Zm9udC1zaXplOjEzcHg7bWFyZ2luLXRvcDoxMnB4XCI+XG4gICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBpZD1cImFnci1zaWduLWNvbnNlbnRcIiBzdHlsZT1cIm1hcmdpbi10b3A6M3B4XCI+IEkgYWRvcHQgdGhpcyBzaWduYXR1cmUgYW5kIGFncmVlIGl0IGlzIGxlZ2FsbHkgYmluZGluZy48L2xhYmVsPlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1mb290XCI+PHNwYW4gY2xhc3M9XCJtb2RhbC1zdGF0dXNcIj48L3NwYW4+PHNwYW4gc3R5bGU9XCJmbGV4OjFcIj48L3NwYW4+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgb25jbGljaz1cImFnclNpZ25DbG9zZSgpXCI+JHtpYygneCcsIDE1KX0gQ2FuY2VsPC9idXR0b24+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnlcIiBvbmNsaWNrPVwiYWdyU2lnblN1Ym1pdCgnJHtlc2MoY2lkKX0nLCcke2VzYyhlbnRyeUlkKX0nKVwiPiR7aWMoJ3BlbicsIDE1KX0gQWRvcHQgJmFtcDsgU2lnbjwvYnV0dG9uPjwvZGl2PlxuICA8L2Rpdj5gO1xuICBob3N0LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIGUgPT4geyBpZiAoZS50YXJnZXQgPT09IGhvc3QpIGFnclNpZ25DbG9zZSgpOyB9KTtcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChob3N0KTtcbiAgYWdyU2lnblNldHVwUGFkKCk7XG59XG5mdW5jdGlvbiBhZ3JTaWduQ2xvc2UoKTogdm9pZCB7IGNvbnN0IG0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19hZ3JTaWduTW9kYWwnKTsgaWYgKG0pIG0ucmVtb3ZlKCk7IH1cbmZ1bmN0aW9uIGFnclNpZ25TZXR1cFBhZCgpOiB2b2lkIHtcbiAgY29uc3QgY3YgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWdyLXNpZ24tcGFkJykgYXMgSFRNTENhbnZhc0VsZW1lbnQgfCBudWxsO1xuICBpZiAoIWN2KSByZXR1cm47IGNvbnN0IGN0eCA9IGN2LmdldENvbnRleHQoJzJkJyk7IGlmICghY3R4KSByZXR1cm47XG4gIGN0eC5saW5lV2lkdGggPSAyLjQ7IGN0eC5saW5lQ2FwID0gJ3JvdW5kJzsgY3R4LmxpbmVKb2luID0gJ3JvdW5kJzsgY3R4LnN0cm9rZVN0eWxlID0gJyMxMjMyNWEnO1xuICBsZXQgZHJhd2luZyA9IGZhbHNlLCBseCA9IDAsIGx5ID0gMDtcbiAgY29uc3QgcG9zID0gKGU6IGFueSkgPT4geyBjb25zdCByID0gY3YuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7IGNvbnN0IHQgPSAoZS50b3VjaGVzICYmIGUudG91Y2hlc1swXSkgfHwgZTsgcmV0dXJuIHsgeDogKHQuY2xpZW50WCAtIHIubGVmdCkgKiAoY3Yud2lkdGggLyByLndpZHRoKSwgeTogKHQuY2xpZW50WSAtIHIudG9wKSAqIChjdi5oZWlnaHQgLyByLmhlaWdodCkgfTsgfTtcbiAgY29uc3Qgc3RhcnQgPSAoZTogYW55KSA9PiB7IGRyYXdpbmcgPSB0cnVlOyBjb25zdCBwID0gcG9zKGUpOyBseCA9IHAueDsgbHkgPSBwLnk7IGUucHJldmVudERlZmF1bHQoKTsgfTtcbiAgY29uc3QgbW92ZSA9IChlOiBhbnkpID0+IHsgaWYgKCFkcmF3aW5nKSByZXR1cm47IGNvbnN0IHAgPSBwb3MoZSk7IGN0eC5iZWdpblBhdGgoKTsgY3R4Lm1vdmVUbyhseCwgbHkpOyBjdHgubGluZVRvKHAueCwgcC55KTsgY3R4LnN0cm9rZSgpOyBseCA9IHAueDsgbHkgPSBwLnk7IEFHUl9TSUdOX0RSQVdOID0gdHJ1ZTsgZS5wcmV2ZW50RGVmYXVsdCgpOyB9O1xuICBjb25zdCBlbmQgPSAoKSA9PiB7IGRyYXdpbmcgPSBmYWxzZTsgfTtcbiAgY3Yub25tb3VzZWRvd24gPSBzdGFydDsgY3Yub25tb3VzZW1vdmUgPSBtb3ZlOyB3aW5kb3cub25tb3VzZXVwID0gZW5kO1xuICBjdi5vbnRvdWNoc3RhcnQgPSBzdGFydDsgY3Yub250b3VjaG1vdmUgPSBtb3ZlOyBjdi5vbnRvdWNoZW5kID0gZW5kO1xufVxuZnVuY3Rpb24gYWdyU2lnbkNsZWFyKCk6IHZvaWQgeyBjb25zdCBjdiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhZ3Itc2lnbi1wYWQnKSBhcyBIVE1MQ2FudmFzRWxlbWVudCB8IG51bGw7IGlmICghY3YpIHJldHVybjsgY29uc3QgY3R4ID0gY3YuZ2V0Q29udGV4dCgnMmQnKTsgaWYgKGN0eCkgY3R4LmNsZWFyUmVjdCgwLCAwLCBjdi53aWR0aCwgY3YuaGVpZ2h0KTsgQUdSX1NJR05fRFJBV04gPSBmYWxzZTsgfVxuYXN5bmMgZnVuY3Rpb24gYWdyU2lnblN1Ym1pdChjaWQ6IHN0cmluZywgZW50cnlJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IG1vZGFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fYWdyU2lnbk1vZGFsJyk7IGlmICghbW9kYWwpIHJldHVybjtcbiAgY29uc3QgY29uc2VudCA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJyNhZ3Itc2lnbi1jb25zZW50JykgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XG4gIGNvbnN0IGVyciA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC1lcnInKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGNvbnN0IGN2ID0gbW9kYWwucXVlcnlTZWxlY3RvcignI2Fnci1zaWduLXBhZCcpIGFzIEhUTUxDYW52YXNFbGVtZW50IHwgbnVsbDtcbiAgY29uc3Qgc3RhdHVzID0gbW9kYWwucXVlcnlTZWxlY3RvcignLm1vZGFsLXN0YXR1cycpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgaWYgKCFjb25zZW50IHx8ICFjb25zZW50LmNoZWNrZWQpIHsgaWYgKGVycikgeyBlcnIudGV4dENvbnRlbnQgPSAnUGxlYXNlIGNoZWNrIHRoZSBjb25zZW50IGJveC4nOyBlcnIuaGlkZGVuID0gZmFsc2U7IH0gcmV0dXJuOyB9XG4gIGlmICghQUdSX1NJR05fRFJBV04pIHsgaWYgKGVycikgeyBlcnIudGV4dENvbnRlbnQgPSAnUGxlYXNlIGRyYXcgeW91ciBzaWduYXR1cmUuJzsgZXJyLmhpZGRlbiA9IGZhbHNlOyB9IHJldHVybjsgfVxuICBpZiAoc3RhdHVzKSBzdGF0dXMudGV4dENvbnRlbnQgPSAnU2lnbmluZ1x1MjAyNic7XG4gIHRyeSB7XG4gICAgYXdhaXQgYXBpQ291bnRlcnNpZ25BZ3JlZW1lbnQoY2lkLCBlbnRyeUlkLCBjdiA/IGN2LnRvRGF0YVVSTCgnaW1hZ2UvcG5nJykgOiAnJyk7XG4gICAgYWdyU2lnbkNsb3NlKCk7XG4gICAgYXdhaXQgbG9hZEFncmVlbWVudHMoY2lkLCB0cnVlKTtcbiAgICB0b2FzdCgnU2lnbmVkLicpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBpZiAoc3RhdHVzKSBzdGF0dXMudGV4dENvbnRlbnQgPSAnJztcbiAgICBpZiAoZXJyKSB7IGVyci50ZXh0Q29udGVudCA9IGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpOyBlcnIuaGlkZGVuID0gZmFsc2U7IH1cbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBd0JBLE1BQU0sWUFBOEMsQ0FBQztBQUNyRCxJQUFJLGdCQUE4QjtBQUVsQyxTQUFTLFNBQVMsS0FBdUI7QUFDdkMsTUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFHLFdBQVUsR0FBRyxJQUFJLEVBQUUsTUFBTSxNQUFNLFNBQVMsT0FBTyxPQUFPLEtBQUs7QUFDaEYsU0FBTyxVQUFVLEdBQUc7QUFDdEI7QUFFQSxlQUFlLGVBQWUsS0FBYSxRQUFRLE9BQXNCO0FB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
