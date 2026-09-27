import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-session'
import { listEvidence } from '@/lib/data/admin'
import { requestDb } from '@/lib/db'
import { REVIEW_STATUSES, REVIEW_STATUS_LABELS, SOURCE_TYPE_LABELS, type ReviewStatus } from '@/lib/domain'
import { formatDate } from '@/lib/format'
import { hostOf } from '@/lib/url'
import { AddEvidenceForm } from './add-form'

export const metadata: Metadata = { title: 'Evidence Inbox' }

type Props = { searchParams: Promise<{ status?: string }> }

export default async function InboxPage({ searchParams }: Props) {
  await requireAdmin()
  const requested = (await searchParams).status ?? 'new'
  const status: ReviewStatus | 'all' =
    requested === 'all' || (REVIEW_STATUSES as readonly string[]).includes(requested) ? (requested as ReviewStatus | 'all') : 'new'
  const rows = await listEvidence(await requestDb(), status)

  return (
    <main id="main">
      <div className="page-head">
        <h1>Evidence Inbox</h1>
        <p className="meta">
          Private research queue. Add a URL by hand, then review it. Nothing here is public until you publish a claim.
        </p>
      </div>

      <section className="first" aria-labelledby="add-heading">
        <h2 id="add-heading">Add a source</h2>
        <AddEvidenceForm />
      </section>

      <section aria-labelledby="queue-heading">
        <h2 id="queue-heading">Queue</h2>
        <nav className="tabs" aria-label="Filter by review status" style={{ marginTop: 8 }}>
          {[...REVIEW_STATUSES, 'all' as const].map((s) => (
            <Link key={s} href={`/admin/evidence?status=${s}`} aria-current={s === status ? 'page' : undefined}>
              {s === 'all' ? 'All' : REVIEW_STATUS_LABELS[s]}
            </Link>
          ))}
        </nav>
        {rows.length === 0 ? (
          <div className="empty">
            <p>No sources with this status.</p>
          </div>
        ) : (
          <table className="stack">
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Status</th>
                <th scope="col">Report?</th>
                <th scope="col">Game</th>
                <th scope="col">Controller</th>
                <th scope="col">Added</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="primary break" data-label="Source">
                    <div>
                    <Link href={`/admin/evidence/${r.id}`}>{r.title ?? hostOf(r.url)}</Link>
                    <div className="small muted">
                      {SOURCE_TYPE_LABELS[r.sourceType]} · {hostOf(r.url)}
                      {r.isDemo && ' · Demo fixture'}
                    </div>
                    </div>
                  </td>
                  <td data-label="Status">{REVIEW_STATUS_LABELS[r.reviewStatus]}</td>
                  <td data-label="Report?">{r.isReport === null ? <span className="muted">Not assessed</span> : r.isReport ? 'Yes' : 'No'}</td>
                  <td data-label="Game">{r.gameName ?? <span className="muted">—</span>}</td>
                  <td data-label="Controller">
                    <div>
                      {r.variantName ?? r.familyName ?? <span className="muted">—</span>}
                      {r.controllerAsWritten && <div className="small muted">Source says “{r.controllerAsWritten}”</div>}
                    </div>
                  </td>
                  <td data-label="Added" className="nowrap">{formatDate(r.addedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  )
}
