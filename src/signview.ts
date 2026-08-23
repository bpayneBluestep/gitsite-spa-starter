/* =====================================================================
   signview.ts — the shared ENVELOPE signing view (schema v3).

   Renders every page of every document with pdf.js and overlays the placed tabs
   at their pdfgeo coordinates: the current signer's tabs are live controls;
   everyone else's render read-only (values included — you see what you co-sign).
   The adopt-once signature modal is reused from signing.ts (sigClickSign /
   sigAdopted / sigNormalize).

   Used by BOTH surfaces — public/signpage.ts (parents, anonymous) and
   agreements.ts (consultant in-app) — which is what keeps them identical. The
   host supplies the container and the submit function; this file owns rendering,
   the NEXT walker, and required-field gating.
   ===================================================================== */

interface SvHost {
  container: HTMLElement;
  env: any;                 // { title, documents[], tabs[], recipients[], me }
  meId: string;             // recipient id of the person signing ('' = read-only)
  submit: (payload: { signatureData: string; typedName: string; tabValues: Record<string, any> }) => Promise<any>;
  onDone: (res: any) => void;
}

let SV: SvHost | null = null;
const SV_BASE_W = 816;

function svMount(host: SvHost): void {
  SV = host;
  sigResetAdopted();
  sigOnChange(svRepaintMine);
  const docs = (host.env.documents || []).slice().sort((a: any, b: any) => a.order - b.order);
  let html = '<div class="sv-doc-list">';
  for (const doc of docs) {
    const n = Math.max(1, doc.pages || 1);
    html += `<div class="sv-docname">${sigEsc(doc.name)}</div>`;
    for (let p = 1; p <= n; p++) {
      html += `<div class="sv-page" data-doc="${sigEsc(doc.id)}" data-page="${p}" data-url="${sigEsc(doc.sourceUrl)}">
        <canvas></canvas><div class="sv-overlay"></div></div>`;
    }
  }
  html += '</div>';
  host.container.innerHTML = html
    + `<div class="sv-bar">
        <div class="sv-progress" id="sv-progress"></div>
        <button type="button" class="sg-btn ghost" id="sv-next" onclick="svNext()">Next</button>
        <button type="button" class="sg-btn primary" id="sv-finish" onclick="svFinish()" disabled>Finish</button>
      </div>`;
  svRenderPages();
}

const SV_PAGES: GeoPage[] = [];
async function svRenderPages(): Promise<void> {
  const host = SV; if (!host) return;
  SV_PAGES.length = 0;
  const width = Math.min(SV_BASE_W, Math.max(320, (host.container.clientWidth || SV_BASE_W) - 8));
  const els = host.container.querySelectorAll('.sv-page');
  const byUrl: { [u: string]: any } = {};
  for (let i = 0; i < els.length; i++) {
    const el = els[i] as HTMLElement;
    const url = el.getAttribute('data-url') || '';
    const docId = el.getAttribute('data-doc') || '';
    const pageNum = Number(el.getAttribute('data-page')) || 1;
    const canvas = el.querySelector('canvas') as HTMLCanvasElement;
    try {
      const docMeta = (host.env.documents || []).find((d: any) => d.id === docId);
      const key = url || docId;
      if (!byUrl[key]) byUrl[key] = docMeta && docMeta.dataB64 ? await pdfOpenData(docMeta.dataB64) : await pdfOpen(url);
      if (key !== url) { /* keyed by docId when embedded */ }
      const dims = await pdfRenderPage(byUrl[url || docId], pageNum, canvas, width);
      SV_PAGES.push({ docId: docId, page: pageNum, wPt: dims.wPt, hPt: dims.hPt });
      el.style.width = canvas.style.width; el.style.height = canvas.style.height;
      svPaintOverlay(el, docId, pageNum, width);
    } catch (_e) { el.classList.add('sv-page-err'); }
  }
  svUpdateProgress();
}

function svScale(docId: string, page: number, width: number): number {
  const info = SV_PAGES.find(p => p.docId === docId && p.page === page);
  return info ? geoScale(width, info.wPt) : 1;
}

function svPaintOverlay(pageEl: HTMLElement, docId: string, page: number, width: number): void {
  const host = SV!;
  const overlay = pageEl.querySelector('.sv-overlay') as HTMLElement;
  const scale = svScale(docId, page, width);
  overlay.innerHTML = '';
  const byId: { [k: string]: any } = {};
  for (const r of (host.env.recipients || [])) byId[r.id] = r;
  for (const t of (host.env.tabs || [])) {
    if (t.docId !== docId || t.page !== page) continue;
    const mine = t.recipientId === host.meId;
    const owner = byId[t.recipientId] || {};
    const el = document.createElement('div');
    el.className = 'sv-tab ' + (mine ? 'mine' : 'theirs');
    el.setAttribute('data-svtab', t.id);
    geoApplyTabRect(el, t, scale);
    el.innerHTML = svTabHtml(t, owner, mine);
    overlay.appendChild(el);
  }
}

/* The control (mine) or the read-only value (theirs) for one tab. */
function svTabHtml(t: any, owner: any, mine: boolean): string {
  // Sender-filled fields (phase 5): values live on the envelope, not a signer.
  if (t.recipientId === '__sender__') {
    const sval = ((SV && SV.env && (SV.env as any).senderValues) || {})[t.id];
    if (t.type === 'checkbox') return `<span class="sv-box${sval ? ' on' : ''}"></span>`;
    return `<span class="sv-ro">${sigEsc(sval == null ? '' : String(sval))}</span>`;
  }
  const val = (owner.tabValues || {})[t.id];
  const signed = owner.status === 'signed';
  if (t.type === 'signature' || t.type === 'initials') {
    if (mine) {
      const a = sigAdopted();
      if (a && a.dataUrl) return `<img class="sv-sig-img" src="${a.dataUrl}" alt="signature" onclick="sigClickSign()">`;
      return `<button type="button" class="sv-sign-box" onclick="sigClickSign()">${t.type === 'initials' ? 'Initial' : 'Sign'}</button>`;
    }
    if (signed && owner.signatureData) return `<img class="sv-sig-img" src="${sigEsc(owner.signatureData)}" alt="">`;
    return `<span class="sv-ph">${sigEsc(owner.name || '')}</span>`;
  }
  if (t.type === 'dateSigned') return `<span class="sv-ro">${mine ? sigToday() : (signed ? sigDateOf(owner.signedAt) : '')}</span>`;
  if (t.type === 'name') {
    if (mine) { const a = sigAdopted(); return `<span class="sv-ro">${sigEsc(a && a.typedName ? a.typedName : '')}</span>`; }
    return `<span class="sv-ro">${sigEsc(signed ? (owner.typedName || owner.name || '') : '')}</span>`;
  }
  if (t.type === 'checkbox') {
    if (mine) return `<input type="checkbox" data-svfk="${sigEsc(t.id)}" onchange="svUpdateProgress()">`;
    return `<span class="sv-box${val ? ' on' : ''}"></span>`;
  }
  if (t.type === 'dropdown') {
    if (mine) return `<select data-svfk="${sigEsc(t.id)}" onchange="svUpdateProgress()"><option value=""></option>${(t.options || []).map((o: string) => `<option>${sigEsc(o)}</option>`).join('')}</select>`;
    return `<span class="sv-ro">${sigEsc(val == null ? '' : String(val))}</span>`;
  }
  if (t.type === 'radioGroup') {
    if (mine) return `<span class="sv-radio" data-svfk="${sigEsc(t.id)}">${(t.options || []).map((o: string) =>
      `<label><input type="radio" name="svr_${sigEsc(t.id)}" value="${sigEsc(o)}" onchange="svUpdateProgress()"> ${sigEsc(o)}</label>`).join('')}</span>`;
    return `<span class="sv-ro">${sigEsc(val == null ? '' : String(val))}</span>`;
  }
  // text
  if (mine) return `<input type="text" data-svfk="${sigEsc(t.id)}" placeholder="${sigEsc(t.label || '')}" oninput="svUpdateProgress()">`;
  return `<span class="sv-ro">${sigEsc(val == null ? '' : String(val))}</span>`;
}

/* Repaint only MY tabs after a signature is adopted — typed values survive. */
function svRepaintMine(): void {
  const host = SV; if (!host) return;
  const keep = svCollect();
  const els = host.container.querySelectorAll('.sv-tab.mine');
  const byId: { [k: string]: any } = {};
  for (const r of (host.env.recipients || [])) byId[r.id] = r;
  for (let i = 0; i < els.length; i++) {
    const el = els[i] as HTMLElement;
    const t = (host.env.tabs || []).find((x: any) => x.id === el.getAttribute('data-svtab'));
    if (t) el.innerHTML = svTabHtml(t, byId[t.recipientId] || {}, true);
  }
  svRestore(keep);
  svUpdateProgress();
}

function svCollect(): Record<string, any> {
  const out: Record<string, any> = {};
  const els = document.querySelectorAll('[data-svfk]');
  for (let i = 0; i < els.length; i++) {
    const el = els[i] as HTMLElement;
    const k = el.getAttribute('data-svfk')!;
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'checkbox') out[k] = (el as HTMLInputElement).checked;
    else if (el.tagName === 'INPUT' || el.tagName === 'SELECT') out[k] = (el as HTMLInputElement).value;
    else { const r = el.querySelector('input:checked') as HTMLInputElement | null; out[k] = r ? r.value : ''; }
  }
  return out;
}
function svRestore(vals: Record<string, any>): void {
  const els = document.querySelectorAll('[data-svfk]');
  for (let i = 0; i < els.length; i++) {
    const el = els[i] as HTMLElement;
    const k = el.getAttribute('data-svfk')!;
    if (!(k in vals)) continue;
    if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'checkbox') (el as HTMLInputElement).checked = !!vals[k];
    else if (el.tagName === 'INPUT' || el.tagName === 'SELECT') (el as HTMLInputElement).value = String(vals[k] || '');
    else { const r = el.querySelector(`input[value="${CSS.escape(String(vals[k]))}"]`) as HTMLInputElement | null; if (r) r.checked = true; }
  }
}

/* Which of my required tabs are still empty? Signature adoption counts for all
   signature/initials tabs at once (adopt once, apply everywhere). */
function svMissing(): any[] {
  const host = SV!; const vals = svCollect(); const a = sigAdopted();
  return (host.env.tabs || []).filter((t: any) => {
    if (t.recipientId !== host.meId || t.required === false) return false;
    if (t.type === 'signature' || t.type === 'initials') return !(a && a.dataUrl);
    if (t.type === 'dateSigned' || t.type === 'name') return false; // auto
    const v = vals[t.id];
    if (t.type === 'checkbox') return v !== true;
    return v == null || String(v) === '';
  });
}

function svUpdateProgress(): void {
  const host = SV; if (!host) return;
  const missing = svMissing();
  const mine = (host.env.tabs || []).filter((t: any) => t.recipientId === host.meId && t.required !== false).length;
  const p = document.getElementById('sv-progress');
  if (p) p.textContent = mine ? (mine - missing.length) + ' of ' + mine + ' required fields complete' : '';
  const f = document.getElementById('sv-finish') as HTMLButtonElement | null;
  if (f) f.disabled = missing.length > 0;
  const n = document.getElementById('sv-next') as HTMLButtonElement | null;
  if (n) n.style.display = missing.length ? '' : 'none';
}

/* NEXT: scroll to the first incomplete required tab and pulse it. */
function svNext(): void {
  const missing = svMissing();
  if (!missing.length) return;
  const el = document.querySelector(`[data-svtab="${missing[0].id}"]`) as HTMLElement | null;
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
}

async function svFinish(): Promise<void> {
  const host = SV; if (!host) return;
  const missing = svMissing();
  if (missing.length) { svNext(); return; }
  const a = sigAdopted();
  const btn = document.getElementById('sv-finish') as HTMLButtonElement | null;
  if (btn) { btn.disabled = true; btn.textContent = 'Signing…'; }
  try {
    const res = await host.submit({
      signatureData: a ? a.dataUrl : '',
      typedName: a ? a.typedName : '',
      tabValues: svCollect(),
    });
    host.onDone(res);
  } catch (e: any) {
    if (btn) { btn.disabled = false; btn.textContent = 'Finish'; }
    alert('Signing failed: ' + (e && e.message ? e.message : String(e)));
  }
}
