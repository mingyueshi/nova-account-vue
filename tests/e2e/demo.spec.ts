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
async function hostPanel(page: Page) {
  await page.getByRole('button', { name: '体验工具' }).click()
  await page
    .getByRole('dialog', { name: '体验工具', exact: true })
    .getByRole('button', { name: '宿主集成演示', exact: true })
    .click()
  return page.getByRole('dialog', { name: '宿主集成演示', exact: true })
}

async function checkPreviewViewport(
  popup: Page,
  browserName: string,
  size: { width: number; height: number },
) {
  // Playwright Firefox applies Browser.setDefaultViewport to every page and does
  // not derive popup emulation from window.open features, unlike Chromium/WebKit.
  // Exact requested features are covered separately by demo.component.test.ts.
  // Explicitly emulate Firefox's narrow viewport rather than claiming its native
  // popup sizing passed. Chromium/WebKit must derive their emulated size from
  // the requested features; none of these checks verifies a native window manager.
  await expect(popup.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible()
  if (browserName === 'firefox') {
    await test.info().attach('firefox-popup-before-explicit-emulation', {
      body: JSON.stringify(
        await popup.evaluate(() => ({ width: innerWidth, height: innerHeight })),
      ),
      contentType: 'application/json',
    })
    await popup.setViewportSize(size)
  }
  expect(popup.viewportSize()).toEqual(size)
  await expect
    .poll(() => popup.evaluate(() => ({ width: innerWidth, height: innerHeight })))
    .toEqual(size)
  expect(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
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

test('a rejected code sign-in focuses the global error and permits an explicit retry', async ({
  page,
}) => {
  await page.getByRole('tab', { name: '验证码登录', exact: true }).click()
  await page.getByLabel('邮箱', { exact: true }).fill('demo@nova.example')
  await page.getByRole('button', { name: '获取验证码', exact: true }).click()
  await verify(page)
  let dialog = await settings(page)
  await dialog.getByRole('combobox', { name: '业务请求', exact: true }).selectOption('fail')
  await dialog.getByRole('button', { name: '关闭对话框', exact: true }).click()
  const code = page.getByLabel('验证码', { exact: true })
  await expect(code).toHaveAttribute('maxlength', '6')
  await code.fill('246810')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  const error = page.getByRole('alert').filter({ hasText: '模拟请求被拒绝，状态未改变。' })
  await expect(error).toBeFocused()
  await expect(code).toHaveValue('246810')
  await expect(page.getByRole('heading', { name: '账户概览', exact: true })).not.toBeVisible()

  dialog = await settings(page)
  await dialog.getByRole('combobox', { name: '业务请求', exact: true }).selectOption('normal')
  await dialog.getByRole('button', { name: '关闭对话框', exact: true }).click()
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('heading', { name: '账户概览', exact: true })).toBeVisible()
})

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
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByLabel('邮箱', { exact: true })).toBeFocused()
  await expect(page.getByText('请输入有效的邮箱地址。', { exact: true })).toBeVisible()
  const dialog = await settings(page)
  const language = dialog.getByRole('combobox', { name: '界面语言', exact: true })
  await language.focus()
  await language.selectOption('en-US')
  await expect(language).toBeFocused()
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible()
  await expect(page.getByText('Enter a valid email address.', { exact: true })).toBeVisible()
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

test('host panel: embedded layout switch and controlled page jumps log pageChange', async ({
  page,
}) => {
  const host = await hostPanel(page)
  await host.getByRole('combobox', { name: '外壳布局 layout' }).selectOption('embedded')
  await expect(page.getByText('虚构宿主站点')).toBeVisible()
  await expect(page.locator('[data-layout="embedded"]')).toBeVisible()
  await host.getByRole('button', { name: '关闭对话框' }).click()
  await page.getByRole('button', { name: '体验工具' }).click()
  await page
    .getByRole('dialog', { name: '体验工具', exact: true })
    .getByRole('button', { name: '用户中心预览', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: '账户概览', exact: true })).toBeVisible()
  const signedInHost = await hostPanel(page)
  await signedInHost.getByRole('button', { name: '安全设置', exact: true }).click()
  await expect(page.getByRole('heading', { name: '账号安全', exact: true })).toBeVisible()
  await expect(signedInHost.getByText('当前页面：安全设置')).toBeVisible()
  await expect(signedInHost.getByText(/pageChange：/)).toContainText('安全设置')
  await signedInHost.getByRole('combobox', { name: '外壳布局 layout' }).selectOption('full')
  await expect(page.getByText('虚构宿主站点')).not.toBeVisible()
})

test('session expiry: next account request reports 401 and returns to the auth page', async ({
  page,
}) => {
  await preview(page)
  const host = await hostPanel(page)
  await host.getByRole('button', { name: '让会话过期' }).click()
  await host.getByRole('button', { name: '消息中心', exact: true }).click()
  await host.getByRole('button', { name: '关闭对话框' }).click()
  await page.getByRole('button', { name: '全部标为已读', exact: true }).click()
  await expect(
    page.getByText('登录状态已过期（模拟 401），已清除本地会话并返回登录页。'),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible()
})

test('external edit: the next account mutation reports a revision conflict', async ({ page }) => {
  await preview(page)
  const host = await hostPanel(page)
  await host.getByRole('button', { name: '模拟另一设备修改' }).click()
  await host.getByRole('button', { name: '关闭对话框' }).click()
  await page.locator('[data-page="profile"]').click()
  await page.getByLabel('昵称', { exact: true }).fill('Conflict draft')
  await page.getByRole('button', { name: '保存资料', exact: true }).click()
  // The rejection surfaces both as the section alert and the adapter error line.
  await expect(page.getByText('资料已发生变化，请重新加载后再试。').first()).toBeVisible()
})

test('math challenge through the #captcha slot: error names the answer, retry and success', async ({
  page,
}) => {
  const settingsDialog = await settings(page)
  await settingsDialog.getByRole('combobox', { name: '挑战方式', exact: true }).selectOption('math')
  await settingsDialog.getByRole('button', { name: '关闭对话框', exact: true }).click()
  await fillLogin(page)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '安全验证', exact: true })
  const question = dialog.getByText(/请计算/)
  await expect(question).toBeVisible()
  const [, left, right] = (await question.textContent())!.match(/请计算 (\d+) × (\d+)/)!
  await page.getByLabel('计算结果', { exact: true }).fill('1')
  await dialog.getByRole('button', { name: '提交答案', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText(`正确答案 ${Number(left) * Number(right)}`)
  await dialog.getByRole('button', { name: '换一题', exact: true }).click()
  await expect(question).toBeVisible()
  const [, nextLeft, nextRight] = (await question.textContent())!.match(/请计算 (\d+) × (\d+)/)!
  await page
    .getByLabel('计算结果', { exact: true })
    .fill(String(Number(nextLeft) * Number(nextRight)))
  await dialog.getByRole('button', { name: '提交答案', exact: true }).click()
  await expect(page.getByRole('heading', { name: '账户概览', exact: true })).toBeVisible()
})

test('TOTP security slot enables two-step; the danger zone returns to the auth page', async ({
  page,
}) => {
  await preview(page)
  const host = await hostPanel(page)
  await host.getByRole('checkbox', { name: /#security 插槽/ }).check()
  await host.getByRole('button', { name: '关闭对话框' }).click()
  await page.locator('[data-page="security"]').click()
  await expect(page.getByRole('heading', { name: '宿主二次认证（TOTP 形式演示）' })).toBeVisible()
  await page.getByLabel('当前密码', { exact: true }).fill('NovaDemo2026!')
  await page.getByLabel('验证器验证码', { exact: true }).fill('246810')
  await page.getByRole('button', { name: '开启两步验证', exact: true }).click()
  await expect(page.getByText('已开启两步验证')).toBeVisible()
  await page.getByRole('button', { name: '注销演示账户…', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: '注销演示账户？', exact: true })
  await confirm.getByRole('button', { name: '确认注销', exact: true }).click()
  await expect(
    page.getByText('演示账户注销完成：这是内存模拟，刷新页面后账户会复原。'),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible()
})

test('codeLength and passwordStrength props shape the auth form', async ({ page }) => {
  const host = await hostPanel(page)
  await host.getByRole('combobox', { name: '验证码长度 codeLength' }).selectOption('4')
  await host.getByRole('checkbox', { name: /passwordStrength/ }).check()
  await host.getByRole('button', { name: '关闭对话框' }).click()
  await page.getByRole('button', { name: '注册', exact: true }).click()
  await page.getByLabel('邮箱', { exact: true }).fill('demo@nova.example')
  await page.getByLabel('密码', { exact: true }).fill('NovaDemo2026!')
  await expect(page.getByText(/密码强度/)).toBeVisible()
  await expect(page.locator('meter')).toHaveAttribute('value', '4')
  await page.getByRole('button', { name: '获取验证码', exact: true }).click()
  await verify(page)
  await expect(page.getByText('演示码 2468 · 没有发送真实邮件', { exact: true })).toBeVisible()
  await expect(page.getByLabel('验证码', { exact: true })).toHaveAttribute('maxlength', '4')
})

test('rate limiting rejects the second send with remaining seconds', async ({ page }) => {
  const settingsDialog = await settings(page)
  await settingsDialog
    .getByRole('combobox', { name: '发送限流', exact: true })
    .selectOption('limited')
  await settingsDialog.getByRole('button', { name: '关闭对话框', exact: true }).click()
  await page.getByRole('tab', { name: '验证码登录', exact: true }).click()
  await page.getByLabel('邮箱', { exact: true }).fill('demo@nova.example')
  await page.getByRole('button', { name: '获取验证码', exact: true }).click()
  await verify(page)
  await expect(page.getByText('演示码 246810 · 没有发送真实邮件', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '注册', exact: true }).click()
  await page.getByLabel('邮箱', { exact: true }).fill('demo@nova.example')
  await page.getByRole('button', { name: '获取验证码', exact: true }).click()
  // A rejected send keeps the challenge dialog open with the throttle error.
  const limitedDialog = page.getByRole('dialog', { name: '安全验证', exact: true })
  const slider = limitedDialog.getByRole('slider')
  await expect(slider).toBeEnabled()
  await slider.press('End')
  await slider.press('Enter')
  await expect(page.getByText(/发送过于频繁（模拟限流），请约 \d+ 秒后再试/)).toBeVisible()
})

test('storage fault surfaces storageError; OAuth placeholders render through #authFooter', async ({
  page,
}) => {
  const host = await hostPanel(page)
  const storageToggle = host.getByRole('checkbox', { name: '禁用本地存储（演示 storageError）' })
  await storageToggle.check()
  await expect(host.getByRole('alert').filter({ hasText: '外观偏好无法保存' })).toBeVisible()
  await storageToggle.uncheck()
  await host.getByRole('checkbox', { name: /#authFooter/ }).check()
  await host.getByRole('button', { name: '关闭对话框' }).click()
  await expect(page.getByRole('group', { name: '第三方登录占位' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'GitHub' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Google' })).toBeDisabled()
})

test('multi-instance view renders two independently themed auth roots', async ({ page }) => {
  const host = await hostPanel(page)
  // Toggling hides the main view and closes the dialog, so verify via a raw click.
  await host
    .getByRole('checkbox', { name: /多实例主题隔离/ })
    .evaluate((el) => (el as HTMLElement).click())
  await expect(page.getByRole('heading', { name: '实例 A · 深色 / 暖琥珀' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '实例 B · 浅色 / 湖水绿' })).toBeVisible()
  const rootA = page.locator('.nova-account[data-accent="amber"]')
  const rootB = page.locator('.nova-account[data-accent="teal"]')
  await expect(rootA).toHaveCount(1)
  await expect(rootB).toHaveCount(1)
  await rootA.getByLabel('邮箱', { exact: true }).fill('demo@nova.example')
  await rootA.getByLabel('密码', { exact: true }).fill('NovaDemo2026!')
  await rootA.getByRole('button', { name: '登录', exact: true }).click()
  const slider = rootA.getByRole('slider')
  await expect(slider).toBeEnabled()
  await slider.press('End')
  await slider.press('Enter')
  await expect(rootA.getByText('此实例已登录')).toBeVisible()
  await expect(rootB.getByRole('button', { name: '登录', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '返回单实例演示' }).click()
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible()
})

test('viewport preview opens the demo with responsive narrow content', async ({
  page,
  browserName,
}) => {
  const host = await hostPanel(page)
  await host.getByRole('combobox', { name: '手机视口预览' }).selectOption('390')
  const popupPromise = page.waitForEvent('popup')
  await host.getByRole('button', { name: '打开预览窗口' }).click()
  const popup = await popupPromise
  await checkPreviewViewport(popup, browserName, { width: 390, height: 844 })
  await popup.close()
})

test('multi-instance preview preserves the primary session, draft and controlled page', async ({
  page,
}) => {
  await preview(page)
  await page.locator('[data-page="profile"]').click()
  await page.getByLabel('昵称', { exact: true }).fill('Unsaved primary draft')
  const host = await hostPanel(page)
  await host
    .getByRole('checkbox', { name: /多实例主题隔离/ })
    .evaluate((el) => (el as HTMLElement).click())
  await expect(page.getByRole('heading', { name: '实例 A · 深色 / 暖琥珀' })).toBeVisible()
  await page.getByRole('button', { name: '返回单实例演示' }).click()
  await expect(page.getByRole('heading', { name: '个人资料', exact: true })).toBeVisible()
  await expect(page.getByLabel('昵称', { exact: true })).toHaveValue('Unsaved primary draft')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('button', { name: '保存资料', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '演示资料已保存' })).toBeVisible()
})

test('small viewport preview supports 320 by 568 responsive content', async ({
  page,
  browserName,
}) => {
  const host = await hostPanel(page)
  await host.getByRole('combobox', { name: '手机视口预览' }).selectOption('320')
  const popupPromise = page.waitForEvent('popup')
  await host.getByRole('button', { name: '打开预览窗口' }).click()
  const popup = await popupPromise
  await checkPreviewViewport(popup, browserName, { width: 320, height: 568 })
  await popup.close()
})

for (const scenario of [
  { width: 320, height: 568, layout: 'full' },
  { width: 390, height: 844, layout: 'full' },
  { width: 820, height: 700, layout: 'full' },
  { width: 320, height: 568, layout: 'embedded' },
] as const) {
  test(`${scenario.width}px ${scenario.layout}: multi-instance cards and controls fit without clipping`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height })
    const host = await hostPanel(page)
    await host.getByRole('combobox', { name: '外壳布局 layout' }).selectOption(scenario.layout)
    await host
      .getByRole('checkbox', { name: /多实例主题隔离/ })
      .evaluate((element) => (element as HTMLElement).click())
    const cards = page.locator('.demo-multi-cell')
    await expect(cards).toHaveCount(2)
    await expect(cards.first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    // Assert element bounds as well as scrollWidth: hiding overflow must not make
    // clipped forms appear to pass. Both independently themed cards remain usable.
    // Captcha dialogs stay mounted while closed, and their controls have no boxes.
    await expect(page.locator('.demo-multi dialog[open]')).toHaveCount(0)
    const bounds = await page
      .locator('.demo-multi-cell, .demo-multi-card, .demo-multi input, .demo-multi button')
      .evaluateAll((elements) =>
        elements
          .filter((element) => !element.closest('dialog:not([open])'))
          .map((element) => {
            const rect = element.getBoundingClientRect()
            return {
              left: rect.left,
              right: rect.right,
              width: rect.width,
              fits: element.scrollWidth <= element.clientWidth + 1,
            }
          }),
      )
    for (const bound of bounds) {
      expect(bound.width).toBeGreaterThan(0)
      expect(bound.left).toBeGreaterThanOrEqual(-1)
      expect(bound.right).toBeLessThanOrEqual(scenario.width + 1)
      expect(bound.fits).toBe(true)
    }
    const positions = await cards.evaluateAll((elements) =>
      elements.map((element) => ({
        left: element.getBoundingClientRect().left,
        top: element.getBoundingClientRect().top,
      })),
    )
    if (scenario.width === 820) {
      expect(positions[1]!.left).toBeGreaterThan(positions[0]!.left)
      expect(positions[1]!.top).toBeCloseTo(positions[0]!.top, 0)
    } else {
      expect(positions[1]!.left).toBeCloseTo(positions[0]!.left, 0)
      expect(positions[1]!.top).toBeGreaterThan(positions[0]!.top)
    }
    for (let index = 0; index < 2; index++) {
      const input = cards.nth(index).getByLabel('邮箱', { exact: true })
      await expect(input).toBeVisible()
      await expect(cards.nth(index).getByLabel('密码', { exact: true })).toBeVisible()
      await input.fill(`instance-${index}@example.test`)
      await expect(input).toHaveValue(`instance-${index}@example.test`)
    }
    await page.getByRole('button', { name: '返回单实例演示' }).click()
    await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
  })
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
]) {
  test(`${viewport.width}px: signed-in embedded pages fit after changing host layout`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await preview(page)
    await page.locator('[data-page="profile"]').click()
    const host = await hostPanel(page)
    await host.getByRole('combobox', { name: '外壳布局 layout' }).selectOption('embedded')
    await host.getByRole('button', { name: '关闭对话框' }).click()
    const withinHost = async () => {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        ),
      ).toBe(true)
      for (const selector of [
        '.demo-single',
        '.nova-demo',
        '[data-layout="embedded"]',
        '[data-nova-account-center]',
        'main',
      ]) {
        const box = await page.locator(selector).evaluate((element) => ({
          width: element.getBoundingClientRect().width,
          left: element.getBoundingClientRect().left,
          right: element.getBoundingClientRect().right,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        }))
        expect(box.width, selector).toBeGreaterThan(0)
        expect(box.left, selector).toBeGreaterThanOrEqual(-1)
        expect(box.right, selector).toBeLessThanOrEqual(viewport.width + 1)
        expect(box.scrollWidth, selector).toBeLessThanOrEqual(box.clientWidth + 1)
      }
    }
    await expect(page.getByRole('heading', { name: '个人资料', exact: true })).toBeVisible()
    await withinHost()
    await page.getByLabel('昵称', { exact: true }).fill('Embedded narrow profile')
    await page.getByRole('button', { name: '保存资料', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: '演示资料已保存' })).toBeVisible()
    for (const tab of [
      'overview',
      'security',
      'devices',
      'notifications',
      'messages',
      'appearance',
      'profile',
    ]) {
      const target = page.locator(`[data-page="${tab}"]`)
      await target.click()
      await expect(target).toHaveAttribute('aria-current', 'page')
      await withinHost()
    }
    await expect(page.getByLabel('昵称', { exact: true })).toHaveValue('Embedded narrow profile')
  })
}
