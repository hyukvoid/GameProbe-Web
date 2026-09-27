import type { Sql } from 'postgres'
import type { Control, ConnectionType, Result, ReviewStatus, SourceType, TestStatus } from '../domain'
import { guessSourceType, urlKey } from '../url'
import type { ControllerChoice, EvidenceAdd, EvidenceReview, FieldErrors } from '../validation'
import { DIRECT_TEST_COLUMNS, DIRECT_TEST_JOINS, hydrateDirectTests, type DirectTest } from './public'

// Admin-only data access. Callers must verify the admin session first.

// ---------------------------------------------------------------------------
// Direct test moderation
// ---------------------------------------------------------------------------

export type ReviewableTest = DirectTest & {
  status: TestStatus
  submittedAt: string
  reviewedAt: string | null
  moderationNote: string | null
}

export async function listTestsByStatus(sql: Sql, status: TestStatus, limit = 100): Promise<ReviewableTest[]> {
  const rows = await sql<
    (Parameters<typeof hydrateDirectTests>[1][number] & {
      status: TestStatus
      submitted_at: Date
      reviewed_at: Date | null
      moderation_note: string | null
    })[]
  >`
    select ${DIRECT_TEST_COLUMNS(sql)}, s.status, s.submitted_at, s.reviewed_at, s.moderation_note
    ${DIRECT_TEST_JOINS(sql)}
    where s.status = ${status}
    order by s.submitted_at ${status === 'pending' ? sql`asc` : sql`desc`}
    limit ${limit}`
  const hydrated = await hydrateDirectTests(sql, rows)
  return hydrated.map((t, i) => ({
    ...t,
    status: rows[i].status,
    submittedAt: rows[i].submitted_at.toISOString(),
    reviewedAt: rows[i].reviewed_at?.toISOString() ?? null,
    moderationNote: rows[i].moderation_note,
  }))
}

export type ModerationInput = {
  id: string
  decision: 'approve' | 'reject'
  note: string | null
  /** Reviewer may link a free-text controller to the catalog. Never inferred automatically. */
  controller: ControllerChoice
}

export async function moderateTest(sql: Sql, input: ModerationInput): Promise<{ ok: boolean; error?: string }> {
  const [session] = await sql<{ id: string; controller_family_id: string | null }[]>`
    select id, controller_family_id from test_sessions where id = ${input.id}`
  if (!session) return { ok: false, error: 'Test not found.' }

  let familyId: string | null | undefined
  let variantId: string | null | undefined
  if (input.controller.kind === 'family') {
    const [f] = await sql`select id from controller_families where id = ${input.controller.familyId}`
    if (!f) return { ok: false, error: 'Unknown controller.' }
    familyId = input.controller.familyId
    variantId = null
  } else if (input.controller.kind === 'variant') {
    const [v] = await sql<{ family_id: string }[]>`
      select family_id from controller_variants where id = ${input.controller.variantId}`
    if (!v) return { ok: false, error: 'Unknown controller.' }
    familyId = v.family_id
    variantId = input.controller.variantId
  }

  const status: TestStatus = input.decision === 'approve' ? 'approved' : 'rejected'
  await sql`
    update test_sessions set
      status = ${status},
      moderation_note = ${input.note},
      reviewed_at = now(),
      controller_family_id = ${familyId === undefined ? sql`controller_family_id` : familyId},
      controller_variant_id = ${variantId === undefined ? sql`controller_variant_id` : variantId}
    where id = ${input.id}`
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Evidence Inbox
// ---------------------------------------------------------------------------

export type AddEvidenceResult =
  | { ok: true; id: string }
  | { ok: false; errors: FieldErrors; existingId?: string }

export async function addEvidenceSource(sql: Sql, input: EvidenceAdd): Promise<AddEvidenceResult> {
  const key = urlKey(input.url)
  const [existing] = await sql<{ id: string }[]>`select id::text from evidence_sources where url_key = ${key}`
  if (existing) {
    return { ok: false, errors: { url: 'This URL is already in the inbox.' }, existingId: existing.id }
  }
  const [row] = await sql<{ id: string }[]>`
    insert into evidence_sources (url, url_key, source_type, title, excerpt, published_on)
    values (${input.url}, ${key}, ${input.sourceType ?? guessSourceType(input.url)}, ${input.title},
            ${input.excerpt}, ${input.publishedOn})
    returning id::text`
  return { ok: true, id: row.id }
}

export type InboxRow = {
  id: string
  url: string
  sourceType: SourceType
  title: string | null
  reviewStatus: ReviewStatus
  isReport: boolean | null
  gameName: string | null
  controllerAsWritten: string | null
  familyName: string | null
  variantName: string | null
  addedAt: string
  isDemo: boolean
}

export async function listEvidence(sql: Sql, status: ReviewStatus | 'all'): Promise<InboxRow[]> {
  const rows = await sql<
    {
      id: string
      url: string
      source_type: SourceType
      title: string | null
      review_status: ReviewStatus
      is_report: boolean | null
      game_name: string | null
      controller_as_written: string | null
      family_name: string | null
      variant_name: string | null
      added_at: Date
      is_demo: boolean
    }[]
  >`
    select s.id::text, s.url, s.source_type, s.title, s.review_status, s.is_report, g.name as game_name,
           s.controller_as_written, f.name as family_name, v.name as variant_name, s.added_at, s.is_demo
    from evidence_sources s
    left join games g on g.id = s.game_id
    left join controller_families f on f.id = s.controller_family_id
    left join controller_variants v on v.id = s.controller_variant_id
    ${status === 'all' ? sql`` : sql`where s.review_status = ${status}`}
    order by s.added_at desc
    limit 500`
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    sourceType: r.source_type,
    title: r.title,
    reviewStatus: r.review_status,
    isReport: r.is_report,
    gameName: r.game_name,
    controllerAsWritten: r.controller_as_written,
    familyName: r.family_name,
    variantName: r.variant_name,
    addedAt: r.added_at.toISOString(),
    isDemo: r.is_demo,
  }))
}

export type EvidenceDetail = {
  id: string
  url: string
  sourceType: SourceType
  title: string | null
  excerpt: string | null
  publishedOn: string | null
  addedAt: string
  reviewStatus: ReviewStatus
  isReport: boolean | null
  gameId: string | null
  controllerFamilyId: string | null
  controllerVariantId: string | null
  controllerAsWritten: string | null
  deviceAsWritten: string | null
  deviceModelCode: string | null
  androidVersion: string | null
  gameVersion: string | null
  connectionType: ConnectionType | null
  controllerMode: string | null
  claimSummary: string | null
  reviewNotes: string | null
  duplicateOfId: string | null
  duplicateOfUrl: string | null
  reviewedAt: string | null
  isDemo: boolean
  claims: { control: Control; result: Result; visibility: 'published' | 'needs_direct_test' }[]
}

export async function getEvidenceSource(sql: Sql, id: string): Promise<EvidenceDetail | null> {
  const [r] = await sql<Record<string, unknown>[]>`
    select s.id::text, s.url, s.source_type, s.title, s.excerpt, s.published_on::text, s.added_at, s.review_status,
           s.is_report, s.game_id::text, s.controller_family_id::text, s.controller_variant_id::text,
           s.controller_as_written, s.device_as_written, s.device_model_code, s.android_version, s.game_version,
           s.connection_type, s.controller_mode, s.claim_summary, s.review_notes, s.duplicate_of_id::text,
           d.url as duplicate_of_url, s.reviewed_at, s.is_demo
    from evidence_sources s
    left join evidence_sources d on d.id = s.duplicate_of_id
    where s.id = ${id}`
  if (!r) return null
  const claims = await sql<{ control: Control; result: Result; visibility: 'published' | 'needs_direct_test' }[]>`
    select control, result, visibility from evidence_claims where source_id = ${id} order by control`
  return {
    id: r.id as string,
    url: r.url as string,
    sourceType: r.source_type as SourceType,
    title: r.title as string | null,
    excerpt: r.excerpt as string | null,
    publishedOn: r.published_on as string | null,
    addedAt: (r.added_at as Date).toISOString(),
    reviewStatus: r.review_status as ReviewStatus,
    isReport: r.is_report as boolean | null,
    gameId: r.game_id as string | null,
    controllerFamilyId: r.controller_family_id as string | null,
    controllerVariantId: r.controller_variant_id as string | null,
    controllerAsWritten: r.controller_as_written as string | null,
    deviceAsWritten: r.device_as_written as string | null,
    deviceModelCode: r.device_model_code as string | null,
    androidVersion: r.android_version as string | null,
    gameVersion: r.game_version as string | null,
    connectionType: r.connection_type as ConnectionType | null,
    controllerMode: r.controller_mode as string | null,
    claimSummary: r.claim_summary as string | null,
    reviewNotes: r.review_notes as string | null,
    duplicateOfId: r.duplicate_of_id as string | null,
    duplicateOfUrl: r.duplicate_of_url as string | null,
    reviewedAt: r.reviewed_at ? (r.reviewed_at as Date).toISOString() : null,
    isDemo: r.is_demo as boolean,
    claims,
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Find the original a duplicate points to, by id or URL, following earlier merges. */
async function resolveDuplicateTarget(sql: Sql, ref: string, selfId: string): Promise<string | FieldErrors> {
  let target: { id: string; duplicate_of_id: string | null } | undefined
  if (UUID.test(ref)) {
    ;[target] = await sql<{ id: string; duplicate_of_id: string | null }[]>`
      select id::text, duplicate_of_id::text from evidence_sources where id = ${ref}`
  } else {
    let key: string
    try {
      key = urlKey(ref)
    } catch {
      return { duplicateOf: 'Enter a URL or an inbox ID.' }
    }
    ;[target] = await sql<{ id: string; duplicate_of_id: string | null }[]>`
      select id::text, duplicate_of_id::text from evidence_sources where url_key = ${key}`
  }
  if (!target) return { duplicateOf: 'No inbox item matches that URL or ID.' }
  const root = target.duplicate_of_id ?? target.id
  if (root === selfId) return { duplicateOf: 'A source can’t be a duplicate of itself.' }
  return root
}

const STATUS_FOR_ACTION: Record<EvidenceReview['action'], ReviewStatus> = {
  lead: 'lead',
  publish: 'published',
  needs_direct_test: 'needs_direct_test',
  duplicate: 'duplicate',
  reject: 'rejected',
}

/**
 * Apply a human review decision. Claims exist only while a source is published or marked
 * as needing a direct test; every other decision removes them, so rejected, duplicate and
 * lead sources never contribute to public counts.
 */
export async function reviewEvidence(
  sql: Sql,
  id: string,
  review: EvidenceReview,
): Promise<{ ok: true } | { ok: false; errors: FieldErrors }> {
  const [existing] = await sql<{ id: string; is_demo: boolean }[]>`
    select id::text, is_demo from evidence_sources where id = ${id}`
  if (!existing) return { ok: false, errors: { form: 'Inbox item not found.' } }

  let duplicateOfId: string | null = null
  if (review.action === 'duplicate') {
    const resolved = await resolveDuplicateTarget(sql, review.duplicateOf ?? '', id)
    if (typeof resolved !== 'string') return { ok: false, errors: resolved }
    duplicateOfId = resolved
  }

  const status = STATUS_FOR_ACTION[review.action]
  await sql.begin(async (tx) => {
    await tx`
      update evidence_sources set
        review_status = ${status},
        is_report = ${review.isReport},
        source_type = ${review.sourceType},
        title = ${review.title},
        published_on = ${review.publishedOn},
        game_id = ${review.gameId},
        controller_family_id = ${review.controllerFamilyId},
        controller_variant_id = ${review.controllerVariantId},
        controller_as_written = ${review.controllerAsWritten},
        device_as_written = ${review.deviceAsWritten},
        device_model_code = ${review.deviceModel},
        android_version = ${review.androidVersion},
        game_version = ${review.gameVersion},
        connection_type = ${review.connection},
        controller_mode = ${review.controllerMode},
        claim_summary = ${review.claimSummary},
        review_notes = ${review.reviewNotes},
        duplicate_of_id = ${duplicateOfId},
        reviewed_at = now()
      where id = ${id}`

    await tx`delete from evidence_claims where source_id = ${id}`

    if (review.action === 'publish' || review.action === 'needs_direct_test') {
      const visibility = review.action === 'publish' ? 'published' : 'needs_direct_test'
      await tx`
        insert into evidence_claims ${tx(
          review.results.map((r) => ({
            source_id: id,
            game_id: review.gameId,
            controller_family_id: review.controllerFamilyId,
            controller_variant_id: review.controllerVariantId,
            controller_as_written: review.controllerAsWritten,
            game_version: review.gameVersion,
            android_version: review.androidVersion,
            device_as_written: review.deviceAsWritten,
            device_model_code: review.deviceModel,
            connection_type: review.connection,
            controller_mode: review.controllerMode,
            control: r.control,
            result: r.result,
            statement: review.claimSummary,
            visibility,
            reported_on: review.publishedOn,
            is_demo: existing.is_demo,
          })),
        )}`
    }
  })
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Cold-start funnel
// ---------------------------------------------------------------------------

export type Funnel = {
  candidateUrls: number
  reviewed: number
  actualReports: number
  withExactController: number
  withGameVersion: number
  publishedSources: number
  needsDirectTest: number
  duplicates: number
  rejected: number
  directTestsSubmitted: number
  directTestsApproved: number
  directTestsPending: number
}

/** The evidence-first experiment's funnel. Development fixtures are excluded. */
export async function funnel(sql: Sql): Promise<Funnel> {
  const [e] = await sql<Record<string, number>[]>`
    select
      count(*)::int as candidate_urls,
      count(*) filter (where review_status <> 'new')::int as reviewed,
      count(*) filter (where is_report)::int as actual_reports,
      count(*) filter (where is_report and controller_variant_id is not null)::int as with_exact_controller,
      count(*) filter (where is_report and game_version is not null)::int as with_game_version,
      count(*) filter (where review_status = 'published')::int as published_sources,
      count(*) filter (where review_status = 'needs_direct_test')::int as needs_direct_test,
      count(*) filter (where review_status = 'duplicate')::int as duplicates,
      count(*) filter (where review_status = 'rejected')::int as rejected
    from evidence_sources where not is_demo`
  const [t] = await sql<Record<string, number>[]>`
    select
      count(*)::int as submitted,
      count(*) filter (where status = 'approved')::int as approved,
      count(*) filter (where status = 'pending')::int as pending
    from test_sessions where not is_demo`
  return {
    candidateUrls: e.candidate_urls,
    reviewed: e.reviewed,
    actualReports: e.actual_reports,
    withExactController: e.with_exact_controller,
    withGameVersion: e.with_game_version,
    publishedSources: e.published_sources,
    needsDirectTest: e.needs_direct_test,
    duplicates: e.duplicates,
    rejected: e.rejected,
    directTestsSubmitted: t.submitted,
    directTestsApproved: t.approved,
    directTestsPending: t.pending,
  }
}

// ---------------------------------------------------------------------------
// Login throttling
// ---------------------------------------------------------------------------

export const MAX_LOGIN_FAILURES = 10
export const LOGIN_WINDOW_MINUTES = 15

export async function loginBlocked(sql: Sql, key: string, now: Date = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - LOGIN_WINDOW_MINUTES * 60 * 1000)
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from admin_login_failures where client_key = ${key} and failed_at > ${since}`
  return n >= MAX_LOGIN_FAILURES
}

export async function recordLoginFailure(sql: Sql, key: string): Promise<void> {
  await sql`insert into admin_login_failures (client_key) values (${key})`
  await sql`delete from admin_login_failures where failed_at < now() - interval '1 day'`
}

export async function pendingCounts(sql: Sql): Promise<{ tests: number; evidence: number }> {
  const [r] = await sql<{ tests: number; evidence: number }[]>`
    select
      (select count(*)::int from test_sessions where status = 'pending') as tests,
      (select count(*)::int from evidence_sources where review_status = 'new') as evidence`
  return r
}
