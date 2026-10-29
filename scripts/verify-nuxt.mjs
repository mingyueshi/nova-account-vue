import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const targets = process.argv.slice(2)
if (!targets.length) targets.push('nuxt3', 'nuxt4')
assert(
  targets.every((target) => ['nuxt3', 'nuxt4'].includes(target)),
  'Use nuxt3 or nuxt4',
)
const run = (args, cwd = root, capture = false) =>
  execFileSync('npm', args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  })
const directory = mkdtempSync(join(tmpdir(), 'nova-nuxt-'))
try {
  const [packed] = JSON.parse(run(['pack', '--json', '--pack-destination', directory], root, true))
  const tarball = join(directory, packed.filename)
  for (const target of targets) {
    const consumer = join(directory, target)
    cpSync(join(root, 'examples/nuxt', target), consumer, {
      recursive: true,
      filter: (source) => !/(?:^|\/)(?:node_modules|\.nuxt|\.output)(?:\/|$)/.test(source),
    })
    cpSync(join(root, 'examples/nuxt/smoke.mjs'), join(directory, 'smoke.mjs'))
    // Rebind only the local tarball; all other versions still come from the example lockfile.
    run(
      ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund', tarball],
      consumer,
    )
    run(['ci', '--no-audit', '--no-fund'], consumer)
    for (const file of ['nova-account.js', 'index.d.ts', 'nova-account.css']) {
      assert.deepEqual(
        readFileSync(join(consumer, 'node_modules/nova-account/dist', file)),
        readFileSync(join(root, 'dist', file)),
        `${target}: stale tarball ${file}`,
      )
    }
    for (const task of ['typecheck', 'build', 'smoke']) run(['run', task], consumer)
    console.log(`PASS ${target}: locked consumer, current tarball, typecheck, build, SSR and CSS`)
  }
} finally {
  rmSync(directory, { recursive: true, force: true })
}
