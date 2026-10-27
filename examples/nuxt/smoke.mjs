import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'

// A short-lived loopback server is used only to inspect the built SSR output.
const socket = createServer()
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
const port = socket.address().port
await new Promise(resolve => socket.close(resolve))
const server = spawn(process.execPath, [resolve('.output/server/index.mjs')], {
  env: { ...process.env, NITRO_PORT: String(port), PORT: String(port), NITRO_HOST: '127.0.0.1', HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let log = ''
server.stdout.on('data', data => { log += data })
server.stderr.on('data', data => { log += data })
try {
  let response
  const until = Date.now() + 30_000
  while (Date.now() < until) {
    if (server.exitCode !== null) throw new Error(`SSR server exited: ${log}`)
    try { response = await fetch(`http://127.0.0.1:${port}/`); break } catch { await new Promise(resolve => setTimeout(resolve, 150)) }
  }
  assert(response?.ok, `SSR response failed: ${response?.status}; ${log}`)
  const html = await response.text()
  assert(html.includes('Nova Nuxt integration'), 'host page is server-rendered')
  assert(html.includes('欢迎回来'), 'Vue auth form must exist in server HTML; ClientOnly is not acceptable')
  assert(html.includes('尚未配置真实账户服务'), 'fail-closed disclosure is server-rendered')
  assert(html.includes('data-theme="light"'), 'theme root is rendered server-side')
  assert(!html.includes('demo@nova.example'), 'no demo account fallback')
  const hrefs = [...html.matchAll(/<link[^>]+href="([^"]+\.css(?:\?[^"]*)?)"[^>]*>/g)].map(match => match[1])
  // Nuxt 3 may inline global styles on SSR; Nuxt 4 may emit a stylesheet link.
  const inlineStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1])
  assert(hrefs.length + inlineStyles.length > 0, 'compiled stylesheet must be linked or SSR-inlined')
  const styles = [...inlineStyles, ...await Promise.all(hrefs.map(async href => (await fetch(new URL(href, `http://127.0.0.1:${port}`))).text()))]
  assert(styles.some(css => css.includes('.nova-account') && css.includes('na\\:flex')), 'CSS export must reach Nuxt output without host Tailwind')
  console.log('PASS built Nuxt SSR route, real auth component HTML, fail-closed adapter and compiled CSS')
} finally {
  server.kill('SIGTERM')
  await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve) })
}
