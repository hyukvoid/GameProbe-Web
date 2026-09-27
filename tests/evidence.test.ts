import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { needsVerification } from '@/lib/aggregate'
import { addEvidenceSource, funnel, getEvidenceSource, reviewEvidence } from '@/lib/data/admin'
import { combine, listDirectTests, listEvidenceItems, listExternalReports, listVerificationRequests } from '@/lib/data/public'
import { parseEvidenceAdd, parseEvidenceReview, type EvidenceReview } from '@/lib/validation'
import { createTestDb, form, ids, type TestDb } from './helpers/db'

let t: TestDb
let id: Awaited<ReturnType<typeof ids>>
let variantFamily: (v: string) => string | undefined

beforeAll(async () => {
  t = await createTestDb()
  id = await ids(t.sql)
  const variants = await t.sql<{ id: string; family_id: string }[]>`select id::text, family_id::text from controller_variants`
  variantFamily = (v) => variants.find((x) => x.id === v)?.family_id
})
afterAll(() => t.close())
beforeEach(async () => {
  await t.sql`delete from evidence_sources`
})

const scope = { includeDemo: false }

async function add(url: string) {
  const parsed = parseEvidenceAdd(form({ url, title: '', excerpt: '', publishedOn: '', sourceType: '' }))
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors))
  const r = await addEvidenceSource(t.sql, parsed.value)
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.id
}

function review(values: Record<string, string>): EvidenceReview {
  const r = parseEvidenceReview(
    form({ sourceType: 'reddit', isReport: 'yes', gameId: id.game('wuthering-waves').id, ...values }),
    variantFamily,
  )
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.value
}

describe('Evidence Inbox', () => {
  it('adds URLs as new, private items and detects the same page added twice', async () => {
    const first = await add('https://www.reddit.com/r/WutheringWaves/comments/abc/rt_broken/')
    const parsed = parseEvidenceAdd(
      form({ url: 'https://old.reddit.com/r/WutheringWaves/comments/abc/rt_broken?utm_source=share', title: '', excerpt: '', publishedOn: '', sourceType: '' }),
    )
    if (!parsed.ok) throw new Error('parse')
    const again = await addEvidenceSource(t.sql, parsed.value)
    expect(!again.ok && again.existingId).toBe(first)

    const detail = await getEvidenceSource(t.sql, first)
    expect(detail).toMatchObject({ reviewStatus: 'new', sourceType: 'reddit', isReport: null })
    expect(await listExternalReports(t.sql, scope)).toEqual([])
  })

  it('publishes a limited external claim without upgrading a vague controller to a model', async () => {
    const src = await add('https://forum.example.org/t/1')
    const r = await reviewEvidence(
      t.sql,
      src,
      review({
        action: 'publish',
        controller: `family:${id.family('8bitdo-ultimate').id}`,
        controllerAsWritten: '8BitDo Ultimate',
        claimSummary: 'RT does not respond in combat.',
        result_triggers: 'broken',
        connection: 'bluetooth',
      }),
    )
    expect(r.ok).toBe(true)

    const [report] = await listExternalReports(t.sql, scope)
    expect(report).toMatchObject({
      familyName: '8BitDo Ultimate',
      variantName: null,
      controllerAsWritten: '8BitDo Ultimate',
      gameVersion: null,
      connection: 'bluetooth',
      claims: [{ control: 'triggers', result: 'broken', statement: 'RT does not respond in combat.' }],
    })
    expect(report.missing).toContain('Exact controller model')
    expect(report.missing).toContain('Game version')

    const [combo] = combine(await listEvidenceItems(t.sql, scope))
    const triggers = combo.summaries.find((s) => s.control === 'triggers')!
    expect(triggers.state).toBe('reported_broken')
    expect(triggers.direct).toEqual({ works: 0, broken: 0 })
    expect(combo.directTests).toBe(0)
    expect(combo.externalReports).toBe(1)
  })

  it('keeps "needs direct test" items out of external counts and lists them for verification', async () => {
    const src = await add('https://www.youtube.com/watch?v=abc')
    await reviewEvidence(
      t.sql,
      src,
      review({
        action: 'needs_direct_test',
        controller: `family:${id.family('8bitdo-ultimate-2c').id}`,
        claimSummary: 'A and B appear swapped in menus.',
        result_face_buttons: 'broken',
      }),
    )
    expect(await listExternalReports(t.sql, scope)).toEqual([])
    expect(await listEvidenceItems(t.sql, scope)).toEqual([])
    const requests = await listVerificationRequests(t.sql, scope)
    expect(requests.map((r) => r.claims[0].statement)).toEqual(['A and B appear swapped in menus.'])
  })

  it('removes public claims when a published source is rejected or turned into a lead', async () => {
    const src = await add('https://forum.example.org/t/2')
    const publish = review({
      action: 'publish',
      controller: `family:${id.family('sony-dualsense').id}`,
      claimSummary: 'Works.',
      result_menu: 'works',
    })
    await reviewEvidence(t.sql, src, publish)
    expect((await listExternalReports(t.sql, scope)).length).toBe(1)

    await reviewEvidence(t.sql, src, { ...publish, action: 'reject' })
    expect(await listExternalReports(t.sql, scope)).toEqual([])

    await reviewEvidence(t.sql, src, publish)
    await reviewEvidence(t.sql, src, { ...publish, action: 'lead' })
    expect(await listExternalReports(t.sql, scope)).toEqual([])
    const [{ n }] = await t.sql`select count(*)::int as n from evidence_claims`
    expect(n).toBe(0)
  })

  it('merges duplicates so copied reports are not counted as independent evidence', async () => {
    const family = `family:${id.family('8bitdo-ultimate-2').id}`
    const original = await add('https://forum.example.org/t/original')
    const copy = await add('https://blog.example.net/copied-post')
    const publish = review({ action: 'publish', controller: family, claimSummary: 'RT broken.', result_triggers: 'broken' })
    await reviewEvidence(t.sql, original, publish)
    await reviewEvidence(t.sql, copy, publish)
    expect(combine(await listEvidenceItems(t.sql, scope))[0].externalReports).toBe(2)

    const merged = await reviewEvidence(t.sql, copy, { ...publish, action: 'duplicate', duplicateOf: 'https://forum.example.org/t/original' })
    expect(merged.ok).toBe(true)
    expect(combine(await listEvidenceItems(t.sql, scope))[0].externalReports).toBe(1)
    expect((await getEvidenceSource(t.sql, copy))?.duplicateOfId).toBe(original)

    // A duplicate of a duplicate points at the original.
    const third = await add('https://another.example.net/copy')
    await reviewEvidence(t.sql, third, { ...publish, action: 'duplicate', duplicateOf: copy })
    expect((await getEvidenceSource(t.sql, third))?.duplicateOfId).toBe(original)

    const self = await reviewEvidence(t.sql, original, { ...publish, action: 'duplicate', duplicateOf: original })
    expect(self.ok).toBe(false)
  })

  it('refuses at the database level to publish something not marked as a report', async () => {
    const src = await add('https://forum.example.org/t/3')
    await expect(
      t.sql`update evidence_sources set review_status = 'published', is_report = false where id = ${src}`,
    ).rejects.toThrow()
    await expect(
      t.sql`update evidence_sources set game_version = 'latest' where id = ${src}`,
    ).rejects.toThrow()
  })

  it('reports the cold-start funnel', async () => {
    const family = `family:${id.family('sony-dualsense').id}`
    const a = await add('https://forum.example.org/f/1')
    const b = await add('https://forum.example.org/f/2')
    await add('https://forum.example.org/f/3')
    await reviewEvidence(
      t.sql,
      a,
      review({
        action: 'publish',
        controller: `variant:${id.variant('dualsense-wireless-controller').id}`,
        gameVersion: '2.8.1',
        claimSummary: 'Works.',
        result_menu: 'works',
      }),
    )
    await reviewEvidence(t.sql, b, review({ action: 'reject', isReport: 'no', controller: family }))
    expect(await funnel(t.sql)).toMatchObject({
      candidateUrls: 3,
      reviewed: 2,
      actualReports: 1,
      withExactController: 1,
      withGameVersion: 1,
      publishedSources: 1,
      rejected: 1,
    })
  })
})

describe('controller support evidence', () => {
  it('publishes a source that names no controller without inventing a controller', async () => {
    const src = await add('https://www.androidpolice.com/genshin-impact-finally-adds-controller-support-to-android')
    const r = await reviewEvidence(
      t.sql,
      src,
      review({
        action: 'publish',
        controller: '',
        controllerAsWritten: '',
        connection: 'usb',
        androidVersion: '',
        claimSummary: 'The Android version of the game accepts controllers.',
        result_controller_support: 'works',
      }),
    )
    expect(r.ok).toBe(true)

    const reports = await listExternalReports(t.sql, scope)
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({
      familySlug: null,
      familyName: null,
      connection: 'usb',
      claims: [
        {
          control: 'controller_support',
          result: 'works',
          connection: 'usb',
          statement: 'The Android version of the game accepts controllers.',
        },
      ],
    })
    expect(reports[0].missing).toContain('Exact controller model')
    expect(reports[0].missing).not.toContain('Connection')

    // Family-less evidence never becomes a controller row and never looks like a test.
    expect(await listEvidenceItems(t.sql, scope)).toEqual([])
    expect(combine(await listEvidenceItems(t.sql, scope))).toEqual([])
    expect(await listDirectTests(t.sql, scope)).toEqual([])
  })

  it('lists an unverified controller support claim for a direct test', async () => {
    const src = await add('https://www.tomsguide.com/phones/android-phones/genshin-impact-android-controller')
    await reviewEvidence(
      t.sql,
      src,
      review({
        action: 'needs_direct_test',
        controller: '',
        connection: 'bluetooth',
        claimSummary: 'The game accepts controllers over Bluetooth only.',
        result_controller_support: 'works',
      }),
    )
    expect(await listExternalReports(t.sql, scope)).toEqual([])
    const requests = await listVerificationRequests(t.sql, scope)
    expect(requests).toHaveLength(1)
    expect(requests[0].claims[0].control).toBe('controller_support')
    expect(requests[0].claims[0].connection).toBe('bluetooth')
  })

  it('summarises controller support for a controller a source does name', async () => {
    const src = await add(
      'https://support.hoyoverse.com/hc/en-us/articles/50333944370969-what-controllers-are-officially-supported',
    )
    const r = await reviewEvidence(
      t.sql,
      src,
      review({
        action: 'publish',
        controller: `family:${id.family('sony-dualsense').id}`,
        controllerAsWritten: 'DualSense Wireless Controller',
        connection: 'bluetooth',
        androidVersion: '16',
        claimSummary: 'Listed as supported on Android via Bluetooth.',
        result_controller_support: 'works',
      }),
    )
    expect(r.ok).toBe(true)

    const [combo] = combine(await listEvidenceItems(t.sql, scope))
    expect(combo.externalReports).toBe(1)
    const support = combo.summaries.find((s) => s.control === 'controller_support')
    expect(support).toMatchObject({ state: 'reported_works', external: { works: 1, broken: 0 } })
    // Known only from external evidence, so it is asked for as a direct test.
    expect(needsVerification(support!)).toBe(true)
    // Exactly one support row, and the eight physical controls keep their own state.
    expect(combo.summaries.filter((s) => s.control === 'controller_support')).toHaveLength(1)
    expect(combo.summaries.find((s) => s.control === 'triggers')?.state).toBe('no_data')
  })
})
