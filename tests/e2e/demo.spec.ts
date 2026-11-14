import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function navigate(page: Page, id: string) {
  const mobile = page.locator('[data-mobile-account-nav] select')
  if (await mobile.isVisible()) await mobile.selectOption(id)
  else await page.locator(`[data-page="${id}"]`).click()
}

async function ensureCenter(page: Page) {
  if (!(await page.locator('[data-nova-account-center]').isVisible())) {
    await page.getByRole('button', { name: '用户中心预览', exact: true }).click()
    await expect(page.locator('[data-nova-account-center]')).toBeVisible()
  }
}
async function settings(page: Page) {
  await ensureCenter(page)
  await navigate(page, 'custom:settings')
  await expect(page.locator('[data-demo-settings]')).toBeVisible()
  return page.locator('[data-demo-settings]')
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
  await ensureCenter(page)
  await navigate(page, 'overview')
  await expect(page.getByRole('button', { name: readyLabel, exact: true })).toBeVisible()
}
async function hostPanel(page: Page) {
  await ensureCenter(page)
  await navigate(page, 'custom:integration')
  await expect(page.locator('[data-demo-integration]')).toBeVisible()
  return page.locator('[data-demo-integration]')
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
  await navigate(page, 'profile')
  await page.getByLabel('昵称', { exact: true }).fill('Browser demo')
  await page.getByLabel('个人简介', { exact: true }).fill('Fictional information only')
  await page.getByRole('button', { name: '保存资料', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '演示资料已保存' })).toBeVisible()
  await navigate(page, 'messages')
  await page.getByRole('button', { name: '全部标为已读', exact: true }).click()
  await expect(page.getByRole('button', { name: '未读 0', exact: true })).toBeVisible()
  await navigate(page, 'devices')
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

test('an invalid code sign-in focuses the global error and permits an explicit retry', async ({
  page,
}) => {
  await page.getByRole('tab', { name: '验证码登录', exact: true }).click()
  await page.getByLabel('邮箱', { exact: true }).fill('demo@nova.example')
  await page.getByRole('button', { name: '获取验证码', exact: true }).click()
  await verify(page)
  const code = page.getByLabel('验证码', { exact: true })
  await code.fill('000000')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  const error = page.getByRole('alert').filter({ hasText: '演示验证码为 246810。' })
  await expect(error).toBeFocused()
  await expect(code).toHaveValue('000000')
  await code.fill('246810')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByRole('heading', { name: '账户概览', exact: true })).toBeVisible()
})

test('dirty navigation: native focus containment, Escape, discard, and focus return', async ({
  page,
}) => {
  await preview(page)
  await navigate(page, 'profile')
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
  await navigate(page, 'profile')
  await expect(page.getByLabel('昵称', { exact: true })).toHaveValue('Nova')
})

test('cancel a slow challenge and switch mode without a stale dialog or sign-in', async ({
  page,
}) => {
  const dialog = await settings(page)
  await dialog.getByRole('combobox', { name: '网络响应', exact: true }).selectOption('slow')
  await dialog.getByRole('button', { name: '返回登录页', exact: true }).click()
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
  await dialog.getByRole('button', { name: '返回登录页', exact: true }).click()
  await fillLogin(page)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  const challenge = page.getByRole('dialog', { name: '安全验证', exact: true })
  await challenge.getByRole('slider').press('End')
  await challenge.getByRole('slider').press('Enter')
  await expect(challenge.getByRole('alert').filter({ hasText: /演示验证未通过/ })).toBeVisible()
  await page.keyboard.press('Escape')
  dialog = await settings(page)
  await dialog.getByRole('combobox', { name: '滑块结果', exact: true }).selectOption('normal')
  await dialog.getByRole('button', { name: '返回登录页', exact: true }).click()
  await fillLogin(page)
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
      await navigate(page, tab)
      await withinViewport()
    }
    await page.getByRole('button', { name: '退出登录', exact: true }).click()
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
  await dialog.getByRole('button', { name: '返回登录页', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('Enter a valid email address.', { exact: true })).toBeVisible()
  await preview(page, 'Edit profile')
  await navigate(page, 'appearance')
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
  await expect(page.locator('.nova-demo')).toHaveAttribute('data-accent', 'teal')
  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue('')
})

test('axe: auth, error, register, challenge, account pages, and all 52 appearance previews', async ({
  page,
}, testInfo) => {
  test.slow()
  const scan = async () => {
    // Assess the selected theme after CSS color transitions have settled.
    await page.locator('.nova-demo').evaluate(async (root) => {
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
    await navigate(page, tab)
    await scan()
  }
  for (const mode of ['浅色', '深色']) {
    await chooseRadio(page, mode)
    for (const accent of [
      '默认蓝',
      '医疗青',
      '专业靛',
      '文教紫',
      '零售陶',
      '石墨黑',
      '午夜蓝',
      '松林绿',
      '暖琥珀',
      '深海青',
      '雾岩灰',
      '暮梅紫',
      '摩卡棕',
      '冰川蓝',
      '胭脂红',
      '苔原绿',
      '极夜黑',
      '朱砂红',
      '鎏金黄',
      '翡翠绿',
      '孔雀蓝',
      '霞光紫',
      '工业橙',
      '兰花紫',
      '终端绿',
      '宣纸黄',
    ]) {
      await chooseRadio(page, accent)
      await scan()
      await testInfo.attach(`appearance-${mode}-${accent}`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
    }
    for (const id of [
      'settings',
      'integration',
      'charts',
      'tasks',
      'editor',
      'comments',
      'orders',
      'fields',
      'buttons',
      'dialogs',
      'icons',
    ]) {
      await navigate(page, `custom:${id}`)
      if (id === 'charts') await page.locator('.demo-chart-main .nova-chart svg').waitFor()
      await scan()
    }
    await navigate(page, 'appearance')
  }
  await page.setViewportSize({ width: 390, height: 844 })
  for (const id of [
    'settings',
    'integration',
    'charts',
    'tasks',
    'editor',
    'comments',
    'orders',
    'fields',
    'buttons',
    'dialogs',
    'icons',
  ]) {
    await navigate(page, `custom:${id}`)
    if (id === 'charts') await page.locator('.demo-chart-main .nova-chart svg').waitFor()
    await scan()
  }
  await navigate(page, 'custom:dialogs')
  await page.getByRole('button', { name: '打开示例对话框', exact: true }).click()
  await scan()
  await page
    .getByRole('dialog', { name: '确认保存更改？', exact: true })
    .getByRole('button', { name: '取消', exact: true })
    .click()
})

test('integration page: embedded layout switch and controlled page jumps log pageChange', async ({
  page,
}) => {
  const host = await hostPanel(page)
  await host.getByRole('combobox', { name: '外壳布局 layout' }).selectOption('embedded')
  await expect(page.getByText('虚构宿主站点')).toBeVisible()
  await host.getByRole('button', { name: '安全设置', exact: true }).click()
  await expect(page.getByRole('heading', { name: '账号安全', exact: true })).toBeVisible()
  const reopened = await hostPanel(page)
  await expect(
    reopened
      .locator('[data-event-log] li')
      .filter({ hasText: 'pageChange' })
      .filter({ hasText: '安全设置' }),
  ).toBeVisible()
  await reopened.getByRole('combobox', { name: '外壳布局 layout' }).selectOption('full')
  await expect(page.getByText('虚构宿主站点')).not.toBeVisible()
})

test('session expiry: next account request reports 401 and returns to the auth page', async ({
  page,
}) => {
  await preview(page)
  const host = await hostPanel(page)
  await host.getByRole('button', { name: '让会话过期' }).click()
  await host.getByRole('button', { name: '消息中心', exact: true }).click()
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
  await navigate(page, 'profile')
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
  await settingsDialog.getByRole('button', { name: '返回登录页', exact: true }).click()
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
  await navigate(page, 'security')
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
  await host.getByRole('button', { name: '返回登录页' }).click()
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

test('capability switches: username identifier, trimmed modes and pages, unified event log', async ({
  page,
}) => {
  const host = await hostPanel(page)
  await host.getByRole('combobox', { name: '账号字段 identifier' }).selectOption('username')
  await host
    .getByRole('group', { name: '登录方式裁剪' })
    .getByRole('checkbox', { name: '密码登录' })
    .uncheck()
  await host
    .getByRole('group', { name: '账户页裁剪' })
    .getByRole('checkbox', { name: '登录设备' })
    .uncheck()
  await host.getByRole('button', { name: '返回登录页' }).click()
  // Password login was removed: the form falls back to code sign-in without a tablist.
  await expect(page.getByRole('tablist')).toHaveCount(0)
  await expect(page.getByLabel('账号', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '填入示例', exact: true }).click()
  await expect(page.getByLabel('账号', { exact: true })).toHaveValue('demo')
  await preview(page)
  await expect(page.locator('[data-page="devices"]')).toHaveCount(0)
  await expect(page.locator('[data-page="profile"]')).toBeVisible()
  await navigate(page, 'profile')
  const signedInHost = await hostPanel(page)
  const log = signedInHost.locator('[data-event-log] li')
  await expect(
    log.filter({ hasText: 'pageChange' }).filter({ hasText: '个人资料' }).first(),
  ).toContainText('个人资料')
  await expect(
    log.filter({ hasText: 'update:page' }).filter({ hasText: '个人资料' }).first(),
  ).toContainText('个人资料')
})

test('initialUser restores the shell signed in and records the event', async ({ page }) => {
  const host = await hostPanel(page)
  await host.getByRole('button', { name: '以已验证会话进入（重挂载外壳）' }).click()
  await expect(page.getByRole('heading', { name: '账户概览', exact: true })).toBeVisible()
  await navigate(page, 'profile')
  await expect(page.getByRole('heading', { name: '个人资料', exact: true })).toBeVisible()
  const reopened = await hostPanel(page)
  await expect(
    reopened.locator('[data-event-log] li').filter({ hasText: 'initialUser' }).first(),
  ).toBeVisible()
})

test('messages override and brand prop reshape the auth card and header', async ({ page }) => {
  const host = await hostPanel(page)
  await host.getByRole('checkbox', { name: /注入 messages 文案覆盖/ }).check()
  await host.getByLabel('品牌名 brand', { exact: true }).fill('Acme')
  await host.getByRole('button', { name: '返回登录页' }).click()
  await expect(page.getByRole('heading', { name: '登录你的 Nova 演示账户' })).toBeVisible()
  await expect(page.getByRole('button', { name: '进入演示', exact: true })).toBeVisible()
  await expect(page.locator('header').first()).toContainText('Acme')
})

test('event log records authenticated and logout around a real sign-in', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible()
  const host = await hostPanel(page)
  const log = host.locator('[data-event-log] li')
  await expect(log.filter({ hasText: 'authenticated' }).first()).toContainText('demo@nova.example')
  await expect(log.filter({ hasText: 'logout' }).first()).toBeVisible()
})

async function sceneGallery(page: Page) {
  await preview(page)
  await navigate(page, 'custom:tasks')
  await expect(page.getByRole('heading', { name: '任务清单', exact: true })).toBeVisible()
}

test('scene gallery: component fields and task list add, search and complete', async ({ page }) => {
  await sceneGallery(page)
  await navigate(page, 'custom:fields')
  await expect(page.getByLabel('站点地址', { exact: true })).toBeVisible()
  await expect(page.getByLabel('金额', { exact: true })).toBeVisible()
  await navigate(page, 'custom:tasks')
  await page.getByLabel('新任务', { exact: true }).fill('写周报')
  await page.getByRole('button', { name: '添加', exact: true }).click()
  await expect(page.getByText('进行中 3 · 已完成 1')).toBeVisible()
  await page.getByRole('checkbox', { name: '写周报' }).check()
  await expect(page.getByText('进行中 2 · 已完成 2')).toBeVisible()
  await page.getByLabel('搜索任务', { exact: true }).fill('周报')
  await expect(page.getByText('核对发票')).toHaveCount(0)
  await expect(page.getByText('整理周报提纲')).toBeVisible()
})

test('scene gallery: editor save, comment publish and simulated order payment', async ({
  page,
}) => {
  await sceneGallery(page)
  await navigate(page, 'custom:editor')
  // Editor: fill, save and observe the memory-only status note.
  await page.getByLabel('文章标题', { exact: true }).fill('接入笔记')
  await page.getByLabel('正文', { exact: true }).fill('第一段内容。')
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('已保存《接入笔记》到内存')
  await navigate(page, 'custom:comments')
  // Comments: publish and see the newest-first synthetic thread grow.
  await page.getByLabel('发表评论', { exact: true }).fill('很实用的组合演示')
  await page.getByRole('button', { name: '发布', exact: true }).click()
  await expect(page.getByText('4 条评论')).toBeVisible()
  await navigate(page, 'custom:orders')
  // Orders: filter, open the detail dialog and simulate payment.
  await page.getByRole('button', { name: /待支付/ }).click()
  await expect(page.getByText('NO-2026-0802')).toHaveCount(0)
  await page.getByRole('button', { name: '查看并支付订单 NO-2026-0817' }).click()
  const dialog = page.getByRole('dialog', { name: '订单详情 NO-2026-0817' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('¥228.00')).toBeVisible()
  await dialog.getByRole('button', { name: '模拟支付' }).click()
  await expect(dialog.getByRole('status')).toContainText('模拟支付完成，订单等待发货。')
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  // The only pending order has been paid: the pending filter is now empty.
  await page.getByRole('button', { name: /待支付/ }).click()
  await expect(page.getByText('该状态下暂无订单。')).toBeVisible()
})

test('avatar upload on the profile page and the #profile slot editor', async ({ page }) => {
  await preview(page)
  await navigate(page, 'profile')
  const fileInput = page.locator('input[type="file"]')
  // Client validation rejects non-images and oversize files before reading a data URL.
  await fileInput.setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  })
  await expect(page.locator('main').getByRole('alert')).toContainText('请选择图片文件')
  await fileInput.setInputFiles({
    name: 'oversize.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  })
  await expect(page.locator('main').getByRole('alert')).toContainText('图片不能超过 2097152 字节')
  // A valid image flows through uploadAvatar into the snapshot previews.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  await fileInput.setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('img', { name: '当前头像' }).first()).toBeVisible()
  await page.getByRole('button', { name: '移除头像' }).click()
  await expect(page.getByRole('img', { name: '当前头像' })).toHaveCount(0)
  // The #profile slot replaces the built-in page with the richer host editor.
  const host = await hostPanel(page)
  await host.getByRole('checkbox', { name: /资料页改用 #profile 插槽/ }).check()
  await navigate(page, 'profile')
  await expect(page.getByLabel('展示昵称', { exact: true })).toBeVisible()
  await page.getByLabel('联系电话', { exact: true }).fill('123')
  await page.getByRole('button', { name: '保存资料' }).click()
  await expect(page.getByText('手机号格式应为 1 开头的 11 位数字。')).toBeVisible()
  await page.getByLabel('联系电话', { exact: true }).fill('13900000000')
  await page.getByRole('button', { name: '保存资料' }).click()
  await expect(page.getByText('核心资料已通过适配器保存')).toBeVisible()
  await page.getByLabel('新标签名称', { exact: true }).fill('前端')
  await page.getByRole('button', { name: '添加标签' }).click()
  await expect(page.locator('.demo-scene-tag').filter({ hasText: '前端' })).toBeVisible()
  await page.getByRole('button', { name: '移除标签 前端' }).click()
  await expect(page.locator('.demo-scene-tag').filter({ hasText: '前端' })).toHaveCount(0)
})

test('password changes validate locally, focus the invalid field and recover after correction', async ({
  page,
}) => {
  await preview(page)
  await navigate(page, 'security')
  await page.getByRole('button', { name: '修改', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '修改密码', exact: true })
  const confirm = dialog.getByRole('button', { name: '确认演示操作', exact: true })
  await confirm.click()
  await expect(dialog.getByLabel('当前密码', { exact: true })).toBeFocused()
  await expect(dialog.locator('[aria-invalid="true"]')).toHaveCount(3)
  await dialog.getByLabel('当前密码', { exact: true }).fill('NovaDemo2026!')
  await dialog.getByLabel('新密码', { exact: true }).fill('NovaNext2026!')
  await dialog.getByLabel('确认新密码', { exact: true }).fill('Different2026!')
  await confirm.click()
  await expect(dialog.getByText('两次输入的密码不一致。', { exact: true })).toBeVisible()
  await expect(dialog.getByLabel('确认新密码', { exact: true })).toBeFocused()
  expect((await new AxeBuilder({ page }).include('dialog[open]').analyze()).violations).toEqual([])
  await dialog.getByLabel('确认新密码', { exact: true }).fill('NovaNext2026!')
  await confirm.click()
  await expect(dialog).not.toBeVisible()
})

test('header quick toggle switches light/dark anytime and preserves the accent', async ({
  page,
}) => {
  const shell = page.locator('.nova-demo').first()
  await expect(shell).toHaveAttribute('data-theme', 'light')
  await expect(shell).toHaveAttribute('data-accent', 'blue')
  await page.getByRole('button', { name: '切换深色模式' }).click()
  await expect(shell).toHaveAttribute('data-theme', 'dark')
  await expect(shell).toHaveAttribute('data-accent', 'blue')
  // The choice persists through the storage key and survives a reload.
  await page.reload()
  await expect(shell).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: '切换浅色模式' }).click()
  await expect(shell).toHaveAttribute('data-theme', 'light')
  // The toggle stays reachable in the header while signed in.
  await login(page)
  await page.getByRole('button', { name: '切换深色模式' }).click()
  await expect(shell).toHaveAttribute('data-theme', 'dark')
})

test('rate limiting rejects the second send with remaining seconds', async ({ page }) => {
  const settingsDialog = await settings(page)
  await settingsDialog
    .getByRole('combobox', { name: '发送限流', exact: true })
    .selectOption('limited')
  await settingsDialog.getByRole('button', { name: '返回登录页', exact: true }).click()
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
  await host.getByRole('button', { name: '返回登录页' }).click()
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
  await expect(page.getByRole('heading', { name: '组件接入', exact: true })).toBeVisible()
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

test('multi-instance preview preserves the primary session and task draft', async ({ page }) => {
  await preview(page)
  await navigate(page, 'custom:tasks')
  await page.getByLabel('新任务', { exact: true }).fill('Unsaved primary draft')
  const host = await hostPanel(page)
  await host.getByRole('checkbox', { name: /多实例主题隔离/ }).check()
  await expect(page.getByRole('heading', { name: '实例 A · 深色 / 暖琥珀' })).toBeVisible()
  await page.getByRole('button', { name: '返回单实例演示' }).click()
  await navigate(page, 'custom:tasks')
  await expect(page.getByLabel('新任务', { exact: true })).toHaveValue('Unsaved primary draft')
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
    await expect(page.getByRole('heading', { name: '组件接入', exact: true })).toBeVisible()
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
    await navigate(page, 'profile')
    const host = await hostPanel(page)
    await host.getByRole('combobox', { name: '外壳布局 layout' }).selectOption('embedded')
    await navigate(page, 'profile')
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
      await navigate(page, tab)
      const mobile = page.locator('[data-mobile-account-nav] select')
      if (await mobile.isVisible()) await expect(mobile).toHaveValue(tab)
      else await expect(target).toHaveAttribute('aria-current', 'page')
      await withinHost()
    }
    await expect(page.getByLabel('昵称', { exact: true })).toHaveValue('Embedded narrow profile')
  })
}

test('fullscreen workspaces reflow by available width and preserve task edits', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await preview(page)
  const beside = async (left: string, right: string) => {
    const a = await page.locator(left).boundingBox()
    const b = await page.locator(right).boundingBox()
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()
    expect(b!.x).toBeGreaterThanOrEqual(a!.x + a!.width)
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(2)
  }
  await page.locator('.demo-overview-chart .nova-chart svg').waitFor()
  await beside('.nova-overview-extension', '.nova-overview-activity')
  await navigate(page, 'messages')
  await page.locator('.nova-message-list article button').first().click()
  await expect(page.locator('.nova-message-reader h2')).not.toHaveText('选择一条消息')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await beside('.nova-message-list', '.nova-message-reader')
  await page.getByRole('button', { name: '在弹窗中查看', exact: true }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await navigate(page, 'custom:tasks')
  await beside('.demo-task-workspace > .demo-panel:first-child', '.demo-task-detail')
  await page.getByLabel('任务备注', { exact: true }).fill('周五评审，提前整理附件')
  await navigate(page, 'custom:editor')
  await expect(page.locator('.demo-article-preview')).toBeVisible()
  await beside('.demo-editor-form', '.demo-article-preview')
  await page.setViewportSize({ width: 820, height: 900 })
  await expect(page.locator('.demo-article-preview')).not.toBeVisible()
  await navigate(page, 'custom:tasks')
  await expect(page.getByLabel('任务备注', { exact: true })).toHaveValue('周五评审，提前整理附件')
  const list = await page.locator('.demo-task-workspace > .demo-panel:first-child').boundingBox()
  const detail = await page.locator('.demo-task-detail').boundingBox()
  expect(detail!.y).toBeGreaterThanOrEqual(list!.y + list!.height)
  await navigate(page, 'messages')
  await expect(page.locator('.nova-message-reader')).toHaveCount(0)
  await page.locator('.nova-message-list article button').first().click()
  await expect(page.locator('dialog[open]')).toHaveCount(1)
})

test('icon workspace configures real SVG and remains usable from 320px to 2560px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await preview(page)
  await navigate(page, 'custom:icons')
  await page.getByLabel('搜索图标', { exact: true }).fill('相机')
  await expect(page.locator('.demo-icon-grid > button')).toHaveCount(1)
  await page.getByRole('button', { name: '选择图标 相机 Camera', exact: true }).click()
  await page.getByLabel('尺寸', { exact: true }).selectOption('48')
  await page.getByLabel('线宽', { exact: true }).selectOption('2.5')
  await expect(page.locator('.demo-icon-live svg')).toHaveAttribute('width', '48')
  await expect(page.locator('.demo-icon-live svg')).toHaveAttribute('stroke-width', '2.5')
  await expect(page.getByLabel('图标使用代码')).toContainText(':icon="Camera"')
  await page.getByLabel('用法', { exact: true }).selectOption('lucide')
  await expect(page.getByLabel('图标使用代码')).toContainText("from '@lucide/vue'")
  await page.getByLabel('搜索图标', { exact: true }).fill('')
  for (const width of [2560, 1440, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await expect
      .poll(() =>
        page
          .locator('[data-account-content]')
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      )
      .toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    if (width <= 820) {
      const previewBox = await page.locator('.demo-icon-inspector').boundingBox()
      const catalogBox = await page.locator('.demo-icon-browser').boundingBox()
      expect(previewBox!.y).toBeGreaterThan(catalogBox!.y)
    }
  }
  await page.getByLabel('搜索图标', { exact: true }).fill('不存在的图标')
  await expect(page.getByRole('heading', { name: '没有找到匹配的图标' })).toBeVisible()
  await page.getByRole('button', { name: '清空筛选', exact: true }).click()
  await expect(page.locator('.demo-icon-grid > button')).toHaveCount(55)
})

test('account charts filter, replay, change type and export the displayed records', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await preview(page)
  await page.locator('.demo-overview-chart .nova-chart svg').waitFor()
  await page.getByRole('button', { name: '查看数据演示', exact: true }).click()
  await expect(page.getByRole('heading', { name: '数据概览', exact: true })).toBeVisible()
  await page.locator('.demo-chart-main .nova-chart svg').waitFor()
  await page.getByLabel('图表时间范围').selectOption('30')
  await page.locator('.demo-chart-data summary').click()
  await expect(page.locator('.demo-chart-data tbody tr')).toHaveCount(30)
  await page.getByRole('button', { name: '柱状', exact: true }).click()
  await expect(page.getByRole('button', { name: '柱状', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const first = await page.locator('.demo-chart-data tbody tr').first().textContent()
  await page.getByRole('button', { name: '开始回放', exact: true }).click()
  await expect
    .poll(() => page.locator('.demo-chart-data tbody tr').first().textContent())
    .not.toBe(first)
  await page.getByRole('button', { name: '暂停回放', exact: true }).click()
  const downloadReady = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 CSV', exact: true }).click()
  const download = await downloadReady
  expect(download.suggestedFilename()).toBe('nova-activity-30days.csv')
  await expect(page.locator('.demo-chart-status')).toContainText('已导出当前 30 天的明细')
  await page.getByRole('button', { name: '订单变化', exact: true }).click()
  await expect(page.locator('.demo-chart-data thead')).toContainText('退款订单')
  await page.getByLabel('图表数据状态').selectOption('zero')
  await expect(page.locator('.demo-chart-ring-empty')).toContainText('当前数值均为 0')
  await page.getByLabel('图表数据状态').selectOption('empty')
  await expect(page.getByRole('heading', { name: '当前范围内没有数据' })).toBeVisible()
  await page.getByRole('button', { name: '查看示例数据', exact: true }).click()
  await page.getByRole('button', { name: '开始回放', exact: true }).click()
  await navigate(page, 'profile')
  await navigate(page, 'custom:charts')
  await expect(page.getByRole('button', { name: '开始回放', exact: true })).toBeVisible()
})

test('charts resize with their workspace, remain accessible in dark mode and fit narrow screens', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await preview(page)
  await navigate(page, 'custom:charts')
  await page.locator('.demo-chart-main .nova-chart svg').waitFor()
  await page.getByRole('button', { name: '切换深色模式' }).click()
  await expect(page.locator('.demo-analytics')).toHaveAttribute('data-theme', 'dark')
  for (const width of [2560, 1440, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await expect
      .poll(() =>
        page
          .locator('[data-account-content]')
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      )
      .toBe(true)
    await expect
      .poll(async () => {
        const chart = await page.locator('.demo-chart-main .nova-chart svg').boundingBox()
        const surface = await page.locator('.demo-chart-main .nova-chart').boundingBox()
        return chart && surface ? Math.abs(chart.width - surface.width) < 2 : false
      })
      .toBe(true)
  }
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
  await testInfo.attach('chart-320-dark', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})

test('demo configuration is in account pages and auth examples follow the selected flow', async ({
  page,
}) => {
  await expect(page.getByRole('button', { name: '体验工具', exact: true })).toHaveCount(0)
  const guide = page.getByRole('complementary', { name: '演示填写说明' })
  await expect(guide).toContainText('demo@nova.example')
  await expect(guide).toContainText('NovaDemo2026!')
  await guide.getByRole('button', { name: '填入示例', exact: true }).click()
  await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue('demo@nova.example')
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue('NovaDemo2026!')
  const config = await settings(page)
  await config.getByRole('combobox', { name: '网络响应', exact: true }).selectOption('offline')
  await config.getByRole('button', { name: '返回登录页', exact: true }).click()
  await page.getByRole('button', { name: '用户中心预览', exact: true }).click()
  await expect(page.getByRole('heading', { name: '演示设置', exact: true })).toBeVisible()
  await page
    .locator('[data-demo-settings]')
    .getByRole('button', { name: '恢复正常', exact: true })
    .click()
  const integration = await hostPanel(page)
  await integration.getByRole('combobox', { name: '验证码长度 codeLength' }).selectOption('4')
  await integration.getByRole('button', { name: '返回登录页', exact: true }).click()
  await page.getByRole('button', { name: '注册', exact: true }).click()
  await expect(guide).toContainText('2468')
  await expect(guide).toContainText('先点击获取验证码')
  await guide.getByRole('button', { name: '填入示例', exact: true }).click()
  await expect(page.getByLabel('验证码', { exact: true })).toHaveValue('2468')
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await page.getByRole('button', { name: '← 返回登录', exact: true }).click()
  await page.getByRole('button', { name: '忘记密码？', exact: true }).click()
  await expect(guide).toContainText('2468')
  await expect(guide).not.toContainText('NovaDemo2026!')
})
