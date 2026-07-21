/* =====================================================================
   email.ts — Email integration UI.

   Two surfaces:
   1. The My Email page (#/email) — per-user connect/disconnect of the logged-in
      user's Gmail / Outlook mailbox + connection status. Wires to the maestro's
      emailStatus / emailAuthUrl / emailDisconnect (which run as the logged-in
      user; tokens are written to that user's own record by the public
      /b/mailAuth broker after OAuth consent).
   2. The Settings ▸ Email Integration admin panel (emailConfigPanel) — the org
      OAuth-app credentials (Google/Microsoft client ids + secrets + tenant). Reads
      getEmailConfig (which returns only whether each secret is set) and writes via
      saveEmailConfig (secrets are write-only: a blank secret field keeps the
      stored value). Also shows the redirect URI to paste into the provider apps.

   The OAuth consent opens in a popup; the broker's callback page auto-closes it,
   and we refresh status when focus returns to this window.
   ===================================================================== */

const EMAIL_PROVIDERS = [
  { key: 'google', label: 'Gmail', brand: 'Google', icon: 'msg', accent: '#ea4335' },
  { key: 'microsoft', label: 'Outlook', brand: 'Microsoft', icon: 'msg', accent: '#0078d4' },
];

// An org uses exactly ONE email provider (Gmail OR Outlook), never both. The
// chosen provider key ('google'|'microsoft') lives in settings.email.provider —
// the admin picks it in Settings ▸ Email Integration, and the My Email page then
// only offers that one mailbox to connect.
function orgEmailProvider(): string {
  const s: any = SETTINGS;
  return s && s.email && typeof s.email.provider === 'string' ? s.email.provider : '';
}
function emailProviderMeta(key: string): { key: string; label: string; brand: string; icon: string; accent: string } | null {
  return EMAIL_PROVIDERS.filter(p => p.key === key)[0] || null;
}

interface LiveEmailAccount { provider: string; email: string; status: string; connected: boolean; expiresAtMs: number; }
interface EmailState { list: LiveEmailAccount[] | null; loading: boolean; error: string | null; }
const EMAIL_STATE: EmailState = { list: null, loading: false, error: null };
let EMAIL_AWAITING_RETURN = false; // set while an OAuth popup is open

async function loadEmailStatus(force = false): Promise<void> {
  if (EMAIL_STATE.loading) return;
  if (EMAIL_STATE.list && !force) return;
  EMAIL_STATE.loading = true; EMAIL_STATE.error = null;
  try {
    const rows = await apiEmailStatus();
    EMAIL_STATE.list = (Array.isArray(rows) ? rows : []).map((r: any) => ({
      provider: r.provider || '', email: r.email || '', status: r.status || '',
      connected: r.connected === true, expiresAtMs: Number(r.expiresAtMs) || 0,
    }));
  } catch (e: any) {
    EMAIL_STATE.error = e && e.message ? e.message : String(e);
    EMAIL_STATE.list = null;
  } finally {
    EMAIL_STATE.loading = false;
    if (typeof render === 'function') render();
  }
}

function emailAccountFor(brand: string): LiveEmailAccount | null {
  if (!EMAIL_STATE.list) return null;
  return EMAIL_STATE.list.filter(a => a.provider === brand)[0] || null;
}

// ── My Email page ────────────────────────────────────────────────────────────
function viewMyEmail(): string {
  const who = SESSION && SESSION.fullName ? SESSION.fullName : '';
  const head = pageHead('My Email', who ? `Connect your mailbox, ${esc(who)}, to send client emails from BlueStep.` : 'Connect your mailbox to send client emails from BlueStep.');

  let body: string;
  if (EMAIL_STATE.list === null) {
    if (!EMAIL_STATE.loading && !EMAIL_STATE.error) loadEmailStatus();
    body = EMAIL_STATE.error
      ? `<div class="card"><div class="empty"><div class="ico">${ic('alert', 22)}</div><b>Couldn't load your email connections</b>
         <p>${esc(EMAIL_STATE.error)}</p><button class="btn primary" onclick="loadEmailStatus(true)">${ic('clock', 15)} Retry</button></div></div>`
      : `<div class="card"><div class="empty"><div class="ico">${ic('clock', 22)}</div><b>Loading…</b></div></div>`;
    return shell('email', head + body);
  }

  // The org uses one provider. Load settings if needed, then show only that one.
  if (SETTINGS === null) {
    if (!SETTINGS_LOADING) loadSettings();
    return shell('email', head + `<div class="card"><div class="empty"><div class="ico">${ic('clock', 22)}</div><b>Loading…</b></div></div>`);
  }
  const prov = emailProviderMeta(orgEmailProvider());
  if (!prov) {
    return shell('email', head + `<div class="card"><div class="empty"><div class="ico">${ic('msg', 22)}</div>
      <b>Email isn't set up yet</b>
      <p>Your administrator hasn't configured an email provider for your organization. Once they do, you'll be able to connect your mailbox here.</p></div></div>`);
  }
  return shell('email', head + `<div class="email-grid one">${emailProviderCard(prov)}</div>
    <div class="card email-note"><div class="c-row">${ic('info', 15)}<span>Your mailbox is connected only for <b>you</b> — emails you send from BlueStep go out from your own ${esc(prov.label)} account. You can disconnect anytime.</span></div></div>`);
}

function emailProviderCard(p: { key: string; label: string; brand: string; accent: string }): string {
  const acct = emailAccountFor(p.brand);
  const connected = !!acct && acct.connected;
  const connecting = !!acct && acct.status === 'connecting';
  const errored = !!acct && acct.status === 'error';

  let statusHtml: string;
  if (connected) {
    statusHtml = `<span class="pill success"><span class="dot"></span>Connected</span>${acct && acct.email ? `<span class="email-addr">${esc(acct.email)}</span>` : ''}`;
  } else if (connecting) {
    statusHtml = `<span class="pill warning"><span class="dot"></span>Finishing…</span>`;
  } else if (errored) {
    statusHtml = `<span class="pill warning"><span class="dot"></span>Needs reconnect</span>`;
  } else {
    statusHtml = `<span class="pill muted"><span class="dot"></span>Not connected</span>`;
  }

  const actions = connected
    ? `<button class="btn outline" onclick="connectEmail('${p.key}')">${ic('clock', 15)} Reconnect</button>
       <button class="btn ghost danger" onclick="disconnectEmail('${p.key}')">${ic('trash', 15)} Disconnect</button>`
    : `<button class="btn primary" onclick="connectEmail('${p.key}')">${ic('external', 15)} Connect ${esc(p.label)}</button>`;

  return `<div class="card email-card">
    <div class="email-card-top">
      <div class="email-logo" style="--accent:${p.accent}">${ic('msg', 20)}</div>
      <div class="email-id"><div class="email-name">${esc(p.label)}</div><div class="email-status">${statusHtml}</div></div>
    </div>
    <div class="email-acts">${actions}</div>
  </div>`;
}

async function connectEmail(provider: string): Promise<void> {
  try {
    // Open the popup synchronously first (avoids popup-blockers), then navigate it.
    const popup = window.open('about:blank', 'bsEmailOAuth', 'width=520,height=660');
    const res = await apiEmailAuthUrl(provider);
    const url = res && res.authUrl ? String(res.authUrl) : '';
    if (!url) { if (popup) popup.close(); toast('Could not start the connection — is this provider configured in Settings?'); return; }
    EMAIL_AWAITING_RETURN = true;
    if (popup) { popup.location.href = url; } else { window.location.href = url; }
  } catch (e: any) {
    toast('Connect failed: ' + (e && e.message ? e.message : String(e)));
  }
}

async function disconnectEmail(provider: string): Promise<void> {
  const label = provider === 'google' ? 'Gmail' : 'Outlook';
  if (!window.confirm('Disconnect ' + label + '? You\'ll need to reconnect to send email from it again.')) return;
  try {
    await apiEmailDisconnect(provider);
    await loadEmailStatus(true);
    toast(label + ' disconnected');
  } catch (e: any) {
    toast('Disconnect failed: ' + (e && e.message ? e.message : String(e)));
  }
}

// When the user returns from the OAuth popup, refresh status.
window.addEventListener('focus', function () {
  if (!EMAIL_AWAITING_RETURN) return;
  EMAIL_AWAITING_RETURN = false;
  setTimeout(function () { loadEmailStatus(true); }, 800);
});

// ── Settings ▸ Email Integration (admin OAuth-app config) ─────────────────────

interface EmailConfig {
  googleClientId: string; microsoftClientId: string; microsoftTenant: string;
  googleSecretSet: boolean; microsoftSecretSet: boolean; signingSecretSet: boolean;
  redirectUri: string;
}
interface EmailCfgState { cfg: EmailConfig | null; loading: boolean; error: string | null; }
const EMAIL_CFG: EmailCfgState = { cfg: null, loading: false, error: null };

async function loadEmailConfig(force = false): Promise<void> {
  if (EMAIL_CFG.loading) return;
  if (EMAIL_CFG.cfg && !force) return;
  EMAIL_CFG.loading = true; EMAIL_CFG.error = null;
  try {
    EMAIL_CFG.cfg = await apiGetEmailConfig();
  } catch (e: any) {
    EMAIL_CFG.error = e && e.message ? e.message : String(e);
    EMAIL_CFG.cfg = null;
  } finally {
    EMAIL_CFG.loading = false;
    if (typeof render === 'function') render();
  }
}

// Forces the provider chooser open even when a provider is already set (so the
// admin can switch) — without persisting an empty provider mid-change.
let EMAIL_PICK_OPEN = false;
function openProviderPick(): void { EMAIL_PICK_OPEN = true; render(); }
function closeProviderPick(): void { EMAIL_PICK_OPEN = false; render(); }
async function setEmailProvider(p: string): Promise<void> {
  try {
    const merged = await saveSettingsSection('email', { provider: p });
    SETTINGS = merged || SETTINGS;
    EMAIL_PICK_OPEN = false;
    toast(p === 'google' ? 'Provider set to Gmail' : 'Provider set to Outlook');
    render();
  } catch (e: any) {
    toast('Could not save provider: ' + (e && e.message ? e.message : String(e)));
  }
}

function cfgTextField(dataK: string, label: string, value: string, placeholder: string): string {
  return `<div class="pab-fld"><label>${esc(label)}</label>
    <input type="text" data-k="${dataK}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" style="width:100%;box-sizing:border-box"></div>`;
}
function cfgSecretField(dataK: string, label: string, isSet: boolean): string {
  return `<div class="pab-fld"><label>${esc(label)} ${isSet ? '<span class="pill success">Set</span>' : '<span class="pill muted">Not set</span>'}</label>
    <input type="password" data-k="${dataK}" value="" placeholder="${isSet ? '•••••••• (leave blank to keep)' : 'Paste the client secret'}" autocomplete="new-password" style="width:100%;box-sizing:border-box"></div>`;
}

// Rendered by the Settings panel registry (settings.ts).
function emailConfigPanel(): string {
  if (!EMAIL_CFG.cfg && !EMAIL_CFG.loading && !EMAIL_CFG.error) loadEmailConfig();
  if (SETTINGS === null && !SETTINGS_LOADING) loadSettings();
  const head = `<div class="section-head">
      <div><h3>Email Integration</h3><p>Connect your organization's email provider so consultants can send email from their own mailboxes. Choose Outlook <b>or</b> Gmail — whichever your team uses.</p></div>
    </div>`;

  if (!EMAIL_CFG.cfg || SETTINGS === null) {
    const inner = EMAIL_CFG.error
      ? `<div class="empty"><div class="ico">${ic('alert', 22)}</div><b>Couldn't load the email configuration</b><p>${esc(EMAIL_CFG.error)}</p><button class="btn primary" onclick="loadEmailConfig(true)">${ic('clock', 15)} Retry</button></div>`
      : `<div class="empty"><div class="ico">${ic('clock', 22)}</div><b>Loading…</b></div>`;
    return head + `<div class="card">${inner}</div>`;
  }

  const provider = orgEmailProvider();
  if (!provider || EMAIL_PICK_OPEN) return head + emailProviderChooser(provider);
  return head + emailProviderConfigForm(provider);
}

// Step 1 — pick the org's single email provider.
function emailProviderChooser(current: string): string {
  const choice = (key: string, label: string, sub: string, accent: string): string =>
    `<div class="provider-choice ${current === key ? 'active' : ''}" role="button" tabindex="0" onclick="setEmailProvider('${key}')">
      <div class="email-logo" style="--accent:${accent}">${ic('msg', 22)}</div>
      <div class="pc-txt"><b>${esc(label)}</b><span>${esc(sub)}</span></div>
      ${current === key ? '<span class="pill success">Current</span>' : `<span class="pc-go">${ic('chevR', 16)}</span>`}
    </div>`;
  return `<div class="card" style="padding:20px 22px">
    <div class="cfg-q">Which email provider does your organization use?</div>
    <div class="provider-choices">
      ${choice('microsoft', 'Outlook / Microsoft 365', 'Send via Microsoft Graph (Mail.Send)', '#0078d4')}
      ${choice('google', 'Gmail / Google Workspace', 'Send via the Gmail API (gmail.send)', '#ea4335')}
    </div>
    ${current ? `<div class="pab-hint" style="margin-top:14px"><a href="#" onclick="closeProviderPick();return false;">Cancel — keep ${current === 'google' ? 'Gmail' : 'Outlook'}</a></div>` : ''}
  </div>`;
}

// Step 2 — configure the chosen provider only.
function emailProviderConfigForm(provider: string): string {
  const c = EMAIL_CFG.cfg as EmailConfig;
  const isG = provider === 'google';
  const label = isG ? 'Gmail / Google Workspace' : 'Outlook / Microsoft 365';
  const accent = isG ? '#ea4335' : '#0078d4';
  const idField = cfgTextField(
    isG ? 'googleClientId' : 'microsoftClientId',
    isG ? 'Client ID' : 'Application (client) ID',
    isG ? c.googleClientId : c.microsoftClientId,
    isG ? 'xxxxxxxx.apps.googleusercontent.com' : '00000000-0000-0000-0000-000000000000');
  const secretField = cfgSecretField(
    isG ? 'googleClientSecret' : 'microsoftClientSecret',
    isG ? 'Client secret' : 'Client secret value',
    isG ? c.googleSecretSet : c.microsoftSecretSet);
  const tenantBlock = isG ? '' :
    cfgTextField('microsoftTenant', 'Tenant', c.microsoftTenant || 'common', 'common') +
    `<div class="pab-hint">Use <code>common</code> for any Microsoft account, or your directory (tenant) ID to restrict to your organization.</div>`;

  return `<div id="__emailCfg">
    <div class="card edit-card cfg-head-row">
      <div class="cfg-provider"><div class="email-logo" style="--accent:${accent}">${ic('msg', 18)}</div><b>${esc(label)}</b></div>
      <button class="btn ghost" onclick="openProviderPick()">${ic('clock', 14)} Change provider</button>
    </div>
    <div class="card edit-card" style="margin-top:14px">
      <div class="c-row" style="margin-bottom:10px">${ic('info', 15)}<span>Register this <b>redirect URI</b> in your ${isG ? 'Google Cloud' : 'Azure'} app registration:</span></div>
      <div class="redirect-row">
        <code class="redirect-uri">${esc(c.redirectUri)}</code>
        <button class="btn outline" onclick="copyRedirectUri()">${ic('file', 14)} Copy</button>
      </div>
    </div>
    <div class="card edit-card" style="margin-top:14px">
      ${idField}
      ${secretField}
      ${tenantBlock}
    </div>
    <div class="card edit-card" style="margin-top:14px">
      <div class="edit-err" hidden></div>
      <div class="edit-foot">
        <span class="edit-status">${c.signingSecretSet ? '' : 'A signing secret will be generated automatically on first save.'}</span>
        <span style="flex:1"></span>
        <button class="btn primary js-save-emailcfg" onclick="saveEmailConfigForm()">${ic('save', 15)} Save configuration</button>
      </div>
    </div>
  </div>`;
}

function copyRedirectUri(): void {
  const uri = EMAIL_CFG.cfg ? EMAIL_CFG.cfg.redirectUri : '';
  if (!uri) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(uri).then(function () { toast('Redirect URI copied'); }, function () { toast('Copy failed — select the text manually'); });
    } else { toast('Copy not supported — select the text manually'); }
  } catch (_e) { toast('Copy failed — select the text manually'); }
}

async function saveEmailConfigForm(): Promise<void> {
  const root = document.getElementById('__emailCfg');
  if (!root) return;
  const cfg: Record<string, string> = {};
  const inputs = root.querySelectorAll('input[data-k]');
  for (let i = 0; i < inputs.length; i++) {
    const el = inputs[i] as HTMLInputElement;
    const k = el.getAttribute('data-k') || '';
    const isSecret = el.getAttribute('type') === 'password';
    const v = el.value;
    // Text fields always sent (blank clears); secrets only when a value was typed.
    if (isSecret) { if (v) cfg[k] = v; }
    else { cfg[k] = v.trim(); }
  }
  const btn = root.querySelector('.js-save-emailcfg') as HTMLButtonElement | null;
  const status = root.querySelector('.edit-status') as HTMLElement | null;
  const err = root.querySelector('.edit-err') as HTMLElement | null;
  if (err) err.hidden = true;
  if (btn) btn.disabled = true;
  if (status) status.textContent = 'Saving…';
  try {
    EMAIL_CFG.cfg = await apiSaveEmailConfig(cfg);
    toast('Email configuration saved');
    render();
  } catch (e: any) {
    if (btn) btn.disabled = false;
    if (status) status.textContent = '';
    if (err) { err.textContent = e && e.message ? e.message : String(e); err.hidden = false; }
  }
}
