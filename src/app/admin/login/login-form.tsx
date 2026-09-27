'use client'

import { useActionState } from 'react'
import { login, type FormState } from '../actions'

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, null)
  const errors = state?.errors ?? {}
  return (
    <form action={action} className="form" style={{ maxWidth: 360 }}>
      {errors.form && (
        <p className="error-summary" role="alert">
          {errors.form}
        </p>
      )}
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? 'password-error' : undefined}
        />
        {errors.password && (
          <p id="password-error" className="error" role="alert">
            {errors.password}
          </p>
        )}
      </div>
      <div>
        <button className="button" type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </form>
  )
}
