import Link from 'next/link'

export default function NotFound() {
  return (
    <main id="main">
      <div className="page-head">
        <h1>Page not found</h1>
        <p className="meta">
          GameProbe covers <Link href="/games/wuthering-waves">Wuthering Waves</Link>,{' '}
          <Link href="/games/genshin-impact">Genshin Impact</Link> and{' '}
          <Link href="/games/honkai-star-rail">Honkai: Star Rail</Link>.
        </p>
      </div>
    </main>
  )
}
