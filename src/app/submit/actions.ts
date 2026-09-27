'use server'

import { revalidatePath } from 'next/cache'
import { requestClientKey } from '@/lib/admin-session'
import { createTestSession } from '@/lib/data/submissions'
import { db } from '@/lib/db'
import { parseTestSubmission, type FieldErrors } from '@/lib/validation'

export type SubmitState =
  | { status: 'idle' }
  | { status: 'error'; errors: FieldErrors; values: Record<string, string>; attempt: number }
  | { status: 'done'; reference: string | null; gameSlug: string }

function echo(form: FormData): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [k, v] of form.entries()) {
    if (typeof v === 'string' && !k.startsWith('$ACTION') && k !== 'website') values[k] = v.slice(0, 2000)
  }
  return values
}

/** Public, unauthenticated. Everything is validated here; the result is stored as pending. */
export async function submitTest(_prev: SubmitState, form: FormData): Promise<SubmitState> {
  const parsed = parseTestSubmission(form)
  if (!parsed.ok) return { status: 'error', errors: parsed.errors, values: echo(form), attempt: Date.now() }

  try {
    const result = await createTestSession(db(), parsed.value, { submitterKey: await requestClientKey() })
    if (!result.ok) return { status: 'error', errors: result.errors, values: echo(form), attempt: Date.now() }
    revalidatePath('/admin')
    return { status: 'done', reference: result.id, gameSlug: parsed.value.gameSlug }
  } catch (err) {
    console.error('submitTest failed', err)
    return {
      status: 'error',
      errors: { form: 'The test could not be saved because of a server problem. Please try again in a few minutes.' },
      values: echo(form),
      attempt: Date.now(),
    }
  }
}
