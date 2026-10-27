import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import postcss from 'postcss'
import { scopeNovaCss } from '../scripts/scope-css'
const source = readFileSync('src/styles/index.css', 'utf8')
function tokens(selector: string) {
  const output: Record<string, string> = {}
  postcss.parse(source).walkRules(rule => { if (rule.selector === selector) rule.walkDecls(declaration => { output[declaration.prop] = declaration.value }) })
  return output
}
function luminance(hex: string) {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value
  const rgb = [0, 2, 4].map(offset => parseInt(full.slice(offset, offset + 2), 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
  return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722
}
function contrast(a: string, b: string) { const values = [luminance(a), luminance(b)].sort((x, y) => y - x); return (values[0]! + .05) / (values[1]! + .05) }
describe('precompiled style isolation', () => {
  it('omits preflight and uses a utility prefix with a component-only baseline', () => {
    expect(source).not.toContain('@import "tailwindcss/preflight')
    expect(source).toContain('prefix(na)')
    expect(source).not.toMatch(/(?:^|\n)(?:body|html|button|input|:root)\s*[{,:]/)
  })
  it('scopes generated defaults and namespaces internal properties/layers', async () => {
    const output = await postcss([scopeNovaCss()]).process('/* tailwindcss */ @layer theme { :root,:host { --na-spacing:.25rem; } } @layer properties { *,::before,::after,::backdrop { --tw-shadow:0 0 #0000; } } .nova-account { color:red; } .na\\:shadow {box-shadow:var(--tw-shadow)} @property --tw-shadow { syntax:"*";inherits:false; }', { from: undefined })
    expect(output.css).not.toContain(':root')
    expect(output.css).not.toContain('--tw-')
    expect(output.css).toContain('--na-tw-shadow')
    expect(output.css).toContain('@layer nova-theme')
    expect(output.css).toContain('.nova-account ::backdrop')
  })
  for (const mode of ['light', 'dark']) for (const accent of ['iris', 'blue', 'teal', 'amber']) {
    it(`${mode}/${accent}: key text and primary button contrast >= 4.5`, () => {
      const theme = { ...tokens('.nova-account'), ...tokens(`.nova-account[data-theme=${mode}]`), ...tokens(`.nova-account[data-accent=${accent}]`), ...tokens(`.nova-account[data-theme=${mode}][data-accent=${accent}]`) }
      expect(contrast(theme['--na-ink']!, theme['--na-canvas']!)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(theme['--na-muted']!, theme['--na-canvas']!)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(theme['--na-on-brand']!, theme['--na-brand']!)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(theme['--na-brand']!, theme['--na-surface']!)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
