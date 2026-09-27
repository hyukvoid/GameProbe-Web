import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addEvidenceSource, moderateTest, reviewEvidence } from '@/lib/data/admin'
import { combine, listDirectTests, listEvidenceItems, listExternalReports } from '@/lib/data/public'
import { createTestSession } from '@/lib/data/submissions'
import { parseEvidenceAdd, parseEvidenceReview, parseTestSubmission } from '@/lib/validation'
import { createTestDb, form, ids, type TestDb } from './helpers/db'

// These checks bypass the application and write directly to the database, to prove the
// relationships hold even if a code path forgets to validate them.

let t: TestDb
let id: Awaited<ReturnType<typeof ids>>
let genshinBuild: string
let sourceId: string

const violates = (constraint: string) => new RegExp(`violates (foreign key|check) constraint "${constraint}"`)

beforeAll(async () => {
  t = await createTestDb()
  id = await ids(t.sql)
  ;[{ id: genshinBuild }] = await t.sql<{ id: string }[]>`
    insert into game_builds (game_id, version) values (${id.game('genshin-impact').id}, '6.1.0') returning id::text`
  ;[{ id: sourceId }] = await t.sql<{ id: string }[]>`
    insert into evidence_sources (url, url_key, source_type)
    values ('https://forum.example.org/integrity', 'forum.example.org/integrity', 'forum') returning id::text`
})
afterAll(() => t.close())

function claim(overrides: Record<string, unknown>) {
  return {
    source_id: sourceId,
    game_id: id.game('wuthering-waves').id,
    controller_family_id: id.family('8bitdo-ultimate-2').id,
    controller_variant_id: null,
    control: 'triggers',
    result: 'broken',
    statement: 'RT does not respond.',
    visibility: 'published',
    ...overrides,
  }
}

describe('controller model must belong to its family', () => {
  const dualsense = () => id.family('sony-dualsense').id
  const eightBitDoModel = () => id.variant('8bitdo-ultimate-2-wireless').id

  it('rejects a DualSense family with an 8BitDo model in a test session', async () => {
    await expect(t.sql`
      insert into test_sessions (game_id, controller_family_id, controller_variant_id, tested_on)
      values (${id.game('wuthering-waves').id}, ${dualsense()}, ${eightBitDoModel()}, '2026-09-27')`).rejects.toThrow(violates('test_sessions_variant_family_fkey'))
  })

  it('rejects the same mismatch on an evidence source and an evidence claim', async () => {
    await expect(t.sql`
      update evidence_sources set controller_family_id = ${dualsense()}, controller_variant_id = ${eightBitDoModel()}
      where id = ${sourceId}`).rejects.toThrow(violates('evidence_sources_variant_family_fkey'))
    await expect(
      t.sql`insert into evidence_claims ${t.sql(claim({ controller_family_id: dualsense(), controller_variant_id: eightBitDoModel() }))}`,
    ).rejects.toThrow(violates('evidence_claims_variant_family_fkey'))
  })

  it('rejects a model with no family on an evidence source', async () => {
    await expect(t.sql`
      update evidence_sources set controller_family_id = null, controller_variant_id = ${eightBitDoModel()}
      where id = ${sourceId}`).rejects.toThrow(violates('evidence_sources_variant_needs_family'))
  })

  it('still accepts a family without a model, and a matching pair', async () => {
    await t.sql`update evidence_sources set controller_family_id = ${dualsense()}, controller_variant_id = null where id = ${sourceId}`
    const variant = id.variant('dualsense-wireless-controller')
    await t.sql`
      update evidence_sources set controller_family_id = ${variant.family_id}, controller_variant_id = ${variant.id}
      where id = ${sourceId}`
  })
})

describe('game build must belong to the tested game', () => {
  it('rejects a Genshin Impact build on a Wuthering Waves test session', async () => {
    await expect(t.sql`
      insert into test_sessions (game_id, game_build_id, controller_family_id, tested_on)
      values (${id.game('wuthering-waves').id}, ${genshinBuild}, ${id.family('sony-dualsense').id}, '2026-09-27')`).rejects.toThrow(violates('test_sessions_build_game_fkey'))
  })

  it('accepts the build on its own game', async () => {
    await t.sql`
      insert into test_sessions (game_id, game_build_id, controller_family_id, tested_on)
      values (${id.game('genshin-impact').id}, ${genshinBuild}, ${id.family('sony-dualsense').id}, '2026-09-27')`
  })
})

describe('evidence claim version formats', () => {
  it('rejects game_version = latest', async () => {
    await expect(t.sql`insert into evidence_claims ${t.sql(claim({ game_version: 'latest' }))}`).rejects.toThrow(violates('evidence_claims_game_version_format'))
  })

  it('rejects android_version = Android 16', async () => {
    await expect(
      t.sql`insert into evidence_claims ${t.sql(claim({ control: 'menu', android_version: 'Android 16' }))}`,
    ).rejects.toThrow(violates('evidence_claims_android_version_format'))
  })

  it('accepts exact versions and unknown (null) versions', async () => {
    await t.sql`insert into evidence_claims ${t.sql(claim({ control: 'dpad', game_version: '2.8.1', android_version: '16' }))}`
    await t.sql`insert into evidence_claims ${t.sql(claim({ control: 'camera' }))}`
    await t.sql`delete from evidence_claims where source_id = ${sourceId}`
  })
})

describe('application flows under the new constraints', () => {
  it('submits, approves and publishes with exact models and builds', async () => {
    const variant = id.variant('8bitdo-ultimate-2-wireless')
    const parsed = parseTestSubmission(
      form({
        game: 'wuthering-waves',
        gameVersion: '2.8.1',
        controller: `variant:${variant.id}`,
        androidVersion: '16',
        testedOn: '2026-09-27',
        result_triggers: 'broken',
        website: '',
      }),
      new Date('2026-09-27T12:00:00Z'),
    )
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors))
    const submitted = await createTestSession(t.sql, parsed.value, { submitterKey: null })
    if (!submitted.ok || !submitted.id) throw new Error('submit failed')

    // Relinking to a different family's model through moderation keeps the pair consistent.
    const dualsenseModel = id.variant('dualsense-wireless-controller')
    await moderateTest(t.sql, {
      id: submitted.id,
      decision: 'approve',
      note: null,
      controller: { kind: 'variant', variantId: dualsenseModel.id },
    })
    const [row] = await t.sql`
      select controller_family_id::text, controller_variant_id::text from test_sessions where id = ${submitted.id}`
    expect(row).toEqual({ controller_family_id: dualsenseModel.family_id, controller_variant_id: dualsenseModel.id })
    await moderateTest(t.sql, { id: submitted.id, decision: 'approve', note: null, controller: { kind: 'variant', variantId: variant.id } })
    expect((await listDirectTests(t.sql, { includeDemo: false })).some((d) => d.id === submitted.id)).toBe(true)

    const added = parseEvidenceAdd(
      form({ url: 'https://forum.example.org/integrity-flow', title: '', excerpt: '', publishedOn: '', sourceType: '' }),
    )
    if (!added.ok) throw new Error('parse')
    const source = await addEvidenceSource(t.sql, added.value)
    if (!source.ok) throw new Error('add failed')
    const variants = await t.sql<{ id: string; family_id: string }[]>`select id::text, family_id::text from controller_variants`
    const review = parseEvidenceReview(
      form({
        action: 'publish',
        isReport: 'yes',
        sourceType: 'forum',
        gameId: id.game('wuthering-waves').id,
        controller: `variant:${variant.id}`,
        gameVersion: '2.8.1',
        androidVersion: '16',
        claimSummary: 'RT broken over Bluetooth.',
        result_triggers: 'broken',
      }),
      (v) => variants.find((x) => x.id === v)?.family_id,
    )
    if (!review.ok) throw new Error(JSON.stringify(review.errors))
    expect((await reviewEvidence(t.sql, source.id, review.value)).ok).toBe(true)

    const [report] = await listExternalReports(t.sql, { includeDemo: false })
    expect(report).toMatchObject({ variantName: '8BitDo Ultimate 2 Wireless Controller', gameVersion: '2.8.1', androidVersion: '16' })
    const combo = combine(await listEvidenceItems(t.sql, { includeDemo: false })).find((c) => c.familyId === variant.family_id)
    expect(combo?.directTests).toBe(1)
    expect(combo?.externalReports).toBe(1)
  })
})
