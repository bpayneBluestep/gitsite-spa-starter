// Build the deploy artifact for the ConfigEC CRM GitSite.
//
// The app is a set of global-scope scripts (no ES modules) whose 304 inline
// handlers resolve function names against the global object. So we DO NOT
// bundle as modules and we DO NOT rename identifiers — we transpile each source
// per-file, concatenate them in dependency order into ONE global script, and
// minify whitespace/syntax only. Top-level names are preserved exactly.
//
// Output (committed, served under /spa/):
//   index.html                 — from src/index.html with hashed asset refs
//   assets/app.<hash>.js        — the concatenated, minified script bundle
//   assets/app.<hash>.css       — the concatenated, minified style bundle
//   sign.html                  — the PUBLIC agreement signing page
//   assets/sign.<hash>.js/.css  — its own small, independent bundle
//
// Two entry points, deliberately. The signing page is opened by parents/external
// signers who are NOT logged in, and it must not ship them the consultant CRM:
// the main bundle is ~340KB of JS whose boot path gates on a session and calls
// authenticated endpoints. The public bundle carries only the shared signing
// renderer plus the page itself. They overlap by exactly one file (signing.ts),
// which is what keeps the two signing surfaces from drifting apart.
//
// Type-checking is a separate `tsc --noEmit` step (see package.json build).
import { transform } from 'esbuild'
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'src')
const assets = join(root, 'assets')

// Dependency order — mirrors the original merge report's <script> order.
// main LAST (it boots the router + session load).
const JS_ORDER = [
  'icons', 'theme', 'data', 'api', 'auth', 'components', 'chrome', 'views', 'record',
  'formedit', 'contacts', 'communications', 'tasks', 'referrals', 'files',
  'programoverlay', 'settings', 'email', 'emailcompose', 'applications',
  'appbuilder', 'clientform', 'pdfrt', 'pdfspike', 'signing', 'agreements', 'agreementbuilder', 'chatbot',
  'main',
]
const CSS_ORDER = ['tokens', 'styles', 'signingdoc', 'chatbot', 'appbuilder']

// The public signing page. `signing` must come first — signpage calls into it.
// No 'api'/'auth'/'components': the page talks only to the public runAsSuper
// ingester and must work with no session.
const PUBLIC_JS_ORDER = ['pdfrt', 'signing', 'public/signpage']
const PUBLIC_CSS_ORDER = ['signingdoc', 'public/signpage']

const shortHash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10)

// --- clean previous artifact ---
await rm(assets, { recursive: true, force: true })
await rm(join(root, 'index.html'), { force: true })
await rm(join(root, 'sign.html'), { force: true })
await mkdir(assets, { recursive: true })

// Transpile + concatenate + minify one ordered list of sources into a hashed asset.
// Identifier renaming stays OFF for both bundles — inline HTML handlers resolve
// top-level function names against the global object.
async function bundleJs(order, prefix, prelude = '') {
  const chunks = prelude ? [prelude] : []
  for (const name of order) {
    const code = await readFile(join(src, `${name}.ts`), 'utf8')
    const out = await transform(code, { loader: 'ts', target: 'es2020' })
    chunks.push(`// ==== ${name} ====\n${out.code}`)
  }
  const min = await transform(chunks.join('\n'), {
    loader: 'js',
    target: 'es2020',
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false,
  })
  const name = `${prefix}.${shortHash(min.code)}.js`
  await writeFile(join(assets, name), min.code)
  return { name, size: min.code.length }
}

async function bundleCss(order, prefix) {
  const chunks = []
  for (const name of order) chunks.push(await readFile(join(src, `${name}.css`), 'utf8'))
  const min = await transform(chunks.join('\n'), { loader: 'css', minify: true })
  const name = `${prefix}.${shortHash(min.code)}.css`
  await writeFile(join(assets, name), min.code)
  return { name, size: min.code.length }
}

async function emitHtml(templatePath, outPath, cssName, jsName) {
  const html = (await readFile(templatePath, 'utf8'))
    .replace('__CSS__', `assets/${cssName}`)
    .replace('__JS__', `assets/${jsName}`)
  await writeFile(outPath, html)
}

// --- vendor libraries (pdf.js, pdf-lib, interact.js) ---
// Copied VERBATIM with a content hash — never re-minified, never concatenated into a
// bundle. pdf.js 6.x is ES-module-only, so runtime code loads it with a dynamic
// import(); pdf-lib and interact are classic scripts injected on demand. The manifest
// of hashed names is prepended to both JS bundles as VENDOR so runtime code can find
// them. The .mjs worker keeps its extension — pdf.js loads it as a module worker.
const VENDOR_FILES = ['pdf.min.mjs', 'pdf.worker.min.mjs', 'pdf-lib.min.js', 'interact.min.js']
const vendorManifest = {}
for (const f of VENDOR_FILES) {
  const buf = await readFile(join(root, 'vendor', f))
  const dot = f.indexOf('.')
  const hashed = `${f.slice(0, dot)}.${shortHash(buf.toString('latin1'))}${f.slice(dot)}`
  await writeFile(join(assets, hashed), buf)
  vendorManifest[f] = `assets/${hashed}`
}
const VENDOR_PRELUDE = `// ==== vendor manifest (generated) ====
const VENDOR = ${JSON.stringify(vendorManifest)};
`

// --- the consultant CRM (index.html) ---
const appJs = await bundleJs(JS_ORDER, 'app', VENDOR_PRELUDE)
const appCss = await bundleCss(CSS_ORDER, 'app')
await emitHtml(join(src, 'index.html'), join(root, 'index.html'), appCss.name, appJs.name)

// --- the public signing page (sign.html) ---
const signJs = await bundleJs(PUBLIC_JS_ORDER, 'sign', VENDOR_PRELUDE)
const signCss = await bundleCss(PUBLIC_CSS_ORDER, 'sign')
await emitHtml(join(src, 'public/sign.html'), join(root, 'sign.html'), signCss.name, signJs.name)

const kb = (n) => (n / 1024).toFixed(1) + ' KB'
console.log(`[build] app  : ${appJs.name} (${kb(appJs.size)}), ${appCss.name} (${kb(appCss.size)})`)
console.log(`[build] sign : ${signJs.name} (${kb(signJs.size)}), ${signCss.name} (${kb(signCss.size)})`)
