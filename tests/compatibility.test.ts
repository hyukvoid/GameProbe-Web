import { describe, expect, it } from 'vitest'
import {
  connectionResultLabel,
  deriveCompatibility,
  deriveConnectionAnswer,
  describeKindCount,
  type ClaimInput,
  type CompatibilityAnswer,
  type ConnectionEvidence,
  type DirectTestInput,
  type VerificationContextInput,
} from '@/lib/compatibility'
import type { ConnectionType } from '@/lib/domain'

const FAMILY = 'family-dualsense'
const OTHER_FAMILY = 'family-8bitdo'

let n = 0
function claim(p: Partial<ClaimInput> = {}): ClaimInput {
  n++
  return {
    sourceId: `source-${n}`,
    sourceType: 'article',
    url: `https://example.org/report-${n}`,
    title: null,
    familyId: FAMILY,
    variantName: null,
    controllerAsWritten: null,
    connection: null,
    controllerMode: null,
    androidVersion: null,
    gameVersion: null,
    date: '2026-09-01',
    control: 'controller_support',
    result: 'works',
    statement: 'Stated by the source.',
    isDemo: false,
    visibility: 'published',
    ...p,
  }
}

function direct(p: Partial<DirectTestInput> = {}): DirectTestInput {
  n++
  return {
    id: `test-${n}`,
    familyId: FAMILY,
    variantName: null,
    connection: null,
    controllerMode: null,
    androidVersion: null,
    gameVersion: null,
    controllerDetected: null,
    testedOn: '2026-09-20',
    observations: [{ control: 'triggers', result: 'works' }],
    isDemo: false,
    ...p,
  }
}

function derive(claims: ClaimInput[] = [], directTests: DirectTestInput[] = []) {
  return deriveCompatibility({ familyId: FAMILY, claims, directTests })
}

function at(a: CompatibilityAnswer, connection: ConnectionType) {
  const found = a.connections.find((c) => c.connection === connection)
  if (!found) throw new Error(`no ${connection} row`)
  return found
}

const NO_TOTALS = { direct: 0, official: 0, external: 0 }

describe('connection rows', () => {
  it('always has Bluetooth, USB cable and Dongle, with no evidence stated as such', () => {
    const a = derive()
    expect(a.connections.map((c) => c.connection)).toEqual(['bluetooth', 'usb', 'dongle'])
    for (const c of a.connections) {
      expect(c.result).toBe('none')
      expect(c.basis).toBe(null)
      expect(c.totals).toEqual(NO_TOTALS)
      expect(connectionResultLabel(c)).toBe('No controller-specific evidence')
    }
    expect(a.connectionNotStated).toEqual({ evidence: [], gameWide: [], verification: [] })
    expect(a.controls).toEqual([])
  })
})

describe('transport isolation', () => {
  it('Bluetooth controller-specific evidence does not make USB or Dongle supported', () => {
    const a = derive([claim({ sourceType: 'official', connection: 'bluetooth' })])
    expect(at(a, 'bluetooth')).toMatchObject({ result: 'working', basis: 'external' })
    expect(connectionResultLabel(at(a, 'bluetooth'))).toBe('Officially reported supported')
    for (const other of ['usb', 'dongle'] as const) {
      expect(at(a, other)).toMatchObject({ result: 'none', basis: null, totals: NO_TOTALS, evidence: [] })
      expect(connectionResultLabel(at(a, other))).toBe('No controller-specific evidence')
    }
  })

  it('USB evidence does not make Bluetooth supported', () => {
    const a = derive([claim({ connection: 'usb' })])
    expect(at(a, 'usb').result).toBe('working')
    expect(at(a, 'bluetooth')).toMatchObject({ result: 'none', totals: NO_TOTALS })
    expect(at(a, 'dongle')).toMatchObject({ result: 'none', totals: NO_TOTALS })
  })

  it('evidence with no connection counts toward no connection', () => {
    const unknown = claim({ connection: null, sourceType: 'official' })
    const a = derive([unknown])
    for (const c of a.connections) {
      expect(c).toMatchObject({ result: 'none', totals: NO_TOTALS, evidence: [] })
    }
    expect(a.connectionNotStated.evidence.map((e) => e.origin)).toEqual([unknown.sourceId])
    expect(a.connectionNotStated.evidence[0].connection).toBe(null)
  })

  it('refuses to answer one connection with evidence for another, or with none stated', () => {
    const a = derive([claim({ connection: 'usb' }), claim({ connection: null })])
    const usbEvidence = at(a, 'usb').evidence[0]
    expect(() => deriveConnectionAnswer('bluetooth', [usbEvidence])).toThrow(/cannot answer bluetooth/)
    const unstated = a.connectionNotStated.evidence[0] as ConnectionEvidence
    expect(() => deriveConnectionAnswer('usb', [unstated])).toThrow(/no connection cannot answer usb/)
  })
})

describe('controller scope isolation', () => {
  it('keeps a family-less USB claim as game-wide context, never as the USB result', () => {
    const gameWide = claim({ familyId: null, connection: 'usb', sourceType: 'article' })
    const a = derive([gameWide])
    const usb = at(a, 'usb')
    expect(usb).toMatchObject({ result: 'none', basis: null, totals: NO_TOTALS, evidence: [] })
    expect(connectionResultLabel(usb)).toBe('No controller-specific evidence')
    expect(usb.gameWide.map((g) => g.origin)).toEqual([gameWide.sourceId])
    expect(usb.gameWide[0]).toMatchObject({ applies: 'game_wide', controller: { level: 'unspecified' } })
    expect(at(a, 'bluetooth').gameWide).toEqual([])
  })

  it('lets a claim for this family decide the USB result', () => {
    const a = derive([claim({ familyId: null, connection: 'usb' }), claim({ connection: 'usb', result: 'broken' })])
    const usb = at(a, 'usb')
    expect(usb).toMatchObject({ result: 'problem', basis: 'external' })
    expect(connectionResultLabel(usb)).toBe('External reports indicate a problem')
    expect(usb.totals).toEqual({ direct: 0, official: 0, external: 1 })
    // The game-wide claim stays context and does not turn this into a conflict.
    expect(usb.gameWide).toHaveLength(1)
  })

  it('ignores evidence about another controller family entirely', () => {
    const a = derive(
      [claim({ familyId: OTHER_FAMILY, connection: 'bluetooth' }), claim({ familyId: OTHER_FAMILY })],
      [direct({ familyId: OTHER_FAMILY, connection: 'usb' })],
    )
    for (const c of a.connections) expect(c).toMatchObject({ result: 'none', evidence: [], gameWide: [] })
    expect(a.connectionNotStated).toEqual({ evidence: [], gameWide: [], verification: [] })
    expect(a.controls).toEqual([])
  })

  it('records how precisely each piece of evidence names the controller', () => {
    const a = derive(
      [
        claim({ connection: 'bluetooth', variantName: 'DualSense Wireless Controller' }),
        claim({ connection: 'bluetooth', controllerAsWritten: 'PS5 controller' }),
        claim({ connection: 'bluetooth' }),
      ],
      [direct({ connection: 'bluetooth', variantName: 'DualSense Edge Wireless Controller' })],
    )
    expect(at(a, 'bluetooth').evidence.map((e) => e.controller)).toEqual([
      { level: 'variant', name: 'DualSense Edge Wireless Controller' },
      { level: 'variant', name: 'DualSense Wireless Controller' },
      { level: 'wording', wording: 'PS5 controller' },
      { level: 'family' },
    ])
  })
})

describe('direct test isolation', () => {
  it('a Bluetooth direct test does not decide USB', () => {
    const a = derive(
      [claim({ connection: 'usb', control: 'triggers', result: 'works' })],
      [direct({ connection: 'bluetooth', observations: [{ control: 'triggers', result: 'broken' }] })],
    )
    expect(at(a, 'bluetooth')).toMatchObject({ result: 'problem', basis: 'direct', externalDisagrees: false })
    expect(connectionResultLabel(at(a, 'bluetooth'))).toBe('Problem reported in direct tests')
    const usb = at(a, 'usb')
    expect(usb).toMatchObject({ result: 'working', basis: 'external', externalDisagrees: false })
    expect(usb.totals.direct).toBe(0)
    expect(connectionResultLabel(usb)).toBe('Reported working')
  })

  it('a direct test with no connection decides no connection', () => {
    const unknown = direct({ connection: null, observations: [{ control: 'menu', result: 'broken' }] })
    const a = derive([claim({ connection: 'bluetooth' })], [unknown])
    expect(at(a, 'bluetooth')).toMatchObject({ result: 'working', basis: 'external' })
    expect(at(a, 'bluetooth').totals.direct).toBe(0)
    expect(at(a, 'usb')).toMatchObject({ result: 'none', totals: NO_TOTALS })
    expect(at(a, 'dongle')).toMatchObject({ result: 'none', totals: NO_TOTALS })
    expect(a.connectionNotStated.evidence.map((e) => e.origin)).toEqual([unknown.id])
  })

  it('takes precedence only within its own connection, and keeps the disagreement visible', () => {
    const a = derive(
      [claim({ connection: 'bluetooth', sourceType: 'official', result: 'broken' })],
      [direct({ connection: 'bluetooth' })],
    )
    const bt = at(a, 'bluetooth')
    expect(bt).toMatchObject({ result: 'working', basis: 'direct', externalDisagrees: true })
    expect(bt.outcomes.official).toEqual({ working: 0, problem: 1 })
  })

  it('treats a controller the game did not detect as a problem, without inventing control results', () => {
    const a = derive([], [direct({ connection: 'usb', controllerDetected: false, observations: [] })])
    expect(at(a, 'usb')).toMatchObject({ result: 'problem', basis: 'direct' })
    expect(at(a, 'usb').evidence[0].results).toEqual([])
    expect(a.controls).toEqual([])
  })

  it('reports conflicting direct tests on one connection as a conflict', () => {
    const a = derive(
      [],
      [
        direct({ connection: 'dongle' }),
        direct({ connection: 'dongle', observations: [{ control: 'triggers', result: 'broken' }] }),
      ],
    )
    expect(at(a, 'dongle')).toMatchObject({ result: 'conflicting', basis: 'direct' })
    expect(connectionResultLabel(at(a, 'dongle'))).toBe('Direct tests conflict')
  })
})

describe('evidence kind', () => {
  it('counts official sources, other external reports and direct tests separately', () => {
    const a = derive(
      [claim({ connection: 'bluetooth', sourceType: 'official' }), claim({ connection: 'bluetooth', sourceType: 'reddit' })],
      [direct({ connection: 'bluetooth' })],
    )
    const bt = at(a, 'bluetooth')
    expect(bt.totals).toEqual({ direct: 1, official: 1, external: 1 })
    expect(bt.outcomes).toEqual({
      direct: { working: 1, problem: 0 },
      official: { working: 1, problem: 0 },
      external: { working: 1, problem: 0 },
    })
    expect(bt.evidence.map((e) => e.kind).sort()).toEqual(['direct', 'external', 'official'])
    expect(connectionResultLabel(bt)).toBe('Working in direct tests')
  })

  it('uses official wording only when an official source says so', () => {
    expect(connectionResultLabel(at(derive([claim({ connection: 'usb', sourceType: 'forum' })]), 'usb'))).toBe(
      'Reported working',
    )
    expect(
      connectionResultLabel(at(derive([claim({ connection: 'usb', sourceType: 'official', result: 'broken' })]), 'usb')),
    ).toBe('Official source reports a problem')
  })

  it('does not rank an official source above another report: disagreement is a conflict', () => {
    const a = derive([
      claim({ connection: 'bluetooth', sourceType: 'official' }),
      claim({ connection: 'bluetooth', sourceType: 'forum', result: 'broken' }),
    ])
    expect(at(a, 'bluetooth')).toMatchObject({ result: 'conflicting', basis: 'external' })
    expect(connectionResultLabel(at(a, 'bluetooth'))).toBe('Reports conflict')
  })

  it('counts one source once even when it names two controllers of the family', () => {
    const shared = { sourceId: 'hoyoverse', sourceType: 'official' as const, connection: 'bluetooth' as const }
    const a = derive([
      claim({ ...shared, controllerAsWritten: 'Xbox Wireless Controller' }),
      claim({ ...shared, controllerAsWritten: 'Xbox Elite Wireless Controller Series 2' }),
    ])
    const bt = at(a, 'bluetooth')
    expect(bt.evidence).toHaveLength(2)
    expect(bt.totals.official).toBe(1)
    expect(bt.outcomes.official).toEqual({ working: 1, problem: 0 })
  })
})

describe('physical controls', () => {
  it('never lists controller_support as a physical control', () => {
    const a = derive([claim({ connection: 'bluetooth' }), claim({ connection: null }), claim({ familyId: null })])
    expect(a.controls).toEqual([])
  })

  it('scopes each row to one connection', () => {
    const a = derive(
      [claim({ connection: 'usb', control: 'triggers', result: 'works' })],
      [
        direct({ connection: 'bluetooth', observations: [{ control: 'triggers', result: 'broken' }, { control: 'menu', result: 'works' }] }),
        direct({ connection: null, observations: [{ control: 'triggers', result: 'works' }] }),
      ],
    )
    expect(a.controls.map((r) => [r.control, r.connection, r.summary.state])).toEqual([
      ['menu', 'bluetooth', 'works'],
      ['triggers', 'bluetooth', 'broken'],
      ['triggers', 'usb', 'reported_works'],
      ['triggers', null, 'works'],
    ])
    // A Bluetooth test is not set against a USB report.
    for (const r of a.controls) expect(r.summary.externalDisagrees).toBe(false)
  })

  it('lists only controls that have evidence, leaving the rest unknown', () => {
    const a = derive([], [direct({ connection: 'bluetooth', observations: [{ control: 'dpad', result: 'works' }] })])
    expect(a.controls.map((r) => r.control)).toEqual(['dpad'])
  })

  it('ignores game-wide claims about physical controls', () => {
    const a = derive([claim({ familyId: null, connection: 'bluetooth', control: 'triggers', result: 'broken' })])
    expect(a.controls).toEqual([])
    expect(at(a, 'bluetooth').result).toBe('none')
  })
})

function request(p: Partial<VerificationContextInput> = {}): VerificationContextInput {
  const { visibility: _v, ...base } = claim()
  void _v
  return { ...base, visibility: 'needs_direct_test', ...p }
}

describe('verification context (needs a direct test)', () => {
  it('shows a game-wide USB request under USB only, without changing the USB result or counts', () => {
    const androidPolice = request({ familyId: null, connection: 'usb', statement: 'USB controllers are supported.' })
    const a = deriveCompatibility({ familyId: FAMILY, directTests: [], claims: [], verification: [androidPolice] })
    const usb = at(a, 'usb')
    expect(usb).toMatchObject({ result: 'none', basis: null, totals: NO_TOTALS, evidence: [], gameWide: [] })
    expect(usb.outcomes).toEqual({
      direct: { working: 0, problem: 0 },
      official: { working: 0, problem: 0 },
      external: { working: 0, problem: 0 },
    })
    expect(connectionResultLabel(usb)).toBe('No controller-specific evidence')
    expect(usb.verification).toHaveLength(1)
    expect(usb.verification[0]).toMatchObject({
      standing: 'needs_verification',
      applies: 'game_wide',
      origin: androidPolice.sourceId,
      controller: { level: 'unspecified' },
      connection: 'usb',
    })
    expect(at(a, 'bluetooth').verification).toEqual([])
    expect(at(a, 'dongle').verification).toEqual([])
    expect(a.connectionNotStated.verification).toEqual([])
  })

  it('never adds to the decisive Bluetooth evidence beside a published official claim', () => {
    const a = deriveCompatibility({
      familyId: FAMILY,
      directTests: [],
      claims: [claim({ sourceType: 'official', connection: 'bluetooth' })],
      verification: [request({ familyId: null, connection: 'bluetooth', sourceType: 'official' })],
    })
    const bt = at(a, 'bluetooth')
    expect(connectionResultLabel(bt)).toBe('Officially reported supported')
    expect(bt.totals).toEqual({ direct: 0, official: 1, external: 0 })
    expect(bt.outcomes.official).toEqual({ working: 1, problem: 0 })
    expect(bt.evidence).toHaveLength(1)
    expect(bt.verification).toHaveLength(1)
  })

  it('keeps a controller-specific request as context only, even when it states a problem', () => {
    const a = deriveCompatibility({
      familyId: FAMILY,
      directTests: [],
      claims: [],
      verification: [request({ connection: 'bluetooth', control: 'triggers', result: 'broken' })],
    })
    const bt = at(a, 'bluetooth')
    expect(bt).toMatchObject({ result: 'none', basis: null, totals: NO_TOTALS, evidence: [] })
    expect(bt.verification.map((v) => [v.applies, v.controller.level])).toEqual([['controller', 'family']])
    // It never reaches the per-control table either.
    expect(a.controls).toEqual([])
  })

  it('excludes requests about another controller family', () => {
    const a = deriveCompatibility({
      familyId: FAMILY,
      directTests: [],
      claims: [],
      verification: [request({ familyId: OTHER_FAMILY, connection: 'usb' }), request({ familyId: OTHER_FAMILY })],
    })
    for (const c of a.connections) expect(c.verification).toEqual([])
    expect(a.connectionNotStated.verification).toEqual([])
  })

  it('keeps a request with no connection under Connection not stated only', () => {
    const unstated = request({ familyId: null, connection: null })
    const a = deriveCompatibility({ familyId: FAMILY, directTests: [], claims: [], verification: [unstated] })
    for (const c of a.connections) expect(c.verification).toEqual([])
    expect(a.connectionNotStated.verification.map((v) => v.origin)).toEqual([unstated.sourceId])
    expect(a.connectionNotStated.evidence).toEqual([])
    expect(a.connectionNotStated.gameWide).toEqual([])
  })

  it('lists this family’s requests before game-wide ones', () => {
    const a = deriveCompatibility({
      familyId: FAMILY,
      directTests: [],
      claims: [],
      verification: [request({ familyId: null, connection: 'usb' }), request({ connection: 'usb' })],
    })
    expect(at(a, 'usb').verification.map((v) => v.applies)).toEqual(['controller', 'game_wide'])
  })

  it('refuses to count a request as evidence, or to treat a published claim as a request', () => {
    const asClaim = request({ connection: 'usb' }) as unknown as ClaimInput
    expect(() => deriveCompatibility({ familyId: FAMILY, directTests: [], claims: [asClaim] })).toThrow(
      /Only published claims can be evidence/,
    )
    const asRequest = claim({ connection: 'usb' }) as unknown as VerificationContextInput
    expect(() => deriveCompatibility({ familyId: FAMILY, directTests: [], claims: [], verification: [asRequest] })).toThrow(
      /must be a needs-direct-test claim/,
    )
    const context = deriveCompatibility({
      familyId: FAMILY,
      directTests: [],
      claims: [],
      verification: [request({ connection: 'usb' })],
    })
    const entry = at(context, 'usb').verification[0] as unknown as ConnectionEvidence
    expect(() => deriveConnectionAnswer('usb', [entry])).toThrow(/awaiting a direct test cannot answer usb/)
  })
})

describe('describeKindCount', () => {
  it('states counts literally', () => {
    expect(describeKindCount(0, { working: 0, problem: 0 })).toBe('0')
    expect(describeKindCount(1, { working: 1, problem: 0 })).toBe('1: working')
    expect(describeKindCount(2, { working: 0, problem: 2 })).toBe('2: problem reported')
    expect(describeKindCount(2, { working: 1, problem: 1 })).toBe('2: 1 working, 1 with a problem')
    expect(describeKindCount(1, { working: 0, problem: 0 })).toBe('1, no result recorded')
  })
})
