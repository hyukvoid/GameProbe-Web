import type { MetadataRoute } from 'next'
import { buildRobots } from '@/lib/seo'
import { siteOrigin } from '@/lib/site'

/**
 * Public reference pages are crawlable; /admin is disallowed. Search pages are handled by
 * their own noindex,follow meta so their links can still be followed, and no CSS/JS asset
 * path is blocked. Sitemap URL points at the same host this request is served from.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  return buildRobots(await siteOrigin())
}
