import type { Plugin } from 'postcss'

/** Tailwind prefixes utilities/theme variables, but not its internal --tw-* properties.
 * Keep generated defaults and internal properties out of the consumer's namespace too. */
export function scopeNovaCss(): Plugin {
  return {
    postcssPlugin: 'nova-account-isolation',
    Once(root) {
      if (!root.toString().includes('tailwindcss') || !root.toString().includes('.nova-account')) return
      root.walkDecls(declaration => {
        declaration.prop = declaration.prop.replaceAll('--tw-', '--na-tw-')
        declaration.value = declaration.value.replaceAll('--tw-', '--na-tw-')
      })
      root.walkAtRules(rule => {
        if (rule.name === 'property') rule.params = rule.params.replaceAll('--tw-', '--na-tw-')
        if (rule.name === 'layer') rule.params = rule.params.replace(/\b(theme|utilities|properties)\b/g, 'nova-$1')
      })
      root.walkRules(rule => {
        const selectors = rule.selector.split(',').map(value => value.trim())
        if (selectors.every(value => value === ':root' || value === ':host')) rule.selector = '.nova-account'
        if (selectors.every(value => ['*', '::before', '::after', '::backdrop', ':before', ':after'].includes(value))) {
          rule.selector = '.nova-account, .nova-account *, .nova-account ::before, .nova-account ::after, .nova-account ::backdrop'
        }
      })
    },
  }
}
