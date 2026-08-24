/* =====================================================================
   public/signpage.ts — the parent-facing agreement signing page.

   Served at /spa/sign.html to a signer who is NOT logged in. Reads
   ?entity&clientid&logid&token from the URL, loads the frozen document + a gate
   verdict from the public runAsSuper endpoint /b/agreementSign (action=load),
   renders it through the shared renderer in signing.ts, and posts the signature
   back (action=submit) or declines (action=decline).

   Ported from the satellite merge report "Agreement Signing Page" (webdav
   1433496), which this replaces. The satellite site existed only because the CRM
   used to be a merge report behind a login; the GitSite serves anonymous traffic
   and /b/agreementSign answers on this host, so the extra site and domain are no
   longer needed. The endpoint itself is untouched — same actions, same params,
   same token contract, still public + runAsSuper. That endpoint remains the ONLY
   place a parent's signature data is written.

   Independent of the CRM bundle by design: no api.ts, no auth.ts, no components.ts.
   The only shared code is signing.ts.
   ===================================================================== */
(function () {
  'use strict';

  var INGESTER = '/b/agreementSign';
  var root = document.getElementById('sign-root');

  function qp(name: string): string {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }
  var meta = { entity: qp('entity') || 'client', clientid: qp('clientid'), logid: qp('logid'), token: qp('token') };

  var STATE = {
    doc: null as any,
    signer: null as any,
    merge: {} as { [k: string]: string },
    signers: [] as { role: string; name: string; status: string }[],
    title: '',
    org: '',
  };

  /* ── gates ──────────────────────────────────────────────────────────────────
     Verbatim from the satellite page — these strings are what a family sees when
     a link is stale, so they should not drift without a deliberate decision. */
  function gateMessage(gate: string): string {
    var map: { [k: string]: string[] } = {
      notfound: ['Link not found', 'This signing link is invalid or has expired.'],
      badtoken: ['Invalid link', 'This signing link is invalid. Please use the exact link from your email.'],
      voided: ['No longer available', 'This agreement has been withdrawn by the sender.'],
      declined: ['Declined', 'This signature request was declined.'],
      complete: ['Already completed', 'This agreement has already been fully signed. Thank you!'],
      alreadysigned: ['Already signed', 'You have already signed this document. Thank you!'],
      unconfigured: ['Not ready', 'This document is not ready to sign yet. Please contact the sender.'],
      notyourturn: ['Not your turn yet', 'These documents are signed in order, and an earlier signer has not finished yet. You will receive an email the moment it is your turn.'],
      expired: ['Expired', 'This signature request expired before all parties signed. Please contact the sender for a new one.'],
    };
    var m = map[gate] || ['Unavailable', 'This signing link cannot be opened.'];
    return '<div class="sg-msg"><h2>' + sigEsc(m[0]) + '</h2><p>' + sigEsc(m[1]) + '</p></div>';
  }

  function setRoot(html: string): void { if (root) root.innerHTML = html; }

  /* ── load ─────────────────────────────────────────────────────────────────── */
  var ACCESS_CODE = '';
  function load(): void {
    var url = INGESTER + '?action=load&entity=' + encodeURIComponent(meta.entity)
      + '&clientid=' + encodeURIComponent(meta.clientid)
      + '&logid=' + encodeURIComponent(meta.logid)
      + '&token=' + encodeURIComponent(meta.token)
      + (ACCESS_CODE ? '&code=' + encodeURIComponent(ACCESS_CODE) : '');
    fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) { setRoot(gateMessage('notfound')); return; }
        var d = j.data;
        if (d.gate === 'code') { renderCodeGate(!!d.bad); return; }
        if (d.gate !== 'ok') { setRoot(gateMessage(d.gate)); return; }
        STATE.doc = d.doc;
        STATE.signer = d.signer;
        STATE.merge = d.merge || {};
        STATE.signers = d.signers || [];
        if (d.kind === 'envelope') { renderEnvelopeSign(d); return; }
        // Pre-envelope (authored HTML) agreements are retired — treat as gone.
        setRoot(gateMessage('notfound'));
      })
      .catch(function () { setRoot(gateMessage('notfound')); });
  }

/* ── boot ─────────────────────────────────────────────────────────────────── */
  if (!meta.clientid || !meta.logid || !meta.token) setRoot(gateMessage('badtoken'));
  else load();

/* ---- v3 envelope flow — the shared signview does the heavy lifting ----
   Read-only when the envelope is completed (adds a PDF download) or when this
   signer already signed (waiting on others). Live signers also get a decline
   path — phase 4. */
function renderEnvelopeSign(d: any): void {
  if (!root) return;
  var me = d.me || {};
  var readOnly = !!(d.completed || d.mySigned);
  // ESIGN disclosure (phase 6): shown ONCE, before any signing UI, and the
  // acceptance (version + IP) is recorded server-side before the documents render.
  if (!readOnly && d.disclosure && d.disclosure.text && !d.meDisclosureAccepted) { renderDisclosure(d); return; }
  var headMsg = d.completed
    ? 'All parties have signed. Review the documents below, or download the completed PDF.'
    : d.mySigned
      ? 'You have signed — waiting on the remaining signers. You\'ll receive the completed PDF by email when everyone has finished.'
      : (me.name ? 'Please review and complete your fields, ' + sigEsc(me.name) + '.' : 'Please review and sign.');
  setRoot(
    '<div class="sg-wrap sv-wrap' + (readOnly ? ' sv-ro-mode' : '') + '">'
    + '<div class="sg-head">'
    + (d.orgName ? '<div class="sg-org">' + sigEsc(d.orgName) + '</div>' : '')
    + '<h1>' + sigEsc(d.title) + '</h1>'
    + '<p class="sg-hi">' + headMsg + '</p>'
    + (d.completed ? envDownloadsHtml(d) : '')
    + '</div>'
    + '<div id="sv-host"></div>'
    + (readOnly ? ''
      : '<label class="sg-consent"><input type="checkbox" id="sg-consent" onchange="svUpdateProgress()"> I agree to sign these documents electronically, and that my electronic signature is legally binding.</label>'
        + '<p class="sg-declinerow"><button type="button" class="sg-declineline" id="sg-envdecline">Decline to sign</button>'
        + ' · <button type="button" class="sg-declineline" id="sg-envwithdraw">Withdraw consent to sign electronically</button></p>')
    + '</div>');
  var pdfBtn = document.getElementById('sg-envpdf');
  if (pdfBtn) pdfBtn.onclick = function () { envPdfDownload('', null); };
  var dls = document.querySelectorAll('.sg-dl');
  for (var di = 0; di < dls.length; di++) {
    (function (el: any) { el.onclick = function () { envPdfDownload(el.getAttribute('data-docid') || '', el); }; })(dls[di]);
  }
  var decBtn = document.getElementById('sg-envdecline');
  if (decBtn) decBtn.onclick = function () { envDeclineFlow(false); };
  var wdBtn = document.getElementById('sg-envwithdraw');
  if (wdBtn) wdBtn.onclick = function () { envDeclineFlow(true); };
  svMount({
    container: document.getElementById('sv-host')!,
    env: d,
    meId: readOnly ? '' : (me.id || ''),
    submit: function (p) {
      var consent = document.getElementById('sg-consent');
      if (!consent || !(consent as HTMLInputElement).checked) { return Promise.reject(new Error('Please check the consent box to sign.')); }
      return fetch(INGESTER, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit', entity: meta.entity, clientid: meta.clientid, logid: meta.logid,
          token: meta.token, code: ACCESS_CODE, consent: true, signatureData: p.signatureData, initialsData: p.initialsData || '',
          typedName: p.typedName, tabValues: p.tabValues,
        }),
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.error) || 'Signing failed.');
        return j.data || j;
      });
    },
    onDone: function (res) {
      setRoot('<div class="sg-wrap"><div class="sg-done"><h1>Thank you!</h1>'
        + '<p>Your signature has been recorded.'
        + (res && res.completed ? ' All parties have now signed — the completed document is on file.' : ' You will receive a copy once all parties have signed.')
        + '</p></div></div>');
    },
  });
}

/* Completed downloads, split-output era: one button per signed document plus the
   certificate. Envelopes completed before the split keep the single merged-PDF
   button (no per-doc signed flags on their load). */
function envDownloadsHtml(d: any): string {
  var docs = (d.documents || []).filter(function (x: any) { return x.signed; });
  if (!docs.length) return '<p><button type="button" class="sg-btn primary" id="sg-envpdf">Download completed PDF</button></p>';
  var rows = '';
  for (var i = 0; i < docs.length; i++) {
    rows += '<button type="button" class="sg-btn sg-dl" data-docid="' + sigEsc(docs[i].id) + '">' + sigEsc(docs[i].name) + ' — signed</button>';
  }
  rows += '<button type="button" class="sg-btn primary sg-dl" data-docid="">Certificate of completion</button>';
  return '<div class="sg-dl-list">' + rows + '</div>';
}

/* Completed-envelope PDF: the bytes ride a token-gated response (the anonymous
   /download wall), then save via a blob link. docId picks one signed document;
   '' fetches the certificate (or the legacy merged PDF). */
function envPdfDownload(docId: string, btnEl: HTMLButtonElement | null): void {
  var btn = btnEl || (document.getElementById('sg-envpdf') as HTMLButtonElement | null);
  var orig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Preparing…'; }
  var restore = function () { if (btn) { btn.disabled = false; btn.textContent = orig; } };
  fetch(INGESTER, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'pdf', entity: meta.entity, clientid: meta.clientid, logid: meta.logid, token: meta.token, code: ACCESS_CODE, docId: docId || '' }),
  })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || !j.ok || !j.data || !j.data.dataB64) throw new Error((j && j.error) || 'The PDF isn\'t ready yet — try again shortly.');
      var bin = atob(j.data.dataB64);
      var u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([u8], { type: 'application/pdf' }));
      a.download = j.data.filename || 'completed-documents.pdf';
      a.click();
      restore();
    })
    .catch(function (e) { restore(); alert(e && e.message ? e.message : String(e)); });
}

function envDeclineFlow(withdrawn: boolean): void {
  var reason = prompt(withdrawn
    ? 'Withdraw your consent to sign electronically?\nThe sender will be notified and can arrange paper signing instead. Reason (optional):'
    : 'Decline to sign these documents?\nThe sender will be notified. Reason (optional):', '');
  if (reason == null) return;
  fetch(INGESTER, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'decline', entity: meta.entity, clientid: meta.clientid, logid: meta.logid, token: meta.token,
      reason: reason || (withdrawn ? 'Withdrew consent to electronic signing' : ''), withdrawn: withdrawn === true }),
  })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || !j.ok) throw new Error((j && j.error) || 'Could not record the decline.');
      setRoot('<div class="sg-msg"><h2>Declined</h2><p>You have declined to sign. The sender has been notified.</p></div>');
    })
    .catch(function (e) { alert(e && e.message ? e.message : String(e)); });
}

/* Access-code gate (phase 6): the recipient types the code the sender shared
   out-of-band; the envelope loads only when the server accepts it. */
function renderCodeGate(bad: boolean): void {
  setRoot('<div class="sg-msg"><h2>Access code required</h2>'
    + '<p>The sender protected these documents with an access code. Enter it to continue.</p>'
    + (bad ? '<p class="sg-code-bad">That code wasn\'t right — try again.</p>' : '')
    + '<p><input id="sg-code" class="sg-code-input" autocomplete="off" placeholder="Access code">'
    + ' <button type="button" class="sg-btn primary" id="sg-code-go">Continue</button></p></div>');
  var go = document.getElementById('sg-code-go');
  var inp = document.getElementById('sg-code') as HTMLInputElement | null;
  var submit = function () { ACCESS_CODE = inp ? inp.value.trim() : ''; if (ACCESS_CODE) load(); };
  if (go) (go as HTMLButtonElement).onclick = submit;
  if (inp) { inp.focus(); inp.onkeydown = function (e) { if ((e as KeyboardEvent).key === 'Enter') submit(); }; }
}

/* ESIGN disclosure screen — acceptance recorded server-side BEFORE signing. */
function renderDisclosure(d: any): void {
  var me = d.me || {};
  setRoot('<div class="sg-wrap">'
    + '<div class="sg-head">'
    + (d.orgName ? '<div class="sg-org">' + sigEsc(d.orgName) + '</div>' : '')
    + '<h1>Before you sign</h1>'
    + '<p class="sg-hi">' + (me.name ? sigEsc(me.name) + ', please' : 'Please') + ' review this disclosure about signing electronically.</p>'
    + '</div>'
    + '<pre class="sg-disclosure">' + sigEsc(d.disclosure.text) + '</pre>'
    + '<p class="sg-disc-acts">'
    + '<button type="button" class="sg-btn primary" id="sg-disc-agree">I agree — continue to the documents</button></p>'
    + '<p class="sg-declinerow"><button type="button" class="sg-declineline" id="sg-disc-no">I do not consent to electronic signing</button></p>'
    + '</div>');
  var agree = document.getElementById('sg-disc-agree') as HTMLButtonElement | null;
  if (agree) agree.onclick = function () {
    agree!.disabled = true; agree!.textContent = 'One moment…';
    fetch(INGESTER, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acceptDisclosure', entity: meta.entity, clientid: meta.clientid, logid: meta.logid, token: meta.token, code: ACCESS_CODE }),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.error) || 'Could not record your consent.');
        d.meDisclosureAccepted = true;
        renderEnvelopeSign(d);
      })
      .catch(function (e) { agree!.disabled = false; agree!.textContent = 'I agree — continue to the documents'; alert(e && e.message ? e.message : String(e)); });
  };
  var no = document.getElementById('sg-disc-no');
  if (no) (no as HTMLButtonElement).onclick = function () { envDeclineFlow(true); };
}

})();
