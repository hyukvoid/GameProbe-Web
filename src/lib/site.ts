import 'server-only'
import { headers } from 'next/headers'

/**
 * Absolute origin of the current request, e.g. "https://gameprobe.example".
 *
 * Derived from request headers (forwarded host first, then host) so canonical URLs,
 * robots.txt and the sitemap are correct on the production domain, on preview
 * deployments and on localhost alike. No new environment variable and no hardcoded
 * domain: the deployed host is the site URL.
 */
export async function siteOrigin(): Promise<string> {
  const h = await headers()
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000')
    .split(',')[0]
    .trim()
  const proto = (h.get('x-forwarded-proto') ?? 'http').split(',')[0].trim()
  return `${proto}://${host}`
}
