import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// Game imagery is for identification, not decoration: every placement renders a tile
// (or a rights-cleared image later) through the same component, and a missing asset
// always degrades to the tile instead of a broken image.

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, connection: async () => undefined }
})

import GamePage from '@/app/games/[game]/page'
import Home from '@/app/page'
import SearchPage from '@/app/search/page'
import { GameThumb } from '@/components/game-thumb'
import { db } from '@/lib/db'
import { GAME_MEDIA, gameMedia, gameThumbPlan } from '@/lib/game-media'
import { createTestDb, type TestDb } from './helpers/db'

let testDb: TestDb

beforeAll(async () => {
  testDb = await createTestDb()
  process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${testDb.port}/postgres`
  process.env.DATABASE_POOL_MAX = '1'
})

afterAll(async () => {
  await db().end()
  await testDb.close()
})

describe('game image UI', () => {
  it('16. the homepage game list renders an image or fallback for every game row', async () => {
    const html = renderToStaticMarkup(await Home())
    const games = await testDb.sql<{ slug: string }[]>`select slug from games`
    const tiles = html.match(/data-game-thumb="[^"]+"/g) ?? []
    expect(tiles).toHaveLength(games.length)
    expect(html).toContain('data-game-thumb="genshin-impact"')
    expect(html).toContain('game-thumb')
  })

  it('17. search result game rows render an image or fallback', async () => {
    const html = renderToStaticMarkup(
      await SearchPage({ searchParams: Promise.resolve({ q: 'genshin' }) }),
    )
    expect(html).toContain('data-game-thumb="genshin-impact"')
    expect(html).toContain('game-thumb')
    // The tile sits beside the game name; the name itself is never replaced by it.
    expect(html).toContain('href="/games/genshin-impact"')
  })

  it('18. the game page header renders a header-sized image or fallback', async () => {
    const html = renderToStaticMarkup(
      await GamePage({ params: Promise.resolve({ game: 'genshin-impact' }) }),
    )
    expect(html).toContain('game-thumb-header')
    expect(html).toContain('data-game-thumb="genshin-impact"')
    expect(html).toContain('<h1>Genshin Impact</h1>')
  })

  it('19. a missing asset does not break rendering', () => {
    // Licensed media without a file, or with an empty path, degrades to the tile.
    expect(gameThumbPlan({ slug: 'some-game', kind: 'licensed-image', alt: 'Art' })).toEqual({
      kind: 'tile',
      initials: 'SG',
    })
    expect(
      gameThumbPlan({ slug: 'some-game', kind: 'licensed-image', image: '', alt: 'Art' }),
    ).toEqual({ kind: 'tile', initials: 'SG' })
    // A slug with no media entry at all still renders, and never emits a broken <img>.
    expect(gameMedia('not-in-the-catalog').kind).toBe('placeholder')
    const html = renderToStaticMarkup(<GameThumb slug="not-in-the-catalog" />)
    expect(html).toContain('game-thumb')
    expect(html).not.toContain('<img')
  })

  it('20. all 15 current games have media metadata and render a tile', async () => {
    const games = await testDb.sql<{ slug: string }[]>`select slug from games order by slug`
    expect(games).toHaveLength(15)
    for (const { slug } of games) {
      const media = GAME_MEDIA.find((m) => m.slug === slug)
      expect(media, `missing media metadata for ${slug}`).toBeDefined()
      expect(media?.alt).toBeDefined()
      const plan = gameThumbPlan(gameMedia(slug))
      expect(plan.kind === 'tile' ? plan.initials.length : plan.src.length).toBeGreaterThan(0)
      expect(renderToStaticMarkup(<GameThumb slug={slug} />)).toContain(
        `data-game-thumb="${slug}"`,
      )
    }
  })
})
