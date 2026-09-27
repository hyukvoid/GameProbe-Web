import {
  connectionResultLabel,
  describeKindCount,
  type CompatibilityAnswer,
  type ConnectionAnswer,
  type ControlRow,
  type ControllerEvidence,
  type ControllerScope,
  type EvidenceKind,
  type GameWideEvidence,
  type VerificationContext,
} from '@/lib/compatibility'
import { CONNECTION_HEADINGS, CONTROL_LABELS, EVIDENCE_CONTROL_SHORT, SOURCE_TYPE_LABELS } from '@/lib/domain'
import { formatDate } from '@/lib/format'
import { hostOf } from '@/lib/url'
import { StateLabel } from './evidence'
import { Conditions, EvidenceCounts } from './issues'

const KIND_LABELS: Record<EvidenceKind, string> = {
  direct: 'Direct test',
  official: 'Official source',
  external: 'External report',
}

function resultClass(a: ConnectionAnswer): string {
  if (a.result === 'none') return 'state state-unknown'
  const tone = a.result === 'working' ? 'state-works' : a.result === 'problem' ? 'state-broken' : 'state-conflicting'
  // External-only results are outlined, like other "reported" states.
  return `state ${tone}${a.basis === 'external' ? ' state-reported' : ''}`
}

/** How far a record identifies the controller, in words. */
export function describeControllerScope(scope: ControllerScope, familyName: string): string {
  switch (scope.level) {
    case 'variant':
      return scope.name
    case 'wording':
      return `“${scope.wording}” as written (${familyName} family, model not linked)`
    case 'family':
      return `${familyName} (family only, model not specified)`
    case 'unspecified':
      return 'Controller not specified'
  }
}

type ContextOrEvidence = ControllerEvidence | GameWideEvidence | VerificationContext

function resultsLine(e: ContextOrEvidence): string {
  const parts: string[] = []
  if (e.detected !== null) parts.push(e.detected ? 'Detected by the game' : 'Not detected by the game')
  for (const r of e.results) parts.push(`${EVIDENCE_CONTROL_SHORT[r.subject]}: ${r.result === 'works' ? 'works' : 'problem'}`)
  return parts.length ? parts.join('; ') : 'No result recorded'
}

function conditionsLine(e: ContextOrEvidence): string {
  return [
    e.androidVersion ? `Android ${e.androidVersion}` : 'Android version not stated',
    e.gameVersion ? `Game version ${e.gameVersion}` : 'Game version not stated',
    e.controllerMode ? `Mode: ${e.controllerMode}` : 'Mode not stated',
  ].join(' · ')
}

function EvidenceLine({ e, familyName }: { e: ContextOrEvidence; familyName: string }) {
  return (
    <li>
      <span>
        <strong>{KIND_LABELS[e.kind]}</strong>
        {e.source && <> · {hostOf(e.source.url)}</>} · {e.date ? formatDate(e.date) : 'Date not stated'}
        {e.standing === 'needs_verification' && (
          <>
            {' '}
            <span className="state state-verify">Needs verification</span>
          </>
        )}
        {e.applies === 'game_wide' && <span className="muted"> · Related game-wide report</span>}
        {e.isDemo && <span className="muted small"> (demo fixture)</span>}
      </span>
      <span>
        {describeControllerScope(e.controller, familyName)} · {conditionsLine(e)}
      </span>
      <span>{resultsLine(e)}</span>
      {e.statement && <span className="muted">{e.statement}</span>}
      {e.source && (
        <span className="small">
          <a href={e.source.url} rel="nofollow ugc noopener noreferrer">
            View source
          </a>{' '}
          <span className="muted">({SOURCE_TYPE_LABELS[e.source.sourceType]})</span>
        </span>
      )}
    </li>
  )
}

function ConnectionRecord({ a, familyName }: { a: ConnectionAnswer; familyName: string }) {
  const heading = CONNECTION_HEADINGS[a.connection]
  return (
    <li className="record" data-connection={a.connection}>
      <div className="record-kind">
        <h3>{heading}</h3>
      </div>
      <div className="record-body">
        <p>
          <span className={resultClass(a)}>{connectionResultLabel(a)}</span>
          {a.latestDate && <span className="muted small"> · Last report {formatDate(a.latestDate)}</span>}
        </p>
        <dl className="facts">
          <div>
            <dt>Direct tests</dt>
            <dd>{describeKindCount(a.totals.direct, a.outcomes.direct)}</dd>
          </div>
          <div>
            <dt>Official sources</dt>
            <dd>{describeKindCount(a.totals.official, a.outcomes.official)}</dd>
          </div>
          <div>
            <dt>Other external reports</dt>
            <dd>{describeKindCount(a.totals.external, a.outcomes.external)}</dd>
          </div>
        </dl>
        {a.externalDisagrees && (
          <p className="small">External reports for {heading} disagree with the direct tests on {heading}.</p>
        )}
        {a.evidence.length > 0 && (
          <ul className="scope-list" aria-label={`${heading} evidence for ${familyName}`}>
            {a.evidence.map((e) => (
              <EvidenceLine key={e.key} e={e} familyName={familyName} />
            ))}
          </ul>
        )}
        {a.gameWide.length > 0 && (
          <div className="context">
            <p className="small muted">
              Related game-wide {a.gameWide.length === 1 ? 'report' : 'reports'} for {heading}. The controller is not
              specified, so {a.gameWide.length === 1 ? 'it is' : 'they are'} not counted for {familyName}.
            </p>
            <ul className="scope-list" aria-label={`Game-wide reports for ${heading}`}>
              {a.gameWide.map((e) => (
                <EvidenceLine key={e.key} e={e} familyName={familyName} />
              ))}
            </ul>
          </div>
        )}
        <VerificationBlock items={a.verification} where={heading} familyName={familyName} />
      </div>
    </li>
  )
}

/** Claims awaiting a direct test. Always visibly separate from the counted evidence. */
function VerificationBlock({
  items,
  where,
  familyName,
}: {
  items: VerificationContext[]
  where: string
  familyName: string
}) {
  if (items.length === 0) return null
  const one = items.length === 1
  return (
    <div className="context" data-context="needs-verification">
      <p className="small muted">
        Needs verification: {one ? 'a reviewed report' : 'reviewed reports'} awaiting a direct test.{' '}
        {one ? 'It is' : 'They are'} not counted in the result above.
      </p>
      <ul className="scope-list" aria-label={`Needs verification: ${where}`}>
        {items.map((e) => (
          <EvidenceLine key={e.key} e={e} familyName={familyName} />
        ))}
      </ul>
    </div>
  )
}

function NotStatedRecord({ answer, familyName }: { answer: CompatibilityAnswer; familyName: string }) {
  const { evidence, gameWide, verification } = answer.connectionNotStated
  return (
    <li className="record" data-connection="not-stated">
      <div className="record-kind">
        <h3>Connection not stated</h3>
      </div>
      <div className="record-body">
        <p className="small muted">
          These records don’t say which connection was used. They are not counted for Bluetooth, USB cable or Dongle.
        </p>
        {evidence.length > 0 && (
          <ul className="scope-list" aria-label={`${familyName} evidence with no connection stated`}>
            {evidence.map((e) => (
              <EvidenceLine key={e.key} e={e} familyName={familyName} />
            ))}
          </ul>
        )}
        {gameWide.length > 0 && (
          <div className="context">
            <p className="small muted">Game-wide, controller not specified:</p>
            <ul className="scope-list" aria-label="Game-wide reports with no connection stated">
              {gameWide.map((e) => (
                <EvidenceLine key={e.key} e={e} familyName={familyName} />
              ))}
            </ul>
          </div>
        )}
        <VerificationBlock items={verification} where="Connection not stated" familyName={familyName} />
      </div>
    </li>
  )
}

/** One row per connection, always, followed by records that state no connection. */
export function ConnectionCompatibility({ answer, familyName }: { answer: CompatibilityAnswer; familyName: string }) {
  const ns = answer.connectionNotStated
  return (
    <ul className="records">
      {answer.connections.map((a) => (
        <ConnectionRecord key={a.connection} a={a} familyName={familyName} />
      ))}
      {(ns.evidence.length > 0 || ns.gameWide.length > 0 || ns.verification.length > 0) && (
        <NotStatedRecord answer={answer} familyName={familyName} />
      )}
    </ul>
  )
}

/** Physical controls with evidence, each row scoped to one connection. */
export function PhysicalControls({ rows }: { rows: ControlRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="empty">
        <p>No per-control test data yet.</p>
      </div>
    )
  }
  return (
    <>
      <table className="stack">
        <thead>
          <tr>
            <th scope="col">Control</th>
            <th scope="col">Connection</th>
            <th scope="col">Result</th>
            <th scope="col">Evidence</th>
            <th scope="col">Conditions that differ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.control}:${r.connection ?? 'not-stated'}`}>
              <td className="primary" data-label="Control">
                {CONTROL_LABELS[r.control]}
              </td>
              <td data-label="Connection">
                {r.connection ? CONNECTION_HEADINGS[r.connection] : <span className="unknown-value">Connection not stated</span>}
              </td>
              <td data-label="Result">
                <StateLabel state={r.summary.state} />
              </td>
              <td data-label="Evidence">
                <EvidenceCounts s={r.summary} />
              </td>
              <td data-label="Conditions">
                <Conditions s={r.summary} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="section-note">
        Each row covers one connection. A direct test decides only the connection it was run on. Controls without
        evidence are not listed and remain unknown.
      </p>
    </>
  )
}
