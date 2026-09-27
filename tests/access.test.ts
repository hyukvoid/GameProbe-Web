import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { combine, gameOverviews, listDirectTests, listEvidenceItems, listExternalReports, listGames, search } from '@/lib/data/public'
import { createTestDb, loadFixtures, type TestDb } from './helpers/db'

describe('Supabase API roles', () => {
  let t: TestDb
  beforeAll(async () => {
    t = await createTestDb({ supabaseRoles: true })
  })
  afterAll(() => t.close())

  it('cannot read or write any table directly', async () => {
    for (const statement of [
      `select * from games`,
      `select * from test_sessions`,
      `select * from evidence_sources`,
      `insert into test_sessions (game_id, tested_on, controller_as_entered) select id, current_date, 'x' from games limit 1`,
      `update test_sessions set status = 'approved'`,
      `insert into evidence_claims (source_id) values (gen_random_uuid())`,
    ]) {
      await expect(
        t.sql.begin(async (tx) => {
          await tx.unsafe('set local role anon')
          await tx.unsafe(statement)
        }),
        statement,
      ).rejects.toThrow(/permission denied/)
    }
  })
})

describe('development fixtures', () => {
  let t: TestDb
  beforeAll(async () => {
    t = await createTestDb()
    await loadFixtures(t.sql)
  })
  afterAll(() => t.close())

  it('are hidden from public queries unless demo data is enabled', async () => {
    expect(await listDirectTests(t.sql, { includeDemo: false })).toEqual([])
    expect(await listExternalReports(t.sql, { includeDemo: false })).toEqual([])
    expect(await listEvidenceItems(t.sql, { includeDemo: false })).toEqual([])

    const shown = await listDirectTests(t.sql, { includeDemo: true })
    expect(shown.length).toBe(5)
    expect(shown.every((d) => d.isDemo)).toBe(true)
    // Pending and rejected fixtures stay hidden even in demo mode.
    expect(shown.some((d) => d.notes?.includes('awaiting review'))).toBe(false)
    expect(shown.some((d) => d.notes?.includes('rejected'))).toBe(false)
  })

  it('exercise a contradiction, an external-only report and a duplicate', async () => {
    const games = await listGames(t.sql)
    const combos = combine(await listEvidenceItems(t.sql, { includeDemo: true }))
    const ww = games.find((g) => g.slug === 'wuthering-waves')!
    const [overview] = gameOverviews([ww], combos)
    expect(overview.directTests).toBe(3)
    // The repost is a duplicate and is not counted.
    expect(overview.externalReports).toBe(1)

    const eight = combos.find((c) => c.gameId === ww.id && c.directTests === 2)!
    const triggers = eight.summaries.find((s) => s.control === 'triggers')!
    expect(triggers.state).toBe('conflicting')
    expect(triggers.external).toEqual({ works: 0, broken: 1 })
  })

  it('support search by game alias, controller and device', async () => {
    expect((await search(t.sql, 'wuwa', true)).games.map((g) => g.slug)).toEqual(['wuthering-waves'])
    expect((await search(t.sql, 'DualSense', true)).families.map((f) => f.slug)).toEqual(['sony-dualsense'])
    expect((await search(t.sql, '8bitdo', true)).families.length).toBe(3)
    const combo = await search(t.sql, 'dualsense genshin', true)
    expect(combo.combinations.map((c) => `${c.game.slug}/${c.family.slug}`)).toEqual(['genshin-impact/sony-dualsense'])
    expect((await search(t.sql, 'SM-S931B', true)).devices.length).toBe(1)
    expect((await search(t.sql, 'SM-S931B', false)).devices.length).toBe(0)
    expect((await search(t.sql, '%', true)).games).toEqual([])
  })
})
