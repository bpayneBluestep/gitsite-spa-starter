/* =====================================================================
   main.ts — hash router + boot. Loaded LAST.
   Routes: #/clients (default) · #/programs · #/dashboard · #/settings
   ===================================================================== */

// BlueStep host pages ship no responsive viewport meta, so phones lay the whole
// page out at ~980px and scale it down (tiny text) — our media queries never
// fire. Force width=device-width so responsive CSS actually applies on mobile.
(function ensureViewport(): void {
  let m = document.querySelector('meta[name=viewport]') as HTMLMetaElement | null;
  if (!m) { m = document.createElement('meta'); m.name = 'viewport'; (document.head || document.documentElement).appendChild(m); }
  m.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
})();

function go(h: string): void { location.hash = h; }

// Mobile primary-nav drawer (hamburger). Toggles a class on #app; CSS slides the
// sidebar in and shows the scrim. No-ops visually on desktop (drawer styles are
// mobile-only).
function toggleNav(): void { document.getElementById('app')?.classList.toggle('nav-open'); }
function closeNav(): void { document.getElementById('app')?.classList.remove('nav-open'); }

function render(): void {
  closeNav(); // any navigation closes the mobile drawer
  const hash = location.hash.replace(/^#/, '') || '/clients';
  const parts = hash.split('/').filter(Boolean); // e.g. ['clients','1000002___1152870','contacts']
  let html: string;
  if (parts[0] === 'clients' && parts[1]) html = viewClient(decodeURIComponent(parts[1]), parts[2]);
  else if (parts[0] === 'clients') html = viewClients();
  else if (parts[0] === 'programs' && parts[1]) html = viewProgram(decodeURIComponent(parts[1]), parts[2]);
  else if (parts[0] === 'programs') html = viewPrograms();
  else if (parts[0] === 'builder') html = viewAppBuilder();
  else if (parts[0] === 'email') html = viewMyEmail();
  else if (parts[0] === 'settings') html = viewSettings(parts[1]);
  else if (parts[0] === 'dashboard') html = viewDashboard();
  else if (parts[0] === 'pdflab') html = viewPdfLab();
  else if (parts[0] === 'agreementbuilder') html = viewAgreementBuilder();
  else html = viewClients();
  const app = document.getElementById('app');
  if (app) app.innerHTML = html;
  if (parts[0] === 'pdflab') pdfLabInit(); // canvas needs a live DOM
  const main = document.querySelector('.main');
  if (main) main.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);
// If the DOM is already parsed by the time this runs, render immediately.
if (document.readyState !== 'loading') render();

// Load the logged-in session once so the toolbar shows the real user + (for
// supers) the Tools menu. Re-renders when it resolves.
loadSession();
// Load org settings once (drives settings-defined controls, e.g. the contact
// relationship dropdown). Re-renders when it resolves.
loadSettings();
