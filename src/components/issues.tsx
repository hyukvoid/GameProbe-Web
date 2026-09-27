import Link from 'next/link'
import { DIMENSION_LABELS, describeCounts, type ControlSummary } from '@/lib/aggregate'
import type { IssueRow } from '@/lib/data/public'
import { CONTROL_SHORT } from '@/lib/domain'
import { formatDate } from '@/lib/format'
import { StateLabel } from './evidence'

/** Evidence counts for one control, with direct tests and external reports on separate lines. */
export function EvidenceCounts({ s }: { s: ControlSummary }) {
  return (
    <div>
      <div>{describeCounts(s.direct, 'direct')}</div>
      <div className="muted">{describeCounts(s.external, 'external')}</div>
    </div>
  )
}

/** Conditions that differ between conflicting results, or a note when they do not. */
export function Conditions({ s }: { s: ControlSummary }) {
  if (s.differences.length > 0) {
    return (
      <ul className="records small">
        {s.differences.map((d) => (
          <li key={d.dimension}>
            {DIMENSION_LABELS[d.dimension]}: works on {d.works.join(', ')}; broken on {d.broken.join(', ')}
          </li>
        ))}
      </ul>
    )
  }
  if (s.state === 'conflicting' || s.state === 'reported_conflicting') {
    return <span className="small">Results differ under the same recorded conditions.</span>
  }
  if (s.externalDisagrees) {
    return <span className="small">External reports disagree with direct tests.</span>
  }
  return <span className="muted small">—</span>
}

export function IssueTable({ rows, caption }: { rows: IssueRow[]; caption: string }) {
  return (
    <table className="stack">
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Game and controller</th>
          <th scope="col">Control</th>
          <th scope="col">Result</th>
          <th scope="col">Evidence</th>
          <th scope="col">Conditions that differ</th>
          <th scope="col">Last report</th>
        </tr>
      </thead>
      <tbody>
        {rows.flatMap((row) =>
          row.summaries.map((s) => (
            <tr key={`${row.gameSlug}/${row.familySlug}/${s.control}`}>
              <td className="primary" data-label="Game and controller">
                <Link href={`/games/${row.gameSlug}/${row.familySlug}`}>
                  {row.gameName} · {row.familyName}
                </Link>
              </td>
              <td data-label="Control">{CONTROL_SHORT[s.control]}</td>
              <td data-label="Result">
                <StateLabel state={s.state} />
              </td>
              <td data-label="Evidence">
                <EvidenceCounts s={s} />
              </td>
              <td data-label="Conditions">
                <Conditions s={s} />
              </td>
              <td data-label="Last report" className="nowrap">
                {formatDate(s.lastDate)}
              </td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  )
}
