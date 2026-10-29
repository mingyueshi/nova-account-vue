import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function settings(page: Page) {
  await page.getByRole('button', { name: '体验工具' }).click()
  await page
    .getByRole('dialog', { name: '体验工具', exact: true })
    .getByRole('button', { name: '演示设置', exact: true })
    .click()
  return page.getByRole('dialog', { name: '演示设置', exact: true })
}
async function chooseRadio(page: Page, name: string) {
  const radio = page.getByRole('radio', { name, exact: true })
  // The input is visually hidden; a user clicks its visible native label.
  await radio.locator('..').click()
  await expect(radio).toBeChecked()
  return radio
}

async function fillLogin(page: Page) {
  await page.getByLabel('邮箱', { exact: true }).fill('demo@nova.example')
  await page.getByLabel('密码', { exact: true }).fill('NovaDemo2026!')
}
async function verify(page: Page) {
  const dialog = page.getByRole('dialog', { name: '安全验证', exact: true })
  const slider = dialog.getByRole('slider')
  await expect(slider).toBeEnabled()
  await slider.press('End')
  await expect(dialog).toBeVisible()
  await slider.press('Enter')
  await expect(dialog).not.toBeVisible()
}
async function login(page: Page) {
  await fillLogin(page)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await verify(page)
  await expect(page.getByRole('heading', { name: '账户概览', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '编辑资料', exact: true })).toBeVisible()
}
async function preview(page: Page, readyLabel = '编辑资料') {
  await page.getByRole('button', { name: '体验工具' }).click()
  await page.getByRole('button', { name: '用户中心预览', exact: true }).click()
  await expect(page.getByRole('button', { name: readyLabel, exact: true })).toBeVisible()
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

test('password sign-in, keyboard slider, profile save, messages and device confirmation', async ({
  page,
}) => {
  await expect(page.getByRole('slider')).not.toBeVisible()
  await login(page)
  await page.locator('[data-page="profile"]').click()
  await page.getByLabel('昵称', { exact: true }).fill('Browser demo')
  await page.getByLabel('个人简介', { exact: true }).fill('Fictional information only')
  await page.getByRole('button', { name: '保存资料', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '演示资料已保存' })).toBeVisible()
  await page.locator('[data-page="messages"]').click()
  await page.getByRole('button', { name: '全部标为已读', exact: true }).click()
  await expect(page.getByRole('button', { name: '未读 0', exact: true })).toBeVisible()
  await page.locator('[data-page="devices"]').click()
  await page.getByRole('button', { name: '退出其他设备', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '退出其他设备？', exact: true })
  await dialog.getByRole('button', { name: '确认演示操作', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('main article')).toHaveCount(1)
  await expect(page.getByText('当前设备', { exact: true })).toBeVisible()
})

for (const mode of ['code', 'register', 'reset'] as const) {
  test(`${mode}: send code once, then submit without another slider`, async ({ page }) => {
    if (mode === 'code') await page.getByRole('tab', { name: '验证码登录', exact: true }).click()
    if (mode === 'register') await page.getByRole('button', { name: '注册', exact: true }).click()
    if (mode === 'reset')
      await page.getByRole('button', { name: '忘记密码？', exact: true }).click()
    await page.getByLabel('邮箱', { exact: true }).fill('demo@nova.example')
    if (mode === 'register') {
      await page.getByLabel('密码', { exact: true }).fill('NovaDemo2026!')
      await page.getByRole('checkbox').check()
    }
    await page.getByRole('button', { name: '获取验证码', exact: true }).click()
    await verify(page)
    await expect(page.getByText('演示码 246810 · 没有发送真实邮件', { exact: true })).toBeVisible()
    await page.getByLabel('验证码', { exact: true }).fill('246810')
    await page.locator('form button[type="submit"]').click()
    if (mode === 'reset') {
      await expect(page.getByRole('heading', { name: '设置新密码', exact: true })).toBeVisible()
      await page.getByLabel('新密码', { exact: true }).fill('NovaDemo2026!')
      await page.getByLabel('确认新密码', { exact: true }).fill('NovaDemo2026!')
      await page.getByRole('button', { name: '确认重置', exact: true }).click()
      await expect(page.getByText('密码已重置，请重新登录。', { exact: true })).toBeVisible()
    } else {
      await expect(page.getByRole('heading', { name: '账户概览', exact: true })).toBeVisible()
    }
    await expect(page.getByRole('dialog', { name: '安全验证', exact: true })).not.toBeVisible()
  })
}

test('dirty navigation: native focus containment, Escape, discard, and focus return', async ({
  page,
}) => {
  await preview(page)
  await page.locator('[data-page="profile"]').click()
  await page.getByLabel('昵称', { exact: true }).fill('Unsaved draft')
  const target = page.locator('[data-page="devices"]')
  await target.focus()
  await target.press('Enter')
  const dialog = page.getByRole('dialog', { name: '还有未保存的修改', exact: true })
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true)
  // Native dialogs may let Tab reach browser chrome; background document controls remain inert.
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press('Tab')
    await expect
      .poll(() =>
        dialog.evaluate(
          (element) =>
            element.contains(document.activeElement) || document.activeElement === document.body,
        ),
      )
      .toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(target).toBeFocused()
  await expect(page.getByLabel('昵称', { exact: true })).toHaveValue('Unsaved draft')
  await target.click()
  await dialog.getByRole('button', { name: '放弃并离开', exact: true }).click()
  await expect(page.getByRole('heading', { name: '登录设备', exact: true })).toBeFocused()
  await page.locator('[data-page="profile"]').click()
  await expect(page.getByLabel('昵称', { exact: true })).toHaveValue('Nova')
})

test('cancel a slow challenge and switch mode without a stale dialog or sign-in', async ({
  page,
}) => {
  const dialog = await settings(page)
  await dialog.getByRole('combobox', { name: '网络响应', exact: true }).selectOption('slow')
  await dialog.getByRole('button', { name: '关闭对话框', exact: true }).click()
  await fillLogin(page)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '安全验证', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: '验证码登录', exact: true }).click()
  // Wait for the actual slow adapter response using the demo's known latency.
  await expect(page.getByText('正在载入验证…', { exact: true })).not.toBeVisible()
  await page.waitForTimeout(3200)
  await expect(page.getByRole('tab', { name: '验证码登录', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('dialog', { name: '安全验证', exact: true })).not.toBeVisible()
  await expect(page.getByRole('heading', { name: '账户概览', exact: true })).not.toBeVisible()
})

test('a failed verification is visible and can be retried explicitly', async ({ page }) => {
  let dialog = await settings(page)
  await dialog.getByRole('combobox', { name: '滑块结果', exact: true }).selectOption('fail')
  await dialog.getByRole('button', { name: '关闭对话框', exact: true }).click()
  await fillLogin(page)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  const challenge = page.getByRole('dialog', { name: '安全验证', exact: true })
  await challenge.getByRole('slider').press('End')
  await challenge.getByRole('slider').press('Enter')
  await expect(challenge.getByRole('alert').filter({ hasText: /演示验证未通过/ })).toBeVisible()
  await page.keyboard.press('Escape')
  dialog = await settings(page)
  await dialog.getByRole('combobox', { name: '滑块结果', exact: true }).selectOption('normal')
  await dialog.getByRole('button', { name: '关闭对话框', exact: true }).click()
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await verify(page)
  await expect(page.getByRole('heading', { name: '账户概览', exact: true })).toBeVisible()
})

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 820, height: 500 },
  { width: 1440, height: 900 },
]) {
  test(`${viewport.width}px: auth, long reset form, account pages and dialog stay within viewport`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const withinViewport = async () => {
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true)
      expect(
        await page
          .locator('main')
          .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true)
    }
    await withinViewport()
    await page.getByRole('button', { name: '忘记密码？', exact: true }).click()
    await page.getByLabel('邮箱', { exact: true }).fill('demo@nova.example')
    await page.getByRole('button', { name: '获取验证码', exact: true }).click()
    await verify(page)
    await page.getByLabel('验证码', { exact: true }).fill('246810')
    await page.getByRole('button', { name: '继续', exact: true }).click()
    await expect(page.getByLabel('新密码', { exact: true })).toBeVisible()
    await withinViewport()
    await page.getByLabel('新密码', { exact: true }).fill('NovaDemo2026!')
    await page.getByLabel('确认新密码', { exact: true }).fill('NovaDemo2026!')
    await page.getByRole('button', { name: '确认重置', exact: true }).click()
    await preview(page)
    for (const tab of ['profile', 'messages', 'devices', 'notifications', 'appearance']) {
      await page.locator(`[data-page="${tab}"]`).click()
      await withinViewport()
    }
    await page.getByRole('button', { name: '↗ 退出登录', exact: true }).click()
    await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible()
  })
}

test('English locale, appearance radio keyboard control and appearance-only persistence', async ({
  page,
}) => {
  const dialog = await settings(page)
  await dialog.getByRole('combobox', { name: '界面语言', exact: true }).selectOption('en-US')
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible()
  await preview(page, 'Edit profile')
  await page.locator('[data-page="appearance"]').click()
  const dark = await chooseRadio(page, 'Dark')
  await dark.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeChecked()
  await chooseRadio(page, 'Teal')
  const storage = await page.evaluate(() => ({ ...localStorage }))
  expect(storage).toEqual({
    'nova-appearance-v1': JSON.stringify({ mode: 'system', accent: 'teal' }),
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible()
  await expect(page.locator('.nova-account')).toHaveAttribute('data-accent', 'teal')
  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue('')
})

test('axe: auth, error, register, challenge, account pages, and eight appearance previews', async ({
  page,
}, testInfo) => {
  const scan = async () => {
    // Assess the selected theme after CSS color transitions have settled.
    await page.locator('.nova-account').evaluate(async (root) => {
      await Promise.all(
        root
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished.catch(() => {})),
      )
    })
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(results.violations).toEqual([])
  }
  await scan()
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await scan()
  await page.getByRole('button', { name: '注册', exact: true }).click()
  await scan()
  await page.getByRole('button', { name: '← 返回登录', exact: true }).click()
  await fillLogin(page)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('slider')).toBeEnabled()
  await scan()
  await verify(page)
  for (const tab of [
    'overview',
    'profile',
    'security',
    'devices',
    'notifications',
    'messages',
    'appearance',
  ]) {
    await page.locator(`[data-page="${tab}"]`).click()
    await scan()
  }
  for (const mode of ['浅色', '深色']) {
    await chooseRadio(page, mode)
    for (const accent of ['鸢尾紫', '晴空蓝', '湖水绿', '暖琥珀']) {
      await chooseRadio(page, accent)
      await scan()
      await testInfo.attach(`appearance-${mode}-${accent}`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
    }
  }
})
