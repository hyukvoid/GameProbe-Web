import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listExternalReports, listGames, search } from '@/lib/data/public'
import { createTestDb, type TestDb } from './helpers/db'

// Phase 2-2 "Game & Evidence Expansion" (migration 0006): the exact catalog and claim
// shape the expansion inserted. The database is migration-only — no fixtures — so every
// row here belongs to 0006 and a later migration that shifts these counts fails loudly.

let t: TestDb

beforeAll(async () => {
  t = await createTestDb()
})
afterAll(() => t.close())

describe('expanded catalog', () => {
  it('holds the 15 games, and aliases reach the new ones', async () => {
    const games = await listGames(t.sql)
    expect(games.map((g) => g.slug)).toEqual([
      'alien-isolation',
      'brawlhalla',
      'call-of-duty-mobile',
      'dead-cells',
      'diablo-immortal',
      'fortnite',
      'grid-autosport',
      'genshin-impact',
      'honkai-star-rail',
      'minecraft',
      'roblox',
      'stardew-valley',
      'terraria',
      'wuthering-waves',
      'zenless-zone-zero',
    ])
    expect((await search(t.sql, 'zzz', false)).games.map((g) => g.slug)).toEqual([
      'zenless-zone-zero',
    ])
    expect((await search(t.sql, 'codm', false)).games.map((g) => g.slug)).toEqual([
      'call-of-duty-mobile',
    ])
  })

  it('holds 32 reviewed sources, every one a reported test candidate', async () => {
    const rows = await t.sql<
      { total: number; published: number; needs_direct_test: number; unreported: number }[]
    >`
      select count(*)::int as total,
             count(*) filter (where review_status = 'published')::int as published,
             count(*) filter (where review_status = 'needs_direct_test')::int as needs_direct_test,
             count(*) filter (where is_report is not true)::int as unreported
      from evidence_sources`
    expect(rows[0]).toEqual({
      total: 32,
      published: 28,
      needs_direct_test: 4,
      unreported: 0,
    })
  })

  it('holds 67 claims in the expansion shape', async () => {
    const rows = await t.sql<
      {
        total: number
        published: number
        needs_direct_test: number
        family: number
        familyless: number
        xbox: number
        ds4: number
        dsense: number
        kishi: number
        variant: number
        connection: number
        bluetooth: number
        usb: number
        broken: number
        menu: number
      }[]
    >`
      select count(*)::int as total,
             count(*) filter (where c.visibility = 'published')::int as published,
             count(*) filter (where c.visibility = 'needs_direct_test')::int as needs_direct_test,
             count(*) filter (where c.controller_family_id is not null)::int as family,
             count(*) filter (where c.controller_family_id is null)::int as familyless,
             count(*) filter (where f.slug = 'xbox-wireless-controller')::int as xbox,
             count(*) filter (where f.slug = 'sony-dualshock-4')::int as ds4,
             count(*) filter (where f.slug = 'sony-dualsense')::int as dsense,
             count(*) filter (where f.slug = 'razer-kishi')::int as kishi,
             count(*) filter (where c.controller_variant_id is not null)::int as variant,
             count(*) filter (where c.connection_type is not null)::int as connection,
             count(*) filter (where c.connection_type = 'bluetooth')::int as bluetooth,
             count(*) filter (where c.connection_type = 'usb')::int as usb,
             count(*) filter (where c.result = 'broken')::int as broken,
             count(*) filter (where c.control = 'menu')::int as menu
      from evidence_claims c
      left join controller_families f on f.id = c.controller_family_id`
    expect(rows[0]).toEqual({
      total: 67,
      published: 63,
      needs_direct_test: 4,
      family: 42,
      familyless: 25,
      xbox: 19,
      ds4: 9,
      dsense: 12,
      kishi: 2,
      variant: 2,
      connection: 16,
      bluetooth: 12,
      usb: 4,
      broken: 10,
      menu: 1,
    })
  })

  it('every claim inherits its source status and game', async () => {
    const rows = await t.sql<{ visibility_mismatch: number; game_mismatch: number }[]>`
      select count(*) filter (where c.visibility <> s.review_status)::int as visibility_mismatch,
             count(*) filter (where c.game_id is distinct from s.game_id)::int as game_mismatch
      from evidence_claims c
      join evidence_sources s on s.id = c.source_id`
    expect(rows[0]).toEqual({ visibility_mismatch: 0, game_mismatch: 0 })
  })

  it('keeps the familyless siliconera report out of controller rows', async () => {
    const reports = await listExternalReports(t.sql, { includeDemo: false })
    const siliconera = reports.find((r) => r.url.includes('siliconera.com'))
    expect(siliconera).toMatchObject({
      familySlug: null,
      familyName: null,
      gameSlug: 'wuthering-waves',
    })
    expect(siliconera!.claims).toHaveLength(1)
    expect(siliconera!.claims[0]).toMatchObject({ result: 'broken' })
  })

  it('shows game-wide verification context without promoting a family', async () => {
    const r = await search(t.sql, 'roblox dualsense', false)
    expect(r.combinations).toHaveLength(1)
    expect(r.combinations[0]).toMatchObject({
      game: { slug: 'roblox' },
      family: { slug: 'sony-dualsense' },
      status: 'no_controller_evidence',
      gameWideContext: { publishedSources: 0, verificationSources: 2 },
    })
  })

  it('is idempotent: re-applying the migration changes no counts', async () => {
    const counts = () => t.sql<{ g: number; s: number; c: number }[]>`
      select (select count(*) from games)::int as g,
             (select count(*) from evidence_sources)::int as s,
             (select count(*) from evidence_claims)::int as c`
    const before = await counts()
    const body = await readFile(
      path.join(import.meta.dirname, '..', 'db', 'migrations', '0006_game_evidence_expansion.sql'),
      'utf8',
    )
    await t.sql.begin(async (tx) => {
      await tx.unsafe(body)
    })
    expect(await counts()).toEqual(before)
  })
})
