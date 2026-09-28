import Link from 'next/link'
import {
  COMBINATION_STATUS_LABELS,
  type CombinationEvidenceStatus,
  type CombinationSearchResult,
  type ControllerGameStatus,
  type ControllerFamily,
} from '@/lib/data/public'
import { formatDate, plural } from '@/lib/format'

/**
 * Evidence availability, never a compatibility verdict: these labels say which records
 * exist for one Game × Controller pair, not whether a controller works.
 */
function StatusLabel({ status }: { status: CombinationEvidenceStatus }) {
  const cls =
    status === 'evidence_available'
      ? 'state state-evidence'
      : status === 'needs_verification'
        ? 'state state-verify'
        : 'state state-no-evidence'
  return <span className={cls}>{COMBINATION_STATUS_LABELS[status]}</span>
}

/** One Game × Controller search result, with the evidence that does or does not exist. */
export function CombinationResult({ result }: { result: CombinationSearchResult }) {
  const { game, family, status } = result
  const href = `/games/${game.slug}/${family.slug}`
  return (
    <li className="empty">
      <p className="record-title">
        <Link href={href}>{family.name} in {game.name}</Link>
      </p>
      <p className="small">
        <StatusLabel status={status} />
      </p>
      {status === 'evidence_available' && (
        <ul className="results small" aria-label="Evidence counts">
          <li>Direct tests: {result.directTests}</li>
          <li>Official sources: {result.published.officialSources}</li>
          <li>Other reviewed sources: {result.published.otherSources}</li>
          {result.lastControllerEvidenceDate && (
            <li className="muted">Last evidence: {formatDate(result.lastControllerEvidenceDate)}</li>
          )}
        </ul>
      )}
      {status === 'needs_verification' && (
        <p className="small muted">
          {plural(result.verificationSources, 'reviewed report')}{' '}
          {result.verificationSources === 1 ? 'needs' : 'need'} a direct test · Direct tests: {result.directTests}
        </p>
      )}
      {status === 'no_controller_evidence' &&
        (result.gameWideContext.publishedSources > 0 || result.gameWideContext.verificationSources > 0) && (
          <p className="small muted">Game-wide report exists; controller not specified</p>
        )}
      <p className="small">
        <Link href={href}>Open compatibility</Link>
      </p>
    </li>
  )
}

/**
 * The games listed under one matched controller, each with its own status: a controller
 * does not have equal coverage across every game, and the list must not imply that it does.
 */
export function CompatibilityByGame({
  family,
  rows,
}: {
  family: ControllerFamily
  rows: ControllerGameStatus[]
}) {
  return (
    <ul className="records">
      {rows.map(({ game, status }) => (
        <li key={game.id} className="small">
          <Link href={`/games/${game.slug}/${family.slug}`}>{game.name}</Link>
          <span className="muted"> · {COMBINATION_STATUS_LABELS[status]}</span>
        </li>
      ))}
    </ul>
  )
}
