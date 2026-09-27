import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin-session'
import { readAuthConfig } from '@/lib/auth'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage() {
  if (await isAdmin()) redirect('/admin')
  const configured = readAuthConfig() !== null
  return (
    <main id="main">
      <div className="page-head">
        <h1>Admin sign in</h1>
      </div>
      {configured ? (
        <LoginForm />
      ) : (
        <div className="notice">
          <p>Admin access is disabled.</p>
          <p className="muted">Set ADMIN_PASSWORD (16+ characters) and APP_SECRET (32+ characters) on the server.</p>
        </div>
      )}
    </main>
  )
}
