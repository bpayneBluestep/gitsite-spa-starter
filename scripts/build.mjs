// Per-file transpile of the global-script SPA: each root *.ts is type-stripped
// to .build/<name>.js independently (no bundling, no whole-program typecheck).
// This mirrors how the platform compiled the merge report — the files share one
// global scope at runtime via ordered <script> tags, so cross-file name reuse
// (last definition wins) is expected and must NOT be treated as a program error.
import { transform } from 'esbuild'
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, '.build')

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

const files = (await readdir(root)).filter((f) => f.endsWith('.ts')).sort()

let count = 0
for (const f of files) {
  const src = await readFile(join(root, f), 'utf8')
  const res = await transform(src, {
    loader: 'ts',
    target: 'es2020',
    sourcemap: 'inline',
    sourcefile: f,
  })
  await writeFile(join(outDir, f.replace(/\.ts$/, '.js')), res.code)
  count++
}

console.log(`[build] transpiled ${count} file(s) → .build/`)
