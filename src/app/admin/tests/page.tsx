import type { Metadata } from 'next'
import Link from 'next/link'
import { ControllerSelect } from '@/components/controller-select'
import { DirectTestRecord } from '@/components/evidence'
import { requireAdmin } from '@/lib/admin-session'
import { listTestsByStatus } from '@/lib/data/admin'
import { listControllerCatalog } from '@/lib/data/public'
import { requestDb } from '@/lib/db'
import { TEST_STATUSES, type TestStatus } from '@/lib/domain'
import { formatDateTime } from '@/lib/format'
import { moderate } from '../actions'

export const metadata: Metadata = { title: 'Direct tests' }

const LABELS: Record<TestStatus, string> = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }

type Props = { searchParams: Promise<{ status?: string }> }

export default async function TestsPage({ searchParams }: Props) {
  await requireAdmin()
  const requested = (await searchParams).status
  const status: TestStatus = (TEST_STATUSES as readonly string[]).includes(requested ?? '')
    ? (requested as TestStatus)
    : 'pending'
  const sql = await requestDb()
  const [tests, families] = await Promise.all([listTestsByStatus(sql, status), listControllerCatalog(sql)])

  return (
    <main id="main">
      <div className="page-head">
        <h1>Direct tests</h1>
        <p className="meta">Nothing submitted here is public until it is approved.</p>
      </div>
      <nav className="tabs" aria-label="Filter by status">
        {TEST_STATUSES.map((s) => (
          <Link key={s} href={`/admin/tests?status=${s}`} aria-current={s === status ? 'page' : undefined}>
            {LABELS[s]}
          </Link>
        ))}
      </nav>

      {tests.length === 0 ? (
        <div className="empty">
          <p>No {LABELS[status].toLowerCase()} tests.</p>
        </div>
      ) : (
        <ul className="records">
          {tests.map((t) => {
            const current = t.variantName
              ? families.flatMap((f) => f.variants.map((v) => ({ v, f }))).find((x) => x.v.name === t.variantName)
              : undefined
            const family = families.find((f) => f.slug === t.familySlug)
            const controllerValue = current ? `variant:${current.v.id}` : family ? `family:${family.id}` : ''
            return (
              <li key={t.id}>
                <ul className="records">
                  <DirectTestRecord test={t} showGame />
                </ul>
                <form action={moderate} className="moderation">
                  <p className="small muted">
                    Submitted {formatDateTime(t.submittedAt)}
                    {t.reviewedAt && <> · Reviewed {formatDateTime(t.reviewedAt)}</>}
                    {t.moderationNote && <> · Note: {t.moderationNote}</>}
                  </p>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="back" value={status} />
                  <div className="field-row">
                    <div className="field">
                      <label htmlFor={`controller-${t.id}`}>Controller in catalog</label>
                      <ControllerSelect
                        id={`controller-${t.id}`}
                        name="controller"
                        families={families}
                        defaultValue={controllerValue}
                        emptyLabel={t.controllerAsEntered ? `Keep as entered: “${t.controllerAsEntered}”` : 'Unchanged'}
                      />
                      <p className="hint">Only link a model if the submission clearly names it.</p>
                    </div>
                    <div className="field">
                      <label htmlFor={`note-${t.id}`}>Moderation note (private)</label>
                      <input id={`note-${t.id}`} name="note" type="text" maxLength={1000} defaultValue={t.moderationNote ?? ''} />
                    </div>
                  </div>
                  <div className="moderation-actions">
                    {t.status !== 'approved' && (
                      <button className="button" type="submit" name="decision" value="approve">
                        Approve
                      </button>
                    )}
                    {t.status !== 'rejected' && (
                      <button className="button danger" type="submit" name="decision" value="reject">
                        Reject
                      </button>
                    )}
                  </div>
                </form>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
