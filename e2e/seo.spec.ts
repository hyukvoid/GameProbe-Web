import { expect, test } from '@playwright/test'

// Search discovery as served: robots.txt and sitemap.xml answer 200 with only the right
// URLs, index policy appears solely in metadata (never in page text), canonicals are the
// plain paths, and game identification tiles render in every placement without a broken
// image. Indexability follows the database, so only stable combinations are asserted.

test('robots.txt allows public crawling and disallows the admin area', async ({ request }) => {
  const res = await request.get('/robots.txt')
  expect(res.status()).toBe(200)
  const body = await res.text()
  expect(body).toMatch(/user-agent:\s*\*/i)
  expect(body).toMatch(/allow:\s*\//i)
  expect(body).toMatch(/disallow:\s*\/admin/i)
  // /search must stay crawlable: its pages carry noindex,follow so their links keep working.
  expect(body).not.toMatch(/disallow:\s*\/search/i)
  expect(body).not.toMatch(/disallow:\s*\/_next/i)
  expect(body).toMatch(/sitemap:\s*http:\/\/127\.0\.0\.1:3210\/sitemap\.xml/i)
})

test('sitemap.xml lists indexable pages only', async ({ request }) => {
  const res = await request.get('/sitemap.xml')
  expect(res.status()).toBe(200)
  const xml = await res.text()
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

  expect(locs).toContain('http://127.0.0.1:3210/')
  expect(locs).toContain('http://127.0.0.1:3210/games/zenless-zone-zero')
  expect(locs).toContain('http://127.0.0.1:3210/games/zenless-zone-zero/sony-dualsense')
  // No search URLs, no empty combinations, no verification-only or connection-unstated ones.
  expect(locs.some((u) => u.includes('/search'))).toBe(false)
  expect(locs).not.toContain('http://127.0.0.1:3210/games/genshin-impact')
  expect(locs).not.toContain('http://127.0.0.1:3210/games/genshin-impact/sony-dualsense')
  expect(locs).not.toContain('http://127.0.0.1:3210/games/wuthering-waves/sony-dualsense')
  // Evidence-backed pages only: far below a 15-games x 8-controllers product.
  expect(locs.length).toBeLessThan(40)
})

test('search results are noindex,follow and stay reachable for people', async ({ page }) => {
  const response = await page.goto('/search?q=genshin')
  expect(response?.status()).toBe(200)
  const robots = await page.locator('meta[name="robots"]').getAttribute('content')
  expect(robots?.replace(/\s/g, '')).toContain('noindex')
  expect(robots?.replace(/\s/g, '')).toContain('follow')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Results for')
  // The policy lives in metadata only; no SEO jargon leaks into the page.
  await expect(page.locator('body')).not.toContainText(/noindex|SEO unavailable/i)
})

test('an indexable combination page renders index,follow with a stable canonical', async ({ page }) => {
  await page.goto('/games/zenless-zone-zero/sony-dualsense')
  const robots = await page.locator('meta[name="robots"]').getAttribute('content')
  expect(robots?.replace(/\s/g, '')).toContain('index')
  expect(robots?.replace(/\s/g, '')).not.toContain('noindex')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'http://127.0.0.1:3210/games/zenless-zone-zero/sony-dualsense',
  )
  await expect(page).toHaveTitle(/Zenless Zone Zero DualSense Android controller support · GameProbe/)
})

test('a weak combination page answers 200 with noindex and the same canonical path', async ({ page }) => {
  const response = await page.goto('/games/wuthering-waves/sony-dualsense')
  // Noindex is metadata, never a 404: the page stays usable and linked.
  expect(response?.status()).toBe(200)
  const robots = await page.locator('meta[name="robots"]').getAttribute('content')
  expect(robots?.replace(/\s/g, '')).toContain('noindex')
  expect(robots?.replace(/\s/g, '')).toContain('follow')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'http://127.0.0.1:3210/games/wuthering-waves/sony-dualsense',
  )
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Wuthering Waves')
})

test('game page metadata carries Android controller intent', async ({ page }) => {
  await page.goto('/games/zenless-zone-zero')
  await expect(page).toHaveTitle(/Zenless Zone Zero Android controller support · GameProbe/)
  const description = await page.locator('meta[name="description"]').getAttribute('content')
  expect(description).toContain('Zenless Zone Zero')
  expect(description).toContain('Android')
  expect(description).toContain('controller')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'http://127.0.0.1:3210/games/zenless-zone-zero',
  )
})

test('the homepage game list shows a tile for every game row', async ({ page }) => {
  await page.goto('/')
  const gamesTable = page.locator('section[aria-labelledby="games-heading"] table.stack')
  const rows = gamesTable.locator('tbody tr')
  const count = await rows.count()
  expect(count).toBeGreaterThan(0)
  await expect(gamesTable.locator('tbody tr [data-game-thumb]')).toHaveCount(count)
  // Tiles are additive: the game links stay the content of every row.
  await expect(
    gamesTable.getByRole('link', { name: 'Zenless Zone Zero', exact: true }),
  ).toBeVisible()
})

test('search result game rows show a tile beside the name', async ({ page }) => {
  await page.goto('/search?q=genshin')
  const games = page.locator('section[aria-labelledby="games-heading"] li')
  expect(await games.count()).toBeGreaterThan(0)
  await expect(page.locator('section[aria-labelledby="games-heading"] li [data-game-thumb]').first()).toBeVisible()
})

test('the game page header shows a header-sized tile', async ({ page }) => {
  await page.goto('/games/genshin-impact')
  await expect(page.locator('.game-thumb-header[data-game-thumb="genshin-impact"]')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Genshin Impact' })).toBeVisible()
})

test('no page shows a broken image', async ({ page }) => {
  for (const path of ['/', '/search?q=dualsense', '/games/genshin-impact', '/games/zenless-zone-zero/sony-dualsense']) {
    await page.goto(path)
    const broken = await page.evaluate(
      () => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).length,
    )
    expect(broken, `broken images on ${path}`).toBe(0)
  }
})
