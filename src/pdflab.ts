/* =====================================================================
   pdflab.ts — THROWAWAY spike UI for the Agreements / e-sign feasibility test.
   Calls the standalone /b/pdfLab endpoint (native HTML→PDF + SHA-256). Reached
   at #/pdflab, launched from the super-only Tools menu. Delete once the real
   Agreements build starts.
   ===================================================================== */

const PDFLAB_BASE = '/b/pdfLab';
let PDFLAB_SIG_DRAWN = false;

function viewPdfLab(): string {
  const head = pageHead('PDF Lab',
    'Feasibility spike for Agreements e-sign — native HTML→PDF conversion + SHA-256 tamper-evidence hash, all on BlueStep. Throwaway test surface.');
  return shell('', head + `
    <div class="card pl-card">
      <div class="pl-grid">
        <div class="pl-left">
          <label class="pl-label">Agreement HTML
            <span class="muted">— edit freely; <code>{{SIGNATURE}}</code> is replaced with your drawing</span></label>
          <textarea id="pdflab-html" class="pl-html" spellcheck="false" placeholder="Loading sample template…"></textarea>
        </div>
        <div class="pl-right">
          <label class="pl-label">Signature <span class="muted">— draw with mouse / finger</span></label>
          <canvas id="pdflab-sig" class="pl-sig" width="360" height="140"></canvas>
          <div class="pl-sig-actions">
            <button class="btn outline sm" onclick="pdfLabClearSig()">${ic('trash', 14)} Clear</button>
          </div>
          <button class="btn primary pl-go" onclick="pdfLabGenerate()">${ic('check', 15)} Generate PDF</button>
          <div id="pdflab-status" class="pl-status"></div>
          <div id="pdflab-result" class="pl-result" hidden></div>
        </div>
      </div>
    </div>`);
}

// Called from main.ts render() after the view is inserted (canvas needs a live DOM).
function pdfLabInit(): void {
  const ta = document.getElementById('pdflab-html') as HTMLTextAreaElement | null;
  if (ta && !ta.value) {
    fetch(PDFLAB_BASE + '?action=sample', { credentials: 'include' })
      .then(r => r.json())
      .then(j => { if (j && j.ok && j.data && j.data.html && ta && !ta.value) ta.value = j.data.html; })
      .catch(() => { /* endpoint falls back to its own sample if we send blank */ });
  }
  pdfLabSetupCanvas();
}

function pdfLabSetupCanvas(): void {
  const cv = document.getElementById('pdflab-sig') as HTMLCanvasElement | null;
  if (!cv) return;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#12325a';
  let drawing = false, lx = 0, ly = 0;
  const pos = (e: any) => {
    const r = cv.getBoundingClientRect();
    const t = (e.touches && e.touches[0]) || e;
    return { x: (t.clientX - r.left) * (cv.width / r.width), y: (t.clientY - r.top) * (cv.height / r.height) };
  };
  const start = (e: any) => { drawing = true; const p = pos(e); lx = p.x; ly = p.y; e.preventDefault(); };
  const move = (e: any) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(p.x, p.y); ctx.stroke();
    lx = p.x; ly = p.y; PDFLAB_SIG_DRAWN = true; e.preventDefault();
  };
  const end = () => { drawing = false; };
  cv.onmousedown = start; cv.onmousemove = move; window.onmouseup = end;
  cv.ontouchstart = start; cv.ontouchmove = move; cv.ontouchend = end;
}

function pdfLabClearSig(): void {
  const cv = document.getElementById('pdflab-sig') as HTMLCanvasElement | null;
  if (!cv) return;
  const ctx = cv.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
  PDFLAB_SIG_DRAWN = false;
}

async function pdfLabGenerate(): Promise<void> {
  const ta = document.getElementById('pdflab-html') as HTMLTextAreaElement | null;
  const cv = document.getElementById('pdflab-sig') as HTMLCanvasElement | null;
  const status = document.getElementById('pdflab-status');
  const result = document.getElementById('pdflab-result') as HTMLElement | null;

  let html = ta ? ta.value : '';
  // Inject the drawn signature (data-URI PNG) into the {{SIGNATURE}} token.
  const sigTag = (cv && PDFLAB_SIG_DRAWN) ? '<img src="' + cv.toDataURL('image/png') + '" style="max-height:58px" />' : '';
  if (html) html = html.split('{{SIGNATURE}}').join(sigTag);

  if (status) status.textContent = 'Generating…';
  if (result) result.hidden = true;
  try {
    const r = await fetch(PDFLAB_BASE, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate', html: html }),
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Generation failed');
    const d = j.data;
    if (status) status.textContent = '';
    if (result) {
      result.hidden = false;
      const abs = d.fileUrl ? (location.origin + d.fileUrl) : '';
      const kb = d.bytes ? (d.bytes / 1024).toFixed(1) + ' KB' : '';
      result.innerHTML =
        `<div class="pl-ok">${ic('check', 15)} PDF generated${kb ? ' — ' + kb : ''}${d.ms != null ? ' in ' + d.ms + ' ms' : ''}</div>
         <div class="pl-hash"><b>SHA-256</b><code>${esc(d.hashHex || '')}</code></div>` +
        (abs
          ? `<button class="btn primary" onclick="window.open('${esc(abs)}','_blank')">${ic('chevR', 15)} Open PDF</button>`
          : `<div class="muted">No file URL returned.</div>`);
    }
  } catch (e: any) {
    if (status) status.textContent = '';
    if (result) {
      result.hidden = false;
      result.innerHTML = `<div class="pl-err">${ic('alert', 15)} ${esc(e && e.message ? e.message : String(e))}</div>`;
    }
  }
}
