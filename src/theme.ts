/* =====================================================================
   theme.ts — color scheme (org-wide) + light/dark mode (per-user).

   Two attributes on <html> drive all colors (see the theming section of
   tokens.css):
     data-theme = clinical | modern | warm | slate   ← org-wide palette
     data-mode  = light | dark                        ← resolved per-user mode

   Split of authority:
   - The PALETTE is org-wide: it lives in the org settings JSON at
     settings.appearance.theme and is applied for everyone. A copy is cached
     in localStorage['crm.theme'] purely so the boot script in index.html can
     paint the right palette before settings load (no flash); org settings
     remain authoritative and win via reconcileOrgTheme().
   - The MODE is per-user: light/dark/auto is stored only in
     localStorage['crm.mode'] and never touches the server. 'auto' follows the
     OS via prefers-color-scheme.

   JS here only sets the two attributes + persists choices — every visual
   difference is CSS. The matching boot snippet lives in index.html <head>.
   ===================================================================== */

interface ThemeDef {
  id: string;
  label: string;
  description: string;
  swatch: string[]; // [primary, background, accent] — preview chips in Settings
}

const THEMES: ThemeDef[] = [
  { id: 'clinical', label: 'Clinical', description: 'Calm, high-legibility blues for regulated clinical work.',
    swatch: ['oklch(52% .12 225)', 'oklch(97% .01 225)', 'oklch(92% .05 225)'] },
  { id: 'modern', label: 'Modern', description: 'Crisp neutrals with a confident violet accent.',
    swatch: ['oklch(55% .2 300)', 'oklch(99% 0 0)', 'oklch(94% .04 300)'] },
  { id: 'warm', label: 'Warm', description: 'Friendly, residential-feeling palette with a terracotta accent.',
    swatch: ['oklch(60% .13 55)', 'oklch(98% .01 80)', 'oklch(92% .05 65)'] },
  { id: 'slate', label: 'Slate', description: 'Restrained cool neutrals with a dark navigation rail.',
    swatch: ['oklch(48% .06 235)', 'oklch(24% .02 240)', 'oklch(93% .01 235)'] },
];

const THEME_STORAGE = 'crm.theme';
const MODE_STORAGE = 'crm.mode';
const DEFAULT_THEME = 'clinical';
const DEFAULT_MODE = 'auto'; // 'light' | 'dark' | 'auto'

// Whether a theme id is one we ship (guards stale/garbage values).
function isKnownTheme(id: string): boolean {
  for (let i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return true;
  return false;
}

// The current org palette id (cached copy; org settings are authoritative).
function getTheme(): string {
  let t = '';
  try { t = localStorage.getItem(THEME_STORAGE) || ''; } catch (_e) { t = ''; }
  return isKnownTheme(t) ? t : DEFAULT_THEME;
}

// The user's chosen mode preference: 'light' | 'dark' | 'auto'.
function getMode(): string {
  let m = '';
  try { m = localStorage.getItem(MODE_STORAGE) || ''; } catch (_e) { m = ''; }
  return (m === 'light' || m === 'dark' || m === 'auto') ? m : DEFAULT_MODE;
}

// Resolve a mode preference to a concrete 'light' | 'dark'.
function resolveMode(mode: string): string {
  if (mode === 'light' || mode === 'dark') return mode;
  let prefersDark = false;
  try { prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (_e) { prefersDark = false; }
  return prefersDark ? 'dark' : 'light';
}

// Apply + persist the org palette. Idempotent; safe to call repeatedly.
function applyTheme(themeId: string): void {
  const id = isKnownTheme(themeId) ? themeId : DEFAULT_THEME;
  document.documentElement.setAttribute('data-theme', id);
  try { localStorage.setItem(THEME_STORAGE, id); } catch (_e) { /* private mode — attribute still applied */ }
}

// While mode is 'auto', track OS scheme changes and re-resolve live.
let AUTO_MQL: MediaQueryList | null = null;
function onAutoSchemeChange(): void {
  if (getMode() !== 'auto') return;
  document.documentElement.setAttribute('data-mode', resolveMode('auto'));
  if (typeof render === 'function') render();
}
function ensureAutoListener(active: boolean): void {
  try {
    if (active) {
      if (!AUTO_MQL) {
        AUTO_MQL = window.matchMedia('(prefers-color-scheme: dark)');
        AUTO_MQL.addEventListener('change', onAutoSchemeChange);
      }
    } else if (AUTO_MQL) {
      AUTO_MQL.removeEventListener('change', onAutoSchemeChange);
      AUTO_MQL = null;
    }
  } catch (_e) { /* matchMedia unavailable — mode still applies, just not live */ }
}

// Apply + persist the per-user mode preference and set the resolved attribute.
function applyMode(mode: string): void {
  const pref = (mode === 'light' || mode === 'dark' || mode === 'auto') ? mode : DEFAULT_MODE;
  try { localStorage.setItem(MODE_STORAGE, pref); } catch (_e) { /* private mode */ }
  document.documentElement.setAttribute('data-mode', resolveMode(pref));
  ensureAutoListener(pref === 'auto');
}

// Org settings are authoritative for the palette: when they resolve, apply the
// saved org theme (and refresh the localStorage cache). No-op if the org hasn't
// chosen one yet, leaving the cached/default palette in place.
function reconcileOrgTheme(settings: any): void {
  const t = settings && settings.appearance && typeof settings.appearance.theme === 'string'
    ? settings.appearance.theme : '';
  if (isKnownTheme(t) && t !== getTheme()) {
    applyTheme(t);
    if (typeof render === 'function') render();
  } else if (isKnownTheme(t)) {
    applyTheme(t); // refresh cache even when unchanged
  }
}

// Reassert attributes from storage on load and wire the auto-listener. The
// index.html boot script already set the attributes pre-paint; this makes the
// listener live and keeps everything consistent if that script was skipped.
(function initTheme(): void {
  applyTheme(getTheme());
  applyMode(getMode());
})();
