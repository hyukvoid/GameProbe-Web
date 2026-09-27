import type { Metadata } from 'next'
import { listControllerCatalog, listGames, listKnownVersions } from '@/lib/data/public'
import { includeDemoData, requestDb } from '@/lib/db'
import { todayIso } from '@/lib/format'
import { SubmitForm } from './submit-form'

export const metadata: Metadata = { title: 'Submit test' }

type Props = { searchParams: Promise<{ game?: string; controller?: string }> }

export default async function SubmitPage({ searchParams }: Props) {
  const sql = await requestDb()
  const params = await searchParams
  const [games, families, versions] = await Promise.all([
    listGames(sql),
    listControllerCatalog(sql),
    listKnownVersions(sql, includeDemoData()),
  ])
  const game = games.find((g) => g.slug === params.game)?.slug ?? ''
  const family = families.find((f) => f.slug === params.controller)
  const controller = family ? `family:${family.id}` : ''

  return (
    <main id="main">
      <div className="page-head">
        <h1>Submit test</h1>
        <p className="meta">
          Record what happened when you played with a controller on Android. Fill in only what you know. Tests are
          published after review.
        </p>
      </div>
      <SubmitForm
        games={games.map(({ slug, name }) => ({ slug, name }))}
        families={families}
        versions={versions}
        defaults={{ game, controller }}
        today={todayIso()}
      />
    </main>
  )
}
