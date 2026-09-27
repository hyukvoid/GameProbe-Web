import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { listTestsByStatus, moderateTest } from '@/lib/data/admin'
import { combine, listDirectTests, listEvidenceItems } from '@/lib/data/public'
import { createTestSession, MAX_SUBMISSIONS_PER_HOUR } from '@/lib/data/submissions'
import { parseTestSubmission, type TestSubmission } from '@/lib/validation'
import { createTestDb, form, ids, type TestDb } from './helpers/db'

let t: TestDb
let id: Awaited<ReturnType<typeof ids>>

beforeAll(async () => {
  t = await createTestDb()
  id = await ids(t.sql)
})
afterAll(() => t.close())
beforeEach(async () => {
  await t.sql`delete from test_sessions`
})

function parsed(values: Record<string, string>): TestSubmission {
  const r = parseTestSubmission(
    form({ game: 'wuthering-waves', testedOn: '2026-09-27', website: '', ...values }),
    new Date('2026-09-27T12:00:00Z'),
  )
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.value
}

const scope = { includeDemo: false }

describe('direct test submission', () => {
  it('stores a submission as pending and keeps it off public pages', async () => {
    const input = parsed({ controller: `family:${id.family('sony-dualsense').id}`, result_triggers: 'broken' })
    const r = await createTestSession(t.sql, input, { submitterKey: 'k1' })
    expect(r.ok && r.id).toBeTruthy()

    const [row] = await t.sql`select status from test_sessions`
    expect(row.status).toBe('pending')
    expect(await listDirectTests(t.sql, scope)).toEqual([])
    expect(await listEvidenceItems(t.sql, scope)).toEqual([])
    expect((await listTestsByStatus(t.sql, 'pending')).length).toBe(1)
  })

  it('becomes public only after approval, and disappears again when rejected', async () => {
    const r = await createTestSession(
      t.sql,
      parsed({ controller: `family:${id.family('sony-dualsense').id}`, result_menu: 'works' }),
      { submitterKey: null },
    )
    if (!r.ok || !r.id) throw new Error('submit failed')

    await moderateTest(t.sql, { id: r.id, decision: 'approve', note: null, controller: { kind: 'none' } })
    expect((await listDirectTests(t.sql, scope)).map((d) => d.id)).toEqual([r.id])

    await moderateTest(t.sql, { id: r.id, decision: 'reject', note: 'Spam', controller: { kind: 'none' } })
    expect(await listDirectTests(t.sql, scope)).toEqual([])
  })

  it('preserves unknown values as null all the way to the public record', async () => {
    const r = await createTestSession(
      t.sql,
      parsed({ controller: `family:${id.family('8bitdo-ultimate-2').id}`, result_triggers: 'broken' }),
      { submitterKey: null },
    )
    if (!r.ok || !r.id) throw new Error('submit failed')
    await moderateTest(t.sql, { id: r.id, decision: 'approve', note: null, controller: { kind: 'none' } })
    const [test] = await listDirectTests(t.sql, scope)
    expect(test).toMatchObject({
      gameVersion: null,
      variantName: null,
      deviceName: null,
      deviceModel: null,
      androidVersion: null,
      connection: null,
      controllerMode: null,
      familyName: '8BitDo Ultimate 2',
    })
    expect(test.observations).toEqual([{ control: 'triggers', result: 'broken' }])
  })

  it('links a chosen model to its family and records the exact game version', async () => {
    const variant = id.variant('8bitdo-ultimate-2-wireless')
    const r = await createTestSession(
      t.sql,
      parsed({ controller: `variant:${variant.id}`, gameVersion: '2.8.1', result_triggers: 'works' }),
      { submitterKey: null },
    )
    if (!r.ok || !r.id) throw new Error('submit failed')
    const [row] = await t.sql`
      select s.controller_family_id::text, b.version from test_sessions s join game_builds b on b.id = s.game_build_id`
    expect(row).toEqual({ controller_family_id: variant.family_id, version: '2.8.1' })
  })

  it('rejects ids that are not in the catalog', async () => {
    const r = await createTestSession(
      t.sql,
      parsed({ controller: 'family:00000000-0000-4000-8000-000000000000', result_menu: 'works' }),
      { submitterKey: null },
    )
    expect(r.ok).toBe(false)
    const bad = await createTestSession(
      t.sql,
      { ...parsed({ controller: `family:${id.family('sony-dualsense').id}`, result_menu: 'works' }), gameSlug: 'minecraft' },
      { submitterKey: null },
    )
    expect(!bad.ok && bad.errors.game).toBeTruthy()
  })

  it('stores nothing when the honeypot is filled', async () => {
    const r = await createTestSession(
      t.sql,
      parsed({ controller: `family:${id.family('sony-dualsense').id}`, result_menu: 'works', website: 'x' }),
      { submitterKey: null },
    )
    expect(r).toEqual({ ok: true, id: null })
    const [{ n }] = await t.sql`select count(*)::int as n from test_sessions`
    expect(n).toBe(0)
  })

  it('limits submissions per network per hour', async () => {
    const input = parsed({ controller: `family:${id.family('sony-dualsense').id}`, result_menu: 'works' })
    for (let i = 0; i < MAX_SUBMISSIONS_PER_HOUR; i++) {
      expect((await createTestSession(t.sql, input, { submitterKey: 'same' })).ok).toBe(true)
    }
    const blocked = await createTestSession(t.sql, input, { submitterKey: 'same' })
    expect(!blocked.ok && blocked.errors.form).toMatch(/Too many/)
    expect((await createTestSession(t.sql, input, { submitterKey: 'other' })).ok).toBe(true)
  })

  it('keeps free-text controllers out of controller aggregates until a reviewer links them', async () => {
    const r = await createTestSession(
      t.sql,
      parsed({ controller: 'other', controllerOther: 'Unknown pad', result_menu: 'broken' }),
      { submitterKey: null },
    )
    if (!r.ok || !r.id) throw new Error('submit failed')
    await moderateTest(t.sql, { id: r.id, decision: 'approve', note: null, controller: { kind: 'none' } })
    expect(await listEvidenceItems(t.sql, scope)).toEqual([])
    expect((await listDirectTests(t.sql, scope))[0].controllerAsEntered).toBe('Unknown pad')

    const family = id.family('gamesir-g8')
    await moderateTest(t.sql, { id: r.id, decision: 'approve', note: null, controller: { kind: 'family', familyId: family.id } })
    const combos = combine(await listEvidenceItems(t.sql, scope))
    expect(combos.map((c) => c.familyId)).toEqual([family.id])
  })

  it('preserves contradictions between approved direct tests', async () => {
    const family = id.family('8bitdo-ultimate-2').id
    const a = await createTestSession(
      t.sql,
      parsed({ controller: `family:${family}`, connection: 'usb', result_triggers: 'works' }),
      { submitterKey: null },
    )
    const b = await createTestSession(
      t.sql,
      parsed({ controller: `family:${family}`, connection: 'bluetooth', result_triggers: 'broken' }),
      { submitterKey: null },
    )
    for (const r of [a, b]) {
      if (!r.ok || !r.id) throw new Error('submit failed')
      await moderateTest(t.sql, { id: r.id, decision: 'approve', note: null, controller: { kind: 'none' } })
    }
    const [combo] = combine(await listEvidenceItems(t.sql, scope))
    const triggers = combo.summaries.find((s) => s.control === 'triggers')!
    expect(triggers.state).toBe('conflicting')
    expect(triggers.direct).toEqual({ works: 1, broken: 1 })
    expect(triggers.differences[0]).toEqual({ dimension: 'connection', works: ['USB cable'], broken: ['Bluetooth'] })
  })
})
