import Link from 'next/link'
import { STATE_LABELS, type ControlState } from '@/lib/aggregate'
import type { DirectTest, ExternalReport } from '@/lib/data/public'
import {
  CONNECTION_LABELS,
  CONTROL_SHORT,
  EVIDENCE_CONTROL_LABELS,
  SOURCE_TYPE_LABELS,
  UNKNOWN,
  type ConnectionType,
  type Result,
} from '@/lib/domain'
import { formatDate } from '@/lib/format'
import { hostOf } from '@/lib/url'

const STATE_CLASS: Record<ControlState, string> = {
  no_data: 'state state-unknown',
  works: 'state state-works',
  broken: 'state state-broken',
  conflicting: 'state state-conflicting',
  reported_works: 'state state-works state-reported',
  reported_broken: 'state state-broken state-reported',
  reported_conflicting: 'state state-conflicting state-reported',
}

export function StateLabel({ state }: { state: ControlState }) {
  return <span className={STATE_CLASS[state]}>{STATE_LABELS[state]}</span>
}

export function ResultLabel({ result, reported = false }: { result: Result; reported?: boolean }) {
  const cls = `state ${result === 'works' ? 'state-works' : 'state-broken'}${reported ? ' state-reported' : ''}`
  return <span className={cls}>{result === 'works' ? 'Works' : 'Broken'}</span>
}

/** Renders a value, or a visibly marked "Unknown" when it is null. */
export function Value({ value, unknown = UNKNOWN }: { value: string | null | undefined; unknown?: string }) {
  return value ? <>{value}</> : <span className="unknown-value">{unknown}</span>
}

export function connectionLabel(c: ConnectionType | null): string | null {
  return c ? CONNECTION_LABELS[c] : null
}

export function DemoMark({ show }: { show: boolean }) {
  return show ? <span className="muted small">(demo fixture)</span> : null
}

/** Result inside a record list. Only failures get a filled label, to keep long lists readable. */
export function InlineResult({ result, reported = false }: { result: Result; reported?: boolean }) {
  if (result === 'works') return <span className="result-works">Works</span>
  return <ResultLabel result="broken" reported={reported} />
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function controllerOf(t: {
  variantName: string | null
  familyName: string | null
  controllerAsEntered: string | null
}): React.ReactNode {
  if (t.variantName) return t.variantName
  if (t.familyName) return (
    <>
      {t.familyName} <span className="muted">(model not specified)</span>
    </>
  )
  return (
    <>
      {t.controllerAsEntered} <span className="muted">(as entered, not in catalog)</span>
    </>
  )
}

export function DirectTestRecord({ test, showGame = false }: { test: DirectTest; showGame?: boolean }) {
  return (
    <li className="record">
      <div className="record-kind">
        Direct test
        <span className="date">{formatDate(test.testedOn)}</span>
      </div>
      <div className="record-body">
        <div className="record-title">
          {showGame && (
            <>
              <Link href={`/games/${test.gameSlug}`}>{test.gameName}</Link>
              {' · '}
            </>
          )}
          {test.familySlug ? (
            <Link href={`/games/${test.gameSlug}/${test.familySlug}`}>{controllerOf(test)}</Link>
          ) : (
            controllerOf(test)
          )}{' '}
          <DemoMark show={test.isDemo} />
        </div>
        <dl className="facts">
          <Fact label="Game version">
            <Value value={test.gameVersion} />
          </Fact>
          <Fact label="Detected by the game">
            <Value value={test.controllerDetected === null ? null : test.controllerDetected ? 'Yes' : 'No'} />
          </Fact>
          <Fact label="Connection">
            <Value value={connectionLabel(test.connection)} />
          </Fact>
          <Fact label="Mode">
            <Value value={test.controllerMode} />
          </Fact>
          <Fact label="Device">
            <Value value={[test.deviceName, test.deviceModel].filter(Boolean).join(' ') || null} />
          </Fact>
          <Fact label="Android">
            <Value value={test.androidVersion} />
          </Fact>
        </dl>
        <ul className="results" aria-label="Results">
          {test.observations.map((o) => (
            <li key={o.control}>
              {CONTROL_SHORT[o.control]}: <InlineResult result={o.result} />
            </li>
          ))}
        </ul>
        {test.notes && <p className="quote">{test.notes}</p>}
      </div>
    </li>
  )
}

export function ExternalReportRecord({ report, showGame = false }: { report: ExternalReport; showGame?: boolean }) {
  return (
    <li className="record external">
      <div className="record-kind">
        External report
        <span className="date">{report.publishedOn ? formatDate(report.publishedOn) : 'Date unknown'}</span>
      </div>
      <div className="record-body">
        <div className="record-title">
          {showGame && (
            <>
              <Link href={`/games/${report.gameSlug}`}>{report.gameName}</Link>
              {' · '}
            </>
          )}
          {report.familySlug ? (
            <Link href={`/games/${report.gameSlug}/${report.familySlug}`}>
              {report.variantName ?? report.familyName}
            </Link>
          ) : (
            <span>Controller not specified</span>
          )}
          {report.familySlug && !report.variantName && <span className="muted"> (model not specified)</span>}{' '}
          <DemoMark show={report.isDemo} />
        </div>
        <p>{report.claims[0]?.statement}</p>
        <dl className="facts">
          <Fact label="Source wording">
            <Value value={report.controllerAsWritten ? `“${report.controllerAsWritten}”` : null} />
          </Fact>
          <Fact label="Game version">
            <Value value={report.gameVersion} />
          </Fact>
          <Fact label="Connection">
            <Value value={connectionLabel(report.connection)} />
          </Fact>
          <Fact label="Device">
            <Value value={[report.deviceAsWritten, report.deviceModel].filter(Boolean).join(' ') || null} />
          </Fact>
          <Fact label="Android">
            <Value value={report.androidVersion} />
          </Fact>
        </dl>
        <ul className="results" aria-label="Reported results">
          {report.claims.map((c) => (
            <li key={`${c.control}:${c.connection ?? 'none'}`}>
              {EVIDENCE_CONTROL_LABELS[c.control]}: <InlineResult result={c.result} reported />
              {c.connection && <span className="muted"> over {CONNECTION_LABELS[c.connection]}</span>}
            </li>
          ))}
        </ul>
        <p className="small">
          <a href={report.url} rel="nofollow ugc noopener noreferrer">
            View source
          </a>{' '}
          <span className="muted">
            ({SOURCE_TYPE_LABELS[report.sourceType]}, {hostOf(report.url)})
          </span>
          {report.missing.length > 0 && <span className="muted"> · Not stated: {report.missing.join(', ')}</span>}
        </p>
      </div>
    </li>
  )
}

export function EmptyTests({ href = '/submit', text = 'No verified tests yet.' }: { href?: string; text?: string }) {
  return (
    <div className="empty">
      <p>{text}</p>
      <p>
        <Link href={href}>Submit a test</Link>
      </p>
    </div>
  )
}
