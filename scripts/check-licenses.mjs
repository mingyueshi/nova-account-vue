import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const allowed = new Set(['MIT', 'ISC', '0BSD', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause'])
const seen = new Set()
function check(name, parent) {
  const require = createRequire(parent)
  let path
  try {
    path = require.resolve(`${name}/package.json`)
  } catch {
    let directory = dirname(require.resolve(name))
    while (true) {
      const candidate = join(directory, 'package.json')
      if (existsSync(candidate) && JSON.parse(readFileSync(candidate, 'utf8')).name === name) {
        path = candidate
        break
      }
      const parentDirectory = dirname(directory)
      assert(parentDirectory !== directory, `Cannot locate package manifest for ${name}`)
      directory = parentDirectory
    }
  }
  if (seen.has(path)) return
  seen.add(path)
  const pkg = JSON.parse(readFileSync(path, 'utf8'))
  assert(
    allowed.has(pkg.license),
    `Review license before accepting ${pkg.name}@${pkg.version}: ${pkg.license}`,
  )
  console.log(`${pkg.name}@${pkg.version}: ${pkg.license}`)
  for (const dependency of Object.keys(pkg.dependencies ?? {})) check(dependency, path)
}
// Optional chart peers are part of the runtime inventory when installed for development.
for (const name of Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies }))
  check(name, join(root, 'package.json'))
console.log(`PASS ${seen.size} runtime dependency licenses, including optional chart support`)
