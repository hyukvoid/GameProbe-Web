import { z } from 'zod'
import {
  ANDROID_VERSIONS,
  ANDROID_VERSION_PATTERN,
  CONNECTION_TYPES,
  CONTROLS,
  GAME_VERSION_PATTERN,
  SOURCE_TYPES,
  type Control,
  type ConnectionType,
  type Result,
  type SourceType,
} from './domain'

export type FieldErrors = Record<string, string>

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors }

/** Empty or whitespace-only input means "unknown" and becomes null. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((v) => (v === '' ? null : v))

const optionalPattern = (pattern: RegExp, message: string, max = 40) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === '' ? null : v))
    .refine((v) => v === null || pattern.test(v), message)

const gameVersion = optionalPattern(
  GAME_VERSION_PATTERN,
  'Enter the version exactly as the game shows it, for example 2.8.1. Leave it empty if you don’t know.',
  32,
)

const androidVersion = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .refine(
    (v) => v === null || (ANDROID_VERSIONS as readonly string[]).includes(v) || ANDROID_VERSION_PATTERN.test(v),
    'Choose an Android version or leave it as Unknown.',
  )

const connection = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .refine((v) => v === null || (CONNECTION_TYPES as readonly string[]).includes(v), 'Choose a connection type.')
  .transform((v) => v as ConnectionType | null)

const deviceModel = optionalPattern(
  /^[A-Za-z0-9][A-Za-z0-9 ._/()-]{0,39}$/,
  'Model code can contain letters, numbers, spaces and . _ - / ( ).',
)

const isoDate = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), 'Enter a valid date.')

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ControllerChoice =
  | { kind: 'family'; familyId: string }
  | { kind: 'variant'; variantId: string }
  | { kind: 'other' }
  | { kind: 'none' }

/** Controller select values are "family:<id>", "variant:<id>", "other" or "". */
export function parseControllerChoice(value: string): ControllerChoice | null {
  if (value === '') return { kind: 'none' }
  if (value === 'other') return { kind: 'other' }
  const [kind, id] = value.split(':')
  if (!id || !UUID.test(id)) return null
  if (kind === 'family') return { kind: 'family', familyId: id }
  if (kind === 'variant') return { kind: 'variant', variantId: id }
  return null
}

function collectErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    errors[key] ??= issue.message
  }
  return errors
}

function formValue(form: FormData, key: string): string {
  const v = form.get(key)
  return typeof v === 'string' ? v : ''
}

// ---------------------------------------------------------------------------
// Direct test submission
// ---------------------------------------------------------------------------

const testSubmissionSchema = z.object({
  game: z.string().trim().regex(/^[a-z0-9-]{1,80}$/, 'Choose a game.'),
  gameVersion,
  controller: z.string().trim(),
  controllerOther: optionalText(160, 'Controller name'),
  controllerMode: optionalText(60, 'Controller mode'),
  connection,
  deviceName: optionalText(160, 'Device'),
  deviceModel,
  androidVersion,
  testedOn: z.string().trim(),
  notes: optionalText(2000, 'Notes'),
  website: z.string(),
})

export type TestSubmission = {
  gameSlug: string
  gameVersion: string | null
  controller: ControllerChoice
  controllerOther: string | null
  controllerMode: string | null
  connection: ConnectionType | null
  deviceName: string | null
  deviceModel: string | null
  androidVersion: string | null
  testedOn: string
  notes: string | null
  observations: { control: Control; result: Result }[]
  isSpam: boolean
}

/**
 * Validate a test form. `today` is injected so date checks are deterministic in tests.
 * Only the game, a controller and at least one tested control are required.
 */
export function parseTestSubmission(form: FormData, today: Date = new Date()): ParseResult<TestSubmission> {
  const raw = {
    game: formValue(form, 'game'),
    gameVersion: formValue(form, 'gameVersion'),
    controller: formValue(form, 'controller'),
    controllerOther: formValue(form, 'controllerOther'),
    controllerMode: formValue(form, 'controllerMode'),
    connection: formValue(form, 'connection'),
    deviceName: formValue(form, 'deviceName'),
    deviceModel: formValue(form, 'deviceModel'),
    androidVersion: formValue(form, 'androidVersion'),
    testedOn: formValue(form, 'testedOn'),
    notes: formValue(form, 'notes'),
    website: formValue(form, 'website'),
  }
  const parsed = testSubmissionSchema.safeParse(raw)
  const errors: FieldErrors = parsed.success ? {} : collectErrors(parsed.error)

  const choice = parseControllerChoice(raw.controller.trim())
  if (!choice || choice.kind === 'none') {
    errors.controller ??= 'Choose a controller, or pick “Other” and type its name.'
  } else if (choice.kind === 'other' && raw.controllerOther.trim() === '') {
    errors.controllerOther ??= 'Type the controller name.'
  }

  const observations: { control: Control; result: Result }[] = []
  for (const control of CONTROLS) {
    const v = formValue(form, `result_${control}`)
    if (v === 'works' || v === 'broken') observations.push({ control, result: v })
    else if (v !== '' && v !== 'not_tested') errors[`result_${control}`] ??= 'Choose Works, Broken or Not tested.'
  }
  if (observations.length === 0) {
    errors.results ??= 'Mark at least one control as Works or Broken.'
  }

  const testedOn = raw.testedOn.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(testedOn) || Number.isNaN(Date.parse(testedOn))) {
    errors.testedOn ??= 'Enter the date you tested.'
  } else {
    const tested = Date.parse(`${testedOn}T00:00:00Z`)
    // One day of slack for time zones ahead of UTC.
    if (tested > today.getTime() + 24 * 3600 * 1000) errors.testedOn ??= 'The test date can’t be in the future.'
    if (tested < Date.parse('2020-01-01T00:00:00Z')) errors.testedOn ??= 'The test date is too far in the past.'
  }

  if (!parsed.success || Object.keys(errors).length > 0 || !choice) {
    return { ok: false, errors }
  }
  const v = parsed.data
  return {
    ok: true,
    value: {
      gameSlug: v.game,
      gameVersion: v.gameVersion,
      controller: choice,
      controllerOther: choice.kind === 'other' ? v.controllerOther : null,
      controllerMode: v.controllerMode,
      connection: v.connection,
      deviceName: v.deviceName,
      deviceModel: v.deviceModel,
      androidVersion: v.androidVersion,
      testedOn,
      notes: v.notes,
      observations,
      isSpam: v.website.trim() !== '',
    },
  }
}

// ---------------------------------------------------------------------------
// Evidence Inbox
// ---------------------------------------------------------------------------

const evidenceAddSchema = z.object({
  url: z
    .string()
    .trim()
    .max(2048, 'URL is too long.')
    .refine((v) => {
      try {
        const u = new URL(v)
        return u.protocol === 'https:' || u.protocol === 'http:'
      } catch {
        return false
      }
    }, 'Enter a full http(s) URL.'),
  title: optionalText(300, 'Title'),
  excerpt: optionalText(2000, 'Excerpt'),
  publishedOn: isoDate,
  sourceType: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .refine((v) => v === null || (SOURCE_TYPES as readonly string[]).includes(v), 'Choose a source type.')
    .transform((v) => v as SourceType | null),
})

export type EvidenceAdd = z.infer<typeof evidenceAddSchema>

export function parseEvidenceAdd(form: FormData): ParseResult<EvidenceAdd> {
  const parsed = evidenceAddSchema.safeParse({
    url: formValue(form, 'url'),
    title: formValue(form, 'title'),
    excerpt: formValue(form, 'excerpt'),
    publishedOn: formValue(form, 'publishedOn'),
    sourceType: formValue(form, 'sourceType'),
  })
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, errors: collectErrors(parsed.error) }
}

export const REVIEW_ACTIONS = ['lead', 'publish', 'needs_direct_test', 'duplicate', 'reject'] as const
export type ReviewAction = (typeof REVIEW_ACTIONS)[number]

const evidenceReviewSchema = z.object({
  action: z.enum(REVIEW_ACTIONS, { message: 'Unknown action.' }),
  isReport: z.enum(['', 'yes', 'no'], { message: 'Choose whether this is a report.' }),
  sourceType: z.enum(SOURCE_TYPES, { message: 'Choose a source type.' }),
  title: optionalText(300, 'Title'),
  publishedOn: isoDate,
  gameId: z
    .string()
    .trim()
    .refine((v) => v === '' || UUID.test(v), 'Choose a game.')
    .transform((v) => (v === '' ? null : v)),
  controller: z.string().trim(),
  controllerAsWritten: optionalText(160, 'Controller wording'),
  deviceAsWritten: optionalText(160, 'Device wording'),
  deviceModel,
  androidVersion,
  gameVersion,
  connection,
  controllerMode: optionalText(60, 'Controller mode'),
  claimSummary: optionalText(280, 'Claim summary'),
  reviewNotes: optionalText(4000, 'Review notes'),
  duplicateOf: optionalText(2048, 'Duplicate reference'),
})

export type EvidenceReview = Omit<z.infer<typeof evidenceReviewSchema>, 'isReport' | 'controller'> & {
  isReport: boolean | null
  controllerFamilyId: string | null
  controllerVariantId: string | null
  results: { control: Control; result: Result }[]
}

/**
 * Validate an inbox review. Publishing is only allowed for something a human has marked
 * as an actual report, with a game, a controller family, at least one stated result and
 * a written claim. A controller variant is only set when the reviewer picked one.
 */
export function parseEvidenceReview(
  form: FormData,
  variantFamily: (variantId: string) => string | undefined,
): ParseResult<EvidenceReview> {
  const raw: Record<string, string> = {}
  for (const key of Object.keys(evidenceReviewSchema.shape)) raw[key] = formValue(form, key)
  const parsed = evidenceReviewSchema.safeParse(raw)
  const errors: FieldErrors = parsed.success ? {} : collectErrors(parsed.error)

  let controllerFamilyId: string | null = null
  let controllerVariantId: string | null = null
  const choice = parseControllerChoice(raw.controller.trim())
  if (!choice || choice.kind === 'other') {
    errors.controller ??= 'Choose a catalog controller or leave it empty.'
  } else if (choice.kind === 'family') {
    controllerFamilyId = choice.familyId
  } else if (choice.kind === 'variant') {
    const family = variantFamily(choice.variantId)
    if (!family) errors.controller ??= 'Unknown controller model.'
    else {
      controllerFamilyId = family
      controllerVariantId = choice.variantId
    }
  }

  const results: { control: Control; result: Result }[] = []
  for (const control of CONTROLS) {
    const v = formValue(form, `result_${control}`)
    if (v === 'works' || v === 'broken') results.push({ control, result: v })
  }

  if (parsed.success) {
    const v = parsed.data
    if (v.action === 'publish' || v.action === 'needs_direct_test') {
      if (v.isReport !== 'yes') errors.isReport ??= 'Only an actual report can be published. Questions are not evidence.'
      if (!v.gameId) errors.gameId ??= 'Choose the game this report is about.'
      if (!controllerFamilyId) errors.controller ??= 'Choose at least the controller family.'
      if (results.length === 0) errors.results ??= 'State at least one control result from the source.'
      if (!v.claimSummary) errors.claimSummary ??= 'Write the reviewed claim in your own words.'
    }
    if (v.action === 'duplicate' && !v.duplicateOf) {
      errors.duplicateOf ??= 'Enter the URL or ID of the original source.'
    }
  }

  if (!parsed.success || Object.keys(errors).length > 0) return { ok: false, errors }
  const { isReport, controller: _controller, ...rest } = parsed.data
  void _controller
  return {
    ok: true,
    value: {
      ...rest,
      isReport: isReport === '' ? null : isReport === 'yes',
      controllerFamilyId,
      controllerVariantId,
      results,
    },
  }
}

/** Fields a reviewed source still lacks. Shown to reviewers and on external reports. */
export function missingEvidenceFields(s: {
  gameVersion: string | null
  androidVersion: string | null
  deviceAsWritten: string | null
  deviceModelCode: string | null
  controllerVariantId: string | null
  connectionType: string | null
  publishedOn: string | null
}): string[] {
  const missing: string[] = []
  if (!s.gameVersion) missing.push('Game version')
  if (!s.controllerVariantId) missing.push('Exact controller model')
  if (!s.connectionType) missing.push('Connection')
  if (!s.deviceAsWritten && !s.deviceModelCode) missing.push('Device')
  if (!s.androidVersion) missing.push('Android version')
  if (!s.publishedOn) missing.push('Source date')
  return missing
}
