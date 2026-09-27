'use client'

import { useEffect } from 'react'

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <main id="main">
      <div className="page-head">
        <h1>This page could not be loaded</h1>
        <p className="meta">The server could not read the compatibility data. Try again in a moment.</p>
        {error.digest && <p className="small muted">Error reference: {error.digest}</p>}
      </div>
      <button className="button secondary" type="button" onClick={() => retry()}>
        Try again
      </button>
    </main>
  )
}
