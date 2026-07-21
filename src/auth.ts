/* =====================================================================
   auth.ts — in-app login for the GitSite SPA.

   BlueStep login is a COOKIE-SESSION form post to the tenant login handler
   (Bluestep-Systems/web@master, verified from source):
     • POST /shared/login/login.jsp  (application/x-www-form-urlencoded)
       fields: myUserName, myPassword, step=two, _postEvent=commit,
               _postFormClass=myassn.user.UserLoginWebView, rememberMe=false
       (login.jsp <b:form>; UserLoginWebView.doLogin / LoginEvent.execute).
     • No CSRF token: the login post isn't gated by the header-based Csrf
       servlet and login.jsp renders no token field.
     • Success flips THIS host's session cookie to authenticated; we re-probe
       /session to confirm (api.ts `login()`).
     • Global users on an untrusted device get email 2FA (doLogin 302s to
       /oauth2/v1/login/verify) — handed off to a native full-page submit
       with a desturl back into /spa/.
     • SSO must leave the SPA (the IdP round-trip is a full navigation); we
       render our own buttons that navigate to the integrator initiate URL.
   The password only ever goes to the same-origin BlueStep tenant host.
   ===================================================================== */

const LOGIN_URI = '/shared/login/login.jsp'; // native full-page fallback

// Set while a login submit is in flight so a stray 401 interceptor
// (authMarkLoggedOut) can't re-render the gate out from under the form.
let AUTH_SUBMITTING = false;

// Where login should drop us back: the current SPA URL (path + query + hash).
function authReturnUrl(): string {
  return location.pathname + location.search + location.hash;
}
function authLoginUrl(): string {
  return LOGIN_URI + '?desturl=' + encodeURIComponent(authReturnUrl());
}
// Full-page redirect to the platform login page (fallback for captcha lockout,
// biometrics, or any exotic login-type config the in-app form can't handle).
function goLogin(): void { location.href = authLoginUrl(); }

// SSO: our own button, but the IdP round-trip is a full navigation. Builds the
// oauth2-integrator initiate URL (Providers.buildIntegratorLoginUrl).
function goSSO(provider: 'microsoft' | 'google'): void {
  const oauth2Host = location.hostname.endsWith('.myassn.com') ? 'oauth2.myassn.com' : 'oauth2.bluestep.net';
  const dest = location.origin + authReturnUrl();
  location.href = 'https://' + oauth2Host + '/v1/login/initiate/' + provider
    + '?host=' + encodeURIComponent(location.host)
    + '&destUrl=' + encodeURIComponent(dest);
}

// Hard-401 logout (session expired mid-use) → show the gate. 403 is NOT a
// logout: anonymous boot probes and per-record permission denials both 403.
// Skips the re-render while a login submit is in flight (see AUTH_SUBMITTING).
function authMarkLoggedOut(): void {
  SESSION = { loggedIn: false, firstName: '', lastName: '', fullName: '', isSuper: false, orgName: '', logoUrl: '' };
  if (!AUTH_SUBMITTING && typeof render === 'function') render();
}

// Log out: invalidate the BlueStep session server-side, then show OUR login
// gate — no navigation to the platform login page. logout.jsp clears the
// session cookie same-origin; we ignore its HTML response and just re-render.
async function logout(): Promise<void> {
  try {
    await fetch('/shared/login/logout.jsp', { credentials: 'include', cache: 'no-store' });
  } catch (_e) { /* even if the call fails, still drop to our gate locally */ }
  authMarkLoggedOut(); // SESSION -> logged out + render() -> viewLogin
}

// Quiet splash while the session check is still in flight (SESSION null).
function viewAuthSplash(): string {
  return `<div class="auth-wrap"><div class="auth-card">
    <p class="auth-sub" style="margin:0">Checking your session…</p>
  </div></div>`;
}

// The login gate — a real in-app form, themed with the app tokens.
function viewLogin(): string {
  const lock = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none"
     stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
     aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/>
     <path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  return `<div class="auth-wrap">
    <form class="auth-card" id="loginForm" autocomplete="on" onsubmit="return submitLogin(event)">
      <div class="auth-badge">${lock}</div>
      <h1 class="auth-title">Sign in to continue</h1>
      <p class="auth-sub">Use your BlueStep account to access this workspace.</p>

      <div class="auth-field">
        <label for="lg-user">Username</label>
        <input id="lg-user" name="username" type="text" class="auth-input"
               autocomplete="username" autocapitalize="none" autocorrect="off"
               spellcheck="false" required />
      </div>
      <div class="auth-field">
        <label for="lg-pass">Password</label>
        <input id="lg-pass" name="password" type="password" class="auth-input"
               autocomplete="current-password" required />
      </div>

      <p id="lg-error" class="auth-error" role="alert" aria-live="assertive" hidden></p>

      <button id="lg-submit" type="submit" class="btn primary auth-btn">Sign in</button>

      <div id="lg-sso" class="auth-sso">
        <button type="button" class="btn outline auth-btn" onclick="goSSO('microsoft')">Sign in with Microsoft</button>
        <button type="button" class="btn outline auth-btn" onclick="goSSO('google')">Sign in with Google</button>
      </div>

      <button type="button" class="auth-trouble" onclick="goLogin()">Trouble signing in? Open the full sign-in page</button>
    </form>
  </div>`;
}

// Submit handler — authenticates in-app, then re-renders into the app on
// success. Touches the DOM directly (no full re-render mid-submit) so field
// values + focus survive; render() runs only on success (SESSION flips the gate).
async function submitLogin(ev: Event): Promise<boolean> {
  ev.preventDefault();
  const userEl = document.getElementById('lg-user') as HTMLInputElement | null;
  const passEl = document.getElementById('lg-pass') as HTMLInputElement | null;
  const btn = document.getElementById('lg-submit') as HTMLButtonElement | null;
  const errEl = document.getElementById('lg-error');
  if (!userEl || !passEl || !btn) return false;

  const username = userEl.value.trim();
  const password = passEl.value; // never trimmed, never logged
  if (!username || !password) return false;

  if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = 'Signing in…';

  AUTH_SUBMITTING = true;
  let res: { ok: boolean; twoFactor?: boolean; error?: string };
  try {
    res = await login(username, password);
  } finally {
    AUTH_SUBMITTING = false;
  }

  if (res.ok) { render(); return false; } // SESSION set -> app renders

  if (res.twoFactor) { // hand off to the platform email-2FA page
    nativeLoginSubmit(username, password, authReturnUrl());
    return false; // full navigation follows
  }

  if (errEl) { errEl.textContent = res.error || 'Sign in failed.'; errEl.hidden = false; }
  btn.disabled = false;
  btn.textContent = label || 'Sign in';
  passEl.value = '';
  passEl.focus();
  return false;
}
