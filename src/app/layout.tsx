import type { Metadata } from 'next'
import { IBM_Plex_Sans } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

// One typeface throughout. IBM Plex Sans has clear figures and a compact width, which suits
// dense tables of versions, model codes and counts.
const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'GameProbe', template: '%s · GameProbe' },
  description:
    'Android game controller compatibility: direct user tests and reviewed external reports for Wuthering Waves, Genshin Impact and Honkai: Star Rail.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const demo = process.env.SHOW_DEMO_DATA === 'true'
  return (
    <html lang="en" className={plex.variable}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href="/" className="site-name">
              GameProbe
            </Link>
            <form className="search-form" action="/search" role="search">
              <label htmlFor="site-search" className="visually-hidden">
                Search games, controllers or devices
              </label>
              <input
                id="site-search"
                type="search"
                name="q"
                placeholder="Search games, controllers or devices"
                autoComplete="off"
              />
              <button className="button secondary" type="submit">
                Search
              </button>
            </form>
            <nav className="site-nav" aria-label="Main">
              <Link href="/submit" className="button">
                Submit test
              </Link>
            </nav>
          </div>
        </header>
        {demo && (
          <p className="demo-notice">
            Showing development fixtures. Records marked “Demo fixture” are invented test data, not real reports.
          </p>
        )}
        {children}
        <footer className="site-footer">
          <Link href="/about">How this data works</Link>
          <a href="https://github.com/hyukvoid/GameProbe-Web">Source code</a>
        </footer>
      </body>
    </html>
  )
}
