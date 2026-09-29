'use client'

import Image from 'next/image'
import { useState } from 'react'
import { gameArtworkPlan, gameMedia } from '@/lib/game-media'

// One restrained representative image in the game-page header, beside the title block.
// Text stays primary: the artwork is a fixed 16:9 region (about 340px wide on desktop,
// capped on small screens), never a banner, hero, background, or text carrier.
//
// It renders only when a rights-cleared artwork asset exists. On a runtime failure the
// region removes itself entirely - the header collapses to the text-only layout instead
// of showing a broken icon, an oversized logo, or a fake hero tile.

export function GameArtwork({ slug }: { slug: string }) {
  const plan = gameArtworkPlan(gameMedia(slug))
  const [failed, setFailed] = useState(false)

  if (!plan || failed) return null

  return (
    <div className="game-artwork" data-game-artwork={slug}>
      <Image
        src={plan.src}
        alt={plan.alt}
        width={plan.width}
        height={plan.height}
        sizes="(max-width: 720px) calc(100vw - 40px), 340px"
        className="game-artwork-img"
        style={plan.objectPosition ? { objectPosition: plan.objectPosition } : undefined}
        priority
        onError={() => setFailed(true)}
      />
    </div>
  )
}
