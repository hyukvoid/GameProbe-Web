'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { endAdminSession, requestClientKey, requireAdmin, startAdminSession } from '@/lib/admin-session'
import { passwordMatches, readAuthConfig } from '@/lib/auth'
import {
  addEvidenceSource,
  loginBlocked,
  moderateTest,
  recordLoginFailure,
  reviewEvidence,
} from '@/lib/data/admin'
import { db } from '@/lib/db'
import { TEST_STATUSES } from '@/lib/domain'
import { parseControllerChoice, parseEvidenceAdd, parseEvidenceReview, type FieldErrors } from '@/lib/validation'

export type FormState = { errors: FieldErrors; values: Record<string, string>; attempt: number; existingId?: string } | null

function echo(form: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of form.entries()) if (typeof v === 'string' && !k.startsWith('$ACTION')) out[k] = v
  return out
}

// ---- Session -----------------------------------------------------------------------

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const config = readAuthConfig()
  if (!config) return { errors: { form: 'Admin access is not configured on this server.' }, values: {}, attempt: Date.now() }

  const sql = db()
  const key = (await requestClientKey()) ?? 'unknown'
  if (await loginBlocked(sql, key)) {
    return { errors: { form: 'Too many failed attempts. Try again in 15 minutes.' }, values: {}, attempt: Date.now() }
  }
  const password = form.get('password')
  if (typeof password !== 'string' || !passwordMatches(password, config.password)) {
    await recordLoginFailure(sql, key)
    return { errors: { password: 'Incorrect password.' }, values: {}, attempt: Date.now() }
  }
  await startAdminSession()
  redirect('/admin')
}

export async function logout(): Promise<void> {
  await endAdminSession()
  redirect('/admin/login')
}

// ---- Direct test moderation --------------------------------------------------------

export async function moderate(form: FormData): Promise<void> {
  await requireAdmin()
  const id = String(form.get('id') ?? '')
  const decision = form.get('decision')
  const back = String(form.get('back') ?? 'pending')
  if (!/^[0-9a-f-]{36}$/i.test(id) || (decision !== 'approve' && decision !== 'reject')) {
    throw new Error('Invalid moderation request.')
  }
  const choice = parseControllerChoice(String(form.get('controller') ?? '')) ?? { kind: 'none' as const }
  const note = String(form.get('note') ?? '').trim().slice(0, 1000) || null
  const result = await moderateTest(db(), {
    id,
    decision,
    note,
    controller: choice.kind === 'other' ? { kind: 'none' } : choice,
  })
  if (!result.ok) throw new Error(result.error)
  revalidatePath('/', 'layout')
  const status = (TEST_STATUSES as readonly string[]).includes(back) ? back : 'pending'
  redirect(`/admin/tests?status=${status}`)
}

// ---- Evidence Inbox ----------------------------------------------------------------

export async function addEvidence(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin()
  const parsed = parseEvidenceAdd(form)
  if (!parsed.ok) return { errors: parsed.errors, values: echo(form), attempt: Date.now() }
  const result = await addEvidenceSource(db(), parsed.value)
  if (!result.ok) {
    return { errors: result.errors, values: echo(form), attempt: Date.now(), existingId: result.existingId }
  }
  redirect(`/admin/evidence/${result.id}`)
}

export async function review(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin()
  const sql = db()
  const variants = await sql<{ id: string; family_id: string }[]>`
    select id::text, family_id::text from controller_variants`
  const parsed = parseEvidenceReview(form, (v) => variants.find((x) => x.id === v)?.family_id)
  if (!parsed.ok) return { errors: parsed.errors, values: echo(form), attempt: Date.now() }
  const result = await reviewEvidence(sql, id, parsed.value)
  if (!result.ok) return { errors: result.errors, values: echo(form), attempt: Date.now() }
  revalidatePath('/', 'layout')
  redirect(`/admin/evidence/${id}?saved=${parsed.value.action}`)
}
