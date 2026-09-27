import { describe, expect, it } from 'vitest'
import {
  addressFromHeaders,
  clientKey,
  createSessionToken,
  passwordMatches,
  readAuthConfig,
  SESSION_TTL_SECONDS,
  verifySessionToken,
} from '@/lib/auth'
import { guessSourceType, urlKey } from '@/lib/url'

describe('urlKey', () => {
  it('treats copies of the same page as one source', () => {
    const variants = [
      'https://www.reddit.com/r/WutheringWaves/comments/abc123/rt_not_working/',
      'https://old.reddit.com/r/WutheringWaves/comments/abc123/rt_not_working?utm_source=share&utm_medium=web',
      'https://reddit.com/r/WutheringWaves/comments/abc123/rt_not_working#comment',
    ]
    expect(new Set(variants.map(urlKey)).size).toBe(1)
  })

  it('normalizes YouTube short links, shorts and share parameters', () => {
    expect(urlKey('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('youtube.com/watch?v=dQw4w9WgXcQ')
    expect(urlKey('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe('youtube.com/watch?v=dQw4w9WgXcQ')
    expect(urlKey('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube.com/watch?v=dQw4w9WgXcQ')
  })

  it('keeps meaningful query parameters', () => {
    expect(urlKey('https://forum.example.com/thread?id=5&page=2')).toBe('forum.example.com/thread?id=5&page=2')
    expect(urlKey('https://forum.example.com/thread?id=5')).not.toBe(urlKey('https://forum.example.com/thread?id=6'))
  })

  it('guesses the source type from the host', () => {
    expect(guessSourceType('https://redd.it/abc')).toBe('reddit')
    expect(guessSourceType('https://m.youtube.com/watch?v=x')).toBe('youtube')
    expect(guessSourceType('https://www.hoyolab.com/article/1')).toBe('other')
  })
})

describe('admin session', () => {
  const secret = 's'.repeat(40)

  it('accepts a fresh token and rejects expired or tampered ones', () => {
    const now = Date.parse('2026-09-27T00:00:00Z')
    const token = createSessionToken(secret, now)
    expect(verifySessionToken(token, secret, now + 1000)).toBe(true)
    expect(verifySessionToken(token, secret, now + (SESSION_TTL_SECONDS + 1) * 1000)).toBe(false)
    expect(verifySessionToken(token, 'x'.repeat(40), now)).toBe(false)
    const [payload, mac] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ v: 1, exp: 9999999999 })).toString('base64url')
    expect(verifySessionToken(`${forged}.${mac}`, secret, now)).toBe(false)
    expect(verifySessionToken(`${payload}.${mac}.x`, secret, now)).toBe(false)
    expect(verifySessionToken(undefined, secret, now)).toBe(false)
  })

  it('compares passwords exactly', () => {
    expect(passwordMatches('correct horse battery', 'correct horse battery')).toBe(true)
    expect(passwordMatches('correct horse batter', 'correct horse battery')).toBe(false)
  })

  it('disables admin access when secrets are missing or weak', () => {
    expect(readAuthConfig({})).toBe(null)
    expect(readAuthConfig({ ADMIN_PASSWORD: 'short', APP_SECRET: secret })).toBe(null)
    expect(readAuthConfig({ ADMIN_PASSWORD: 'p'.repeat(16), APP_SECRET: 'short' })).toBe(null)
    expect(readAuthConfig({ ADMIN_PASSWORD: 'p'.repeat(16), APP_SECRET: secret })).not.toBe(null)
  })
})

describe('client key', () => {
  it('hashes the address with a daily rotation and never returns it raw', () => {
    const secret = 'k'.repeat(40)
    const day1 = new Date('2026-09-27T10:00:00Z')
    const a = clientKey('203.0.113.7', secret, day1)
    expect(a).not.toContain('203.0.113.7')
    expect(clientKey('203.0.113.7', secret, new Date('2026-09-27T23:00:00Z'))).toBe(a)
    expect(clientKey('203.0.113.7', secret, new Date('2026-09-28T01:00:00Z'))).not.toBe(a)
    expect(clientKey(null, secret)).toBe(null)
  })

  it('reads the first forwarded address', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })
    expect(addressFromHeaders(h)).toBe('203.0.113.7')
    expect(addressFromHeaders(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
    expect(addressFromHeaders(new Headers())).toBe(null)
  })
})
