import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  utimesSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import {
  assertPackageDeclarations,
  assertFreshBuild,
  writeBuildReceipt,
  createLibraryPackage,
  excludeFileNames,
  runNpm,
} from '../scripts/package-library.mjs'
import { assertNoDocumentReset } from '../scripts/verify-package-css.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// Exact chart entry captured in the failing tarball while index.d.ts was already bundled.
const intermediate = `/** Optional ECharts entry; the account entry never imports the chart engine. */
export { default as NovaChart } from './components/NovaChart.vue';
export type { NovaChartOption } from './chart-options';
`
function temporary(t) {
  const directory = mkdtempSync(join(tmpdir(), 'nova-package-regression-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return directory
}
function declarationsFixture(t) {
  const directory = temporary(t)
  mkdirSync(join(directory, 'dist'))
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({
      exports: { '.': { types: './dist/index.d.ts' }, './charts': { types: './dist/charts.d.ts' } },
    }),
  )
  writeFileSync(join(directory, 'dist/index.d.ts'), 'export declare const account: string;')
  return directory
}
function freshFixture(t) {
  const directory = declarationsFixture(t)
  mkdirSync(join(directory, 'src'))
  writeFileSync(join(directory, 'src/index.ts'), 'export const version = 1')
  writeFileSync(join(directory, 'dist/charts.d.ts'), 'export declare const chart: string;')
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
  Object.assign(manifest, {
    name: 'nova-freshness-fixture',
    version: '0.0.0',
    type: 'module',
    scripts: { prepack: 'node scripts/package-library.mjs --check' },
  })
  manifest.exports['./charts'].import = './dist/charts.js'
  writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest))
  writeFileSync(join(directory, 'dist/charts.js'), 'export const chart = 1')
  mkdirSync(join(directory, 'scripts'))
  cpSync(join(root, 'scripts/package-library.mjs'), join(directory, 'scripts/package-library.mjs'))
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'junction')
  writeBuildReceipt(directory)
  assertFreshBuild(directory)
  return directory
}
test('size budgets follow literal lazy imports, nested re-exports and shared cycles once', (t) => {
  const directory = temporary(t)
  mkdirSync(join(directory, 'scripts'))
  mkdirSync(join(directory, 'dist/chunks'), { recursive: true })
  cpSync(join(root, 'scripts/check-size.mjs'), join(directory, 'scripts/check-size.mjs'))
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'junction')
  const entries = {
    'nova-account.js':
      'export const load = () => import("./chunks/lazy.js"); // import "./missing.js"',
    'chunks/lazy.js': 'export * as shared from "../shared.js";',
    'shared.js': 'import "./chunks/lazy.js"; import "vue";',
    'charts.js': 'import "./shared.js"; export const load = () => import("./chart-only.js");',
    'chart-only.js': 'export default 1;',
  }
  for (const [file, code] of Object.entries(entries))
    writeFileSync(join(directory, 'dist', file), code)
  writeFileSync(join(directory, 'dist/nova-account.css'), '')
  const size = (...files) =>
    files.reduce((sum, file) => sum + gzipSync(entries[file]).byteLength, 0)
  const check = () =>
    execFileSync(process.execPath, ['scripts/check-size.mjs'], {
      cwd: directory,
      encoding: 'utf8',
      stdio: 'pipe',
    })
  const output = check()
  assert(
    output.includes(
      'account JS including shared chunks: ' +
        size('nova-account.js', 'chunks/lazy.js', 'shared.js') +
        ' bytes',
    ),
  )
  assert(
    output.includes(
      'optional chart JS beyond the account graph: ' +
        size('charts.js', 'chart-only.js') +
        ' bytes',
    ),
  )
  writeFileSync(
    join(directory, 'dist/chunks/lazy.js'),
    'export default "' + randomBytes(65536).toString('base64') + '"',
  )
  assert.throws(check, /account JS including shared chunks exceeds/)
})
test('compiled CSS rejects bare document selectors in lists and nested grouping rules', () => {
  for (const rule of [
    'html{}',
    '.a{}html,body{}',
    '.a{}body,html{}',
    '@media screen{html{}}',
    '@layer base{@supports (display:grid){.a,BODY{margin:0}}}',
  ])
    assert.throws(() => assertNoDocumentReset(rule), /document-level Preflight reset/)
  assertNoDocumentReset(
    '/* html{} */ @media screen{.body,body .nova-account,[data-label="html,body"]{color:red}} .nova-account{body{color:red}}',
  )
})
test('copy filters prune generated Nuxt directories by native basename', (t) => {
  const directory = temporary(t)
  const example = join(directory, 'node_modules', 'project', 'example')
  const ignored = ['node_modules', '.nuxt', '.output']
  for (const name of [...ignored, 'node_modules-example']) {
    mkdirSync(join(example, 'nested', name), { recursive: true })
    writeFileSync(join(example, 'nested', name, 'file'), '')
  }
  const consumer = join(directory, 'consumer')
  cpSync(example, consumer, { recursive: true, filter: excludeFileNames(...ignored) })
  assert.deepEqual(readdirSync(join(consumer, 'nested')), ['node_modules-example'])
})
test('Finder metadata can be added, modified or removed without invalidating build inputs', (t) => {
  const directory = freshFixture(t)
  const file = join(directory, 'src/.DS_Store')
  writeFileSync(file, 'initial')
  assertFreshBuild(directory)
  writeBuildReceipt(directory)
  const receipt = JSON.parse(readFileSync(join(directory, 'dist/.nova-build.json'), 'utf8'))
  assert(!Object.hasOwn(receipt.inputs, 'src/.DS_Store'))
  writeFileSync(file, 'new contents')
  assertFreshBuild(directory)
  rmSync(file)
  assertFreshBuild(directory)
})
test('rejects changed source even when its timestamp is backdated', (t) => {
  const directory = freshFixture(t)
  const source = join(directory, 'src/index.ts')
  writeFileSync(source, 'export const version = 2')
  utimesSync(source, new Date(0), new Date(0))
  assert.throws(() => assertFreshBuild(directory), /Build inputs changed/)
})
test('rejects newly added source and changed build configuration', (t) => {
  const directory = freshFixture(t)
  writeFileSync(join(directory, 'src/new.ts'), 'export const added = true')
  assert.throws(() => assertFreshBuild(directory), /Build inputs changed/)
  rmSync(join(directory, 'src/new.ts'))
  writeFileSync(join(directory, 'vite.config.ts'), 'export default {}')
  assert.throws(() => assertFreshBuild(directory), /Build inputs changed/)
})
for (const change of ['remove', 'tamper'])
  test(`rejects a ${change}d chart JS despite intact declarations`, (t) => {
    const directory = freshFixture(t)
    const chart = join(directory, 'dist/charts.js')
    if (change === 'remove') rmSync(chart)
    else writeFileSync(chart, 'export const stale = true')
    assert.throws(() => assertFreshBuild(directory), /Build outputs changed/)
  })
test('npm pack refuses complete but stale dist without producing a tarball', (t) => {
  const directory = freshFixture(t)
  writeFileSync(join(directory, 'src/index.ts'), 'export const changed = true')
  assert.throws(
    () => runNpm(['pack', '--json'], { cwd: directory, encoding: 'utf8', stdio: 'pipe' }),
    (error) => /Build inputs changed/.test(error.stdout + error.stderr),
  )
  assert(!readdirSync(directory).some((name) => name.endsWith('.tgz')))
})
test('rejects the captured mixed declaration state before npm pack can publish it', (t) => {
  const directory = declarationsFixture(t)
  writeFileSync(join(directory, 'dist/charts.d.ts'), intermediate)
  assert.throws(
    () => assertPackageDeclarations(directory),
    /charts\.d\.ts: unbundled.*NovaChart\.vue/,
  )
})
test('also rejects intermediate files left beside otherwise bundled public entries', (t) => {
  const directory = declarationsFixture(t)
  writeFileSync(join(directory, 'dist/charts.d.ts'), 'export declare const chart: string;')
  writeFileSync(join(directory, 'dist/chart-options.d.ts'), 'export type Option = object;')
  assert.throws(() => assertPackageDeclarations(directory), /Intermediate declarations remain/)
})
test('accepts standalone public declarations with external peer imports', (t) => {
  const directory = declarationsFixture(t)
  writeFileSync(
    join(directory, 'dist/charts.d.ts'),
    "export type { EChartsType } from 'echarts/core';",
  )
  assert.doesNotThrow(() => assertPackageDeclarations(directory))
})
test('rejects a declaration truncated by an unfinished write', (t) => {
  const directory = declarationsFixture(t)
  writeFileSync(join(directory, 'dist/charts.d.ts'), '')
  assert.throws(() => assertPackageDeclarations(directory), /charts\.d\.ts: empty declaration/)
})
test('npm pack prepack refuses the original incomplete chart entry', (t) => {
  const directory = declarationsFixture(t)
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
  Object.assign(manifest, {
    name: 'nova-incomplete-fixture',
    version: '0.0.0',
    type: 'module',
    scripts: {
      prepack: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts.prepack,
    },
  })
  writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest))
  mkdirSync(join(directory, 'scripts'))
  cpSync(join(root, 'scripts/package-library.mjs'), join(directory, 'scripts/package-library.mjs'))
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'junction')
  writeFileSync(join(directory, 'dist/charts.d.ts'), intermediate)
  assert.throws(
    () => runNpm(['pack', '--json'], { cwd: directory, encoding: 'utf8', stdio: 'pipe' }),
    (error) => /unbundled declaration references/.test(error.stdout + error.stderr),
  )
  assert(!readdirSync(directory).some((name) => name.endsWith('.tgz')))
})
test('a failed isolated build cannot fall back to stale dist and cleans its staging directory', (t) => {
  const directory = declarationsFixture(t)
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
  manifest.files = ['dist']
  writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest))
  mkdirSync(join(directory, 'src'))
  mkdirSync(join(directory, 'scripts'))
  cpSync(join(root, 'scripts/package-library.mjs'), join(directory, 'scripts/package-library.mjs'))
  writeFileSync(join(directory, 'tsconfig.json'), '{}')
  writeFileSync(
    join(directory, 'vite.config.ts'),
    "throw new Error('intentional build failure'); export default {}",
  )
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'junction')
  writeFileSync(join(directory, 'dist/charts.d.ts'), intermediate)
  const staging = temporary(t)
  assert.throws(() => createLibraryPackage(directory, staging), /Command failed/)
  assert.deepEqual(readdirSync(staging), [])
  assert.equal(readFileSync(join(directory, 'dist/charts.d.ts'), 'utf8'), intermediate)
  assert(!readdirSync(directory).some((name) => name.endsWith('.tgz')))
})

test(
  'two package builds remain complete while shared dist is being overwritten',
  { timeout: 120_000 },
  async (t) => {
    const directory = temporary(t)
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    for (const name of [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'src',
      'scripts',
      ...manifest.files.filter((name) => name !== 'dist'),
    ])
      cpSync(join(root, name), join(directory, name), { recursive: true })
    symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'junction')
    mkdirSync(join(directory, 'dist'))
    const writer = spawn(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
    import {writeFileSync} from 'node:fs';
    const file = ${JSON.stringify(join(directory, 'dist/charts.d.ts'))};
    const value = ${JSON.stringify(intermediate)};
    writeFileSync(file, value);
    setInterval(() => writeFileSync(file, value), 5);
    console.log('ready');
  `,
      ],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    )
    await once(writer.stdout, 'data')
    const workers = []
    const snapshots = []
    try {
      const build = () =>
        new Promise((resolveBuild, rejectBuild) => {
          const worker = spawn(
            process.execPath,
            [
              '--input-type=module',
              '-e',
              `
        import {createLibraryPackage} from ${JSON.stringify(pathToFileURL(join(root, 'scripts/package-library.mjs')).href)};
        const p = createLibraryPackage(${JSON.stringify(directory)});
        console.log(JSON.stringify({directory:p.directory,tarball:p.tarball}));
      `,
            ],
            { stdio: ['ignore', 'pipe', 'pipe'] },
          )
          workers.push(worker)
          let stdout = '',
            stderr = ''
          worker.stdout.on('data', (chunk) => {
            stdout += chunk
          })
          worker.stderr.on('data', (chunk) => {
            stderr += chunk
          })
          worker.on('error', rejectBuild)
          worker.on('exit', (code) => {
            if (code !== 0) return rejectBuild(new Error(stderr || `build exited ${code}`))
            const result = JSON.parse(stdout.trim())
            snapshots.push(result)
            resolveBuild(result)
          })
        })
      for (const result of await Promise.allSettled([build(), build()]))
        assert.equal(result.status, 'fulfilled', result.reason?.stack)
      assert.notEqual(snapshots[0].directory, snapshots[1].directory)
      for (const snapshot of snapshots) {
        assertPackageDeclarations(snapshot.directory)
        const entry = execFileSync('tar', ['-xOf', snapshot.tarball, 'package/dist/charts.d.ts'], {
          encoding: 'utf8',
        })
        assert.equal(entry, readFileSync(join(snapshot.directory, 'dist/charts.d.ts'), 'utf8'))
        assert(!entry.includes('./components/NovaChart.vue'))
        assert(entry.includes('NovaChartOption'))
      }
      assert.equal(readFileSync(join(directory, 'dist/charts.d.ts'), 'utf8'), intermediate)
    } finally {
      writer.kill()
      await once(writer, 'exit')
      for (const worker of workers) if (worker.exitCode === null) worker.kill()
      for (const snapshot of snapshots) rmSync(snapshot.directory, { recursive: true, force: true })
    }
  },
)
