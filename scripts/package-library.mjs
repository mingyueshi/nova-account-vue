import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Public entries are bundled declarations, never the plugin's intermediate .vue graph. */
export function assertPackageDeclarations(directory) {
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
  const entries = Object.values(manifest.exports)
    .filter((entry) => typeof entry === 'object' && entry.types)
    .map((entry) => entry.types.replace(/^\.\//, ''))
  assert(entries.length, 'No public declaration entries')
  for (const entry of entries) {
    const source = readFileSync(join(directory, entry), 'utf8')
    assert(source.trim(), `${entry}: empty declaration; wait for a complete library build`)
    const info = ts.preProcessFile(source, true, true)
    const relative = [...info.importedFiles, ...info.referencedFiles].filter((file) =>
      file.fileName.startsWith('.'),
    )
    assert.equal(
      relative.length,
      0,
      `${entry}: unbundled declaration references ${relative.map((file) => file.fileName).join(', ')}`,
    )
  }
  const declarations = readdirSync(join(directory, 'dist'), { recursive: true })
    .filter((name) => /\.d\.[cm]?ts$/.test(name))
    .map((name) => `dist/${name.replaceAll('\\', '/')}`)
  assert.deepEqual(
    declarations.sort(),
    entries.sort(),
    'Intermediate declarations remain in dist; wait for a complete library build',
  )
}

/** Build and pack a private source snapshot. Concurrent builds cannot change these bytes. */
export function createLibraryPackage(projectRoot = root, temporaryRoot = tmpdir()) {
  const directory = mkdtempSync(join(temporaryRoot, 'nova-account-package-'))
  const cleanup = () => rmSync(directory, { recursive: true, force: true })
  try {
    const manifest = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))
    for (const name of new Set([
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'src',
      'scripts',
      ...manifest.files.filter((name) => name !== 'dist'),
    ]))
      cpSync(join(projectRoot, name), join(directory, name), { recursive: true })
    symlinkSync(join(projectRoot, 'node_modules'), join(directory, 'node_modules'), 'junction')
    const env = { ...process.env }
    const run = (command, args) =>
      execFileSync(command, args, {
        cwd: directory,
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
      })
    run(process.execPath, [join(projectRoot, 'node_modules/vite/bin/vite.js'), 'build'])
    assertPackageDeclarations(directory)
    // Build and validation already ran above. Do not recursively invoke root packaging hooks.
    const [packed] = JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts']))
    assert(packed?.filename, 'npm pack must return a tarball')
    return { ...packed, tarball: join(directory, packed.filename), directory, cleanup }
  } catch (error) {
    cleanup()
    throw error
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    assertPackageDeclarations(root)
  } else {
    const packed = createLibraryPackage()
    const target = join(root, packed.filename)
    const temporary = `${target}.${process.pid}.tmp`
    try {
      copyFileSync(packed.tarball, temporary)
      renameSync(temporary, target)
      console.log(`PASS built and packed isolated library: ${target}`)
      console.log(`Tarball integrity: ${packed.integrity}`)
    } finally {
      rmSync(temporary, { force: true })
      packed.cleanup()
    }
  }
}
