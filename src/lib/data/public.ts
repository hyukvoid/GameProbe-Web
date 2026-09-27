import type { Sql } from 'postgres'
import {
  isIssue,
  needsVerification,
  summarizeControls,
  type ControlSummary,
  type EvidenceItem,
} from '../aggregate'
import type { ClaimInput, ReviewedClaimFields, VerificationContextInput } from '../compatibility'
import type { Control, ConnectionType, EvidenceControl, Result, SourceType } from '../domain'
import { missingEvidenceFields } from '../validation'

// Every query in this module returns public data only:
//   * direct tests with status 'approved'
//   * external claims with visibility 'published' from sources with status 'published'
//   * development fixtures only when includeDemo is true

export type Scope = {
  includeDemo: boolean
  gameId?: string
  familyId?: string
  /**
   * Raw report lists only (listExternalReports, listVerificationRequests): with `familyId`,
   * also return claims that name no controller. Claims for other families stay excluded.
   */
  includeGameWide?: boolean
}

export type Game = { id: string; slug: string; name: string; aliases: string[] }

export type ControllerFamily = {
  id: string
  slug: string
  manufacturer: string
  name: string
  variants: { id: string; slug: string; name: string }[]
}

export async function listGames(sql: Sql): Promise<Game[]> {
  return sql<Game[]>`select id, slug, name, aliases from games order by name`
}

export async function getGameBySlug(sql: Sql, slug: string): Promise<Game | null> {
  const [g] = await sql<Game[]>`select id, slug, name, aliases from games where slug = ${slug}`
  return g ?? null
}

export async function listControllerCatalog(sql: Sql): Promise<ControllerFamily[]> {
  const families = await sql<Omit<ControllerFamily, 'variants'>[]>`
    select id, slug, manufacturer, name from controller_families order by manufacturer, name`
  const variants = await sql<{ id: string; slug: string; name: string; family_id: string }[]>`
    select id, slug, name, family_id from controller_variants order by name`
  return families.map((f) => ({
    ...f,
    variants: variants.filter((v) => v.family_id === f.id).map(({ id, slug, name }) => ({ id, slug, name })),
  }))
}

export async function getFamilyBySlug(sql: Sql, slug: string): Promise<ControllerFamily | null> {
  const all = await listControllerCatalog(sql)
  return all.find((f) => f.slug === slug) ?? null
}

type ItemRow = {
  kind: 'direct' | 'external'
  control: EvidenceControl
  result: Result
  origin: string
  connection: ConnectionType | null
  game_version: string | null
  variant: string | null
  android_version: string | null
  date: string | null
  game_id: string
  family_id: string
}

export type ScopedItem = EvidenceItem & { gameId: string; familyId: string }

/** Evidence items for aggregation. Direct tests without a catalog controller are excluded,
 *  and so are external claims that name no controller: a family-less source never creates
 *  a controller row. It is still listed under External reports. */
export async function listEvidenceItems(sql: Sql, scope: Scope): Promise<ScopedItem[]> {
  const demoS = scope.includeDemo ? sql`` : sql`and not s.is_demo`
  const demoC = scope.includeDemo ? sql`` : sql`and not c.is_demo`
  const gameS = scope.gameId ? sql`and s.game_id = ${scope.gameId}` : sql``
  const gameC = scope.gameId ? sql`and c.game_id = ${scope.gameId}` : sql``
  const famS = scope.familyId ? sql`and s.controller_family_id = ${scope.familyId}` : sql``
  const famC = scope.familyId ? sql`and c.controller_family_id = ${scope.familyId}` : sql``

  const rows = await sql<ItemRow[]>`
    select 'direct' as kind, o.control, o.result, s.id::text as origin, s.connection_type as connection,
           b.version as game_version, v.name as variant, s.android_version, s.tested_on::text as date,
           s.game_id::text as game_id, s.controller_family_id::text as family_id
    from test_observations o
    join test_sessions s on s.id = o.session_id
    left join game_builds b on b.id = s.game_build_id
    left join controller_variants v on v.id = s.controller_variant_id
    where s.status = 'approved' and s.controller_family_id is not null ${demoS} ${gameS} ${famS}
    union all
    select 'external' as kind, c.control, c.result, c.source_id::text as origin, c.connection_type as connection,
           c.game_version, v.name as variant, c.android_version,
           coalesce(c.reported_on, src.published_on)::text as date,
           c.game_id::text as game_id, c.controller_family_id::text as family_id
    from evidence_claims c
    join evidence_sources src on src.id = c.source_id
    left join controller_variants v on v.id = c.controller_variant_id
    where c.visibility = 'published' and src.review_status = 'published'
      and c.controller_family_id is not null ${demoC} ${gameC} ${famC}`

  return rows.map((r) => ({
    kind: r.kind,
    control: r.control,
    result: r.result,
    origin: r.origin,
    connection: r.connection,
    gameVersion: r.game_version,
    variant: r.variant,
    androidVersion: r.android_version,
    date: r.date,
    gameId: r.game_id,
    familyId: r.family_id,
  }))
}

export type Combination = {
  gameId: string
  familyId: string
  summaries: ControlSummary[]
  directTests: number
  externalReports: number
  lastDate: string | null
}

/** Group evidence by game and controller family, one summary per control. */
export function combine(items: ScopedItem[]): Combination[] {
  const groups = new Map<string, ScopedItem[]>()
  for (const item of items) {
    const key = `${item.gameId}|${item.familyId}`
    const list = groups.get(key)
    if (list) list.push(item)
    else groups.set(key, [item])
  }
  return [...groups.entries()].map(([key, list]) => {
    const [gameId, familyId] = key.split('|')
    const dates = list.map((i) => i.date).filter((d): d is string => d !== null)
    return {
      gameId,
      familyId,
      summaries: summarizeControls(list),
      directTests: new Set(list.filter((i) => i.kind === 'direct').map((i) => i.origin)).size,
      externalReports: new Set(list.filter((i) => i.kind === 'external').map((i) => i.origin)).size,
      lastDate: dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null,
    }
  })
}

export type DirectTest = {
  id: string
  gameSlug: string
  gameName: string
  gameVersion: string | null
  /** Catalog family id; null for a free-text controller not linked to the catalog. */
  familyId: string | null
  familySlug: string | null
  familyName: string | null
  variantName: string | null
  controllerAsEntered: string | null
  controllerMode: string | null
  connection: ConnectionType | null
  deviceName: string | null
  deviceModel: string | null
  androidVersion: string | null
  /** true = the game detected the controller, false = it did not, null = unknown. */
  controllerDetected: boolean | null
  testedOn: string
  notes: string | null
  isDemo: boolean
  observations: { control: Control; result: Result }[]
}

type DirectRow = {
  id: string
  game_slug: string
  game_name: string
  game_version: string | null
  family_id: string | null
  family_slug: string | null
  family_name: string | null
  variant_name: string | null
  controller_as_entered: string | null
  controller_mode: string | null
  connection_type: ConnectionType | null
  device_as_entered: string | null
  device_model_code: string | null
  android_version: string | null
  controller_detected: boolean | null
  tested_on: string
  notes: string | null
  is_demo: boolean
}

export async function hydrateDirectTests(sql: Sql, rows: DirectRow[]): Promise<DirectTest[]> {
  if (rows.length === 0) return []
  const obs = await sql<{ session_id: string; control: Control; result: Result }[]>`
    select session_id::text, control, result from test_observations
    where session_id in ${sql(rows.map((r) => r.id))}`
  return rows.map((r) => ({
    id: r.id,
    gameSlug: r.game_slug,
    gameName: r.game_name,
    gameVersion: r.game_version,
    familyId: r.family_id,
    familySlug: r.family_slug,
    familyName: r.family_name,
    variantName: r.variant_name,
    controllerAsEntered: r.controller_as_entered,
    controllerMode: r.controller_mode,
    connection: r.connection_type,
    deviceName: r.device_as_entered,
    deviceModel: r.device_model_code,
    androidVersion: r.android_version,
    controllerDetected: r.controller_detected,
    testedOn: r.tested_on,
    notes: r.notes,
    isDemo: r.is_demo,
    observations: obs.filter((o) => o.session_id === r.id).map(({ control, result }) => ({ control, result })),
  }))
}

export const DIRECT_TEST_COLUMNS = (sql: Sql) => sql`
  s.id::text, g.slug as game_slug, g.name as game_name, b.version as game_version,
  s.controller_family_id::text as family_id, f.slug as family_slug, f.name as family_name, v.name as variant_name, s.controller_as_entered,
  s.controller_mode, s.connection_type, s.device_as_entered, s.device_model_code, s.android_version,
  s.controller_detected, s.tested_on::text, s.notes, s.is_demo`

export const DIRECT_TEST_JOINS = (sql: Sql) => sql`
  from test_sessions s
  join games g on g.id = s.game_id
  left join game_builds b on b.id = s.game_build_id
  left join controller_families f on f.id = s.controller_family_id
  left join controller_variants v on v.id = s.controller_variant_id`

/** Approved direct tests, newest first. `limit: null` returns all of them (used for summaries). */
export async function listDirectTests(sql: Sql, scope: Scope & { limit?: number | null }): Promise<DirectTest[]> {
  const rows = await sql<DirectRow[]>`
    select ${DIRECT_TEST_COLUMNS(sql)}
    ${DIRECT_TEST_JOINS(sql)}
    where s.status = 'approved'
      ${scope.includeDemo ? sql`` : sql`and not s.is_demo`}
      ${scope.gameId ? sql`and s.game_id = ${scope.gameId}` : sql``}
      ${scope.familyId ? sql`and s.controller_family_id = ${scope.familyId}` : sql``}
    order by s.tested_on desc, s.submitted_at desc
    ${scope.limit === null ? sql`` : sql`limit ${scope.limit ?? 50}`}`
  return hydrateDirectTests(sql, rows)
}

export type ExternalReport = {
  sourceId: string
  url: string
  sourceType: SourceType
  title: string | null
  publishedOn: string | null
  gameSlug: string
  gameName: string
  /** Null when the source names no controller: shown as "Controller not specified". */
  familySlug: string | null
  familyName: string | null
  variantName: string | null
  controllerAsWritten: string | null
  gameVersion: string | null
  androidVersion: string | null
  deviceAsWritten: string | null
  deviceModel: string | null
  /** The transport every claim of this report agrees on, or null when they differ. */
  connection: ConnectionType | null
  controllerMode: string | null
  isDemo: boolean
  /**
   * Stable identity for React keys and for the grouping below: source + family + the
   * controller this record is about. Unique per record, so one source with two named
   * controllers in the same family yields two keys.
   */
  recordKey: string
  claims: { control: EvidenceControl; result: Result; statement: string; connection: ConnectionType | null }[]
  missing: string[]
}

type ClaimRow = {
  source_id: string
  url: string
  source_type: SourceType
  title: string | null
  published_on: string | null
  game_slug: string
  game_name: string
  family_slug: string | null
  family_name: string | null
  variant_id: string | null
  variant_name: string | null
  controller_as_written: string | null
  game_version: string | null
  android_version: string | null
  device_as_written: string | null
  device_model_code: string | null
  connection_type: ConnectionType | null
  controller_mode: string | null
  is_demo: boolean
  control: EvidenceControl
  result: Result
  statement: string
}

/**
 * One record per source per controller. Controller identity is the exact variant when one
 * is known, otherwise the wording the source used, otherwise nothing: a source that names
 * no controller stays a single record even when it states two transports, while two
 * differently named controllers that normalize to the same family (Xbox Wireless
 * Controller and Xbox Elite Wireless Controller Series 2, neither with a model number)
 * stay two records.
 */
async function listClaims(
  sql: Sql,
  scope: Scope,
  visibility: 'published' | 'needs_direct_test',
): Promise<ExternalReport[]> {
  const sourceStatus = visibility === 'published' ? 'published' : 'needs_direct_test'
  const rows = await sql<ClaimRow[]>`
    select src.id::text as source_id, src.url, src.source_type, src.title, src.published_on::text,
           g.slug as game_slug, g.name as game_name, f.slug as family_slug, f.name as family_name,
           c.controller_variant_id::text as variant_id, v.name as variant_name, c.controller_as_written,
           c.game_version, c.android_version, c.device_as_written, c.device_model_code, c.connection_type,
           c.controller_mode, c.is_demo, c.control, c.result, c.statement
    from evidence_claims c
    join evidence_sources src on src.id = c.source_id
    join games g on g.id = c.game_id
    left join controller_families f on f.id = c.controller_family_id
    left join controller_variants v on v.id = c.controller_variant_id
    where c.visibility = ${visibility} and src.review_status = ${sourceStatus}
      ${scope.includeDemo ? sql`` : sql`and not c.is_demo`}
      ${scope.gameId ? sql`and c.game_id = ${scope.gameId}` : sql``}
      ${
        !scope.familyId
          ? sql``
          : scope.includeGameWide
            ? sql`and (c.controller_family_id = ${scope.familyId} or c.controller_family_id is null)`
            : sql`and c.controller_family_id = ${scope.familyId}`
      }
    order by src.published_on desc nulls last, src.added_at desc, c.control`

  const byKey = new Map<
    string,
    {
      report: Omit<ExternalReport, 'connection' | 'missing'>
      connections: (ConnectionType | null)[]
      variantId: string | null
    }
  >()
  for (const r of rows) {
    const controllerIdentity = r.variant_id ?? r.controller_as_written ?? ''
    const key = `${r.source_id}|${r.family_slug ?? ''}|${controllerIdentity}`
    let entry = byKey.get(key)
    if (!entry) {
      entry = {
        report: {
          sourceId: r.source_id,
          url: r.url,
          sourceType: r.source_type,
          title: r.title,
          publishedOn: r.published_on,
          gameSlug: r.game_slug,
          gameName: r.game_name,
          familySlug: r.family_slug,
          familyName: r.family_name,
          variantName: r.variant_name,
          controllerAsWritten: r.controller_as_written,
          gameVersion: r.game_version,
          androidVersion: r.android_version,
          deviceAsWritten: r.device_as_written,
          deviceModel: r.device_model_code,
          controllerMode: r.controller_mode,
          isDemo: r.is_demo,
          recordKey: key,
          claims: [],
        },
        connections: [],
        variantId: r.variant_id,
      }
      byKey.set(key, entry)
    }
    entry.report.claims.push({
      control: r.control,
      result: r.result,
      statement: r.statement,
      connection: r.connection_type,
    })
    entry.connections.push(r.connection_type)
  }

  return [...byKey.values()].map(({ report, connections, variantId }) => {
    // One shared transport when the claims agree; null when they differ (a source may
    // state both Bluetooth and USB) or when none states one. Every claim keeps its own.
    const shared = connections.every((c) => c === connections[0]) ? connections[0] : null
    const connectionStated = connections.some((c) => c !== null)
    return {
      ...report,
      connection: shared,
      missing: missingEvidenceFields({
        gameVersion: report.gameVersion,
        androidVersion: report.androidVersion,
        deviceAsWritten: report.deviceAsWritten,
        deviceModelCode: report.deviceModel,
        controllerVariantId: variantId,
        connectionType: shared,
        connectionStated,
        publishedOn: report.publishedOn,
      }),
    }
  })
}

type CompatibilityClaimRow = {
  source_id: string
  source_type: SourceType
  url: string
  title: string | null
  family_id: string | null
  variant_name: string | null
  controller_as_written: string | null
  connection_type: ConnectionType | null
  controller_mode: string | null
  android_version: string | null
  game_version: string | null
  date: string | null
  control: EvidenceControl
  result: Result
  statement: string
  is_demo: boolean
}

type FamilyPageScope = { includeDemo: boolean; gameId: string; familyId: string }

/**
 * Reviewed claims for one game that a controller family's page may show: claims about that
 * family plus claims that name no controller. Claims about other families are never
 * returned. Visibility and source status are fixed per call, so the two public entry points
 * below can never mix published evidence with verification context.
 */
async function listFamilyPageClaims(
  sql: Sql,
  scope: FamilyPageScope,
  visibility: 'published' | 'needs_direct_test',
): Promise<ReviewedClaimFields[]> {
  const rows = await sql<CompatibilityClaimRow[]>`
    select c.source_id::text, src.source_type, src.url, src.title, c.controller_family_id::text as family_id,
           v.name as variant_name, c.controller_as_written, c.connection_type, c.controller_mode,
           c.android_version, c.game_version, coalesce(c.reported_on, src.published_on)::text as date,
           c.control, c.result, c.statement, c.is_demo
    from evidence_claims c
    join evidence_sources src on src.id = c.source_id
    left join controller_variants v on v.id = c.controller_variant_id
    where c.visibility = ${visibility} and src.review_status = ${visibility}
      and c.game_id = ${scope.gameId}
      and (c.controller_family_id = ${scope.familyId} or c.controller_family_id is null)
      ${scope.includeDemo ? sql`` : sql`and not c.is_demo`}
    order by coalesce(c.reported_on, src.published_on) desc nulls last, src.added_at desc, c.control`
  return rows.map((r) => ({
    sourceId: r.source_id,
    sourceType: r.source_type,
    url: r.url,
    title: r.title,
    familyId: r.family_id,
    variantName: r.variant_name,
    controllerAsWritten: r.controller_as_written,
    connection: r.connection_type,
    controllerMode: r.controller_mode,
    androidVersion: r.android_version,
    gameVersion: r.game_version,
    date: r.date,
    control: r.control,
    result: r.result,
    statement: r.statement,
    isDemo: r.is_demo,
  }))
}

/** Published claims: the only external evidence that can decide a connection result. */
export async function listCompatibilityClaims(sql: Sql, scope: FamilyPageScope): Promise<ClaimInput[]> {
  const rows = await listFamilyPageClaims(sql, scope, 'published')
  return rows.map((r) => ({ ...r, visibility: 'published' as const }))
}

/** Claims flagged for a direct test: shown beside a connection as context, never counted. */
export async function listVerificationContext(sql: Sql, scope: FamilyPageScope): Promise<VerificationContextInput[]> {
  const rows = await listFamilyPageClaims(sql, scope, 'needs_direct_test')
  return rows.map((r) => ({ ...r, visibility: 'needs_direct_test' as const }))
}

export function listExternalReports(sql: Sql, scope: Scope) {
  return listClaims(sql, scope, 'published')
}

/** Reviewed sources a human flagged as needing a direct test before being trusted. */
export function listVerificationRequests(sql: Sql, scope: Scope) {
  return listClaims(sql, scope, 'needs_direct_test')
}

export type GameOverview = Game & {
  directTests: number
  externalReports: number
  controllersWithIssues: number
  lastDate: string | null
}

export function gameOverviews(games: Game[], combos: Combination[]): GameOverview[] {
  return games.map((g) => {
    const mine = combos.filter((c) => c.gameId === g.id)
    const dates = mine.map((c) => c.lastDate).filter((d): d is string => d !== null)
    return {
      ...g,
      directTests: mine.reduce((n, c) => n + c.directTests, 0),
      externalReports: mine.reduce((n, c) => n + c.externalReports, 0),
      controllersWithIssues: mine.filter((c) => c.summaries.some(isIssue)).length,
      lastDate: dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null,
    }
  })
}

export type IssueRow = {
  gameSlug: string
  gameName: string
  familySlug: string
  familyName: string
  summaries: ControlSummary[]
  lastDate: string | null
}

function toIssueRows(
  combos: Combination[],
  games: Game[],
  families: ControllerFamily[],
  pick: (s: ControlSummary) => boolean,
): IssueRow[] {
  const rows: IssueRow[] = []
  for (const c of combos) {
    const summaries = c.summaries.filter(pick)
    if (summaries.length === 0) continue
    const game = games.find((g) => g.id === c.gameId)
    const family = families.find((f) => f.id === c.familyId)
    if (!game || !family) continue
    rows.push({
      gameSlug: game.slug,
      gameName: game.name,
      familySlug: family.slug,
      familyName: family.name,
      summaries,
      lastDate: c.lastDate,
    })
  }
  return rows.sort((a, b) => (b.lastDate ?? '').localeCompare(a.lastDate ?? ''))
}

export function knownIssues(combos: Combination[], games: Game[], families: ControllerFamily[]) {
  return toIssueRows(combos, games, families, isIssue)
}

export function unverified(combos: Combination[], games: Game[], families: ControllerFamily[]) {
  return toIssueRows(combos, games, families, needsVerification)
}

/** Game versions that appear in public data, offered as suggestions in the test form. */
export async function listKnownVersions(sql: Sql, includeDemo: boolean): Promise<Record<string, string[]>> {
  const rows = await sql<{ slug: string; version: string }[]>`
    select distinct g.slug, b.version
    from test_sessions s
    join game_builds b on b.id = s.game_build_id
    join games g on g.id = s.game_id
    where s.status = 'approved' ${includeDemo ? sql`` : sql`and not s.is_demo`}
    union
    select distinct g.slug, c.game_version as version
    from evidence_claims c
    join games g on g.id = c.game_id
    where c.visibility = 'published' and c.game_version is not null ${includeDemo ? sql`` : sql`and not c.is_demo`}`
  const out: Record<string, string[]> = {}
  for (const r of rows) (out[r.slug] ??= []).push(r.version)
  for (const k of Object.keys(out)) out[k].sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
  return out
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export type SearchResults = {
  games: Game[]
  families: ControllerFamily[]
  combinations: { game: Game; family: ControllerFamily }[]
  devices: DirectTest[]
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`)
}

/**
 * Plain Postgres matching over a small dataset. Each word is matched against game names
 * and aliases, controller names and manufacturers, and devices in approved tests.
 */
export async function search(sql: Sql, query: string, includeDemo: boolean): Promise<SearchResults> {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}.:-]/gu, ''))
    .filter((w) => w.length >= 2)
    .slice(0, 6)
  if (words.length === 0) return { games: [], families: [], combinations: [], devices: [] }
  const patterns = words.map((w) => `%${escapeLike(w)}%`)

  const [games, catalog] = await Promise.all([listGames(sql), listControllerCatalog(sql)])
  const gameText = (g: Game) => [g.name, g.slug, ...g.aliases].join(' ').toLowerCase().replace(/[:]/g, '')
  const familyText = (f: ControllerFamily) =>
    [f.manufacturer, f.name, f.slug, ...f.variants.map((v) => v.name)].join(' ').toLowerCase()
  const matches = (text: string, w: string) => text.includes(w.replace(/[:]/g, ''))

  const matchedGames = games.filter((g) => words.some((w) => matches(gameText(g), w)))
  const matchedFamilies = catalog.filter((f) => words.some((w) => matches(familyText(f), w)))

  const deviceRows = await sql<DirectRow[]>`
    select ${DIRECT_TEST_COLUMNS(sql)}
    ${DIRECT_TEST_JOINS(sql)}
    where s.status = 'approved' ${includeDemo ? sql`` : sql`and not s.is_demo`}
      and (s.device_as_entered ilike any(${patterns}) or s.device_model_code ilike any(${patterns}))
    order by s.tested_on desc
    limit 20`
  const devices = await hydrateDirectTests(sql, deviceRows)

  const combinations =
    matchedGames.length > 0 && matchedFamilies.length > 0
      ? matchedGames.flatMap((game) => matchedFamilies.map((family) => ({ game, family })))
      : []

  return { games: matchedGames, families: matchedFamilies, combinations, devices }
}
