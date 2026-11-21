import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'

const dist = new URL('../dist/', import.meta.url)
const workerSource = await readFile(new URL('./worker.js', import.meta.url), 'utf8')
const index = await readFile(new URL('index.html', dist))
const manifest = await readFile(new URL('manifest.webmanifest', dist))

async function filesIn(directory, pattern) {
  const entries = await readdir(new URL(`${directory}/`, dist), { withFileTypes: true })
  return entries.filter(entry => entry.isFile() && pattern.test(entry.name))
    .map(entry => `${directory}/${entry.name}`)
    .sort()
}

const assets = await filesIn('assets', /\.(css|js|woff2)$/)
const icons = await filesIn('icons', /\.png$/)
const hash = createHash('sha256').update(workerSource).update(index).update(manifest)

// Vite's asset names already contain content hashes. Public icons keep stable URLs.
hash.update(JSON.stringify(assets))
for (const icon of icons) hash.update(icon).update(await readFile(new URL(icon, dist)))

const version = hash.digest('hex').slice(0, 20)
const shell = `assets/shared-shell-${version}.html`
const build = {
  version,
  shell: `/${shell}`,
  files: [shell, 'manifest.webmanifest', ...assets, ...icons].map(path => `/${path}`),
}

// Keep each worker's HTML and its hashed chunks available under immutable URLs.
await writeFile(new URL(shell, dist), index)
await writeFile(new URL('sw.js', dist), `const build = ${JSON.stringify(build)}\n\n${workerSource}`)
console.log(`Shared PWA: ${build.files.length} static files for version ${version}`)
