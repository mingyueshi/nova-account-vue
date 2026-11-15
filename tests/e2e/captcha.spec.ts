import { test, expect } from '@playwright/test'
import { createAxeBuilder } from './axe'

for (const { width, dark } of [
  { width: 1280, dark: false },
  { width: 320, dark: false },
  { width: 390, dark: true },
]) {
  test(`captcha: ${width}px ${dark ? 'dark' : 'light'} pointer dragging follows the handle`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 844 })
    if (dark)
      await page.addInitScript(() =>
        localStorage.setItem(
          'nova-appearance-v1',
          JSON.stringify({ mode: 'dark', accent: 'blue' }),
        ),
      )
    await page.goto('/')
    await page.getByLabel('邮箱', { exact: true }).fill('demo@demo.com')
    await page.getByLabel('密码', { exact: true }).fill('123456')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '安全验证', exact: true })
    const slider = dialog.getByRole('slider')
    const thumb = dialog.locator('[data-captcha-thumb]')
    await expect(slider).toBeEnabled()
    const bounds = (await slider.boundingBox())!
    const initialThumb = (await thumb.boundingBox())!
    const fill = dialog.locator('.nova-captcha-fill')
    const initialFill = (await fill.boundingBox())!.width
    expect(initialThumb.width).toBeGreaterThanOrEqual(44)
    expect(initialThumb.height).toBeGreaterThanOrEqual(44)
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    expect((await createAxeBuilder(page).analyze()).violations).toEqual([])
    // Clicking the track cannot jump straight to a verified state.
    await page.mouse.click(bounds.x + bounds.width - 24, bounds.y + bounds.height / 2)
    await expect(slider).toHaveValue('0')
    const startX = Math.round(initialThumb.x + 22)
    const pointerY = Math.round(initialThumb.y + 22)
    await page.mouse.move(startX, pointerY)
    await page.mouse.down()
    const travel = bounds.width - 48
    // Use integer pointer coordinates: Firefox/WebKit quantize mouse positions.
    const distance = Math.round(travel * 0.42)
    await page.mouse.move(startX + distance, pointerY, { steps: 24 })
    expect(Number(await slider.inputValue())).toBeCloseTo((distance / travel) * 100, 2)
    await expect(dialog.locator('.nova-captcha-prompt')).toBeHidden()
    expect((await fill.boundingBox())!.width).toBeGreaterThan(initialFill + 30)
    expect(
      Math.abs((await thumb.boundingBox())!.x - initialThumb.x - distance),
    ).toBeLessThanOrEqual(1)
    await testInfo.attach('dragging', { body: await dialog.screenshot(), contentType: 'image/png' })
    await page.mouse.up()
    await expect(dialog).toBeVisible()
    // A new gesture starts at the current position and can move backwards.
    const middle = (await thumb.boundingBox())!
    const middleX = Math.round(middle.x + 22)
    const backwards = Math.round(travel * 0.17)
    await page.mouse.move(middleX, pointerY)
    await page.mouse.down()
    await page.mouse.move(middleX - backwards, pointerY, { steps: 12 })
    await page.mouse.up()
    expect(Number(await slider.inputValue())).toBeCloseTo(
      ((distance - backwards) / travel) * 100,
      2,
    )
    // Capture keeps a drag alive outside the input; only releasing submits.
    const current = (await thumb.boundingBox())!
    await page.mouse.move(current.x + 22, current.y + 22)
    await page.mouse.down()
    await page.mouse.move(bounds.x + bounds.width + 30, bounds.y + bounds.height + 60, {
      steps: 24,
    })
    await expect(slider).toHaveValue('100')
    await expect(dialog).toBeVisible()
    await page.mouse.up()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole('heading', { name: '账户概览', exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
}
