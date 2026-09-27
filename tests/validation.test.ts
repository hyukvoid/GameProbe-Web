import { describe, expect, it } from 'vitest'
import { missingEvidenceFields, parseControllerChoice, parseEvidenceReview, parseTestSubmission } from '@/lib/validation'
import { form } from './helpers/db'

const FAMILY = '11111111-1111-4111-8111-111111111111'
const VARIANT = '22222222-2222-4222-8222-222222222222'
const TODAY = new Date('2026-09-27T12:00:00Z')

function submission(overrides: Record<string, string> = {}) {
  return form({
    game: 'wuthering-waves',
    controller: `family:${FAMILY}`,
    testedOn: '2026-09-27',
    result_triggers: 'broken',
    website: '',
    ...overrides,
  })
}

describe('parseTestSubmission', () => {
  it('accepts a minimal submission and keeps every unknown field as null', () => {
    const r = parseTestSubmission(submission(), TODAY)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toMatchObject({
      gameSlug: 'wuthering-waves',
      gameVersion: null,
      deviceName: null,
      deviceModel: null,
      androidVersion: null,
      connection: null,
      controllerMode: null,
      notes: null,
      controller: { kind: 'family', familyId: FAMILY },
      observations: [{ control: 'triggers', result: 'broken' }],
    })
  })

  it('treats whitespace-only input as unknown, not as a value', () => {
    const r = parseTestSubmission(submission({ gameVersion: '   ', deviceName: ' ', notes: '\n' }), TODAY)
    expect(r.ok && r.value.gameVersion).toBe(null)
    expect(r.ok && r.value.deviceName).toBe(null)
    expect(r.ok && r.value.notes).toBe(null)
  })

  it('omits controls marked Not tested instead of storing a result', () => {
    const r = parseTestSubmission(
      submission({ result_menu: 'works', result_vibration: 'not_tested', result_camera: '' }),
      TODAY,
    )
    expect(r.ok && r.value.observations.map((o) => o.control)).toEqual(['menu', 'triggers'])
  })

  it('requires at least one tested control', () => {
    const r = parseTestSubmission(submission({ result_triggers: 'not_tested' }), TODAY)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.errors.results).toMatch(/at least one/)
  })

  it('records detection only from what the tester answered', () => {
    expect(parseTestSubmission(submission({ controllerDetected: 'yes' }), TODAY)).toMatchObject({
      ok: true,
      value: { controllerDetected: true },
    })
    expect(parseTestSubmission(submission({ controllerDetected: 'no' }), TODAY)).toMatchObject({
      ok: true,
      value: { controllerDetected: false },
    })
    // "Not sure / not tested" and a missing answer are both unknown, never false.
    expect(parseTestSubmission(submission({ controllerDetected: 'not_sure' }), TODAY)).toMatchObject({
      ok: true,
      value: { controllerDetected: null },
    })
    expect(parseTestSubmission(submission({ controllerDetected: '   ' }), TODAY)).toMatchObject({
      ok: true,
      value: { controllerDetected: null },
    })
    expect(parseTestSubmission(submission({ controllerDetected: 'maybe' }), TODAY).ok).toBe(false)
  })

  it('accepts a test with no control result only when the game did not detect the controller', () => {
    const notDetected = parseTestSubmission(
      submission({ result_triggers: 'not_tested', controllerDetected: 'no' }),
      TODAY,
    )
    expect(notDetected.ok).toBe(true)
    expect(notDetected.ok && notDetected.value.observations).toEqual([])
    // Detected, or unknown, still requires something the tester actually tried.
    expect(parseTestSubmission(submission({ result_triggers: 'not_tested', controllerDetected: 'yes' }), TODAY).ok).toBe(
      false,
    )
  })

  it('refuses vague game versions such as "latest"', () => {
    for (const bad of ['latest', 'current patch', 'v2', '2.x']) {
      const r = parseTestSubmission(submission({ gameVersion: bad }), TODAY)
      expect(r.ok, bad).toBe(false)
      expect(!r.ok && r.errors.gameVersion).toBeTruthy()
    }
    for (const good of ['2.8.1', '6.1', '3.4.0-hotfix', '2.8.1.2']) {
      expect(parseTestSubmission(submission({ gameVersion: good }), TODAY).ok, good).toBe(true)
    }
  })

  it('requires a typed name when the controller is Other', () => {
    const missing = parseTestSubmission(submission({ controller: 'other' }), TODAY)
    expect(!missing.ok && missing.errors.controllerOther).toBeTruthy()
    const ok = parseTestSubmission(submission({ controller: 'other', controllerOther: 'Generic pad' }), TODAY)
    expect(ok.ok && ok.value.controllerOther).toBe('Generic pad')
  })

  it('rejects malformed controller ids and missing controllers', () => {
    expect(parseTestSubmission(submission({ controller: 'family:not-a-uuid' }), TODAY).ok).toBe(false)
    expect(parseTestSubmission(submission({ controller: '' }), TODAY).ok).toBe(false)
    expect(parseTestSubmission(submission({ controller: `variant:${VARIANT}` }), TODAY).ok).toBe(true)
  })

  it('rejects future test dates and unknown option values', () => {
    expect(parseTestSubmission(submission({ testedOn: '2026-10-05' }), TODAY).ok).toBe(false)
    expect(parseTestSubmission(submission({ connection: 'wifi' }), TODAY).ok).toBe(false)
    expect(parseTestSubmission(submission({ androidVersion: 'Oreo' }), TODAY).ok).toBe(false)
    expect(parseTestSubmission(submission({ result_menu: 'maybe' }), TODAY).ok).toBe(false)
  })

  it('enforces length limits server-side', () => {
    expect(parseTestSubmission(submission({ notes: 'x'.repeat(2001) }), TODAY).ok).toBe(false)
    expect(parseTestSubmission(submission({ deviceName: 'x'.repeat(161) }), TODAY).ok).toBe(false)
  })

  it('flags the honeypot field', () => {
    const r = parseTestSubmission(submission({ website: 'http://spam.example' }), TODAY)
    expect(r.ok && r.value.isSpam).toBe(true)
  })
})

describe('parseControllerChoice', () => {
  it('parses the select encoding', () => {
    expect(parseControllerChoice('')).toEqual({ kind: 'none' })
    expect(parseControllerChoice('other')).toEqual({ kind: 'other' })
    expect(parseControllerChoice(`family:${FAMILY}`)).toEqual({ kind: 'family', familyId: FAMILY })
    expect(parseControllerChoice('variant:x')).toBe(null)
    expect(parseControllerChoice(`group:${FAMILY}`)).toBe(null)
  })
})

describe('parseEvidenceReview', () => {
  const GAME = '33333333-3333-4333-8333-333333333333'
  const variantFamily = (id: string) => (id === VARIANT ? FAMILY : undefined)
  const review = (overrides: Record<string, string> = {}) =>
    form({
      action: 'publish',
      isReport: 'yes',
      sourceType: 'reddit',
      gameId: GAME,
      controller: `family:${FAMILY}`,
      claimSummary: 'RT does not respond in combat.',
      result_triggers: 'broken',
      ...overrides,
    })

  it('publishes a reviewed report with the family only when no model was chosen', () => {
    const r = parseEvidenceReview(review({ controllerAsWritten: '8BitDo Ultimate' }), variantFamily)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.controllerFamilyId).toBe(FAMILY)
    expect(r.value.controllerVariantId).toBe(null)
    expect(r.value.controllerAsWritten).toBe('8BitDo Ultimate')
    expect(r.value.gameVersion).toBe(null)
  })

  it('derives the family from an explicitly chosen variant', () => {
    const r = parseEvidenceReview(review({ controller: `variant:${VARIANT}` }), variantFamily)
    expect(r.ok && [r.value.controllerFamilyId, r.value.controllerVariantId]).toEqual([FAMILY, VARIANT])
  })

  it('never publishes a question as evidence', () => {
    for (const isReport of ['no', '']) {
      const r = parseEvidenceReview(review({ isReport }), variantFamily)
      expect(r.ok).toBe(false)
      expect(!r.ok && r.errors.isReport).toMatch(/Questions are not evidence/)
    }
    // Rejecting a question is fine.
    expect(parseEvidenceReview(review({ isReport: 'no', action: 'reject' }), variantFamily).ok).toBe(true)
  })

  it('requires a game, a result and a written claim to publish', () => {
    const r = parseEvidenceReview(review({ gameId: '', claimSummary: '', result_triggers: '' }), variantFamily)
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['claimSummary', 'gameId', 'results'])
  })

  it('publishes a source that names no controller without inventing one', () => {
    const r = parseEvidenceReview(review({ controller: '' }), variantFamily)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.controllerFamilyId).toBe(null)
    expect(r.value.controllerVariantId).toBe(null)
    expect(r.value.results).toEqual([{ control: 'triggers', result: 'broken' }])
  })

  it('collects the evidence-only controller support subject alongside the controls', () => {
    const r = parseEvidenceReview(
      review({ result_triggers: '', result_controller_support: 'works' }),
      variantFamily,
    )
    expect(r.ok && r.value.results).toEqual([{ control: 'controller_support', result: 'works' }])
    // The eight direct-test controls are unchanged: only the extra subject is new.
    expect(parseEvidenceReview(review({}), variantFamily).ok).toBe(true)
  })

  it('keeps an unreviewed lead without requiring structured fields', () => {
    const r = parseEvidenceReview(
      form({ action: 'lead', isReport: '', sourceType: 'forum', gameId: '', controller: '' }),
      variantFamily,
    )
    expect(r.ok && r.value.isReport).toBe(null)
  })

  it('refuses "latest patch" as a game version', () => {
    const r = parseEvidenceReview(review({ gameVersion: 'latest patch' }), variantFamily)
    expect(!r.ok && r.errors.gameVersion).toBeTruthy()
  })

  it('requires a target when merging a duplicate', () => {
    const r = parseEvidenceReview(review({ action: 'duplicate', duplicateOf: '' }), variantFamily)
    expect(!r.ok && r.errors.duplicateOf).toBeTruthy()
  })
})

describe('missingEvidenceFields', () => {
  it('lists every unknown dimension', () => {
    expect(
      missingEvidenceFields({
        gameVersion: null,
        androidVersion: null,
        deviceAsWritten: null,
        deviceModelCode: null,
        controllerVariantId: null,
        connectionType: 'bluetooth',
        publishedOn: '2026-09-01',
      }),
    ).toEqual(['Game version', 'Exact controller model', 'Device', 'Android version'])
  })
})
