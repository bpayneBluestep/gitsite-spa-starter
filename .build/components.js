const initials = (f, l) => (f[0] || "") + (l[0] || "");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const dash = '<span style="color:var(--muted-foreground)">\u2014</span>';
const val = (v) => v ? esc(v) : dash;
function ageOf(dob) {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 864e5));
}
function fmtDate(d) {
  if (!d) return null;
  return (/* @__PURE__ */ new Date(d + "T00:00:00")).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}
function clientPill(s) {
  return `<span class="pill ${CLIENT_STATUS[s] || "muted"}"><span class="dot"></span>${esc(s)}</span>`;
}
function plcPill(s) {
  return `<span class="pill ${PLC_STATUS[s] || "muted"}"><span class="dot"></span>${esc(s)}</span>`;
}
function avatar(f, l, size = 36, fs = 13, photoUrl) {
  const inner = photoUrl ? `<img src="${esc(photoUrl)}" alt="${esc((f + " " + l).trim())}">` : esc(initials(f, l));
  return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${fs}px">${inner}</span>`;
}
function sessionName() {
  return SESSION && SESSION.fullName ? SESSION.fullName : ME.first + " " + ME.last;
}
function sessionInitials() {
  const parts = sessionName().trim().split(/\s+/);
  return ((parts[0] || "")[0] || "") + ((parts[parts.length - 1] || "")[0] || "");
}
function orgLabel() {
  return SESSION && SESSION.orgName ? SESSION.orgName : ME.agency;
}
function orgInitials() {
  const parts = orgLabel().trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return ME.badge;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] || "") + (parts[parts.length - 1][0] || "")).toUpperCase();
}
function orgIdentity() {
  const logo = SESSION && SESSION.logoUrl ? SESSION.logoUrl : "";
  const mark = logo ? `<img class="org-logo-img" src="${esc(logo)}" alt="${esc(orgLabel())}">` : `<div class="org-badge">${esc(orgInitials())}</div>`;
  return `${mark}<div class="org-name">${esc(orgLabel())}</div>`;
}
function topbar() {
  const nm = sessionName();
  const tools = SESSION && SESSION.isSuper ? toolsMenu() : "";
  const mode = typeof getMode === "function" ? getMode() : "auto";
  const modeBtn = (v, label, icon) => `<button type="button" class="${mode === v ? "on" : ""}" onclick="pickMode('${v}')" title="${esc(label)}">${ic(icon, 14)}<span>${esc(label)}</span></button>`;
  return `<div class="topbar">
    <button class="ico-btn menu-btn" title="Menu" onclick="toggleNav()">${ic("menu", 20)}</button>
    ${orgIdentity()}
    <div class="spacer"></div>
    ${tools}
    <div class="tb-dd">
      <button class="user" onclick="toggleMenu(event,'tbUser')">
        <span class="avatar" style="width:28px;height:28px;font-size:11px">${esc(sessionInitials())}</span>
        <span class="hide-sm">${esc(nm)}</span> ${ic("chevD", 14)}</button>
      <div class="tb-menu tb-right" id="tbUser">
        <div class="tb-menu-head">${esc(nm)}</div>
        <a href="/shared/user/myprofile.jsp">${ic("user", 15)} My Account</a>
        <a href="#/email" onclick="closeAllMenus()">${ic("send", 15)} My Email</a>
        <div class="tb-sep"></div>
        <div class="tb-menu-head">Display mode</div>
        <div class="tb-mode-seg">${modeBtn("light", "Light", "sun")}${modeBtn("dark", "Dark", "moon")}${modeBtn("auto", "Auto", "laptop")}</div>
        <div class="tb-sep"></div>
        <a href="/shared/login/logout.jsp">${ic("logout", 15)} Logout</a>
      </div>
    </div>
  </div>`;
}
const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "dash" },
  { key: "clients", label: "Clients", icon: "users" },
  { key: "programs", label: "Programs", icon: "building" },
  { key: "settings", label: "Settings", icon: "settings" }
];
function sidebar(active, rail = false) {
  const locName = SESSION && SESSION.orgName ? SESSION.orgName : ME.agency;
  return `<aside class="sidebar ${rail ? "rail" : ""}">
    <button class="switcher" onclick="openLocationsMap()" title="Locations Map \u2014 ${esc(locName)}">${ic("map", 15)}<span class="lbl" style="display:flex;flex-direction:column">
      <span style="font-size:11px;font-weight:500;color:var(--muted-foreground)">Location</span>${esc(locName)}</span>
      <span class="chev">${ic("chevR", 14)}</span></button>
    <nav class="nav">
      ${NAV.map((n) => `<a href="#/${n.key}" class="${active === n.key ? "active" : ""}" title="${n.label}">${ic(n.icon, 18)}<span class="lbl">${n.label}</span></a>`).join("")}
    </nav>
    ${rail ? "" : `<div class="tip"><b>Tip \u2014</b> this is the primary navigation. Click any client row to open their record.</div>`}
  </aside>`;
}
function crumb(parts) {
  return `<div class="breadcrumb">${parts.map((p, i) => {
    const last = i === parts.length - 1;
    const sep = i > 0 ? ic("chevR", 14) : "";
    return sep + (last ? `<span class="cur">${esc(p.t)}</span>` : `<a href="${p.h}">${esc(p.t)}</a>`);
  }).join("")}</div>`;
}
function pageHead(title, desc, action = "") {
  return `<div class="page-head"><div><h1>${esc(title)}</h1>${desc ? `<p>${esc(desc)}</p>` : ""}</div>${action}</div>`;
}
function shell(active, content) {
  return topbar() + `<div class="body">${sidebar(active)}<div class="nav-scrim" onclick="closeNav()"></div><main class="main"><div class="content">${content}</div></main></div>`;
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiY29tcG9uZW50cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICBjb21wb25lbnRzLnRzIFx1MjAxNCBzaGFyZWQgaGVscGVycyArIGFwcC1zaGVsbCBwaWVjZXMuXG4gICB0b3BiYXIsIHNpZGViYXIsIGJyZWFkY3J1bWIsIHBhZ2UgaGVhZGVyLCBwaWxscywgYW5kIHRoZSBzaGVsbCB3cmFwcGVyXG4gICB0aGF0IGV2ZXJ5IHByaW1hcnktbmF2IHBhZ2UgcmVuZGVycyBpbnNpZGUuXG4gICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuLyogLS0tLSBoZWxwZXJzIC0tLS0gKi9cbmNvbnN0IGluaXRpYWxzID0gKGY6IHN0cmluZywgbDogc3RyaW5nKTogc3RyaW5nID0+IChmWzBdIHx8ICcnKSArIChsWzBdIHx8ICcnKTtcbmNvbnN0IGVzYyA9IChzOiB1bmtub3duKTogc3RyaW5nID0+XG4gIFN0cmluZyhzID09IG51bGwgPyAnJyA6IHMpLnJlcGxhY2UoL1smPD5cIl0vZywgYyA9PiAoeyAnJic6JyZhbXA7JywnPCc6JyZsdDsnLCc+JzonJmd0OycsJ1wiJzonJnF1b3Q7JyB9W2NdIGFzIHN0cmluZykpO1xuY29uc3QgZGFzaCA9ICc8c3BhbiBzdHlsZT1cImNvbG9yOnZhcigtLW11dGVkLWZvcmVncm91bmQpXCI+XHUyMDE0PC9zcGFuPic7XG5jb25zdCB2YWwgPSAodjogdW5rbm93bik6IHN0cmluZyA9PiAodiA/IGVzYyh2KSA6IGRhc2gpO1xuZnVuY3Rpb24gYWdlT2YoZG9iOiBzdHJpbmcpOiBudW1iZXIge1xuICByZXR1cm4gTWF0aC5mbG9vcigoRGF0ZS5ub3coKSAtIG5ldyBEYXRlKGRvYikuZ2V0VGltZSgpKSAvICgzNjUuMjUgKiA4NjRlNSkpO1xufVxuLy8gXCJZWVlZLU1NLUREXCIgLT4gXCJNb24gREQsIFlZWVlcIiAobnVsbC9lbXB0eSAtPiBudWxsIHNvIGNhbGxlcnMgY2FuIHNob3cgYSBkYXNoKS5cbmZ1bmN0aW9uIGZtdERhdGUoZDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gIGlmICghZCkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBuZXcgRGF0ZShkICsgJ1QwMDowMDowMCcpLnRvTG9jYWxlRGF0ZVN0cmluZygnZW4tVVMnLCB7IG1vbnRoOiAnc2hvcnQnLCBkYXk6ICcyLWRpZ2l0JywgeWVhcjogJ251bWVyaWMnIH0pO1xufVxuXG4vKiAtLS0tIHN0YXR1cyBwaWxscyAtLS0tICovXG5mdW5jdGlvbiBjbGllbnRQaWxsKHM6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgPHNwYW4gY2xhc3M9XCJwaWxsICR7Q0xJRU5UX1NUQVRVU1tzXSB8fCAnbXV0ZWQnfVwiPjxzcGFuIGNsYXNzPVwiZG90XCI+PC9zcGFuPiR7ZXNjKHMpfTwvc3Bhbj5gO1xufVxuZnVuY3Rpb24gcGxjUGlsbChzOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYDxzcGFuIGNsYXNzPVwicGlsbCAke1BMQ19TVEFUVVNbc10gfHwgJ211dGVkJ31cIj48c3BhbiBjbGFzcz1cImRvdFwiPjwvc3Bhbj4ke2VzYyhzKX08L3NwYW4+YDtcbn1cblxuLyogLS0tLSBhdmF0YXIgLS0tLSAqL1xuLy8gQ2lyY3VsYXIgYXZhdGFyLiBXaGVuIGBwaG90b1VybGAgaXMgcHJvdmlkZWQsIHRoZSB1cGxvYWRlZCBwaG90byBmaWxscyB0aGVcbi8vIGNpcmNsZSAob2JqZWN0LWZpdDogY292ZXIpOyBvdGhlcndpc2UgaXQgZmFsbHMgYmFjayB0byB0aGUgaW5pdGlhbHMuXG5mdW5jdGlvbiBhdmF0YXIoZjogc3RyaW5nLCBsOiBzdHJpbmcsIHNpemUgPSAzNiwgZnMgPSAxMywgcGhvdG9Vcmw/OiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBpbm5lciA9IHBob3RvVXJsXG4gICAgPyBgPGltZyBzcmM9XCIke2VzYyhwaG90b1VybCl9XCIgYWx0PVwiJHtlc2MoKGYgKyAnICcgKyBsKS50cmltKCkpfVwiPmBcbiAgICA6IGVzYyhpbml0aWFscyhmLCBsKSk7XG4gIHJldHVybiBgPHNwYW4gY2xhc3M9XCJhdmF0YXJcIiBzdHlsZT1cIndpZHRoOiR7c2l6ZX1weDtoZWlnaHQ6JHtzaXplfXB4O2ZvbnQtc2l6ZToke2ZzfXB4XCI+JHtpbm5lcn08L3NwYW4+YDtcbn1cblxuLyogLS0tLSB0b3AgYmFyIC0tLS0gKi9cbi8vIFJlYWwgbG9nZ2VkLWluIG5hbWUgKGZhbGxzIGJhY2sgdG8gdGhlIGRlbW8gY29uc3VsdGFudCB1bnRpbCB0aGUgc2Vzc2lvbiBsb2FkcykuXG5mdW5jdGlvbiBzZXNzaW9uTmFtZSgpOiBzdHJpbmcge1xuICByZXR1cm4gU0VTU0lPTiAmJiBTRVNTSU9OLmZ1bGxOYW1lID8gU0VTU0lPTi5mdWxsTmFtZSA6IChNRS5maXJzdCArICcgJyArIE1FLmxhc3QpO1xufVxuZnVuY3Rpb24gc2Vzc2lvbkluaXRpYWxzKCk6IHN0cmluZyB7XG4gIGNvbnN0IHBhcnRzID0gc2Vzc2lvbk5hbWUoKS50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgcmV0dXJuICgocGFydHNbMF0gfHwgJycpWzBdIHx8ICcnKSArICgocGFydHNbcGFydHMubGVuZ3RoIC0gMV0gfHwgJycpWzBdIHx8ICcnKTtcbn1cbi8vIFJlYWwgb3JnYW5pemF0aW9uIG5hbWUgKGZhbGxzIGJhY2sgdG8gdGhlIGRlbW8gYWdlbmN5IHVudGlsIHRoZSBzZXNzaW9uIGxvYWRzKS5cbmZ1bmN0aW9uIG9yZ0xhYmVsKCk6IHN0cmluZyB7XG4gIHJldHVybiBTRVNTSU9OICYmIFNFU1NJT04ub3JnTmFtZSA/IFNFU1NJT04ub3JnTmFtZSA6IE1FLmFnZW5jeTtcbn1cbi8vIEluaXRpYWxzIGRlcml2ZWQgZnJvbSB0aGUgb3JnIG5hbWUsIHVzZWQgd2hlbiBubyBsb2dvIGlzIHVwbG9hZGVkLlxuZnVuY3Rpb24gb3JnSW5pdGlhbHMoKTogc3RyaW5nIHtcbiAgY29uc3QgcGFydHMgPSBvcmdMYWJlbCgpLnRyaW0oKS5zcGxpdCgvXFxzKy8pLmZpbHRlcihCb29sZWFuKTtcbiAgaWYgKCFwYXJ0cy5sZW5ndGgpIHJldHVybiBNRS5iYWRnZTtcbiAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMSkgcmV0dXJuIHBhcnRzWzBdLnNsaWNlKDAsIDIpLnRvVXBwZXJDYXNlKCk7XG4gIHJldHVybiAoKHBhcnRzWzBdWzBdIHx8ICcnKSArIChwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXVswXSB8fCAnJykpLnRvVXBwZXJDYXNlKCk7XG59XG4vLyBUb3AtbGVmdCBpZGVudGl0eTogdGhlIHVwbG9hZGVkIG9yZyBsb2dvIGlmIHByZXNlbnQsIGVsc2UgYW4gaW5pdGlhbHMgYmFkZ2UsXG4vLyBmb2xsb3dlZCBieSB0aGUgcmVhbCBvcmcgbmFtZS5cbmZ1bmN0aW9uIG9yZ0lkZW50aXR5KCk6IHN0cmluZyB7XG4gIGNvbnN0IGxvZ28gPSBTRVNTSU9OICYmIFNFU1NJT04ubG9nb1VybCA/IFNFU1NJT04ubG9nb1VybCA6ICcnO1xuICBjb25zdCBtYXJrID0gbG9nb1xuICAgID8gYDxpbWcgY2xhc3M9XCJvcmctbG9nby1pbWdcIiBzcmM9XCIke2VzYyhsb2dvKX1cIiBhbHQ9XCIke2VzYyhvcmdMYWJlbCgpKX1cIj5gXG4gICAgOiBgPGRpdiBjbGFzcz1cIm9yZy1iYWRnZVwiPiR7ZXNjKG9yZ0luaXRpYWxzKCkpfTwvZGl2PmA7XG4gIHJldHVybiBgJHttYXJrfTxkaXYgY2xhc3M9XCJvcmctbmFtZVwiPiR7ZXNjKG9yZ0xhYmVsKCkpfTwvZGl2PmA7XG59XG5mdW5jdGlvbiB0b3BiYXIoKTogc3RyaW5nIHtcbiAgY29uc3Qgbm0gPSBzZXNzaW9uTmFtZSgpO1xuICBjb25zdCB0b29scyA9IChTRVNTSU9OICYmIFNFU1NJT04uaXNTdXBlcikgPyB0b29sc01lbnUoKSA6ICcnO1xuICAvLyBQZXItdXNlciBkaXNwbGF5IG1vZGUgKGxpZ2h0L2RhcmsvYXV0bykgbGl2ZXMgaW4gdGhlIGFjY291bnQgbWVudSBcdTIwMTQgYSBwZXJzb25hbCxcbiAgLy8gZGV2aWNlLWxvY2FsIHNldHRpbmcgYWxvbmdzaWRlIE15IEVtYWlsLiBUaGUgb3JnLXdpZGUgY29sb3Igc2NoZW1lIHN0YXlzIGluIFNldHRpbmdzLlxuICBjb25zdCBtb2RlID0gKHR5cGVvZiBnZXRNb2RlID09PSAnZnVuY3Rpb24nKSA/IGdldE1vZGUoKSA6ICdhdXRvJztcbiAgY29uc3QgbW9kZUJ0biA9ICh2OiBzdHJpbmcsIGxhYmVsOiBzdHJpbmcsIGljb246IHN0cmluZyk6IHN0cmluZyA9PlxuICAgIGA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cIiR7bW9kZSA9PT0gdiA/ICdvbicgOiAnJ31cIiBvbmNsaWNrPVwicGlja01vZGUoJyR7dn0nKVwiIHRpdGxlPVwiJHtlc2MobGFiZWwpfVwiPiR7aWMoaWNvbiwgMTQpfTxzcGFuPiR7ZXNjKGxhYmVsKX08L3NwYW4+PC9idXR0b24+YDtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwidG9wYmFyXCI+XG4gICAgPGJ1dHRvbiBjbGFzcz1cImljby1idG4gbWVudS1idG5cIiB0aXRsZT1cIk1lbnVcIiBvbmNsaWNrPVwidG9nZ2xlTmF2KClcIj4ke2ljKCdtZW51JywgMjApfTwvYnV0dG9uPlxuICAgICR7b3JnSWRlbnRpdHkoKX1cbiAgICA8ZGl2IGNsYXNzPVwic3BhY2VyXCI+PC9kaXY+XG4gICAgJHt0b29sc31cbiAgICA8ZGl2IGNsYXNzPVwidGItZGRcIj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJ1c2VyXCIgb25jbGljaz1cInRvZ2dsZU1lbnUoZXZlbnQsJ3RiVXNlcicpXCI+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwiYXZhdGFyXCIgc3R5bGU9XCJ3aWR0aDoyOHB4O2hlaWdodDoyOHB4O2ZvbnQtc2l6ZToxMXB4XCI+JHtlc2Moc2Vzc2lvbkluaXRpYWxzKCkpfTwvc3Bhbj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJoaWRlLXNtXCI+JHtlc2Mobm0pfTwvc3Bhbj4gJHtpYygnY2hldkQnLCAxNCl9PC9idXR0b24+XG4gICAgICA8ZGl2IGNsYXNzPVwidGItbWVudSB0Yi1yaWdodFwiIGlkPVwidGJVc2VyXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0Yi1tZW51LWhlYWRcIj4ke2VzYyhubSl9PC9kaXY+XG4gICAgICAgIDxhIGhyZWY9XCIvc2hhcmVkL3VzZXIvbXlwcm9maWxlLmpzcFwiPiR7aWMoJ3VzZXInLCAxNSl9IE15IEFjY291bnQ8L2E+XG4gICAgICAgIDxhIGhyZWY9XCIjL2VtYWlsXCIgb25jbGljaz1cImNsb3NlQWxsTWVudXMoKVwiPiR7aWMoJ3NlbmQnLCAxNSl9IE15IEVtYWlsPC9hPlxuICAgICAgICA8ZGl2IGNsYXNzPVwidGItc2VwXCI+PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0Yi1tZW51LWhlYWRcIj5EaXNwbGF5IG1vZGU8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRiLW1vZGUtc2VnXCI+JHttb2RlQnRuKCdsaWdodCcsICdMaWdodCcsICdzdW4nKX0ke21vZGVCdG4oJ2RhcmsnLCAnRGFyaycsICdtb29uJyl9JHttb2RlQnRuKCdhdXRvJywgJ0F1dG8nLCAnbGFwdG9wJyl9PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0Yi1zZXBcIj48L2Rpdj5cbiAgICAgICAgPGEgaHJlZj1cIi9zaGFyZWQvbG9naW4vbG9nb3V0LmpzcFwiPiR7aWMoJ2xvZ291dCcsIDE1KX0gTG9nb3V0PC9hPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gIDwvZGl2PmA7XG59XG5cbi8qIC0tLS0gc2lkZWJhciAocHJpbWFyeSBuYXYpIC0tLS0gKi9cbmNvbnN0IE5BViA9IFtcbiAgeyBrZXk6J2Rhc2hib2FyZCcsIGxhYmVsOidEYXNoYm9hcmQnLCBpY29uOidkYXNoJyB9LFxuICB7IGtleTonY2xpZW50cycsICAgbGFiZWw6J0NsaWVudHMnLCAgIGljb246J3VzZXJzJyB9LFxuICB7IGtleToncHJvZ3JhbXMnLCAgbGFiZWw6J1Byb2dyYW1zJywgIGljb246J2J1aWxkaW5nJyB9LFxuICB7IGtleTonc2V0dGluZ3MnLCAgbGFiZWw6J1NldHRpbmdzJywgIGljb246J3NldHRpbmdzJyB9LFxuXTtcbi8vIHJhaWw9dHJ1ZSBjb2xsYXBzZXMgdG8gYSA1NnB4IGljb24gcmFpbCAodXNlZCBvbiB0aGUgcmVjb3JkIGRldGFpbCBzY3JlZW4pLlxuZnVuY3Rpb24gc2lkZWJhcihhY3RpdmU6IHN0cmluZywgcmFpbCA9IGZhbHNlKTogc3RyaW5nIHtcbiAgY29uc3QgbG9jTmFtZSA9IFNFU1NJT04gJiYgU0VTU0lPTi5vcmdOYW1lID8gU0VTU0lPTi5vcmdOYW1lIDogTUUuYWdlbmN5O1xuICByZXR1cm4gYDxhc2lkZSBjbGFzcz1cInNpZGViYXIgJHtyYWlsID8gJ3JhaWwnIDogJyd9XCI+XG4gICAgPGJ1dHRvbiBjbGFzcz1cInN3aXRjaGVyXCIgb25jbGljaz1cIm9wZW5Mb2NhdGlvbnNNYXAoKVwiIHRpdGxlPVwiTG9jYXRpb25zIE1hcCBcdTIwMTQgJHtlc2MobG9jTmFtZSl9XCI+JHtpYygnbWFwJywgMTUpfTxzcGFuIGNsYXNzPVwibGJsXCIgc3R5bGU9XCJkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uXCI+XG4gICAgICA8c3BhbiBzdHlsZT1cImZvbnQtc2l6ZToxMXB4O2ZvbnQtd2VpZ2h0OjUwMDtjb2xvcjp2YXIoLS1tdXRlZC1mb3JlZ3JvdW5kKVwiPkxvY2F0aW9uPC9zcGFuPiR7ZXNjKGxvY05hbWUpfTwvc3Bhbj5cbiAgICAgIDxzcGFuIGNsYXNzPVwiY2hldlwiPiR7aWMoJ2NoZXZSJywgMTQpfTwvc3Bhbj48L2J1dHRvbj5cbiAgICA8bmF2IGNsYXNzPVwibmF2XCI+XG4gICAgICAke05BVi5tYXAobiA9PiBgPGEgaHJlZj1cIiMvJHtuLmtleX1cIiBjbGFzcz1cIiR7YWN0aXZlID09PSBuLmtleSA/ICdhY3RpdmUnIDogJyd9XCIgdGl0bGU9XCIke24ubGFiZWx9XCI+JHtpYyhuLmljb24sIDE4KX08c3BhbiBjbGFzcz1cImxibFwiPiR7bi5sYWJlbH08L3NwYW4+PC9hPmApLmpvaW4oJycpfVxuICAgIDwvbmF2PlxuICAgICR7cmFpbCA/ICcnIDogYDxkaXYgY2xhc3M9XCJ0aXBcIj48Yj5UaXAgXHUyMDE0PC9iPiB0aGlzIGlzIHRoZSBwcmltYXJ5IG5hdmlnYXRpb24uIENsaWNrIGFueSBjbGllbnQgcm93IHRvIG9wZW4gdGhlaXIgcmVjb3JkLjwvZGl2PmB9XG4gIDwvYXNpZGU+YDtcbn1cblxuLyogLS0tLSBicmVhZGNydW1iIC0tLS0gKi9cbmZ1bmN0aW9uIGNydW1iKHBhcnRzOiB7IHQ6IHN0cmluZzsgaD86IHN0cmluZyB9W10pOiBzdHJpbmcge1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJicmVhZGNydW1iXCI+JHtwYXJ0cy5tYXAoKHAsIGkpID0+IHtcbiAgICBjb25zdCBsYXN0ID0gaSA9PT0gcGFydHMubGVuZ3RoIC0gMTtcbiAgICBjb25zdCBzZXAgPSBpID4gMCA/IGljKCdjaGV2UicsIDE0KSA6ICcnO1xuICAgIHJldHVybiBzZXAgKyAobGFzdCA/IGA8c3BhbiBjbGFzcz1cImN1clwiPiR7ZXNjKHAudCl9PC9zcGFuPmAgOiBgPGEgaHJlZj1cIiR7cC5ofVwiPiR7ZXNjKHAudCl9PC9hPmApO1xuICB9KS5qb2luKCcnKX08L2Rpdj5gO1xufVxuXG4vKiAtLS0tIHBhZ2UgaGVhZGVyIC0tLS0gKi9cbmZ1bmN0aW9uIHBhZ2VIZWFkKHRpdGxlOiBzdHJpbmcsIGRlc2M6IHN0cmluZywgYWN0aW9uID0gJycpOiBzdHJpbmcge1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJwYWdlLWhlYWRcIj48ZGl2PjxoMT4ke2VzYyh0aXRsZSl9PC9oMT4ke2Rlc2MgPyBgPHA+JHtlc2MoZGVzYyl9PC9wPmAgOiAnJ308L2Rpdj4ke2FjdGlvbn08L2Rpdj5gO1xufVxuXG4vKiAtLS0tIHNoZWxsIHdyYXBwZXIgLS0tLSAqL1xuZnVuY3Rpb24gc2hlbGwoYWN0aXZlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB0b3BiYXIoKSArIGA8ZGl2IGNsYXNzPVwiYm9keVwiPiR7c2lkZWJhcihhY3RpdmUpfTxkaXYgY2xhc3M9XCJuYXYtc2NyaW1cIiBvbmNsaWNrPVwiY2xvc2VOYXYoKVwiPjwvZGl2PjxtYWluIGNsYXNzPVwibWFpblwiPjxkaXYgY2xhc3M9XCJjb250ZW50XCI+JHtjb250ZW50fTwvZGl2PjwvbWFpbj48L2Rpdj5gO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBT0EsTUFBTSxXQUFXLENBQUMsR0FBVyxPQUF1QixFQUFFLENBQUMsS0FBSyxPQUFPLEVBQUUsQ0FBQyxLQUFLO0FBQzNFLE1BQU0sTUFBTSxDQUFDLE1BQ1gsT0FBTyxLQUFLLE9BQU8sS0FBSyxDQUFDLEVBQUUsUUFBUSxXQUFXLFFBQU0sRUFBRSxLQUFJLFNBQVEsS0FBSSxRQUFPLEtBQUksUUFBTyxLQUFJLFNBQVMsR0FBRSxDQUFDLENBQVk7QUFDdEgsTUFBTSxPQUFPO0FBQ2IsTUFBTSxNQUFNLENBQUMsTUFBd0IsSUFBSSxJQUFJLENBQUMsSUFBSTtBQUNsRCxTQUFTLE1BQU0sS0FBcUI7QUFDbEMsU0FBTyxLQUFLLE9BQU8sS0FBSyxJQUFJLElBQUksSUFBSSxLQUFLLEdBQUcsRUFBRSxRQUFRLE1BQU0sU0FBUyxNQUFNO0FBQzdFO0FBRUEsU0FBUyxRQUFRLEdBQTBCO0FBQ3pDLE1BQUksQ0FBQyxFQUFHLFFBQU87QUFDZixVQUFPLG9CQUFJLEtBQUssSUFBSSxXQUFXLEdBQUUsbUJBQW1CLFNBQVMsRUFBRSxPQUFPLFNBQVMsS0FBSyxXQUFXLE1BQU0sVUFBVSxDQUFDO0FBQ2xIO0FBR0EsU0FBUyxXQUFXLEdBQW1CO0FBQ3JDLFNBQU8scUJBQXFCLGNBQWMsQ0FBQyxLQUFLLE9BQU8sOEJBQThCLElBQUksQ0FBQyxDQUFDO0FBQzdG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
