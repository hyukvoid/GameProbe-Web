import { CONNECTION_LABELS, CONTROLS, UNKNOWN, type Control, type ConnectionType, type Result } from './domain'

/**
 * One observed result for one control. Direct tests and external claims share this shape
 * only for counting; `kind` keeps them apart and they are never added together.
 */
export type EvidenceItem = {
  kind: 'direct' | 'external'
  control: Control
  result: Result
  /** Test session id or evidence source id. External reports count once per source. */
  origin: string
  connection: ConnectionType | null
  gameVersion: string | null
  variant: string | null
  androidVersion: string | null
  date: string | null
}

export type ControlState =
  | 'no_data'
  | 'works'
  | 'broken'
  | 'conflicting'
  | 'reported_works'
  | 'reported_broken'
  | 'reported_conflicting'

export type ConditionDimension = 'connection' | 'gameVersion' | 'variant' | 'androidVersion'

export const DIMENSION_LABELS: Record<ConditionDimension, string> = {
  connection: 'Connection',
  gameVersion: 'Game version',
  variant: 'Controller model',
  androidVersion: 'Android version',
}

export type ConditionDifference = {
  dimension: ConditionDimension
  works: string[]
  broken: string[]
}

export type Counts = { works: number; broken: number }

export type ControlSummary = {
  control: Control
  direct: Counts
  external: Counts
  /**
   * Derived only from counts. Direct tests decide the state when any exist; external
   * reports alone produce a "reported_*" state. Disagreement is kept, never averaged.
   */
  state: ControlState
  /** Direct tests agree with each other, but external reports say the opposite. */
  externalDisagrees: boolean
  /** Conditions that differ between the "works" and "broken" results that conflict. */
  differences: ConditionDifference[]
  lastDate: string | null
}

function countResults(items: EvidenceItem[]): Counts {
  const works = new Set<string>()
  const broken = new Set<string>()
  for (const i of items) (i.result === 'works' ? works : broken).add(i.origin)
  return { works: works.size, broken: broken.size }
}

function valueOf(item: EvidenceItem, dim: ConditionDimension): string {
  switch (dim) {
    case 'connection':
      return item.connection ? CONNECTION_LABELS[item.connection] : UNKNOWN
    case 'gameVersion':
      return item.gameVersion ?? UNKNOWN
    case 'variant':
      return item.variant ?? 'Model not specified'
    case 'androidVersion':
      return item.androidVersion ? `Android ${item.androidVersion}` : UNKNOWN
  }
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
}

export function conditionDifferences(items: EvidenceItem[]): ConditionDifference[] {
  const works = items.filter((i) => i.result === 'works')
  const broken = items.filter((i) => i.result === 'broken')
  if (works.length === 0 || broken.length === 0) return []
  const dims: ConditionDimension[] = ['connection', 'gameVersion', 'variant', 'androidVersion']
  const out: ConditionDifference[] = []
  for (const dimension of dims) {
    const w = sortedUnique(works.map((i) => valueOf(i, dimension)))
    const b = sortedUnique(broken.map((i) => valueOf(i, dimension)))
    if (w.join('\u0000') !== b.join('\u0000')) out.push({ dimension, works: w, broken: b })
  }
  return out
}

export function summarizeControl(control: Control, all: EvidenceItem[]): ControlSummary {
  const items = all.filter((i) => i.control === control)
  const directItems = items.filter((i) => i.kind === 'direct')
  const externalItems = items.filter((i) => i.kind === 'external')
  const direct = countResults(directItems)
  const external = countResults(externalItems)

  let state: ControlState = 'no_data'
  let differences: ConditionDifference[] = []
  if (direct.works + direct.broken > 0) {
    if (direct.works > 0 && direct.broken > 0) {
      state = 'conflicting'
      differences = conditionDifferences(directItems)
    } else {
      state = direct.works > 0 ? 'works' : 'broken'
    }
  } else if (external.works + external.broken > 0) {
    if (external.works > 0 && external.broken > 0) {
      state = 'reported_conflicting'
      differences = conditionDifferences(externalItems)
    } else {
      state = external.works > 0 ? 'reported_works' : 'reported_broken'
    }
  }

  const externalDisagrees =
    (state === 'works' && external.broken > 0) || (state === 'broken' && external.works > 0)

  const dates = items.map((i) => i.date).filter((d): d is string => d !== null)
  const lastDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null

  return { control, direct, external, state, externalDisagrees, differences, lastDate }
}

export function summarizeControls(items: EvidenceItem[]): ControlSummary[] {
  return CONTROLS.map((c) => summarizeControl(c, items))
}

export const ISSUE_STATES: ControlState[] = ['broken', 'conflicting', 'reported_broken', 'reported_conflicting']

export function isIssue(s: ControlSummary): boolean {
  return ISSUE_STATES.includes(s.state) || s.externalDisagrees
}

/** Controls with only external reports, or direct tests that disagree. */
export function needsVerification(s: ControlSummary): boolean {
  return s.state === 'conflicting' || s.state.startsWith('reported_') || s.externalDisagrees
}

export const STATE_LABELS: Record<ControlState, string> = {
  no_data: 'No data',
  works: 'Works',
  broken: 'Broken',
  conflicting: 'Conflicting',
  reported_works: 'Reported working',
  reported_broken: 'Reported broken',
  reported_conflicting: 'Reports conflict',
}

/** Plain-language count line, e.g. "2 direct tests: 1 works, 1 broken". */
export function describeCounts(c: Counts, noun: 'direct' | 'external'): string {
  const total = c.works + c.broken
  if (total === 0) return noun === 'direct' ? 'No direct tests' : 'No external reports'
  const word = noun === 'direct' ? (total === 1 ? 'direct test' : 'direct tests') : total === 1 ? 'external report' : 'external reports'
  if (c.works && c.broken) return `${total} ${word}: ${c.works} works, ${c.broken} broken`
  return `${total} ${word}: ${c.works ? 'works' : 'broken'}`
}
