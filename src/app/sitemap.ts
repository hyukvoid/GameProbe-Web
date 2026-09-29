import type { MetadataRoute } from 'next'
import { includeDemoData, requestDb } from '@/lib/db'
import { buildSitemap, indexabilityOverview } from '@/lib/seo'
import { siteOrigin } from '@/lib/site'

/**
 * Indexable pages only: homepage, methodology, games with reviewed data and Game x
 * Controller pairs whose own evidence passes the indexability rule. One aggregate pair of
 * queries per request, sequential like every other reader here.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sql = await requestDb()
  const origin = await siteOrigin()
  const overview = await indexabilityOverview(sql, includeDemoData())
  return buildSitemap(overview, origin)
}
