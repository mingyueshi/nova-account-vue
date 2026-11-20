import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import ts from 'typescript'

// Count local shared chunks as well as entries. Vue / ECharts remain external.
function graph(file, files = new Map()) {
  if (files.has(file)) return files
  const source = readFileSync(file, 'utf8')
  files.set(file, gzipSync(source).byteLength)
  const script = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS)
  function visit(node) {
    let specifier
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      specifier = node.moduleSpecifier
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
      specifier = node.arguments[0]
    if (specifier && ts.isStringLiteralLike(specifier) && /^\.\.?\/.*\.m?js$/.test(specifier.text))
      graph(resolve(dirname(file), specifier.text), files)
    ts.forEachChild(node, visit)
  }
  visit(script)
  return files
}
const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const core = graph(resolve(dist, 'nova-account.js'))
const chart = graph(resolve(dist, 'charts.js'))
const total = (files) => [...files.values()].reduce((sum, value) => sum + value, 0)
const checks = [
  // Includes mobile navigation, account recovery controls and the notification matrix, TOTP setup and recovery code components.
  ['account JS including shared chunks', total(core), 46.5 * 1024],
  [
    'account CSS',
    gzipSync(readFileSync(new URL('../dist/nova-account.css', import.meta.url))).byteLength,
    // Includes mobile navigation, scoped motion and device confirmation identity.
    8 * 1024,
  ],
  [
    'optional chart JS beyond the account graph',
    total(new Map([...chart].filter(([name]) => !core.has(name)))),
    4 * 1024,
  ],
]
for (const [label, bytes, budget] of checks) {
  console.log(`${label}: ${bytes} bytes gzip / ${budget} bytes budget`)
  assert(bytes <= budget, `${label} exceeds the checked-in gzip budget`)
}
console.log(`Chart-only JS including shared locale: ${total(chart)} bytes gzip (ECharts external)`)
