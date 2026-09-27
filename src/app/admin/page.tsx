import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-session'
import { funnel } from '@/lib/data/admin'
import { requestDb } from '@/lib/db'

export const metadata: Metadata = { title: 'Overview' }

export default async function AdminHome() {
  await requireAdmin()
  const f = await funnel(await requestDb())
  const rows: [string, number, string][] = [
    ['Candidate URLs added', f.candidateUrls, 'Everything added to the Evidence Inbox'],
    ['Reviewed', f.reviewed, 'Any decision other than New'],
    ['Actual reports', f.actualReports, 'Marked as a report, not a question or discussion'],
    ['Reports naming an exact controller model', f.withExactController, 'Linked to a controller model, not only a family'],
    ['Reports stating a game version', f.withGameVersion, 'Exact version string recorded'],
    ['Published external claims (sources)', f.publishedSources, 'Visible under External reports'],
    ['Marked as needing a direct test', f.needsDirectTest, 'Visible under Needs verification'],
    ['Duplicates merged', f.duplicates, 'Not counted as independent evidence'],
    ['Rejected', f.rejected, ''],
    ['Direct tests submitted', f.directTestsSubmitted, 'All statuses'],
    ['Direct tests approved', f.directTestsApproved, ''],
    ['Direct tests pending', f.directTestsPending, ''],
  ]
  return (
    <main id="main">
      <div className="page-head">
        <h1>Overview</h1>
        <p className="meta">
          <Link href="/admin/tests">Review pending tests</Link> · <Link href="/admin/evidence">Open the Evidence Inbox</Link>
        </p>
      </div>
      <section className="first" aria-labelledby="funnel-heading">
        <h2 id="funnel-heading">Evidence funnel</h2>
        <p className="section-note">Development fixtures are excluded.</p>
        <table className="stack">
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col" className="num">Count</th>
              <th scope="col">Definition</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, n, note]) => (
              <tr key={label}>
                <td className="primary" data-label="Step">{label}</td>
                <td className="num" data-label="Count">{n}</td>
                <td className="muted" data-label="Definition">{note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}
