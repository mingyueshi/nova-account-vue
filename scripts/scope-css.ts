import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss, { type Plugin } from 'postcss'
import type { Plugin as VitePlugin } from 'vite'
import { lightPalettes, darkPalettes } from '../src/palettes.ts'

const libraryStylesheet = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/styles/index.css',
)
function isLibraryStylesheet(id: string | undefined) {
  return id && resolve(id.split('?')[0]) === libraryStylesheet
}

/** Expand before Tailwind, whose optimizer may remove unknown at-rules. */
export function novaPaletteSource(): VitePlugin {
  return {
    name: 'nova-palette-source',
    enforce: 'pre',
    transform(code, id) {
      if (isLibraryStylesheet(id)) return code.replace('@nova-palettes;', novaPaletteCss())
    },
  }
}

/** Compile palette selectors without shipping dark token tables in the JS entry. */
export function novaPaletteCss() {
  const rule = (selector: string, tokens: Record<string, string>) =>
    `${selector}{${Object.entries(tokens)
      .map(([key, value]) => `--na-${key}:${value};`)
      .join('')}}`
  return [
    rule('.nova-account', lightPalettes.blue),
    rule('.nova-account[data-theme="dark"]', darkPalettes.blue),
    ...Object.entries(lightPalettes)
      .filter(([id]) => id !== 'blue')
      .map(([id, palette]) => rule(`.nova-account[data-accent="${id}"]`, palette)),
    ...Object.entries(darkPalettes)
      .filter(([id]) => id !== 'blue')
      .map(([id, palette]) =>
        rule(`.nova-account[data-theme="dark"][data-accent="${id}"]`, palette),
      ),
  ].join('\n')
}

/** Tailwind prefixes utilities/theme variables, but not its internal --tw-* properties.
 * Keep generated defaults and internal properties out of the consumer's namespace too. */
export function scopeNovaCss(): Plugin {
  return {
    postcssPlugin: 'nova-account-isolation',
    Once(root) {
      if (!isLibraryStylesheet(root.source?.input.file)) return
      root.walkAtRules('nova-palettes', (rule) => {
        rule.replaceWith(...postcss.parse(novaPaletteCss()).nodes)
      })
      root.walkDecls((declaration) => {
        declaration.prop = declaration.prop.replaceAll('--tw-', '--na-tw-')
        declaration.value = declaration.value.replaceAll('--tw-', '--na-tw-')
      })
      root.walkAtRules((rule) => {
        if (rule.name === 'property') rule.params = rule.params.replaceAll('--tw-', '--na-tw-')
        if (rule.name === 'layer')
          rule.params = rule.params.replace(/\b(theme|utilities|properties)\b/g, 'nova-$1')
      })
      root.walkRules((rule) => {
        const selectors = rule.selector.split(',').map((value) => value.trim())
        if (selectors.every((value) => value === ':root' || value === ':host'))
          rule.selector = '.nova-account'
        if (
          selectors.every((value) =>
            ['*', '::before', '::after', '::backdrop', ':before', ':after'].includes(value),
          )
        ) {
          rule.selector =
            '.nova-account, .nova-account *, .nova-account ::before, .nova-account ::after, .nova-account ::backdrop'
        }
      })
    },
  }
}
