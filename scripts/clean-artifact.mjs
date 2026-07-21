// Removes the compiled JS artifact (.build/) before a rebuild so stale modules
// never linger. Source (*.ts, *.css, index.html) is never touched.
import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await rm(resolve(repoRoot, '.build'), { recursive: true, force: true })

console.log('[clean-artifact] removed: .build')
