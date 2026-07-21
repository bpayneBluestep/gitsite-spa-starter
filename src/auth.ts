/* =====================================================================
   auth.ts — login gate for the GitSite SPA.

   BlueStep login is a COOKIE-SESSION REDIRECT flow (not a browser token
   flow). We send the browser to the tenant login page with a `desturl`
   pointing back into /spa/. The platform authenticates (password, tenant
   SSO, or Microsoft/Google via the oauth2-integrator), sets the BlueStep
   session cookie on this tenant host, and 302s back to our exact /spa/#/…
   URL — after which the same-origin /b/maestro calls in api.ts just work.

   Server contract (Bluestep-Systems/web@master, verified from source):
     • Login page  /shared/login/login.jsp  reads a `desturl` param and
       feeds it into OAuth initiation / the password redirect
       (login.jsp:61-69; UserLoginWebView.doLogin:333-337).
     • Return      Oauth2Controller.buildDestinationRedirect() forces the
       scheme+host back to THIS tenant and preserves our #hash route
       (Oauth2ControllerDestinationRedirectTest) — so the return is
       same-origin-safe (open-redirect-proof) and lands on /spa/#/… intact.

   The browser never sees or sends a token. Nothing to store.
   ===================================================================== */

// Tenant login page — same-origin, root-absolute (NOT under /spa/).
const LOGIN_URI = '/shared/login/login.jsp';

// Where login should drop us back: the current SPA URL (path + query + hash).
// encodeURIComponent collapses the leading "/spa/" and the "#/route" into one
// opaque `desturl` value so "#" doesn't become login.jsp's own fragment; the
// server restores the fragment on the way back.
function authReturnUrl(): string {
  return location.pathname + location.search + location.hash;
}

function authLoginUrl(): string {
  return LOGIN_URI + '?desturl=' + encodeURIComponent(authReturnUrl());
}

// Send the browser to log in (full-page navigation; leaves the SPA).
function goLogin(): void {
  location.href = authLoginUrl();
}

// Mark the session logged-out and re-render (→ shows the gate). Called only
// on a hard 401 (unambiguous "not authenticated") from the backend, e.g. the
// session expired mid-use. We deliberately do NOT react to 403 here: an
// anonymous boot probe already 403s (handled by loadSession's soft-fail → the
// gate), and a logged-in user's per-record permission denial is also a 403 —
// treating that as a logout would wrongly eject a valid session.
function authMarkLoggedOut(): void {
  SESSION = { loggedIn: false, firstName: '', lastName: '', fullName: '', isSuper: false, orgName: '', logoUrl: '' };
  if (typeof render === 'function') render();
}

// Quiet splash shown while the session check is still in flight (SESSION null).
function viewAuthSplash(): string {
  return `<div class="auth-wrap"><div class="auth-card">
    <p class="auth-sub" style="margin:0">Checking your session…</p>
  </div></div>`;
}

// The login gate — a centered card, themed with the app's tokens.
function viewLogin(): string {
  const lock = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none"
     stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
     aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/>
     <path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  return `<div class="auth-wrap">
    <div class="auth-card">
      <div class="auth-badge">${lock}</div>
      <h1 class="auth-title">Sign in to continue</h1>
      <p class="auth-sub">You need to be signed in to your BlueStep account to use this workspace.</p>
      <button class="btn primary auth-btn" onclick="goLogin()">Sign in</button>
    </div>
  </div>`;
}
