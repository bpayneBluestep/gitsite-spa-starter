/* =====================================================================
   signing.ts — the shared agreement-signing renderer.

   ONE token renderer, ONE signature modal, used by both signing surfaces:

     • the consultant's in-app countersign view  (agreements.ts, authenticated)
     • the parent's public signing page          (public/signpage.ts, anonymous)

   They render the SAME frozen contentSnapshot with the SAME token grammar, so
   they must not drift — a consultant who reads the document in the CRM and a
   parent who reads it on the public page have to be looking at the same words.

   Deliberately self-contained: no esc()/ic()/toast() from the CRM bundle, no
   API calls, no DOM ownership beyond the modal it creates. That is what lets
   the public bundle include this file without dragging in the consultant app.

   Token grammar (must stay in step with renderSignedAgreementHtml, which is
   duplicated byte-for-byte in Master Maestro and AgreementSign):
     {{merge:key}}          -> the merge value, escaped
     {{sig:roleId}}         -> click-to-sign box for you; the actual signature
                               image for anyone who has already signed
     {{date:roleId}}        -> today for you, their signed date for others
     {{name:roleId}}        -> the name that role TYPED when adopting a signature
     {{initials:roleId}}    -> an inline input for you, their value for others
     {{field:fieldId}}      -> an author-defined fillable field, inline
     {{text:roleId:Label}}  -> legacy v1 free-text, still rendered

   Fillable fields and signatures render INLINE, where the author placed them.
   There is no separate "your fields" panel: on a document you are about to be
   legally bound by, the thing you fill in belongs next to the sentence it
   modifies, not in a form underneath.

   Everything a prior signer entered renders read-only. Signing second used to
   look like signing a blank page.
   ===================================================================== */

interface SigSigner {
  role: string;
  roleLabel?: string;
  name: string;
  status: string;
  signedAt?: string;
  typedName?: string;
  signatureData?: string;
  fieldValues?: { [k: string]: any };
}

/** An author-defined fillable field, from the template's bodyJson.fields[]. */
interface SigFieldDef {
  id: string;
  roleId: string;
  type: 'text' | 'checkbox' | 'select' | 'multiselect';
  label: string;
  options?: string[];
  required?: boolean;
}

/** What the viewer still owes us, for validation before submit. */
interface SigField { kind: 'initials' | 'text' | 'field'; key: string; label: string; required: boolean; }

interface SigContext {
  contentHtml: string;
  merge: { [k: string]: string };
  signers: SigSigner[];
  /** The template's field registry. Absent on v1 templates. */
  fieldDefs?: SigFieldDef[];
  /** Role id of the person viewing. '' renders the document read-only. */
  myRole: string;
}
interface SigBody { html: string; fields: SigField[] }

function sigEsc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sigToday(): string {
  const d = new Date();
  return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
}

function sigDateOf(iso?: string): string {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? (parseInt(m[2], 10) + '/' + parseInt(m[3], 10) + '/' + m[1]) : '';
}

/* ── the adopted signature ────────────────────────────────────────────────────
   One per page load. Held here rather than in either surface so the modal, the
   inline placeholders and the submit handler all agree without the two callers
   each inventing their own state. */
interface SigAdopted { dataUrl: string; typedName: string }
let SIG_ADOPTED: SigAdopted | null = null;
let SIG_ON_CHANGE: (() => void) | null = null;

function sigAdopted(): SigAdopted | null { return SIG_ADOPTED; }
function sigResetAdopted(): void { SIG_ADOPTED = null; }
/** The host passes a re-render callback so adopting a signature updates the document. */
function sigOnChange(fn: (() => void) | null): void { SIG_ON_CHANGE = fn; }

/* ── rendering ──────────────────────────────────────────────────────────────── */

// A choice field's value, rendered read-only: the whole option list with the
// selection marked. "Plan B" alone would lose the fact that A and C were declined,
// which on a signed agreement is most of the meaning.
function sigChoiceReadonly(def: SigFieldDef, raw: any): string {
  const chosen: { [k: string]: boolean } = {};
  if (Object.prototype.toString.call(raw) === '[object Array]') { (raw as any[]).forEach(v => { chosen[String(v)] = true; }); }
  else if (raw != null && String(raw) !== '') { chosen[String(raw)] = true; }
  return (def.options || []).map(o =>
    '<span class="sg-opt-ro">' + (chosen[String(o)] ? '&#9632;' : '&#9633;') + ' ' + sigEsc(o) + '</span>'
  ).join(' ');
}

// The live control for a field addressed to the viewer.
function sigChoiceControl(def: SigFieldDef): string {
  const opts = def.options || [];
  if (def.type === 'select') {
    return '<span class="sg-choice" data-fk="' + sigEsc(def.id) + '" data-ftype="select">'
      + opts.map((o, i) =>
        '<label class="sg-opt"><input type="radio" name="sgf_' + sigEsc(def.id) + '" value="' + sigEsc(o) + '"'
        + (i === 0 ? '' : '') + '> ' + sigEsc(o) + '</label>').join('')
      + '</span>';
  }
  // checkbox and multiselect are the same control; the distinction is authorial
  // intent, and a checkbox group with one option is a perfectly good yes/no.
  return '<span class="sg-choice" data-fk="' + sigEsc(def.id) + '" data-ftype="multi">'
    + opts.map(o =>
      '<label class="sg-opt"><input type="checkbox" value="' + sigEsc(o) + '"> ' + sigEsc(o) + '</label>').join('')
    + '</span>';
}

/* Render the frozen document body, substituting merge values and marking up each
   signer token. Returns the HTML plus the list of inputs the viewer owes us.

   Pure apart from reading SIG_ADOPTED, so both callers can hold their own state. */
function sigRenderBody(ctx: SigContext): SigBody {
  const merge = ctx.merge || {};
  const myRole = ctx.myRole || '';
  const byRole: { [role: string]: SigSigner } = {};
  for (const s of (ctx.signers || [])) byRole[s.role] = s;
  const defs: { [id: string]: SigFieldDef } = {};
  for (const f of (ctx.fieldDefs || [])) if (f && f.id) defs[String(f.id)] = f;
  const fields: SigField[] = [];

  const html = String(ctx.contentHtml || '').replace(
    /\{\{\s*([a-zA-Z]+)\s*:\s*([^}]*?)\s*\}\}/g,
    function (_m: string, rawType: string, arg: string): string {
      const type = String(rawType).toLowerCase();
      const parts = String(arg).split(':');
      const roleId = (parts[0] || '').trim();
      // {{merge:…}} keys can themselves contain a colon, so match on the whole arg.
      if (type === 'merge') return sigEsc(merge[arg] || '');

      if (type === 'field') {
        const def = defs[String(arg).trim()];
        if (!def) return '';
        const owner = byRole[def.roleId];
        const isMine = !!myRole && def.roleId === myRole;
        if (isMine) {
          if (def.type === 'text') {
            fields.push({ kind: 'field', key: def.id, label: def.label, required: def.required !== false });
            return '<input class="sg-inp" data-fk="' + sigEsc(def.id) + '" data-ftype="text" placeholder="'
              + sigEsc(def.label) + '">';
          }
          fields.push({ kind: 'field', key: def.id, label: def.label, required: def.required !== false });
          return sigChoiceControl(def);
        }
        const raw = owner && owner.fieldValues ? owner.fieldValues[def.id] : undefined;
        if (owner && owner.status === 'signed') {
          if (def.type === 'text') return '<span class="sg-ro">' + sigEsc(raw == null ? '' : String(raw)) + '</span>';
          return sigChoiceReadonly(def, raw);
        }
        if (def.type === 'text') return '<span class="sg-tok">' + sigEsc(def.label) + '</span>';
        return sigChoiceReadonly(def, undefined);
      }

      const mine = !!myRole && roleId === myRole;
      const other = byRole[roleId];
      const signed = !!other && other.status === 'signed';

      if (type === 'sig') {
        if (mine) {
          const a = SIG_ADOPTED;
          if (a && a.dataUrl) {
            return '<span class="sg-sig-wrap"><img class="sg-sig-img" src="' + a.dataUrl + '" alt="your signature">'
              + '<button type="button" class="sg-sig-redo" onclick="sigClickSign()">change</button></span>';
          }
          return '<button type="button" class="sg-sig-box" onclick="sigClickSign()">&#9998; Your signature</button>';
        }
        // A signer who has already signed shows their ACTUAL signature, not a tick.
        if (signed && other!.signatureData) {
          return '<img class="sg-sig-img sg-sig-other" src="' + sigEsc(other!.signatureData) + '" alt="'
            + sigEsc(other!.typedName || other!.name || 'signature') + '">';
        }
        if (signed) return '<span class="sg-tok sg-tok-done">&#10003; signed</span>';
        return '<span class="sg-tok">' + sigEsc(other ? (other.name || 'signer') : 'signer') + '</span>';
      }

      if (type === 'date') {
        if (mine) return '<span class="sg-ro">' + sigEsc(sigToday()) + '</span>';
        if (signed) return '<span class="sg-ro">' + sigEsc(sigDateOf(other!.signedAt)) + '</span>';
        return '<span class="sg-tok">date</span>';
      }

      if (type === 'name') {
        if (mine) {
          const a = SIG_ADOPTED;
          return a && a.typedName
            ? '<span class="sg-ro">' + sigEsc(a.typedName) + '</span>'
            : '<span class="sg-tok">your name</span>';
        }
        if (signed) return '<span class="sg-ro">' + sigEsc(other!.typedName || other!.name || '') + '</span>';
        return '<span class="sg-tok">' + sigEsc(other ? (other.name || 'name') : 'name') + '</span>';
      }

      if (type === 'initials') {
        if (mine) {
          fields.push({ kind: 'initials', key: 'initials', label: 'Initials', required: true });
          return '<input class="sg-inp sg-inp-sm" data-fk="initials" data-ftype="text" maxlength="6" placeholder="AB">';
        }
        if (signed) {
          const v = other!.fieldValues ? other!.fieldValues['initials'] : '';
          return '<span class="sg-ro">' + sigEsc(v == null ? '' : String(v)) + '</span>';
        }
        return '<span class="sg-tok">initials</span>';
      }

      if (type === 'text') {
        const label = (parts[1] || 'Field').trim();
        if (mine) {
          fields.push({ kind: 'text', key: label, label: label, required: true });
          return '<input class="sg-inp" data-fk="' + sigEsc(label) + '" data-ftype="text" placeholder="' + sigEsc(label) + '">';
        }
        if (signed) {
          const v = other!.fieldValues ? other!.fieldValues[label] : '';
          return '<span class="sg-ro">' + sigEsc(v == null ? '' : String(v)) + '</span>';
        }
        return '<span class="sg-tok">' + sigEsc(label) + '</span>';
      }
      return '';
    }
  );

  return { html: html, fields: fields };
}

/* Read the inline inputs back. Scoped to a root so a modal can't pick up stray
   [data-fk] inputs elsewhere on the page. Text fields yield a string; choice
   fields yield an array of the selected option labels. */
function sigCollectFields(root: ParentNode | null): { [k: string]: any } {
  const out: { [k: string]: any } = {};
  const scope: ParentNode = root || document;
  const nodes = scope.querySelectorAll('[data-fk]');
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i] as HTMLElement;
    const k = el.getAttribute('data-fk');
    if (!k) continue;
    const ftype = el.getAttribute('data-ftype') || 'text';
    if (ftype === 'text') { out[k] = (el as HTMLInputElement).value; continue; }
    const picked: string[] = [];
    const ins = el.querySelectorAll('input');
    for (let j = 0; j < ins.length; j++) {
      const inp = ins[j] as HTMLInputElement;
      if (inp.checked) picked.push(inp.value);
    }
    out[k] = picked;
  }
  return out;
}

/* Which required fields are still empty. Returns [] when everything is answered.
   Optional fields (required === false in the builder) are skipped. */
function sigMissingRequired(root: ParentNode | null, fields: SigField[]): string[] {
  const vals = sigCollectFields(root);
  const missing: string[] = [];
  for (const f of fields) {
    if (!f.required) continue;
    const v = vals[f.key];
    const empty = v == null
      || (typeof v === 'string' && !v.trim())
      || (Object.prototype.toString.call(v) === '[object Array]' && !(v as any[]).length);
    if (empty) missing.push(f.label);
  }
  return missing;
}

/* ── the signature modal ──────────────────────────────────────────────────────
   Type is the default because that is what almost everyone actually wants; a
   drawn signature on a trackpad looks like a seismograph. Draw stays a tab for
   the people who care.

   Both paths produce a PNG data URL, so nothing downstream — the read-only
   render, either PDF renderer, the certificate — needs to know which was used,
   and no font has to survive the B.io.pdf path. */

const SIG_FONTS: { label: string; css: string }[] = [
  { label: 'Dancing Script', css: "'Dancing Script', cursive" },
  { label: 'Great Vibes', css: "'Great Vibes', cursive" },
  { label: 'Caveat', css: "'Caveat', cursive" },
];

let SIG_MODAL_PAD: SigPad | null = null;
let SIG_MODAL_FONT = 0;

function sigClickSign(): void {
  sigCloseModal();
  const wrap = document.createElement('div');
  wrap.className = 'sg-modal-back';
  wrap.id = '__sgModal';
  wrap.innerHTML =
    '<div class="sg-modal" role="dialog" aria-label="Adopt your signature">'
    + '<div class="sg-modal-h">Adopt your signature</div>'
    + '<div class="sg-tabs">'
    + '<button type="button" class="sg-tab active" data-tab="type" onclick="sigModalTab(\'type\')">Type</button>'
    + '<button type="button" class="sg-tab" data-tab="draw" onclick="sigModalTab(\'draw\')">Draw</button>'
    + '</div>'
    + '<div class="sg-pane" data-pane="type">'
    + '<label class="sg-lbl">Full name</label>'
    + '<input id="__sgName" class="sg-name" placeholder="Your full legal name" oninput="sigModalPreview()">'
    + '<div class="sg-faces" id="__sgFaces"></div>'
    + '</div>'
    + '<div class="sg-pane" data-pane="draw" hidden>'
    + '<canvas id="__sgPad" class="sg-pad" width="560" height="150"></canvas>'
    + '<button type="button" class="sg-clear" onclick="sigModalClear()">Clear</button>'
    + '</div>'
    + '<div class="sg-modal-f">'
    + '<button type="button" class="sg-btn ghost" onclick="sigCloseModal()">Cancel</button>'
    + '<button type="button" class="sg-btn primary" onclick="sigModalAdopt()">Adopt and sign</button>'
    + '</div>'
    + '<div class="sg-err" id="__sgErr" hidden></div>'
    + '</div>';
  document.body.appendChild(wrap);
  wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) sigCloseModal(); });
  sigRenderFaces();
  const n = document.getElementById('__sgName') as HTMLInputElement | null;
  if (n) { n.focus(); }
}

function sigRenderFaces(): void {
  const host = document.getElementById('__sgFaces');
  if (!host) return;
  const name = (document.getElementById('__sgName') as HTMLInputElement | null);
  const val = name && name.value.trim() ? name.value.trim() : 'Your name';
  host.innerHTML = SIG_FONTS.map((f, i) =>
    '<button type="button" class="sg-face' + (i === SIG_MODAL_FONT ? ' active' : '') + '" onclick="sigModalPickFont(' + i + ')">'
    + '<span style="font-family:' + f.css + '">' + sigEsc(val) + '</span></button>').join('');
}

function sigModalPreview(): void { sigRenderFaces(); }
function sigModalPickFont(i: number): void { SIG_MODAL_FONT = i; sigRenderFaces(); }

function sigModalTab(which: string): void {
  const modal = document.getElementById('__sgModal');
  if (!modal) return;
  const tabs = modal.querySelectorAll('.sg-tab');
  for (let i = 0; i < tabs.length; i++) {
    const t = tabs[i] as HTMLElement;
    t.classList.toggle('active', t.getAttribute('data-tab') === which);
  }
  const panes = modal.querySelectorAll('.sg-pane');
  for (let i = 0; i < panes.length; i++) {
    const p = panes[i] as HTMLElement;
    p.hidden = p.getAttribute('data-pane') !== which;
  }
  if (which === 'draw' && !SIG_MODAL_PAD) {
    SIG_MODAL_PAD = sigSetupPad(document.getElementById('__sgPad') as HTMLCanvasElement | null);
  }
}

function sigModalClear(): void { if (SIG_MODAL_PAD) SIG_MODAL_PAD.clear(); }

function sigModalErr(msg: string): void {
  const e = document.getElementById('__sgErr');
  if (!e) return;
  e.textContent = msg;
  (e as HTMLElement).hidden = !msg;
}

function sigCloseModal(): void {
  if (SIG_MODAL_PAD) { SIG_MODAL_PAD.destroy(); SIG_MODAL_PAD = null; }
  const m = document.getElementById('__sgModal');
  if (m && m.parentNode) m.parentNode.removeChild(m);
}

/* Draw the typed name to a canvas in the chosen face and export a PNG.

   document.fonts.load() first, and deliberately awaited: a canvas will happily
   draw in the fallback serif if the webfont has not arrived, producing a
   signature that looks nothing like the one the person picked — and nobody finds
   out until it is already in a countersigned PDF. */
async function sigRasterizeTyped(name: string, cssFont: string): Promise<string> {
  const px = 64;
  const spec = px + "px " + cssFont;
  try { if ((document as any).fonts) { await (document as any).fonts.load(spec, name); } } catch (_e) { /* fall through to whatever is available */ }
  const pad = 16;
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return '';
  measure.font = spec;
  const w = Math.ceil(measure.measureText(name).width) + pad * 2;
  const h = Math.ceil(px * 1.9);
  const ratio = Math.max(2, Math.min(3, window.devicePixelRatio || 1));
  const c = document.createElement('canvas');
  c.width = Math.round(w * ratio);
  c.height = Math.round(h * ratio);
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.scale(ratio, ratio);
  ctx.font = spec;
  ctx.fillStyle = '#12325a';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, pad, h / 2);
  return c.toDataURL('image/png');
}

/* Normalise a signature image before it is ever submitted.

   Two problems this solves, both of which showed up as enormous signatures in the
   signed PDF:

   1. The images were huge. The typed rasteriser draws at 64px scaled by
      devicePixelRatio, and the draw pad is a 560x150 canvas at the same ratio — up to
      1680x450px. The PDF renderer honours neither max-height nor max-width, so it drew
      them at intrinsic size: ten inches wide on a 6.5in page.
   2. The draw pad's canvas is mostly empty. A signature scribbled in the middle of it
      carries a wide transparent margin, so even scaled correctly it floated in space
      instead of sitting on the line.

   So: crop to the actual ink, then scale to fit a fixed box. Every signature leaves
   here at most SIG_OUT_W x SIG_OUT_H, which means the PDF is correct even if every
   piece of CSS is ignored. Rendering at 2x the display size keeps it crisp when the
   PDF is zoomed or printed. */
const SIG_OUT_W = 440;
const SIG_OUT_H = 88;

function sigNormalize(dataUrl: string): Promise<string> {
  return new Promise(function (resolve) {
    if (!dataUrl) { resolve(''); return; }
    const img = new Image();
    img.onerror = function () { resolve(dataUrl); };
    img.onload = function () {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) { resolve(dataUrl); return; }

        const src = document.createElement('canvas');
        src.width = w; src.height = h;
        const sctx = src.getContext('2d');
        if (!sctx) { resolve(dataUrl); return; }
        sctx.drawImage(img, 0, 0);

        // Ink bounds. Alpha > 8 ignores the anti-aliased ghost around a stroke.
        let minX = w, minY = h, maxX = -1, maxY = -1;
        try {
          const d = sctx.getImageData(0, 0, w, h).data;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              if (d[(y * w + x) * 4 + 3] > 8) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }
        } catch (_e) { /* getImageData unavailable — fall through to the full frame */ }
        if (maxX < 0) { minX = 0; minY = 0; maxX = w - 1; maxY = h - 1; }

        const pad = 3;
        minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
        maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
        const cw = maxX - minX + 1;
        const ch = maxY - minY + 1;

        // Fit the box. Clamped so a tiny scribble is not blown up into a blur.
        let scale = Math.min(SIG_OUT_W / cw, SIG_OUT_H / ch);
        if (scale > 2) scale = 2;
        const ow = Math.max(1, Math.round(cw * scale));
        const oh = Math.max(1, Math.round(ch * scale));

        const out = document.createElement('canvas');
        out.width = ow; out.height = oh;
        const octx = out.getContext('2d');
        if (!octx) { resolve(dataUrl); return; }
        octx.drawImage(src, minX, minY, cw, ch, 0, 0, ow, oh);
        resolve(out.toDataURL('image/png'));
      } catch (_e) { resolve(dataUrl); }
    };
    img.src = dataUrl;
  });
}

async function sigModalAdopt(): Promise<void> {
  sigModalErr('');
  const modal = document.getElementById('__sgModal');
  if (!modal) return;
  const typeTab = modal.querySelector('.sg-tab[data-tab="type"]');
  const typing = !!typeTab && typeTab.classList.contains('active');

  if (typing) {
    const el = document.getElementById('__sgName') as HTMLInputElement | null;
    const name = el ? el.value.trim() : '';
    if (!name) { sigModalErr('Type your full name to adopt a signature.'); return; }
    const url = await sigRasterizeTyped(name, SIG_FONTS[SIG_MODAL_FONT].css);
    if (!url) { sigModalErr('Could not create the signature image. Try the Draw tab.'); return; }
    SIG_ADOPTED = { dataUrl: await sigNormalize(url), typedName: name };
  } else {
    if (!SIG_MODAL_PAD || !SIG_MODAL_PAD.isDrawn()) { sigModalErr('Draw your signature first.'); return; }
    // A drawn signature still needs a typed name — {{name:}} and the certificate
    // both print it, and "what did they attest their name was" should not depend
    // on which tab they used.
    const el = document.getElementById('__sgName') as HTMLInputElement | null;
    const name = el && el.value.trim() ? el.value.trim() : '';
    SIG_ADOPTED = { dataUrl: await sigNormalize(SIG_MODAL_PAD.dataUrl()), typedName: name };
  }
  sigCloseModal();
  if (SIG_ON_CHANGE) SIG_ON_CHANGE();
}

interface SigPad {
  isDrawn(): boolean;
  clear(): void;
  /** '' when nothing has been drawn. */
  dataUrl(): string;
  destroy(): void;
}

/* Attach a drawing surface to a canvas. Returns a handle rather than setting a
   module global, so two pads can never fight over one "drawn" flag.

   Uses addEventListener + an explicit destroy() for the document-level pointer-up:
   the previous copies both did `window.onmouseup = end`, which silently replaced
   whatever else owned that handler and was never removed when the modal closed. */
function sigSetupPad(canvas: HTMLCanvasElement | null): SigPad {
  const noop: SigPad = { isDrawn: function () { return false; }, clear: function () { }, dataUrl: function () { return ''; }, destroy: function () { } };
  if (!canvas) return noop;
  const ctx = canvas.getContext('2d');
  if (!ctx) return noop;

  // Match the device pixel ratio so the signature isn't a blurry upscale on
  // retina/phone screens — this is the artifact that ends up in a legal PDF.
  const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  canvas.width = Math.round(cssW * ratio);
  canvas.height = Math.round(cssH * ratio);
  ctx.scale(ratio, ratio);

  ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#12325a';

  let drawing = false, drawn = false, lx = 0, ly = 0;

  const pos = function (e: any): { x: number; y: number } {
    const r = canvas.getBoundingClientRect();
    const t = (e.touches && e.touches[0]) || e;
    return { x: (t.clientX - r.left) * (cssW / r.width), y: (t.clientY - r.top) * (cssH / r.height) };
  };
  const start = function (e: any): void { drawing = true; const p = pos(e); lx = p.x; ly = p.y; e.preventDefault(); };
  const move = function (e: any): void {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(p.x, p.y); ctx.stroke();
    lx = p.x; ly = p.y; drawn = true; e.preventDefault();
  };
  const end = function (): void { drawing = false; };

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);
  document.addEventListener('mouseup', end);

  return {
    isDrawn: function () { return drawn; },
    clear: function () { ctx.clearRect(0, 0, canvas.width, canvas.height); drawn = false; },
    dataUrl: function () { return drawn ? canvas.toDataURL('image/png') : ''; },
    destroy: function () {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
      document.removeEventListener('mouseup', end);
    },
  };
}
