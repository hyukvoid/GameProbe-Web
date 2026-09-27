import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { moderateTest } from '@/lib/data/admin'
import {
  listCompatibilityClaims,
  listDirectTests,
  listExternalReports,
  listVerificationRequests,
} from '@/lib/data/public'
import { createTestSession } from '@/lib/data/submissions'
import { connectionResultLabel, deriveCompatibility, type CompatibilityAnswer } from '@/lib/compatibility'
import type { ConnectionType } from '@/lib/domain'
import { parseTestSubmission } from '@/lib/validation'
import { createTestDb, form, ids, type TestDb } from './helpers/db'

// An in-memory database shaped like the reviewed Genshin Impact evidence
// (docs/genshin-android-usb-evidence-review.md). No production system is contacted.

let t: TestDb
let id: Awaited<ReturnType<typeof ids>>
const scope = { includeDemo: false }

type ClaimSeed = {
  family: string | null
  wording?: string | null
  connection: ConnectionType | null
  android?: string | null
  version?: string | null
  control?: string
  result?: 'works' | 'broken'
  statement: string
  visibility?: 'published' | 'needs_direct_test'
}

async function source(
  slug: string,
  game: string,
  sourceType: string,
  status: 'published' | 'needs_direct_test',
  claims: ClaimSeed[],
): Promise<string> {
  const [row] = await t.sql<{ id: string }[]>`
    insert into evidence_sources (url, url_key, source_type, review_status, is_report, game_id, published_on)
    values (${`https://${slug}/page`}, ${`${slug}/page`}, ${sourceType}, ${status}, true, ${id.game(game).id}, '2025-09-17')
    returning id::text`
  for (const c of claims) {
    await t.sql`
      insert into evidence_claims (
        source_id, game_id, controller_family_id, controller_as_written, connection_type, android_version,
        game_version, control, result, statement, visibility
      ) values (
        ${row.id}, ${id.game(game).id}, ${c.family ? id.family(c.family).id : null}, ${c.wording ?? null},
        ${c.connection}, ${c.android ?? null}, ${c.version ?? null}, ${c.control ?? 'controller_support'},
        ${c.result ?? 'works'}, ${c.statement}, ${c.visibility ?? status}
      )`
  }
  return row.id
}

async function answerFor(game: string, family: string): Promise<CompatibilityAnswer> {
  const s = { includeDemo: false, gameId: id.game(game).id, familyId: id.family(family).id }
  const [directTests, claims] = [await listDirectTests(t.sql, { ...s, limit: null }), await listCompatibilityClaims(t.sql, s)]
  return deriveCompatibility({ familyId: s.familyId, directTests, claims })
}

function at(a: CompatibilityAnswer, connection: ConnectionType) {
  return a.connections.find((c) => c.connection === connection)!
}

let hoyoverse: string
let androidPolice: string
let tomsGuide: string
let game8: string
let phandroid: string
let unverifiedUsb: string

beforeAll(async () => {
  t = await createTestDb()
  id = await ids(t.sql)

  hoyoverse = await source('support.hoyoverse.com', 'genshin-impact', 'official', 'published', [
    {
      family: 'sony-dualsense',
      wording: 'DualSense Wireless Controller',
      connection: 'bluetooth',
      android: '12.0',
      statement: 'Listed under "Android (via Bluetooth)" as supported, Android 12.0+.',
    },
    {
      family: 'sony-dualshock-4',
      wording: 'DUALSHOCK 4 Wireless Controller',
      connection: 'bluetooth',
      android: '10.0',
      statement: 'Listed under "Android (via Bluetooth)" as supported, Android 10.0+.',
    },
  ])
  androidPolice = await source('www.androidpolice.com', 'genshin-impact', 'article', 'published', [
    { family: null, connection: 'bluetooth', statement: 'Bluetooth and USB connections are supported.' },
    { family: null, connection: 'usb', statement: 'Bluetooth and USB connections are supported.' },
  ])
  tomsGuide = await source('www.tomsguide.com', 'genshin-impact', 'article', 'published', [
    { family: null, connection: 'bluetooth', version: '5.5', statement: 'Controllers are stated to require Bluetooth.' },
  ])
  game8 = await source('game8.co', 'genshin-impact', 'article', 'published', [
    {
      family: 'sony-dualsense',
      wording: 'DualSense Wireless Controller',
      connection: null,
      android: '12.0',
      statement: 'Listed under "Supported Controllers - Android", Android 12.0 and above.',
    },
  ])
  phandroid = await source('phandroid.com', 'genshin-impact', 'article', 'published', [
    { family: null, connection: null, statement: 'Controller support is live on Android.' },
  ])
  unverifiedUsb = await source('www.youtube.com', 'genshin-impact', 'youtube', 'needs_direct_test', [
    { family: 'sony-dualsense', connection: 'usb', statement: 'A DualSense appears to work over a USB cable.' },
  ])
})
afterAll(() => t.close())

describe('Genshin Impact × DualSense, from reviewed evidence', () => {
  it('reads only this family and game-wide claims, and never verification requests', async () => {
    const claims = await listCompatibilityClaims(t.sql, {
      includeDemo: false,
      gameId: id.game('genshin-impact').id,
      familyId: id.family('sony-dualsense').id,
    })
    const origins = new Set(claims.map((c) => c.sourceId))
    expect(origins).toEqual(new Set([hoyoverse, androidPolice, tomsGuide, game8, phandroid]))
    expect(claims.some((c) => c.controllerAsWritten === 'DUALSHOCK 4 Wireless Controller')).toBe(false)
    expect(claims.some((c) => c.sourceId === unverifiedUsb)).toBe(false)
  })

  it('Bluetooth: officially reported supported, from the controller-specific source only', async () => {
    const bt = at(await answerFor('genshin-impact', 'sony-dualsense'), 'bluetooth')
    expect(bt).toMatchObject({ result: 'working', basis: 'external', externalDisagrees: false })
    expect(connectionResultLabel(bt)).toBe('Officially reported supported')
    // Game8 states no transport, so it does not raise the Bluetooth count.
    expect(bt.totals).toEqual({ direct: 0, official: 1, external: 0 })
    expect(bt.evidence).toHaveLength(1)
    expect(bt.evidence[0]).toMatchObject({
      origin: hoyoverse,
      kind: 'official',
      controller: { level: 'wording', wording: 'DualSense Wireless Controller' },
      connection: 'bluetooth',
      androidVersion: '12.0',
      gameVersion: null,
      controllerMode: null,
    })
    // Game-wide reports sit beside it without being counted.
    expect(new Set(bt.gameWide.map((g) => g.origin))).toEqual(new Set([androidPolice, tomsGuide]))
  })

  it('USB: no controller-specific evidence, with the game-wide USB report as context', async () => {
    const usb = at(await answerFor('genshin-impact', 'sony-dualsense'), 'usb')
    expect(usb).toMatchObject({ result: 'none', basis: null, evidence: [] })
    expect(usb.totals).toEqual({ direct: 0, official: 0, external: 0 })
    expect(connectionResultLabel(usb)).toBe('No controller-specific evidence')
    expect(usb.gameWide.map((g) => [g.origin, g.controller.level])).toEqual([[androidPolice, 'unspecified']])
  })

  it('Dongle: no controller-specific evidence and no context', async () => {
    const dongle = at(await answerFor('genshin-impact', 'sony-dualsense'), 'dongle')
    expect(dongle).toMatchObject({ result: 'none', evidence: [], gameWide: [] })
  })

  it('keeps connection-less evidence apart, and has no per-control rows', async () => {
    const a = await answerFor('genshin-impact', 'sony-dualsense')
    expect(a.connectionNotStated.evidence.map((e) => e.origin)).toEqual([game8])
    expect(a.connectionNotStated.gameWide.map((e) => e.origin)).toEqual([phandroid])
    expect(a.controls).toEqual([])
  })

  it('answers another family from its own claim, not from DualSense evidence', async () => {
    const a = await answerFor('genshin-impact', 'sony-dualshock-4')
    expect(at(a, 'bluetooth').evidence.map((e) => e.controller)).toEqual([
      { level: 'wording', wording: 'DUALSHOCK 4 Wireless Controller' },
    ])
    expect(a.connectionNotStated.evidence).toEqual([])
    // A family with no claims of its own gets game-wide context only.
    const xbox = await answerFor('genshin-impact', 'xbox-wireless-controller')
    for (const c of xbox.connections) expect(c.result).toBe('none')
    expect(at(xbox, 'usb').gameWide).toHaveLength(1)
  })

  it('leaves the raw evidence lists unchanged', async () => {
    const family = { ...scope, gameId: id.game('genshin-impact').id, familyId: id.family('sony-dualsense').id }
    const reports = await listExternalReports(t.sql, family)
    expect(new Set(reports.map((r) => r.sourceId))).toEqual(new Set([hoyoverse, game8]))
    expect(reports.find((r) => r.sourceId === hoyoverse)?.claims).toEqual([
      {
        control: 'controller_support',
        result: 'works',
        connection: 'bluetooth',
        statement: 'Listed under "Android (via Bluetooth)" as supported, Android 12.0+.',
      },
    ])
    const requests = await listVerificationRequests(t.sql, family)
    expect(requests.map((r) => [r.sourceId, r.claims[0].connection])).toEqual([[unverifiedUsb, 'usb']])

    // Game-wide reports stay listed on the game page.
    const gameReports = await listExternalReports(t.sql, { ...scope, gameId: id.game('genshin-impact').id })
    expect(gameReports.some((r) => r.sourceId === androidPolice && r.familySlug === null)).toBe(true)
  })
})

describe('direct tests are scoped to their connection', () => {
  let bluetoothTest: string
  let unknownTest: string

  async function submitApproved(values: Record<string, string>): Promise<string> {
    const parsed = parseTestSubmission(
      form({
        game: 'wuthering-waves',
        controller: `family:${id.family('8bitdo-ultimate-2').id}`,
        testedOn: '2026-09-27',
        website: '',
        ...values,
      }),
      new Date('2026-09-27T12:00:00Z'),
    )
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors))
    const r = await createTestSession(t.sql, parsed.value, { submitterKey: null })
    if (!r.ok || !r.id) throw new Error('submit failed')
    await moderateTest(t.sql, { id: r.id, decision: 'approve', note: null, controller: { kind: 'none' } })
    return r.id
  }

  beforeAll(async () => {
    bluetoothTest = await submitApproved({
      connection: 'bluetooth',
      controllerDetected: 'yes',
      result_triggers: 'broken',
      result_menu: 'works',
    })
    unknownTest = await submitApproved({ result_triggers: 'works' })
    await source('forum.example.org', 'wuthering-waves', 'forum', 'published', [
      { family: '8bitdo-ultimate-2', connection: 'usb', control: 'triggers', result: 'works', statement: 'Triggers work over USB.' },
    ])
  })

  it('a Bluetooth test decides Bluetooth only; USB comes from its own report; unknown decides nothing', async () => {
    const a = await answerFor('wuthering-waves', '8bitdo-ultimate-2')
    expect(at(a, 'bluetooth')).toMatchObject({ result: 'problem', basis: 'direct' })
    expect(at(a, 'bluetooth').totals).toEqual({ direct: 1, official: 0, external: 0 })
    expect(at(a, 'usb')).toMatchObject({ result: 'working', basis: 'external', externalDisagrees: false })
    expect(at(a, 'usb').totals.direct).toBe(0)
    expect(at(a, 'dongle')).toMatchObject({ result: 'none', evidence: [] })
    expect(a.connectionNotStated.evidence.map((e) => e.origin)).toEqual([unknownTest])

    expect(a.controls.map((r) => [r.control, r.connection, r.summary.state])).toEqual([
      ['menu', 'bluetooth', 'works'],
      ['triggers', 'bluetooth', 'broken'],
      ['triggers', 'usb', 'reported_works'],
      ['triggers', null, 'works'],
    ])
  })

  it('listDirectTests still returns every approved test with its own conditions', async () => {
    const tests = await listDirectTests(t.sql, {
      ...scope,
      gameId: id.game('wuthering-waves').id,
      familyId: id.family('8bitdo-ultimate-2').id,
      limit: null,
    })
    expect(tests.map((x) => x.id).sort()).toEqual([bluetoothTest, unknownTest].sort())
    const bt = tests.find((x) => x.id === bluetoothTest)!
    expect(bt).toMatchObject({
      familyId: id.family('8bitdo-ultimate-2').id,
      connection: 'bluetooth',
      controllerDetected: true,
      gameVersion: null,
    })
    expect(bt.observations.sort((x, y) => x.control.localeCompare(y.control))).toEqual([
      { control: 'menu', result: 'works' },
      { control: 'triggers', result: 'broken' },
    ])
    expect(tests.find((x) => x.id === unknownTest)).toMatchObject({ connection: null, controllerDetected: null })
    // The default limit still applies when none is given.
    expect(await listDirectTests(t.sql, { ...scope, limit: 1 })).toHaveLength(1)
  })
})
