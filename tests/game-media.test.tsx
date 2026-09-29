import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// Complete visual coverage, two roles and three rights tiers:
// - every one of the 15 catalog games has a small visual (licensed logo, licensed
//   identifying asset, or a GameProbe-original tile) and a large artwork;
// - licensed assets keep sourceUrl + rightsNote, GameProbe originals state project
//   ownership and have no remote dependency;
// - initials survive only as the runtime-failure and unknown-game fallback;
// - placement (artwork on game pages only), attribution and SEO/search/compatibility
//   regressions all stay exactly where they were.

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
// failure branches of GameArtwork (region unmounts) and GameThumb (initials tile)
// are assertable without a DOM.
let simulateImageFailure = false
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  const passthrough = actual.useState as (initial?: unknown) => unknown
  const useState = ((initial?: unknown) =>
    simulateImageFailure ? [true, () => {}] : passthrough(initial)) as typeof actual.useState
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
  gameMedia,
  gameThumbPlan,
  type MediaAsset,
  type MediaAssetKind,
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

const registrySlugs = GAME_MEDIA.map((m) => m.slug).sort()
const KINDS: MediaAssetKind[] = ['licensed-original', 'licensed-third-party', 'gameprobe-original']

/** Every asset in the registry: logo and artwork of every game alike. */
function allAssets(): { slug: string; role: 'logo' | 'artwork'; asset: MediaAsset }[] {
  return GAME_MEDIA.flatMap((m) => [
    { slug: m.slug, role: 'logo' as const, asset: m.logo },
    { slug: m.slug, role: 'artwork' as const, asset: m.artwork },
  ])
}

/** Every src recorded anywhere in the registry. */
function allAssetSrcs(): string[] {
  return allAssets().map((a) => a.asset.src)
}

/** A fully valid test asset; override the fields a specific case needs. */
function asset(src: string, extra: Partial<MediaAsset> = {}): MediaAsset {
  return {
    src,
    kind: 'licensed-third-party',
    alt: src ? 'Test visual' : '',
    sourceUrl: src ? 'https://example.com/press' : undefined,
    rightsNote: 'Test asset for planner checks. Accessed 2026-09-29.',
    ...extra,
  }
}

describe('visual coverage: 15 of 15', () => {
  it('1. the current 15 games all have a small visual asset', async () => {
    const games = await testDb.sql<{ slug: string }[]>`select slug from games order by slug`
    expect(games).toHaveLength(15)
    expect(registrySlugs).toEqual(games.map((g) => g.slug))
    expect(GAME_MEDIA).toHaveLength(15)

    for (const media of GAME_MEDIA) {
      const logo = media.logo
      expect(logo, `missing logo for ${media.slug}`).toBeTruthy()
      expect(logo.src, `bad logo path for ${media.slug}`).toMatch(/^\/games\/[a-z0-9-]+(\/[a-z0-9-]+)?\.webp$/)
      expect(logo.alt, `missing logo alt for ${media.slug}`).toBeTruthy()
      expect(logo.rightsNote.length, `empty rightsNote for ${media.slug}`).toBeGreaterThan(20)
      expect(KINDS, `unknown kind for ${media.slug}`).toContain(logo.kind)
      // A logo can never be smuggled into the artwork role via the same file.
      expect(media.artwork.src, `logo reused as artwork for ${media.slug}`).not.toBe(logo.src)
      // And it renders: image plan, image markup, fixed boxes intact.
      expect(gameThumbPlan(media), `logo not planned for ${media.slug}`).toMatchObject({ kind: 'image' })
      const html = renderToStaticMarkup(<GameThumb slug={media.slug} />)
      expect(html, `thumb not rendered for ${media.slug}`).toContain('data-thumb-kind="image"')
      expect(html).toContain(`data-game-thumb="${media.slug}"`)
      expect(html).toMatch(/<img[^>]+width="\d+"/)
      expect(html).toMatch(/<img[^>]+height="\d+"/)
    }

    // The ambiguous one-image-per-game and placeholder-note shapes are gone for good.
    expect(JSON.stringify(GAME_MEDIA)).not.toContain('placeholderNote')
    expect(GAME_MEDIA).not.toContainEqual(expect.objectContaining({ image: expect.anything() }))

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

  it('2. the current 15 games all have a large artwork asset', () => {
    expect(GAME_MEDIA).toHaveLength(15)
    for (const media of GAME_MEDIA) {
      const art = media.artwork
      expect(art, `missing artwork for ${media.slug}`).toBeTruthy()
      expect(art.src, `bad artwork path for ${media.slug}`).toMatch(/^\/games\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/)
      expect(art.alt, `missing artwork alt for ${media.slug}`).toBeTruthy()
      expect(art.rightsNote.length, `empty rightsNote for ${media.slug}`).toBeGreaterThan(20)
      expect(KINDS, `unknown kind for ${media.slug}`).toContain(art.kind)

      const plan = gameArtworkPlan(media)
      expect(plan, `no artwork plan for ${media.slug}`).not.toBeNull()
      expect(plan!.width).toBe(ARTWORK_WIDTH)
      expect(plan!.height).toBe(ARTWORK_HEIGHT)

      const html = renderToStaticMarkup(<GameArtwork slug={media.slug} />)
      expect(html, `artwork region missing for ${media.slug}`).toContain(`data-game-artwork="${media.slug}"`)
      expect(html).toContain(encodeURIComponent(art.src))
      expect(html).toContain(`alt="${art.alt}"`)
      expect(html).toContain(`width="${ARTWORK_WIDTH}"`)
      expect(html).toContain(`height="${ARTWORK_HEIGHT}"`)
      expect(html).toContain('game-artwork-img')
    }
    // Artwork is never inferred from a logo: no artwork reuses any logo file.
    const logoSrcs = new Set(GAME_MEDIA.map((m) => m.logo.src))
    for (const media of GAME_MEDIA) expect(logoSrcs.has(media.artwork.src)).toBe(false)
  })

  it('3. no current catalog game normally resolves to initials fallback', () => {
    for (const media of GAME_MEDIA) {
      expect(gameThumbPlan(media), `thumb plan regressed for ${media.slug}`).toEqual({
        kind: 'image',
        src: media.logo.src,
        alt: media.logo.alt,
      })
      const html = renderToStaticMarkup(<GameThumb slug={media.slug} />)
      expect(html, `initials rendered for ${media.slug}`).not.toContain('game-thumb-initials')
      expect(html).toContain('data-thumb-kind="image"')
    }
    // The initials fallback remains, but only where it belongs: unknown future games.
    const unknown = renderToStaticMarkup(<GameThumb slug="not-in-the-catalog" />)
    expect(unknown).toContain('data-thumb-kind="tile"')
    expect(unknown).toContain('game-thumb-initials')
    expect(gameThumbPlan(gameMedia('not-in-the-catalog')).kind).toBe('tile')
    expect(gameArtworkPlan(gameMedia('not-in-the-catalog'))).toBeNull()
  })

  it('4. runtime failure still falls back safely', () => {
    // Planners refuse bad input without ever producing a broken element.
    expect(
      gameThumbPlan({
        slug: 'x',
        logo: asset('https://cdn.example.com/logo.webp'),
        artwork: asset('/games/x/artwork.webp'),
      }).kind,
    ).toBe('tile')
    expect(
      gameArtworkPlan({
        slug: 'x',
        logo: asset('/games/x.webp'),
        artwork: asset('https://cdn.example.com/artwork.webp'),
      }),
    ).toBeNull()
    expect(gameArtworkPlan({ slug: 'x', logo: asset('/games/x.webp'), artwork: asset('') })).toBeNull()
    expect(
      gameArtworkPlan({
        slug: 'x',
        logo: asset('/games/x.webp'),
        artwork: asset('/games/x/artwork.webp', { alt: '' }),
      }),
    ).toBeNull()

    // Simulated image failure: thumbs revert to the initials tile, artwork unmounts.
    simulateImageFailure = true
    try {
      for (const media of GAME_MEDIA) {
        const thumb = renderToStaticMarkup(<GameThumb slug={media.slug} />)
        expect(thumb, `failed thumb kept its image for ${media.slug}`).toContain('data-thumb-kind="tile"')
        expect(thumb).toContain('game-thumb-initials')
        expect(thumb).not.toContain('<img')
        expect(renderToStaticMarkup(<GameArtwork slug={media.slug} />), `artwork shell left for ${media.slug}`).toBe('')
      }
    } finally {
      simulateImageFailure = false
    }
    // Once the failure clears, the approved artwork renders again.
    expect(renderToStaticMarkup(<GameArtwork slug="dead-cells" />)).toContain('data-game-artwork="dead-cells"')
  })

  it('5. licensed assets retain sourceUrl + rightsNote', () => {
    const licensed = allAssets().filter((a) => a.asset.kind !== 'gameprobe-original')
    expect(licensed.length, 'no licensed assets shipped').toBeGreaterThan(0)
    for (const { slug, role, asset: a } of licensed) {
      expect(a.sourceUrl, `missing sourceUrl for ${slug} ${role}`).toMatch(/^https:\/\//)
      expect(a.rightsNote.length, `empty rightsNote for ${slug} ${role}`).toBeGreaterThan(20)
      expect(a.rightsNote, `no access date for ${slug} ${role}`).toMatch(/20\d\d-\d\d-\d\d/)
    }
    // Both official press-kit artworks keep their publisher terms and credits.
    for (const slug of ['dead-cells', 'diablo-immortal']) {
      const art = gameMedia(slug).artwork
      expect(art.kind).toBe('licensed-original')
      expect(art.sourceUrl).toMatch(/^https:\/\//)
      expect(art.rightsNote).toMatch(/press/i)
    }
  })

  it('6. GameProbe originals identify themselves in rightsNote', () => {
    const originals = allAssets().filter((a) => a.asset.kind === 'gameprobe-original')
    expect(originals.length, 'no GameProbe originals shipped').toBeGreaterThan(0)
    for (const { slug, role, asset: a } of originals) {
      expect(a.rightsNote, `original without self-identification: ${slug} ${role}`).toContain(
        'Original visual created for GameProbe',
      )
      expect(a.rightsNote, `original without content disclaimer: ${slug} ${role}`).toContain(
        'no third-party game artwork, characters, logos or screenshots used',
      )
    }
    // The four games whose second-pass rights review found no reusable logo use tiles.
    for (const slug of ['honkai-star-rail', 'grid-autosport', 'terraria', 'stardew-valley']) {
      expect(gameMedia(slug).logo.kind, `${slug} should use a GameProbe tile`).toBe('gameprobe-original')
      expect(gameMedia(slug).logo.rightsNote).toContain('no reusable third-party logo')
    }
    // The About page exposes the same provenance to readers.
    const html = renderToStaticMarkup(AboutPage())
    expect(html).toContain('GameProbe original visuals')
    expect(html).toContain('no third-party game artwork, characters, logos or screenshots')
  })

  it('7. GameProbe originals contain no remote dependency', () => {
    for (const { slug, role, asset: a } of allAssets().filter((x) => x.asset.kind === 'gameprobe-original')) {
      expect(a.src, `remote original: ${slug} ${role}`).toMatch(/^\/games\/[a-z0-9-]+\//)
      expect(a.src).not.toMatch(/^\/\//)
      expect(a.sourceUrl, `original with remote sourceUrl: ${slug} ${role}`).toBeUndefined()
    }
    // Nothing anywhere in the registry is hotlinked.
    for (const src of allAssetSrcs()) {
      expect(src.startsWith('/'), `remote media: ${src}`).toBe(true)
      expect(src.startsWith('//'), `protocol-relative media: ${src}`).toBe(false)
      expect(src).not.toMatch(/^https?:/)
    }
  })

  it('8. all local files exist', async () => {
    const sharp = (await import('sharp')).default
    for (const { slug, role, asset: a } of allAssets()) {
      const file = path.join(process.cwd(), 'public', a.src)
      const info = await stat(file)
      expect(info.isFile(), `not a file: ${file}`).toBe(true)
      expect(info.size, `empty file: ${file}`).toBeGreaterThan(0)
      const meta = await sharp(file).metadata()
      expect(meta.format, `not webp: ${file}`).toBe('webp')
      if (role === 'logo') {
        // Every small visual is one consistent square format.
        expect(meta.width, `wrong tile width: ${file}`).toBe(256)
        expect(meta.height, `wrong tile height: ${file}`).toBe(256)
      } else {
        expect(meta.width, `wrong artwork width: ${file}`).toBe(ARTWORK_WIDTH)
        expect(meta.height, `wrong artwork height: ${file}`).toBe(ARTWORK_HEIGHT)
        expect(info.size, `oversized artwork: ${file}`).toBeLessThan(180_000)
      }
      expect(slug).toBeTruthy()
    }
  })

  it('9. all artwork assets are local', () => {
    for (const media of GAME_MEDIA) {
      expect(media.artwork.src, `non-local artwork for ${media.slug}`).toMatch(
        /^\/games\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/,
      )
      expect(media.artwork.src).not.toMatch(/^https?:|^\/\//)
      // Artwork provenance never leans on the logo's record.
      expect(media.artwork.rightsNote).not.toBe(media.logo.rightsNote)
    }
    // Remote-looking metadata can never render: both planners refuse it.
    expect(
      gameThumbPlan({
        slug: 'x',
        logo: asset('//cdn.example.com/logo.webp'),
        artwork: asset('/games/x/artwork.webp'),
      }).kind,
    ).toBe('tile')
    expect(
      gameArtworkPlan({
        slug: 'x',
        logo: asset('/games/x.webp'),
        artwork: asset('//cdn.example.com/artwork.webp'),
      }),
    ).toBeNull()
  })
})

describe('placement', () => {
  it('10. homepage renders all 15 visuals', async () => {
    const html = renderToStaticMarkup(await Home())
    const games = await testDb.sql<{ slug: string }[]>`select slug from games`
    const thumbs = html.match(/data-game-thumb="[^"]+"/g) ?? []
    expect(thumbs).toHaveLength(games.length)
    expect(games).toHaveLength(15)
    // Every row shows an image, not the initials fallback.
    expect(html.match(/data-thumb-kind="image"/g) ?? []).toHaveLength(games.length)
    for (const g of games) expect(html).toContain(`data-game-thumb="${g.slug}"`)
    // Never the large artwork.
    expect(html).not.toContain('data-game-artwork=')
    expect(html).not.toContain('game-artwork')
  })

  it('11. search renders visual assets', async () => {
    const html = renderToStaticMarkup(await SearchPage({ searchParams: Promise.resolve({ q: 'genshin' }) }))
    expect(html).toContain('data-game-thumb="genshin-impact"')
    expect(html).toContain('data-thumb-kind="image"')
    expect(html).toContain('href="/games/genshin-impact"')
    expect(html).not.toContain('data-game-artwork=')
    expect(html).not.toContain('game-artwork')
  })

  it('12. all 15 game pages render large artwork', async () => {
    const names = new Map(
      (await testDb.sql<{ slug: string; name: string }[]>`select slug, name from games`).map((g) => [g.slug, g.name]),
    )
    for (const media of GAME_MEDIA) {
      const html = renderToStaticMarkup(await GamePage({ params: Promise.resolve({ game: media.slug }) }))
      expect(html, `no artwork region for ${media.slug}`).toContain(`data-game-artwork="${media.slug}"`)
      expect(html).toContain(`data-game-thumb="${media.slug}"`)
      expect(html).toContain('game-head')
      expect(html).toContain('game-head-text')
      expect(html, `missing title for ${media.slug}`).toContain(names.get(media.slug)!)
      // One image only: no carousel, hero or duplicate region.
      expect((html.match(/data-game-artwork=/g) ?? []).length).toBe(1)
    }
  })

  it('13. combo pages render no large artwork', async () => {
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

  it('14. no broken image icons', async () => {
    // Server-rendered audit: every image element on every surface is local, routed
    // through the image optimizer, and dimensioned - there is nothing to "break".
    const pages: [string, string][] = [
      ['home', renderToStaticMarkup(await Home())],
      [
        'search',
        renderToStaticMarkup(await SearchPage({ searchParams: Promise.resolve({ q: 'genshin' }) })),
      ],
      ['game (licensed artwork)', renderToStaticMarkup(await GamePage({ params: Promise.resolve({ game: 'dead-cells' }) }))],
      ['game (original artwork + tile)', renderToStaticMarkup(await GamePage({ params: Promise.resolve({ game: 'honkai-star-rail' }) }))],
      ['game (original artwork)', renderToStaticMarkup(await GamePage({ params: Promise.resolve({ game: 'minecraft' }) }))],
      ['combo', renderToStaticMarkup(await CombinationPage({ params: Promise.resolve({ game: 'zenless-zone-zero', controller: 'sony-dualsense' }) }))],
    ]
    for (const [label, html] of pages) {
      const imgs = html.match(/<img[^>]*>/g) ?? []
      expect(imgs.length, `no images at all on ${label}`).toBeGreaterThan(0)
      for (const img of imgs) {
        expect(img, `non-optimizer image on ${label}: ${img}`).toMatch(/src="\/_next\/image\?url=%2F/)
        expect(img, `remote url on ${label}: ${img}`).not.toMatch(/url=https?/)
        expect(img, `undimensioned image on ${label}: ${img}`).toMatch(/width="/)
        expect(img, `undimensioned image on ${label}: ${img}`).toMatch(/height="/)
      }
    }
    // Runtime behaviour (failed request removes/never shows an image) is covered by
    // test 4 above and by the Playwright suite.
  })
})

describe('attribution and regressions', () => {
  it('15. existing attribution remains', async () => {
    const html = renderToStaticMarkup(AboutPage())
    expect(html).toContain('Image credits')
    // The pre-existing logo credits are untouched.
    expect(html).toContain('https://creativecommons.org/licenses/by-sa/3.0/')
    expect(html).toContain('https://creativecommons.org/licenses/by-sa/4.0/')
    expect(html).toContain('Blizzard Entertainment')
    expect(html).toContain('Motion Twin')
    expect(html).toMatch(/no endorsement implied/i)
    // Every asset whose rights note routes credit to the About page is actually named
    // there, so an attribution requirement can never be left unfulfilled.
    const names = new Map(
      (await testDb.sql<{ slug: string; name: string }[]>`select slug, name from games`).map((g) => [g.slug, g.name]),
    )
    for (const { slug, asset: a } of allAssets()) {
      if (/credited on the About page/.test(a.rightsNote)) {
        expect(html, `missing credit for ${slug}`).toContain(names.get(slug) ?? slug)
      }
    }
  })

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

  it('17. search regression unchanged', async () => {
    const html = renderToStaticMarkup(await SearchPage({ searchParams: Promise.resolve({ q: 'genshin' }) }))
    expect(html).toContain('href="/games/genshin-impact"')
    expect(html).toContain('data-game-thumb="genshin-impact"')
    // Rows are still links first: media never replaces or hides the result.
    expect(html).toMatch(/<a [^>]*href="\/games\/genshin-impact"[^>]*>Genshin Impact<\/a>/)
  })

  it('18. compatibility regression unchanged', async () => {
    const html = renderToStaticMarkup(
      await GamePage({ params: Promise.resolve({ game: 'zenless-zone-zero' }) }),
    )
    expect(html).toContain('aria-labelledby="controllers-heading"')
    for (const heading of ['Direct tests', 'External reports', 'Reported issues', 'Last report']) {
      expect(html, `missing column ${heading}`).toContain(heading)
    }
    expect(html).toContain('Submit a test')
  })
})
