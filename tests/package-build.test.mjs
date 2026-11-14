import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
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
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import { assertPackageDeclarations, createLibraryPackage } from '../scripts/package-library.mjs'

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
    () =>
      execFileSync('npm', ['pack', '--json'], { cwd: directory, encoding: 'utf8', stdio: 'pipe' }),
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
