import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

// Single-admin authentication without an account system. ADMIN_PASSWORD is checked in
// constant time; a successful login gets an HMAC-signed, expiring session token stored in
// an HTTP-only cookie. APP_SECRET signs the token and keys submitter hashes.

export const SESSION_TTL_SECONDS = 12 * 3600
export const MIN_PASSWORD_LENGTH = 16
export const MIN_SECRET_LENGTH = 32

export type AuthConfig = { password: string; secret: string }

/** Returns null when admin access is not configured safely; admin stays disabled then. */
export function readAuthConfig(env: Record<string, string | undefined> = process.env): AuthConfig | null {
  const password = env.ADMIN_PASSWORD ?? ''
  const secret = env.APP_SECRET ?? ''
  if (password.length < MIN_PASSWORD_LENGTH || secret.length < MIN_SECRET_LENGTH) return null
  return { password, secret }
}

function sha256(s: string): Buffer {
  return createHash('sha256').update(s, 'utf8').digest()
}

export function passwordMatches(input: string, expected: string): boolean {
  // Hash both sides so lengths are equal and comparison time doesn't leak length.
  return timingSafeEqual(sha256(input), sha256(expected))
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createSessionToken(secret: string, now: number = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ v: 1, exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS })).toString(
    'base64url',
  )
  return `${payload}.${sign(payload, secret)}`
}

export function verifySessionToken(token: string | undefined, secret: string, now: number = Date.now()): boolean {
  if (!token) return false
  const [payload, mac, extra] = token.split('.')
  if (!payload || !mac || extra !== undefined) return false
  const expected = Buffer.from(sign(payload, secret))
  const given = Buffer.from(mac)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { v?: number; exp?: number }
    return data.v === 1 && typeof data.exp === 'number' && data.exp > Math.floor(now / 1000)
  } catch {
    return false
  }
}

/**
 * Keyed, daily-rotating hash of a network address. The raw address is never stored; the
 * hash only lets the server limit how many tests one network submits per hour.
 */
export function clientKey(address: string | null, secret: string, now: Date = new Date()): string | null {
  if (!address) return null
  const day = now.toISOString().slice(0, 10)
  return createHmac('sha256', secret).update(`${day}|${address}`).digest('base64url').slice(0, 32)
}

/** First address in X-Forwarded-For, as set by the hosting proxy (e.g. Vercel). */
export function addressFromHeaders(h: { get(name: string): string | null }): string | null {
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim() || null
  return h.get('x-real-ip')?.trim() || null
}
