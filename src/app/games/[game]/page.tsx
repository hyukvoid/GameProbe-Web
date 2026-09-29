import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DirectTestRecord, EmptyTests, ExternalReportRecord, StateLabel } from '@/components/evidence'
import { GameThumb } from '@/components/game-thumb'
import { IssueTable } from '@/components/issues'
import { isIssue } from '@/lib/aggregate'
import {
  combine,
  getGameBySlug,
  listControllerCatalog,
  listDirectTests,
  listEvidenceItems,
  listExternalReports,
  listGames,
  listVerificationRequests,
  unverified,
} from '@/lib/data/public'
import { includeDemoData, requestDb } from '@/lib/db'
import { EVIDENCE_CONTROL_SHORT } from '@/lib/domain'
import { formatDate } from '@/lib/format'
import {
  gameMetadata,
  indexRobots,
  indexabilityOverview,
  ZERO_INDEX_SIGNALS,
} from '@/lib/seo'
import { siteOrigin } from '@/lib/site'

type Props = { params: Promise<{ game: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const sql = await requestDb()
  const game = await getGameBySlug(sql, (await params).game)
  if (!game) return { title: 'Game not found', robots: indexRobots(false) }
  // One small aggregate after the lookup, run on its own: metadata and page render never
  // put more queries in flight here than before, and the indexability rule reads exactly
  // the evidence the page shows.
  const overview = await indexabilityOverview(sql, includeDemoData())
  return gameMetadata({
    origin: await siteOrigin(),
    game,
    signals: overview.games.get(game.id) ?? ZERO_INDEX_SIGNALS,
  })
}

export default async function GamePage({ params }: Props) {
  const sql = await requestDb()
  const game = await getGameBySlug(sql, (await params).game)
  if (!game) notFound()

  const includeDemo = includeDemoData()
  const scope = { includeDemo, gameId: game.id }
  // Two bounded waves, never more than three page-data queries at once: generateMetadata
  // may run alongside this, and a single six-way Promise.all can saturate the pool.
  const [games, families, items] = await Promise.all([
    listGames(sql),
    listControllerCatalog(sql),
    listEvidenceItems(sql, scope),
  ])
  const [tests, reports, requests] = await Promise.all([
    listDirectTests(sql, { ...scope, limit: 30 }),
    listExternalReports(sql, scope),
    listVerificationRequests(sql, scope),
  ])
  const combos = combine(items).sort(
    (a, b) => b.directTests - a.directTests || b.externalReports - a.externalReports,
  )
  const toVerify = unverified(combos, games, families)
  const submitHref = `/submit?game=${game.slug}`

  return (
    <main id="main">
      <div className="page-head">
        <div className="page-head-title">
          <GameThumb slug={game.slug} size="header" />
          <h1>{game.name}</h1>
        </div>
        {game.aliases.length > 0 && <p className="meta">Also searched as {game.aliases.join(', ')}</p>}
        <div className="page-actions">
          <Link href={submitHref}>Submit a test for {game.name}</Link>
        </div>
      </div>

      <section className="first" aria-labelledby="controllers-heading">
        <h2 id="controllers-heading">Controllers</h2>
        {combos.length === 0 ? (
          <EmptyTests href={submitHref} />
        ) : (
          <table className="stack">
            <thead>
              <tr>
                <th scope="col">Controller</th>
                <th scope="col" className="num">Direct tests</th>
                <th scope="col" className="num">External reports</th>
                <th scope="col">Reported issues</th>
                <th scope="col">Last report</th>
              </tr>
            </thead>
            <tbody>
              {combos.map((c) => {
                const family = families.find((f) => f.id === c.familyId)
                if (!family) return null
                const issues = c.summaries.filter(isIssue)
                return (
                  <tr key={c.familyId}>
                    <td className="primary" data-label="Controller">
                      <Link href={`/games/${game.slug}/${family.slug}`}>{family.name}</Link>
                    </td>
                    <td className="num" data-label="Direct tests">{c.directTests}</td>
                    <td className="num" data-label="External reports">{c.externalReports}</td>
                    <td data-label="Reported issues">
                      {issues.length === 0 ? (
                        <span className="muted">None reported</span>
                      ) : (
                        <ul className="results">
                          {issues.map((s) => (
                            <li key={s.control}>
                              {EVIDENCE_CONTROL_SHORT[s.control]}: <StateLabel state={s.state} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td data-label="Last report" className="nowrap">{formatDate(c.lastDate)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <p className="section-note">
          Not listed? Controllers appear here once a test or reviewed report exists.{' '}
          <Link href={submitHref}>Submit a test</Link>
        </p>
      </section>

      {(toVerify.length > 0 || requests.length > 0) && (
        <section aria-labelledby="verify-heading">
          <h2 id="verify-heading">Needs verification</h2>
          {toVerify.length > 0 && <IssueTable rows={toVerify} caption="Needs verification" />}
          {requests.length > 0 && (
            <ul className="records">
              {requests.map((r) => (
                <ExternalReportRecord key={r.recordKey} report={r} />
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="direct-heading">
        <h2 id="direct-heading">Direct tests</h2>
        <p className="section-note">Submitted by people who tested the game with the controller, then reviewed.</p>
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
        <p className="section-note">
          Found on other sites and reviewed by hand. Not tested by GameProbe. Conditions are only what the source states.
        </p>
        {reports.length > 0 ? (
          <ul className="records">
            {reports.map((r) => (
              <ExternalReportRecord key={r.recordKey} report={r} />
            ))}
          </ul>
        ) : (
          <div className="empty">
            <p>No reviewed external reports.</p>
          </div>
        )}
      </section>
    </main>
  )
}
