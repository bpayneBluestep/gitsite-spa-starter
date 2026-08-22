/* =====================================================================
   signing.ts — the shared agreement-signing renderer.

   ONE token renderer and ONE signature pad, used by both signing surfaces:

     • the consultant's in-app countersign view  (agreements.ts, authenticated)
     • the parent's public signing page          (public/signpage.ts, anonymous)

   They render the SAME frozen contentSnapshot with the SAME token grammar, so
   they must not drift — a consultant who reads the document in the CRM and a
   parent who reads it on the public page have to be looking at the same words.
   Before this module those were two hand-maintained copies (the maestro's
   renderSignedAgreementHtml and the satellite page's renderBody), and the
   consultant surface had no renderer at all — just a bare pad.

   Deliberately self-contained: no esc()/ic()/toast() from the CRM bundle, no
   API calls, no DOM ownership beyond the canvas it is handed. That is what lets
   the public bundle include this file without dragging in the consultant app.

   Token grammar (must stay in step with the maestro's renderSignedAgreementHtml
   and the ingester's verbatim copy of it):
     {{merge:key}}          -> the merge value, escaped
     {{sig:roleId}}         -> your slot, or another signer's name/state
     {{date:roleId}}        -> today for you, a placeholder for others
     {{initials:roleId}}    -> an input for you, a placeholder for others
     {{text:roleId:Label}}  -> an input for you, a placeholder for others
   ===================================================================== */

interface SigSigner { role: string; name: string; status: string; }
interface SigField { kind: 'initials' | 'text'; key: string; label: string; }
interface SigContext {
  contentHtml: string;
  merge: { [k: string]: string };
  signers: SigSigner[];
  /** Role id of the person viewing. '' renders the document read-only. */
  myRole: string;
}
interface SigBody { html: string; fields: SigField[]; }

function sigEsc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sigToday(): string {
  const d = new Date();
  return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
}

/* Render the frozen document body, substituting merge values and marking up each
   signer token. Returns the HTML plus the list of input fields the viewer owes us
   (empty when the template addresses no initials/text tokens to their role).

   Pure: no globals read or written, so both callers can hold their own state. */
function sigRenderBody(ctx: SigContext): SigBody {
  const merge = ctx.merge || {};
  const myRole = ctx.myRole || '';
  const byRole: { [role: string]: SigSigner } = {};
  for (const s of (ctx.signers || [])) byRole[s.role] = s;
  const fields: SigField[] = [];

  const html = String(ctx.contentHtml || '').replace(
    /\{\{\s*([a-zA-Z]+)\s*:\s*([^}]*?)\s*\}\}/g,
    function (_m: string, rawType: string, arg: string): string {
      const type = String(rawType).toLowerCase();
      const parts = String(arg).split(':');
      const roleId = (parts[0] || '').trim();
      // {{merge:…}} keys can themselves contain a colon, so match on the whole arg.
      if (type === 'merge') return sigEsc(merge[arg] || '');

      const mine = !!myRole && roleId === myRole;
      const other = byRole[roleId];

      if (type === 'sig') {
        if (mine) return '<span class="sg-tok sg-tok-you">&#9998; Your signature</span>';
        if (other && other.status === 'signed') return '<span class="sg-tok sg-tok-done">&#10003; signed</span>';
        return '<span class="sg-tok">' + sigEsc(other ? (other.name || 'signer') : 'signer') + '</span>';
      }
      if (type === 'date') {
        return mine ? sigEsc(sigToday()) : '<span class="sg-tok">date</span>';
      }
      if (type === 'initials') {
        if (mine) { fields.push({ kind: 'initials', key: 'initials', label: 'Initials' }); return '<span class="sg-tok sg-tok-you">[your initials]</span>'; }
        return '<span class="sg-tok">initials</span>';
      }
      if (type === 'text') {
        const label = (parts[1] || 'Field').trim();
        if (mine) { fields.push({ kind: 'text', key: label, label: label }); return '<span class="sg-tok sg-tok-you">[' + sigEsc(label) + ']</span>'; }
        return '<span class="sg-tok">' + sigEsc(label) + '</span>';
      }
      return '';
    }
  );

  return { html: html, fields: fields };
}

/* The inputs for whatever sigRenderBody reported as this viewer's fields. */
function sigFieldsHtml(fields: SigField[]): string {
  if (!fields.length) return '';
  return '<div class="sg-fields"><h3>Your fields</h3>' + fields.map(function (f) {
    const attrs = f.kind === 'initials' ? 'maxlength="6" placeholder="e.g. JC"' : 'placeholder=""';
    return '<div class="sg-field"><label>' + sigEsc(f.label) + '</label>'
      + '<input data-fk="' + sigEsc(f.key) + '" ' + attrs + '></div>';
  }).join('') + '</div>';
}

/* Read those inputs back. Scoped to a root so a modal can't pick up stray
   [data-fk] inputs elsewhere on the page. */
function sigCollectFields(root: ParentNode | null): { [k: string]: string } {
  const out: { [k: string]: string } = {};
  const scope: ParentNode = root || document;
  const inputs = scope.querySelectorAll('[data-fk]');
  for (let i = 0; i < inputs.length; i++) {
    const el = inputs[i] as HTMLInputElement;
    const k = el.getAttribute('data-fk');
    if (k) out[k] = el.value;
  }
  return out;
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
