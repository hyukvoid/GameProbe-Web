import type { SourceType } from './domain'

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'si', 'feature', 'share_id', 'ref', 'ref_src',
])

/**
 * Normalize a URL for duplicate detection: lowercase host without "www.", no fragment,
 * no tracking parameters, sorted query, no trailing slash, and short YouTube/Reddit
 * forms expanded. The original URL is stored separately and always used for links.
 */
export function urlKey(input: string): string {
  const url = new URL(input.trim())
  let host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^(old|new|m)\.reddit\.com$/, 'reddit.com')
  let path = url.pathname

  if (host === 'youtu.be') {
    const id = path.slice(1).split('/')[0]
    host = 'youtube.com'
    path = '/watch'
    url.search = `?v=${id}`
  } else if (host === 'm.youtube.com') {
    host = 'youtube.com'
  }
  if (host === 'youtube.com' && path.startsWith('/shorts/')) {
    url.search = `?v=${path.split('/')[2] ?? ''}`
    path = '/watch'
  }

  const params = [...url.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAMS.has(k.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b))
  // Only the video id identifies a YouTube watch page.
  const kept = host === 'youtube.com' && path === '/watch' ? params.filter(([k]) => k === 'v') : params
  const query = kept.length ? '?' + kept.map(([k, v]) => `${k}=${v}`).join('&') : ''

  path = path.replace(/\/+$/, '') || '/'
  return `${host}${path}${query}`
}

export function guessSourceType(input: string): SourceType {
  const host = new URL(input).hostname.toLowerCase()
  if (/(^|\.)reddit\.com$|(^|\.)redd\.it$/.test(host)) return 'reddit'
  if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) return 'youtube'
  if (/(^|\.)discord(app)?\.com$|(^|\.)discord\.gg$/.test(host)) return 'discord'
  return 'other'
}

export function hostOf(input: string): string {
  try {
    return new URL(input).hostname.replace(/^www\./, '')
  } catch {
    return input
  }
}
