'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { FieldError } from '@/components/field-error'
import { SOURCE_TYPES, SOURCE_TYPE_LABELS } from '@/lib/domain'
import { addEvidence, type FormState } from '../actions'

export function AddEvidenceForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addEvidence, null)
  const errors = state?.errors ?? {}
  const values = state?.values ?? {}
  const invalid = (k: string) =>
    errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': `add-${k}-error` } : {}

  return (
    <form key={state?.attempt ?? 0} action={action} className="form" style={{ marginTop: 12 }} noValidate>
      <div className="field">
        <label htmlFor="add-url">URL</label>
        <input id="add-url" name="url" type="url" required defaultValue={values.url} {...invalid('url')} />
        <FieldError id="add-url-error" message={errors.url} />
        {state?.existingId && (
          <p className="small">
            <Link href={`/admin/evidence/${state.existingId}`}>Open the existing item</Link>
          </p>
        )}
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="add-title">Title (optional)</label>
          <input id="add-title" name="title" type="text" maxLength={300} defaultValue={values.title} {...invalid('title')} />
          <FieldError id="add-title-error" message={errors.title} />
        </div>
        <div className="field">
          <label htmlFor="add-type">Source type</label>
          <select id="add-type" name="sourceType" defaultValue={values.sourceType ?? ''}>
            <option value="">Detect from URL</option>
            {SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {SOURCE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="add-date">Published (optional)</label>
          <input id="add-date" name="publishedOn" type="date" defaultValue={values.publishedOn} {...invalid('publishedOn')} />
          <FieldError id="add-publishedOn-error" message={errors.publishedOn} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="add-excerpt">Excerpt (optional, private)</label>
        <textarea id="add-excerpt" name="excerpt" maxLength={2000} defaultValue={values.excerpt} aria-describedby="add-excerpt-hint" />
        <p id="add-excerpt-hint" className="hint">
          A short quote to review from. Not shown publicly.
        </p>
      </div>
      <div>
        <button className="button" type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add to inbox'}
        </button>
      </div>
    </form>
  )
}
