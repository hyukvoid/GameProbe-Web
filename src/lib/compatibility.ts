import { summarizeControl, type ControlSummary, type EvidenceItem } from './aggregate'
import {
  CONNECTION_TYPES,
  CONTROLS,
  type Control,
  type ConnectionType,
  type EvidenceControl,
  type Result,
  type SourceType,
} from './domain'

// Transport-first compatibility for one game and one controller family.
//
// The rules this module exists to enforce:
//   * Evidence counts only for the connection it states. Bluetooth never answers USB or
//     Dongle, and a record with no connection answers none of them.
//   * Only evidence about this controller family decides a result. A claim that names no
//     controller is game-wide context: shown next to a connection, never counted.
//   * Direct tests take precedence only within the connection they were run on.
//   * Direct tests, official sources and other external reports are counted separately.
//     There are no scores; official sources change wording, never weight.
//
// Input is plain data so the rules can be tested without a database.

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export type DirectTestInput = {
  id: string
  familyId: string | null
  variantName: string | null
  connection: ConnectionType | null
  controllerMode: string | null
  androidVersion: string | null
  gameVersion: string | null
  /** As reported by the tester; null when unknown. Never derived from observations. */
  controllerDetected: boolean | null
  testedOn: string
  observations: { control: Control; result: Result }[]
  /** Development fixture; shown only when demo data is enabled, and always labelled. */
  isDemo: boolean
}

/** One published evidence claim for the page's game. */
export type ClaimInput = {
  sourceId: string
  sourceType: SourceType
  url: string
  title: string | null
  /** Null when the source names no controller. */
  familyId: string | null
  variantName: string | null
  controllerAsWritten: string | null
  connection: ConnectionType | null
  controllerMode: string | null
  androidVersion: string | null
  gameVersion: string | null
  date: string | null
  control: EvidenceControl
  result: Result
  statement: string
  isDemo: boolean
}

// ---------------------------------------------------------------------------
// Scoped evidence
// ---------------------------------------------------------------------------

/** Direct test, official external source, or any other external report. */
export type EvidenceKind = 'direct' | 'official' | 'external'

/** How precisely a record identifies the controller. */
export type ControllerScope =
  | { level: 'variant'; name: string }
  | { level: 'wording'; wording: string }
  | { level: 'family' }
  | { level: 'unspecified' }

export type EntryOutcome = 'working' | 'problem' | null

type EntryBase = {
  kind: EvidenceKind
  /** Unique per entry: one source can state several controllers or conditions. */
  key: string
  /** Test session id or source id. Counts are distinct origins. */
  origin: string
  controller: ControllerScope
  controllerMode: string | null
  androidVersion: string | null
  gameVersion: string | null
  date: string | null
  results: { subject: EvidenceControl; result: Result }[]
  /** Direct tests only. */
  detected: boolean | null
  outcome: EntryOutcome
  statement: string | null
  source: { url: string; title: string | null; sourceType: SourceType } | null
  isDemo: boolean
}

/** Evidence about this controller family. Only this type can decide a result. */
export type ControllerEvidence = EntryBase & { applies: 'controller'; connection: ConnectionType | null }

/** Evidence that names no controller. Context only. */
export type GameWideEvidence = EntryBase & { applies: 'game_wide'; connection: ConnectionType | null }

/** Controller evidence that states the connection being answered. */
export type ConnectionEvidence = ControllerEvidence & { connection: ConnectionType }

export type OutcomeCounts = { working: number; problem: number }

export type KindTotals = Record<EvidenceKind, number>

export type ConnectionResult = 'working' | 'problem' | 'conflicting' | 'none'

export type ConnectionAnswer = {
  connection: ConnectionType
  result: ConnectionResult
  /** Which evidence decided the result. Null when there is none. */
  basis: 'direct' | 'external' | null
  /** Distinct origins by outcome, per evidence kind. */
  outcomes: Record<EvidenceKind, OutcomeCounts>
  /** Distinct origins per evidence kind, including records with no usable outcome. */
  totals: KindTotals
  /** Direct tests decided the result, but external evidence for this connection disagrees. */
  externalDisagrees: boolean
  evidence: ConnectionEvidence[]
  /** Game-wide reports for this connection. Never counted above. */
  gameWide: GameWideEvidence[]
  latestDate: string | null
}

export type ControlRow = {
  control: Control
  /** Null: the evidence does not state a connection. */
  connection: ConnectionType | null
  summary: ControlSummary
}

export type CompatibilityAnswer = {
  connections: ConnectionAnswer[]
  /** Records that state no connection. They count toward no connection. */
  connectionNotStated: { evidence: ControllerEvidence[]; gameWide: GameWideEvidence[] }
  /** Physical controls only, one row per control and connection with evidence. */
  controls: ControlRow[]
}

// ---------------------------------------------------------------------------
// Building entries
// ---------------------------------------------------------------------------

export function outcomeOf(results: { result: Result }[], detected: boolean | null): EntryOutcome {
  if (detected === false || results.some((r) => r.result === 'broken')) return 'problem'
  if (detected === true || results.some((r) => r.result === 'works')) return 'working'
  return null
}

export function kindOfSource(sourceType: SourceType): EvidenceKind {
  return sourceType === 'official' ? 'official' : 'external'
}

function claimControllerScope(c: ClaimInput): ControllerScope {
  if (c.familyId === null) return { level: 'unspecified' }
  if (c.variantName) return { level: 'variant', name: c.variantName }
  if (c.controllerAsWritten) return { level: 'wording', wording: c.controllerAsWritten }
  return { level: 'family' }
}

function directEntry(t: DirectTestInput): ControllerEvidence {
  const results = t.observations.map((o) => ({ subject: o.control as EvidenceControl, result: o.result }))
  return {
    applies: 'controller',
    kind: 'direct',
    key: `direct:${t.id}`,
    origin: t.id,
    controller: t.variantName ? { level: 'variant', name: t.variantName } : { level: 'family' },
    connection: t.connection,
    controllerMode: t.controllerMode,
    androidVersion: t.androidVersion,
    gameVersion: t.gameVersion,
    date: t.testedOn,
    results,
    detected: t.controllerDetected,
    outcome: outcomeOf(results, t.controllerDetected),
    statement: null,
    source: null,
    isDemo: t.isDemo,
  }
}

/** Claims of one source under one controller identity and one set of conditions. */
function claimEntries<A extends 'controller' | 'game_wide'>(
  claims: ClaimInput[],
  applies: A,
): (EntryBase & { applies: A; connection: ConnectionType | null })[] {
  const groups = new Map<string, ClaimInput[]>()
  for (const c of claims) {
    const identity = c.variantName ?? c.controllerAsWritten ?? ''
    const key = [c.sourceId, identity, c.connection, c.androidVersion, c.gameVersion, c.controllerMode]
      .map((v) => v ?? '')
      .join('|')
    const list = groups.get(key)
    if (list) list.push(c)
    else groups.set(key, [c])
  }
  return [...groups.entries()].map(([key, list]) => {
    const first = list[0]
    const results = list.map((c) => ({ subject: c.control, result: c.result }))
    return {
      applies,
      kind: kindOfSource(first.sourceType),
      key: `claim:${key}`,
      origin: first.sourceId,
      controller: claimControllerScope(first),
      connection: first.connection,
      controllerMode: first.controllerMode,
      androidVersion: first.androidVersion,
      gameVersion: first.gameVersion,
      date: first.date,
      results,
      detected: null,
      outcome: outcomeOf(results, null),
      statement: [...new Set(list.map((c) => c.statement))].join(' '),
      source: { url: first.url, title: first.title, sourceType: first.sourceType },
      isDemo: list.some((c) => c.isDemo),
    }
  })
}

// ---------------------------------------------------------------------------
// Deriving a connection answer
// ---------------------------------------------------------------------------

const KINDS: EvidenceKind[] = ['direct', 'official', 'external']

function latest(dates: (string | null)[]): string | null {
  const known = dates.filter((d): d is string => d !== null)
  return known.length ? known.reduce((a, b) => (a > b ? a : b)) : null
}

function decide(counts: OutcomeCounts): Exclude<ConnectionResult, 'none'> {
  if (counts.working > 0 && counts.problem > 0) return 'conflicting'
  return counts.working > 0 ? 'working' : 'problem'
}

/**
 * The answer for one connection. Every entry must be controller evidence that states this
 * exact connection; anything else is a programming error and throws rather than being
 * counted.
 */
export function deriveConnectionAnswer(
  connection: ConnectionType,
  evidence: ConnectionEvidence[],
  gameWide: GameWideEvidence[] = [],
): ConnectionAnswer {
  for (const e of evidence) {
    if (e.applies !== 'controller' || e.connection !== connection) {
      throw new Error(`Evidence for ${e.connection ?? 'no connection'} cannot answer ${connection}.`)
    }
  }
  for (const g of gameWide) {
    if (g.applies !== 'game_wide' || g.connection !== connection) {
      throw new Error(`Game-wide context for ${g.connection ?? 'no connection'} cannot sit under ${connection}.`)
    }
  }

  const outcomes = {} as Record<EvidenceKind, OutcomeCounts>
  const totals = {} as KindTotals
  for (const kind of KINDS) {
    const mine = evidence.filter((e) => e.kind === kind)
    const working = new Set(mine.filter((e) => e.outcome === 'working').map((e) => e.origin))
    const problem = new Set(mine.filter((e) => e.outcome === 'problem').map((e) => e.origin))
    outcomes[kind] = { working: working.size, problem: problem.size }
    totals[kind] = new Set(mine.map((e) => e.origin)).size
  }

  const external: OutcomeCounts = {
    working: outcomes.official.working + outcomes.external.working,
    problem: outcomes.official.problem + outcomes.external.problem,
  }

  let result: ConnectionResult = 'none'
  let basis: ConnectionAnswer['basis'] = null
  if (outcomes.direct.working + outcomes.direct.problem > 0) {
    basis = 'direct'
    result = decide(outcomes.direct)
  } else if (external.working + external.problem > 0) {
    basis = 'external'
    result = decide(external)
  }

  const externalDisagrees =
    basis === 'direct' &&
    ((result === 'working' && external.problem > 0) || (result === 'problem' && external.working > 0))

  return {
    connection,
    result,
    basis,
    outcomes,
    totals,
    externalDisagrees,
    evidence,
    gameWide,
    latestDate: latest(evidence.map((e) => e.date)),
  }
}

// ---------------------------------------------------------------------------
// Physical controls
// ---------------------------------------------------------------------------

const CONNECTION_ORDER: (ConnectionType | null)[] = [...CONNECTION_TYPES, null]

function isPhysicalControl(subject: EvidenceControl): subject is Control {
  return (CONTROLS as readonly string[]).includes(subject)
}

/**
 * Per-control rows, each scoped to one connection (or "not stated"). `controller_support`
 * is not a physical control and never appears. A direct test decides a row only for the
 * connection it was run on.
 */
export function deriveControlRows(evidence: ControllerEvidence[]): ControlRow[] {
  const rows: ControlRow[] = []
  for (const connection of CONNECTION_ORDER) {
    const items: EvidenceItem[] = evidence
      .filter((e) => e.connection === connection)
      .flatMap((e) =>
        e.results
          .filter((r) => isPhysicalControl(r.subject))
          .map((r) => ({
            kind: e.kind === 'direct' ? ('direct' as const) : ('external' as const),
            control: r.subject,
            result: r.result,
            origin: e.origin,
            connection: e.connection,
            gameVersion: e.gameVersion,
            variant: e.controller.level === 'variant' ? e.controller.name : null,
            androidVersion: e.androidVersion,
            date: e.date,
          })),
      )
    for (const control of CONTROLS) {
      if (!items.some((i) => i.control === control)) continue
      rows.push({ control, connection, summary: summarizeControl(control, items) })
    }
  }
  return rows.sort(
    (a, b) =>
      CONTROLS.indexOf(a.control) - CONTROLS.indexOf(b.control) ||
      CONNECTION_ORDER.indexOf(a.connection) - CONNECTION_ORDER.indexOf(b.connection),
  )
}

// ---------------------------------------------------------------------------
// Whole answer
// ---------------------------------------------------------------------------

/**
 * Transport-first answer for one game and controller family. `directTests` and `claims`
 * must already be limited to the page's game and to public records; records of other
 * controller families are ignored here as a second line of defence.
 */
export function deriveCompatibility(input: {
  familyId: string
  directTests: DirectTestInput[]
  claims: ClaimInput[]
}): CompatibilityAnswer {
  const controllerClaims = input.claims.filter((c) => c.familyId === input.familyId)
  const gameWideClaims = input.claims.filter((c) => c.familyId === null)

  const controller: ControllerEvidence[] = [
    ...input.directTests.filter((t) => t.familyId === input.familyId).map(directEntry),
    ...claimEntries(controllerClaims, 'controller'),
  ]
  const gameWide: GameWideEvidence[] = claimEntries(gameWideClaims, 'game_wide')

  const connections = CONNECTION_TYPES.map((connection) =>
    deriveConnectionAnswer(
      connection,
      controller.filter((e): e is ConnectionEvidence => e.connection === connection),
      gameWide.filter((g) => g.connection === connection),
    ),
  )

  return {
    connections,
    connectionNotStated: {
      evidence: controller.filter((e) => e.connection === null),
      gameWide: gameWide.filter((g) => g.connection === null),
    },
    controls: deriveControlRows(controller),
  }
}

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

/**
 * Cautious labels. External-only results say who reported them; nothing is called
 * verified, because GameProbe does not verify.
 */
export function connectionResultLabel(a: Pick<ConnectionAnswer, 'result' | 'basis' | 'outcomes'>): string {
  if (a.result === 'none' || a.basis === null) return 'No controller-specific evidence'
  if (a.basis === 'direct') {
    if (a.result === 'working') return 'Working in direct tests'
    if (a.result === 'problem') return 'Problem reported in direct tests'
    return 'Direct tests conflict'
  }
  if (a.result === 'conflicting') return 'Reports conflict'
  if (a.result === 'working') {
    return a.outcomes.official.working > 0 ? 'Officially reported supported' : 'Reported working'
  }
  return a.outcomes.official.problem > 0 ? 'Official source reports a problem' : 'External reports indicate a problem'
}

/** "0", "1: working", "2: 1 working, 1 with a problem", "1, no result recorded". */
export function describeKindCount(total: number, counts: OutcomeCounts): string {
  if (total === 0) return '0'
  const { working, problem } = counts
  if (working === 0 && problem === 0) return `${total}, no result recorded`
  if (problem === 0 && working === total) return `${total}: working`
  if (working === 0 && problem === total) return `${total}: problem reported`
  const parts: string[] = []
  if (working) parts.push(`${working} working`)
  if (problem) parts.push(`${problem} with a problem`)
  return `${total}: ${parts.join(', ')}`
}
