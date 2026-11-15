import assert from 'node:assert/strict'
import AxeBuilder from '@axe-core/playwright'
import axe from 'axe-core'
import type { Page } from '@playwright/test'

let firefoxSource: string | undefined

export function createAxeBuilder(page: Page) {
  if (page.context().browser()?.browserType().name() !== 'firefox') return new AxeBuilder({ page })

  if (!firefoxSource) {
    // Firefox 2090055 crashes when axe and Playwright read the same reflected
    // ARIA refs in different JS worlds. Apply axe-core's proposed attribute-first
    // fix, keeping property-only refs and every rule intact. Remove after the
    // upstream fix ships: https://github.com/dequelabs/axe-core/pull/5561
    assert.equal(
      axe.version,
      '4.14.0',
      'Review the Firefox axe workaround after upgrading axe-core',
    )
    const marker = 'function getIdrefsValue(vNode, attr) {'
    assert.equal(axe.source.split(marker).length, 2, 'The pinned axe patch target changed')
    firefoxSource = axe.source.replace(
      marker,
      `${marker}\n      var attributeValue = vNode.attr(attr);\n      if (attributeValue) return attributeValue;`,
    )
  }
  return new AxeBuilder({ page, axeSource: firefoxSource })
}
