import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres, { type Sql } from 'postgres'
import { combinationEvidence, listSearchCoverage, search, type SearchCoverage } from '@/lib/data/public'
import { CONTROLS, type ConnectionType } from '@/lib/domain'
import { createTestDb, ids, type TestDb } from './helpers/db'

// Evidence availability for search results: which Game × Controller combinations have
// controller-specific records, counted in two bounded aggregate queries. Search reports
// data presence only, never a compatibility verdict. No production system is contacted.

let t: TestDb
let id: Awaited<ReturnType<typeof ids>>
let coverage: SearchCoverage

/** The source URL date is what `lastControllerEvidenceDate` must be read from. */
type ClaimSeed = { family: string | null; connection?: ConnectionType | null }

async function source(
  slug: string,
  game: string,
  sourceType: string,
  status: 'published' | 'needs_direct_test',
  date: string,
  claims: ClaimSeed[],
): Promise<string> {
  const [row] = await t.sql<{ id: string }[]>`
    insert into evidence_sources (url, url_key, source_type, review_status, is_report, game_id, published_on)
    values (${`https://${slug}/page`}, ${slug}, ${sourceType}, ${status}, true, ${id.game(game).id}, ${date})
    returning id::text`
  for (const c of claims) {
    await t.sql`
      insert into evidence_claims (
        source_id, game_id, controller_family_id, connection_type, control, result, statement, visibility
      ) values (
        ${row.id}, ${id.game(game).id}, ${c.family ? id.family(c.family).id : null}, ${c.connection ?? null},
        'controller_support', 'works', ${'Reported on Android.'}, ${status}
      )`
  }
  return row.id
}

async function directTest(
  game: string,
  family: string,
  opts: { date: string; observations: number; status?: 'approved' | 'pending'; model?: string },
): Promise<string> {
  const [row] = await t.sql<{ id: string }[]>`
    insert into test_sessions (status, game_id, controller_family_id, connection_type, device_model_code, tested_on)
    values (${opts.status ?? 'approved'}, ${id.game(game).id}, ${id.family(family).id}, 'usb',
            ${opts.model ?? null}, ${opts.date})
    returning id::text`
  for (const control of CONTROLS.slice(0, opts.observations)) {
    await t.sql`insert into test_observations (session_id, control, result) values (${row.id}, ${control}, 'works')`
  }
  return row.id
}

const evidence = (game: string, family: string) =>
  combinationEvidence(coverage, id.game(game).id, id.family(family).id)

beforeAll(async () => {
  t = await createTestDb()
  id = await ids(t.sql)

  // Genshin Impact × DualSense: an official source stating two transports, plus a
  // reviewed article stating no transport at all.
  await source('support.hoyoverse.example', 'genshin-impact', 'official', 'published', '2025-03-01', [
    { family: 'sony-dualsense', connection: 'bluetooth' },
    { family: 'sony-dualsense', connection: 'usb' },
  ])
  await source('game8.example', 'genshin-impact', 'article', 'published', '2025-09-17', [
    { family: 'sony-dualsense', connection: null },
  ])
  // Genshin Impact with no controller named, and deliberately the newest source of all:
  // it is game-wide context and must never become a family's "last evidence" date.
  await source('androidpolice.example', 'genshin-impact', 'article', 'published', '2025-12-01', [
    { family: null, connection: 'usb' },
    { family: null, connection: 'bluetooth' },
  ])
  // Wuthering Waves × DualSense: one non-official published source.
  await source('reddit.example', 'wuthering-waves', 'reddit', 'published', '2025-11-02', [
    { family: 'sony-dualsense', connection: 'bluetooth' },
  ])
  // Wuthering Waves × DualShock 4: only a claim that states no transport.
  await source('forum.example', 'wuthering-waves', 'forum', 'published', '2025-07-04', [
    { family: 'sony-dualshock-4', connection: null },
  ])
  // Wuthering Waves with no controller named, flagged for a direct test.
  await source('ww-wide.example', 'wuthering-waves', 'article', 'needs_direct_test', '2026-01-15', [
    { family: null, connection: 'usb' },
  ])
  // Honkai: Star Rail × DualSense: only a controller-specific claim needing a direct test.
  await source('video.example', 'honkai-star-rail', 'youtube', 'needs_direct_test', '2026-02-10', [
    { family: 'sony-dualsense', connection: 'usb' },
  ])
  // Genshin Impact × 8BitDo Ultimate 2 (published) and × 8BitDo Ultimate 2C (needs a
  // direct test), to exercise the three-way ordering below.
  await source('8bitdo.example', 'genshin-impact', 'other', 'published', '2025-10-05', [
    { family: '8bitdo-ultimate-2', connection: 'dongle' },
  ])
  await source('store.example', 'genshin-impact', 'forum', 'needs_direct_test', '2026-03-03', [
    { family: '8bitdo-ultimate-2c', connection: 'bluetooth' },
  ])

  // Wuthering Waves × 8BitDo Ultimate 2: two approved sessions, one of them with eight
  // observations, and one session still awaiting review.
  await directTest('wuthering-waves', '8bitdo-ultimate-2', { date: '2026-09-01', observations: 8 })
  await directTest('wuthering-waves', '8bitdo-ultimate-2', { date: '2026-09-20', observations: 1 })
  await directTest('wuthering-waves', '8bitdo-ultimate-2', {
    date: '2026-09-25',
    observations: 3,
    status: 'pending',
  })
  // Device search fixture, on a game and controller no other assertion depends on.
  await directTest('honkai-star-rail', 'gamesir-g8', {
    date: '2026-09-21',
    observations: 1,
    model: 'SM-S931B',
  })

  const families = await t.sql<{ id: string }[]>`select id::text from controller_families`
  coverage = await listSearchCoverage(t.sql, { includeDemo: false, familyIds: families.map((f) => f.id) })
})
afterAll(() => t.close())

describe('evidence available', () => {
  it('1. an approved direct test for this game and family', () => {
    const e = evidence('wuthering-waves', '8bitdo-ultimate-2')
    expect(e.status).toBe('evidence_available')
    expect(e.verificationSources).toBe(0)
  })

  it('2. a published controller-specific official claim', () => {
    const e = evidence('genshin-impact', 'sony-dualsense')
    expect(e.status).toBe('evidence_available')
    expect(e.published.officialSources).toBe(1)
  })

  it('3. a published controller-specific non-official claim', () => {
    const e = evidence('wuthering-waves', 'sony-dualsense')
    expect(e).toMatchObject({
      status: 'evidence_available',
      directTests: 0,
      published: { officialSources: 0, otherSources: 1 },
    })
  })

  it('4. a controller-specific claim with connection NULL is still evidence', async () => {
    const stored = await t.sql<{ n: number }[]>`
      select count(*)::int as n from evidence_claims
      where game_id = ${id.game('wuthering-waves').id}
        and controller_family_id = ${id.family('sony-dualshock-4').id}
        and connection_type is null and visibility = 'published'`
    expect(stored[0].n).toBe(1)
    expect(evidence('wuthering-waves', 'sony-dualshock-4')).toMatchObject({
      status: 'evidence_available',
      published: { officialSources: 0, otherSources: 1 },
    })
  })
})

describe('needs verification', () => {
  it('5. only a controller-specific claim flagged for a direct test', () => {
    const e = evidence('honkai-star-rail', 'sony-dualsense')
    expect(e).toMatchObject({ status: 'needs_verification', directTests: 0, verificationSources: 1 })
  })

  it('6. does not raise any published source count or the evidence date', () => {
    const e = evidence('honkai-star-rail', 'sony-dualsense')
    expect(e.published).toEqual({ officialSources: 0, otherSources: 0 })
    expect(e.lastControllerEvidenceDate).toBeNull()
  })
})

describe('no controller evidence', () => {
  it('7. no controller-specific records at all', () => {
    expect(evidence('honkai-star-rail', '8bitdo-ultimate')).toEqual({
      status: 'no_controller_evidence',
      directTests: 0,
      published: { officialSources: 0, otherSources: 0 },
      verificationSources: 0,
      gameWideContext: { publishedSources: 0, verificationSources: 0 },
      lastControllerEvidenceDate: null,
    })
  })

  it('8. a game-wide published claim does not promote a family', () => {
    const e = evidence('genshin-impact', 'xbox-wireless-controller')
    expect(e.status).toBe('no_controller_evidence')
    expect(e.published).toEqual({ officialSources: 0, otherSources: 0 })
    expect(e.gameWideContext).toEqual({ publishedSources: 1, verificationSources: 0 })
  })

  it('9. a game-wide needs-direct-test claim does not promote a family', () => {
    const e = evidence('wuthering-waves', 'razer-kishi')
    expect(e.status).toBe('no_controller_evidence')
    expect(e.verificationSources).toBe(0)
    expect(e.gameWideContext).toEqual({ publishedSources: 0, verificationSources: 1 })
  })

  it('10. evidence for another controller family never counts for this one', () => {
    expect(evidence('genshin-impact', '8bitdo-ultimate').status).toBe('no_controller_evidence')
    expect(evidence('genshin-impact', 'sony-dualshock-4').status).toBe('no_controller_evidence')
    // The same game does have evidence, for its own family only.
    expect(evidence('genshin-impact', 'sony-dualsense').status).toBe('evidence_available')
  })
})

describe('counts', () => {
  it('11. several claims from one source count as one source', async () => {
    const claims = await t.sql<{ n: number }[]>`
      select count(*)::int as n from evidence_claims
      where source_id = (select id from evidence_sources where url_key = 'support.hoyoverse.example')`
    expect(claims[0].n).toBe(2)
    expect(evidence('genshin-impact', 'sony-dualsense').published.officialSources).toBe(1)
    // The game-wide source states two transports as well: still one source.
    expect(evidence('genshin-impact', 'xbox-wireless-controller').gameWideContext.publishedSources).toBe(1)
  })

  it('12. direct tests count sessions, not observations', async () => {
    const observations = await t.sql<{ n: number }[]>`
      select count(*)::int as n from test_observations o
      join test_sessions s on s.id = o.session_id
      where s.game_id = ${id.game('wuthering-waves').id}
        and s.controller_family_id = ${id.family('8bitdo-ultimate-2').id} and s.status = 'approved'`
    expect(observations[0].n).toBe(9)
    expect(evidence('wuthering-waves', '8bitdo-ultimate-2').directTests).toBe(2)
  })

  it('13. official and non-official published sources stay separate', () => {
    const e = evidence('genshin-impact', 'sony-dualsense')
    expect(e.published).toEqual({ officialSources: 1, otherSources: 1 })
    expect(e.directTests).toBe(0)
  })

  it('16. a family-less claim contributes to no family at all', async () => {
    const familyLess = await t.sql<{ n: number }[]>`
      select count(*)::int as n from evidence_claims
      where game_id = ${id.game('genshin-impact').id}
        and controller_family_id is null and connection_type = 'usb' and visibility = 'published'`
    expect(familyLess[0].n).toBe(1)

    for (const slug of [
      'sony-dualshock-4',
      'xbox-wireless-controller',
      '8bitdo-ultimate',
      'razer-kishi',
      'gamesir-g8',
    ]) {
      const e = evidence('genshin-impact', slug)
      expect(e, slug).toMatchObject({
        status: 'no_controller_evidence',
        directTests: 0,
        published: { officialSources: 0, otherSources: 0 },
        verificationSources: 0,
      })
      expect(e.gameWideContext, slug).toEqual({ publishedSources: 1, verificationSources: 0 })
      expect(e.lastControllerEvidenceDate, slug).toBeNull()
    }
    // DualSense keeps exactly its own two sources: the game-wide one adds nothing.
    expect(evidence('genshin-impact', 'sony-dualsense').published).toEqual({ officialSources: 1, otherSources: 1 })
  })
})

describe('last evidence date', () => {
  it('follows the newest decisive controller-specific record only', () => {
    // The newer game-wide source (2025-12-01) must not win over the family claim.
    expect(evidence('genshin-impact', 'sony-dualsense').lastControllerEvidenceDate).toBe('2025-09-17')
    // The game-wide request dated 2026-01-15 must not win over the family claim either.
    expect(evidence('wuthering-waves', 'sony-dualsense').lastControllerEvidenceDate).toBe('2025-11-02')
    // Verification-only and game-wide-only combinations have no decisive evidence date.
    expect(evidence('honkai-star-rail', 'sony-dualsense').lastControllerEvidenceDate).toBeNull()
    expect(evidence('wuthering-waves', 'razer-kishi').lastControllerEvidenceDate).toBeNull()
    // Approved tests only: the pending session of 2026-09-25 is ignored.
    expect(evidence('wuthering-waves', '8bitdo-ultimate-2').lastControllerEvidenceDate).toBe('2026-09-20')
  })
})

describe('combination ordering', () => {
  it('14-15. evidence_available, then needs_verification, then no_controller_evidence', async () => {
    const results = await search(t.sql, 'genshin 8bitdo', false)
    expect(results.combinations.map((c) => c.status)).toEqual([
      'evidence_available',
      'needs_verification',
      'no_controller_evidence',
    ])
    // Catalog order within a status is preserved: the 8BitDo families are matched as
    // Ultimate, Ultimate 2, Ultimate 2C, so the no-evidence pair moves behind the other two.
    expect(results.combinations.map((c) => `${c.game.slug}/${c.family.slug}`)).toEqual([
      'genshin-impact/8bitdo-ultimate-2',
      'genshin-impact/8bitdo-ultimate-2c',
      'genshin-impact/8bitdo-ultimate',
    ])
  })

  it('a matched pair carries the counts the combination page is built from', async () => {
    const [genshinDualSense] = (await search(t.sql, 'genshin dualsense', false)).combinations
    expect(genshinDualSense).toMatchObject({
      status: 'evidence_available',
      directTests: 0,
      published: { officialSources: 1, otherSources: 1 },
      verificationSources: 0,
      gameWideContext: { publishedSources: 1, verificationSources: 0 },
      lastControllerEvidenceDate: '2025-09-17',
    })
    expect([genshinDualSense.game.slug, genshinDualSense.family.slug]).toEqual([
      'genshin-impact',
      'sony-dualsense',
    ])
  })
})

describe('existing search behavior', () => {
  it('21. game-only search still returns a plain game link', async () => {
    const r = await search(t.sql, 'wuwa', false)
    expect(r.games.map((g) => g.slug)).toEqual(['wuthering-waves'])
    expect(r.families).toEqual([])
    expect(r.combinations).toEqual([])
    expect(r.controllerByGame).toEqual([])
    expect(r.devices).toEqual([])
  })

  it('22. controller-only search lists every game with its own status', async () => {
    const r = await search(t.sql, 'dualsense', false)
    expect(r.families.map((f) => f.slug)).toEqual(['sony-dualsense'])
    expect(r.games).toEqual([])
    expect(r.combinations).toEqual([])
    expect(r.controllerByGame).toHaveLength(1)
    expect(r.controllerByGame[0].rows.map((row) => [row.game.slug, row.status])).toEqual([
      ['genshin-impact', 'evidence_available'],
      ['honkai-star-rail', 'needs_verification'],
      ['wuthering-waves', 'evidence_available'],
    ])
  })

  it('23. device search still returns matching devices', async () => {
    const r = await search(t.sql, 'SM-S931B', false)
    expect(r.devices.map((d) => d.deviceModel)).toEqual(['SM-S931B'])
    expect(r.games).toEqual([])
    expect(r.families).toEqual([])
    expect(r.combinations).toEqual([])
  })

  it('24. an empty query and an unmatched query return nothing at all', async () => {
    const empty = { games: [], families: [], combinations: [], controllerByGame: [], devices: [] }
    expect(await search(t.sql, '', false)).toEqual(empty)
    expect(await search(t.sql, '   ', false)).toEqual(empty)
    expect(await search(t.sql, '%', false)).toEqual(empty)
    expect(await search(t.sql, 'zzzz-not-a-thing', false)).toEqual(empty)
  })
})

// ---------------------------------------------------------------------------
// Pool size. The local development wire server runs one Postgres session behind
// several client connections, so two queries in flight at once can interleave their
// protocol messages and hand one query the other's rows (seen as `NaN` counts and a
// boolean-text date). Search issues its queries one at a time; this runs the whole
// search path through a client configured like the app's default pool (max: 5).
// ---------------------------------------------------------------------------

describe('development pool size', () => {
  let pooled: Sql

  beforeAll(() => {
    pooled = postgres({
      host: '127.0.0.1',
      port: t.port,
      user: 'postgres',
      password: 'postgres',
      database: 'postgres',
      max: 5,
      prepare: false,
      onnotice: () => {},
    })
  })
  afterAll(() => pooled.end())

  it('keeps counts and dates intact through a pooled client', async () => {
    const combo = (await search(pooled, 'genshin dualsense', false)).combinations[0]
    expect(combo).toMatchObject({
      status: 'evidence_available',
      directTests: 0,
      published: { officialSources: 1, otherSources: 1 },
      verificationSources: 0,
      gameWideContext: { publishedSources: 1, verificationSources: 0 },
      lastControllerEvidenceDate: '2025-09-17',
    })

    // The direct-test aggregate, which `NaN` corruption hits first.
    const wuthering = (await search(pooled, 'wuthering 8bitdo', false)).combinations.find(
      (c) => c.family.slug === '8bitdo-ultimate-2',
    )
    expect(wuthering).toMatchObject({
      status: 'evidence_available',
      directTests: 2,
      verificationSources: 0,
      lastControllerEvidenceDate: '2026-09-20',
    })
  })

  it('matches the single-connection results, order and device rows', async () => {
    const pairs = await search(pooled, 'genshin 8bitdo', false)
    expect(pairs.combinations.map((c) => `${c.game.slug}/${c.family.slug}`)).toEqual([
      'genshin-impact/8bitdo-ultimate-2',
      'genshin-impact/8bitdo-ultimate-2c',
      'genshin-impact/8bitdo-ultimate',
    ])
    expect(pairs.combinations.map((c) => c.status)).toEqual([
      'evidence_available',
      'needs_verification',
      'no_controller_evidence',
    ])

    const byGame = await search(pooled, 'dualsense', false)
    expect(byGame.controllerByGame[0].rows.map((r) => [r.game.slug, r.status])).toEqual([
      ['genshin-impact', 'evidence_available'],
      ['honkai-star-rail', 'needs_verification'],
      ['wuthering-waves', 'evidence_available'],
    ])

    const devices = await search(pooled, 'SM-S931B', false)
    expect(devices.devices.map((d) => d.deviceModel)).toEqual(['SM-S931B'])
    expect(devices.devices[0].observations.length).toBeGreaterThan(0)
  })
})
