import { readFile } from 'node:fs/promises'
import type { MetadataRoute } from 'next'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// Indexing policy lives in metadata, never in page content. The builders are pure and the
// pages' own generateMetadata functions run against a freshly migrated test database with
// the request-only helpers stubbed, so the wiring itself is what gets tested.

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, connection: async () => undefined }
})

vi.mock('next/headers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/headers')>()
  return {
    ...actual,
    headers: async () => new Headers({ host: 'gameprobe.test', 'x-forwarded-proto': 'https' }),
  }
})

import { generateMetadata as combinationGenerateMetadata } from '@/app/games/[game]/[controller]/page'
import { generateMetadata as gameGenerateMetadata } from '@/app/games/[game]/page'
import robotsRoute from '@/app/robots'
import { metadata as searchMeta } from '@/app/search/page'
import sitemapRoute from '@/app/sitemap'
import { db } from '@/lib/db'
import {
  buildRobots,
  buildSitemap,
  combinationMetadata,
  gameMetadata,
  indexabilityOverview,
  isIndexableCombination,
  isIndexableGame,
  type IndexabilityOverview,
  ZERO_INDEX_SIGNALS,
} from '@/lib/seo'
import { createTestDb, type TestDb } from './helpers/db'

const ORIGIN = 'https://gameprobe.test'

let testDb: TestDb

beforeAll(async () => {
  testDb = await createTestDb()
  // The page modules reach the database through the same env-driven client the app uses.
  process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${testDb.port}/postgres`
  process.env.DATABASE_POOL_MAX = '1'
})

afterAll(async () => {
  await db().end()
  await testDb.close()
})

const overview = () => indexabilityOverview(testDb.sql, false)

function urls(o: IndexabilityOverview): string[] {
  return buildSitemap(o, ORIGIN).map((e) => e.url)
}

function combination(o: IndexabilityOverview, gameSlug: string, familySlug: string) {
  return [...o.combinations.values()].find(
    (c) => c.gameSlug === gameSlug && c.familySlug === familySlug,
  )
}

const EMPTY_OVERVIEW: IndexabilityOverview = { games: new Map(), combinations: new Map() }

/** `rules` may be one rule or many; tests want one flat list either way. */
function robotRules(
  rules: MetadataRoute.Robots,
): Exclude<MetadataRoute.Robots['rules'], unknown[]>[] {
  const r = rules.rules
  if (!r) return []
  return Array.isArray(r) ? r : [r]
}

describe('robots.txt', () => {
  it('1. the robots route exists and returns crawl rules', async () => {
    expect(typeof robotsRoute).toBe('function')
    const rules = await robotsRoute()
    expect(robotRules(rules).length).toBeGreaterThan(0)
    expect(rules.sitemap).toBe(`${ORIGIN}/sitemap.xml`)
  })

  it('2. public reference pages stay crawlable and no asset path is blocked', () => {
    const rules = buildRobots(ORIGIN)
    const [rule] = robotRules(rules)
    expect(rule?.allow).toBe('/')
    const disallowed = robotRules(rules).flatMap((r) =>
      Array.isArray(r.disallow) ? r.disallow : r.disallow ? [r.disallow] : [],
    )
    expect(disallowed).not.toContain('/')
    expect(disallowed).not.toContain('/games')
    expect(disallowed.some((d) => d.startsWith('/_next'))).toBe(false)
    expect(disallowed.some((d) => d.startsWith('/search'))).toBe(false)
  })

  it('3. internal pages are disallowed while search is only marked noindex', async () => {
    const disallowed = robotRules(buildRobots(ORIGIN)).flatMap((r) =>
      Array.isArray(r.disallow) ? r.disallow : r.disallow ? [r.disallow] : [],
    )
    expect(disallowed).toContain('/admin')
    // /search carries noindex,follow instead: a robots.txt block would also stop its
    // links from being followed, which the search page must keep allowing.
    expect(disallowed.some((d) => d.startsWith('/search'))).toBe(false)
    expect(urls(EMPTY_OVERVIEW).some((u) => u.includes('/search'))).toBe(false)
  })
})

describe('sitemap', () => {
  it('4. the sitemap route renders a URL list starting at the homepage', async () => {
    expect(typeof sitemapRoute).toBe('function')
    const entries = await sitemapRoute()
    expect(entries.length).toBeGreaterThan(2)
    expect(entries[0]?.url).toBe(`${ORIGIN}/`)
    expect(entries[1]?.url).toBe(`${ORIGIN}/about`)
  })

  it('5. game pages with reviewed evidence are included; empty catalog rows are not', async () => {
    const o = await overview()
    const gameUrls = urls(o).filter(
      (u) => u.startsWith(`${ORIGIN}/games/`) && u.slice(`${ORIGIN}/games/`.length).split('/').length === 1,
    )
    expect(gameUrls).toContain(`${ORIGIN}/games/zenless-zone-zero`)
    expect(gameUrls).toContain(`${ORIGIN}/games/wuthering-waves`)
    // A catalog row alone earns no priority: Genshin has no reviewed evidence here.
    expect(gameUrls).not.toContain(`${ORIGIN}/games/genshin-impact`)
    for (const u of gameUrls) {
      const slug = u.slice(`${ORIGIN}/games/`.length)
      const entry = [...o.games.values()].find((g) => g.gameSlug === slug)
      expect(entry && isIndexableGame(entry)).toBe(true)
    }
  })

  it('6. an evidence-backed indexable combination is included', async () => {
    const o = await overview()
    const combo = combination(o, 'zenless-zone-zero', 'sony-dualsense')
    expect(combo).toBeDefined()
    expect(combo && isIndexableCombination(combo)).toBe(true)
    expect((combo?.connections ?? []).length).toBeGreaterThan(0)
    expect(urls(o)).toContain(`${ORIGIN}/games/zenless-zone-zero/sony-dualsense`)
  })

  it('7. a combination with no evidence at all is excluded', async () => {
    const o = await overview()
    expect(combination(o, 'genshin-impact', 'sony-dualsense')).toBeUndefined()
    expect(urls(o)).not.toContain(`${ORIGIN}/games/genshin-impact/sony-dualsense`)
  })

  it('8. a verification-only combination is excluded', async () => {
    // Every needs_direct_test source in the catalog is family-less, so one verification
    // claim is added here to prove the rule against real rows rather than a fixed list.
    await testDb.sql`
      insert into evidence_sources (
        url, url_key, source_type, title, published_on, review_status, is_report, game_id
      )
      select 'https://forum.example.org/fortnite-controller-report',
             'forum.example.org/fortnite-controller-report', 'forum',
             'Fortnite controller report', date '2026-01-05', 'needs_direct_test', true, g.id
      from games g where g.slug = 'fortnite'`
    await testDb.sql`
      insert into evidence_claims (
        source_id, game_id, controller_family_id, control, result, statement, visibility, reported_on
      )
      select s.id, g.id, f.id, 'controller_support', 'works',
             'Needs a direct test before it counts.', 'needs_direct_test', date '2026-01-05'
      from evidence_sources s, games g, controller_families f
      where s.url_key = 'forum.example.org/fortnite-controller-report'
        and g.slug = 'fortnite' and f.slug = 'sony-dualsense'`

    const o = await overview()
    const combo = combination(o, 'fortnite', 'sony-dualsense')
    expect(combo).toBeDefined()
    expect(combo?.verificationClaims).toBeGreaterThan(0)
    expect(combo?.publishedClaims).toBe(0)
    expect(combo?.approvedTests).toBe(0)
    expect(combo && isIndexableCombination(combo)).toBe(false)
    expect(urls(o)).not.toContain(`${ORIGIN}/games/fortnite/sony-dualsense`)
  })

  it('9. a combination whose evidence states no connection is excluded', async () => {
    const o = await overview()
    const combo = combination(o, 'wuthering-waves', 'sony-dualsense')
    expect(combo).toBeDefined()
    expect(combo?.publishedClaims).toBeGreaterThan(0)
    expect((combo?.connections ?? []).length).toBe(0)
    expect(combo && isIndexableCombination(combo)).toBe(false)
    expect(urls(o)).not.toContain(`${ORIGIN}/games/wuthering-waves/sony-dualsense`)
  })
})

describe('page metadata', () => {
  it('10. the search page is noindex,follow', () => {
    expect(searchMeta.robots).toEqual({ index: false, follow: true })
  })

  it('11. an indexable combination page renders index,follow', async () => {
    const meta = await combinationGenerateMetadata({
      params: Promise.resolve({ game: 'zenless-zone-zero', controller: 'sony-dualsense' }),
    })
    expect(meta.robots).toEqual({ index: true, follow: true })
  })

  it('12. a weak combination page renders noindex,follow and keeps its URL', async () => {
    const meta = await combinationGenerateMetadata({
      params: Promise.resolve({ game: 'wuthering-waves', controller: 'sony-dualsense' }),
    })
    expect(meta.robots).toEqual({ index: false, follow: true })
    expect(meta.alternates?.canonical).toBe(
      `${ORIGIN}/games/wuthering-waves/sony-dualsense`,
    )
    // Noindex is not an error state: the page keeps a full title and canonical URL.
    expect(String(meta.title)).toContain('Wuthering Waves')
  })

  it('13. canonical URLs are stable, absolute and path-only', async () => {
    const comboUrl = `${ORIGIN}/games/zenless-zone-zero/sony-dualsense`
    const a = await combinationGenerateMetadata({
      params: Promise.resolve({ game: 'zenless-zone-zero', controller: 'sony-dualsense' }),
    })
    const b = await combinationGenerateMetadata({
      params: Promise.resolve({ game: 'zenless-zone-zero', controller: 'sony-dualsense' }),
    })
    expect(a.alternates?.canonical).toBe(comboUrl)
    expect(a.alternates?.canonical).toBe(b.alternates?.canonical)
    // No connection or filter query is ever canonicalized into a second index page.
    expect(String(a.alternates?.canonical)).not.toContain('?')

    const game = await gameGenerateMetadata({ params: Promise.resolve({ game: 'genshin-impact' }) })
    expect(game.alternates?.canonical).toBe(`${ORIGIN}/games/genshin-impact`)

    // The pure builders produce the same shape without a request.
    const built = gameMetadata({
      origin: ORIGIN,
      game: { name: 'Genshin Impact', slug: 'genshin-impact' },
      signals: ZERO_INDEX_SIGNALS,
    })
    expect(built.alternates?.canonical).toBe(`${ORIGIN}/games/genshin-impact`)
  })

  it('14. game metadata states Android controller intent', async () => {
    const meta = await gameGenerateMetadata({ params: Promise.resolve({ game: 'zenless-zone-zero' }) })
    expect(String(meta.title)).toBe('Zenless Zone Zero Android controller support')
    expect(String(meta.description)).toContain('Zenless Zone Zero')
    expect(String(meta.description)).toContain('Android')
    expect(String(meta.description)).toContain('controller')
    expect(meta.robots).toEqual({ index: true, follow: true })
  })

  it('15. combination metadata names the game, the controller and Android', async () => {
    const meta = await combinationGenerateMetadata({
      params: Promise.resolve({ game: 'zenless-zone-zero', controller: 'sony-dualsense' }),
    })
    const text = `${String(meta.title)} ${String(meta.description)}`
    expect(text).toContain('Zenless Zone Zero')
    expect(text).toContain('DualSense')
    expect(text).toContain('Android')
    expect(text).toContain('controller')
  })
})

describe('regression guard', () => {
  it('23. the indexing layer assumes no production data and no fixed catalog', async () => {
    // An empty database still yields a valid sitemap: the two static entries, nothing else.
    expect(urls(EMPTY_OVERVIEW)).toEqual([`${ORIGIN}/`, `${ORIGIN}/about`])

    // Zero signals are valid input: noindex with an intact canonical, never a crash.
    const meta = combinationMetadata({
      origin: ORIGIN,
      game: { name: 'Any Game', slug: 'any-game' },
      family: { name: 'Any Pad', slug: 'any-pad' },
      signals: ZERO_INDEX_SIGNALS,
    })
    expect(meta.robots).toEqual({ index: false, follow: true })
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/games/any-game/any-pad`)

    // Signals come from the database, not from hardcoded counts.
    const o = await overview()
    const catalog = await testDb.sql<{ n: number }[]>`select count(*)::int as n from games`
    expect(o.games.size).toBe(catalog[0]?.n)

    // The rule module itself carries no game or controller specifics.
    const source = await readFile(new URL('../src/lib/seo.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/genshin|zenless|wuthering|minecraft|dualsense/i)
  })
})
