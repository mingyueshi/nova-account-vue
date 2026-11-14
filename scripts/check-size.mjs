import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

// Count local shared chunks as well as entries. Vue / ECharts remain external.
function graph(name, files = new Map()) {
  if (files.has(name)) return files
  const source = readFileSync(new URL(`../dist/${name}`, import.meta.url), 'utf8')
  files.set(name, gzipSync(source).byteLength)
  for (const match of source.matchAll(/(?:from\s*|import\s*)["']\.\/([^"']+\.js)["']/g))
    graph(match[1], files)
  return files
}
const core = graph('nova-account.js')
const chart = graph('charts.js')
const total = (files) => [...files.values()].reduce((sum, value) => sum + value, 0)
const checks = [
  ['account JS including shared chunks', total(core), 40 * 1024],
  [
    'account CSS',
    gzipSync(readFileSync(new URL('../dist/nova-account.css', import.meta.url))).byteLength,
    6 * 1024,
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
