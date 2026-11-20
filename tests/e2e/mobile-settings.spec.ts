import { test, expect, type Page, type Locator } from '@playwright/test'
import { createAxeBuilder } from './axe'

const runtimeErrors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }, testInfo) => {
  const errors: string[] = []
  runtimeErrors.set(page, errors)
  if (testInfo.title.includes('390px'))
    await page.addInitScript(() =>
      localStorage.setItem('nova-appearance-v1', JSON.stringify({ mode: 'dark', accent: 'blue' })),
    )
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
})
test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([])
})
async function signIn(page: Page) {
  await page.goto('/')
  await page.getByLabel('邮箱', { exact: true }).fill('demo@demo.com')
  await page.getByLabel('密码', { exact: true }).fill('123456')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  const slider = page.getByRole('slider')
  await expect(slider).toBeEnabled()
  await slider.press('End')
  await slider.press('Enter')
  await expect(page.locator('[data-nova-account-center]')).toBeVisible()
}
async function nav(page: Page, id: string) {
  await page.locator('[data-mobile-nav-trigger]').click()
  await page.locator(`[data-mobile-page="${id}"]`).click()
  await expect(page.locator('[data-account-content]')).toHaveAttribute('data-account-page', id)
}
async function fits(page: Page, dialog: Locator) {
  await expect
    .poll(async () => {
      const box = (await dialog.boundingBox())!
      return box.y >= 0 && box.y + box.height <= page.viewportSize()!.height + 1
    })
    .toBe(true)
  await expect(dialog.getByRole('button', { name: '关闭对话框', exact: true })).toBeInViewport()
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
}
for (const width of [320, 390]) {
  test(`mobile settings ${width}px: unread messages retain reading width and stable return focus`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 568 })
    await signIn(page)
    await nav(page, 'messages')
    await page.getByRole('button', { name: '未读 4', exact: true }).click()
    const first = page.locator('.nova-message-list article').first()
    const open = first.locator('[data-message-open]')
    const before = (await open.boundingBox())!
    expect(before.width).toBeGreaterThan(width - 120)
    await first.getByRole('button', { name: '标为已读', exact: true }).click()
    await expect(page.locator('[data-message-open=welcome-space]')).toBeFocused()
    await page.locator('[data-message-open=welcome-space]').click()
    const dialog = page.getByRole('dialog', { name: '欢迎使用账户空间', exact: true })
    await expect(dialog.getByRole('button', { name: '标为已读', exact: true })).toHaveCount(0)
    await page.setViewportSize({ width, height: 360 })
    await fits(page, dialog)
    await expect(dialog.getByRole('button', { name: '关闭', exact: true })).toBeInViewport()
    expect((await createAxeBuilder(page).analyze()).violations).toEqual([])
    await testInfo.attach('message-reader', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    await dialog.getByRole('button', { name: '关闭', exact: true }).click()
    await expect(page.locator('[data-message-open=hello]')).toBeFocused()
    await page.setViewportSize({ width, height: 568 })
    const toolbar = page.locator('.nova-message-toolbar')
    const toolbarHeight = (await toolbar.boundingBox())!.height
    await page.getByRole('button', { name: '全部标为已读', exact: true }).click()
    expect((await toolbar.boundingBox())!.height).toBeCloseTo(toolbarHeight, 2)
    await expect(page.locator('[data-account-notice]')).toContainText('全部消息已标为已读')
    await expect(page.locator('[data-account-notice]')).toBeFocused()
    await expect(page.getByRole('heading', { name: '都读完了', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '全部标为已读', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: '全部消息', exact: true }).click()
    await expect(page.locator('[data-message-open]')).toHaveCount(6)
  })

  test(`mobile settings ${width}px: device confirmation names the session and survives removal`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 568 })
    await signIn(page)
    await nav(page, 'devices')
    const action = page.getByRole('button', { name: '退出 iPhone · Safari', exact: true })
    await action.click()
    const dialog = page.getByRole('dialog', { name: '退出此设备？', exact: true })
    await expect(dialog.locator('.nova-device-confirm')).toContainText('iPhone · Safari')
    await expect(dialog.locator('.nova-device-confirm')).toContainText('iOS · 杭州')
    await dialog.getByRole('button', { name: '取消', exact: true }).click()
    await expect(action).toBeFocused()
    await action.click()
    await page.setViewportSize({ width, height: 360 })
    await fits(page, dialog)
    await expect(dialog.getByRole('button', { name: '确认', exact: true })).toBeInViewport()
    expect((await createAxeBuilder(page).analyze()).violations).toEqual([])
    await testInfo.attach('session-confirmation', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    await dialog.getByRole('button', { name: '确认', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.locator('[data-device-id=phone]')).toHaveCount(0)
    await expect(page.locator('[data-account-notice]')).toBeFocused()
    await page.setViewportSize({ width, height: 568 })
    const bulk = page.getByRole('button', { name: '退出其他设备', exact: true })
    await bulk.click()
    const all = page.getByRole('dialog', { name: '退出其他设备？', exact: true })
    await expect(all).toContainText('当前设备会保留')
    await all.getByRole('button', { name: '确认', exact: true }).click()
    await expect(page.locator('[data-device-id]')).toHaveCount(1)
    await expect(page.locator('[data-device-id=current]')).toContainText('当前设备')
    await expect(bulk).toBeDisabled()
    await expect(page.locator('[data-account-notice]')).toBeFocused()
  })

  test(`mobile settings ${width}px: notification changes can be cancelled, guarded and saved`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 568 })
    await signIn(page)
    await nav(page, 'notifications')
    const mail = page.getByRole('switch', { name: '产品动态 · 邮件', exact: true })
    const savebar = page.locator('[data-account-savebar]')
    await mail.check()
    await expect(savebar.getByRole('button', { name: '保存偏好', exact: true })).toBeInViewport()
    await savebar.getByRole('button', { name: '取消', exact: true }).click()
    await expect(mail).not.toBeChecked()
    await expect(savebar.getByRole('status')).toBeFocused()
    await mail.check()
    await page.locator('[data-mobile-nav-trigger]').click()
    await page.locator('[data-mobile-page=devices]').click()
    const guard = page.getByRole('dialog')
    await guard.getByRole('button', { name: '继续编辑', exact: true }).click()
    await expect(mail).toBeChecked()
    expect((await createAxeBuilder(page).analyze()).violations).toEqual([])
    await savebar.getByRole('button', { name: '保存偏好', exact: true }).click()
    await expect(page.locator('[data-account-notice]')).toHaveText('通知偏好已保存。')
    await expect(savebar).toHaveAttribute('data-dirty', 'false')
    await nav(page, 'devices')
    await nav(page, 'notifications')
    await expect(mail).toBeChecked()
  })

  test(`mobile settings ${width}px: security confirmation validates locally and keeps secrets out of notices`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 568 })
    await signIn(page)
    await nav(page, 'security')
    await page.getByRole('button', { name: '开启', exact: true }).click()
    let dialog = page.getByRole('dialog', { name: '两步验证', exact: true })
    await page.setViewportSize({ width, height: 360 })
    await dialog.getByRole('button', { name: '确认', exact: true }).click()
    await expect(dialog.getByLabel('当前密码', { exact: true })).toBeFocused()
    await dialog.getByLabel('当前密码', { exact: true }).fill('123456')
    const confirmation = dialog.getByLabel('确认码', { exact: true })
    await confirmation.fill('12')
    await expect(confirmation).toHaveAttribute('aria-invalid', 'true')
    await confirmation.fill('123456')
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    await fits(page, dialog)
    await dialog.getByRole('button', { name: '确认', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.locator('.nova-security-controls')).toContainText('已开启')
    await page.setViewportSize({ width, height: 568 })
    await page.getByRole('button', { name: '更换', exact: true }).click()
    dialog = page.getByRole('dialog', { name: '更换邮箱', exact: true })
    await dialog.getByLabel('当前密码', { exact: true }).fill('123456')
    const email = dialog.getByLabel('新邮箱', { exact: true })
    await email.fill('broken')
    await dialog.getByRole('button', { name: '获取验证码', exact: true }).click()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await email.fill('next@demo.com')
    await expect(email).not.toHaveAttribute('aria-invalid', 'true')
    await dialog.getByRole('button', { name: '获取验证码', exact: true }).click()
    const code = dialog.getByLabel('邮箱验证码', { exact: true })
    await expect(code).toBeFocused()
    await expect(dialog.getByRole('status')).not.toContainText('123456')
    await code.fill('123')
    await dialog.getByRole('button', { name: '确认', exact: true }).click()
    await expect(code).toBeFocused()
    await expect(code).toHaveAttribute('aria-invalid', 'true')
    await code.fill('123456')
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    expect((await createAxeBuilder(page).analyze()).violations).toEqual([])
    await dialog.getByRole('button', { name: '确认', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.locator('.nova-security-controls')).toContainText('next@demo.com')
  })
}
