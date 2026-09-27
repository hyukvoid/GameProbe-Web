import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DirectTestRecord, EmptyTests, ExternalReportRecord, StateLabel } from '@/components/evidence'
import { Conditions, EvidenceCounts } from '@/components/issues'
import { summarizeControls } from '@/lib/aggregate'
import {
  getFamilyBySlug,
  getGameBySlug,
  listDirectTests,
  listEvidenceItems,
  listExternalReports,
  listVerificationRequests,
} from '@/lib/data/public'
import { includeDemoData, requestDb } from '@/lib/db'
import { CONTROL_LABELS } from '@/lib/domain'
import { formatDate, plural } from '@/lib/format'

type Props = { params: Promise<{ game: string; controller: string }> }

async function load(params: Props['params']) {
  const sql = await requestDb()
  const p = await params
  const [game, family] = await Promise.all([getGameBySlug(sql, p.game), getFamilyBySlug(sql, p.controller)])
  return { sql, game, family }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { game, family } = await load(params)
  return { title: game && family ? `${family.name} in ${game.name}` : 'Not found' }
}

export default async function CombinationPage({ params }: Props) {
  const { sql, game, family } = await load(params)
  if (!game || !family) notFound()

  const scope = { includeDemo: includeDemoData(), gameId: game.id, familyId: family.id }
  const [items, tests, reports, requests] = await Promise.all([
    listEvidenceItems(sql, scope),
    listDirectTests(sql, { ...scope, limit: 100 }),
    listExternalReports(sql, scope),
    listVerificationRequests(sql, scope),
  ])
  const summaries = summarizeControls(items)
  const versions = [...new Set(tests.map((t) => t.gameVersion).filter((v): v is string => v !== null))].sort((a, b) =>
    b.localeCompare(a, 'en', { numeric: true }),
  )
  const dates = items.map((i) => i.date).filter((d): d is string => d !== null)
  const last = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null
  const submitHref = `/submit?game=${game.slug}&controller=${family.slug}`
  const hasData = items.length > 0

  return (
    <main id="main">
      <div className="page-head">
        <p className="crumbs">
          <Link href={`/games/${game.slug}`}>{game.name}</Link> / {family.name}
        </p>
        <h1>
          {family.name} in {game.name}
        </h1>
        <p className="meta">
          {plural(tests.length, 'direct test')}, {plural(reports.length, 'external report')}
          {last && <>. Last report {formatDate(last)}</>}
          {versions.length > 0 && <>. Game versions tested: {versions.join(', ')}</>}
        </p>
        <div className="page-actions">
          <Link href={submitHref} className="button secondary">
            Submit a test for this controller
          </Link>
        </div>
      </div>

      <section className="first" aria-labelledby="controls-heading">
        <h2 id="controls-heading">Controls</h2>
        {!hasData ? (
          <EmptyTests href={submitHref} />
        ) : (
          <>
            <table className="stack">
              <thead>
                <tr>
                  <th scope="col">Control</th>
                  <th scope="col">Result</th>
                  <th scope="col">Evidence</th>
                  <th scope="col">Conditions that differ</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.control}>
                    <td className="primary" data-label="Control">
                      {CONTROL_LABELS[s.control]}
                    </td>
                    <td data-label="Result">
                      <StateLabel state={s.state} />
                    </td>
                    <td data-label="Evidence">
                      <EvidenceCounts s={s} />
                    </td>
                    <td data-label="Conditions">
                      {s.state === 'no_data' ? <span className="muted small">—</span> : <Conditions s={s} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="section-note">
              The result comes from direct tests when there are any. “Reported” results come from external reports only.
              Different results are shown as conflicting, with the conditions that differ.
            </p>
          </>
        )}
      </section>

      {requests.length > 0 && (
        <section aria-labelledby="verify-heading">
          <h2 id="verify-heading">Needs verification</h2>
          <ul className="records">
            {requests.map((r) => (
              <ExternalReportRecord key={r.sourceId} report={r} />
            ))}
          </ul>
        </section>
      )}

      {hasData && (
        <>
      <section aria-labelledby="direct-heading">
        <h2 id="direct-heading">Direct tests</h2>
        {tests.length > 0 ? (
          <ul className="records">
            {tests.map((t) => (
              <DirectTestRecord key={t.id} test={t} />
            ))}
          </ul>
        ) : (
          <EmptyTests href={submitHref} />
        )}
      </section>

      <section aria-labelledby="external-heading">
        <h2 id="external-heading">External reports</h2>
        <p className="section-note">Found on other sites and reviewed by hand. Not tested by GameProbe.</p>
        {reports.length > 0 ? (
          <ul className="records">
            {reports.map((r) => (
              <ExternalReportRecord key={r.sourceId} report={r} />
            ))}
          </ul>
        ) : (
          <div className="empty">
            <p>No reviewed external reports.</p>
          </div>
        )}
      </section>
        </>
      )}
    </main>
  )
}
