'use client'

import Image from 'next/image'
import { useState } from 'react'
import { gameInitials, gameMedia, gameThumbPlan } from '@/lib/game-media'

// Small identification tile for a game: text stays primary everywhere it appears.
// Fixed square boxes at both sizes, so the row or header never shifts when media changes.
//
// A rights-cleared image renders inside the same box. If that file ever fails to load
// (missing after deploy, optimizer error, malformed path), the tile underneath is restored
// instead of a broken-image icon - a placeholder is a finished state, not an error.

const BOX_PX = { list: 48, header: 128 } as const

export type GameThumbProps = {
  slug: string
  /** "list": 48px rows. "header": ~128px page title (96px on small screens). */
  size?: 'list' | 'header'
}

function Tile({ slug }: { slug: string }) {
  // The tile sits next to the visible game name in every placement, so it is
  // decorative: announce nothing, avoid saying the name twice.
  return <span className="game-thumb-initials">{gameInitials(slug)}</span>
}

export function GameThumb({ slug, size = 'list' }: GameThumbProps) {
  const media = gameMedia(slug)
  const plan = gameThumbPlan(media)
  const px = BOX_PX[size]
  const box = `game-thumb game-thumb-${size}`
  const [failed, setFailed] = useState(false)

  if (plan.kind === 'image' && !failed) {
    // Rights-cleared image path: explicit dimensions, stable square box, lazy in lists.
    // Decorative next to the visible game name, so the alt text stays empty.
    return (
      <span className={box} data-game-thumb={slug} data-thumb-kind="image" aria-hidden="true">
        <Image
          src={plan.src}
          alt=""
          width={px}
          height={px}
          sizes={`${px}px`}
          className="game-thumb-img"
          onError={() => setFailed(true)}
        />
      </span>
    )
  }

  return (
    <span className={box} data-game-thumb={slug} data-thumb-kind="tile" aria-hidden="true">
      <Tile slug={slug} />
    </span>
  )
}
