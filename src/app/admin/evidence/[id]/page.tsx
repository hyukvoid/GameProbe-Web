import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-session'
import { getEvidenceSource } from '@/lib/data/admin'
import { listControllerCatalog, listGames } from '@/lib/data/public'
import { requestDb } from '@/lib/db'
import { CONTROL_SHORT, REVIEW_STATUS_LABELS, SOURCE_TYPE_LABELS } from '@/lib/domain'
import { formatDate, formatDateTime } from '@/lib/format'
import { missingEvidenceFields } from '@/lib/validation'
import { review } from '../../actions'
import { ReviewForm } from './review-form'

export const metadata: Metadata = { title: 'Review source' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SAVED: Record<string, string> = {
  lead: 'Kept as a research lead. Nothing is public.',
  publish: 'Published as a limited external claim.',
  needs_direct_test: 'Listed publicly under Needs verification.',
  duplicate: 'Merged as a duplicate. It no longer counts as evidence.',
  reject: 'Rejected. Nothing is public.',
}

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }

export default async function ReviewPage({ params, searchParams }: Props) {
  await requireAdmin()
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const sql = await requestDb()
  const [source, games, families] = await Promise.all([getEvidenceSource(sql, id), listGames(sql), listControllerCatalog(sql)])
  if (!source) notFound()
  const saved = (await searchParams).saved
  const missing = missingEvidenceFields(source)

  return (
    <main id="main">
      <div className="page-head">
        <p className="crumbs">
          <Link href="/admin/evidence">Evidence Inbox</Link> / Review
        </p>
        <h1 className="break">{source.title ?? 'Untitled source'}</h1>
        <p className="meta break">
          <a href={source.url} rel="nofollow noopener noreferrer" target="_blank">
            {source.url}
          </a>
        </p>
        <p className="meta">
          {SOURCE_TYPE_LABELS[source.sourceType]} · Added {formatDateTime(source.addedAt)} · Status:{' '}
          <strong>{REVIEW_STATUS_LABELS[source.reviewStatus]}</strong>
          {source.reviewedAt && <> · Reviewed {formatDateTime(source.reviewedAt)}</>}
          {source.isDemo && ' · Demo fixture'}
        </p>
      </div>

      {saved && SAVED[saved] && (
        <p className="notice" role="status" style={{ marginBottom: 16 }}>
          Saved. {SAVED[saved]}
        </p>
      )}

      {source.duplicateOfId && (
        <p className="notice" style={{ marginBottom: 16 }}>
          Duplicate of <Link href={`/admin/evidence/${source.duplicateOfId}`}>{source.duplicateOfUrl}</Link>
        </p>
      )}

      {source.claims.length > 0 && (
        <p className="section-note" style={{ marginBottom: 16 }}>
          Current public claims:{' '}
          {source.claims.map((c) => `${CONTROL_SHORT[c.control]} ${c.result}`).join(', ')} (
          {source.claims[0].visibility === 'published' ? 'External reports' : 'Needs verification'})
        </p>
      )}

      {source.excerpt && (
        <section className="first" style={{ marginBottom: 20 }} aria-labelledby="excerpt-heading">
          <h2 id="excerpt-heading">Excerpt (private)</h2>
          <p className="quote" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
            {source.excerpt}
          </p>
          {source.publishedOn && <p className="small muted">Published {formatDate(source.publishedOn)}</p>}
        </section>
      )}

      <p className="small muted" style={{ marginBottom: 12 }}>
        Not stated yet: {missing.length ? missing.join(', ') : 'nothing'}
      </p>

      <ReviewForm action={review.bind(null, id)} source={source} games={games} families={families} />
    </main>
  )
}
