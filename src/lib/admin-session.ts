import 'server-only'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { addressFromHeaders, clientKey, createSessionToken, readAuthConfig, SESSION_TTL_SECONDS, verifySessionToken } from './auth'

const COOKIE = 'gp_admin'

export async function isAdmin(): Promise<boolean> {
  // Read the cookie before anything else so every admin route is rendered per request,
  // even when the build environment has no admin configuration.
  const token = (await cookies()).get(COOKIE)?.value
  const config = readAuthConfig()
  if (!config) return false
  return verifySessionToken(token, config.secret)
}

/** Call at the top of every admin page and every admin Server Action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/login')
}

export async function startAdminSession(): Promise<void> {
  const config = readAuthConfig()
  if (!config) throw new Error('Admin access is not configured.')
  ;(await cookies()).set(COOKIE, createSessionToken(config.secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export async function endAdminSession(): Promise<void> {
  ;(await cookies()).delete(COOKIE)
}

/** Hashed client key for rate limiting; null when APP_SECRET is missing. */
export async function requestClientKey(): Promise<string | null> {
  const secret = process.env.APP_SECRET
  if (!secret) return null
  return clientKey(addressFromHeaders(await headers()), secret)
}
