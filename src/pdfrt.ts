/* =====================================================================
   pdfrt.ts — runtime loaders for the vendored PDF libraries.

   The app bundle is concatenated global-scope scripts, but the vendored libraries
   deliberately stay OUT of it (4MB of third-party code nobody pays for until they
   open a PDF surface). They are shipped as separate hashed assets and loaded on
   first use:

     pdf.js   — ES-module-only since v6, so it is loaded with a runtime dynamic
                import(). esbuild would try to rewrite `import(` while minifying a
                classic script, so the call is constructed via new Function — same
                trick as any bundler-hostile dynamic import.
     pdf-lib / interact.js — classic UMD scripts, injected as <script> tags; they
                land on window.PDFLib / window.interact.

   VENDOR (the hashed-filename manifest) is generated into the bundle prelude by
   scripts/build.mjs. Every loader is idempotent and caches its promise, so any
   number of callers can await it without double-loading.

   Both bundles include this file: the designer needs all three libraries, the
   public signing page needs pdf.js (and pdf-lib if stamping ends up browser-side).
   ===================================================================== */

declare const VENDOR: { [file: string]: string };

let PDFJS_P: Promise<any> | null = null;
let SCRIPT_P: { [src: string]: Promise<void> } = {};

/* pdf.js, initialised with its module worker. Returns the pdfjsLib namespace. */
function loadPdfJs(): Promise<any> {
  if (PDFJS_P) return PDFJS_P;
  const dynImport = new Function('u', 'return import(u)') as (u: string) => Promise<any>;
  PDFJS_P = dynImport('./' + VENDOR['pdf.min.mjs']).then((lib: any) => {
    lib.GlobalWorkerOptions.workerSrc = './' + VENDOR['pdf.worker.min.mjs'];
    return lib;
  });
  return PDFJS_P;
}

function loadClassicScript(file: string): Promise<void> {
  const src = './' + VENDOR[file];
  const existing = SCRIPT_P[src];
  if (existing) return existing;
  SCRIPT_P[src] = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => { delete SCRIPT_P[src]; reject(new Error('failed to load ' + file)); };
    document.head.appendChild(el);
  });
  return SCRIPT_P[src];
}

function loadPdfLib(): Promise<any> {
  return loadClassicScript('pdf-lib.min.js').then(() => (window as any).PDFLib);
}

function loadInteract(): Promise<any> {
  return loadClassicScript('interact.min.js').then(() => (window as any).interact);
}

/* Render one page of a PDF into a canvas at a given CSS-pixel width.
   Shared by thumbnails, the designer and the signing view — one code path for
   "PDF url → pixels" so scale math can never disagree between surfaces. */
async function pdfRenderPage(pdf: any, pageNum: number, canvas: HTMLCanvasElement, cssWidth: number): Promise<{ wPt: number; hPt: number }> {
  const page = await pdf.getPage(pageNum);
  const base = page.getViewport({ scale: 1 }); // PDF points
  const scale = cssWidth / base.width;
  const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const vp = page.getViewport({ scale: scale * ratio });
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  canvas.style.width = cssWidth + 'px';
  canvas.style.height = Math.round(cssWidth * (base.height / base.width)) + 'px';
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  await page.render({ canvas: canvas, canvasContext: ctx, viewport: vp }).promise;
  return { wPt: base.width, hPt: base.height };
}

/* Open a document by URL. Same-origin — the platform session cookie rides along. */
async function pdfOpen(url: string): Promise<any> {
  const lib = await loadPdfJs();
  return lib.getDocument({ url: url, withCredentials: true }).promise;
}
