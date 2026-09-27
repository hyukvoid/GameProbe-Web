import type { Sql } from 'postgres'
import type { FieldErrors, TestSubmission } from '../validation'

export const MAX_SUBMISSIONS_PER_HOUR = 5

export type SubmitResult = { ok: true; id: string | null } | { ok: false; errors: FieldErrors }

/**
 * Store an anonymous direct test. It is always created as 'pending' and is invisible
 * until an admin approves it. Only rows in test_sessions, test_observations and (for a
 * new version string) game_builds can be created; ids are checked against the catalog.
 */
export async function createTestSession(
  sql: Sql,
  input: TestSubmission,
  ctx: { submitterKey: string | null; now?: Date },
): Promise<SubmitResult> {
  // Honeypot filled in: report success without storing anything.
  if (input.isSpam) return { ok: true, id: null }

  const now = ctx.now ?? new Date()

  const [game] = await sql<{ id: string }[]>`select id from games where slug = ${input.gameSlug}`
  if (!game) return { ok: false, errors: { game: 'Choose a game from the list.' } }

  let familyId: string | null = null
  let variantId: string | null = null
  if (input.controller.kind === 'family') {
    const [f] = await sql<{ id: string }[]>`select id from controller_families where id = ${input.controller.familyId}`
    if (!f) return { ok: false, errors: { controller: 'Choose a controller from the list.' } }
    familyId = f.id
  } else if (input.controller.kind === 'variant') {
    const [v] = await sql<{ id: string; family_id: string }[]>`
      select id, family_id from controller_variants where id = ${input.controller.variantId}`
    if (!v) return { ok: false, errors: { controller: 'Choose a controller from the list.' } }
    familyId = v.family_id
    variantId = v.id
  } else if (input.controller.kind !== 'other') {
    return { ok: false, errors: { controller: 'Choose a controller.' } }
  }

  if (ctx.submitterKey) {
    const since = new Date(now.getTime() - 3600 * 1000)
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from test_sessions
      where submitter_key = ${ctx.submitterKey} and submitted_at > ${since}`
    if (n >= MAX_SUBMISSIONS_PER_HOUR) {
      return { ok: false, errors: { form: 'Too many submissions from this network in the last hour. Try again later.' } }
    }
  }

  const id = await sql.begin(async (tx) => {
    let buildId: string | null = null
    if (input.gameVersion) {
      const [b] = await tx<{ id: string }[]>`
        insert into game_builds (game_id, version) values (${game.id}, ${input.gameVersion})
        on conflict (game_id, version) do update set version = excluded.version
        returning id`
      buildId = b.id
    }
    const [s] = await tx<{ id: string }[]>`
      insert into test_sessions (
        status, game_id, game_build_id, controller_family_id, controller_variant_id, controller_as_entered,
        device_as_entered, device_model_code, android_version, connection_type, controller_mode,
        tested_on, notes, submitter_key, submitted_at
      ) values (
        'pending', ${game.id}, ${buildId}, ${familyId}, ${variantId}, ${input.controllerOther},
        ${input.deviceName}, ${input.deviceModel}, ${input.androidVersion}, ${input.connection}, ${input.controllerMode},
        ${input.testedOn}, ${input.notes}, ${ctx.submitterKey}, ${now}
      ) returning id::text`
    await tx`
      insert into test_observations ${tx(
        input.observations.map((o) => ({ session_id: s.id, control: o.control, result: o.result })),
      )}`
    return s.id
  })

  return { ok: true, id }
}
