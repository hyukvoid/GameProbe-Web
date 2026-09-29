import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ConnectionCompatibility, PhysicalControls } from '@/components/compatibility'
import { DirectTestRecord, ExternalReportRecord } from '@/components/evidence'
import { GameThumb } from '@/components/game-thumb'
import { deriveCompatibility } from '@/lib/compatibility'
import {
  getFamilyBySlug,
  getGameBySlug,
  listCompatibilityClaims,
  listDirectTests,
  listExternalReports,
  listVerificationContext,
  listVerificationRequests,
} from '@/lib/data/public'
import { includeDemoData, requestDb } from '@/lib/db'
import { formatDate, plural } from '@/lib/format'
import {
  combinationMetadata,
  indexRobots,
  indexabilityOverview,
  ZERO_INDEX_SIGNALS,
} from '@/lib/seo'
import { siteOrigin } from '@/lib/site'

type Props = { params: Promise<{ game: string; controller: string }> }

/** Raw direct-test records listed on the page. The summary always uses all of them. */
const DIRECT_TESTS_SHOWN = 100

async function load(params: Props['params']) {
  const sql = await requestDb()
  const p = await params
  const [game, family] = await Promise.all([getGameBySlug(sql, p.game), getFamilyBySlug(sql, p.controller)])
  return { sql, game, family }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sql, game, family } = await load(params)
  if (!game || !family) return { title: 'Not found', robots: indexRobots(false) }
  // Same shape as the game page: the game/family lookup wave first, then one aggregate on
  // its own, so metadata never raises the number of queries in flight during a render.
  // The page below answers 200 either way; noindex only omits it from the index.
  const overview = await indexabilityOverview(sql, includeDemoData())
  return combinationMetadata({
    origin: await siteOrigin(),
    game,
    family,
    signals: overview.combinations.get(`${game.id}|${family.id}`) ?? ZERO_INDEX_SIGNALS,
  })
}

export default async function CombinationPage({ params }: Props) {
  const { sql, game, family } = await load(params)
  if (!game || !family) notFound()

  const includeDemo = includeDemoData()
  const scope = { includeDemo, gameId: game.id, familyId: family.id }
  // Two bounded waves, at most three page-data queries in flight, as on the other pages.
  // Raw lists include reports that name no controller, so every context record shown in the
  // summary can also be inspected below. Other families never appear.
  const rawScope = { ...scope, includeGameWide: true }
  const [tests, claims, reports] = await Promise.all([
    listDirectTests(sql, { ...scope, limit: null }),
    listCompatibilityClaims(sql, scope),
    listExternalReports(sql, rawScope),
  ])
  const [requests, verification] = await Promise.all([
    listVerificationRequests(sql, rawScope),
    listVerificationContext(sql, scope),
  ])

  const answer = deriveCompatibility({ familyId: family.id, directTests: tests, claims, verification })

  // Sources about this family only; game-wide reports are context, not family evidence.
  const sources = new Set(reports.filter((r) => r.familySlug === family.slug).map((r) => r.sourceId)).size
  const versions = [...new Set(tests.map((t) => t.gameVersion).filter((v): v is string => v !== null))].sort((a, b) =>
    b.localeCompare(a, 'en', { numeric: true }),
  )
  const dates = [
    ...tests.map((t) => t.testedOn),
    ...claims.filter((c) => c.familyId === family.id).map((c) => c.date),
  ].filter((d): d is string => d !== null)
  const last = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null
  const submitHref = `/submit?game=${game.slug}&controller=${family.slug}`
  const hasRecords = tests.length > 0 || reports.length > 0 || requests.length > 0

  return (
    <main id="main">
      <div className="page-head">
        <p className="crumbs">
          <Link href={`/games/${game.slug}`}>{game.name}</Link> / {family.name}
        </p>
        <div className="page-head-title">
          <GameThumb slug={game.slug} />
          <h1>
            {family.name} in {game.name}
          </h1>
        </div>
        <p className="meta">
          {plural(tests.length, 'direct test')}, {plural(sources, 'external source')}
          {last && <>. Last report {formatDate(last)}</>}
          {versions.length > 0 && <>. Game versions tested: {versions.join(', ')}</>}
        </p>
        <p className="meta small">
          Scope: {family.name} controller family. A result names an exact model only where the evidence does.
        </p>
      </div>

      <section className="first" aria-labelledby="connections-heading">
        <h2 id="connections-heading">Connection compatibility</h2>
        <p className="section-note">
          Each connection counts only evidence that states that connection and names {family.name}.
        </p>
        <ConnectionCompatibility answer={answer} familyName={family.name} />
      </section>

      <section aria-labelledby="controls-heading">
        <h2 id="controls-heading">Per-control compatibility</h2>
        <PhysicalControls rows={answer.controls} />
      </section>

      {requests.length > 0 && (
        <section aria-labelledby="verify-heading">
          <h2 id="verify-heading">Needs verification</h2>
          <ul className="records">
            {requests.map((r) => (
              <ExternalReportRecord key={r.recordKey} report={r} />
            ))}
          </ul>
        </section>
      )}

      {hasRecords && (
        <section aria-labelledby="direct-heading">
          <h2 id="direct-heading">Direct tests</h2>
          {tests.length > 0 ? (
            <>
              <ul className="records">
                {tests.slice(0, DIRECT_TESTS_SHOWN).map((t) => (
                  <DirectTestRecord key={t.id} test={t} />
                ))}
              </ul>
              {tests.length > DIRECT_TESTS_SHOWN && (
                <p className="section-note">
                  Showing the latest {DIRECT_TESTS_SHOWN} of {tests.length}. The summary above uses all of them.
                </p>
              )}
            </>
          ) : (
            <div className="empty">
              <p>No direct tests yet.</p>
            </div>
          )}
        </section>
      )}

      {hasRecords && (
        <section aria-labelledby="external-heading">
          <h2 id="external-heading">External reports</h2>
          <p className="section-note">
            Found on other sites and reviewed by hand. Not tested by GameProbe. Reports marked “Controller not
            specified” are about the game in general, not about {family.name}.
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
      )}

      <section aria-labelledby="submit-heading">
        <h2 id="submit-heading">Submit a test</h2>
        <p className="section-note">
          {!hasRecords && 'No direct tests yet. '}
          Record the connection you used and what each control did. Fields you don’t know can stay empty.
        </p>
        <p className="page-actions" style={{ marginTop: 10 }}>
          <Link href={submitHref} className="button secondary">
            Submit a test for {family.name}
          </Link>
        </p>
      </section>
    </main>
  )
}
