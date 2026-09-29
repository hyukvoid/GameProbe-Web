import type { Metadata, MetadataRoute } from 'next'
import type { Sql } from 'postgres'
import { CONNECTION_LABELS, CONNECTION_TYPES, type ConnectionType } from './domain'
import { listGames } from './data/public'

// Search discovery: one deterministic indexability rule, one absolute-origin helper and
// the metadata/sitemap/robots builders that use them. Every builder is a pure function of
// data it is given, so tests can exercise the rules without a request or a database.

/** What the indexability rule needs to know about one game or one Game x Controller pair. */
export type IndexSignals = {
  /** Reviewed claims with visibility 'published' from sources with review status 'published'. */
  publishedClaims: number
  /** Reviewed claims still waiting for a direct test; never enough to be indexable. */
  verificationClaims: number
  /** Approved direct tests. */
  approvedTests: number
  /**
   * Transports stated by the qualifying records above (published claims and approved
   * direct tests only). Family-less claims can only appear in game-level signals.
   */
  connections: ConnectionType[]
}

export type GameIndex = IndexSignals & { gameId: string; gameSlug: string }

export type CombinationIndex = IndexSignals & {
  gameId: string
  gameSlug: string
  familyId: string
  familySlug: string
}

/**
 * Every catalog game (zero signals when the game has no records at all) and every
 * Game x Controller pair that has any reviewed record. Keyed by game id and by
 * `gameId|familyId`.
 */
export type IndexabilityOverview = {
  games: Map<string, GameIndex>
  combinations: Map<string, CombinationIndex>
}

export const ZERO_INDEX_SIGNALS: IndexSignals = {
  publishedClaims: 0,
  verificationClaims: 0,
  approvedTests: 0,
  connections: [],
}

/**
 * Game pages stay indexable when the game has meaningful reviewed data: at least one
 * published claim (controller-specific or not) or one approved direct test. Verification-only
 * and empty catalog rows stay reachable at HTTP 200 but are not promoted.
 */
export function isIndexableGame(signals: IndexSignals): boolean {
  return signals.publishedClaims > 0 || signals.approvedTests > 0
}

/**
 * A Game x Controller page is indexable only with BOTH:
 *   1. controller-specific evidence: a published claim or an approved direct test for this
 *      exact pair, and
 *   2. at least one such record that states a transport (Bluetooth / USB / dongle).
 * Game-wide evidence alone is not enough, needs_direct_test alone is not enough, and
 * connection_type = NULL alone is not enough. Noindex is metadata only: the page itself
 * still answers 200 and stays navigable.
 */
export function isIndexableCombination(signals: IndexSignals): boolean {
  return isIndexableGame(signals) && signals.connections.length > 0
}

/**
 * Two sequential queries, never two in flight at once (the local development wire server
 * runs one Postgres session): the catalog first, then one aggregate over reviewed claims
 * and approved tests grouped by both (game, family) and game, which yields combination
 * signals and game signals in a single round trip. No query per page, no N+1.
 *
 * The aggregate mirrors the public readers: a claim counts when its visibility matches its
 * source's review status, demo rows are hidden unless includeDemo, and a connection counts
 * only when the record that states it is itself qualifying (published claim or approved
 * test).
 */
export async function indexabilityOverview(
  sql: Sql,
  includeDemo: boolean,
): Promise<IndexabilityOverview> {
  const games = await listGames(sql)
  const rows = await sql<
    {
      game_id: string
      family_id: string | null
      game_level: number
      family_slug: string | null
      published_claims: number
      verification_claims: number
      approved_tests: number
      connections: string[] | null
    }[]
  >`
    select x.game_id::text as game_id, x.family_id::text as family_id, x.game_level,
           f.slug as family_slug,
           x.published_claims, x.verification_claims, x.approved_tests, x.connections
    from (
      select r.game_id, r.family_id, grouping(family_id) as game_level,
             sum(r.published_n)::int as published_claims,
             sum(r.verification_n)::int as verification_claims,
             sum(r.test_n)::int as approved_tests,
             array_agg(distinct r.conn) filter (where r.conn is not null) as connections
      from (
        select c.game_id, c.controller_family_id as family_id,
               case when c.visibility = 'published' then 1 else 0 end as published_n,
               case when c.visibility = 'needs_direct_test' then 1 else 0 end as verification_n,
               0 as test_n,
               case when c.visibility = 'published' then c.connection_type end as conn
        from evidence_claims c
        join evidence_sources s on s.id = c.source_id
        where c.visibility = s.review_status
          and c.visibility in ('published', 'needs_direct_test')
          ${includeDemo ? sql`` : sql`and not c.is_demo and not s.is_demo`}
        union all
        select t.game_id, t.controller_family_id, 0, 0, 1, t.connection_type
        from test_sessions t
        where t.status = 'approved'
          ${includeDemo ? sql`` : sql`and not t.is_demo`}
      ) r
      group by grouping sets ((game_id, family_id), (game_id))
    ) x
    left join controller_families f on f.id = x.family_id
    order by x.game_id, x.game_level desc, x.family_id`

  const overview: IndexabilityOverview = {
    // Seeded from the catalog, so a game with no records is present with zero signals.
    games: new Map(
      games.map((g) => [g.id, { gameId: g.id, gameSlug: g.slug, ...ZERO_INDEX_SIGNALS }]),
    ),
    combinations: new Map(),
  }
  const slugById = new Map(games.map((g) => [g.id, g.slug]))

  for (const r of rows) {
    const signals: IndexSignals = {
      publishedClaims: r.published_claims,
      verificationClaims: r.verification_claims,
      approvedTests: r.approved_tests,
      connections: (r.connections ?? []) as ConnectionType[],
    }
    const gameSlug = slugById.get(r.game_id)
    if (!gameSlug) continue
    if (r.game_level === 1) {
      overview.games.set(r.game_id, { gameId: r.game_id, gameSlug, ...signals })
      continue
    }
    // Grouping sets also emit one (game, NULL) row for family-less claims; those are
    // game-wide evidence and must never become a combination.
    if (!r.family_id || !r.family_slug) continue
    overview.combinations.set(`${r.game_id}|${r.family_id}`, {
      gameId: r.game_id,
      gameSlug,
      familyId: r.family_id,
      familySlug: r.family_slug,
      ...signals,
    })
  }
  return overview
}

/* ---- Titles and descriptions ------------------------------------------------------- */

/** "Example Game Android controller support" -> layout template appends " · GameProbe". */
export function gameTitle(name: string): string {
  return `${name} Android controller support`
}

/** "Example Game Example Pad Android controller support" -> " · GameProbe" via the template. */
export function combinationTitle(game: string, family: string): string {
  return `${game} ${family} Android controller support`
}

/** "Bluetooth, USB cable and 2.4 GHz USB receiver", in catalog order, for descriptions. */
function listConnections(connections: readonly ConnectionType[]): string {
  const labels = [...connections]
    .sort((a, b) => CONNECTION_TYPES.indexOf(a) - CONNECTION_TYPES.indexOf(b))
    .map((c) => CONNECTION_LABELS[c])
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

/**
 * A description only names transports the game's own reviewed evidence states; without
 * that evidence it describes what the page shows instead. Never a compatibility claim.
 */
export function gameDescription(name: string, connections: readonly ConnectionType[]): string {
  const evidence = connections.length
    ? `reviewed evidence covering ${listConnections(connections)}, with per-controller results`
    : 'per-controller evidence status, reported issues'
  return `Android controller support for ${name}: ${evidence} and direct-test status.`
}

/** Same rule for one combination: transports appear only when this pair states them. */
export function combinationDescription(
  game: string,
  family: string,
  signals: IndexSignals,
): string {
  const tests = signals.approvedTests > 0 ? 'direct-test results' : 'direct-test status'
  if (signals.connections.length) {
    return `Reviewed Android controller evidence for ${game} with ${family}, covering ${listConnections(signals.connections)}, with per-controller results and ${tests}.`
  }
  return `Android controller support for ${game} with ${family}: evidence status for this controller, reported issues and ${tests}.`
}

/** Index policy lives in metadata only, never in the rendered page. */
export function indexRobots(indexable: boolean): Metadata['robots'] {
  return { index: indexable, follow: true }
}

/** Search is navigation for people: noindex, but its links stay followable. */
export const searchMetadata: Metadata = {
  title: 'Search',
  robots: { index: false, follow: true },
}

/**
 * Canonical metadata for a game page. The canonical is the plain path: no query parameter
 * (connection or filter views) is ever promoted to a separate canonical URL.
 */
export function gameMetadata(opts: {
  origin: string
  game: { name: string; slug: string }
  signals: IndexSignals
}): Metadata {
  return {
    title: gameTitle(opts.game.name),
    description: gameDescription(opts.game.name, opts.signals.connections),
    alternates: { canonical: `${opts.origin}/games/${opts.game.slug}` },
    robots: indexRobots(isIndexableGame(opts.signals)),
  }
}

/** Canonical metadata for one Game x Controller page: /games/{game}/{family}, always. */
export function combinationMetadata(opts: {
  origin: string
  game: { name: string; slug: string }
  family: { name: string; slug: string }
  signals: IndexSignals
}): Metadata {
  return {
    title: combinationTitle(opts.game.name, opts.family.name),
    description: combinationDescription(opts.game.name, opts.family.name, opts.signals),
    alternates: { canonical: `${opts.origin}/games/${opts.game.slug}/${opts.family.slug}` },
    robots: indexRobots(isIndexableCombination(opts.signals)),
  }
}

/* ---- robots.txt and sitemap.xml ---------------------------------------------------- */

/**
 * Public reference pages are crawlable; the admin area is private-style and disallowed.
 * /search is deliberately NOT disallowed: its pages carry noindex,follow, so crawlers can
 * read them and follow their links without indexing them. No asset path is blocked.
 */
export function buildRobots(origin: string): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin'] }],
    sitemap: `${origin}/sitemap.xml`,
  }
}

function bySlug(a: { gameSlug: string; slug: string }, b: { gameSlug: string; slug: string }): number {
  if (a.gameSlug !== b.gameSlug) return a.gameSlug < b.gameSlug ? -1 : 1
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0
}

/**
 * Only pages with real reference value: the homepage, the methodology page, indexable game
 * pages and evidence-backed indexable combinations. No search URLs, no admin pages and no
 * Cartesian product: an empty or weak combination is left out by the same rule the page
 * metadata uses.
 */
export function buildSitemap(
  overview: IndexabilityOverview,
  origin: string,
): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [{ url: `${origin}/` }, { url: `${origin}/about` }]

  const games = [...overview.games.values()]
    .filter(isIndexableGame)
    .map((g) => ({ gameSlug: g.gameSlug, slug: g.gameSlug }))
    .sort(bySlug)
  for (const g of games) entries.push({ url: `${origin}/games/${g.slug}` })

  const combinations = [...overview.combinations.values()]
    .filter(isIndexableCombination)
    .map((c) => ({ gameSlug: c.gameSlug, slug: `${c.gameSlug}/${c.familySlug}` }))
    .sort(bySlug)
  for (const c of combinations) entries.push({ url: `${origin}/games/${c.slug}` })

  return entries
}
