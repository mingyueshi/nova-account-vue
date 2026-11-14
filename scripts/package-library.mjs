import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const receiptName = '.nova-build.json'

function hashFiles(directory, paths) {
  const files = []
  for (const name of paths) {
    const path = join(directory, name)
    if (!existsSync(path)) continue
    if (statSync(path).isDirectory()) {
      for (const entry of readdirSync(path, { recursive: true, withFileTypes: true }))
        if (entry.isFile()) files.push(join(entry.parentPath, entry.name))
    } else files.push(path)
  }
  return Object.fromEntries(
    files
      .filter((file) => file !== join(directory, 'dist', receiptName))
      .sort()
      .map((file) => [
        file.slice(directory.length + 1).replaceAll('\\', '/'),
        createHash('sha256').update(readFileSync(file)).digest('hex'),
      ]),
  )
}
function inputHashes(directory) {
  return hashFiles(directory, [
    'src',
    'package.json',
    'package-lock.json',
    '.nvmrc',
    'tsconfig.json',
    'vite.config.ts',
    'scripts',
  ])
}
export function writeBuildReceipt(directory) {
  writeFileSync(
    join(directory, 'dist', receiptName),
    JSON.stringify(
      { version: 1, inputs: inputHashes(directory), outputs: hashFiles(directory, ['dist']) },
      null,
      2,
    ) + '\n',
  )
}
export function assertFreshBuild(directory) {
  const path = join(directory, 'dist', receiptName)
  assert(existsSync(path), 'Build receipt missing; run npm run build or npm run pack:library')
  const receipt = JSON.parse(readFileSync(path, 'utf8'))
  assert.equal(receipt.version, 1, 'Unknown build receipt; rebuild the library')
  assert.deepEqual(
    inputHashes(directory),
    receipt.inputs,
    'Build inputs changed; run npm run build or npm run pack:library',
  )
  assert.deepEqual(
    hashFiles(directory, ['dist']),
    receipt.outputs,
    'Build outputs changed or are missing; rebuild the library',
  )
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
  for (const entry of Object.values(manifest.exports))
    for (const file of typeof entry === 'string' ? [entry] : Object.values(entry))
      assert(existsSync(join(directory, file)), `Missing public export: ${file}`)
}
export function buildLibrary(directory = root) {
  rmSync(join(directory, 'dist', receiptName), { force: true })
  const inputs = inputHashes(directory)
  execFileSync(process.execPath, [join(directory, 'node_modules/vite/bin/vite.js'), 'build'], {
    cwd: directory,
    stdio: 'inherit',
  })
  assertPackageDeclarations(directory)
  writeFileSync(
    join(directory, 'dist/require.cjs'),
    "const error = new Error(\"nova-account is ESM-only. Use await import('nova-account') or await import('nova-account/charts') from CommonJS.\");\nerror.code = 'ERR_REQUIRE_ESM';\nthrow error;\n",
  )
  assert.deepEqual(
    inputHashes(directory),
    inputs,
    'Source changed during build; rebuild before packaging',
  )
  writeBuildReceipt(directory)
  assertFreshBuild(directory)
}

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
    for (const name of ['package-lock.json', '.nvmrc'])
      if (existsSync(join(projectRoot, name)))
        cpSync(join(projectRoot, name), join(directory, name))
    symlinkSync(join(projectRoot, 'node_modules'), join(directory, 'node_modules'), 'junction')
    const env = { ...process.env }
    const run = (command, args) =>
      execFileSync(command, args, {
        cwd: directory,
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
      })
    // Keep build output off stdout: callers parse the final package metadata there.
    execFileSync(process.execPath, [join(directory, 'scripts/package-library.mjs'), '--build'], {
      cwd: directory,
      env,
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    // Build and validation already ran above. Do not recursively invoke root packaging hooks.
    const [packed] = JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts']))
    assert(packed?.filename, 'npm pack must return a tarball')
    return { ...packed, tarball: join(directory, packed.filename), directory, cleanup }
  } catch (error) {
    cleanup()
    throw error
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--build')) {
    buildLibrary(root)
  } else if (process.argv.includes('--check')) {
    assertPackageDeclarations(root)
    assertFreshBuild(root)
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
