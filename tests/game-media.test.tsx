import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// Two asset roles, never interchangeable: a small logo identifier (list rows and page
// headers) and one large artwork image (game-page header only). Provenance is enforced
// per asset, artwork is never inferred from a logo, and a failure always removes media
// without a broken image, a fake hero, or an empty shell.

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

// Test hook: while true, every useState call reports the post-error state, so the
// "failed load removes the region" branch of GameArtwork is assertable without a DOM.
let simulateArtworkFailure = false
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  const passthrough = actual.useState as (initial?: unknown) => unknown
  const useState = ((initial?: unknown) =>
    simulateArtworkFailure ? [true, () => {}] : passthrough(initial)) as typeof actual.useState
  return { ...actual, useState }
})

import AboutPage from '@/app/about/page'
import CombinationPage, {
  generateMetadata as combinationMetadataFor,
} from '@/app/games/[game]/[controller]/page'
import GamePage, { generateMetadata as gameMetadataFor } from '@/app/games/[game]/page'
import Home from '@/app/page'
import SearchPage from '@/app/search/page'
import { GameArtwork } from '@/components/game-artwork'
import { GameThumb } from '@/components/game-thumb'
import { db } from '@/lib/db'
import {
  ARTWORK_HEIGHT,
  ARTWORK_WIDTH,
  GAME_MEDIA,
  gameArtworkPlan,
  gameThumbPlan,
} from '@/lib/game-media'
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

const logos = GAME_MEDIA.filter((m) => m.logo)
const artworks = GAME_MEDIA.filter((m) => m.artwork)
const registrySlugs = GAME_MEDIA.map((m) => m.slug).sort()

/** Every src recorded anywhere in the registry: logo and artwork alike. */
function allAssetSrcs(): string[] {
  return GAME_MEDIA.flatMap((m) => [m.logo?.src, m.artwork?.src]).filter((s): s is string => !!s)
}

describe('game media: two-asset model', () => {
  it('1. the model distinguishes logo from artwork and covers all 15 catalog games', async () => {
    const games = await testDb.sql<{ slug: string }[]>`select slug from games order by slug`
    expect(games).toHaveLength(15)
    expect(registrySlugs).toEqual(games.map((g) => g.slug))
    expect(new Set(registrySlugs).size).toBe(registrySlugs.length)
    // The two roles are separate optional fields with their own provenance records.
    for (const media of GAME_MEDIA) {
      if (media.logo) expect(media.logo, `bad logo asset for ${media.slug}`).toMatchObject({
        src: expect.any(String),
        alt: expect.any(String),
        sourceUrl: expect.any(String),
        rightsNote: expect.any(String),
      })
      if (media.artwork) expect(media.artwork, `bad artwork asset for ${media.slug}`).toMatchObject({
        src: expect.any(String),
        alt: expect.any(String),
        sourceUrl: expect.any(String),
        rightsNote: expect.any(String),
      })
      // An entry can never smuggle one asset into both roles.
      if (media.logo && media.artwork) {
        expect(media.artwork).not.toBe(media.logo)
        expect(media.artwork.src).not.toBe(media.logo.src)
      }
      // A game without an image documents why, instead of being silently blank.
      if (!media.logo) expect(media.placeholderNote, `missing placeholderNote for ${media.slug}`).toBeTruthy()
    }
    // The ambiguous "one image per game" shape is gone for good.
    expect(GAME_MEDIA).not.toContainEqual(expect.objectContaining({ image: expect.anything() }))
    expect(GAME_MEDIA).not.toContainEqual(expect.objectContaining({ kind: expect.anything() }))
  })

  it('2. the nine accepted logos still render in their fixed boxes', async () => {
    const expected = new Set([
      'alien-isolation',
      'brawlhalla',
      'call-of-duty-mobile',
      'dead-cells',
      'diablo-immortal',
      'genshin-impact',
      'minecraft',
      'wuthering-waves',
      'zenless-zone-zero',
    ])
    expect(new Set(logos.map((m) => m.slug))).toEqual(expected)
    for (const media of logos) {
      const plan = gameThumbPlan(media)
      expect(plan, `logo no longer renders for ${media.slug}`).toMatchObject({ kind: 'image' })
      const html = renderToStaticMarkup(<GameThumb slug={media.slug} />)
      expect(html).toContain('data-thumb-kind="image"')
      expect(html).toContain(`data-game-thumb="${media.slug}"`)
      expect(html).toMatch(/<img[^>]+width="\d+"/)
      expect(html).toMatch(/<img[^>]+height="\d+"/)
    }
    // Games without a logo keep the placeholder tile: a finished state, no <img> at all.
    for (const media of GAME_MEDIA.filter((m) => !m.logo)) {
      const html = renderToStaticMarkup(<GameThumb slug={media.slug} />)
      expect(html).toContain('data-thumb-kind="tile"')
      expect(html).not.toContain('<img')
    }
    expect(renderToStaticMarkup(<GameThumb slug="not-in-the-catalog" />)).toContain('data-thumb-kind="tile"')
    // The boxes themselves are unchanged CSS: 48px rows, 128px header (96px on small).
    const css = await readFile(path.join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8')
    expect(css).toMatch(/\.game-thumb\s*\{[^}]*width:\s*48px;[^}]*height:\s*48px;/)
    expect(css).toMatch(/\.game-thumb-header\s*\{[^}]*width:\s*128px;[^}]*height:\s*128px;/)
    expect(css).toMatch(/max-width:\s*720px[\s\S]*?\.game-thumb-header\s*\{[^}]*width:\s*96px;/)
    expect(css).toMatch(/\.game-thumb-img\s*\{[^}]*object-fit:\s*cover;/)
    expect(renderToStaticMarkup(<GameThumb slug="genshin-impact" size="header" />)).toContain(
      'game-thumb game-thumb-header',
    )
  })

  it('3. artwork is never inferred from a logo path', () => {
    const logoOnly = {
      slug: 'some-game',
      logo: {
        src: '/games/some-game.webp',
        alt: 'Some Game',
        sourceUrl: 'https://example.com/press',
        rightsNote: 'Test asset for the logo-only case. Accessed 2026-09-29.',
      },
    }
    // A logo alone never produces artwork, however valid the logo is.
    expect(gameArtworkPlan(logoOnly)).toBeNull()
    expect(gameThumbPlan(logoOnly)).toMatchObject({ kind: 'image' })
    // Missing, empty, remote or alt-less artwork all refuse to render.
    expect(gameArtworkPlan({ slug: 'x', artwork: { src: '', alt: 'A', sourceUrl: 'https://e.com', rightsNote: 'n' } })).toBeNull()
    expect(
      gameArtworkPlan({ slug: 'x', artwork: { src: 'https://cdn.example.com/a.webp', alt: 'A', sourceUrl: 'https://e.com', rightsNote: 'n' } }),
    ).toBeNull()
    expect(gameArtworkPlan({ slug: 'x', artwork: { src: '/games/x/artwork.webp', alt: '', sourceUrl: 'https://e.com', rightsNote: 'n' } })).toBeNull()
    expect(gameArtworkPlan({ slug: 'unknown' })).toBeNull()
    // A logo path is also never reachable as artwork in the shipped registry.
    const logoSrcs = new Set(logos.map((m) => m.logo!.src))
    for (const media of artworks) expect(logoSrcs.has(media.artwork!.src)).toBe(false)
  })

  it('4. GameArtwork renders when an approved artwork exists', () => {
    expect(artworks.length, 'no artwork entries shipped').toBeGreaterThan(0)
    for (const media of artworks) {
      const html = renderToStaticMarkup(<GameArtwork slug={media.slug} />)
      expect(html, `artwork region missing for ${media.slug}`).toContain(`data-game-artwork="${media.slug}"`)
      // The asset flows through the local optimizer: the registry path appears encoded
      // in the local src/srcSet, never as a remote URL.
      expect(html).toContain(encodeURIComponent(media.artwork!.src))
      expect(html).toContain(`alt="${media.artwork!.alt}"`)
      expect(html).toContain(`width="${ARTWORK_WIDTH}"`)
      expect(html).toContain(`height="${ARTWORK_HEIGHT}"`)
      expect(html).toContain('game-artwork-img')
    }
  })

  it('5. GameArtwork renders nothing when artwork is absent', () => {
    for (const media of GAME_MEDIA.filter((m) => !m.artwork)) {
      const html = renderToStaticMarkup(<GameArtwork slug={media.slug} />)
      expect(html, `unexpected artwork shell for ${media.slug}`).toBe('')
      expect(html).not.toContain('game-artwork')
    }
    // Unknown slugs and logo-only media never summon artwork either.
    expect(renderToStaticMarkup(<GameArtwork slug="not-in-the-catalog" />)).toBe('')
  })

  it('6. GameArtwork disappears cleanly on a failed load', () => {
    expect(renderToStaticMarkup(<GameArtwork slug={artworks[0]?.slug ?? 'x'} />)).toContain('data-game-artwork=')
    // After an image error the component returns null: the region unmounts entirely,
    // leaving no <img>, no broken icon, and no oversized substitute behind.
    simulateArtworkFailure = true
    try {
      for (const media of artworks) {
        const html = renderToStaticMarkup(<GameArtwork slug={media.slug} />)
        expect(html).toBe('')
        expect(html).not.toContain('<img')
      }
    } finally {
      simulateArtworkFailure = false
    }
  })
})

describe('game page header', () => {
  it('7. a game page with artwork contains logo + title + artwork', async () => {
    const media = artworks[0]
    expect(media, 'no artwork entry shipped').toBeTruthy()
    const row = (await testDb.sql<{ name: string }[]>`select name from games where slug = ${media!.slug}`)[0]
    const html = renderToStaticMarkup(await GamePage({ params: Promise.resolve({ game: media!.slug }) }))
    expect(html).toContain('<h1>')
    expect(html).toContain(row.name)
    expect(html).toContain(`data-game-thumb="${media!.slug}"`)
    expect(html).toContain(`data-game-artwork="${media!.slug}"`)
    // Title block and artwork sit in the same header grid; text is a sibling, not on top.
    expect(html).toContain('game-head')
    expect(html).toContain('game-head-text')
  })

  it('8. a game page without artwork has no empty artwork shell', async () => {
    const media = GAME_MEDIA.find((m) => !m.artwork)
    expect(media, 'every game has artwork; the no-artwork layout is untested').toBeTruthy()
    const row = (await testDb.sql<{ name: string }[]>`select name from games where slug = ${media!.slug}`)[0]
    const html = renderToStaticMarkup(await GamePage({ params: Promise.resolve({ game: media!.slug }) }))
    expect(html).toContain(`<h1>${row.name}</h1>`)
    expect(html).toContain(`data-game-thumb="${media!.slug}"`)
    // No shell, no empty region, no placeholder hero of any kind.
    expect(html).not.toContain('data-game-artwork=')
    expect(html).not.toContain('game-artwork')
    expect(html).not.toMatch(/<img[^>]+game-artwork/)
  })
})

describe('artwork placement', () => {
  it('9. the homepage shows logos only, never artwork', async () => {
    const html = renderToStaticMarkup(await Home())
    const games = await testDb.sql<{ slug: string }[]>`select slug from games`
    const thumbs = html.match(/data-game-thumb="[^"]+"/g) ?? []
    expect(thumbs).toHaveLength(games.length)
    expect(html).toContain('data-game-thumb="genshin-impact"')
    expect(html).not.toContain('data-game-artwork=')
    expect(html).not.toContain('game-artwork')
  })

  it('10. search results show logos only, never artwork', async () => {
    const html = renderToStaticMarkup(
      await SearchPage({ searchParams: Promise.resolve({ q: 'genshin' }) }),
    )
    expect(html).toContain('data-game-thumb="genshin-impact"')
    expect(html).toContain('href="/games/genshin-impact"')
    expect(html).not.toContain('data-game-artwork=')
    expect(html).not.toContain('game-artwork')
  })

  it('11. the combination page shows logos only, never artwork', async () => {
    const html = renderToStaticMarkup(
      await CombinationPage({
        params: Promise.resolve({ game: 'zenless-zone-zero', controller: 'sony-dualsense' }),
      }),
    )
    expect(html).toContain('data-game-thumb="zenless-zone-zero"')
    expect(html).toContain('DualSense in Zenless Zone Zero')
    expect(html).not.toContain('data-game-artwork=')
    expect(html).not.toContain('game-artwork')
  })
})

describe('artwork provenance and files', () => {
  it('12. every artwork carries a local path, source URL and rights note', () => {
    expect(artworks.length).toBeGreaterThan(0)
    for (const media of artworks) {
      const art = media.artwork!
      expect(art.src, `bad artwork path for ${media.slug}`).toMatch(/^\/games\/[a-z0-9-]+\/artwork\.webp$/)
      expect(art.sourceUrl, `missing sourceUrl for ${media.slug}`).toMatch(/^https:\/\//)
      expect(art.rightsNote.length, `empty rightsNote for ${media.slug}`).toBeGreaterThan(20)
      expect(art.rightsNote, `rightsNote without access date for ${media.slug}`).toMatch(/20\d\d-\d\d-\d\d/)
      expect(art.alt, `missing alt for ${media.slug}`).toBeTruthy()
    }
    // Artwork provenance never leans on the logo's record.
    for (const media of artworks) {
      const logo = GAME_MEDIA.find((m) => m.slug === media.slug)?.logo
      if (logo) expect(media.artwork!.rightsNote).not.toBe(logo.rightsNote)
    }
  })

  it('13. every artwork file exists locally at the recorded size', async () => {
    const sharp = (await import('sharp')).default
    expect(artworks.length).toBeGreaterThan(0)
    for (const media of artworks) {
      const file = path.join(process.cwd(), 'public', media.artwork!.src)
      const info = await stat(file)
      expect(info.isFile(), `not a file: ${file}`).toBe(true)
      expect(info.size, `empty file: ${file}`).toBeGreaterThan(0)
      expect(info.size, `oversized artwork: ${file}`).toBeLessThan(180_000)
      const meta = await sharp(file).metadata()
      expect(meta.format, `not webp: ${file}`).toBe('webp')
      expect(meta.width, `wrong width: ${file}`).toBe(ARTWORK_WIDTH)
      expect(meta.height, `wrong height: ${file}`).toBe(ARTWORK_HEIGHT)
    }
  })

  it('14. no media is ever hotlinked', () => {
    for (const src of allAssetSrcs()) {
      expect(src.startsWith('/'), `remote media: ${src}`).toBe(true)
      expect(src.startsWith('//'), `protocol-relative media: ${src}`).toBe(false)
      expect(src).not.toMatch(/^https?:/)
    }
    // Remote-looking metadata can never render either: both planners refuse it.
    expect(gameThumbPlan({ slug: 'x', logo: { src: 'https://cdn.example.com/l.webp', alt: 'a', sourceUrl: 'https://e.com', rightsNote: 'n' } }).kind).toBe('tile')
    expect(gameArtworkPlan({ slug: 'x', artwork: { src: '//cdn.example.com/a.webp', alt: 'a', sourceUrl: 'https://e.com', rightsNote: 'n' } })).toBeNull()
  })

  it('15. image attribution stays on the About page', async () => {
    const html = renderToStaticMarkup(AboutPage())
    expect(html).toContain('Image credits')
    // The pre-existing logo credits are untouched.
    expect(html).toContain('https://creativecommons.org/licenses/by-sa/3.0/')
    expect(html).toContain('https://creativecommons.org/licenses/by-sa/4.0/')
    expect(html).toContain('Blizzard Entertainment')
    expect(html).toMatch(/no endorsement implied/i)
    // Every asset whose rights note routes credit to the About page is actually named
    // there, so an attribution requirement can never be left unfulfilled.
    const names = new Map(
      (await testDb.sql<{ slug: string; name: string }[]>`select slug, name from games`).map((g) => [g.slug, g.name]),
    )
    for (const media of GAME_MEDIA) {
      const notes = [media.logo?.rightsNote, media.artwork?.rightsNote]
      if (notes.some((n) => n && /credited on the About page/.test(n))) {
        expect(html, `missing credit for ${media.slug}`).toContain(names.get(media.slug) ?? media.slug)
      }
    }
  })
})

describe('regressions', () => {
  it('16. media wiring does not change indexability metadata', async () => {
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

  it('17. compatibility rendering on the game page is unchanged', async () => {
    const html = renderToStaticMarkup(
      await GamePage({ params: Promise.resolve({ game: 'zenless-zone-zero' }) }),
    )
    expect(html).toContain('aria-labelledby="controllers-heading"')
    for (const heading of ['Direct tests', 'External reports', 'Reported issues', 'Last report']) {
      expect(html, `missing column ${heading}`).toContain(heading)
    }
    expect(html).toContain('Submit a test')
  })

  it('18. search rendering is unchanged by media', async () => {
    const html = renderToStaticMarkup(
      await SearchPage({ searchParams: Promise.resolve({ q: 'genshin' }) }),
    )
    expect(html).toContain('href="/games/genshin-impact"')
    expect(html).toContain('data-game-thumb="genshin-impact"')
    // Rows are still links first: media never replaces or hides the result.
    expect(html).toMatch(/<a [^>]*href="\/games\/genshin-impact"[^>]*>Genshin Impact<\/a>/)
  })
})
