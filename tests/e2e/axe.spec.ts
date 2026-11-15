import { test, expect } from '@playwright/test'
import { createAxeBuilder } from './axe'

test('axe and named locators can read the same ARIA refs in either order', async ({ page }) => {
  await page.setContent('<span id="label">Save</span><button aria-labelledby="label"></button>')
  const button = page.getByRole('button', { name: 'Save', exact: true })
  await button.click({ trial: true })
  for (let scan = 0; scan < 2; scan++) {
    const results = await createAxeBuilder(page)
      .withRules(['button-name', 'aria-prohibited-attr', 'aria-valid-attr-value'])
      .analyze()
    expect(results.violations).toEqual([])
    await button.click({ trial: true })
  }
})

test('axe still reports an invalid attribute-backed accessible name', async ({ page }) => {
  await page.setContent('<button aria-labelledby="missing-label"></button>')
  const results = await createAxeBuilder(page).withRules(['button-name']).analyze()
  expect(results.violations.map(({ id }) => id)).toEqual(['button-name'])
})

test('axe retains script-set ARIA refs when the attribute is empty', async ({ page }) => {
  await page.setContent('<span id="label">Save</span><button id="action"></button>')
  await page.evaluate(() => {
    document.querySelector('#action')!.ariaLabelledByElements = [document.querySelector('#label')!]
  })
  expect(await page.locator('#action').getAttribute('aria-labelledby')).toBe('')
  const results = await createAxeBuilder(page).withRules(['button-name']).analyze()
  expect(results.violations).toEqual([])
})
