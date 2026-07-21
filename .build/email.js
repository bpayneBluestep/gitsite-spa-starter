const EMAIL_PROVIDERS = [
  { key: "google", label: "Gmail", brand: "Google", icon: "msg", accent: "#ea4335" },
  { key: "microsoft", label: "Outlook", brand: "Microsoft", icon: "msg", accent: "#0078d4" }
];
function orgEmailProvider() {
  const s = SETTINGS;
  return s && s.email && typeof s.email.provider === "string" ? s.email.provider : "";
}
function emailProviderMeta(key) {
  return EMAIL_PROVIDERS.filter((p) => p.key === key)[0] || null;
}
const EMAIL_STATE = { list: null, loading: false, error: null };
let EMAIL_AWAITING_RETURN = false;
async function loadEmailStatus(force = false) {
  if (EMAIL_STATE.loading) return;
  if (EMAIL_STATE.list && !force) return;
  EMAIL_STATE.loading = true;
  EMAIL_STATE.error = null;
  try {
    const rows = await apiEmailStatus();
    EMAIL_STATE.list = (Array.isArray(rows) ? rows : []).map((r) => ({
      provider: r.provider || "",
      email: r.email || "",
      status: r.status || "",
      connected: r.connected === true,
      expiresAtMs: Number(r.expiresAtMs) || 0
    }));
  } catch (e) {
    EMAIL_STATE.error = e && e.message ? e.message : String(e);
    EMAIL_STATE.list = null;
  } finally {
    EMAIL_STATE.loading = false;
    if (typeof render === "function") render();
  }
}
function emailAccountFor(brand) {
  if (!EMAIL_STATE.list) return null;
  return EMAIL_STATE.list.filter((a) => a.provider === brand)[0] || null;
}
function viewMyEmail() {
  const who = SESSION && SESSION.fullName ? SESSION.fullName : "";
  const head = pageHead("My Email", who ? `Connect your mailbox, ${esc(who)}, to send client emails from BlueStep.` : "Connect your mailbox to send client emails from BlueStep.");
  let body;
  if (EMAIL_STATE.list === null) {
    if (!EMAIL_STATE.loading && !EMAIL_STATE.error) loadEmailStatus();
    body = EMAIL_STATE.error ? `<div class="card"><div class="empty"><div class="ico">${ic("alert", 22)}</div><b>Couldn't load your email connections</b>
         <p>${esc(EMAIL_STATE.error)}</p><button class="btn primary" onclick="loadEmailStatus(true)">${ic("clock", 15)} Retry</button></div></div>` : `<div class="card"><div class="empty"><div class="ico">${ic("clock", 22)}</div><b>Loading\u2026</b></div></div>`;
    return shell("email", head + body);
  }
  if (SETTINGS === null) {
    if (!SETTINGS_LOADING) loadSettings();
    return shell("email", head + `<div class="card"><div class="empty"><div class="ico">${ic("clock", 22)}</div><b>Loading\u2026</b></div></div>`);
  }
  const prov = emailProviderMeta(orgEmailProvider());
  if (!prov) {
    return shell("email", head + `<div class="card"><div class="empty"><div class="ico">${ic("msg", 22)}</div>
      <b>Email isn't set up yet</b>
      <p>Your administrator hasn't configured an email provider for your organization. Once they do, you'll be able to connect your mailbox here.</p></div></div>`);
  }
  return shell("email", head + `<div class="email-grid one">${emailProviderCard(prov)}</div>
    <div class="card email-note"><div class="c-row">${ic("info", 15)}<span>Your mailbox is connected only for <b>you</b> \u2014 emails you send from BlueStep go out from your own ${esc(prov.label)} account. You can disconnect anytime.</span></div></div>`);
}
function emailProviderCard(p) {
  const acct = emailAccountFor(p.brand);
  const connected = !!acct && acct.connected;
  const connecting = !!acct && acct.status === "connecting";
  const errored = !!acct && acct.status === "error";
  let statusHtml;
  if (connected) {
    statusHtml = `<span class="pill success"><span class="dot"></span>Connected</span>${acct && acct.email ? `<span class="email-addr">${esc(acct.email)}</span>` : ""}`;
  } else if (connecting) {
    statusHtml = `<span class="pill warning"><span class="dot"></span>Finishing\u2026</span>`;
  } else if (errored) {
    statusHtml = `<span class="pill warning"><span class="dot"></span>Needs reconnect</span>`;
  } else {
    statusHtml = `<span class="pill muted"><span class="dot"></span>Not connected</span>`;
  }
  const actions = connected ? `<button class="btn outline" onclick="connectEmail('${p.key}')">${ic("clock", 15)} Reconnect</button>
       <button class="btn ghost danger" onclick="disconnectEmail('${p.key}')">${ic("trash", 15)} Disconnect</button>` : `<button class="btn primary" onclick="connectEmail('${p.key}')">${ic("external", 15)} Connect ${esc(p.label)}</button>`;
  return `<div class="card email-card">
    <div class="email-card-top">
      <div class="email-logo" style="--accent:${p.accent}">${ic("msg", 20)}</div>
      <div class="email-id"><div class="email-name">${esc(p.label)}</div><div class="email-status">${statusHtml}</div></div>
    </div>
    <div class="email-acts">${actions}</div>
  </div>`;
}
async function connectEmail(provider) {
  try {
    const popup = window.open("about:blank", "bsEmailOAuth", "width=520,height=660");
    const res = await apiEmailAuthUrl(provider);
    const url = res && res.authUrl ? String(res.authUrl) : "";
    if (!url) {
      if (popup) popup.close();
      toast("Could not start the connection \u2014 is this provider configured in Settings?");
      return;
    }
    EMAIL_AWAITING_RETURN = true;
    if (popup) {
      popup.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (e) {
    toast("Connect failed: " + (e && e.message ? e.message : String(e)));
  }
}
async function disconnectEmail(provider) {
  const label = provider === "google" ? "Gmail" : "Outlook";
  if (!window.confirm("Disconnect " + label + "? You'll need to reconnect to send email from it again.")) return;
  try {
    await apiEmailDisconnect(provider);
    await loadEmailStatus(true);
    toast(label + " disconnected");
  } catch (e) {
    toast("Disconnect failed: " + (e && e.message ? e.message : String(e)));
  }
}
window.addEventListener("focus", function() {
  if (!EMAIL_AWAITING_RETURN) return;
  EMAIL_AWAITING_RETURN = false;
  setTimeout(function() {
    loadEmailStatus(true);
  }, 800);
});
const EMAIL_CFG = { cfg: null, loading: false, error: null };
async function loadEmailConfig(force = false) {
  if (EMAIL_CFG.loading) return;
  if (EMAIL_CFG.cfg && !force) return;
  EMAIL_CFG.loading = true;
  EMAIL_CFG.error = null;
  try {
    EMAIL_CFG.cfg = await apiGetEmailConfig();
  } catch (e) {
    EMAIL_CFG.error = e && e.message ? e.message : String(e);
    EMAIL_CFG.cfg = null;
  } finally {
    EMAIL_CFG.loading = false;
    if (typeof render === "function") render();
  }
}
let EMAIL_PICK_OPEN = false;
function openProviderPick() {
  EMAIL_PICK_OPEN = true;
  render();
}
function closeProviderPick() {
  EMAIL_PICK_OPEN = false;
  render();
}
async function setEmailProvider(p) {
  try {
    const merged = await saveSettingsSection("email", { provider: p });
    SETTINGS = merged || SETTINGS;
    EMAIL_PICK_OPEN = false;
    toast(p === "google" ? "Provider set to Gmail" : "Provider set to Outlook");
    render();
  } catch (e) {
    toast("Could not save provider: " + (e && e.message ? e.message : String(e)));
  }
}
function cfgTextField(dataK, label, value, placeholder) {
  return `<div class="pab-fld"><label>${esc(label)}</label>
    <input type="text" data-k="${dataK}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" style="width:100%;box-sizing:border-box"></div>`;
}
function cfgSecretField(dataK, label, isSet) {
  return `<div class="pab-fld"><label>${esc(label)} ${isSet ? '<span class="pill success">Set</span>' : '<span class="pill muted">Not set</span>'}</label>
    <input type="password" data-k="${dataK}" value="" placeholder="${isSet ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (leave blank to keep)" : "Paste the client secret"}" autocomplete="new-password" style="width:100%;box-sizing:border-box"></div>`;
}
function emailConfigPanel() {
  if (!EMAIL_CFG.cfg && !EMAIL_CFG.loading && !EMAIL_CFG.error) loadEmailConfig();
  if (SETTINGS === null && !SETTINGS_LOADING) loadSettings();
  const head = `<div class="section-head">
      <div><h3>Email Integration</h3><p>Connect your organization's email provider so consultants can send email from their own mailboxes. Choose Outlook <b>or</b> Gmail \u2014 whichever your team uses.</p></div>
    </div>`;
  if (!EMAIL_CFG.cfg || SETTINGS === null) {
    const inner = EMAIL_CFG.error ? `<div class="empty"><div class="ico">${ic("alert", 22)}</div><b>Couldn't load the email configuration</b><p>${esc(EMAIL_CFG.error)}</p><button class="btn primary" onclick="loadEmailConfig(true)">${ic("clock", 15)} Retry</button></div>` : `<div class="empty"><div class="ico">${ic("clock", 22)}</div><b>Loading\u2026</b></div>`;
    return head + `<div class="card">${inner}</div>`;
  }
  const provider = orgEmailProvider();
  if (!provider || EMAIL_PICK_OPEN) return head + emailProviderChooser(provider);
  return head + emailProviderConfigForm(provider);
}
function emailProviderChooser(current) {
  const choice = (key, label, sub, accent) => `<div class="provider-choice ${current === key ? "active" : ""}" role="button" tabindex="0" onclick="setEmailProvider('${key}')">
      <div class="email-logo" style="--accent:${accent}">${ic("msg", 22)}</div>
      <div class="pc-txt"><b>${esc(label)}</b><span>${esc(sub)}</span></div>
      ${current === key ? '<span class="pill success">Current</span>' : `<span class="pc-go">${ic("chevR", 16)}</span>`}
    </div>`;
  return `<div class="card" style="padding:20px 22px">
    <div class="cfg-q">Which email provider does your organization use?</div>
    <div class="provider-choices">
      ${choice("microsoft", "Outlook / Microsoft 365", "Send via Microsoft Graph (Mail.Send)", "#0078d4")}
      ${choice("google", "Gmail / Google Workspace", "Send via the Gmail API (gmail.send)", "#ea4335")}
    </div>
    ${current ? `<div class="pab-hint" style="margin-top:14px"><a href="#" onclick="closeProviderPick();return false;">Cancel \u2014 keep ${current === "google" ? "Gmail" : "Outlook"}</a></div>` : ""}
  </div>`;
}
function emailProviderConfigForm(provider) {
  const c = EMAIL_CFG.cfg;
  const isG = provider === "google";
  const label = isG ? "Gmail / Google Workspace" : "Outlook / Microsoft 365";
  const accent = isG ? "#ea4335" : "#0078d4";
  const idField = cfgTextField(
    isG ? "googleClientId" : "microsoftClientId",
    isG ? "Client ID" : "Application (client) ID",
    isG ? c.googleClientId : c.microsoftClientId,
    isG ? "xxxxxxxx.apps.googleusercontent.com" : "00000000-0000-0000-0000-000000000000"
  );
  const secretField = cfgSecretField(
    isG ? "googleClientSecret" : "microsoftClientSecret",
    isG ? "Client secret" : "Client secret value",
    isG ? c.googleSecretSet : c.microsoftSecretSet
  );
  const tenantBlock = isG ? "" : cfgTextField("microsoftTenant", "Tenant", c.microsoftTenant || "common", "common") + `<div class="pab-hint">Use <code>common</code> for any Microsoft account, or your directory (tenant) ID to restrict to your organization.</div>`;
  return `<div id="__emailCfg">
    <div class="card edit-card cfg-head-row">
      <div class="cfg-provider"><div class="email-logo" style="--accent:${accent}">${ic("msg", 18)}</div><b>${esc(label)}</b></div>
      <button class="btn ghost" onclick="openProviderPick()">${ic("clock", 14)} Change provider</button>
    </div>
    <div class="card edit-card" style="margin-top:14px">
      <div class="c-row" style="margin-bottom:10px">${ic("info", 15)}<span>Register this <b>redirect URI</b> in your ${isG ? "Google Cloud" : "Azure"} app registration:</span></div>
      <div class="redirect-row">
        <code class="redirect-uri">${esc(c.redirectUri)}</code>
        <button class="btn outline" onclick="copyRedirectUri()">${ic("file", 14)} Copy</button>
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
        <span class="edit-status">${c.signingSecretSet ? "" : "A signing secret will be generated automatically on first save."}</span>
        <span style="flex:1"></span>
        <button class="btn primary js-save-emailcfg" onclick="saveEmailConfigForm()">${ic("save", 15)} Save configuration</button>
      </div>
    </div>
  </div>`;
}
function copyRedirectUri() {
  const uri = EMAIL_CFG.cfg ? EMAIL_CFG.cfg.redirectUri : "";
  if (!uri) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(uri).then(function() {
        toast("Redirect URI copied");
      }, function() {
        toast("Copy failed \u2014 select the text manually");
      });
    } else {
      toast("Copy not supported \u2014 select the text manually");
    }
  } catch (_e) {
    toast("Copy failed \u2014 select the text manually");
  }
}
async function saveEmailConfigForm() {
  const root = document.getElementById("__emailCfg");
  if (!root) return;
  const cfg = {};
  const inputs = root.querySelectorAll("input[data-k]");
  for (let i = 0; i < inputs.length; i++) {
    const el = inputs[i];
    const k = el.getAttribute("data-k") || "";
    const isSecret = el.getAttribute("type") === "password";
    const v = el.value;
    if (isSecret) {
      if (v) cfg[k] = v;
    } else {
      cfg[k] = v.trim();
    }
  }
  const btn = root.querySelector(".js-save-emailcfg");
  const status = root.querySelector(".edit-status");
  const err = root.querySelector(".edit-err");
  if (err) err.hidden = true;
  if (btn) btn.disabled = true;
  if (status) status.textContent = "Saving\u2026";
  try {
    EMAIL_CFG.cfg = await apiSaveEmailConfig(cfg);
    toast("Email configuration saved");
    render();
  } catch (e) {
    if (btn) btn.disabled = false;
    if (status) status.textContent = "";
    if (err) {
      err.textContent = e && e.message ? e.message : String(e);
      err.hidden = false;
    }
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiZW1haWwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgZW1haWwudHMgXHUyMDE0IEVtYWlsIGludGVncmF0aW9uIFVJLlxuXG4gICBUd28gc3VyZmFjZXM6XG4gICAxLiBUaGUgTXkgRW1haWwgcGFnZSAoIy9lbWFpbCkgXHUyMDE0IHBlci11c2VyIGNvbm5lY3QvZGlzY29ubmVjdCBvZiB0aGUgbG9nZ2VkLWluXG4gICAgICB1c2VyJ3MgR21haWwgLyBPdXRsb29rIG1haWxib3ggKyBjb25uZWN0aW9uIHN0YXR1cy4gV2lyZXMgdG8gdGhlIG1hZXN0cm8nc1xuICAgICAgZW1haWxTdGF0dXMgLyBlbWFpbEF1dGhVcmwgLyBlbWFpbERpc2Nvbm5lY3QgKHdoaWNoIHJ1biBhcyB0aGUgbG9nZ2VkLWluXG4gICAgICB1c2VyOyB0b2tlbnMgYXJlIHdyaXR0ZW4gdG8gdGhhdCB1c2VyJ3Mgb3duIHJlY29yZCBieSB0aGUgcHVibGljXG4gICAgICAvYi9tYWlsQXV0aCBicm9rZXIgYWZ0ZXIgT0F1dGggY29uc2VudCkuXG4gICAyLiBUaGUgU2V0dGluZ3MgXHUyNUI4IEVtYWlsIEludGVncmF0aW9uIGFkbWluIHBhbmVsIChlbWFpbENvbmZpZ1BhbmVsKSBcdTIwMTQgdGhlIG9yZ1xuICAgICAgT0F1dGgtYXBwIGNyZWRlbnRpYWxzIChHb29nbGUvTWljcm9zb2Z0IGNsaWVudCBpZHMgKyBzZWNyZXRzICsgdGVuYW50KS4gUmVhZHNcbiAgICAgIGdldEVtYWlsQ29uZmlnICh3aGljaCByZXR1cm5zIG9ubHkgd2hldGhlciBlYWNoIHNlY3JldCBpcyBzZXQpIGFuZCB3cml0ZXMgdmlhXG4gICAgICBzYXZlRW1haWxDb25maWcgKHNlY3JldHMgYXJlIHdyaXRlLW9ubHk6IGEgYmxhbmsgc2VjcmV0IGZpZWxkIGtlZXBzIHRoZVxuICAgICAgc3RvcmVkIHZhbHVlKS4gQWxzbyBzaG93cyB0aGUgcmVkaXJlY3QgVVJJIHRvIHBhc3RlIGludG8gdGhlIHByb3ZpZGVyIGFwcHMuXG5cbiAgIFRoZSBPQXV0aCBjb25zZW50IG9wZW5zIGluIGEgcG9wdXA7IHRoZSBicm9rZXIncyBjYWxsYmFjayBwYWdlIGF1dG8tY2xvc2VzIGl0LFxuICAgYW5kIHdlIHJlZnJlc2ggc3RhdHVzIHdoZW4gZm9jdXMgcmV0dXJucyB0byB0aGlzIHdpbmRvdy5cbiAgID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG5jb25zdCBFTUFJTF9QUk9WSURFUlMgPSBbXG4gIHsga2V5OiAnZ29vZ2xlJywgbGFiZWw6ICdHbWFpbCcsIGJyYW5kOiAnR29vZ2xlJywgaWNvbjogJ21zZycsIGFjY2VudDogJyNlYTQzMzUnIH0sXG4gIHsga2V5OiAnbWljcm9zb2Z0JywgbGFiZWw6ICdPdXRsb29rJywgYnJhbmQ6ICdNaWNyb3NvZnQnLCBpY29uOiAnbXNnJywgYWNjZW50OiAnIzAwNzhkNCcgfSxcbl07XG5cbi8vIEFuIG9yZyB1c2VzIGV4YWN0bHkgT05FIGVtYWlsIHByb3ZpZGVyIChHbWFpbCBPUiBPdXRsb29rKSwgbmV2ZXIgYm90aC4gVGhlXG4vLyBjaG9zZW4gcHJvdmlkZXIga2V5ICgnZ29vZ2xlJ3wnbWljcm9zb2Z0JykgbGl2ZXMgaW4gc2V0dGluZ3MuZW1haWwucHJvdmlkZXIgXHUyMDE0XG4vLyB0aGUgYWRtaW4gcGlja3MgaXQgaW4gU2V0dGluZ3MgXHUyNUI4IEVtYWlsIEludGVncmF0aW9uLCBhbmQgdGhlIE15IEVtYWlsIHBhZ2UgdGhlblxuLy8gb25seSBvZmZlcnMgdGhhdCBvbmUgbWFpbGJveCB0byBjb25uZWN0LlxuZnVuY3Rpb24gb3JnRW1haWxQcm92aWRlcigpOiBzdHJpbmcge1xuICBjb25zdCBzOiBhbnkgPSBTRVRUSU5HUztcbiAgcmV0dXJuIHMgJiYgcy5lbWFpbCAmJiB0eXBlb2Ygcy5lbWFpbC5wcm92aWRlciA9PT0gJ3N0cmluZycgPyBzLmVtYWlsLnByb3ZpZGVyIDogJyc7XG59XG5mdW5jdGlvbiBlbWFpbFByb3ZpZGVyTWV0YShrZXk6IHN0cmluZyk6IHsga2V5OiBzdHJpbmc7IGxhYmVsOiBzdHJpbmc7IGJyYW5kOiBzdHJpbmc7IGljb246IHN0cmluZzsgYWNjZW50OiBzdHJpbmcgfSB8IG51bGwge1xuICByZXR1cm4gRU1BSUxfUFJPVklERVJTLmZpbHRlcihwID0+IHAua2V5ID09PSBrZXkpWzBdIHx8IG51bGw7XG59XG5cbmludGVyZmFjZSBMaXZlRW1haWxBY2NvdW50IHsgcHJvdmlkZXI6IHN0cmluZzsgZW1haWw6IHN0cmluZzsgc3RhdHVzOiBzdHJpbmc7IGNvbm5lY3RlZDogYm9vbGVhbjsgZXhwaXJlc0F0TXM6IG51bWJlcjsgfVxuaW50ZXJmYWNlIEVtYWlsU3RhdGUgeyBsaXN0OiBMaXZlRW1haWxBY2NvdW50W10gfCBudWxsOyBsb2FkaW5nOiBib29sZWFuOyBlcnJvcjogc3RyaW5nIHwgbnVsbDsgfVxuY29uc3QgRU1BSUxfU1RBVEU6IEVtYWlsU3RhdGUgPSB7IGxpc3Q6IG51bGwsIGxvYWRpbmc6IGZhbHNlLCBlcnJvcjogbnVsbCB9O1xubGV0IEVNQUlMX0FXQUlUSU5HX1JFVFVSTiA9IGZhbHNlOyAvLyBzZXQgd2hpbGUgYW4gT0F1dGggcG9wdXAgaXMgb3BlblxuXG5hc3luYyBmdW5jdGlvbiBsb2FkRW1haWxTdGF0dXMoZm9yY2UgPSBmYWxzZSk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoRU1BSUxfU1RBVEUubG9hZGluZykgcmV0dXJuO1xuICBpZiAoRU1BSUxfU1RBVEUubGlzdCAmJiAhZm9yY2UpIHJldHVybjtcbiAgRU1BSUxfU1RBVEUubG9hZGluZyA9IHRydWU7IEVNQUlMX1NUQVRFLmVycm9yID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBjb25zdCByb3dzID0gYXdhaXQgYXBpRW1haWxTdGF0dXMoKTtcbiAgICBFTUFJTF9TVEFURS5saXN0ID0gKEFycmF5LmlzQXJyYXkocm93cykgPyByb3dzIDogW10pLm1hcCgocjogYW55KSA9PiAoe1xuICAgICAgcHJvdmlkZXI6IHIucHJvdmlkZXIgfHwgJycsIGVtYWlsOiByLmVtYWlsIHx8ICcnLCBzdGF0dXM6IHIuc3RhdHVzIHx8ICcnLFxuICAgICAgY29ubmVjdGVkOiByLmNvbm5lY3RlZCA9PT0gdHJ1ZSwgZXhwaXJlc0F0TXM6IE51bWJlcihyLmV4cGlyZXNBdE1zKSB8fCAwLFxuICAgIH0pKTtcbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgRU1BSUxfU1RBVEUuZXJyb3IgPSBlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKTtcbiAgICBFTUFJTF9TVEFURS5saXN0ID0gbnVsbDtcbiAgfSBmaW5hbGx5IHtcbiAgICBFTUFJTF9TVEFURS5sb2FkaW5nID0gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiByZW5kZXIgPT09ICdmdW5jdGlvbicpIHJlbmRlcigpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVtYWlsQWNjb3VudEZvcihicmFuZDogc3RyaW5nKTogTGl2ZUVtYWlsQWNjb3VudCB8IG51bGwge1xuICBpZiAoIUVNQUlMX1NUQVRFLmxpc3QpIHJldHVybiBudWxsO1xuICByZXR1cm4gRU1BSUxfU1RBVEUubGlzdC5maWx0ZXIoYSA9PiBhLnByb3ZpZGVyID09PSBicmFuZClbMF0gfHwgbnVsbDtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIE15IEVtYWlsIHBhZ2UgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5mdW5jdGlvbiB2aWV3TXlFbWFpbCgpOiBzdHJpbmcge1xuICBjb25zdCB3aG8gPSBTRVNTSU9OICYmIFNFU1NJT04uZnVsbE5hbWUgPyBTRVNTSU9OLmZ1bGxOYW1lIDogJyc7XG4gIGNvbnN0IGhlYWQgPSBwYWdlSGVhZCgnTXkgRW1haWwnLCB3aG8gPyBgQ29ubmVjdCB5b3VyIG1haWxib3gsICR7ZXNjKHdobyl9LCB0byBzZW5kIGNsaWVudCBlbWFpbHMgZnJvbSBCbHVlU3RlcC5gIDogJ0Nvbm5lY3QgeW91ciBtYWlsYm94IHRvIHNlbmQgY2xpZW50IGVtYWlscyBmcm9tIEJsdWVTdGVwLicpO1xuXG4gIGxldCBib2R5OiBzdHJpbmc7XG4gIGlmIChFTUFJTF9TVEFURS5saXN0ID09PSBudWxsKSB7XG4gICAgaWYgKCFFTUFJTF9TVEFURS5sb2FkaW5nICYmICFFTUFJTF9TVEFURS5lcnJvcikgbG9hZEVtYWlsU3RhdHVzKCk7XG4gICAgYm9keSA9IEVNQUlMX1NUQVRFLmVycm9yXG4gICAgICA/IGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdhbGVydCcsIDIyKX08L2Rpdj48Yj5Db3VsZG4ndCBsb2FkIHlvdXIgZW1haWwgY29ubmVjdGlvbnM8L2I+XG4gICAgICAgICA8cD4ke2VzYyhFTUFJTF9TVEFURS5lcnJvcil9PC9wPjxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeVwiIG9uY2xpY2s9XCJsb2FkRW1haWxTdGF0dXModHJ1ZSlcIj4ke2ljKCdjbG9jaycsIDE1KX0gUmV0cnk8L2J1dHRvbj48L2Rpdj48L2Rpdj5gXG4gICAgICA6IGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdjbG9jaycsIDIyKX08L2Rpdj48Yj5Mb2FkaW5nXHUyMDI2PC9iPjwvZGl2PjwvZGl2PmA7XG4gICAgcmV0dXJuIHNoZWxsKCdlbWFpbCcsIGhlYWQgKyBib2R5KTtcbiAgfVxuXG4gIC8vIFRoZSBvcmcgdXNlcyBvbmUgcHJvdmlkZXIuIExvYWQgc2V0dGluZ3MgaWYgbmVlZGVkLCB0aGVuIHNob3cgb25seSB0aGF0IG9uZS5cbiAgaWYgKFNFVFRJTkdTID09PSBudWxsKSB7XG4gICAgaWYgKCFTRVRUSU5HU19MT0FESU5HKSBsb2FkU2V0dGluZ3MoKTtcbiAgICByZXR1cm4gc2hlbGwoJ2VtYWlsJywgaGVhZCArIGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdjbG9jaycsIDIyKX08L2Rpdj48Yj5Mb2FkaW5nXHUyMDI2PC9iPjwvZGl2PjwvZGl2PmApO1xuICB9XG4gIGNvbnN0IHByb3YgPSBlbWFpbFByb3ZpZGVyTWV0YShvcmdFbWFpbFByb3ZpZGVyKCkpO1xuICBpZiAoIXByb3YpIHtcbiAgICByZXR1cm4gc2hlbGwoJ2VtYWlsJywgaGVhZCArIGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdtc2cnLCAyMil9PC9kaXY+XG4gICAgICA8Yj5FbWFpbCBpc24ndCBzZXQgdXAgeWV0PC9iPlxuICAgICAgPHA+WW91ciBhZG1pbmlzdHJhdG9yIGhhc24ndCBjb25maWd1cmVkIGFuIGVtYWlsIHByb3ZpZGVyIGZvciB5b3VyIG9yZ2FuaXphdGlvbi4gT25jZSB0aGV5IGRvLCB5b3UnbGwgYmUgYWJsZSB0byBjb25uZWN0IHlvdXIgbWFpbGJveCBoZXJlLjwvcD48L2Rpdj48L2Rpdj5gKTtcbiAgfVxuICByZXR1cm4gc2hlbGwoJ2VtYWlsJywgaGVhZCArIGA8ZGl2IGNsYXNzPVwiZW1haWwtZ3JpZCBvbmVcIj4ke2VtYWlsUHJvdmlkZXJDYXJkKHByb3YpfTwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJjYXJkIGVtYWlsLW5vdGVcIj48ZGl2IGNsYXNzPVwiYy1yb3dcIj4ke2ljKCdpbmZvJywgMTUpfTxzcGFuPllvdXIgbWFpbGJveCBpcyBjb25uZWN0ZWQgb25seSBmb3IgPGI+eW91PC9iPiBcdTIwMTQgZW1haWxzIHlvdSBzZW5kIGZyb20gQmx1ZVN0ZXAgZ28gb3V0IGZyb20geW91ciBvd24gJHtlc2MocHJvdi5sYWJlbCl9IGFjY291bnQuIFlvdSBjYW4gZGlzY29ubmVjdCBhbnl0aW1lLjwvc3Bhbj48L2Rpdj48L2Rpdj5gKTtcbn1cblxuZnVuY3Rpb24gZW1haWxQcm92aWRlckNhcmQocDogeyBrZXk6IHN0cmluZzsgbGFiZWw6IHN0cmluZzsgYnJhbmQ6IHN0cmluZzsgYWNjZW50OiBzdHJpbmcgfSk6IHN0cmluZyB7XG4gIGNvbnN0IGFjY3QgPSBlbWFpbEFjY291bnRGb3IocC5icmFuZCk7XG4gIGNvbnN0IGNvbm5lY3RlZCA9ICEhYWNjdCAmJiBhY2N0LmNvbm5lY3RlZDtcbiAgY29uc3QgY29ubmVjdGluZyA9ICEhYWNjdCAmJiBhY2N0LnN0YXR1cyA9PT0gJ2Nvbm5lY3RpbmcnO1xuICBjb25zdCBlcnJvcmVkID0gISFhY2N0ICYmIGFjY3Quc3RhdHVzID09PSAnZXJyb3InO1xuXG4gIGxldCBzdGF0dXNIdG1sOiBzdHJpbmc7XG4gIGlmIChjb25uZWN0ZWQpIHtcbiAgICBzdGF0dXNIdG1sID0gYDxzcGFuIGNsYXNzPVwicGlsbCBzdWNjZXNzXCI+PHNwYW4gY2xhc3M9XCJkb3RcIj48L3NwYW4+Q29ubmVjdGVkPC9zcGFuPiR7YWNjdCAmJiBhY2N0LmVtYWlsID8gYDxzcGFuIGNsYXNzPVwiZW1haWwtYWRkclwiPiR7ZXNjKGFjY3QuZW1haWwpfTwvc3Bhbj5gIDogJyd9YDtcbiAgfSBlbHNlIGlmIChjb25uZWN0aW5nKSB7XG4gICAgc3RhdHVzSHRtbCA9IGA8c3BhbiBjbGFzcz1cInBpbGwgd2FybmluZ1wiPjxzcGFuIGNsYXNzPVwiZG90XCI+PC9zcGFuPkZpbmlzaGluZ1x1MjAyNjwvc3Bhbj5gO1xuICB9IGVsc2UgaWYgKGVycm9yZWQpIHtcbiAgICBzdGF0dXNIdG1sID0gYDxzcGFuIGNsYXNzPVwicGlsbCB3YXJuaW5nXCI+PHNwYW4gY2xhc3M9XCJkb3RcIj48L3NwYW4+TmVlZHMgcmVjb25uZWN0PC9zcGFuPmA7XG4gIH0gZWxzZSB7XG4gICAgc3RhdHVzSHRtbCA9IGA8c3BhbiBjbGFzcz1cInBpbGwgbXV0ZWRcIj48c3BhbiBjbGFzcz1cImRvdFwiPjwvc3Bhbj5Ob3QgY29ubmVjdGVkPC9zcGFuPmA7XG4gIH1cblxuICBjb25zdCBhY3Rpb25zID0gY29ubmVjdGVkXG4gICAgPyBgPGJ1dHRvbiBjbGFzcz1cImJ0biBvdXRsaW5lXCIgb25jbGljaz1cImNvbm5lY3RFbWFpbCgnJHtwLmtleX0nKVwiPiR7aWMoJ2Nsb2NrJywgMTUpfSBSZWNvbm5lY3Q8L2J1dHRvbj5cbiAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0IGRhbmdlclwiIG9uY2xpY2s9XCJkaXNjb25uZWN0RW1haWwoJyR7cC5rZXl9JylcIj4ke2ljKCd0cmFzaCcsIDE1KX0gRGlzY29ubmVjdDwvYnV0dG9uPmBcbiAgICA6IGA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnlcIiBvbmNsaWNrPVwiY29ubmVjdEVtYWlsKCcke3Aua2V5fScpXCI+JHtpYygnZXh0ZXJuYWwnLCAxNSl9IENvbm5lY3QgJHtlc2MocC5sYWJlbCl9PC9idXR0b24+YDtcblxuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJjYXJkIGVtYWlsLWNhcmRcIj5cbiAgICA8ZGl2IGNsYXNzPVwiZW1haWwtY2FyZC10b3BcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJlbWFpbC1sb2dvXCIgc3R5bGU9XCItLWFjY2VudDoke3AuYWNjZW50fVwiPiR7aWMoJ21zZycsIDIwKX08L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJlbWFpbC1pZFwiPjxkaXYgY2xhc3M9XCJlbWFpbC1uYW1lXCI+JHtlc2MocC5sYWJlbCl9PC9kaXY+PGRpdiBjbGFzcz1cImVtYWlsLXN0YXR1c1wiPiR7c3RhdHVzSHRtbH08L2Rpdj48L2Rpdj5cbiAgICA8L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwiZW1haWwtYWN0c1wiPiR7YWN0aW9uc308L2Rpdj5cbiAgPC9kaXY+YDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gY29ubmVjdEVtYWlsKHByb3ZpZGVyOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgdHJ5IHtcbiAgICAvLyBPcGVuIHRoZSBwb3B1cCBzeW5jaHJvbm91c2x5IGZpcnN0IChhdm9pZHMgcG9wdXAtYmxvY2tlcnMpLCB0aGVuIG5hdmlnYXRlIGl0LlxuICAgIGNvbnN0IHBvcHVwID0gd2luZG93Lm9wZW4oJ2Fib3V0OmJsYW5rJywgJ2JzRW1haWxPQXV0aCcsICd3aWR0aD01MjAsaGVpZ2h0PTY2MCcpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGFwaUVtYWlsQXV0aFVybChwcm92aWRlcik7XG4gICAgY29uc3QgdXJsID0gcmVzICYmIHJlcy5hdXRoVXJsID8gU3RyaW5nKHJlcy5hdXRoVXJsKSA6ICcnO1xuICAgIGlmICghdXJsKSB7IGlmIChwb3B1cCkgcG9wdXAuY2xvc2UoKTsgdG9hc3QoJ0NvdWxkIG5vdCBzdGFydCB0aGUgY29ubmVjdGlvbiBcdTIwMTQgaXMgdGhpcyBwcm92aWRlciBjb25maWd1cmVkIGluIFNldHRpbmdzPycpOyByZXR1cm47IH1cbiAgICBFTUFJTF9BV0FJVElOR19SRVRVUk4gPSB0cnVlO1xuICAgIGlmIChwb3B1cCkgeyBwb3B1cC5sb2NhdGlvbi5ocmVmID0gdXJsOyB9IGVsc2UgeyB3aW5kb3cubG9jYXRpb24uaHJlZiA9IHVybDsgfVxuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICB0b2FzdCgnQ29ubmVjdCBmYWlsZWQ6ICcgKyAoZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBkaXNjb25uZWN0RW1haWwocHJvdmlkZXI6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBsYWJlbCA9IHByb3ZpZGVyID09PSAnZ29vZ2xlJyA/ICdHbWFpbCcgOiAnT3V0bG9vayc7XG4gIGlmICghd2luZG93LmNvbmZpcm0oJ0Rpc2Nvbm5lY3QgJyArIGxhYmVsICsgJz8gWW91XFwnbGwgbmVlZCB0byByZWNvbm5lY3QgdG8gc2VuZCBlbWFpbCBmcm9tIGl0IGFnYWluLicpKSByZXR1cm47XG4gIHRyeSB7XG4gICAgYXdhaXQgYXBpRW1haWxEaXNjb25uZWN0KHByb3ZpZGVyKTtcbiAgICBhd2FpdCBsb2FkRW1haWxTdGF0dXModHJ1ZSk7XG4gICAgdG9hc3QobGFiZWwgKyAnIGRpc2Nvbm5lY3RlZCcpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICB0b2FzdCgnRGlzY29ubmVjdCBmYWlsZWQ6ICcgKyAoZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpKTtcbiAgfVxufVxuXG4vLyBXaGVuIHRoZSB1c2VyIHJldHVybnMgZnJvbSB0aGUgT0F1dGggcG9wdXAsIHJlZnJlc2ggc3RhdHVzLlxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2ZvY3VzJywgZnVuY3Rpb24gKCkge1xuICBpZiAoIUVNQUlMX0FXQUlUSU5HX1JFVFVSTikgcmV0dXJuO1xuICBFTUFJTF9BV0FJVElOR19SRVRVUk4gPSBmYWxzZTtcbiAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7IGxvYWRFbWFpbFN0YXR1cyh0cnVlKTsgfSwgODAwKTtcbn0pO1xuXG4vLyBcdTI1MDBcdTI1MDAgU2V0dGluZ3MgXHUyNUI4IEVtYWlsIEludGVncmF0aW9uIChhZG1pbiBPQXV0aC1hcHAgY29uZmlnKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuaW50ZXJmYWNlIEVtYWlsQ29uZmlnIHtcbiAgZ29vZ2xlQ2xpZW50SWQ6IHN0cmluZzsgbWljcm9zb2Z0Q2xpZW50SWQ6IHN0cmluZzsgbWljcm9zb2Z0VGVuYW50OiBzdHJpbmc7XG4gIGdvb2dsZVNlY3JldFNldDogYm9vbGVhbjsgbWljcm9zb2Z0U2VjcmV0U2V0OiBib29sZWFuOyBzaWduaW5nU2VjcmV0U2V0OiBib29sZWFuO1xuICByZWRpcmVjdFVyaTogc3RyaW5nO1xufVxuaW50ZXJmYWNlIEVtYWlsQ2ZnU3RhdGUgeyBjZmc6IEVtYWlsQ29uZmlnIHwgbnVsbDsgbG9hZGluZzogYm9vbGVhbjsgZXJyb3I6IHN0cmluZyB8IG51bGw7IH1cbmNvbnN0IEVNQUlMX0NGRzogRW1haWxDZmdTdGF0ZSA9IHsgY2ZnOiBudWxsLCBsb2FkaW5nOiBmYWxzZSwgZXJyb3I6IG51bGwgfTtcblxuYXN5bmMgZnVuY3Rpb24gbG9hZEVtYWlsQ29uZmlnKGZvcmNlID0gZmFsc2UpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKEVNQUlMX0NGRy5sb2FkaW5nKSByZXR1cm47XG4gIGlmIChFTUFJTF9DRkcuY2ZnICYmICFmb3JjZSkgcmV0dXJuO1xuICBFTUFJTF9DRkcubG9hZGluZyA9IHRydWU7IEVNQUlMX0NGRy5lcnJvciA9IG51bGw7XG4gIHRyeSB7XG4gICAgRU1BSUxfQ0ZHLmNmZyA9IGF3YWl0IGFwaUdldEVtYWlsQ29uZmlnKCk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIEVNQUlMX0NGRy5lcnJvciA9IGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpO1xuICAgIEVNQUlMX0NGRy5jZmcgPSBudWxsO1xuICB9IGZpbmFsbHkge1xuICAgIEVNQUlMX0NGRy5sb2FkaW5nID0gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiByZW5kZXIgPT09ICdmdW5jdGlvbicpIHJlbmRlcigpO1xuICB9XG59XG5cbi8vIEZvcmNlcyB0aGUgcHJvdmlkZXIgY2hvb3NlciBvcGVuIGV2ZW4gd2hlbiBhIHByb3ZpZGVyIGlzIGFscmVhZHkgc2V0IChzbyB0aGVcbi8vIGFkbWluIGNhbiBzd2l0Y2gpIFx1MjAxNCB3aXRob3V0IHBlcnNpc3RpbmcgYW4gZW1wdHkgcHJvdmlkZXIgbWlkLWNoYW5nZS5cbmxldCBFTUFJTF9QSUNLX09QRU4gPSBmYWxzZTtcbmZ1bmN0aW9uIG9wZW5Qcm92aWRlclBpY2soKTogdm9pZCB7IEVNQUlMX1BJQ0tfT1BFTiA9IHRydWU7IHJlbmRlcigpOyB9XG5mdW5jdGlvbiBjbG9zZVByb3ZpZGVyUGljaygpOiB2b2lkIHsgRU1BSUxfUElDS19PUEVOID0gZmFsc2U7IHJlbmRlcigpOyB9XG5hc3luYyBmdW5jdGlvbiBzZXRFbWFpbFByb3ZpZGVyKHA6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICB0cnkge1xuICAgIGNvbnN0IG1lcmdlZCA9IGF3YWl0IHNhdmVTZXR0aW5nc1NlY3Rpb24oJ2VtYWlsJywgeyBwcm92aWRlcjogcCB9KTtcbiAgICBTRVRUSU5HUyA9IG1lcmdlZCB8fCBTRVRUSU5HUztcbiAgICBFTUFJTF9QSUNLX09QRU4gPSBmYWxzZTtcbiAgICB0b2FzdChwID09PSAnZ29vZ2xlJyA/ICdQcm92aWRlciBzZXQgdG8gR21haWwnIDogJ1Byb3ZpZGVyIHNldCB0byBPdXRsb29rJyk7XG4gICAgcmVuZGVyKCk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIHRvYXN0KCdDb3VsZCBub3Qgc2F2ZSBwcm92aWRlcjogJyArIChlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNmZ1RleHRGaWVsZChkYXRhSzogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCB2YWx1ZTogc3RyaW5nLCBwbGFjZWhvbGRlcjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwicGFiLWZsZFwiPjxsYWJlbD4ke2VzYyhsYWJlbCl9PC9sYWJlbD5cbiAgICA8aW5wdXQgdHlwZT1cInRleHRcIiBkYXRhLWs9XCIke2RhdGFLfVwiIHZhbHVlPVwiJHtlc2ModmFsdWUpfVwiIHBsYWNlaG9sZGVyPVwiJHtlc2MocGxhY2Vob2xkZXIpfVwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiIHN0eWxlPVwid2lkdGg6MTAwJTtib3gtc2l6aW5nOmJvcmRlci1ib3hcIj48L2Rpdj5gO1xufVxuZnVuY3Rpb24gY2ZnU2VjcmV0RmllbGQoZGF0YUs6IHN0cmluZywgbGFiZWw6IHN0cmluZywgaXNTZXQ6IGJvb2xlYW4pOiBzdHJpbmcge1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJwYWItZmxkXCI+PGxhYmVsPiR7ZXNjKGxhYmVsKX0gJHtpc1NldCA/ICc8c3BhbiBjbGFzcz1cInBpbGwgc3VjY2Vzc1wiPlNldDwvc3Bhbj4nIDogJzxzcGFuIGNsYXNzPVwicGlsbCBtdXRlZFwiPk5vdCBzZXQ8L3NwYW4+J308L2xhYmVsPlxuICAgIDxpbnB1dCB0eXBlPVwicGFzc3dvcmRcIiBkYXRhLWs9XCIke2RhdGFLfVwiIHZhbHVlPVwiXCIgcGxhY2Vob2xkZXI9XCIke2lzU2V0ID8gJ1x1MjAyMlx1MjAyMlx1MjAyMlx1MjAyMlx1MjAyMlx1MjAyMlx1MjAyMlx1MjAyMiAobGVhdmUgYmxhbmsgdG8ga2VlcCknIDogJ1Bhc3RlIHRoZSBjbGllbnQgc2VjcmV0J31cIiBhdXRvY29tcGxldGU9XCJuZXctcGFzc3dvcmRcIiBzdHlsZT1cIndpZHRoOjEwMCU7Ym94LXNpemluZzpib3JkZXItYm94XCI+PC9kaXY+YDtcbn1cblxuLy8gUmVuZGVyZWQgYnkgdGhlIFNldHRpbmdzIHBhbmVsIHJlZ2lzdHJ5IChzZXR0aW5ncy50cykuXG5mdW5jdGlvbiBlbWFpbENvbmZpZ1BhbmVsKCk6IHN0cmluZyB7XG4gIGlmICghRU1BSUxfQ0ZHLmNmZyAmJiAhRU1BSUxfQ0ZHLmxvYWRpbmcgJiYgIUVNQUlMX0NGRy5lcnJvcikgbG9hZEVtYWlsQ29uZmlnKCk7XG4gIGlmIChTRVRUSU5HUyA9PT0gbnVsbCAmJiAhU0VUVElOR1NfTE9BRElORykgbG9hZFNldHRpbmdzKCk7XG4gIGNvbnN0IGhlYWQgPSBgPGRpdiBjbGFzcz1cInNlY3Rpb24taGVhZFwiPlxuICAgICAgPGRpdj48aDM+RW1haWwgSW50ZWdyYXRpb248L2gzPjxwPkNvbm5lY3QgeW91ciBvcmdhbml6YXRpb24ncyBlbWFpbCBwcm92aWRlciBzbyBjb25zdWx0YW50cyBjYW4gc2VuZCBlbWFpbCBmcm9tIHRoZWlyIG93biBtYWlsYm94ZXMuIENob29zZSBPdXRsb29rIDxiPm9yPC9iPiBHbWFpbCBcdTIwMTQgd2hpY2hldmVyIHlvdXIgdGVhbSB1c2VzLjwvcD48L2Rpdj5cbiAgICA8L2Rpdj5gO1xuXG4gIGlmICghRU1BSUxfQ0ZHLmNmZyB8fCBTRVRUSU5HUyA9PT0gbnVsbCkge1xuICAgIGNvbnN0IGlubmVyID0gRU1BSUxfQ0ZHLmVycm9yXG4gICAgICA/IGA8ZGl2IGNsYXNzPVwiZW1wdHlcIj48ZGl2IGNsYXNzPVwiaWNvXCI+JHtpYygnYWxlcnQnLCAyMil9PC9kaXY+PGI+Q291bGRuJ3QgbG9hZCB0aGUgZW1haWwgY29uZmlndXJhdGlvbjwvYj48cD4ke2VzYyhFTUFJTF9DRkcuZXJyb3IpfTwvcD48YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnlcIiBvbmNsaWNrPVwibG9hZEVtYWlsQ29uZmlnKHRydWUpXCI+JHtpYygnY2xvY2snLCAxNSl9IFJldHJ5PC9idXR0b24+PC9kaXY+YFxuICAgICAgOiBgPGRpdiBjbGFzcz1cImVtcHR5XCI+PGRpdiBjbGFzcz1cImljb1wiPiR7aWMoJ2Nsb2NrJywgMjIpfTwvZGl2PjxiPkxvYWRpbmdcdTIwMjY8L2I+PC9kaXY+YDtcbiAgICByZXR1cm4gaGVhZCArIGA8ZGl2IGNsYXNzPVwiY2FyZFwiPiR7aW5uZXJ9PC9kaXY+YDtcbiAgfVxuXG4gIGNvbnN0IHByb3ZpZGVyID0gb3JnRW1haWxQcm92aWRlcigpO1xuICBpZiAoIXByb3ZpZGVyIHx8IEVNQUlMX1BJQ0tfT1BFTikgcmV0dXJuIGhlYWQgKyBlbWFpbFByb3ZpZGVyQ2hvb3Nlcihwcm92aWRlcik7XG4gIHJldHVybiBoZWFkICsgZW1haWxQcm92aWRlckNvbmZpZ0Zvcm0ocHJvdmlkZXIpO1xufVxuXG4vLyBTdGVwIDEgXHUyMDE0IHBpY2sgdGhlIG9yZydzIHNpbmdsZSBlbWFpbCBwcm92aWRlci5cbmZ1bmN0aW9uIGVtYWlsUHJvdmlkZXJDaG9vc2VyKGN1cnJlbnQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IGNob2ljZSA9IChrZXk6IHN0cmluZywgbGFiZWw6IHN0cmluZywgc3ViOiBzdHJpbmcsIGFjY2VudDogc3RyaW5nKTogc3RyaW5nID0+XG4gICAgYDxkaXYgY2xhc3M9XCJwcm92aWRlci1jaG9pY2UgJHtjdXJyZW50ID09PSBrZXkgPyAnYWN0aXZlJyA6ICcnfVwiIHJvbGU9XCJidXR0b25cIiB0YWJpbmRleD1cIjBcIiBvbmNsaWNrPVwic2V0RW1haWxQcm92aWRlcignJHtrZXl9JylcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJlbWFpbC1sb2dvXCIgc3R5bGU9XCItLWFjY2VudDoke2FjY2VudH1cIj4ke2ljKCdtc2cnLCAyMil9PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwicGMtdHh0XCI+PGI+JHtlc2MobGFiZWwpfTwvYj48c3Bhbj4ke2VzYyhzdWIpfTwvc3Bhbj48L2Rpdj5cbiAgICAgICR7Y3VycmVudCA9PT0ga2V5ID8gJzxzcGFuIGNsYXNzPVwicGlsbCBzdWNjZXNzXCI+Q3VycmVudDwvc3Bhbj4nIDogYDxzcGFuIGNsYXNzPVwicGMtZ29cIj4ke2ljKCdjaGV2UicsIDE2KX08L3NwYW4+YH1cbiAgICA8L2Rpdj5gO1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJjYXJkXCIgc3R5bGU9XCJwYWRkaW5nOjIwcHggMjJweFwiPlxuICAgIDxkaXYgY2xhc3M9XCJjZmctcVwiPldoaWNoIGVtYWlsIHByb3ZpZGVyIGRvZXMgeW91ciBvcmdhbml6YXRpb24gdXNlPzwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJwcm92aWRlci1jaG9pY2VzXCI+XG4gICAgICAke2Nob2ljZSgnbWljcm9zb2Z0JywgJ091dGxvb2sgLyBNaWNyb3NvZnQgMzY1JywgJ1NlbmQgdmlhIE1pY3Jvc29mdCBHcmFwaCAoTWFpbC5TZW5kKScsICcjMDA3OGQ0Jyl9XG4gICAgICAke2Nob2ljZSgnZ29vZ2xlJywgJ0dtYWlsIC8gR29vZ2xlIFdvcmtzcGFjZScsICdTZW5kIHZpYSB0aGUgR21haWwgQVBJIChnbWFpbC5zZW5kKScsICcjZWE0MzM1Jyl9XG4gICAgPC9kaXY+XG4gICAgJHtjdXJyZW50ID8gYDxkaXYgY2xhc3M9XCJwYWItaGludFwiIHN0eWxlPVwibWFyZ2luLXRvcDoxNHB4XCI+PGEgaHJlZj1cIiNcIiBvbmNsaWNrPVwiY2xvc2VQcm92aWRlclBpY2soKTtyZXR1cm4gZmFsc2U7XCI+Q2FuY2VsIFx1MjAxNCBrZWVwICR7Y3VycmVudCA9PT0gJ2dvb2dsZScgPyAnR21haWwnIDogJ091dGxvb2snfTwvYT48L2Rpdj5gIDogJyd9XG4gIDwvZGl2PmA7XG59XG5cbi8vIFN0ZXAgMiBcdTIwMTQgY29uZmlndXJlIHRoZSBjaG9zZW4gcHJvdmlkZXIgb25seS5cbmZ1bmN0aW9uIGVtYWlsUHJvdmlkZXJDb25maWdGb3JtKHByb3ZpZGVyOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBjID0gRU1BSUxfQ0ZHLmNmZyBhcyBFbWFpbENvbmZpZztcbiAgY29uc3QgaXNHID0gcHJvdmlkZXIgPT09ICdnb29nbGUnO1xuICBjb25zdCBsYWJlbCA9IGlzRyA/ICdHbWFpbCAvIEdvb2dsZSBXb3Jrc3BhY2UnIDogJ091dGxvb2sgLyBNaWNyb3NvZnQgMzY1JztcbiAgY29uc3QgYWNjZW50ID0gaXNHID8gJyNlYTQzMzUnIDogJyMwMDc4ZDQnO1xuICBjb25zdCBpZEZpZWxkID0gY2ZnVGV4dEZpZWxkKFxuICAgIGlzRyA/ICdnb29nbGVDbGllbnRJZCcgOiAnbWljcm9zb2Z0Q2xpZW50SWQnLFxuICAgIGlzRyA/ICdDbGllbnQgSUQnIDogJ0FwcGxpY2F0aW9uIChjbGllbnQpIElEJyxcbiAgICBpc0cgPyBjLmdvb2dsZUNsaWVudElkIDogYy5taWNyb3NvZnRDbGllbnRJZCxcbiAgICBpc0cgPyAneHh4eHh4eHguYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20nIDogJzAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCcpO1xuICBjb25zdCBzZWNyZXRGaWVsZCA9IGNmZ1NlY3JldEZpZWxkKFxuICAgIGlzRyA/ICdnb29nbGVDbGllbnRTZWNyZXQnIDogJ21pY3Jvc29mdENsaWVudFNlY3JldCcsXG4gICAgaXNHID8gJ0NsaWVudCBzZWNyZXQnIDogJ0NsaWVudCBzZWNyZXQgdmFsdWUnLFxuICAgIGlzRyA/IGMuZ29vZ2xlU2VjcmV0U2V0IDogYy5taWNyb3NvZnRTZWNyZXRTZXQpO1xuICBjb25zdCB0ZW5hbnRCbG9jayA9IGlzRyA/ICcnIDpcbiAgICBjZmdUZXh0RmllbGQoJ21pY3Jvc29mdFRlbmFudCcsICdUZW5hbnQnLCBjLm1pY3Jvc29mdFRlbmFudCB8fCAnY29tbW9uJywgJ2NvbW1vbicpICtcbiAgICBgPGRpdiBjbGFzcz1cInBhYi1oaW50XCI+VXNlIDxjb2RlPmNvbW1vbjwvY29kZT4gZm9yIGFueSBNaWNyb3NvZnQgYWNjb3VudCwgb3IgeW91ciBkaXJlY3RvcnkgKHRlbmFudCkgSUQgdG8gcmVzdHJpY3QgdG8geW91ciBvcmdhbml6YXRpb24uPC9kaXY+YDtcblxuICByZXR1cm4gYDxkaXYgaWQ9XCJfX2VtYWlsQ2ZnXCI+XG4gICAgPGRpdiBjbGFzcz1cImNhcmQgZWRpdC1jYXJkIGNmZy1oZWFkLXJvd1wiPlxuICAgICAgPGRpdiBjbGFzcz1cImNmZy1wcm92aWRlclwiPjxkaXYgY2xhc3M9XCJlbWFpbC1sb2dvXCIgc3R5bGU9XCItLWFjY2VudDoke2FjY2VudH1cIj4ke2ljKCdtc2cnLCAxOCl9PC9kaXY+PGI+JHtlc2MobGFiZWwpfTwvYj48L2Rpdj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBvbmNsaWNrPVwib3BlblByb3ZpZGVyUGljaygpXCI+JHtpYygnY2xvY2snLCAxNCl9IENoYW5nZSBwcm92aWRlcjwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJjYXJkIGVkaXQtY2FyZFwiIHN0eWxlPVwibWFyZ2luLXRvcDoxNHB4XCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiYy1yb3dcIiBzdHlsZT1cIm1hcmdpbi1ib3R0b206MTBweFwiPiR7aWMoJ2luZm8nLCAxNSl9PHNwYW4+UmVnaXN0ZXIgdGhpcyA8Yj5yZWRpcmVjdCBVUkk8L2I+IGluIHlvdXIgJHtpc0cgPyAnR29vZ2xlIENsb3VkJyA6ICdBenVyZSd9IGFwcCByZWdpc3RyYXRpb246PC9zcGFuPjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cInJlZGlyZWN0LXJvd1wiPlxuICAgICAgICA8Y29kZSBjbGFzcz1cInJlZGlyZWN0LXVyaVwiPiR7ZXNjKGMucmVkaXJlY3RVcmkpfTwvY29kZT5cbiAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBvdXRsaW5lXCIgb25jbGljaz1cImNvcHlSZWRpcmVjdFVyaSgpXCI+JHtpYygnZmlsZScsIDE0KX0gQ29weTwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cImNhcmQgZWRpdC1jYXJkXCIgc3R5bGU9XCJtYXJnaW4tdG9wOjE0cHhcIj5cbiAgICAgICR7aWRGaWVsZH1cbiAgICAgICR7c2VjcmV0RmllbGR9XG4gICAgICAke3RlbmFudEJsb2NrfVxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJjYXJkIGVkaXQtY2FyZFwiIHN0eWxlPVwibWFyZ2luLXRvcDoxNHB4XCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiZWRpdC1lcnJcIiBoaWRkZW4+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiZWRpdC1mb290XCI+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwiZWRpdC1zdGF0dXNcIj4ke2Muc2lnbmluZ1NlY3JldFNldCA/ICcnIDogJ0Egc2lnbmluZyBzZWNyZXQgd2lsbCBiZSBnZW5lcmF0ZWQgYXV0b21hdGljYWxseSBvbiBmaXJzdCBzYXZlLid9PC9zcGFuPlxuICAgICAgICA8c3BhbiBzdHlsZT1cImZsZXg6MVwiPjwvc3Bhbj5cbiAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBwcmltYXJ5IGpzLXNhdmUtZW1haWxjZmdcIiBvbmNsaWNrPVwic2F2ZUVtYWlsQ29uZmlnRm9ybSgpXCI+JHtpYygnc2F2ZScsIDE1KX0gU2F2ZSBjb25maWd1cmF0aW9uPC9idXR0b24+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgPC9kaXY+YDtcbn1cblxuZnVuY3Rpb24gY29weVJlZGlyZWN0VXJpKCk6IHZvaWQge1xuICBjb25zdCB1cmkgPSBFTUFJTF9DRkcuY2ZnID8gRU1BSUxfQ0ZHLmNmZy5yZWRpcmVjdFVyaSA6ICcnO1xuICBpZiAoIXVyaSkgcmV0dXJuO1xuICB0cnkge1xuICAgIGlmIChuYXZpZ2F0b3IuY2xpcGJvYXJkICYmIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KSB7XG4gICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCh1cmkpLnRoZW4oZnVuY3Rpb24gKCkgeyB0b2FzdCgnUmVkaXJlY3QgVVJJIGNvcGllZCcpOyB9LCBmdW5jdGlvbiAoKSB7IHRvYXN0KCdDb3B5IGZhaWxlZCBcdTIwMTQgc2VsZWN0IHRoZSB0ZXh0IG1hbnVhbGx5Jyk7IH0pO1xuICAgIH0gZWxzZSB7IHRvYXN0KCdDb3B5IG5vdCBzdXBwb3J0ZWQgXHUyMDE0IHNlbGVjdCB0aGUgdGV4dCBtYW51YWxseScpOyB9XG4gIH0gY2F0Y2ggKF9lKSB7IHRvYXN0KCdDb3B5IGZhaWxlZCBcdTIwMTQgc2VsZWN0IHRoZSB0ZXh0IG1hbnVhbGx5Jyk7IH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc2F2ZUVtYWlsQ29uZmlnRm9ybSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgcm9vdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX2VtYWlsQ2ZnJyk7XG4gIGlmICghcm9vdCkgcmV0dXJuO1xuICBjb25zdCBjZmc6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgY29uc3QgaW5wdXRzID0gcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dFtkYXRhLWtdJyk7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZWwgPSBpbnB1dHNbaV0gYXMgSFRNTElucHV0RWxlbWVudDtcbiAgICBjb25zdCBrID0gZWwuZ2V0QXR0cmlidXRlKCdkYXRhLWsnKSB8fCAnJztcbiAgICBjb25zdCBpc1NlY3JldCA9IGVsLmdldEF0dHJpYnV0ZSgndHlwZScpID09PSAncGFzc3dvcmQnO1xuICAgIGNvbnN0IHYgPSBlbC52YWx1ZTtcbiAgICAvLyBUZXh0IGZpZWxkcyBhbHdheXMgc2VudCAoYmxhbmsgY2xlYXJzKTsgc2VjcmV0cyBvbmx5IHdoZW4gYSB2YWx1ZSB3YXMgdHlwZWQuXG4gICAgaWYgKGlzU2VjcmV0KSB7IGlmICh2KSBjZmdba10gPSB2OyB9XG4gICAgZWxzZSB7IGNmZ1trXSA9IHYudHJpbSgpOyB9XG4gIH1cbiAgY29uc3QgYnRuID0gcm9vdC5xdWVyeVNlbGVjdG9yKCcuanMtc2F2ZS1lbWFpbGNmZycpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcbiAgY29uc3Qgc3RhdHVzID0gcm9vdC5xdWVyeVNlbGVjdG9yKCcuZWRpdC1zdGF0dXMnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGNvbnN0IGVyciA9IHJvb3QucXVlcnlTZWxlY3RvcignLmVkaXQtZXJyJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICBpZiAoZXJyKSBlcnIuaGlkZGVuID0gdHJ1ZTtcbiAgaWYgKGJ0bikgYnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgaWYgKHN0YXR1cykgc3RhdHVzLnRleHRDb250ZW50ID0gJ1NhdmluZ1x1MjAyNic7XG4gIHRyeSB7XG4gICAgRU1BSUxfQ0ZHLmNmZyA9IGF3YWl0IGFwaVNhdmVFbWFpbENvbmZpZyhjZmcpO1xuICAgIHRvYXN0KCdFbWFpbCBjb25maWd1cmF0aW9uIHNhdmVkJyk7XG4gICAgcmVuZGVyKCk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIGlmIChidG4pIGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICcnO1xuICAgIGlmIChlcnIpIHsgZXJyLnRleHRDb250ZW50ID0gZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSk7IGVyci5oaWRkZW4gPSBmYWxzZTsgfVxuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFtQkEsTUFBTSxrQkFBa0I7QUFBQSxFQUN0QixFQUFFLEtBQUssVUFBVSxPQUFPLFNBQVMsT0FBTyxVQUFVLE1BQU0sT0FBTyxRQUFRLFVBQVU7QUFBQSxFQUNqRixFQUFFLEtBQUssYUFBYSxPQUFPLFdBQVcsT0FBTyxhQUFhLE1BQU0sT0FBTyxRQUFRLFVBQVU7QUFDM0Y7QUFNQSxTQUFTLG1CQUEyQjtBQUNsQyxRQUFNLElBQVM7QUFDZixTQUFPLEtBQUssRUFBRSxTQUFTLE9BQU8sRUFBRSxNQUFNLGFBQWEsV0FBVyxFQUFFLE1BQU0sV0FBVztBQUNuRjtBQUNBLFNBQVMsa0JBQWtCLEtBQWlHO0FBQzFILFNBQU8sZ0JBQWdCLE9BQU8sT0FBSyxFQUFFLFFBQVEsR0FBRyxFQUFFLENBQUMsS0FBSztBQUMxRDtBQUlBLE1BQU0sY0FBMEIsRUFBRSxNQUFNLE1BQU0sU0FBUyxPQUFPLE9BQU8sS0FBSztBQUMxRSxJQUFJLHdCQUF3QjtBQUU1QixlQUFlLGdCQUFnQixRQUFRLE9BQXNCO0FBQzNELE1BQUksWUFBWSxRQUFTO0FBQ3pCLE1BQUksWUFBWSxRQUFRLENBQUMsTUFBTztBQUNoQyxjQUFZLFVBQVU7QUFBTSxjQUFZLFFBQVE7QUFDaEQsTUFBSTtBQUNGLFVBQU0sT0FBTyxNQUFNLGVBQWU7QUFDbEMsZ0JBQVksUUFBUSxNQUFNLFFBQVEsSUFBSSxJQUFJLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFZO0FBQUEsTUFDcEUsVUFBVSxFQUFFLFlBQVk7QUFBQSxNQUFJLE9BQU8sRUFBRSxTQUFTO0FBQUEsTUFBSSxRQUFRLEVBQUUsVUFBVTtBQUFBLE1BQ3RFLFdBQVcsRUFBRSxjQUFjO0FBQUEsTUFBTSxhQUFhLE9BQU8sRUFBRSxXQUFXLEtBQUs7QUFBQSxJQUN6RSxFQUFFO0FBQUEsRUFDSixTQUFTLEdBQVE7QUFDZixnQkFBWSxRQUFRLEtBQUssRUFBRSxVQUFVLEVBQUUsVUFBVSxPQUFPLENBQUM7QUFDekQsZ0JBQVksT0FBTztBQUFBLEVBQ3JCLFVBQUU7QUFDQSxnQkFBWSxVQUFVO0FBQ3RCLFFBQUksT0FBTyxXQUFXLFdBQVksUUFBTztBQUFBLEVBQzNDO0FBQ0Y7QUFFQSxTQUFTLGdCQUFnQixPQUF3QztBQUMvRCxNQUFJLENBQUMsWUFBWSxLQUFNLFFBQU87QUFDOUIsU0FBTyxZQUFZLEtBQUssT0FBTyxPQUFLLEVBQUUsYUFBYSxLQUFLLEVBQUUsQ0FBQyxLQUFLO0FBQ2xFO0FBR0EsU0FBUyxjQUFzQjtBQUM3QixRQUFNLE1BQU0sV0FBVyxRQUFRLFdBQVcsUUFBUSxXQUFXO0FBQzdELFFBQU0sT0FBTyxTQUFTLFlBQVksTUFBTSx5QkFBeUIsSUFBSSxHQUFHLENBQUMsMkNBQTJDLDJEQUEyRDtBQUUvSyxNQUFJO0FBQ0osTUFBSSxZQUFZLFNBQVMsTUFBTTtBQUM3QixRQUFJLENBQUMsWUFBWSxXQUFXLENBQUMsWUFBWSxNQUFPLGlCQUFnQjtBQUNoRSxXQUFPLFlBQVksUUFDZix5REFBeUQsR0FBRyxTQUFTLEVBQUUsQ0FBQztBQUFBLGNBQ2xFLElBQUksWUFBWSxLQUFLLENBQUMsbUVBQW1FLEdBQUcsU0FBUyxFQUFFLENBQUMsZ0NBQzlHLHlEQUF5RCxHQUFHLFNBQVMsRUFBRSxDQUFDO0FBQzVFLFdBQU8sTUFBTSxTQUFTLE9BQU8sSUFBSTtBQUFBLEVBQ25DO0FBR0EsTUFBSSxhQUFhLE1BQU07QUFDckIsUUFBSSxDQUFDLGlCQUFrQixjQUFhO0FBQ3BDLFdBQU8sTUFBTSxTQUFTLE9BQU8seURBQXlELEdBQUcsU0FBUyxFQUFFLENBQUMsd0NBQW1DO0FBQUEsRUFDMUk7QUFDQSxRQUFNLE9BQU8sa0JBQWtCLGlCQUFpQixDQUFDO0FBQ2pELE1BQUksQ0FBQyxNQUFNO0FBQ1QsV0FBTyxNQUFNLFNBQVMsT0FBTyx5REFBeUQsR0FBRyxPQUFPLEVBQUUsQ0FBQztBQUFBO0FBQUEsa0tBRTJEO0FBQUEsRUFDaEs7QUFDQSxTQUFPLE1BQU0sU0FBUyxPQUFPLCtCQUErQixrQkFBa0IsSUFBSSxDQUFDO0FBQUEsc0RBQy9CLEdBQUcsUUFBUSxFQUFFLENBQUMsaUhBQTRHLElBQUksS0FBSyxLQUFLLENBQUMsMERBQTBEO0FBQ3pQO0FBRUEsU0FBUyxrQkFBa0IsR0FBMEU7QUFDbkcsUUFBTSxPQUFPLGdCQUFnQixFQUFFLEtBQUs7QUFDcEMsUUFBTSxZQUFZLENBQUMsQ0FBQyxRQUFRLEtBQUs7QUFDakMsUUFBTSxhQUFhLENBQUMsQ0FBQyxRQUFRLEtBQUssV0FBVztBQUM3QyxRQUFNLFVBQVUsQ0FBQyxDQUFDLFFBQVEsS0FBSyxXQUFXO0FBRTFDLE1BQUk7QUFDSixNQUFJLFdBQVc7QUFDYixpQkFBYSx1RUFBdUUsUUFBUSxLQUFLLFFBQVEsNEJBQTRCLElBQUksS0FBSyxLQUFLLENBQUMsWUFBWSxFQUFFO0FBQUEsRUFDcEssV0FBVyxZQUFZO0FBQ3JCLGlCQUFhO0FBQUEsRUFDZixXQUFXLFNBQVM7QUFDbEIsaUJBQWE7QUFBQSxFQUNmLE9BQU87QUFDTCxpQkFBYTtBQUFBLEVBQ2Y7QUFFQSxRQUFNLFVBQVUsWUFDWixzREFBc0QsRUFBRSxHQUFHLE9BQU8sR0FBRyxTQUFTLEVBQUUsQ0FBQztBQUFBLG9FQUNuQixFQUFFLEdBQUcsT0FBTyxHQUFHLFNBQVMsRUFBRSxDQUFDLHlCQUN6RixzREFBc0QsRUFBRSxHQUFHLE9BQU8sR0FBRyxZQUFZLEVBQUUsQ0FBQyxZQUFZLElBQUksRUFBRSxLQUFLLENBQUM7QUFFaEgsU0FBTztBQUFBO0FBQUEsZ0RBRXVDLEVBQUUsTUFBTSxLQUFLLEdBQUcsT0FBTyxFQUFFLENBQUM7QUFBQSxzREFDcEIsSUFBSSxFQUFFLEtBQUssQ0FBQyxtQ0FBbUMsVUFBVTtBQUFBO0FBQUEsOEJBRWpGLE9BQU87QUFBQTtBQUVyQztBQUVBLGVBQWUsYUFBYSxVQUFpQztBQUMzRCxNQUFJO0FBRUYsVUFBTSxRQUFRLE9BQU8sS0FBSyxlQUFlLGdCQUFnQixzQkFBc0I7QUFDL0UsVUFBTSxNQUFNLE1BQU0sZ0JBQWdCLFFBQVE7QUFDMUMsVUFBTSxNQUFNLE9BQU8sSUFBSSxVQUFVLE9BQU8sSUFBSSxPQUFPLElBQUk7QUFDdkQsUUFBSSxDQUFDLEtBQUs7QUFBRSxVQUFJLE1BQU8sT0FBTSxNQUFNO0FBQUcsWUFBTSxnRkFBMkU7QUFBRztBQUFBLElBQVE7QUFDbEksNEJBQXdCO0FBQ3hCLFFBQUksT0FBTztBQUFFLFlBQU0sU0FBUyxPQUFPO0FBQUEsSUFBSyxPQUFPO0FBQUUsYUFBTyxTQUFTLE9BQU87QUFBQSxJQUFLO0FBQUEsRUFDL0UsU0FBUyxHQUFRO0FBQ2YsVUFBTSxzQkFBc0IsS0FBSyxFQUFFLFVBQVUsRUFBRSxVQUFVLE9BQU8sQ0FBQyxFQUFFO0FBQUEsRUFDckU7QUFDRjtBQUVBLGVBQWUsZ0JBQWdCLFVBQWlDO0FBQzlELFFBQU0sUUFBUSxhQUFhLFdBQVcsVUFBVTtBQUNoRCxNQUFJLENBQUMsT0FBTyxRQUFRLGdCQUFnQixRQUFRLHlEQUEwRCxFQUFHO0FBQ3pHLE1BQUk7QUFDRixVQUFNLG1CQUFtQixRQUFRO0FBQ2pDLFVBQU0sZ0JBQWdCLElBQUk7QUFDMUIsVUFBTSxRQUFRLGVBQWU7QUFBQSxFQUMvQixTQUFTLEdBQVE7QUFDZixVQUFNLHlCQUF5QixLQUFLLEVBQUUsVUFBVSxFQUFFLFVBQVUsT0FBTyxDQUFDLEVBQUU7QUFBQSxFQUN4RTtBQUNGO0FBR0EsT0FBTyxpQkFBaUIsU0FBUyxXQUFZO0FBQzNDLE1BQUksQ0FBQyxzQkFBdUI7QUFDNUIsMEJBQXdCO0FBQ3hCLGFBQVcsV0FBWTtBQUFFLG9CQUFnQixJQUFJO0FBQUEsRUFBRyxHQUFHLEdBQUc7QUFDeEQsQ0FBQztBQVVELE1BQU0sWUFBMkIsRUFBRSxLQUFLLE1BQU0sU0FBUyxPQUFPLE9BQU8sS0FBSztBQUUxRSxlQUFlLGdCQUFnQixRQUFRLE9BQXNCO0FBQzNELE1BQUksVUFBVSxRQUFTO0FBQ3ZCLE1BQUksVUFBVSxPQUFPLENBQUMsTUFBTztBQUM3QixZQUFVLFVBQVU7QUFBTSxZQUFVLFFBQVE7QUFDNUMsTUFBSTtBQUNGLGNBQVUsTUFBTSxNQUFNLGtCQUFrQjtBQUFBLEVBQzFDLFNBQVMsR0FBUTtBQUNmLGNBQVUsUUFBUSxLQUFLLEVBQUUsVUFBVSxFQUFFLFVBQVUsT0FBTyxDQUFDO0FBQ3ZELGNBQVUsTUFBTTtBQUFBLEVBQ2xCLFVBQUU7QUFDQSxjQUFVLFVBQVU7QUFDcEIsUUFBSSxPQUFPLFdBQVcsV0FBWSxRQUFPO0FBQUEsRUFDM0M7QUFDRjtBQUlBLElBQUksa0JBQWtCO0FBQ3RCLFNBQVMsbUJBQXlCO0FBQUUsb0JBQWtCO0FBQU0sU0FBTztBQUFHO0FBQ3RFLFNBQVMsb0JBQTBCO0FBQUUsb0JBQWtCO0FBQU8sU0FBTztBQUFHO0FBQ3hFLGVBQWUsaUJBQWlCLEdBQTBCO0FBQ3hELE1BQUk7QUFDRixVQUFNLFNBQVMsTUFBTSxvQkFBb0IsU0FBUyxFQUFFLFVBQVUsRUFBRSxDQUFDO0FBQ2pFLGVBQVcsVUFBVTtBQUNyQixzQkFBa0I7QUFDbEIsVUFBTSxNQUFNLFdBQVcsMEJBQTBCLHlCQUF5QjtBQUMxRSxXQUFPO0FBQUEsRUFDVCxTQUFTLEdBQVE7QUFDZixVQUFNLCtCQUErQixLQUFLLEVBQUUsVUFBVSxFQUFFLFVBQVUsT0FBTyxDQUFDLEVBQUU7QUFBQSxFQUM5RTtBQUNGO0FBRUEsU0FBUyxhQUFhLE9BQWUsT0FBZSxPQUFlLGFBQTZCO0FBQzlGLFNBQU8sK0JBQStCLElBQUksS0FBSyxDQUFDO0FBQUEsaUNBQ2pCLEtBQUssWUFBWSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsSUFBSSxXQUFXLENBQUM7QUFDOUY7QUFDQSxTQUFTLGVBQWUsT0FBZSxPQUFlLE9BQXdCO0FBQzVFLFNBQU8sK0JBQStCLElBQUksS0FBSyxDQUFDLElBQUksUUFBUSwwQ0FBMEMseUNBQXlDO0FBQUEscUNBQzVHLEtBQUssMkJBQTJCLFFBQVEsMkVBQW1DLHlCQUF5QjtBQUN6STtBQUdBLFNBQVMsbUJBQTJCO0FBQ2xDLE1BQUksQ0FBQyxVQUFVLE9BQU8sQ0FBQyxVQUFVLFdBQVcsQ0FBQyxVQUFVLE1BQU8saUJBQWdCO0FBQzlFLE1BQUksYUFBYSxRQUFRLENBQUMsaUJBQWtCLGNBQWE7QUFDekQsUUFBTSxPQUFPO0FBQUE7QUFBQTtBQUliLE1BQUksQ0FBQyxVQUFVLE9BQU8sYUFBYSxNQUFNO0FBQ3ZDLFVBQU0sUUFBUSxVQUFVLFFBQ3BCLHVDQUF1QyxHQUFHLFNBQVMsRUFBRSxDQUFDLHdEQUF3RCxJQUFJLFVBQVUsS0FBSyxDQUFDLG1FQUFtRSxHQUFHLFNBQVMsRUFBRSxDQUFDLDBCQUNwTix1Q0FBdUMsR0FBRyxTQUFTLEVBQUUsQ0FBQztBQUMxRCxXQUFPLE9BQU8scUJBQXFCLEtBQUs7QUFBQSxFQUMxQztBQUVBLFFBQU0sV0FBVyxpQkFBaUI7QUFDbEMsTUFBSSxDQUFDLFlBQVksZ0JBQWlCLFFBQU8sT0FBTyxxQkFBcUIsUUFBUTtBQUM3RSxTQUFPLE9BQU8sd0JBQXdCLFFBQVE7QUFDaEQ7QUFHQSxTQUFTLHFCQUFxQixTQUF5QjtBQUNyRCxRQUFNLFNBQVMsQ0FBQyxLQUFhLE9BQWUsS0FBYSxXQUN2RCwrQkFBK0IsWUFBWSxNQUFNLFdBQVcsRUFBRSwyREFBMkQsR0FBRztBQUFBLGdEQUNoRixNQUFNLEtBQUssR0FBRyxPQUFPLEVBQUUsQ0FBQztBQUFBLCtCQUN6QyxJQUFJLEtBQUssQ0FBQyxhQUFhLElBQUksR0FBRyxDQUFDO0FBQUEsUUFDdEQsWUFBWSxNQUFNLDhDQUE4Qyx1QkFBdUIsR0FBRyxTQUFTLEVBQUUsQ0FBQyxTQUFTO0FBQUE7QUFFckgsU0FBTztBQUFBO0FBQUE7QUFBQSxRQUdELE9BQU8sYUFBYSwyQkFBMkIsd0NBQXdDLFNBQVMsQ0FBQztBQUFBLFFBQ2pHLE9BQU8sVUFBVSw0QkFBNEIsdUNBQXVDLFNBQVMsQ0FBQztBQUFBO0FBQUEsTUFFaEcsVUFBVSw0SEFBdUgsWUFBWSxXQUFXLFVBQVUsU0FBUyxlQUFlLEVBQUU7QUFBQTtBQUVsTTtBQUdBLFNBQVMsd0JBQXdCLFVBQTBCO0FBQ3pELFFBQU0sSUFBSSxVQUFVO0FBQ3BCLFFBQU0sTUFBTSxhQUFhO0FBQ3pCLFFBQU0sUUFBUSxNQUFNLDZCQUE2QjtBQUNqRCxRQUFNLFNBQVMsTUFBTSxZQUFZO0FBQ2pDLFFBQU0sVUFBVTtBQUFBLElBQ2QsTUFBTSxtQkFBbUI7QUFBQSxJQUN6QixNQUFNLGNBQWM7QUFBQSxJQUNwQixNQUFNLEVBQUUsaUJBQWlCLEVBQUU7QUFBQSxJQUMzQixNQUFNLHdDQUF3QztBQUFBLEVBQXNDO0FBQ3RGLFFBQU0sY0FBYztBQUFBLElBQ2xCLE1BQU0sdUJBQXVCO0FBQUEsSUFDN0IsTUFBTSxrQkFBa0I7QUFBQSxJQUN4QixNQUFNLEVBQUUsa0JBQWtCLEVBQUU7QUFBQSxFQUFrQjtBQUNoRCxRQUFNLGNBQWMsTUFBTSxLQUN4QixhQUFhLG1CQUFtQixVQUFVLEVBQUUsbUJBQW1CLFVBQVUsUUFBUSxJQUNqRjtBQUVGLFNBQU87QUFBQTtBQUFBLDBFQUVpRSxNQUFNLEtBQUssR0FBRyxPQUFPLEVBQUUsQ0FBQyxZQUFZLElBQUksS0FBSyxDQUFDO0FBQUEsK0RBQ3pELEdBQUcsU0FBUyxFQUFFLENBQUM7QUFBQTtBQUFBO0FBQUEsc0RBR3hCLEdBQUcsUUFBUSxFQUFFLENBQUMsbURBQW1ELE1BQU0saUJBQWlCLE9BQU87QUFBQTtBQUFBLHFDQUVoSCxJQUFJLEVBQUUsV0FBVyxDQUFDO0FBQUEsa0VBQ1csR0FBRyxRQUFRLEVBQUUsQ0FBQztBQUFBO0FBQUE7QUFBQTtBQUFBLFFBSXhFLE9BQU87QUFBQSxRQUNQLFdBQVc7QUFBQSxRQUNYLFdBQVc7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLG9DQUtpQixFQUFFLG1CQUFtQixLQUFLLGlFQUFpRTtBQUFBO0FBQUEsdUZBRXhDLEdBQUcsUUFBUSxFQUFFLENBQUM7QUFBQTtBQUFBO0FBQUE7QUFJckc7QUFFQSxTQUFTLGtCQUF3QjtBQUMvQixRQUFNLE1BQU0sVUFBVSxNQUFNLFVBQVUsSUFBSSxjQUFjO0FBQ3hELE1BQUksQ0FBQyxJQUFLO0FBQ1YsTUFBSTtBQUNGLFFBQUksVUFBVSxhQUFhLFVBQVUsVUFBVSxXQUFXO0FBQ3hELGdCQUFVLFVBQVUsVUFBVSxHQUFHLEVBQUUsS0FBSyxXQUFZO0FBQUUsY0FBTSxxQkFBcUI7QUFBQSxNQUFHLEdBQUcsV0FBWTtBQUFFLGNBQU0sNkNBQXdDO0FBQUEsTUFBRyxDQUFDO0FBQUEsSUFDekosT0FBTztBQUFFLFlBQU0sb0RBQStDO0FBQUEsSUFBRztBQUFBLEVBQ25FLFNBQVMsSUFBSTtBQUFFLFVBQU0sNkNBQXdDO0FBQUEsRUFBRztBQUNsRTtBQUVBLGVBQWUsc0JBQXFDO0FBQ2xELFFBQU0sT0FBTyxTQUFTLGVBQWUsWUFBWTtBQUNqRCxNQUFJLENBQUMsS0FBTTtBQUNYLFFBQU0sTUFBOEIsQ0FBQztBQUNyQyxRQUFNLFNBQVMsS0FBSyxpQkFBaUIsZUFBZTtBQUNwRCxXQUFTLElBQUksR0FBRyxJQUFJLE9BQU8sUUFBUSxLQUFLO0FBQ3RDLFVBQU0sS0FBSyxPQUFPLENBQUM7QUFDbkIsVUFBTSxJQUFJLEdBQUcsYUFBYSxRQUFRLEtBQUs7QUFDdkMsVUFBTSxXQUFXLEdBQUcsYUFBYSxNQUFNLE1BQU07QUFDN0MsVUFBTSxJQUFJLEdBQUc7QUFFYixRQUFJLFVBQVU7QUFBRSxVQUFJLEVBQUcsS0FBSSxDQUFDLElBQUk7QUFBQSxJQUFHLE9BQzlCO0FBQUUsVUFBSSxDQUFDLElBQUksRUFBRSxLQUFLO0FBQUEsSUFBRztBQUFBLEVBQzVCO0FBQ0EsUUFBTSxNQUFNLEtBQUssY0FBYyxtQkFBbUI7QUFDbEQsUUFBTSxTQUFTLEtBQUssY0FBYyxjQUFjO0FBQ2hELFFBQU0sTUFBTSxLQUFLLGNBQWMsV0FBVztBQUMxQyxNQUFJLElBQUssS0FBSSxTQUFTO0FBQ3RCLE1BQUksSUFBSyxLQUFJLFdBQVc7QUFDeEIsTUFBSSxPQUFRLFFBQU8sY0FBYztBQUNqQyxNQUFJO0FBQ0YsY0FBVSxNQUFNLE1BQU0sbUJBQW1CLEdBQUc7QUFDNUMsVUFBTSwyQkFBMkI7QUFDakMsV0FBTztBQUFBLEVBQ1QsU0FBUyxHQUFRO0FBQ2YsUUFBSSxJQUFLLEtBQUksV0FBVztBQUN4QixRQUFJLE9BQVEsUUFBTyxjQUFjO0FBQ2pDLFFBQUksS0FBSztBQUFFLFVBQUksY0FBYyxLQUFLLEVBQUUsVUFBVSxFQUFFLFVBQVUsT0FBTyxDQUFDO0FBQUcsVUFBSSxTQUFTO0FBQUEsSUFBTztBQUFBLEVBQzNGO0FBQ0Y7IiwKICAibmFtZXMiOiBbXQp9Cg==
