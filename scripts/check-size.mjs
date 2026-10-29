import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

// Measure the actual shipped artifacts. Vue is external, source maps are excluded.
const budgets = { 'nova-account.js': 32 * 1024, 'nova-account.css': 6 * 1024 }
for (const [name, budget] of Object.entries(budgets)) {
  const bytes = gzipSync(readFileSync(new URL(`../dist/${name}`, import.meta.url))).byteLength
  console.log(`${name}: ${bytes} bytes gzip / ${budget} bytes budget`)
  assert(bytes <= budget, `${name} exceeds the checked-in gzip budget`)
}
