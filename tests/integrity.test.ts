import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addEvidenceSource, moderateTest, reviewEvidence } from '@/lib/data/admin'
import { combine, listDirectTests, listEvidenceItems, listExternalReports } from '@/lib/data/public'
import { createTestSession } from '@/lib/data/submissions'
import { CONTROLS } from '@/lib/domain'
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

    // Find this test's own report: the catalog holds newer published sources first.
    const report = (await listExternalReports(t.sql, { includeDemo: false })).find(
      (r) => r.url === 'https://forum.example.org/integrity-flow',
    )
    expect(report).toMatchObject({ variantName: '8BitDo Ultimate 2 Wireless Controller', gameVersion: '2.8.1', androidVersion: '16' })
    const combo = combine(await listEvidenceItems(t.sql, { includeDemo: false })).find((c) => c.familyId === variant.family_id)
    expect(combo?.directTests).toBe(1)
    expect(combo?.externalReports).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Evidence claim subjects and condition scope (migration 0004).
// ---------------------------------------------------------------------------

describe('evidence claim subjects and condition scope', () => {
  let scopedSource: string

  beforeAll(async () => {
    const [{ id: src }] = await t.sql<{ id: string }[]>`
      insert into evidence_sources (url, url_key, source_type)
      values ('https://support.example.org/genshin-android-usb', 'support.example.org/genshin-android-usb', 'official')
      returning id::text`
    scopedSource = src
  })

  const scoped = (overrides: Record<string, unknown> = {}) => ({
    source_id: scopedSource,
    game_id: id.game('genshin-impact').id,
    controller_family_id: id.family('sony-dualsense').id,
    controller_variant_id: null,
    control: 'controller_support',
    result: 'works',
    statement: 'Controller support stated for Android.',
    visibility: 'published',
    ...overrides,
  })

  it('accepts controller_support and still accepts all eight direct-test controls', async () => {
    await t.sql`insert into evidence_claims ${t.sql(scoped())}`
    for (const control of CONTROLS) {
      await t.sql`insert into evidence_claims ${t.sql(scoped({ control, result: 'broken', statement: `${control} stated.` }))}`
    }
    const [{ n }] = await t.sql<{ n: number }[]>`
      select count(*)::int as n from evidence_claims where source_id = ${scopedSource}`
    expect(n).toBe(1 + CONTROLS.length)
  })

  it('refuses an exact repeat of the same scoped claim, even with different wording', async () => {
    await expect(t.sql`insert into evidence_claims ${t.sql(scoped())}`).rejects.toThrow(
      /evidence_claims_scope_key/,
    )
    await expect(
      t.sql`insert into evidence_claims ${t.sql(scoped({ statement: 'Same claim, reworded.' }))}`,
    ).rejects.toThrow(/evidence_claims_scope_key/)
    await expect(
      t.sql`insert into evidence_claims ${t.sql(scoped({ control: 'triggers', result: 'broken', statement: 'RT dead.' }))}`,
    ).rejects.toThrow(/evidence_claims_scope_key/)
  })

  it('accepts the same claim when one condition differs', async () => {
    const differences: Record<string, unknown>[] = [
      { connection_type: 'usb' },
      { android_version: '16' },
      { game_version: '5.5' },
      { controller_mode: 'XInput' },
      { controller_family_id: id.family('sony-dualshock-4').id },
      { controller_variant_id: id.variant('dualsense-wireless-controller').id },
    ]
    for (const diff of differences) {
      await t.sql`insert into evidence_claims ${t.sql(scoped(diff))}`
    }
    const [{ n }] = await t.sql<{ n: number }[]>`
      select count(*)::int as n from evidence_claims where source_id = ${scopedSource}`
    expect(n).toBe(1 + CONTROLS.length + differences.length)
  })

  it('accepts a claim when the source names no controller', async () => {
    await t.sql`insert into evidence_claims ${t.sql(scoped({ controller_family_id: null, statement: 'No controller named.' }))}`
    const [{ n }] = await t.sql<{ n: number }[]>`
      select count(*)::int as n from evidence_claims
      where source_id = ${scopedSource} and controller_family_id is null`
    expect(n).toBe(1)
  })

  it('separates two controllers that normalize to the same family by their wording', async () => {
    // Both name the same family with no model number, because the source states none:
    // the wording column is the only thing that tells them apart.
    const claim = (controllerAsWritten: string) => ({
      source_id: scopedSource,
      game_id: id.game('genshin-impact').id,
      controller_family_id: id.family('xbox-wireless-controller').id,
      controller_variant_id: null,
      controller_as_written: controllerAsWritten,
      control: 'controller_support',
      result: 'works',
      statement: 'Controller support stated for Android over Bluetooth.',
      visibility: 'published',
      android_version: '9.0',
      connection_type: 'bluetooth',
    })
    const pad = claim('Xbox Wireless Controller')
    const elite = claim('Xbox Elite Wireless Controller Series 2')

    await t.sql`insert into evidence_claims ${t.sql(pad)}`
    await t.sql`insert into evidence_claims ${t.sql(elite)}`

    const [{ n }] = await t.sql<{ n: number }[]>`
      select count(*)::int as n from evidence_claims
      where source_id = ${scopedSource} and controller_family_id = ${id.family('xbox-wireless-controller').id}`
    expect(n).toBe(2)

    // The exact same row is still a duplicate.
    await expect(t.sql`insert into evidence_claims ${t.sql(pad)}`).rejects.toThrow(/evidence_claims_scope_key/)
  })
})

// ---------------------------------------------------------------------------
// Detection, recorded by the tester and never derived from the observations.
// ---------------------------------------------------------------------------

describe('controller_detected on a direct test', () => {
  const insert = (detected: boolean | null) =>
    t.sql<{ id: string; controller_detected: boolean | null }[]>`
      insert into test_sessions (game_id, controller_family_id, tested_on, controller_detected)
      values (${id.game('genshin-impact').id}, ${id.family('sony-dualsense').id}, '2026-09-27', ${detected})
      returning id::text, controller_detected`

  it('accepts true, false and null', async () => {
    expect((await insert(true))[0]).toMatchObject({ controller_detected: true })
    expect((await insert(false))[0]).toMatchObject({ controller_detected: false })
    expect((await insert(null))[0]).toMatchObject({ controller_detected: null })

    // An unanswered field stays NULL, which means "unknown", not "no".
    const [{ controller_detected: unanswered }] = await t.sql<{ controller_detected: boolean | null }[]>`
      insert into test_sessions (game_id, controller_family_id, tested_on)
      values (${id.game('genshin-impact').id}, ${id.family('sony-dualsense').id}, '2026-09-27')
      returning controller_detected`
    expect(unanswered).toBe(null)
  })

  it('keeps detection independent of the control results', async () => {
    // Detected, but the triggers are broken: both are stored as stated.
    const [detected] = await insert(true)
    await t.sql`insert into test_observations (session_id, control, result) values (${detected.id}, 'triggers', 'broken')`
    const [row] = await t.sql<{ controller_detected: boolean | null; observations: number }[]>`
      select s.controller_detected, count(o.control)::int as observations
      from test_sessions s left join test_observations o on o.session_id = s.id
      where s.id = ${detected.id}
      group by s.controller_detected`
    expect(row).toEqual({ controller_detected: true, observations: 1 })

    // Not detected, with no control tested at all: still a complete, valid test.
    const [undetected] = await insert(false)
    const [observations] = await t.sql<{ observations: number }[]>`
      select count(*)::int as observations from test_observations where session_id = ${undetected.id}`
    expect(observations.observations).toBe(0)
    const [{ controller_detected }] = await t.sql<{ controller_detected: boolean | null }[]>`
      select controller_detected from test_sessions where id = ${undetected.id}`
    expect(controller_detected).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// External report grouping: one record per source per controller.
// ---------------------------------------------------------------------------

describe('external report grouping', () => {
  const scope = { includeDemo: false }
  const xboxFamily = 'xbox-wireless-controller'
  let named: string // one source naming two controllers of the same family
  let unnamed: string // one source naming no controller, but two transports

  beforeAll(async () => {
    const game = id.game('genshin-impact').id
    const [a] = await t.sql<{ id: string }[]>`
      insert into evidence_sources (url, url_key, source_type, review_status, is_report, game_id)
      values ('https://example.org/xbox-controllers', 'example.org/xbox-controllers', 'official', 'published', true, ${game})
      returning id::text`
    const [b] = await t.sql<{ id: string }[]>`
      insert into evidence_sources (url, url_key, source_type, review_status, is_report, game_id)
      values ('https://example.org/android-controller-support', 'example.org/android-controller-support', 'article', 'published', true, ${game})
      returning id::text`
    named = a.id
    unnamed = b.id

    const claim = (
      source: string,
      wording: string | null,
      connection: string | null,
      statement: string,
    ) => t.sql`
      insert into evidence_claims (
        source_id, game_id, controller_family_id, controller_variant_id, controller_as_written,
        android_version, connection_type, control, result, statement, visibility
      )
      select ${source}, ${game}, ${wording === null ? null : id.family(xboxFamily).id}, null, ${wording},
             '9.0', ${connection}, 'controller_support', 'works', ${statement}, 'published'`

    // Both normalize to the same family with a NULL variant: only the wording differs.
    await claim(named, 'Xbox Wireless Controller', 'bluetooth', 'Controller support stated for Xbox Wireless Controller.')
    await claim(
      named,
      'Xbox Elite Wireless Controller Series 2',
      'bluetooth',
      'Controller support stated for Xbox Elite Wireless Controller Series 2.',
    )
    // Family-less: the same subject over two transports.
    await claim(unnamed, null, 'bluetooth', 'The game accepts controllers over Bluetooth.')
    await claim(unnamed, null, 'usb', 'The game accepts controllers over USB.')
  })

  it('keeps two controllers of one source in the same family as two records', async () => {
    const reports = (await listExternalReports(t.sql, scope)).filter((r) => r.sourceId === named)
    expect(reports).toHaveLength(2)
    expect(reports.map((r) => r.controllerAsWritten).sort()).toEqual([
      'Xbox Elite Wireless Controller Series 2',
      'Xbox Wireless Controller',
    ])
    for (const r of reports) {
      expect(r.familySlug).toBe(xboxFamily)
      expect(r.variantName).toBe(null)
      expect(r.claims).toHaveLength(1)
    }
    // Distinct, stable identities for React keys: source + family + controller identity.
    expect(reports.map((r) => r.recordKey).sort()).toEqual(
      [
        `${named}|${xboxFamily}|Xbox Wireless Controller`,
        `${named}|${xboxFamily}|Xbox Elite Wireless Controller Series 2`,
      ].sort(),
    )
  })

  it('keeps a family-less source with two transports in one record', async () => {
    const reports = (await listExternalReports(t.sql, scope)).filter((r) => r.sourceId === unnamed)
    expect(reports).toHaveLength(1)
    const [report] = reports
    expect(report.familySlug).toBe(null)
    expect(report.familyName).toBe(null)
    expect(report.controllerAsWritten).toBe(null)
    expect(report.claims.map((c) => c.connection).sort()).toEqual(['bluetooth', 'usb'])
    // No single transport is stated for the record as a whole; each claim keeps its own.
    expect(report.connection).toBe(null)
    expect(report.recordKey).toBe(`${unnamed}||`)
    // Nothing is missing on the transport dimension.
    expect(report.missing).not.toContain('Connection')
  })

  it('leaves the existing aggregation unchanged', async () => {
    const items = await listEvidenceItems(t.sql, scope)

    // The family-less source never becomes a controller row.
    expect(items.filter((i) => i.origin === unnamed)).toEqual([])

    const genshin = id.game('genshin-impact').id
    const xbox = combine(items).find(
      (c) => c.gameId === genshin && c.familyId === id.family(xboxFamily).id,
    )
    const [{ n }] = await t.sql<{ n: number }[]>`
      select count(distinct c.source_id)::int as n
      from evidence_claims c
      join evidence_sources s on s.id = c.source_id
      where c.controller_family_id = ${id.family(xboxFamily).id}
        and c.game_id = ${genshin}
        and c.visibility = 'published' and not c.is_demo and s.review_status = 'published'`
    // Two wording records from one source still count as one external report.
    expect(xbox?.externalReports).toBe(n)
    expect(xbox?.directTests).toBe(0)
    // Summary shape is unchanged: the eight physical controls plus the support subject.
    expect(xbox?.summaries).toHaveLength(9)
    expect(xbox?.summaries.find((s) => s.control === 'controller_support')?.state).toBe('reported_works')
    expect(xbox?.summaries.find((s) => s.control === 'triggers')?.state).toBe('no_data')
  })
})
