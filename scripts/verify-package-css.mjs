import assert from 'node:assert/strict'
import postcss from 'postcss'

export function assertNoDocumentReset(css) {
  // A grouping at-rule can contain a document rule. A rule nested inside
  // another selector is relative to that selector.
  function inspect(container) {
    for (const node of container.nodes) {
      if (node.type === 'atrule' && node.nodes) inspect(node)
      if (node.type === 'rule')
        for (const selector of node.selectors)
          assert(
            !/^(?:html|body)$/i.test(selector.trim()),
            'no document-level Preflight reset: ' + node.selector,
          )
    }
  }
  inspect(postcss.parse(css))
}
