/* =====================================================================
   chrome.ts — native-BlueStep toolbar pieces folded into the CRM shell.
     • Tools menu      — super-users only (links to the native admin tools)
     • User menu       — real name + My Account / Logout
     • Locations Map   — the org nav tree (from /getNavTree), opened from the
                         left-sidebar location switcher

   The dropdown HTML is rebuilt on every render(); these handlers just toggle
   an `.open` class. A document-level click closes any open menu.
   ===================================================================== */

/* ---- Tools menu (super only) ----------------------------------------------
   The full native BlueStep admin-tools list, mirrored 1:1 from the Manage
   chrome. Three flavours:
     • plain links  — navigate (open in a new tab so the CRM isn't lost)
     • popup links  — call the page's own globals (doPopup/doPopupFrame/…),
                      which exist because the SPA mounts inside singleblock.jsp
     • id-scoped    — use curPagePrimaryObject (the current page id) at runtime,
                      so Container Tree / GraphQL / Change History / Alt Ids
                      target THIS page on whatever org the CRM is deployed to
   The two org-specific home ids (Organization Admin, Relate) come from this
   org's chrome — refresh them if the CRM is deployed to another org. */
function toolsMenu(): string {
  const pid = String((window as any).curPagePrimaryObject || '');
  const link = (label: string, href: string) => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
  const js = (label: string, code: string) => `<a href="#" onclick="${esc(code)};return false;">${esc(label)}</a>`;
  const items = [
    link('Organization Admin', '/shared/home.jsp?_a=111020___151457'),
    js('Organization Chart', "doPopupFrame('Organization Chart',APP_ROOT+'/shared/admin/organization/orgpop.jsp',APP_ROOT+'/shared/admin/organization/orgbottom.jsp',FRAME_VIEW,true)"),
    js('Organization Tree', "doPopupFrame('Organization Tree',APP_ROOT+'/shared/admin/organization/orgpop.jsp?_showAll=true&_hideAdminLinks=true',APP_ROOT+'/shared/admin/organization/orgbottom.jsp',FRAME_VIEW,true)"),
    link('Relate', '/shared/home.jsp?_a=530002___131263'),
    link('Current Container Child Tree', '/shared/containertree.jsp?_event=view&_formClass=myassn.view.web.WebView&_id=' + pid),
    link('GraphQL', '/shared/graphql.jsp?_event=view&_formClass=myassn.view.web.WebView&_id=' + pid),
    link('Change History', '/shared/changehistories.jsp?_id=' + pid),
    js('Turn Console Trace On', "(typeof toggleConsoleTrace==='function'?toggleConsoleTrace():alert('Console trace is not available on this page.'))"),
    js('Alternate Identifiers', "doPopup('/shared/altids.jsp?_event=edit&_formClass=myassn.view.web.WebView&_id=" + pid + "', winAttribs(400,600,0,0,1), true)"),
    link('Cache Stats', '/admin/cachestatsnew.jsp'),
    js('Temporary Login', "doPopup('/shared/login/templogin.jsp', winAttribs(550,400,0,0,1), true)"),
  ].join('');
  return `<div class="tb-dd">
    <button class="tb-btn" onclick="toggleMenu(event,'tbTools')" title="Tools">${ic('wrench', 16)}<span class="hide-sm">Tools</span> ${ic('chevD', 13)}</button>
    <div class="tb-menu tb-right" id="tbTools">
      <div class="tb-menu-head">Admin Tools</div>
      ${items}
    </div>
  </div>`;
}

/* ---- dropdown toggling ---- */
function closeAllMenus(): void {
  document.querySelectorAll('.tb-menu.open').forEach(m => m.classList.remove('open'));
}
function toggleMenu(e: Event, id: string): void {
  e.stopPropagation();
  e.preventDefault();
  const m = document.getElementById(id);
  if (!m) return;
  const wasOpen = m.classList.contains('open');
  closeAllMenus();
  if (!wasOpen) m.classList.add('open');
}
document.addEventListener('click', closeAllMenus);

/* ---- Locations Map (native /getNavTree, rendered in our own modal) ---- */
function openLocationsMap(): void {
  if (document.getElementById('__locModal')) return;
  const host = document.createElement('div');
  host.className = 'modal-overlay';
  host.id = '__locModal';
  host.innerHTML = `<div class="modal-card loc-card" role="dialog" aria-modal="true" aria-label="Locations Map">
    <div class="modal-head">
      <div><b>Locations Map</b><p>Jump to another location or open the Manage console.</p></div>
      <button class="ico-x" title="Close" onclick="closeLocationsMap()">${ic('x', 18)}</button>
    </div>
    <div class="modal-body"><div class="loc-tree" id="__locTree">
      <div class="loc-loading">${ic('clock', 18)} Loading locations…</div>
    </div></div>
  </div>`;
  host.addEventListener('mousedown', e => { if (e.target === host) closeLocationsMap(); });
  document.body.appendChild(host);
  document.addEventListener('keydown', locEsc);

  fetch('/getNavTree', { method: 'POST', credentials: 'include' })
    .then(r => r.json())
    .then(tree => { const el = document.getElementById('__locTree'); if (el) el.innerHTML = renderNavTree(tree); })
    .catch(() => { const el = document.getElementById('__locTree'); if (el) el.innerHTML = `<div class="loc-loading">${ic('alert', 18)} Couldn't load the locations map.</div>`; });
}

function locEsc(e: KeyboardEvent): void { if (e.key === 'Escape') closeLocationsMap(); }

function closeLocationsMap(): void {
  const m = document.getElementById('__locModal');
  if (m) m.remove();
  document.removeEventListener('keydown', locEsc);
}

// The /getNavTree node text embeds an SVG icon + label — strip the SVG so we
// show a clean label. Each node may have an href and child `nodes`.
function cleanLabel(t: unknown): string {
  return String(t == null ? '' : t).replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/\s+/g, ' ').trim() || '—';
}
function renderNavTree(nodes: any): string {
  if (!Array.isArray(nodes) || !nodes.length) return `<p class="loc-empty">No locations available.</p>`;
  const li = nodes.map((n: any) => {
    const label = cleanLabel(n && n.text);
    const head = n && n.href
      ? `<a href="${esc(n.href)}">${ic('chevR', 13)}${esc(label)}</a>`
      : `<span class="loc-grp">${esc(label)}</span>`;
    const kids = n && n.nodes && n.nodes.length ? renderNavTree(n.nodes) : '';
    return `<li>${head}${kids}</li>`;
  }).join('');
  return `<ul class="navtree">${li}</ul>`;
}
