import { test, expect } from '@playwright/test'

// Guard the browser upgrade against WebKit 326092: resolving a native select
// during a theme update used to cache old inherited styles on its ancestors.
// https://bugs.webkit.org/show_bug.cgi?id=326092
for (const scenario of ['insert', 'hidden', 'visible'] as const) {
  test(`theme inheritance with a native select: ${scenario}`, async ({ page }) => {
    await page.setContent(`
      <style>
        .theme { --surface: #fff; --ink: #23283a; color: var(--ink); }
        .theme[data-theme='dark'] { --surface: #151b28; --ink: #eef0f6; }
        .panel { background: var(--surface); color: var(--ink); }
      </style>
      <div class="theme"><div id="content"></div></div>
    `)
    await page.evaluate((scenario) => {
      const theme = document.querySelector('.theme')!
      const content = document.querySelector<HTMLElement>('#content')!
      const panel = `<section class="panel"><h2>Display</h2>
        <label>Language<select><option>English</option></select></label></section>`
      if (scenario !== 'insert') content.innerHTML = panel
      if (scenario === 'hidden') content.style.display = 'none'
      // Establish the old inherited style, then update the theme and subtree
      // in one task, as framework rendering and storage restoration can do.
      void getComputedStyle(theme).color
      theme.setAttribute('data-theme', 'dark')
      if (scenario === 'insert') content.innerHTML = panel
      if (scenario === 'hidden') content.style.display = ''
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
    }, scenario)
    const styles = await page.locator('.panel').evaluate((panel) => {
      const style = getComputedStyle(panel)
      return {
        surface: style.getPropertyValue('--surface').trim(),
        background: style.backgroundColor,
        color: style.color,
        heading: getComputedStyle(panel.querySelector('h2')!).color,
      }
    })
    expect(styles).toEqual({
      surface: '#151b28',
      background: 'rgb(21, 27, 40)',
      color: 'rgb(238, 240, 246)',
      heading: 'rgb(238, 240, 246)',
    })
  })
}
