import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// Game artwork is for identification, not decoration: every placement renders through the
// same component, provenance is enforced on every real image, and a missing or failed
// asset always degrades to the initials tile instead of a broken image.

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

import CombinationPage, {
  generateMetadata as combinationMetadataFor,
} from '@/app/games/[game]/[controller]/page'
import GamePage, { generateMetadata as gameMetadataFor } from '@/app/games/[game]/page'
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

const licensed = GAME_MEDIA.filter((m) => m.kind === 'licensed-image')
const registrySlugs = GAME_MEDIA.map((m) => m.slug).sort()

describe('game artwork', () => {
  it('1. all 15 catalog slugs exist in the media registry', async () => {
    const games = await testDb.sql<{ slug: string }[]>`select slug from games order by slug`
    expect(games).toHaveLength(15)
    expect(registrySlugs).toEqual(games.map((g) => g.slug))
    expect(new Set(registrySlugs).size).toBe(registrySlugs.length)
  })

  it('2. every licensed-image record carries an image path', () => {
    for (const media of licensed) {
      expect(media.image, `missing image path for ${media.slug}`).toBeTruthy()
      expect(media.alt, `missing alt for ${media.slug}`).toBeTruthy()
    }
  })

  it('3. every licensed-image record carries a source URL', () => {
    for (const media of licensed) {
      expect(media.sourceUrl, `missing sourceUrl for ${media.slug}`).toMatch(/^https:\/\//)
    }
  })

  it('4. every licensed-image record carries a rights note', () => {
    for (const media of licensed) {
      const note = media.rightsNote ?? ''
      expect(note.length, `empty rightsNote for ${media.slug}`).toBeGreaterThan(20)
      expect(note, `rightsNote without access date for ${media.slug}`).toMatch(/20\d\d-\d\d-\d\d/)
    }
  })

  it('5. every recorded image exists as a local file', async () => {
    for (const media of licensed) {
      const file = path.join(process.cwd(), 'public', media.image!)
      const info = await stat(file)
      expect(info.isFile(), `not a file: ${file}`).toBe(true)
      expect(info.size, `empty file: ${file}`).toBeGreaterThan(0)
      // Web is the shipped format, and the file name follows the game slug.
      expect(media.image).toMatch(/^\/games\/[a-z0-9-]+\.webp$/)
    }
  })

  it('6. images are served locally and never hotlinked', () => {
    for (const media of GAME_MEDIA) {
      if (!media.image) continue
      expect(media.image.startsWith('/'), `remote image for ${media.slug}`).toBe(true)
      expect(media.image).not.toMatch(/^https?:/)
      expect(media.image.startsWith('//'), `protocol-relative image for ${media.slug}`).toBe(false)
    }
  })

  it('7. unsupported image metadata falls back safely', () => {
    // Licensed media without a file, or with an empty path, degrades to the tile.
    expect(gameThumbPlan({ slug: 'some-game', kind: 'licensed-image', alt: 'Art' })).toEqual({
      kind: 'tile',
      initials: 'SG',
    })
    expect(
      gameThumbPlan({ slug: 'some-game', kind: 'licensed-image', image: '', alt: 'Art' }),
    ).toEqual({ kind: 'tile', initials: 'SG' })
    // A remote path is malformed for this site and must not be rendered either.
    expect(
      gameThumbPlan({
        slug: 'some-game',
        kind: 'licensed-image',
        image: 'https://cdn.example.com/art.png',
        alt: 'Art',
      }),
    ).toEqual({ kind: 'tile', initials: 'SG' })
  })

  it('8. the homepage renders media for every game row', async () => {
    const html = renderToStaticMarkup(await Home())
    const games = await testDb.sql<{ slug: string }[]>`select slug from games`
    const thumbs = html.match(/data-game-thumb="[^"]+"/g) ?? []
    expect(thumbs).toHaveLength(games.length)
    expect(html).toContain('data-game-thumb="genshin-impact"')
    expect(html).toContain('game-thumb')
    // Every thumb says which kind it rendered, for tests and debugging.
    expect(html).toContain('data-thumb-kind="')
  })

  it('9. search result rows render media beside the name', async () => {
    const html = renderToStaticMarkup(
      await SearchPage({ searchParams: Promise.resolve({ q: 'genshin' }) }),
    )
    expect(html).toContain('data-game-thumb="genshin-impact"')
    expect(html).toContain('game-thumb')
    // The name link itself is never replaced by the media.
    expect(html).toContain('href="/games/genshin-impact"')
  })

  it('10. the game page header renders header-sized media', async () => {
    const html = renderToStaticMarkup(
      await GamePage({ params: Promise.resolve({ game: 'genshin-impact' }) }),
    )
    expect(html).toContain('game-thumb-header')
    expect(html).toContain('data-game-thumb="genshin-impact"')
    expect(html).toContain('<h1>Genshin Impact</h1>')
  })

  it('11. the combination page header renders media', async () => {
    const html = renderToStaticMarkup(
      await CombinationPage({
        params: Promise.resolve({ game: 'zenless-zone-zero', controller: 'sony-dualsense' }),
      }),
    )
    expect(html).toContain('data-game-thumb="zenless-zone-zero"')
    expect(html).toContain('game-thumb')
    expect(html).toContain('DualSense in Zenless Zone Zero')
  })

  it('12. no rendering path produces a broken image', () => {
    // Placeholder paths emit no image element at all.
    const unknown = renderToStaticMarkup(<GameThumb slug="not-in-the-catalog" />)
    expect(unknown).toContain('data-thumb-kind="tile"')
    expect(unknown).not.toContain('<img')
    // Real image paths always carry dimensions and an empty alt, so a failed load
    // never leaves alt text or an unsized image; the client fallback swaps in the tile.
    for (const media of licensed) {
      const html = renderToStaticMarkup(<GameThumb slug={media.slug} />)
      expect(html).toContain('data-thumb-kind="image"')
      expect(html).toMatch(/<img[^>]+alt=""/)
      expect(html).toMatch(/<img[^>]+width="\d+"/)
      expect(html).toMatch(/<img[^>]+height="\d+"/)
      expect(html).toContain('game-thumb-img')
    }
  })

  it('13. dimensions and the stable layout are retained', async () => {
    const css = await readFile(path.join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8')
    expect(css).toMatch(/\.game-thumb\s*\{[^}]*width:\s*48px;[^}]*height:\s*48px;/)
    expect(css).toMatch(/\.game-thumb-header\s*\{[^}]*width:\s*128px;[^}]*height:\s*128px;/)
    expect(css).toMatch(/max-width:\s*720px[\s\S]*?\.game-thumb-header\s*\{[^}]*width:\s*96px;/)
    expect(css).toMatch(/\.game-thumb-img\s*\{[^}]*object-fit:\s*cover;/)
    // The list and header boxes are the only sizes the component can render.
    const html = renderToStaticMarkup(<GameThumb slug="genshin-impact" size="header" />)
    expect(html).toContain('game-thumb game-thumb-header')
  })

  it('14. media wiring does not change indexability metadata', async () => {
    // Same expectations as before images existed: evidence decides, media never does.
    const weak = await gameMetadataFor({ params: Promise.resolve({ game: 'genshin-impact' }) })
    expect(weak.robots).toEqual({ index: false, follow: true })
    const strong = await gameMetadataFor({ params: Promise.resolve({ game: 'zenless-zone-zero' }) })
    expect(strong.robots).toEqual({ index: true, follow: true })
    const combo = await combinationMetadataFor({
      params: Promise.resolve({ game: 'genshin-impact', controller: 'sony-dualsense' }),
    })
    expect(combo.robots).toEqual({ index: false, follow: true })
    // The media registry itself carries no index policy at all.
    expect(JSON.stringify(GAME_MEDIA)).not.toMatch(/noindex|robots/i)
  })

  it('15. placeholder tiles remain a supported state', async () => {
    const placeholders = GAME_MEDIA.filter((m) => m.kind === 'placeholder')
    for (const media of placeholders) {
      const html = renderToStaticMarkup(<GameThumb slug={media.slug} />)
      expect(html).toContain('data-thumb-kind="tile"')
      expect(html).not.toContain('<img')
    }
    // An unknown slug still renders, and every entry keeps its rights note.
    expect(gameMedia('not-in-the-catalog').kind).toBe('placeholder')
    for (const media of GAME_MEDIA) {
      expect(media.rightsNote, `missing rightsNote for ${media.slug}`).toBeTruthy()
    }
  })
})
