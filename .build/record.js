const SECTIONS = [
  { key: "summary", label: "Summary", standalone: true },
  { key: "files", label: "Files", standalone: true },
  { grp: "Profile", items: [
    { key: "name", label: "Name & Email" },
    { key: "demographics", label: "Demographics" },
    { key: "contact", label: "Contact Info" }
  ] },
  { grp: "Casework", items: [
    { key: "contacts", label: "Contacts" },
    { key: "application", label: "Parent Application" },
    { key: "communications", label: "Communications" },
    { key: "tasks", label: "Tasks" }
  ] },
  { grp: "Referrals", items: [{ key: "referrals", label: "Referrals" }] },
  { grp: "Agreements", items: [{ key: "agreements", label: "Agreements" }] }
];
const EDITABLE_SECTIONS = ["name", "demographics", "contact"];
const LIVE_SECTIONS = EDITABLE_SECTIONS.concat(["contacts", "application", "communications", "tasks", "referrals", "agreements"]);
function sectionLabel(k) {
  for (const s of SECTIONS) {
    if (s.standalone && s.key === k) return s.label;
    if (s.items) {
      for (const i of s.items) if (i.key === k) return i.label;
    }
  }
  return k;
}
function findClient(id) {
  const stores = [CLIENT_STORE, INQUIRY_STORE, ALUMNI_STORE];
  for (const s of stores) {
    const hit = (s || []).filter((c) => c.id === id)[0];
    if (hit) return hit;
  }
  return void 0;
}
const STAGE_DEFS = [
  { key: "inquiry", label: "Inquiry", noun: "Inquiry" },
  { key: "client", label: "Client", noun: "Client" },
  { key: "alumni", label: "Alumni", noun: "Alumnus" }
];
function stageNoun(entity) {
  const d = STAGE_DEFS.filter((s) => s.key === (entity || "client"))[0];
  return d ? d.noun : "Client";
}
function stageControl(c) {
  const cur = c.entity || "client";
  const steps = STAGE_DEFS.map((s) => {
    const active = s.key === cur;
    return `<button type="button" class="stage-step${active ? " active" : ""}"` + (active ? ' disabled aria-current="true"' : "") + ` onclick="moveStage('${esc(c.id)}','${s.key}')" title="${active ? "Current stage" : "Move to " + s.label}">${esc(s.label)}</button>`;
  }).join("");
  return `<div class="stage-ctl" role="group" aria-label="Lifecycle stage">${steps}</div>`;
}
async function moveStage(id, stage) {
  const c = findClient(id);
  if (!c) return;
  if ((c.entity || "client") === stage) return;
  const name = (c.first + " " + c.last).trim() || "Record";
  const noun = stageNoun(stage);
  try {
    const res = await apiSetStage(id, stage);
    const newStage = res && res.stage ? String(res.stage) : stage;
    await Promise.all([loadClients(true), loadInquiries(true), loadAlumni(true)]);
    if (typeof render === "function") render();
    toast(name + " moved to " + stageNoun(newStage));
  } catch (e) {
    toast("Could not move " + name + ": " + (e && e.message ? e.message : String(e)));
  }
}
function recordShell(c, activeSection, content) {
  let nav = "";
  SECTIONS.forEach((s) => {
    if (s.standalone) {
      nav += `<a href="#/clients/${c.id}/${s.key}" class="${activeSection === s.key ? "active" : ""}">${s.label}</a>`;
    } else {
      nav += `<div class="grp">${esc(s.grp)}</div>`;
      s.items.forEach((i) => {
        const live = LIVE_SECTIONS.indexOf(i.key) >= 0;
        nav += `<a href="#/clients/${c.id}/${i.key}" class="${activeSection === i.key ? "active" : ""}">${esc(i.label)}${live ? "" : '<span class="cnt soon">soon</span>'}</a>`;
      });
    }
  });
  const ctx = `<aside class="ctxbar">
    <div class="rec-head">
      <div class="rec-photo">${c.photoUrl ? `<img src="${esc(c.photoUrl)}" alt="${esc(c.first + " " + c.last)}">` : esc(initials(c.first, c.last))}</div>
      <div class="rec-name">${esc(c.last)}, ${esc(c.first)}</div>
      <div class="rec-sub">${val(c.gender) === dash ? stageNoun(c.entity) : esc(c.gender)}</div>
      <div style="margin-top:10px">${stageControl(c)}</div>
    </div>
    <nav class="ctxnav">${nav}</nav>
  </aside>`;
  const age = c.raw && c.raw.age ? String(c.raw.age) : c.dob ? String(ageOf(c.dob)) : "";
  const loc = [c.demo.city, c.demo.state].filter(Boolean).join(", ");
  const recCard = `<div class="card rec-card">
    <div class="top"><h2>${esc(c.last)}, ${esc(c.first)}</h2></div>
    <div class="kv-grid">
      <div class="kv"><span class="k">Preferred name</span><span class="v">${val(c.prefName)}</span></div>
      <div class="kv"><span class="k">DOB</span><span class="v">${fmtDate(c.dob) || dash}</span></div>
      <div class="kv"><span class="k">Age</span><span class="v">${age || dash}</span></div>
      <div class="kv"><span class="k">Pronouns</span><span class="v">${val(c.demo.pronouns)}</span></div>
      <div class="kv"><span class="k">Email</span><span class="v">${val(c.email)}</span></div>
      <div class="kv"><span class="k">Cell</span><span class="v">${val(c.cell)}</span></div>
      <div class="kv"><span class="k">Location</span><span class="v">${loc || dash}</span></div>
      <div class="kv"><span class="k">Consultant</span><span class="v">${esc(ME.first + " " + ME.last)}</span></div>
    </div></div>`;
  const main = `<main class="main"><div class="content">
    ${crumb([{ t: orgLabel(), h: "#/dashboard" }, { t: "Clients", h: "#/clients" }, { t: c.last + ", " + c.first, h: "#/clients/" + c.id }, { t: sectionLabel(activeSection) }])}
    ${recCard}
    ${content}
  </div></main>`;
  return topbar() + `<div class="body record-body">${sidebar("clients", true)}<div class="nav-scrim" onclick="closeNav()"></div>${ctx}${main}</div>`;
}
function summaryView(c) {
  const raw = c.raw || {};
  const loc = [c.demo.city, c.demo.state].filter(Boolean).join(", ");
  const race = Array.isArray(raw.race) && raw.race.length ? raw.race.map(esc).join(", ") : dash;
  return `
  <div class="section-head"><div><h3>Record Summary</h3><p>A read-only roll-up of ${esc(c.first)}'s live record. Use the form links to edit.</p></div>
    <button class="ico-mini danger" title="Delete client" aria-label="Delete client" onclick="confirmDeleteClient('${esc(c.id)}')">${ic("trash", 16)}</button></div>
  <div class="two-col">
    <div class="card sum-card">
      <div class="hd"><b>Name &amp; Email</b><a href="#/clients/${c.id}/name">Edit ${ic("chevR", 13)}</a></div>
      <div class="sum-row"><span class="k">Name</span><span class="v">${esc(c.last)}, ${esc(c.first)}</span></div>
      <div class="sum-row"><span class="k">Preferred name</span><span class="v">${val(c.prefName)}</span></div>
      <div class="sum-row"><span class="k">Email</span><span class="v">${val(c.email)}</span></div>
    </div>
    <div class="card sum-card">
      <div class="hd"><b>Demographics</b><a href="#/clients/${c.id}/demographics">Edit ${ic("chevR", 13)}</a></div>
      <div class="sum-row"><span class="k">Date of birth</span><span class="v">${fmtDate(c.dob) || dash}</span></div>
      <div class="sum-row"><span class="k">Gender identity</span><span class="v">${val(c.gender)}</span></div>
      <div class="sum-row"><span class="k">Pronouns</span><span class="v">${val(c.demo.pronouns)}</span></div>
      <div class="sum-row"><span class="k">Race</span><span class="v">${race}</span></div>
    </div>
    <div class="card sum-card">
      <div class="hd"><b>Contact Info</b><a href="#/clients/${c.id}/contact">Edit ${ic("chevR", 13)}</a></div>
      <div class="sum-row"><span class="k">Cell phone</span><span class="v">${val(c.cell)}</span></div>
      <div class="sum-row"><span class="k">Home phone</span><span class="v">${val(c.homePhone)}</span></div>
      <div class="sum-row"><span class="k">Location</span><span class="v">${loc || dash}</span></div>
      <div class="sum-row"><span class="k">Home ZIP</span><span class="v">${val(c.homeZip)}</span></div>
    </div>
  </div>`;
}
function confirmDeleteClient(id) {
  const c = findClient(id);
  if (!c || document.getElementById("__delClientModal")) return;
  const fullName = (c.first + " " + c.last).trim();
  const host = document.createElement("div");
  host.className = "modal-overlay";
  host.id = "__delClientModal";
  host.innerHTML = `<div class="modal-card danger-modal" role="dialog" aria-modal="true" aria-label="Delete client">
    <div class="modal-head">
      <div><b>${ic("alert", 18)} Delete ${esc(fullName)}?</b><p>This permanently deletes the entire client record.</p></div>
      <button class="ico-x js-cancel" title="Close" onclick="closeDeleteClient()">${ic("x", 18)}</button>
    </div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <div class="dz-warn">
        <p><b>This cannot be undone.</b> Deleting ${esc(fullName)} also removes all of their contacts, files, communications, tasks, and applications.</p>
        <p class="dz-confirm-label">Type <b>DELETE</b> below to confirm.</p>
        <input class="dz-confirm-input" data-k="confirm" placeholder="DELETE" autocomplete="off" oninput="delClientConfirmChanged()">
      </div>
    </div>
    <div class="modal-foot">
      <span class="modal-status"></span>
      <span style="flex:1"></span>
      <button class="btn ghost js-cancel" onclick="closeDeleteClient()">${ic("x", 15)} Cancel</button>
      <button class="btn danger js-del" disabled onclick="submitDeleteClient('${esc(id)}')">${ic("trash", 15)} Delete client</button>
    </div>
  </div>`;
  host.addEventListener("mousedown", (e) => {
    if (e.target === host) closeDeleteClient();
  });
  document.body.appendChild(host);
  const inp = host.querySelector(".dz-confirm-input");
  if (inp) inp.focus();
  document.addEventListener("keydown", delClientEsc);
}
function delClientEsc(e) {
  if (e.key === "Escape") closeDeleteClient();
}
function closeDeleteClient() {
  const m = document.getElementById("__delClientModal");
  if (m) m.remove();
  document.removeEventListener("keydown", delClientEsc);
}
function delClientConfirmChanged() {
  const modal = document.getElementById("__delClientModal");
  if (!modal) return;
  const inp = modal.querySelector(".dz-confirm-input");
  const btn = modal.querySelector(".js-del");
  if (!inp || !btn) return;
  btn.disabled = inp.value.trim().toUpperCase() !== "DELETE";
}
async function submitDeleteClient(id) {
  const modal = document.getElementById("__delClientModal");
  if (!modal) return;
  const c = findClient(id);
  const fullName = c ? (c.first + " " + c.last).trim() : "Client";
  const btn = modal.querySelector(".js-del");
  const cancel = modal.querySelector(".js-cancel");
  const status = modal.querySelector(".modal-status");
  const err = modal.querySelector(".modal-err");
  if (err) {
    err.textContent = "";
    err.hidden = true;
  }
  if (btn) btn.disabled = true;
  if (cancel) cancel.setAttribute("disabled", "true");
  if (status) status.textContent = "Deleting\u2026";
  try {
    await apiDeleteClient(id);
    closeDeleteClient();
    await loadClients(true);
    go("#/clients");
    toast("Client deleted \u2014 " + fullName);
  } catch (e) {
    if (btn) btn.disabled = false;
    if (cancel) cancel.removeAttribute("disabled");
    if (status) status.textContent = "";
    if (err) {
      err.textContent = e && e.message ? e.message : String(e);
      err.hidden = false;
    }
  }
}
function viewClient(id, section) {
  ensureList("client");
  ensureList("inquiry");
  ensureList("alumni");
  const c = findClient(id);
  if (!c) {
    const stillLoading = CLIENT_STORE === null || INQUIRY_STORE === null || ALUMNI_STORE === null || CLIENTS_LOADING || INQUIRIES_LOADING || ALUMNI_LOADING;
    if (stillLoading && !(CLIENTS_ERROR && INQUIRIES_ERROR && ALUMNI_ERROR)) {
      return shell("clients", loadingCard("Loading record\u2026"));
    }
  }
  if (!c) {
    return shell("clients", `${crumb([{ t: orgLabel(), h: "#/dashboard" }, { t: "Clients", h: "#/clients" }, { t: "Not found" }])}
      <div class="card"><div class="empty"><div class="ico">${ic("users", 22)}</div><b>Client not found</b>
      <p>No client matches this link. It may have been removed.</p>
      <a class="btn primary" href="#/clients">${ic("chevR", 15)} Back to Clients</a></div></div>`);
  }
  const sec = section || "summary";
  let content;
  if (sec === "summary") content = summaryView(c);
  else if (EDITABLE_SECTIONS.indexOf(sec) >= 0) content = editFormView(c, sec);
  else if (sec === "files") content = filesSection(c);
  else if (sec === "contacts") content = contactsSection(c);
  else if (sec === "application") content = applicationsSection(c);
  else if (sec === "communications") content = communicationsSection(c);
  else if (sec === "tasks") content = tasksSection(c);
  else if (sec === "referrals") content = referralsSection(c);
  else if (sec === "agreements") content = agreementsSection(c);
  else content = underConstruction(sectionLabel(sec), "");
  return recordShell(c, sec, content);
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsicmVjb3JkLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgIHJlY29yZC50cyBcdTIwMTQgdGhlIENsaWVudCByZWNvcmQgZGV0YWlsIHNjcmVlbi5cbiAgIFJvdXRlOiAjL2NsaWVudHMvPGlkPlsvPHNlY3Rpb24+XSAgXHUyMDE0IHRoZSBjbGllbnQncyBzeXN0ZW0gaWQgbGl2ZXMgaW4gdGhlXG4gICBVUkwgc28gdGhlIGxpbmsgaXMgc2hhcmVhYmxlIGFuZCBsYW5kcyBkaXJlY3RseSBvbiB0aGUgcmVjb3JkLlxuICAgU2hlbGwgbWlycm9ycyB0aGUgbW9ja3VwOiBjb2xsYXBzZWQgaWNvbiByYWlsICsgY29udGV4dHVhbCByZWNvcmQgc2lkZWJhclxuICAgKHBob3RvLCBuYW1lLCBzZWN0aW9uZWQgbmF2KSArIHBlcnNpc3RlbnQgcmVjb3JkIGhlYWRlciBjYXJkLlxuXG4gICBTZWN0aW9ucyBmYWxsIGluIHRocmVlIGJ1Y2tldHM6XG4gICAgIFx1MjAyMiBTdW1tYXJ5ICAgICAgICAgICAgXHUyMDE0IHJlYWQtb25seSByb2xsLXVwIG9mIHRoZSBsaXZlIHJlY29yZFxuICAgICBcdTIwMjIgRWRpdGFibGUgZm9ybXMgICAgIFx1MjAxNCBOYW1lICYgRW1haWwgXHUwMEI3IERlbW9ncmFwaGljcyBcdTAwQjcgQ29udGFjdCBJbmZvXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKDE6MSB3aXRoIHRoZSByZWFsIEJsdWVTdGVwIGZvcm1zOyBzZWUgZm9ybWVkaXQudHMpXG4gICAgIFx1MjAyMiBVbmRlciBjb25zdHJ1Y3Rpb24gXHUyMDE0IGV2ZXJ5dGhpbmcgd2l0aCBubyBiYWNraW5nIGZvcm0geWV0XG4gICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuaW50ZXJmYWNlIFJlY29yZFNlY3Rpb24geyBrZXk/OiBzdHJpbmc7IGxhYmVsPzogc3RyaW5nOyBzdGFuZGFsb25lPzogYm9vbGVhbjsgZ3JwPzogc3RyaW5nOyBpdGVtcz86IHsga2V5OiBzdHJpbmc7IGxhYmVsOiBzdHJpbmcgfVtdOyB9XG5jb25zdCBTRUNUSU9OUzogUmVjb3JkU2VjdGlvbltdID0gW1xuICB7IGtleTogJ3N1bW1hcnknLCBsYWJlbDogJ1N1bW1hcnknLCBzdGFuZGFsb25lOiB0cnVlIH0sXG4gIHsga2V5OiAnZmlsZXMnLCBsYWJlbDogJ0ZpbGVzJywgc3RhbmRhbG9uZTogdHJ1ZSB9LFxuICB7IGdycDogJ1Byb2ZpbGUnLCBpdGVtczogW1xuICAgIHsga2V5OiAnbmFtZScsIGxhYmVsOiAnTmFtZSAmIEVtYWlsJyB9LFxuICAgIHsga2V5OiAnZGVtb2dyYXBoaWNzJywgbGFiZWw6ICdEZW1vZ3JhcGhpY3MnIH0sXG4gICAgeyBrZXk6ICdjb250YWN0JywgbGFiZWw6ICdDb250YWN0IEluZm8nIH0sXG4gIF0gfSxcbiAgeyBncnA6ICdDYXNld29yaycsIGl0ZW1zOiBbXG4gICAgeyBrZXk6ICdjb250YWN0cycsIGxhYmVsOiAnQ29udGFjdHMnIH0sXG4gICAgeyBrZXk6ICdhcHBsaWNhdGlvbicsIGxhYmVsOiAnUGFyZW50IEFwcGxpY2F0aW9uJyB9LFxuICAgIHsga2V5OiAnY29tbXVuaWNhdGlvbnMnLCBsYWJlbDogJ0NvbW11bmljYXRpb25zJyB9LFxuICAgIHsga2V5OiAndGFza3MnLCBsYWJlbDogJ1Rhc2tzJyB9LFxuICBdIH0sXG4gIHsgZ3JwOiAnUmVmZXJyYWxzJywgaXRlbXM6IFt7IGtleTogJ3JlZmVycmFscycsIGxhYmVsOiAnUmVmZXJyYWxzJyB9XSB9LFxuICB7IGdycDogJ0FncmVlbWVudHMnLCBpdGVtczogW3sga2V5OiAnYWdyZWVtZW50cycsIGxhYmVsOiAnQWdyZWVtZW50cycgfV0gfSxcbl07XG5cbi8vIFdoaWNoIHNlY3Rpb25zIGFyZSByZWFsLCBlZGl0YWJsZSBmb3JtcyAocm91dGUgdG8gZWRpdEZvcm1WaWV3KS5cbmNvbnN0IEVESVRBQkxFX1NFQ1RJT05TID0gWyduYW1lJywgJ2RlbW9ncmFwaGljcycsICdjb250YWN0J107XG4vLyBTZWN0aW9ucyBiYWNrZWQgYnkgbGl2ZSBkYXRhIChubyBcInNvb25cIiBiYWRnZSkuIFN1cGVyc2V0IG9mIHRoZSBlZGl0YWJsZVxuLy8gZm9ybXMgXHUyMDE0IGFsc28gaW5jbHVkZXMgc2VjdGlvbnMgd2l0aCB0aGVpciBvd24gYmVzcG9rZSBVSSAoZS5nLiBDb250YWN0cykuXG5jb25zdCBMSVZFX1NFQ1RJT05TID0gRURJVEFCTEVfU0VDVElPTlMuY29uY2F0KFsnY29udGFjdHMnLCAnYXBwbGljYXRpb24nLCAnY29tbXVuaWNhdGlvbnMnLCAndGFza3MnLCAncmVmZXJyYWxzJywgJ2FncmVlbWVudHMnXSk7XG5cbmZ1bmN0aW9uIHNlY3Rpb25MYWJlbChrOiBzdHJpbmcpOiBzdHJpbmcge1xuICBmb3IgKGNvbnN0IHMgb2YgU0VDVElPTlMpIHtcbiAgICBpZiAocy5zdGFuZGFsb25lICYmIHMua2V5ID09PSBrKSByZXR1cm4gcy5sYWJlbCBhcyBzdHJpbmc7XG4gICAgaWYgKHMuaXRlbXMpIGZvciAoY29uc3QgaSBvZiBzLml0ZW1zKSBpZiAoaS5rZXkgPT09IGspIHJldHVybiBpLmxhYmVsO1xuICB9XG4gIHJldHVybiBrO1xufVxuXG4vLyBBIHJlY29yZCBjYW4gYmUgYSBDbGllbnQsIElucXVpcnksIG9yIEFsdW1udXMgXHUyMDE0IGFsbCBJbmRpdmlkdWFscy4gU2VhcmNoIGV2ZXJ5XG4vLyBwZXJzb24gc3RvcmUgc28gYW55IG9mIHRoZW0gb3BlbnMgdW5kZXIgdGhlIHNoYXJlZCAjL2NsaWVudHMvPGlkPiByb3V0ZS5cbmZ1bmN0aW9uIGZpbmRDbGllbnQoaWQ6IHN0cmluZyk6IENsaWVudCB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IHN0b3JlcyA9IFtDTElFTlRfU1RPUkUsIElOUVVJUllfU1RPUkUsIEFMVU1OSV9TVE9SRV07XG4gIGZvciAoY29uc3QgcyBvZiBzdG9yZXMpIHtcbiAgICBjb25zdCBoaXQgPSAocyB8fCBbXSkuZmlsdGVyKGMgPT4gYy5pZCA9PT0gaWQpWzBdO1xuICAgIGlmIChoaXQpIHJldHVybiBoaXQ7XG4gIH1cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIGxpZmVjeWNsZSBzdGFnZSBjb250cm9sIChJbnF1aXJ5IFx1MjE5MiBDbGllbnQgXHUyMTkyIEFsdW1uaSkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBUaGUgdGhyZWUgc3RhZ2VzIGFyZSBjdW11bGF0aXZlIGNhdGVnb3JpZXMgb24gb25lIEluZGl2aWR1YWwgcmVjb3JkLCBzbyBtb3Zpbmdcbi8vIGEgcGVyc29uIGlzIGp1c3QgcmUtdGFnZ2luZyBhIGNhdGVnb3J5IFx1MjAxNCBhbGwgdGhlaXIgZGF0YSBjYXJyaWVzIGZvcndhcmQuIFRoaXNcbi8vIHJlbmRlcnMgYSBzZWdtZW50ZWQgY29udHJvbCBpbiB0aGUgcmVjb3JkIGhlYWRlcjsgY2xpY2tpbmcgYSBkaWZmZXJlbnQgc3RhZ2Vcbi8vIG1vdmVzIHRoZSByZWNvcmQgdGhlcmUgYW5kIHJlZnJlc2hlcyB0aGUgbGlzdHMuXG5jb25zdCBTVEFHRV9ERUZTOiB7IGtleTogc3RyaW5nOyBsYWJlbDogc3RyaW5nOyBub3VuOiBzdHJpbmcgfVtdID0gW1xuICB7IGtleTogJ2lucXVpcnknLCBsYWJlbDogJ0lucXVpcnknLCBub3VuOiAnSW5xdWlyeScgfSxcbiAgeyBrZXk6ICdjbGllbnQnLCAgbGFiZWw6ICdDbGllbnQnLCAgbm91bjogJ0NsaWVudCcgfSxcbiAgeyBrZXk6ICdhbHVtbmknLCAgbGFiZWw6ICdBbHVtbmknLCAgbm91bjogJ0FsdW1udXMnIH0sXG5dO1xuZnVuY3Rpb24gc3RhZ2VOb3VuKGVudGl0eT86IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IGQgPSBTVEFHRV9ERUZTLmZpbHRlcihzID0+IHMua2V5ID09PSAoZW50aXR5IHx8ICdjbGllbnQnKSlbMF07XG4gIHJldHVybiBkID8gZC5ub3VuIDogJ0NsaWVudCc7XG59XG5mdW5jdGlvbiBzdGFnZUNvbnRyb2woYzogQ2xpZW50KTogc3RyaW5nIHtcbiAgY29uc3QgY3VyID0gYy5lbnRpdHkgfHwgJ2NsaWVudCc7XG4gIGNvbnN0IHN0ZXBzID0gU1RBR0VfREVGUy5tYXAocyA9PiB7XG4gICAgY29uc3QgYWN0aXZlID0gcy5rZXkgPT09IGN1cjtcbiAgICByZXR1cm4gYDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwic3RhZ2Utc3RlcCR7YWN0aXZlID8gJyBhY3RpdmUnIDogJyd9XCJgXG4gICAgICArIChhY3RpdmUgPyAnIGRpc2FibGVkIGFyaWEtY3VycmVudD1cInRydWVcIicgOiAnJylcbiAgICAgICsgYCBvbmNsaWNrPVwibW92ZVN0YWdlKCcke2VzYyhjLmlkKX0nLCcke3Mua2V5fScpXCJgXG4gICAgICArIGAgdGl0bGU9XCIke2FjdGl2ZSA/ICdDdXJyZW50IHN0YWdlJyA6ICdNb3ZlIHRvICcgKyBzLmxhYmVsfVwiPiR7ZXNjKHMubGFiZWwpfTwvYnV0dG9uPmA7XG4gIH0pLmpvaW4oJycpO1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJzdGFnZS1jdGxcIiByb2xlPVwiZ3JvdXBcIiBhcmlhLWxhYmVsPVwiTGlmZWN5Y2xlIHN0YWdlXCI+JHtzdGVwc308L2Rpdj5gO1xufVxuXG4vLyBNb3ZlIGEgcGVyc29uIHRvIGEgZGlmZmVyZW50IGxpZmVjeWNsZSBzdGFnZSwgdGhlbiByZWxvYWQgZXZlcnkgcGVyc29uIHN0b3JlIHNvXG4vLyB0YWIgbWVtYmVyc2hpcCArIGNvdW50cyBzdGF5IGNvcnJlY3QsIGFuZCByZS1yZW5kZXIuIE9uZS1jbGljayBhbmQgcmV2ZXJzaWJsZVxuLy8gKGNhdGVnb3JpZXMgYXJlIGFkZGl0aXZlL3JlbW92YWJsZSkgXHUyMDE0IG5vIGNvbmZpcm1hdGlvbiBuZWVkZWQuXG5hc3luYyBmdW5jdGlvbiBtb3ZlU3RhZ2UoaWQ6IHN0cmluZywgc3RhZ2U6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBjID0gZmluZENsaWVudChpZCk7XG4gIGlmICghYykgcmV0dXJuO1xuICBpZiAoKGMuZW50aXR5IHx8ICdjbGllbnQnKSA9PT0gc3RhZ2UpIHJldHVybjtcbiAgY29uc3QgbmFtZSA9IChjLmZpcnN0ICsgJyAnICsgYy5sYXN0KS50cmltKCkgfHwgJ1JlY29yZCc7XG4gIGNvbnN0IG5vdW4gPSBzdGFnZU5vdW4oc3RhZ2UpO1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGFwaVNldFN0YWdlKGlkLCBzdGFnZSk7XG4gICAgY29uc3QgbmV3U3RhZ2UgPSAocmVzICYmIHJlcy5zdGFnZSkgPyBTdHJpbmcocmVzLnN0YWdlKSA6IHN0YWdlO1xuICAgIGF3YWl0IFByb21pc2UuYWxsKFtsb2FkQ2xpZW50cyh0cnVlKSwgbG9hZElucXVpcmllcyh0cnVlKSwgbG9hZEFsdW1uaSh0cnVlKV0pO1xuICAgIGlmICh0eXBlb2YgcmVuZGVyID09PSAnZnVuY3Rpb24nKSByZW5kZXIoKTtcbiAgICB0b2FzdChuYW1lICsgJyBtb3ZlZCB0byAnICsgc3RhZ2VOb3VuKG5ld1N0YWdlKSk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIHRvYXN0KCdDb3VsZCBub3QgbW92ZSAnICsgbmFtZSArICc6ICcgKyAoKGUgJiYgZS5tZXNzYWdlKSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSkpO1xuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCByZWNvcmQgc2hlbGwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5mdW5jdGlvbiByZWNvcmRTaGVsbChjOiBDbGllbnQsIGFjdGl2ZVNlY3Rpb246IHN0cmluZywgY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IG5hdiA9ICcnO1xuICBTRUNUSU9OUy5mb3JFYWNoKHMgPT4ge1xuICAgIGlmIChzLnN0YW5kYWxvbmUpIHtcbiAgICAgIG5hdiArPSBgPGEgaHJlZj1cIiMvY2xpZW50cy8ke2MuaWR9LyR7cy5rZXl9XCIgY2xhc3M9XCIke2FjdGl2ZVNlY3Rpb24gPT09IHMua2V5ID8gJ2FjdGl2ZScgOiAnJ31cIj4ke3MubGFiZWx9PC9hPmA7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5hdiArPSBgPGRpdiBjbGFzcz1cImdycFwiPiR7ZXNjKHMuZ3JwIGFzIHN0cmluZyl9PC9kaXY+YDtcbiAgICAgIChzLml0ZW1zIGFzIHsga2V5OiBzdHJpbmc7IGxhYmVsOiBzdHJpbmcgfVtdKS5mb3JFYWNoKGkgPT4ge1xuICAgICAgICBjb25zdCBsaXZlID0gTElWRV9TRUNUSU9OUy5pbmRleE9mKGkua2V5KSA+PSAwO1xuICAgICAgICBuYXYgKz0gYDxhIGhyZWY9XCIjL2NsaWVudHMvJHtjLmlkfS8ke2kua2V5fVwiIGNsYXNzPVwiJHthY3RpdmVTZWN0aW9uID09PSBpLmtleSA/ICdhY3RpdmUnIDogJyd9XCI+JHtlc2MoaS5sYWJlbCl9JHtsaXZlID8gJycgOiAnPHNwYW4gY2xhc3M9XCJjbnQgc29vblwiPnNvb248L3NwYW4+J308L2E+YDtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgY29uc3QgY3R4ID0gYDxhc2lkZSBjbGFzcz1cImN0eGJhclwiPlxuICAgIDxkaXYgY2xhc3M9XCJyZWMtaGVhZFwiPlxuICAgICAgPGRpdiBjbGFzcz1cInJlYy1waG90b1wiPiR7Yy5waG90b1VybCA/IGA8aW1nIHNyYz1cIiR7ZXNjKGMucGhvdG9VcmwpfVwiIGFsdD1cIiR7ZXNjKGMuZmlyc3QgKyAnICcgKyBjLmxhc3QpfVwiPmAgOiBlc2MoaW5pdGlhbHMoYy5maXJzdCwgYy5sYXN0KSl9PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwicmVjLW5hbWVcIj4ke2VzYyhjLmxhc3QpfSwgJHtlc2MoYy5maXJzdCl9PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwicmVjLXN1YlwiPiR7dmFsKGMuZ2VuZGVyKSA9PT0gZGFzaCA/IHN0YWdlTm91bihjLmVudGl0eSkgOiBlc2MoYy5nZW5kZXIpfTwvZGl2PlxuICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6MTBweFwiPiR7c3RhZ2VDb250cm9sKGMpfTwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxuYXYgY2xhc3M9XCJjdHhuYXZcIj4ke25hdn08L25hdj5cbiAgPC9hc2lkZT5gO1xuXG4gIGNvbnN0IGFnZSA9IGMucmF3ICYmIGMucmF3LmFnZSA/IFN0cmluZyhjLnJhdy5hZ2UpIDogKGMuZG9iID8gU3RyaW5nKGFnZU9mKGMuZG9iKSkgOiAnJyk7XG4gIGNvbnN0IGxvYyA9IFtjLmRlbW8uY2l0eSwgYy5kZW1vLnN0YXRlXS5maWx0ZXIoQm9vbGVhbikuam9pbignLCAnKTtcbiAgY29uc3QgcmVjQ2FyZCA9IGA8ZGl2IGNsYXNzPVwiY2FyZCByZWMtY2FyZFwiPlxuICAgIDxkaXYgY2xhc3M9XCJ0b3BcIj48aDI+JHtlc2MoYy5sYXN0KX0sICR7ZXNjKGMuZmlyc3QpfTwvaDI+PC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cImt2LWdyaWRcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJrdlwiPjxzcGFuIGNsYXNzPVwia1wiPlByZWZlcnJlZCBuYW1lPC9zcGFuPjxzcGFuIGNsYXNzPVwidlwiPiR7dmFsKGMucHJlZk5hbWUpfTwvc3Bhbj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJrdlwiPjxzcGFuIGNsYXNzPVwia1wiPkRPQjwvc3Bhbj48c3BhbiBjbGFzcz1cInZcIj4ke2ZtdERhdGUoYy5kb2IpIHx8IGRhc2h9PC9zcGFuPjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImt2XCI+PHNwYW4gY2xhc3M9XCJrXCI+QWdlPC9zcGFuPjxzcGFuIGNsYXNzPVwidlwiPiR7YWdlIHx8IGRhc2h9PC9zcGFuPjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImt2XCI+PHNwYW4gY2xhc3M9XCJrXCI+UHJvbm91bnM8L3NwYW4+PHNwYW4gY2xhc3M9XCJ2XCI+JHt2YWwoYy5kZW1vLnByb25vdW5zKX08L3NwYW4+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwia3ZcIj48c3BhbiBjbGFzcz1cImtcIj5FbWFpbDwvc3Bhbj48c3BhbiBjbGFzcz1cInZcIj4ke3ZhbChjLmVtYWlsKX08L3NwYW4+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwia3ZcIj48c3BhbiBjbGFzcz1cImtcIj5DZWxsPC9zcGFuPjxzcGFuIGNsYXNzPVwidlwiPiR7dmFsKGMuY2VsbCl9PC9zcGFuPjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImt2XCI+PHNwYW4gY2xhc3M9XCJrXCI+TG9jYXRpb248L3NwYW4+PHNwYW4gY2xhc3M9XCJ2XCI+JHtsb2MgfHwgZGFzaH08L3NwYW4+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwia3ZcIj48c3BhbiBjbGFzcz1cImtcIj5Db25zdWx0YW50PC9zcGFuPjxzcGFuIGNsYXNzPVwidlwiPiR7ZXNjKE1FLmZpcnN0ICsgJyAnICsgTUUubGFzdCl9PC9zcGFuPjwvZGl2PlxuICAgIDwvZGl2PjwvZGl2PmA7XG5cbiAgY29uc3QgbWFpbiA9IGA8bWFpbiBjbGFzcz1cIm1haW5cIj48ZGl2IGNsYXNzPVwiY29udGVudFwiPlxuICAgICR7Y3J1bWIoW3sgdDogb3JnTGFiZWwoKSwgaDogJyMvZGFzaGJvYXJkJyB9LCB7IHQ6ICdDbGllbnRzJywgaDogJyMvY2xpZW50cycgfSwgeyB0OiBjLmxhc3QgKyAnLCAnICsgYy5maXJzdCwgaDogJyMvY2xpZW50cy8nICsgYy5pZCB9LCB7IHQ6IHNlY3Rpb25MYWJlbChhY3RpdmVTZWN0aW9uKSB9XSl9XG4gICAgJHtyZWNDYXJkfVxuICAgICR7Y29udGVudH1cbiAgPC9kaXY+PC9tYWluPmA7XG5cbiAgcmV0dXJuIHRvcGJhcigpICsgYDxkaXYgY2xhc3M9XCJib2R5IHJlY29yZC1ib2R5XCI+JHtzaWRlYmFyKCdjbGllbnRzJywgdHJ1ZSl9PGRpdiBjbGFzcz1cIm5hdi1zY3JpbVwiIG9uY2xpY2s9XCJjbG9zZU5hdigpXCI+PC9kaXY+JHtjdHh9JHttYWlufTwvZGl2PmA7XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBzZWN0aW9uOiBTdW1tYXJ5IChyZWFkLW9ubHkgcm9sbC11cCBvZiB0aGUgdGhyZWUgbGl2ZSBmb3JtcykgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5mdW5jdGlvbiBzdW1tYXJ5VmlldyhjOiBDbGllbnQpOiBzdHJpbmcge1xuICBjb25zdCByYXcgPSBjLnJhdyB8fCB7fTtcbiAgY29uc3QgbG9jID0gW2MuZGVtby5jaXR5LCBjLmRlbW8uc3RhdGVdLmZpbHRlcihCb29sZWFuKS5qb2luKCcsICcpO1xuICBjb25zdCByYWNlID0gQXJyYXkuaXNBcnJheShyYXcucmFjZSkgJiYgcmF3LnJhY2UubGVuZ3RoID8gcmF3LnJhY2UubWFwKGVzYykuam9pbignLCAnKSA6IGRhc2g7XG4gIHJldHVybiBgXG4gIDxkaXYgY2xhc3M9XCJzZWN0aW9uLWhlYWRcIj48ZGl2PjxoMz5SZWNvcmQgU3VtbWFyeTwvaDM+PHA+QSByZWFkLW9ubHkgcm9sbC11cCBvZiAke2VzYyhjLmZpcnN0KX0ncyBsaXZlIHJlY29yZC4gVXNlIHRoZSBmb3JtIGxpbmtzIHRvIGVkaXQuPC9wPjwvZGl2PlxuICAgIDxidXR0b24gY2xhc3M9XCJpY28tbWluaSBkYW5nZXJcIiB0aXRsZT1cIkRlbGV0ZSBjbGllbnRcIiBhcmlhLWxhYmVsPVwiRGVsZXRlIGNsaWVudFwiIG9uY2xpY2s9XCJjb25maXJtRGVsZXRlQ2xpZW50KCcke2VzYyhjLmlkKX0nKVwiPiR7aWMoJ3RyYXNoJywgMTYpfTwvYnV0dG9uPjwvZGl2PlxuICA8ZGl2IGNsYXNzPVwidHdvLWNvbFwiPlxuICAgIDxkaXYgY2xhc3M9XCJjYXJkIHN1bS1jYXJkXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiaGRcIj48Yj5OYW1lICZhbXA7IEVtYWlsPC9iPjxhIGhyZWY9XCIjL2NsaWVudHMvJHtjLmlkfS9uYW1lXCI+RWRpdCAke2ljKCdjaGV2UicsIDEzKX08L2E+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwic3VtLXJvd1wiPjxzcGFuIGNsYXNzPVwia1wiPk5hbWU8L3NwYW4+PHNwYW4gY2xhc3M9XCJ2XCI+JHtlc2MoYy5sYXN0KX0sICR7ZXNjKGMuZmlyc3QpfTwvc3Bhbj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJzdW0tcm93XCI+PHNwYW4gY2xhc3M9XCJrXCI+UHJlZmVycmVkIG5hbWU8L3NwYW4+PHNwYW4gY2xhc3M9XCJ2XCI+JHt2YWwoYy5wcmVmTmFtZSl9PC9zcGFuPjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cInN1bS1yb3dcIj48c3BhbiBjbGFzcz1cImtcIj5FbWFpbDwvc3Bhbj48c3BhbiBjbGFzcz1cInZcIj4ke3ZhbChjLmVtYWlsKX08L3NwYW4+PC9kaXY+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cImNhcmQgc3VtLWNhcmRcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJoZFwiPjxiPkRlbW9ncmFwaGljczwvYj48YSBocmVmPVwiIy9jbGllbnRzLyR7Yy5pZH0vZGVtb2dyYXBoaWNzXCI+RWRpdCAke2ljKCdjaGV2UicsIDEzKX08L2E+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwic3VtLXJvd1wiPjxzcGFuIGNsYXNzPVwia1wiPkRhdGUgb2YgYmlydGg8L3NwYW4+PHNwYW4gY2xhc3M9XCJ2XCI+JHtmbXREYXRlKGMuZG9iKSB8fCBkYXNofTwvc3Bhbj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJzdW0tcm93XCI+PHNwYW4gY2xhc3M9XCJrXCI+R2VuZGVyIGlkZW50aXR5PC9zcGFuPjxzcGFuIGNsYXNzPVwidlwiPiR7dmFsKGMuZ2VuZGVyKX08L3NwYW4+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwic3VtLXJvd1wiPjxzcGFuIGNsYXNzPVwia1wiPlByb25vdW5zPC9zcGFuPjxzcGFuIGNsYXNzPVwidlwiPiR7dmFsKGMuZGVtby5wcm9ub3Vucyl9PC9zcGFuPjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cInN1bS1yb3dcIj48c3BhbiBjbGFzcz1cImtcIj5SYWNlPC9zcGFuPjxzcGFuIGNsYXNzPVwidlwiPiR7cmFjZX08L3NwYW4+PC9kaXY+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cImNhcmQgc3VtLWNhcmRcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJoZFwiPjxiPkNvbnRhY3QgSW5mbzwvYj48YSBocmVmPVwiIy9jbGllbnRzLyR7Yy5pZH0vY29udGFjdFwiPkVkaXQgJHtpYygnY2hldlInLCAxMyl9PC9hPjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cInN1bS1yb3dcIj48c3BhbiBjbGFzcz1cImtcIj5DZWxsIHBob25lPC9zcGFuPjxzcGFuIGNsYXNzPVwidlwiPiR7dmFsKGMuY2VsbCl9PC9zcGFuPjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cInN1bS1yb3dcIj48c3BhbiBjbGFzcz1cImtcIj5Ib21lIHBob25lPC9zcGFuPjxzcGFuIGNsYXNzPVwidlwiPiR7dmFsKGMuaG9tZVBob25lKX08L3NwYW4+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwic3VtLXJvd1wiPjxzcGFuIGNsYXNzPVwia1wiPkxvY2F0aW9uPC9zcGFuPjxzcGFuIGNsYXNzPVwidlwiPiR7bG9jIHx8IGRhc2h9PC9zcGFuPjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cInN1bS1yb3dcIj48c3BhbiBjbGFzcz1cImtcIj5Ib21lIFpJUDwvc3Bhbj48c3BhbiBjbGFzcz1cInZcIj4ke3ZhbChjLmhvbWVaaXApfTwvc3Bhbj48L2Rpdj5cbiAgICA8L2Rpdj5cbiAgPC9kaXY+YDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIGRlbGV0ZSBjbGllbnQ6IGhhcmQgY29uZmlybWF0aW9uIG1vZGFsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZnVuY3Rpb24gY29uZmlybURlbGV0ZUNsaWVudChpZDogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGMgPSBmaW5kQ2xpZW50KGlkKTtcbiAgaWYgKCFjIHx8IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX2RlbENsaWVudE1vZGFsJykpIHJldHVybjtcbiAgY29uc3QgZnVsbE5hbWUgPSAoYy5maXJzdCArICcgJyArIGMubGFzdCkudHJpbSgpO1xuICBjb25zdCBob3N0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGhvc3QuY2xhc3NOYW1lID0gJ21vZGFsLW92ZXJsYXknO1xuICBob3N0LmlkID0gJ19fZGVsQ2xpZW50TW9kYWwnO1xuICBob3N0LmlubmVySFRNTCA9IGA8ZGl2IGNsYXNzPVwibW9kYWwtY2FyZCBkYW5nZXItbW9kYWxcIiByb2xlPVwiZGlhbG9nXCIgYXJpYS1tb2RhbD1cInRydWVcIiBhcmlhLWxhYmVsPVwiRGVsZXRlIGNsaWVudFwiPlxuICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1oZWFkXCI+XG4gICAgICA8ZGl2PjxiPiR7aWMoJ2FsZXJ0JywgMTgpfSBEZWxldGUgJHtlc2MoZnVsbE5hbWUpfT88L2I+PHA+VGhpcyBwZXJtYW5lbnRseSBkZWxldGVzIHRoZSBlbnRpcmUgY2xpZW50IHJlY29yZC48L3A+PC9kaXY+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiaWNvLXgganMtY2FuY2VsXCIgdGl0bGU9XCJDbG9zZVwiIG9uY2xpY2s9XCJjbG9zZURlbGV0ZUNsaWVudCgpXCI+JHtpYygneCcsIDE4KX08L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwibW9kYWwtYm9keVwiPlxuICAgICAgPGRpdiBjbGFzcz1cIm1vZGFsLWVyclwiIGhpZGRlbj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkei13YXJuXCI+XG4gICAgICAgIDxwPjxiPlRoaXMgY2Fubm90IGJlIHVuZG9uZS48L2I+IERlbGV0aW5nICR7ZXNjKGZ1bGxOYW1lKX0gYWxzbyByZW1vdmVzIGFsbCBvZiB0aGVpciBjb250YWN0cywgZmlsZXMsIGNvbW11bmljYXRpb25zLCB0YXNrcywgYW5kIGFwcGxpY2F0aW9ucy48L3A+XG4gICAgICAgIDxwIGNsYXNzPVwiZHotY29uZmlybS1sYWJlbFwiPlR5cGUgPGI+REVMRVRFPC9iPiBiZWxvdyB0byBjb25maXJtLjwvcD5cbiAgICAgICAgPGlucHV0IGNsYXNzPVwiZHotY29uZmlybS1pbnB1dFwiIGRhdGEtaz1cImNvbmZpcm1cIiBwbGFjZWhvbGRlcj1cIkRFTEVURVwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiIG9uaW5wdXQ9XCJkZWxDbGllbnRDb25maXJtQ2hhbmdlZCgpXCI+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwibW9kYWwtZm9vdFwiPlxuICAgICAgPHNwYW4gY2xhc3M9XCJtb2RhbC1zdGF0dXNcIj48L3NwYW4+XG4gICAgICA8c3BhbiBzdHlsZT1cImZsZXg6MVwiPjwvc3Bhbj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3QganMtY2FuY2VsXCIgb25jbGljaz1cImNsb3NlRGVsZXRlQ2xpZW50KClcIj4ke2ljKCd4JywgMTUpfSBDYW5jZWw8L2J1dHRvbj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZGFuZ2VyIGpzLWRlbFwiIGRpc2FibGVkIG9uY2xpY2s9XCJzdWJtaXREZWxldGVDbGllbnQoJyR7ZXNjKGlkKX0nKVwiPiR7aWMoJ3RyYXNoJywgMTUpfSBEZWxldGUgY2xpZW50PC9idXR0b24+XG4gICAgPC9kaXY+XG4gIDwvZGl2PmA7XG4gIGhvc3QuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgZSA9PiB7IGlmIChlLnRhcmdldCA9PT0gaG9zdCkgY2xvc2VEZWxldGVDbGllbnQoKTsgfSk7XG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaG9zdCk7XG4gIGNvbnN0IGlucCA9IGhvc3QucXVlcnlTZWxlY3RvcignLmR6LWNvbmZpcm0taW5wdXQnKSBhcyBIVE1MSW5wdXRFbGVtZW50IHwgbnVsbDtcbiAgaWYgKGlucCkgaW5wLmZvY3VzKCk7XG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBkZWxDbGllbnRFc2MpO1xufVxuXG5mdW5jdGlvbiBkZWxDbGllbnRFc2MoZTogS2V5Ym9hcmRFdmVudCk6IHZvaWQgeyBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSBjbG9zZURlbGV0ZUNsaWVudCgpOyB9XG5cbmZ1bmN0aW9uIGNsb3NlRGVsZXRlQ2xpZW50KCk6IHZvaWQge1xuICBjb25zdCBtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fZGVsQ2xpZW50TW9kYWwnKTtcbiAgaWYgKG0pIG0ucmVtb3ZlKCk7XG4gIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBkZWxDbGllbnRFc2MpO1xufVxuXG4vLyBFbmFibGUgdGhlIERlbGV0ZSBidXR0b24gb25seSB3aGVuIHRoZSB1c2VyIGhhcyB0eXBlZCB0aGUgZXhhY3Qgd29yZCBERUxFVEUuXG5mdW5jdGlvbiBkZWxDbGllbnRDb25maXJtQ2hhbmdlZCgpOiB2b2lkIHtcbiAgY29uc3QgbW9kYWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19kZWxDbGllbnRNb2RhbCcpO1xuICBpZiAoIW1vZGFsKSByZXR1cm47XG4gIGNvbnN0IGlucCA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJy5kei1jb25maXJtLWlucHV0JykgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XG4gIGNvbnN0IGJ0biA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJy5qcy1kZWwnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG4gIGlmICghaW5wIHx8ICFidG4pIHJldHVybjtcbiAgYnRuLmRpc2FibGVkID0gaW5wLnZhbHVlLnRyaW0oKS50b1VwcGVyQ2FzZSgpICE9PSAnREVMRVRFJztcbn1cblxuYXN5bmMgZnVuY3Rpb24gc3VibWl0RGVsZXRlQ2xpZW50KGlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgbW9kYWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19kZWxDbGllbnRNb2RhbCcpO1xuICBpZiAoIW1vZGFsKSByZXR1cm47XG4gIGNvbnN0IGMgPSBmaW5kQ2xpZW50KGlkKTtcbiAgY29uc3QgZnVsbE5hbWUgPSBjID8gKGMuZmlyc3QgKyAnICcgKyBjLmxhc3QpLnRyaW0oKSA6ICdDbGllbnQnO1xuICBjb25zdCBidG4gPSBtb2RhbC5xdWVyeVNlbGVjdG9yKCcuanMtZGVsJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuICBjb25zdCBjYW5jZWwgPSBtb2RhbC5xdWVyeVNlbGVjdG9yKCcuanMtY2FuY2VsJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuICBjb25zdCBzdGF0dXMgPSBtb2RhbC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtc3RhdHVzJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBjb25zdCBlcnIgPSBtb2RhbC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtZXJyJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoZXJyKSB7IGVyci50ZXh0Q29udGVudCA9ICcnOyBlcnIuaGlkZGVuID0gdHJ1ZTsgfVxuICBpZiAoYnRuKSBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICBpZiAoY2FuY2VsKSBjYW5jZWwuc2V0QXR0cmlidXRlKCdkaXNhYmxlZCcsICd0cnVlJyk7XG4gIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICdEZWxldGluZ1x1MjAyNic7XG4gIHRyeSB7XG4gICAgYXdhaXQgYXBpRGVsZXRlQ2xpZW50KGlkKTtcbiAgICBjbG9zZURlbGV0ZUNsaWVudCgpO1xuICAgIGF3YWl0IGxvYWRDbGllbnRzKHRydWUpOyAvLyByZS1wdWxsIHRoZSBsaXZlIGxpc3Qgc28gdGhlIHJlY29yZCBkaXNhcHBlYXJzXG4gICAgZ28oJyMvY2xpZW50cycpO1xuICAgIHRvYXN0KCdDbGllbnQgZGVsZXRlZCBcdTIwMTQgJyArIGZ1bGxOYW1lKTtcbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgaWYgKGJ0bikgYnRuLmRpc2FibGVkID0gZmFsc2U7XG4gICAgaWYgKGNhbmNlbCkgY2FuY2VsLnJlbW92ZUF0dHJpYnV0ZSgnZGlzYWJsZWQnKTtcbiAgICBpZiAoc3RhdHVzKSBzdGF0dXMudGV4dENvbnRlbnQgPSAnJztcbiAgICBpZiAoZXJyKSB7IGVyci50ZXh0Q29udGVudCA9IChlICYmIGUubWVzc2FnZSkgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSk7IGVyci5oaWRkZW4gPSBmYWxzZTsgfVxuICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBkaXNwYXRjaGVyIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuZnVuY3Rpb24gdmlld0NsaWVudChpZDogc3RyaW5nLCBzZWN0aW9uPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgLy8gVGhlIHJlY29yZCBtYXkgbGl2ZSBpbiBhbnkgb2YgdGhlIHRocmVlIHBlcnNvbiBzdG9yZXM7IGVuc3VyZSBhbGwgYXJlIGxvYWRpbmcuXG4gIGVuc3VyZUxpc3QoJ2NsaWVudCcpOyBlbnN1cmVMaXN0KCdpbnF1aXJ5Jyk7IGVuc3VyZUxpc3QoJ2FsdW1uaScpO1xuICBjb25zdCBjID0gZmluZENsaWVudChpZCk7XG4gIGlmICghYykge1xuICAgIC8vIFN0aWxsIHdhaXRpbmcgb24gb25lIG9yIG1vcmUgc3RvcmVzIFx1MjE5MiBzaG93IGEgbG9hZGVyLCBub3QgXCJub3QgZm91bmRcIi5cbiAgICBjb25zdCBzdGlsbExvYWRpbmcgPSBDTElFTlRfU1RPUkUgPT09IG51bGwgfHwgSU5RVUlSWV9TVE9SRSA9PT0gbnVsbCB8fCBBTFVNTklfU1RPUkUgPT09IG51bGxcbiAgICAgIHx8IENMSUVOVFNfTE9BRElORyB8fCBJTlFVSVJJRVNfTE9BRElORyB8fCBBTFVNTklfTE9BRElORztcbiAgICBpZiAoc3RpbGxMb2FkaW5nICYmICEoQ0xJRU5UU19FUlJPUiAmJiBJTlFVSVJJRVNfRVJST1IgJiYgQUxVTU5JX0VSUk9SKSkge1xuICAgICAgcmV0dXJuIHNoZWxsKCdjbGllbnRzJywgbG9hZGluZ0NhcmQoJ0xvYWRpbmcgcmVjb3JkXHUyMDI2JykpO1xuICAgIH1cbiAgfVxuICBpZiAoIWMpIHtcbiAgICByZXR1cm4gc2hlbGwoJ2NsaWVudHMnLCBgJHtjcnVtYihbeyB0OiBvcmdMYWJlbCgpLCBoOiAnIy9kYXNoYm9hcmQnIH0sIHsgdDogJ0NsaWVudHMnLCBoOiAnIy9jbGllbnRzJyB9LCB7IHQ6ICdOb3QgZm91bmQnIH1dKX1cbiAgICAgIDxkaXYgY2xhc3M9XCJjYXJkXCI+PGRpdiBjbGFzcz1cImVtcHR5XCI+PGRpdiBjbGFzcz1cImljb1wiPiR7aWMoJ3VzZXJzJywgMjIpfTwvZGl2PjxiPkNsaWVudCBub3QgZm91bmQ8L2I+XG4gICAgICA8cD5ObyBjbGllbnQgbWF0Y2hlcyB0aGlzIGxpbmsuIEl0IG1heSBoYXZlIGJlZW4gcmVtb3ZlZC48L3A+XG4gICAgICA8YSBjbGFzcz1cImJ0biBwcmltYXJ5XCIgaHJlZj1cIiMvY2xpZW50c1wiPiR7aWMoJ2NoZXZSJywgMTUpfSBCYWNrIHRvIENsaWVudHM8L2E+PC9kaXY+PC9kaXY+YCk7XG4gIH1cblxuICBjb25zdCBzZWMgPSBzZWN0aW9uIHx8ICdzdW1tYXJ5JztcbiAgbGV0IGNvbnRlbnQ6IHN0cmluZztcbiAgaWYgKHNlYyA9PT0gJ3N1bW1hcnknKSBjb250ZW50ID0gc3VtbWFyeVZpZXcoYyk7XG4gIGVsc2UgaWYgKEVESVRBQkxFX1NFQ1RJT05TLmluZGV4T2Yoc2VjKSA+PSAwKSBjb250ZW50ID0gZWRpdEZvcm1WaWV3KGMsIHNlYyk7XG4gIGVsc2UgaWYgKHNlYyA9PT0gJ2ZpbGVzJykgY29udGVudCA9IGZpbGVzU2VjdGlvbihjKTtcbiAgZWxzZSBpZiAoc2VjID09PSAnY29udGFjdHMnKSBjb250ZW50ID0gY29udGFjdHNTZWN0aW9uKGMpO1xuICBlbHNlIGlmIChzZWMgPT09ICdhcHBsaWNhdGlvbicpIGNvbnRlbnQgPSBhcHBsaWNhdGlvbnNTZWN0aW9uKGMpO1xuICBlbHNlIGlmIChzZWMgPT09ICdjb21tdW5pY2F0aW9ucycpIGNvbnRlbnQgPSBjb21tdW5pY2F0aW9uc1NlY3Rpb24oYyk7XG4gIGVsc2UgaWYgKHNlYyA9PT0gJ3Rhc2tzJykgY29udGVudCA9IHRhc2tzU2VjdGlvbihjKTtcbiAgZWxzZSBpZiAoc2VjID09PSAncmVmZXJyYWxzJykgY29udGVudCA9IHJlZmVycmFsc1NlY3Rpb24oYyk7XG4gIGVsc2UgaWYgKHNlYyA9PT0gJ2FncmVlbWVudHMnKSBjb250ZW50ID0gYWdyZWVtZW50c1NlY3Rpb24oYyk7XG4gIGVsc2UgY29udGVudCA9IHVuZGVyQ29uc3RydWN0aW9uKHNlY3Rpb25MYWJlbChzZWMpLCAnJyk7XG5cbiAgcmV0dXJuIHJlY29yZFNoZWxsKGMsIHNlYywgY29udGVudCk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFlQSxNQUFNLFdBQTRCO0FBQUEsRUFDaEMsRUFBRSxLQUFLLFdBQVcsT0FBTyxXQUFXLFlBQVksS0FBSztBQUFBLEVBQ3JELEVBQUUsS0FBSyxTQUFTLE9BQU8sU0FBUyxZQUFZLEtBQUs7QUFBQSxFQUNqRCxFQUFFLEtBQUssV0FBVyxPQUFPO0FBQUEsSUFDdkIsRUFBRSxLQUFLLFFBQVEsT0FBTyxlQUFlO0FBQUEsSUFDckMsRUFBRSxLQUFLLGdCQUFnQixPQUFPLGVBQWU7QUFBQSxJQUM3QyxFQUFFLEtBQUssV0FBVyxPQUFPLGVBQWU7QUFBQSxFQUMxQyxFQUFFO0FBQUEsRUFDRixFQUFFLEtBQUssWUFBWSxPQUFPO0FBQUEsSUFDeEIsRUFBRSxLQUFLLFlBQVksT0FBTyxXQUFXO0FBQUEsSUFDckMsRUFBRSxLQUFLLGVBQWUsT0FBTyxxQkFBcUI7QUFBQSxJQUNsRCxFQUFFLEtBQUssa0JBQWtCLE9BQU8saUJBQWlCO0FBQUEsSUFDakQs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
