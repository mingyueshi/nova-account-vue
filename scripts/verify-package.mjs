import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const env = {
  ...process.env,
  npm_config_cache:
    process.env.npm_config_cache ||
    process.env.NPM_CONFIG_CACHE ||
    join(tmpdir(), 'nova-account-npm-cache'),
}
const run = (command, args, cwd = root) =>
  execFileSync(command, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
const [packed] = JSON.parse(run('npm', ['pack', '--json']))
assert(packed?.filename, 'npm pack must return a tarball')
const files = packed.files.map((file) => file.path)
assert(files.includes('dist/nova-account.js'))
assert(files.includes('dist/index.d.ts'))
for (const file of ['LICENSE', 'README.en.md', 'CHANGELOG.md'])
  assert(files.includes(file), `missing package document: ${file}`)
assert.equal(packageJson.license, 'MIT')
assert(files.includes('dist/nova-account.css'))
assert(
  !files.some((file) => /^(demo|src|tests|examples|node_modules)\//.test(file)),
  'production package must not contain demo/source/tests/dependencies',
)
assert(
  !files.some((file) => /(^|\/)(\.env|\.npmrc|\.git)/.test(file)),
  'no secret/config artifacts in package',
)
const js = readFileSync(join(root, 'dist/nova-account.js'), 'utf8')
assert(/from\s*["']vue["']/.test(js), 'Vue must remain an external import')
assert(
  !/NovaDemo2026|demo@nova\.example|createDemoAdapter/.test(js),
  'production JS must not contain demo adapters or credentials',
)
const css = readFileSync(join(root, 'dist/nova-account.css'), 'utf8')
assert(css.includes('.nova-account'), 'compiled scoped foundation is required')
assert(css.includes('na\\:flex'), 'compiled prefixed Tailwind utilities are required')
assert(!/@tailwind|@source/.test(css), 'consumer must not need a Tailwind compilation step')
assert(!/@import/.test(css), 'the CSS export must be self-contained')
assert(!/(?:^|})\s*(?:html|body)\s*\{/.test(css), 'no document-level Preflight reset')
assert(!css.includes(':root'), 'library theme variables must be scoped to .nova-account')
assert(!css.includes('--tw-'), 'Tailwind internal variables must use the library namespace')
const sourceMap = JSON.parse(readFileSync(join(root, 'dist/nova-account.js.map'), 'utf8'))
assert(
  !sourceMap.sources.some((source) => /(^|\/)demo\//.test(source)),
  'demo sources must not enter the library source map',
)

// Outside the workspace tree so module resolution cannot accidentally find source dependencies.
const consumer = mkdtempSync(join(tmpdir(), 'nova-account-consumer-'))
writeFileSync(
  join(consumer, 'package.json'),
  JSON.stringify({ name: 'nova-account-package-consumer', private: true, type: 'module' }, null, 2),
)
run(
  'npm',
  [
    'install',
    '--no-audit',
    '--no-fund',
    '--ignore-scripts',
    join(root, packed.filename),
    `vue@${packageJson.devDependencies.vue}`,
    `@vue/server-renderer@${packageJson.devDependencies.vue}`,
    `typescript@${packageJson.devDependencies.typescript}`,
  ],
  consumer,
)
writeFileSync(
  join(consumer, 'verify.mjs'),
  `
import assert from 'node:assert/strict'
import { readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import * as library from 'nova-account'
for (const name of ['NovaAccount','NovaTheme','NovaAuthForm','NovaAccountCenter','NovaAppearance','NovaButton','NovaField','NovaDialog','NovaCaptcha','useAppearance','useAuthFlow','useAccount','NovaError','NOVA_ERROR_CODES','provideNovaLocale','useNovaLocale','zhCN','enUS']) assert(name in library, 'missing export ' + name)
assert(!('createDemoAdapter' in library))
const resolved = fileURLToPath(import.meta.resolve('nova-account'))
assert(realpathSync(resolved).startsWith(process.cwd() + '/node_modules/nova-account/'))
assert.equal(createRequire(resolved).resolve('vue'), createRequire(import.meta.url).resolve('vue'), 'library and host must resolve the same Vue runtime')
const css = readFileSync(fileURLToPath(import.meta.resolve('nova-account/style.css')), 'utf8')
assert(css.includes('.nova-account') && css.includes('na\\\\:flex'))
const html = await renderToString(createSSRApp({render: () => h(library.NovaTheme, {}, {default: () => h(library.NovaButton, {variant:'primary'}, {default: () => 'Tarball SSR verified'})})}))
assert(html.includes('Tarball SSR verified'))
assert.equal(typeof globalThis.window, 'undefined')
console.log('PASS tarball ESM exports, explicit compiled CSS, external Vue and SSR')
`,
)
writeFileSync(
  join(consumer, 'consumer.ts'),
  `
import { NovaAccount, NovaAuthForm, NovaButton, NovaTheme, NovaError, useAuthFlow, type AuthAdapter, type NovaAdapter, type Appearance, type NovaMessages, type NovaErrorCode, type NovaRequestResult } from 'nova-account'
import { h } from 'vue'
const unavailable = async (): Promise<never> => { throw new NovaError('ADAPTER_NOT_CONFIGURED', 'Configure a server adapter') }
const auth: AuthAdapter = {challenge:unavailable,verifyCaptcha:unavailable,sendCode:unavailable,login:unavailable,register:unavailable,verifyResetCode:unavailable,resetPassword:unavailable,logout:unavailable}
const theme: Appearance = {mode:'system',accent:'teal'}
const messages: Partial<NovaMessages> = {'auth.welcome':'Welcome'}
const knownCode: NovaErrorCode = 'RESET_EXPIRED'
const result: NovaRequestResult<number> = {status:'success',value:1}
void knownCode; void result
// @ts-expect-error Only declared message keys are accepted.
const badMessages: Partial<NovaMessages> = {'auth.unknown':'Unknown'}
// @ts-expect-error The built-in union stays strict even though NovaError permits adapter extensions.
const badCode: NovaErrorCode = 'SERVICE_SPECIFIC'
void badMessages; void badCode
new NovaError('SERVICE_SPECIFIC', 'A host-defined error')
h(NovaTheme, {modelValue:theme,locale:'en-US',messages,timeZone:'Asia/Shanghai'}); h(NovaAuthForm, {adapter:auth}); h(NovaButton, {variant:'primary'})
type ComponentProps = InstanceType<typeof NovaAccount>['$props']
const requiresAdapter = (adapter: NovaAdapter): ComponentProps => ({adapter,layout:'embedded',initialPage:'messages',locale:'en-US'})
void requiresAdapter; void useAuthFlow
type AuthProps = InstanceType<typeof NovaAuthForm>['$props']
const goodAuthProps: AuthProps = {adapter:auth}
// @ts-expect-error A production adapter is required; no implicit mock fallback.
const missingAdapter: AuthProps = {}
void goodAuthProps; void missingAdapter
// @ts-expect-error Public type must reject unknown accent names.
const invalid: Appearance = {mode:'light',accent:'red'}
void invalid
`,
)
writeFileSync(
  join(consumer, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        lib: ['ES2022', 'DOM'],
        skipLibCheck: false,
      },
      include: ['consumer.ts'],
    },
    null,
    2,
  ),
)
process.stdout.write(run('node', ['verify.mjs'], consumer))
process.stdout.write(run(join(consumer, 'node_modules/.bin/tsc'), ['--noEmit'], consumer))
const dependencyTree = JSON.parse(run('npm', ['ls', 'vue', '--json'], consumer))
assert(dependencyTree.dependencies?.vue?.version === packageJson.devDependencies.vue)
console.log(`PASS independent TypeScript consumer; tarball: ${join(root, packed.filename)}`)
console.log(`Tarball integrity: ${packed.integrity}`)
console.log(`Consumer retained for inspection: ${consumer}`)
