/* =====================================================================
   pdfspike.ts — TEMPORARY phase-0 spike surface. Route: #/pdfspike/<download-path>

   Proves, on the live GitSite host with a real session:
     A1  pdf.js loads via runtime dynamic import from a hashed asset
     A2  its module worker boots
     A3  a same-origin /download/... PDF opens with the session cookie
     A4  a page renders to canvas at devicePixelRatio
     A5  pdf-lib loads and can re-save that same PDF with a drawn box
     A6  interact.js loads and drags a test div

   Removed when phase 0 closes. Deliberately writes results into the page AND
   console so a human and an automated check read the same truth.
   ===================================================================== */

function viewPdfSpike(dlPath: string): string {
  setTimeout(() => runPdfSpike(dlPath), 0);
  return shell('', `<div class="page-head"><div><h1>PDF spike</h1><p>Phase-0 checks. Pass a /download path in the hash to test a real document.</p></div></div>
    <div class="card" style="padding:16px"><pre id="spike-log" style="margin:0;font-size:12px;white-space:pre-wrap">running…</pre></div>
    <div class="card" style="padding:16px;margin-top:12px">
      <div id="spike-drag" style="width:90px;height:44px;background:var(--primary);color:#fff;display:grid;place-items:center;border-radius:6px;touch-action:none">drag me</div>
    </div>
    <div class="card" style="padding:16px;margin-top:12px;overflow:auto"><canvas id="spike-canvas"></canvas></div>`);
}

async function runPdfSpike(dlPath: string): Promise<void> {
  const log = (m: string) => {
    const el = document.getElementById('spike-log');
    if (el) el.textContent = (el.textContent === 'running…' ? '' : el.textContent + '\n') + m;
    console.log('[spike]', m);
  };
  try {
    const t0 = performance.now();
    const lib = await loadPdfJs();
    log('A1 PASS pdf.js loaded (' + Math.round(performance.now() - t0) + 'ms), version ' + lib.version);

    const url = dlPath || '';
    if (!url) { log('A3 SKIP — no /download path given (add one to the hash)'); }
    else {
      const t1 = performance.now();
      const pdf = await pdfOpen(url);
      log('A2/A3 PASS document opened, ' + pdf.numPages + ' page(s) (' + Math.round(performance.now() - t1) + 'ms)');
      const canvas = document.getElementById('spike-canvas') as HTMLCanvasElement | null;
      if (canvas) {
        const t2 = performance.now();
        const dims = await pdfRenderPage(pdf, 1, canvas, 612);
        log('A4 PASS page 1 rendered at 612px css — page is ' + dims.wPt + 'x' + dims.hPt + 'pt (' + Math.round(performance.now() - t2) + 'ms)');
      }
      // A5 — pdf-lib round trip on the same bytes
      const t3 = performance.now();
      const PDFLib = await loadPdfLib();
      const bytes = await (await fetch(url, { credentials: 'same-origin' })).arrayBuffer();
      const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      const page = doc.getPage(0);
      page.drawRectangle({ x: 40, y: 40, width: 120, height: 40, borderColor: PDFLib.rgb(0.9, 0.2, 0.2), borderWidth: 2 });
      page.drawText('pdf-lib spike ' + new Date().toISOString().slice(0, 10), { x: 46, y: 55, size: 10 });
      const out = await doc.save();
      log('A5 PASS pdf-lib loaded, drew on page 1, re-saved ' + out.byteLength + ' bytes (' + Math.round(performance.now() - t3) + 'ms)');
    }

    log('A6 SKIP — interact.js retired (broken minified build); designer uses its own pointer-event engine');
    log('DONE');
  } catch (e: any) {
    log('FAIL ' + (e && e.message ? e.message : String(e)));
    console.error(e);
  }
}
