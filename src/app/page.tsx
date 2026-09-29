import Link from 'next/link'
import type { Metadata } from 'next'
import { DirectTestRecord, EmptyTests, ExternalReportRecord } from '@/components/evidence'
import { GameThumb } from '@/components/game-thumb'
import { IssueTable } from '@/components/issues'
import {
  combine,
  gameOverviews,
  knownIssues,
  listControllerCatalog,
  listDirectTests,
  listEvidenceItems,
  listGames,
  listVerificationRequests,
  unverified,
} from '@/lib/data/public'
import { includeDemoData, requestDb } from '@/lib/db'
import { formatDate, plural } from '@/lib/format'
import { indexRobots } from '@/lib/seo'
import { siteOrigin } from '@/lib/site'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { absolute: 'GameProbe — Android controller compatibility' },
    description:
      'Android controller support for Genshin Impact, Zenless Zone Zero, Wuthering Waves, Call of Duty: Mobile and more: reviewed controller evidence, reported issues and direct-test status.',
    alternates: { canonical: await siteOrigin() },
    robots: indexRobots(true),
  }
}

export default async function Home() {
  const sql = await requestDb()
  const includeDemo = includeDemoData()
  // Two bounded waves: at most three page-data queries in flight, so the homepage never
  // competes with itself for the connection pool.
  const [games, families, items] = await Promise.all([
    listGames(sql),
    listControllerCatalog(sql),
    listEvidenceItems(sql, { includeDemo }),
  ])
  const [recent, requests] = await Promise.all([
    listDirectTests(sql, { includeDemo, limit: 6 }),
    listVerificationRequests(sql, { includeDemo }),
  ])
  const combos = combine(items)
  const overviews = gameOverviews(games, combos)
  const issues = knownIssues(combos, games, families)
  const toVerify = unverified(combos, games, families)

  return (
    <main id="main">
      <h1 className="visually-hidden">Android controller compatibility</h1>

      <section className="first" aria-labelledby="games-heading">
        <h2 id="games-heading">Games</h2>
        <table className="stack">
          <thead>
            <tr>
              <th scope="col">Game</th>
              <th scope="col" className="num">Direct tests</th>
              <th scope="col" className="num">External reports</th>
              <th scope="col" className="num">Controllers with reported issues</th>
              <th scope="col">Last report</th>
            </tr>
          </thead>
          <tbody>
            {overviews.map((g) => (
              <tr key={g.id}>
                <td className="primary" data-label="Game">
                  <span className="thumb-line">
                    <GameThumb slug={g.slug} />
                    <Link href={`/games/${g.slug}`}>{g.name}</Link>
                  </span>
                </td>
                <td className="num" data-label="Direct tests">{g.directTests}</td>
                <td className="num" data-label="External reports">{g.externalReports}</td>
                <td className="num" data-label="Controllers with issues">{g.controllersWithIssues}</td>
                <td data-label="Last report">{g.lastDate ? formatDate(g.lastDate) : <span className="muted">No reports yet</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="issues-heading">
        <h2 id="issues-heading">Known issues</h2>
        <p className="section-note">
          Controls reported broken, or with results that disagree. Direct tests and external reports are counted
          separately.
        </p>
        {issues.length > 0 ? (
          <IssueTable rows={issues} caption="Known issues" />
        ) : (
          <div className="empty">
            <p>No issues reported yet.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="verify-heading">
        <h2 id="verify-heading">Needs verification</h2>
        <p className="section-note">Known only from external reports, not yet confirmed by a direct test.</p>
        {toVerify.length === 0 && requests.length === 0 ? (
          <div className="empty">
            <p>Nothing waiting for verification.</p>
          </div>
        ) : (
          <>
            {toVerify.length > 0 && <IssueTable rows={toVerify} caption="Needs verification" />}
            {requests.length > 0 && (
              <ul className="records">
                {requests.map((r) => (
                  <ExternalReportRecord key={r.recordKey} report={r} showGame />
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading">Recently tested</h2>
        {recent.length > 0 ? (
          <ul className="records">
            {recent.map((t) => (
              <DirectTestRecord key={t.id} test={t} showGame />
            ))}
          </ul>
        ) : (
          <EmptyTests />
        )}
        {recent.length > 0 && (
          <p className="section-note">
            Showing the latest {plural(recent.length, 'approved test')}. Submitted tests appear after review.
          </p>
        )}
      </section>
    </main>
  )
}
