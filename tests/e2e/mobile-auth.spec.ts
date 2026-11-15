import { test, expect, type Page } from '@playwright/test'
import { createAxeBuilder } from './axe'

async function verify(page: Page) {
  const dialog = page.getByRole('dialog', { name: '安全验证', exact: true })
  const slider = dialog.getByRole('slider')
  await expect(slider).toBeEnabled()
  await slider.press('End')
  await slider.press('Enter')
  await expect(dialog).not.toBeVisible()
}
async function sendCode(page: Page) {
  await page.getByRole('button', { name: '获取验证码', exact: true }).click()
  await verify(page)
  await expect(page.getByLabel('验证码', { exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: /秒后重试/ })).toBeDisabled()
  await expect(page.locator('form [role=status]').filter({ hasText: '验证码已发出' })).toHaveCount(
    1,
  )
}

const runtimeErrors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  runtimeErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('/')
})
test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([])
})

for (const width of [320, 390]) {
  test(`mobile auth ${width}px: validation, password visibility, cancelled slider and rejected password`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 568 })
    await page.locator('form button[type=submit]').click()
    const email = page.getByLabel('邮箱', { exact: true })
    const password = page.getByLabel('密码', { exact: true })
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await email.fill('demo@demo.com')
    await email.press('Enter')
    await expect(password).toBeFocused()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await password.fill('wrong')
    const toggle = page.getByRole('button', { name: '显示密码', exact: true })
    const target = (await toggle.boundingBox())!
    expect(target.width).toBeGreaterThanOrEqual(44)
    expect(target.height).toBeGreaterThanOrEqual(44)
    await toggle.click()
    await expect(password).toHaveAttribute('type', 'text')
    await expect(password).toBeFocused()
    await page.getByRole('button', { name: '隐藏密码', exact: true }).click()
    await password.press('Enter')
    await page.getByRole('button', { name: '关闭对话框', exact: true }).click()
    await expect(page.locator('form button[type=submit]')).toBeFocused()
    await expect(password).toHaveValue('wrong')
    await page.locator('form button[type=submit]').click()
    await verify(page)
    const error = page.locator('form [role=alert]')
    await expect(error).toContainText('密码')
    await expect(error).toBeFocused()
    await expect(password).toBeEditable()
    await password.fill('123456')
    await password.press('Enter')
    await verify(page)
    await expect(page.locator('[data-nova-account-center]')).toBeVisible()
  })

  test(`mobile auth ${width}px: complete registration with consent recovery and code delivery`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 568 })
    await page.getByRole('button', { name: '注册', exact: true }).click()
    const back = page.getByRole('button', { name: '← 返回登录', exact: true })
    await expect(back).toBeInViewport()
    await expect
      .poll(() => page.locator('[data-auth-content]').evaluate((el) => el.scrollTop))
      .toBe(0)
    const email = page.getByLabel('邮箱', { exact: true })
    const password = page.getByLabel('密码', { exact: true })
    const code = page.getByLabel('验证码', { exact: true })
    await email.fill(`member${width}@example.com`)
    await email.press('Enter')
    await expect(password).toBeFocused()
    await password.fill('123456')
    await password.press('Enter')
    await expect(code).toBeFocused()
    await sendCode(page)
    await code.fill('123456')
    await code.press('Enter')
    const consent = page.getByRole('checkbox')
    await expect(consent).toBeFocused()
    await expect(consent).toHaveAttribute('aria-invalid', 'true')
    await consent.check()
    await expect(consent).toHaveAttribute('aria-invalid', 'false')
    await expect(page.locator('form [role=alert]')).toHaveCount(0)
    expect((await createAxeBuilder(page).analyze()).violations).toEqual([])
    await page.locator('form button[type=submit]').click()
    await expect(page.locator('[data-nova-account-center]')).toBeVisible()
  })

  test(`mobile auth ${width}px: recover password, correct confirmation and sign in`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 568 })
    await page.getByRole('button', { name: '忘记密码？', exact: true }).click()
    await expect(page.getByRole('button', { name: '← 返回登录', exact: true })).toBeInViewport()
    await page.getByLabel('邮箱', { exact: true }).fill('demo@demo.com')
    await sendCode(page)
    await page.getByLabel('验证码', { exact: true }).fill('123456')
    await page.getByLabel('验证码', { exact: true }).press('Enter')
    const password = page.getByLabel('新密码', { exact: true })
    const confirm = page.getByLabel('确认新密码', { exact: true })
    await expect(password).toBeFocused()
    await password.fill('654321')
    await password.press('Enter')
    await expect(confirm).toBeFocused()
    await confirm.fill('different')
    await confirm.press('Enter')
    await expect(confirm).toHaveAttribute('aria-invalid', 'true')
    await confirm.fill('654321')
    await expect(confirm).not.toHaveAttribute('aria-invalid', 'true')
    expect((await createAxeBuilder(page).analyze()).violations).toEqual([])
    await confirm.press('Enter')
    await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible()
    await expect(page.locator('form [role=status]')).toContainText('密码已重置')
    await expect(page.locator('form [role=status]')).toBeFocused()
    await page.getByLabel('密码', { exact: true }).fill('654321')
    await page.locator('form button[type=submit]').click()
    await verify(page)
    await expect(page.locator('[data-nova-account-center]')).toBeVisible()
  })
}

test('mobile auth: expired code offers a fresh challenge and returns to code entry', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 })
  // Both adapters capture Date.now at setup; install the clock before mounting them.
  await page.clock.install()
  await page.reload()
  await page.getByRole('tab', { name: '验证码登录', exact: true }).click()
  await page.getByLabel('邮箱', { exact: true }).fill('demo@demo.com')
  await sendCode(page)
  await page.clock.fastForward(121_000)
  await expect(page.locator('form [role=status]')).toHaveText('验证码已过期')
  const resend = page.getByRole('button', { name: '重新获取', exact: true })
  await expect(resend).toBeEnabled()
  await resend.click()
  await verify(page)
  await expect(page.getByLabel('验证码', { exact: true })).toBeFocused()
  await expect(page.locator('form [role=status]')).toHaveText('验证码已发出')
  await page.getByLabel('验证码', { exact: true }).fill('123456')
  await page.getByLabel('验证码', { exact: true }).press('Enter')
  await expect(page.locator('[data-nova-account-center]')).toBeVisible()
})

test('mobile auth: keyboard viewport resize/pan keeps controls and captcha in the visible area', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  })
  await page.reload()
  await page.getByRole('button', { name: '注册', exact: true }).click()
  await page.getByLabel('邮箱', { exact: true }).fill('keyboard@example.com')
  await page.getByLabel('密码', { exact: true }).fill('123456')
  await page.getByLabel('验证码', { exact: true }).focus()
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 360, offsetTop: 80 })
    window.visualViewport!.dispatchEvent(new Event('resize'))
    window.visualViewport!.dispatchEvent(new Event('scroll'))
  })
  const code = page.getByLabel('验证码', { exact: true })
  const submit = page.locator('form button[type=submit]')
  await expect
    .poll(async () => (await submit.boundingBox())!.y + (await submit.boundingBox())!.height)
    .toBeLessThanOrEqual(440)
  await expect.poll(async () => (await code.boundingBox())!.y).toBeGreaterThanOrEqual(148)
  const codeBounds = (await code.boundingBox())!
  const submitBounds = (await submit.boundingBox())!
  expect(codeBounds.y + codeBounds.height).toBeLessThanOrEqual(submitBounds.y)
  await testInfo.attach('keyboard-form', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await page.getByRole('button', { name: '获取验证码', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '安全验证', exact: true })
  await expect(dialog.getByRole('slider')).toBeEnabled()
  const bounds = (await dialog.boundingBox())!
  expect(bounds.y).toBeGreaterThanOrEqual(80)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(440)
  await page.getByRole('button', { name: '关闭对话框', exact: true }).click()
  await expect(page.getByRole('button', { name: '获取验证码', exact: true })).toBeFocused()
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 844, offsetTop: 0 })
    window.visualViewport!.dispatchEvent(new Event('resize'))
  })
  await expect
    .poll(() =>
      page.locator('[data-layout=full]').evaluate((el) => el.getBoundingClientRect().height),
    )
    .toBe(844)
  await expect(page.locator('[data-layout=full]')).toHaveCSS('top', '0px')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})
