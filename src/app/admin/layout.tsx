import type { Metadata } from 'next'
import Link from 'next/link'
import { isAdmin } from '@/lib/admin-session'
import { pendingCounts } from '@/lib/data/admin'
import { requestDb } from '@/lib/db'
import { logout } from './actions'

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin · GameProbe' },
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const signedIn = await isAdmin()
  const counts = signedIn ? await pendingCounts(await requestDb()) : null
  return (
    <>
      {signedIn && counts && (
        <nav className="admin-bar" aria-label="Admin">
          <strong>Admin</strong>
          <Link href="/admin">Overview</Link>
          <Link href="/admin/tests">Pending tests ({counts.tests})</Link>
          <Link href="/admin/evidence">Evidence Inbox ({counts.evidence} new)</Link>
          <form action={logout}>
            <button type="submit" className="button secondary">
              Sign out
            </button>
          </form>
        </nav>
      )}
      {children}
    </>
  )
}
