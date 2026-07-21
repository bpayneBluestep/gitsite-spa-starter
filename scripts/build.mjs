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
  'appbuilder', 'clientform', 'agreements', 'agreementbuilder', 'chatbot',
  'main',
]
const CSS_ORDER = ['tokens', 'styles', 'chatbot', 'appbuilder']

const shortHash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10)

// --- clean previous artifact ---
await rm(assets, { recursive: true, force: true })
await rm(join(root, 'index.html'), { force: true })
await mkdir(assets, { recursive: true })

// --- JS: transpile each file, concatenate in order, minify (no identifier renaming) ---
const jsChunks = []
for (const name of JS_ORDER) {
  const code = await readFile(join(src, `${name}.ts`), 'utf8')
  const out = await transform(code, { loader: 'ts', target: 'es2020' })
  jsChunks.push(`// ==== ${name} ====\n${out.code}`)
}
const jsMin = await transform(jsChunks.join('\n'), {
  loader: 'js',
  target: 'es2020',
  minifyWhitespace: true,
  minifySyntax: true,
  minifyIdentifiers: false, // MUST stay false — inline handlers resolve top-level names
})
const jsName = `app.${shortHash(jsMin.code)}.js`
await writeFile(join(assets, jsName), jsMin.code)

// --- CSS: concatenate in order, minify ---
const cssChunks = []
for (const name of CSS_ORDER) cssChunks.push(await readFile(join(src, `${name}.css`), 'utf8'))
const cssMin = await transform(cssChunks.join('\n'), { loader: 'css', minify: true })
const cssName = `app.${shortHash(cssMin.code)}.css`
await writeFile(join(assets, cssName), cssMin.code)

// --- index.html from template ---
const html = (await readFile(join(src, 'index.html'), 'utf8'))
  .replace('__CSS__', `assets/${cssName}`)
  .replace('__JS__', `assets/${jsName}`)
await writeFile(join(root, 'index.html'), html)

console.log(`[build] ${jsName} (${(jsMin.code.length / 1024).toFixed(1)} KB), ${cssName} (${(cssMin.code.length / 1024).toFixed(1)} KB)`)
