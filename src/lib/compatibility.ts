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

/** Fields every reviewed claim carries, whatever its visibility. Not used on its own. */
export type ReviewedClaimFields = {
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

/** A published claim for the page's game. Published claims are the only external evidence. */
export type ClaimInput = ReviewedClaimFields & { visibility: 'published' }

/**
 * A reviewed claim a reviewer flagged as needing a direct test. It is shown as context and
 * can never decide a result. The literal `visibility` keeps it from being passed as a
 * ClaimInput, and deriveCompatibility checks it again at runtime.
 */
export type VerificationContextInput = ReviewedClaimFields & { visibility: 'needs_direct_test' }

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

// Two standings, kept structurally apart:
//   'evidence'           approved direct tests and published claims
//   'needs_verification' reviewed claims flagged for a direct test; context only

/** Evidence about this controller family. Only this type can decide a result. */
export type ControllerEvidence = EntryBase & {
  standing: 'evidence'
  applies: 'controller'
  connection: ConnectionType | null
}

/** Published evidence that names no controller. Context only. */
export type GameWideEvidence = EntryBase & {
  standing: 'evidence'
  applies: 'game_wide'
  connection: ConnectionType | null
}

/** Controller evidence that states the connection being answered. */
export type ConnectionEvidence = ControllerEvidence & { connection: ConnectionType }

/**
 * A claim awaiting a direct test, about this family or naming no controller. Context only:
 * it is never counted, never sets a result, and never feeds the per-control table.
 */
export type VerificationContext = EntryBase & {
  standing: 'needs_verification'
  applies: 'controller' | 'game_wide'
  connection: ConnectionType | null
}

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
  /** Claims awaiting a direct test for this connection, this family's first. Never counted. */
  verification: VerificationContext[]
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
  connectionNotStated: {
    evidence: ControllerEvidence[]
    gameWide: GameWideEvidence[]
    verification: VerificationContext[]
  }
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

function claimControllerScope(c: ReviewedClaimFields): ControllerScope {
  if (c.familyId === null) return { level: 'unspecified' }
  if (c.variantName) return { level: 'variant', name: c.variantName }
  if (c.controllerAsWritten) return { level: 'wording', wording: c.controllerAsWritten }
  return { level: 'family' }
}

function directEntry(t: DirectTestInput): ControllerEvidence {
  const results = t.observations.map((o) => ({ subject: o.control as EvidenceControl, result: o.result }))
  return {
    standing: 'evidence',
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
function groupClaims(
  claims: ReviewedClaimFields[],
  prefix: 'claim' | 'verify',
): (EntryBase & { connection: ConnectionType | null; familyId: string | null })[] {
  const groups = new Map<string, ReviewedClaimFields[]>()
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
      familyId: first.familyId,
      kind: kindOfSource(first.sourceType),
      key: `${prefix}:${key}`,
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

function withoutFamily<T extends { familyId: string | null }>(entry: T): Omit<T, 'familyId'> {
  const { familyId: _familyId, ...rest } = entry
  void _familyId
  return rest
}

function publishedEntries(claims: ClaimInput[], familyId: string) {
  for (const c of claims) {
    if (c.visibility !== 'published') throw new Error('Only published claims can be evidence.')
  }
  const controller: ControllerEvidence[] = groupClaims(
    claims.filter((c) => c.familyId === familyId),
    'claim',
  ).map((e) => ({ ...withoutFamily(e), standing: 'evidence', applies: 'controller' }))
  const gameWide: GameWideEvidence[] = groupClaims(
    claims.filter((c) => c.familyId === null),
    'claim',
  ).map((e) => ({ ...withoutFamily(e), standing: 'evidence', applies: 'game_wide' }))
  return { controller, gameWide }
}

function verificationEntries(requests: VerificationContextInput[], familyId: string): VerificationContext[] {
  for (const r of requests) {
    if (r.visibility !== 'needs_direct_test') throw new Error('Verification context must be a needs-direct-test claim.')
  }
  // This family first, then claims that name no controller. Other families never appear.
  const applicable = [
    ...requests.filter((r) => r.familyId === familyId),
    ...requests.filter((r) => r.familyId === null),
  ]
  return groupClaims(applicable, 'verify').map((e) => ({
    ...withoutFamily(e),
    standing: 'needs_verification',
    applies: e.familyId === null ? 'game_wide' : 'controller',
  }))
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
 * The answer for one connection. Every counted entry must be published or approved
 * controller evidence that states this exact connection; anything else is a programming
 * error and throws rather than being counted. Context lists are checked the same way.
 */
export function deriveConnectionAnswer(
  connection: ConnectionType,
  evidence: ConnectionEvidence[],
  gameWide: GameWideEvidence[] = [],
  verification: VerificationContext[] = [],
): ConnectionAnswer {
  for (const e of evidence) {
    if (e.standing !== 'evidence') {
      throw new Error(`A claim awaiting a direct test cannot answer ${connection}.`)
    }
    if (e.applies !== 'controller' || e.connection !== connection) {
      throw new Error(`Evidence for ${e.connection ?? 'no connection'} cannot answer ${connection}.`)
    }
  }
  for (const g of gameWide) {
    if (g.standing !== 'evidence' || g.applies !== 'game_wide' || g.connection !== connection) {
      throw new Error(`Game-wide context for ${g.connection ?? 'no connection'} cannot sit under ${connection}.`)
    }
  }
  for (const v of verification) {
    if (v.standing !== 'needs_verification' || v.connection !== connection) {
      throw new Error(`Verification context for ${v.connection ?? 'no connection'} cannot sit under ${connection}.`)
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
    verification,
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
 * Transport-first answer for one game and controller family. `directTests`, `claims` and
 * `verification` must already be limited to the page's game; records of other controller
 * families are ignored here as a second line of defence.
 *
 * Decisive: approved direct tests and published claims about this family.
 * Context only: published claims naming no controller, claims awaiting a direct test, and
 * anything that states no connection.
 */
export function deriveCompatibility(input: {
  familyId: string
  directTests: DirectTestInput[]
  claims: ClaimInput[]
  verification?: VerificationContextInput[]
}): CompatibilityAnswer {
  const published = publishedEntries(input.claims, input.familyId)
  const controller: ControllerEvidence[] = [
    ...input.directTests.filter((t) => t.familyId === input.familyId).map(directEntry),
    ...published.controller,
  ]
  const gameWide = published.gameWide
  const verification = verificationEntries(input.verification ?? [], input.familyId)

  const connections = CONNECTION_TYPES.map((connection) =>
    deriveConnectionAnswer(
      connection,
      controller.filter((e): e is ConnectionEvidence => e.connection === connection),
      gameWide.filter((g) => g.connection === connection),
      verification.filter((v) => v.connection === connection),
    ),
  )

  return {
    connections,
    connectionNotStated: {
      evidence: controller.filter((e) => e.connection === null),
      gameWide: gameWide.filter((g) => g.connection === null),
      verification: verification.filter((v) => v.connection === null),
    },
    // Only decisive evidence feeds the per-control table.
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
