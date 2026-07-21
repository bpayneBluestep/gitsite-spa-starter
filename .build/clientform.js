const NEW_CLIENT_FIELDS = [
  { k: "firstName", label: "First name", req: true },
  { k: "lastName", label: "Last name", req: true },
  { k: "prefName", label: "Preferred name" },
  { k: "email", label: "Email", full: true, placeholder: "name@example.com" },
  { k: "cell", label: "Cell phone", placeholder: "(555) 555-0123" },
  { k: "homePhone", label: "Home phone" },
  { k: "homeCity", label: "City" },
  { k: "homeState", label: "State" }
];
function newClientModalHtml(entity, label) {
  const fields = NEW_CLIENT_FIELDS.map((f) => `
    <div class="field ${f.full ? "full" : ""}">
      <label>${esc(f.label)}${f.req ? '<span class="req">*</span>' : ""}</label>
      <input data-k="${f.k}" placeholder="${esc(f.placeholder || "")}" autocomplete="off">
    </div>`).join("");
  const lc = label.toLowerCase();
  return `<div class="modal-card" role="dialog" aria-modal="true" aria-label="New ${esc(lc)}" data-entity="${esc(entity)}" data-label="${esc(label)}">
    <div class="modal-head">
      <div><b>New ${esc(label)}</b><p>Create ${lc === "inquiry" ? "an" : "a"} ${esc(lc)} record. You can fill in the rest later.</p></div>
      <button class="ico-x js-cancel" title="Close" onclick="closeNewClient()">${ic("x", 18)}</button>
    </div>
    <div class="modal-body">
      <div class="modal-err" hidden></div>
      <div class="field-grid">${fields}</div>
    </div>
    <div class="modal-foot">
      <span class="modal-status"></span>
      <span style="flex:1"></span>
      <button class="btn ghost js-cancel" onclick="closeNewClient()">${ic("x", 15)} Cancel</button>
      <button class="btn primary js-save" onclick="submitNewClient()">${ic("plus", 15)} Create ${esc(lc)}</button>
    </div>
  </div>`;
}
function openNewClient(entity) {
  if (document.getElementById("__newClientModal")) return;
  const ent = entity || "client";
  const label = ent === "inquiry" ? "Inquiry" : ent === "alumni" ? "Alumnus" : "Client";
  const host = document.createElement("div");
  host.className = "modal-overlay";
  host.id = "__newClientModal";
  host.innerHTML = newClientModalHtml(ent, label);
  host.addEventListener("mousedown", (e) => {
    if (e.target === host) closeNewClient();
  });
  document.body.appendChild(host);
  const first = host.querySelector('input[data-k="firstName"]');
  if (first) first.focus();
  document.addEventListener("keydown", escClose);
}
function escClose(e) {
  if (e.key === "Escape") closeNewClient();
}
function closeNewClient() {
  const m = document.getElementById("__newClientModal");
  if (m) m.remove();
  document.removeEventListener("keydown", escClose);
}
function setModalError(msg) {
  const el = document.querySelector("#__newClientModal .modal-err");
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}
async function submitNewClient() {
  const modal = document.getElementById("__newClientModal");
  if (!modal) return;
  const card = modal.querySelector(".modal-card");
  const entity = card && card.getAttribute("data-entity") || "client";
  const label = card && card.getAttribute("data-label") || "Client";
  const data = {};
  modal.querySelectorAll("input[data-k]").forEach((el) => {
    const inp = el;
    data[inp.dataset.k] = inp.value.trim();
  });
  setModalError("");
  if (!data.firstName || !data.lastName) {
    setModalError("First name and last name are required.");
    return;
  }
  const saveBtn = modal.querySelector(".js-save");
  const status = modal.querySelector(".modal-status");
  if (saveBtn) saveBtn.disabled = true;
  if (status) status.textContent = "Saving\u2026";
  try {
    const created = await apiCreatePerson(entity, data);
    closeNewClient();
    if (entity === "inquiry") await loadInquiries(true);
    else if (entity === "alumni") await loadAlumni(true);
    else await loadClients(true);
    toast(label + " created \u2014 " + data.firstName + " " + data.lastName + " (#" + (created.shortId || "?") + ")");
  } catch (e) {
    if (saveBtn) saveBtn.disabled = false;
    if (status) status.textContent = "";
    setModalError(e && e.message ? e.message : String(e));
  }
}
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = ic("check", 16) + "<span>" + esc(msg) + "</span>";
  document.body.appendChild(t);
  setTimeout(() => {
    t.classList.add("show");
  }, 10);
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 250);
  }, 4200);
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiY2xpZW50Zm9ybS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICBjbGllbnRmb3JtLnRzIFx1MjAxNCBcIk5ldyBDbGllbnRcIiBtb2RhbCArIHRvYXN0LlxuICAgQ29sbGVjdHMgdGhlIGZpZWxkcyB0aGUgYmFzaWMgQ2xpZW50IGZvcm0gc3VwcG9ydHMgdG9kYXksIFBPU1RzIHRoZW0gdG9cbiAgIHRoZSBtYWVzdHJvIChhcGkudHMgLT4gL2IvbWFlc3RybyBjcmVhdGVDbGllbnQpLCBhbmQgb24gc3VjY2VzcyBvcHRpbWlzdGljYWxseVxuICAgcHJlcGVuZHMgdGhlIG5ldyBjbGllbnQgdG8gdGhlIGxpc3QgYW5kIHJlLXJlbmRlcnMuXG4gICBOT1RFOiBpbmplY3RlZCBpbnB1dHMgdXNlIGRhdGEtaywgbmV2ZXIgYG5hbWVgIFx1MjAxNCBhIG5hbWVkIGNvbnRyb2wgaW5zaWRlIHRoZVxuICAgbWVyZ2UtcmVwb3J0IGZvcm0gd291bGQgYmUgc3VibWl0dGVkIGFuZCB0cmlnZ2VyIFwicHJvYmxlbSBzdG9yaW5nIHRoZSBkYXRhXCIuXG4gICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuY29uc3QgTkVXX0NMSUVOVF9GSUVMRFM6IHsgazogc3RyaW5nOyBsYWJlbDogc3RyaW5nOyByZXE/OiBib29sZWFuOyBmdWxsPzogYm9vbGVhbjsgcGxhY2Vob2xkZXI/OiBzdHJpbmcgfVtdID0gW1xuICB7IGs6ICdmaXJzdE5hbWUnLCBsYWJlbDogJ0ZpcnN0IG5hbWUnLCByZXE6IHRydWUgfSxcbiAgeyBrOiAnbGFzdE5hbWUnLCBsYWJlbDogJ0xhc3QgbmFtZScsIHJlcTogdHJ1ZSB9LFxuICB7IGs6ICdwcmVmTmFtZScsIGxhYmVsOiAnUHJlZmVycmVkIG5hbWUnIH0sXG4gIHsgazogJ2VtYWlsJywgbGFiZWw6ICdFbWFpbCcsIGZ1bGw6IHRydWUsIHBsYWNlaG9sZGVyOiAnbmFtZUBleGFtcGxlLmNvbScgfSxcbiAgeyBrOiAnY2VsbCcsIGxhYmVsOiAnQ2VsbCBwaG9uZScsIHBsYWNlaG9sZGVyOiAnKDU1NSkgNTU1LTAxMjMnIH0sXG4gIHsgazogJ2hvbWVQaG9uZScsIGxhYmVsOiAnSG9tZSBwaG9uZScgfSxcbiAgeyBrOiAnaG9tZUNpdHknLCBsYWJlbDogJ0NpdHknIH0sXG4gIHsgazogJ2hvbWVTdGF0ZScsIGxhYmVsOiAnU3RhdGUnIH0sXG5dO1xuXG5mdW5jdGlvbiBuZXdDbGllbnRNb2RhbEh0bWwoZW50aXR5OiBzdHJpbmcsIGxhYmVsOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBmaWVsZHMgPSBORVdfQ0xJRU5UX0ZJRUxEUy5tYXAoZiA9PiBgXG4gICAgPGRpdiBjbGFzcz1cImZpZWxkICR7Zi5mdWxsID8gJ2Z1bGwnIDogJyd9XCI+XG4gICAgICA8bGFiZWw+JHtlc2MoZi5sYWJlbCl9JHtmLnJlcSA/ICc8c3BhbiBjbGFzcz1cInJlcVwiPio8L3NwYW4+JyA6ICcnfTwvbGFiZWw+XG4gICAgICA8aW5wdXQgZGF0YS1rPVwiJHtmLmt9XCIgcGxhY2Vob2xkZXI9XCIke2VzYyhmLnBsYWNlaG9sZGVyIHx8ICcnKX1cIiBhdXRvY29tcGxldGU9XCJvZmZcIj5cbiAgICA8L2Rpdj5gKS5qb2luKCcnKTtcbiAgY29uc3QgbGMgPSBsYWJlbC50b0xvd2VyQ2FzZSgpO1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJtb2RhbC1jYXJkXCIgcm9sZT1cImRpYWxvZ1wiIGFyaWEtbW9kYWw9XCJ0cnVlXCIgYXJpYS1sYWJlbD1cIk5ldyAke2VzYyhsYyl9XCIgZGF0YS1lbnRpdHk9XCIke2VzYyhlbnRpdHkpfVwiIGRhdGEtbGFiZWw9XCIke2VzYyhsYWJlbCl9XCI+XG4gICAgPGRpdiBjbGFzcz1cIm1vZGFsLWhlYWRcIj5cbiAgICAgIDxkaXY+PGI+TmV3ICR7ZXNjKGxhYmVsKX08L2I+PHA+Q3JlYXRlICR7bGMgPT09ICdpbnF1aXJ5JyA/ICdhbicgOiAnYSd9ICR7ZXNjKGxjKX0gcmVjb3JkLiBZb3UgY2FuIGZpbGwgaW4gdGhlIHJlc3QgbGF0ZXIuPC9wPjwvZGl2PlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImljby14IGpzLWNhbmNlbFwiIHRpdGxlPVwiQ2xvc2VcIiBvbmNsaWNrPVwiY2xvc2VOZXdDbGllbnQoKVwiPiR7aWMoJ3gnLCAxOCl9PC9idXR0b24+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cIm1vZGFsLWJvZHlcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1lcnJcIiBoaWRkZW4+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiZmllbGQtZ3JpZFwiPiR7ZmllbGRzfTwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1mb290XCI+XG4gICAgICA8c3BhbiBjbGFzcz1cIm1vZGFsLXN0YXR1c1wiPjwvc3Bhbj5cbiAgICAgIDxzcGFuIHN0eWxlPVwiZmxleDoxXCI+PC9zcGFuPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdCBqcy1jYW5jZWxcIiBvbmNsaWNrPVwiY2xvc2VOZXdDbGllbnQoKVwiPiR7aWMoJ3gnLCAxNSl9IENhbmNlbDwvYnV0dG9uPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBwcmltYXJ5IGpzLXNhdmVcIiBvbmNsaWNrPVwic3VibWl0TmV3Q2xpZW50KClcIj4ke2ljKCdwbHVzJywgMTUpfSBDcmVhdGUgJHtlc2MobGMpfTwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICA8L2Rpdj5gO1xufVxuXG5mdW5jdGlvbiBvcGVuTmV3Q2xpZW50KGVudGl0eT86IHN0cmluZyk6IHZvaWQge1xuICBpZiAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fbmV3Q2xpZW50TW9kYWwnKSkgcmV0dXJuO1xuICBjb25zdCBlbnQgPSBlbnRpdHkgfHwgJ2NsaWVudCc7XG4gIGNvbnN0IGxhYmVsID0gZW50ID09PSAnaW5xdWlyeScgPyAnSW5xdWlyeScgOiBlbnQgPT09ICdhbHVtbmknID8gJ0FsdW1udXMnIDogJ0NsaWVudCc7XG4gIGNvbnN0IGhvc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgaG9zdC5jbGFzc05hbWUgPSAnbW9kYWwtb3ZlcmxheSc7XG4gIGhvc3QuaWQgPSAnX19uZXdDbGllbnRNb2RhbCc7XG4gIGhvc3QuaW5uZXJIVE1MID0gbmV3Q2xpZW50TW9kYWxIdG1sKGVudCwgbGFiZWwpO1xuICAvLyBjbGljayBvbiB0aGUgYmFja2Ryb3AgKG5vdCB0aGUgY2FyZCkgY2xvc2VzXG4gIGhvc3QuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgZSA9PiB7IGlmIChlLnRhcmdldCA9PT0gaG9zdCkgY2xvc2VOZXdDbGllbnQoKTsgfSk7XG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaG9zdCk7XG4gIGNvbnN0IGZpcnN0ID0gaG9zdC5xdWVyeVNlbGVjdG9yKCdpbnB1dFtkYXRhLWs9XCJmaXJzdE5hbWVcIl0nKSBhcyBIVE1MSW5wdXRFbGVtZW50IHwgbnVsbDtcbiAgaWYgKGZpcnN0KSBmaXJzdC5mb2N1cygpO1xuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZXNjQ2xvc2UpO1xufVxuXG5mdW5jdGlvbiBlc2NDbG9zZShlOiBLZXlib2FyZEV2ZW50KTogdm9pZCB7IGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIGNsb3NlTmV3Q2xpZW50KCk7IH1cblxuZnVuY3Rpb24gY2xvc2VOZXdDbGllbnQoKTogdm9pZCB7XG4gIGNvbnN0IG0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19uZXdDbGllbnRNb2RhbCcpO1xuICBpZiAobSkgbS5yZW1vdmUoKTtcbiAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGVzY0Nsb3NlKTtcbn1cblxuZnVuY3Rpb24gc2V0TW9kYWxFcnJvcihtc2c6IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNfX25ld0NsaWVudE1vZGFsIC5tb2RhbC1lcnInKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmICghZWwpIHJldHVybjtcbiAgaWYgKG1zZykgeyBlbC50ZXh0Q29udGVudCA9IG1zZzsgZWwuaGlkZGVuID0gZmFsc2U7IH0gZWxzZSB7IGVsLnRleHRDb250ZW50ID0gJyc7IGVsLmhpZGRlbiA9IHRydWU7IH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc3VibWl0TmV3Q2xpZW50KCk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBtb2RhbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX25ld0NsaWVudE1vZGFsJyk7XG4gIGlmICghbW9kYWwpIHJldHVybjtcbiAgY29uc3QgY2FyZCA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC1jYXJkJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBjb25zdCBlbnRpdHkgPSAoY2FyZCAmJiBjYXJkLmdldEF0dHJpYnV0ZSgnZGF0YS1lbnRpdHknKSkgfHwgJ2NsaWVudCc7XG4gIGNvbnN0IGxhYmVsID0gKGNhcmQgJiYgY2FyZC5nZXRBdHRyaWJ1dGUoJ2RhdGEtbGFiZWwnKSkgfHwgJ0NsaWVudCc7XG4gIGNvbnN0IGRhdGE6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgbW9kYWwucXVlcnlTZWxlY3RvckFsbCgnaW5wdXRbZGF0YS1rXScpLmZvckVhY2goZWwgPT4ge1xuICAgIGNvbnN0IGlucCA9IGVsIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgZGF0YVtpbnAuZGF0YXNldC5rIGFzIHN0cmluZ10gPSBpbnAudmFsdWUudHJpbSgpO1xuICB9KTtcbiAgc2V0TW9kYWxFcnJvcignJyk7XG4gIGlmICghZGF0YS5maXJzdE5hbWUgfHwgIWRhdGEubGFzdE5hbWUpIHsgc2V0TW9kYWxFcnJvcignRmlyc3QgbmFtZSBhbmQgbGFzdCBuYW1lIGFyZSByZXF1aXJlZC4nKTsgcmV0dXJuOyB9XG5cbiAgY29uc3Qgc2F2ZUJ0biA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJy5qcy1zYXZlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuICBjb25zdCBzdGF0dXMgPSBtb2RhbC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtc3RhdHVzJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoc2F2ZUJ0bikgc2F2ZUJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICdTYXZpbmdcdTIwMjYnO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgY3JlYXRlZCA9IGF3YWl0IGFwaUNyZWF0ZVBlcnNvbihlbnRpdHksIGRhdGEpO1xuICAgIGNsb3NlTmV3Q2xpZW50KCk7XG4gICAgLy8gcmUtcHVsbCB0aGUgbWF0Y2hpbmcgbGl2ZSBzdG9yZSBzbyB0aGUgbmV3IHJlY29yZCBhcHBlYXJzIGluIGl0cyB0YWJcbiAgICBpZiAoZW50aXR5ID09PSAnaW5xdWlyeScpIGF3YWl0IGxvYWRJbnF1aXJpZXModHJ1ZSk7XG4gICAgZWxzZSBpZiAoZW50aXR5ID09PSAnYWx1bW5pJykgYXdhaXQgbG9hZEFsdW1uaSh0cnVlKTtcbiAgICBlbHNlIGF3YWl0IGxvYWRDbGllbnRzKHRydWUpO1xuICAgIHRvYXN0KGxhYmVsICsgJyBjcmVhdGVkIFx1MjAxNCAnICsgZGF0YS5maXJzdE5hbWUgKyAnICcgKyBkYXRhLmxhc3ROYW1lICsgJyAoIycgKyAoY3JlYXRlZC5zaG9ydElkIHx8ICc/JykgKyAnKScpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBpZiAoc2F2ZUJ0bikgc2F2ZUJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICcnO1xuICAgIHNldE1vZGFsRXJyb3IoZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpO1xuICB9XG59XG5cbi8vIExpZ2h0d2VpZ2h0IHRyYW5zaWVudCB0b2FzdCAoYm90dG9tLXJpZ2h0KS5cbmZ1bmN0aW9uIHRvYXN0KG1zZzogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdC5jbGFzc05hbWUgPSAndG9hc3QnO1xuICB0LmlubmVySFRNTCA9IGljKCdjaGVjaycsIDE2KSArICc8c3Bhbj4nICsgZXNjKG1zZykgKyAnPC9zcGFuPic7XG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodCk7XG4gIHNldFRpbWVvdXQoKCkgPT4geyB0LmNsYXNzTGlzdC5hZGQoJ3Nob3cnKTsgfSwgMTApO1xuICBzZXRUaW1lb3V0KCgpID0+IHsgdC5jbGFzc0xpc3QucmVtb3ZlKCdzaG93Jyk7IHNldFRpbWVvdXQoKCkgPT4gdC5yZW1vdmUoKSwgMjUwKTsgfSwgNDIwMCk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFTQSxNQUFNLG9CQUF5RztBQUFBLEVBQzdHLEVBQUUsR0FBRyxhQUFhLE9BQU8sY0FBYyxLQUFLLEtBQUs7QUFBQSxFQUNqRCxFQUFFLEdBQUcsWUFBWSxPQUFPLGFBQWEsS0FBSyxLQUFLO0FBQUEsRUFDL0MsRUFBRSxHQUFHLFlBQVksT0FBTyxpQkFBaUI7QUFBQSxFQUN6QyxFQUFFLEdBQUcsU0FBUyxPQUFPLFNBQVMsTUFBTSxNQUFNLGFBQWEsbUJBQW1CO0FBQUEsRUFDMUUsRUFBRSxHQUFHLFFBQVEsT0FBTyxjQUFjLGFBQWEsaUJBQWlCO0FBQUEsRUFDaEUsRUFBRSxHQUFHLGFBQWEsT0FBTyxhQUFhO0FBQUEsRUFDdEMsRUFBRSxHQUFHLFlBQVksT0FBTyxPQUFPO0FBQUEsRUFDL0IsRUFBRSxHQUFHLGFBQWEsT0FBTyxRQUFRO0FBQ25DO0FBRUEsU0FBUyxtQkFBbUIsUUFBZ0IsT0FBdUI7QUFDakUsUUFBTSxTQUFTLGtCQUFrQixJQUFJLE9BQUs7QUFB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
