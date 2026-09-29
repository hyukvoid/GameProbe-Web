import Link from 'next/link'
import { DirectTestRecord } from '@/components/evidence'
import { GameThumb } from '@/components/game-thumb'
import { CombinationResult, CompatibilityByGame } from '@/components/search'
import { listGames, search } from '@/lib/data/public'
import { includeDemoData, requestDb } from '@/lib/db'
import { searchMetadata } from '@/lib/seo'

// Navigation for people, not a canonical landing page: noindex, but the result links
// stay followable. The index policy lives only in this metadata, never in the page body.
export const metadata = searchMetadata

type Props = { searchParams: Promise<{ q?: string | string[] }> }

export default async function SearchPage({ searchParams }: Props) {
  const raw = (await searchParams).q
  const q = (Array.isArray(raw) ? raw[0] : raw ?? '').trim().slice(0, 100)
  const sql = await requestDb()
  // Sequential, not Promise.all: the local development database serves every connection
  // from one Postgres session, so two queries in flight at once can receive each other's
  // rows. One request runs one query at a time.
  const results = await search(sql, q, includeDemoData())
  const games = await listGames(sql)
  const nothing =
    results.games.length === 0 && results.families.length === 0 && results.devices.length === 0

  return (
    <main id="main">
      <div className="page-head">
        <h1>{q ? <>Results for “{q}”</> : 'Search'}</h1>
        {!q && <p className="meta">Search by game, controller or device, for example “DualSense Genshin” or “SM-S931B”.</p>}
      </div>

      {q && nothing && (
        <div className="empty">
          <p>No games, controllers or devices match “{q}”.</p>
          <p>
            GameProbe covers {games.map((g, i) => (
              <span key={g.id}>
                {i > 0 && (i === games.length - 1 ? ' and ' : ', ')}
                <Link href={`/games/${g.slug}`}>{g.name}</Link>
              </span>
            ))}
            .
          </p>
        </div>
      )}

      {results.combinations.length > 0 && (
        <section className="first" aria-labelledby="combo-heading">
          <h2 id="combo-heading">Game and controller</h2>
          <ul className="records">
            {results.combinations.map((result) => (
              <CombinationResult key={`${result.game.id}-${result.family.id}`} result={result} />
            ))}
          </ul>
        </section>
      )}

      {results.games.length > 0 && (
        <section aria-labelledby="games-heading">
          <h2 id="games-heading">Games</h2>
          <ul className="records">
            {results.games.map((g) => (
              <li key={g.id} className="empty">
                <span className="thumb-line">
                  <GameThumb slug={g.slug} />
                  <Link href={`/games/${g.slug}`}>{g.name}</Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.controllerByGame.length > 0 && (
        <section aria-labelledby="controllers-heading">
          <h2 id="controllers-heading">Controllers</h2>
          <table className="stack">
            <thead>
              <tr>
                <th scope="col">Controller</th>
                <th scope="col">Models in catalog</th>
                <th scope="col">Compatibility by game</th>
              </tr>
            </thead>
            <tbody>
              {results.controllerByGame.map(({ family, rows }) => (
                <tr key={family.id}>
                  <td className="primary" data-label="Controller">
                    {family.name}
                  </td>
                  <td data-label="Models">{family.variants.map((v) => v.name).join(', ') || <span className="muted">None</span>}</td>
                  <td data-label="By game">
                    <CompatibilityByGame family={family} rows={rows} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {results.devices.length > 0 && (
        <section aria-labelledby="devices-heading">
          <h2 id="devices-heading">Direct tests on matching devices</h2>
          <ul className="records">
            {results.devices.map((t) => (
              <DirectTestRecord key={t.id} test={t} showGame />
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
