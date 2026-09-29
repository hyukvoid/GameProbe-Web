import { expect, test } from '@playwright/test'

// Every public page must fit a phone screen without horizontal scrolling.
for (const path of [
  '/',
  '/games/wuthering-waves',
  '/games/wuthering-waves/8bitdo-ultimate-2',
  // Thumbnail pages: the header tile must not widen the layout on a phone.
  '/games/genshin-impact',
  '/games/zenless-zone-zero/sony-dualsense',
  '/submit',
  '/search?q=8bitdo',
  '/search?q=Genshin%20DualSense',
  '/search?q=Wuthering%20Waves%20DualSense',
  '/search?q=DualSense',
  '/about',
]) {
  test(`no horizontal overflow on ${path}`, async ({ page }) => {
    await page.goto(path)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
}
