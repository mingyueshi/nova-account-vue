import { test, expect, type Page } from '@playwright/test'
import { createAxeBuilder } from './axe'

async function navigate(page: Page, id: string, expectChange = true) {
  const mobile = page.locator('[data-mobile-nav-trigger]')
  if (await mobile.isVisible()) {
    await mobile.click()
    await page.locator(`[data-mobile-page="${id}"]`).click()
  } else await page.locator(`[data-page="${id}"]`).click()
  if (expectChange)
    await expect(page.locator('[data-account-content]')).toHaveAttribute('data-account-page', id)
}
async function signIn(page: Page) {
  await page.getByLabel('邮箱', { exact: true }).fill('demo@demo.com')
  await page.getByLabel('密码', { exact: true }).fill('123456')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  const slider = page.getByRole('slider')
  await expect(slider).toBeEnabled()
  await slider.press('End')
  await slider.press('Enter')
  await expect(page.getByRole('button', { name: '编辑资料', exact: true })).toBeVisible()
}
for (const width of [320, 390, 1440]) {
  test(`consumer center ${width}px: brand, page details and draft save flow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const brand = page.locator('header').first().getByText('nova.', { exact: true })
    for (const mode of ['password', 'register', 'reset']) {
      if (mode === 'register') await page.getByRole('button', { name: '注册', exact: true }).click()
      if (mode === 'reset') {
        await page.getByRole('button', { name: '← 返回登录', exact: true }).click()
        await page.getByRole('button', { name: '忘记密码？', exact: true }).click()
      }
      const box = (await brand.boundingBox())!
      expect(box.x).toBeLessThanOrEqual(36)
      expect(box.y).toBeLessThanOrEqual(32)
    }
    await page.getByRole('button', { name: '← 返回登录', exact: true }).click()
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
    ]) {
      await navigate(page, id)
      await expect(main).not.toContainText(/演示|模拟|虚构|适配器|内存|UTC/, { useInnerText: true })
      expect(await main.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    }
    await navigate(page, 'profile')
    await page.getByLabel('昵称', { exact: true }).fill('我的日常')
    const bar = page.locator('[data-account-savebar]')
    await expect(bar).toContainText('有未保存的修改')
    await bar.getByRole('button', { name: '保存资料', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: '个人资料已保存' })).toBeVisible()
    if (width < 768)
      await expect(
        bar.getByRole('button', { name: '保存资料', exact: true, includeHidden: true }),
      ).not.toBeVisible()
    else await expect(bar.getByRole('button', { name: '保存资料', exact: true })).toBeDisabled()
    await navigate(page, 'notifications')
    const toggle = page.getByRole('switch', { name: '邮件摘要', exact: true })
    await toggle.check()
    await navigate(page, 'messages', false)
    const guard = page.getByRole('dialog', { name: '还有未保存的修改', exact: true })
    await expect(guard).toBeVisible()
    await guard.getByRole('button', { name: '继续编辑', exact: true }).click()
    await expect(toggle).toBeChecked()
    await page.getByRole('button', { name: '保存偏好', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: '通知偏好已保存' })).toBeVisible()
    expect((await createAxeBuilder(page).analyze()).violations).toEqual([])
  })
}
