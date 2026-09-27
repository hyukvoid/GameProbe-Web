import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addEvidenceSource, funnel, getEvidenceSource, reviewEvidence } from '@/lib/data/admin'
import { combine, listEvidenceItems, listExternalReports, listVerificationRequests } from '@/lib/data/public'
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
