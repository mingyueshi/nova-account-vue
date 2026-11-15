import { test, expect, type Page, type Locator } from '@playwright/test'
import { createAxeBuilder } from './axe'

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByLabel('邮箱', { exact: true }).fill('demo@demo.com')
  await page.getByLabel('密码', { exact: true }).fill('123456')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  const slider = page.getByRole('slider')
  await expect(slider).toBeEnabled()
  await slider.press('End')
  await slider.press('Enter')
  await expect(page.getByRole('button', { name: '编辑资料', exact: true })).toBeVisible()
}
async function nav(page: Page, id: string, expectChange = true) {
  await page.locator('[data-mobile-nav-trigger]').click()
  await page.locator(`[data-mobile-page="${id}"]`).click()
  if (expectChange)
    await expect(page.locator('[data-account-content]')).toHaveAttribute('data-account-page', id)
}
async function fits(page: Page, dialog: Locator) {
  await expect
    .poll(async () => {
      const box = (await dialog.boundingBox())!
      const height = page.viewportSize()!.height
      return box.y >= 0 && box.y + box.height <= height + 1
    })
    .toBe(true)
  const close = dialog.getByRole('button', { name: '关闭对话框', exact: true })
  await expect(close).toBeInViewport()
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
}
for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
]) {
  test(`phone ${viewport.width}px: grouped navigation preserves drafts and closes without stacked dialogs`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await signIn(page)
    const trigger = page.locator('[data-mobile-nav-trigger]')
    const sheet = page.getByRole('dialog', { name: '全部功能', exact: true })
    await trigger.click()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await fits(page, sheet)
    await expect(sheet.locator('[aria-current="page"]')).toHaveAttribute(
      'data-mobile-page',
      'overview',
    )
    expect(
      // Firefox 2090055: evaluateAll re-runs a composed role selector in the page
      // world after the named dialog was resolved in Playwright's utility world.
      // Keep the named-dialog assertions above; use CSS only for geometry reads.
      await page
        .locator('.nova-navigation-sheet [data-mobile-page]')
        .evaluateAll((els) => els.every((el) => el.getBoundingClientRect().height >= 44)),
    ).toBe(true)
    await expect(sheet.getByRole('button', { name: '退出登录', exact: true })).toBeInViewport()
    expect((await createAxeBuilder(page).analyze()).violations).toEqual([])
    await page.keyboard.press('Escape')
    await expect(sheet).not.toBeVisible()
    await expect(trigger).toBeFocused()
    await trigger.click()
    await page.mouse.click(4, 16)
    await expect(sheet).not.toBeVisible()
    await expect(trigger).toBeFocused()
    await nav(page, 'profile')
    const nickname = page.getByLabel('昵称', { exact: true })
    await nickname.fill('留在手机上的草稿')
    await expect
      .poll(async () => {
        const field = (await nickname.boundingBox())!
        const bar = (await page.locator('[data-account-savebar]').boundingBox())!
        return field.y + field.height <= bar.y - 8
      })
      .toBe(true)
    await nav(page, 'messages', false)
    const guard = page.getByRole('dialog', { name: '还有未保存的修改', exact: true })
    await expect(guard).toBeVisible()
    await expect(page.locator('dialog[open]')).toHaveCount(1)
    await guard.getByRole('button', { name: '继续编辑', exact: true }).click()
    await expect(trigger).toBeFocused()
    await expect(nickname).toHaveValue('留在手机上的草稿')
    await page.getByRole('button', { name: '保存资料', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: '个人资料已保存' })).toBeVisible()
    await expect(page.locator('[data-account-savebar]')).toHaveCSS('position', 'static')
    await expect(
      page.getByRole('button', { name: '保存资料', exact: true, includeHidden: true }),
    ).not.toBeVisible()
    await trigger.click()
    await page.setViewportSize({ width: 1024, height: 768 })
    await expect(sheet).not.toBeVisible()
    await expect(page.locator('[data-account-nav]')).toBeVisible()
  })

  test(`phone ${viewport.width}px: readable controls, profile errors and business form actions`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await signIn(page)
    const main = page.locator('[data-account-content]')
    for (const id of [
      'overview',
      'profile',
      'security',
      'devices',
      'notifications',
      'messages',
      'appearance',
      'custom:tasks',
      'custom:editor',
      'custom:comments',
      'custom:orders',
      'custom:charts',
    ]) {
      await nav(page, id)
      if (id === 'custom:charts') await page.locator('.demo-chart-main .nova-chart svg').waitFor()
      const small = await main
        .locator(
          'input:visible:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]), textarea:visible, select:visible',
        )
        .evaluateAll((els) =>
          els
            .filter((el) => Number.parseFloat(getComputedStyle(el).fontSize) < 16)
            .map((el) => el.outerHTML.slice(0, 120)),
        )
      expect(small).toEqual([])
      expect(await main.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    }
    await nav(page, 'profile')
    const nickname = page.getByLabel('昵称', { exact: true })
    await nickname.fill('   ')
    await page.getByRole('button', { name: '保存资料', exact: true }).click()
    await expect(nickname).toBeFocused()
    await expect(nickname).toBeInViewport({ ratio: 1 })
    await expect
      .poll(async () => {
        const field = (await nickname.boundingBox())!
        const bar = (await page.locator('[data-account-savebar]').boundingBox())!
        return field.y + field.height <= bar.y - 8
      })
      .toBe(true)
    await expect(page.getByRole('alert')).toContainText('请输入昵称')
    await nickname.fill('手机上的日常')
    await page.getByRole('button', { name: '保存资料', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: '个人资料已保存' })).toBeVisible()
    await expect(page.locator('[data-account-savebar] [role=status]')).toBeFocused()
    await nav(page, 'custom:editor')
    await page.getByLabel('文章标题', { exact: true }).fill('周末计划')
    await page.getByLabel('正文', { exact: true }).fill('去公园走走，读完一本书。')
    await page.getByRole('button', { name: '保存草稿', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('草稿《周末计划》已保存')
    await expect(page.getByRole('status')).toBeFocused()
    await nav(page, 'custom:comments')
    await page.getByLabel('发表评论', { exact: true }).fill('今天也要记录一点小小的进步。')
    await page.getByRole('button', { name: '发布', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('评论已发布')
    await expect(page.getByRole('status')).toBeFocused()
    expect((await createAxeBuilder(page).analyze()).violations).toEqual([])
  })

  test(`phone ${viewport.width}px: short dialogs keep actions visible and restore focus`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await signIn(page)
    await nav(page, 'security')
    const edit = page.getByRole('button', { name: '修改', exact: true })
    await edit.focus()
    await edit.click()
    let dialog = page.getByRole('dialog')
    await page.setViewportSize({ width: viewport.width, height: 360 })
    await fits(page, dialog)
    const confirm = dialog.getByRole('button', { name: '确认', exact: true })
    await expect(confirm).toBeInViewport()
    await confirm.click()
    await expect(dialog.getByLabel('当前密码', { exact: true })).toBeFocused()
    await dialog.getByLabel('当前密码', { exact: true }).fill('wrong')
    await dialog.getByLabel('新密码', { exact: true }).fill('654321')
    await dialog.getByLabel('确认新密码', { exact: true }).fill('654321')
    await confirm.click()
    await expect(dialog.getByRole('alert')).toContainText('当前密码不正确')
    await expect(dialog.getByRole('alert')).toBeFocused()
    await expect(dialog.getByRole('alert')).toBeInViewport()
    await expect(confirm).toBeInViewport()
    await dialog.getByLabel('当前密码', { exact: true }).fill('123456')
    await confirm.click()
    await expect(dialog).not.toBeVisible()
    await expect(edit).toBeFocused()
    await page.setViewportSize(viewport)
    const change = page.getByRole('button', { name: '更换', exact: true })
    await change.focus()
    await change.click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('当前密码', { exact: true }).fill('654321')
    await dialog.getByLabel('新邮箱', { exact: true }).fill('next@demo.com')
    await page.setViewportSize({ width: viewport.width, height: 360 })
    await expect
      .poll(async () => {
        const input = (await dialog.getByLabel('新邮箱', { exact: true }).boundingBox())!
        const body = (await dialog.locator('.nova-dialog-body').boundingBox())!
        return input.y >= body.y && input.y + input.height <= body.y + body.height
      })
      .toBe(true)
    await dialog.getByRole('button', { name: '获取验证码', exact: true }).click()
    const code = dialog.getByLabel('邮箱验证码', { exact: true })
    await expect(code).toBeEnabled()
    await expect(code).toBeFocused()
    await fits(page, dialog)
    await expect(dialog.getByRole('button', { name: '确认', exact: true })).toBeInViewport()
    await code.fill('123456')
    expect((await createAxeBuilder(page).analyze()).violations).toEqual([])
    await dialog.getByRole('button', { name: '确认', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(change).toBeFocused()
    await page.setViewportSize(viewport)
    await nav(page, 'messages')
    const message = page.locator('[data-message-open]').first()
    await message.focus()
    await message.click()
    dialog = page.getByRole('dialog')
    await fits(page, dialog)
    await dialog.getByRole('button', { name: '关闭对话框', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(message).toBeFocused()
    await nav(page, 'custom:orders')
    const orderAction = page.getByRole('button', { name: /^查看并支付订单 / })
    await orderAction.click()
    dialog = page.getByRole('dialog')
    await page.setViewportSize({ width: viewport.width, height: 360 })
    await fits(page, dialog)
    await expect(dialog.getByRole('button', { name: '确认支付', exact: true })).toBeInViewport()
    const body = dialog.locator('.nova-dialog-body')
    const background = page.locator('[data-account-content]')
    const scrollBefore = await background.evaluate((el) => el.scrollTop)
    await body.hover()
    await page.mouse.wheel(0, 1500)
    await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    await page.mouse.wheel(0, 1500)
    await expect(dialog.getByRole('button', { name: '关闭对话框', exact: true })).toBeInViewport()
    await expect(dialog.getByRole('button', { name: '确认支付', exact: true })).toBeInViewport()
    expect(await background.evaluate((el) => el.scrollTop)).toBe(scrollBefore)
    await dialog.getByRole('button', { name: '关闭', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(orderAction).toBeFocused()
  })
}
