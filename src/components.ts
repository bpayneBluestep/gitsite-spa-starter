/* =====================================================================
   components.ts — shared helpers + app-shell pieces.
   topbar, sidebar, breadcrumb, page header, pills, and the shell wrapper
   that every primary-nav page renders inside.
   ===================================================================== */

/* ---- helpers ---- */
const initials = (f: string, l: string): string => (f[0] || '') + (l[0] || '');
const esc = (s: unknown): string =>
  String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c] as string));
const dash = '<span style="color:var(--muted-foreground)">—</span>';
const val = (v: unknown): string => (v ? esc(v) : dash);
function ageOf(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 864e5));
}
// "YYYY-MM-DD" -> "Mon DD, YYYY" (null/empty -> null so callers can show a dash).
function fmtDate(d: string): string | null {
  if (!d) return null;
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

/* ---- status pills ---- */
function clientPill(s: string): string {
  return `<span class="pill ${CLIENT_STATUS[s] || 'muted'}"><span class="dot"></span>${esc(s)}</span>`;
}
function plcPill(s: string): string {
  return `<span class="pill ${PLC_STATUS[s] || 'muted'}"><span class="dot"></span>${esc(s)}</span>`;
}

/* ---- avatar ---- */
// Circular avatar. When `photoUrl` is provided, the uploaded photo fills the
// circle (object-fit: cover); otherwise it falls back to the initials.
function avatar(f: string, l: string, size = 36, fs = 13, photoUrl?: string): string {
  const inner = photoUrl
    ? `<img src="${esc(photoUrl)}" alt="${esc((f + ' ' + l).trim())}">`
    : esc(initials(f, l));
  return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${fs}px">${inner}</span>`;
}

/* ---- top bar ---- */
// Real logged-in name (falls back to the demo consultant until the session loads).
function sessionName(): string {
  return SESSION && SESSION.fullName ? SESSION.fullName : (ME.first + ' ' + ME.last);
}
function sessionInitials(): string {
  const parts = sessionName().trim().split(/\s+/);
  return ((parts[0] || '')[0] || '') + ((parts[parts.length - 1] || '')[0] || '');
}
// Real organization name (falls back to the demo agency until the session loads).
function orgLabel(): string {
  return SESSION && SESSION.orgName ? SESSION.orgName : ME.agency;
}
// Initials derived from the org name, used when no logo is uploaded.
function orgInitials(): string {
  const parts = orgLabel().trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return ME.badge;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase();
}
// Top-left identity: the uploaded org logo if present, else an initials badge,
// followed by the real org name.
function orgIdentity(): string {
  const logo = SESSION && SESSION.logoUrl ? SESSION.logoUrl : '';
  const mark = logo
    ? `<img class="org-logo-img" src="${esc(logo)}" alt="${esc(orgLabel())}">`
    : `<div class="org-badge">${esc(orgInitials())}</div>`;
  return `${mark}<div class="org-name">${esc(orgLabel())}</div>`;
}
function topbar(): string {
  const nm = sessionName();
  const tools = (SESSION && SESSION.isSuper) ? toolsMenu() : '';
  // Per-user display mode (light/dark/auto) lives in the account menu — a personal,
  // device-local setting alongside My Email. The org-wide color scheme stays in Settings.
  const mode = (typeof getMode === 'function') ? getMode() : 'auto';
  const modeBtn = (v: string, label: string, icon: string): string =>
    `<button type="button" class="${mode === v ? 'on' : ''}" onclick="pickMode('${v}')" title="${esc(label)}">${ic(icon, 14)}<span>${esc(label)}</span></button>`;
  return `<div class="topbar">
    <button class="ico-btn menu-btn" title="Menu" onclick="toggleNav()">${ic('menu', 20)}</button>
    ${orgIdentity()}
    <div class="spacer"></div>
    ${tools}
    <div class="tb-dd">
      <button class="user" onclick="toggleMenu(event,'tbUser')">
        <span class="avatar" style="width:28px;height:28px;font-size:11px">${esc(sessionInitials())}</span>
        <span class="hide-sm">${esc(nm)}</span> ${ic('chevD', 14)}</button>
      <div class="tb-menu tb-right" id="tbUser">
        <div class="tb-menu-head">${esc(nm)}</div>
        <a href="/shared/user/myprofile.jsp">${ic('user', 15)} My Account</a>
        <a href="#/email" onclick="closeAllMenus()">${ic('send', 15)} My Email</a>
        <div class="tb-sep"></div>
        <div class="tb-menu-head">Display mode</div>
        <div class="tb-mode-seg">${modeBtn('light', 'Light', 'sun')}${modeBtn('dark', 'Dark', 'moon')}${modeBtn('auto', 'Auto', 'laptop')}</div>
        <div class="tb-sep"></div>
        <a href="#" onclick="closeAllMenus();logout();return false;">${ic('logout', 15)} Logout</a>
      </div>
    </div>
  </div>`;
}

/* ---- sidebar (primary nav) ---- */
const NAV = [
  { key:'dashboard', label:'Dashboard', icon:'dash' },
  { key:'clients',   label:'Clients',   icon:'users' },
  { key:'programs',  label:'Programs',  icon:'building' },
  { key:'settings',  label:'Settings',  icon:'settings' },
];
// rail=true collapses to a 56px icon rail (used on the record detail screen).
function sidebar(active: string, rail = false): string {
  const locName = SESSION && SESSION.orgName ? SESSION.orgName : ME.agency;
  return `<aside class="sidebar ${rail ? 'rail' : ''}">
    <button class="switcher" onclick="openLocationsMap()" title="Locations Map — ${esc(locName)}">${ic('map', 15)}<span class="lbl" style="display:flex;flex-direction:column">
      <span style="font-size:11px;font-weight:500;color:var(--muted-foreground)">Location</span>${esc(locName)}</span>
      <span class="chev">${ic('chevR', 14)}</span></button>
    <nav class="nav">
      ${NAV.map(n => `<a href="#/${n.key}" class="${active === n.key ? 'active' : ''}" title="${n.label}">${ic(n.icon, 18)}<span class="lbl">${n.label}</span></a>`).join('')}
    </nav>
    ${rail ? '' : `<div class="tip"><b>Tip —</b> this is the primary navigation. Click any client row to open their record.</div>`}
  </aside>`;
}

/* ---- breadcrumb ---- */
function crumb(parts: { t: string; h?: string }[]): string {
  return `<div class="breadcrumb">${parts.map((p, i) => {
    const last = i === parts.length - 1;
    const sep = i > 0 ? ic('chevR', 14) : '';
    return sep + (last ? `<span class="cur">${esc(p.t)}</span>` : `<a href="${p.h}">${esc(p.t)}</a>`);
  }).join('')}</div>`;
}

/* ---- page header ---- */
function pageHead(title: string, desc: string, action = ''): string {
  return `<div class="page-head"><div><h1>${esc(title)}</h1>${desc ? `<p>${esc(desc)}</p>` : ''}</div>${action}</div>`;
}

/* ---- shell wrapper ---- */
function shell(active: string, content: string): string {
  return topbar() + `<div class="body">${sidebar(active)}<div class="nav-scrim" onclick="closeNav()"></div><main class="main"><div class="content">${content}</div></main></div>`;
}
