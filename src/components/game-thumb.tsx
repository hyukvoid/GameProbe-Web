import Image from 'next/image'
import { gameMedia, gameThumbPlan } from '@/lib/game-media'

// Small identification tile for a game: text stays primary everywhere it appears.
// Fixed square boxes at both sizes, so the row or header never shifts when media changes.

const BOX_PX = { list: 48, header: 128 } as const

export type GameThumbProps = {
  slug: string
  /** "list": 48px rows. "header": ~128px page title (96px on small screens). */
  size?: 'list' | 'header'
}

export function GameThumb({ slug, size = 'list' }: GameThumbProps) {
  const plan = gameThumbPlan(gameMedia(slug))
  const px = BOX_PX[size]
  const box = `game-thumb game-thumb-${size}`

  if (plan.kind === 'image') {
    // Rights-cleared image path: explicit dimensions and a fixed box, lazy in lists.
    return (
      <span className={box}>
        <Image src={plan.src} alt={plan.alt} width={px} height={px} className="game-thumb-img" />
      </span>
    )
  }

  // The placeholder sits next to the visible game name in every placement, so it is
  // decorative: announce nothing, avoid saying the name twice.
  return (
    <span className={box} data-game-thumb={slug} aria-hidden="true">
      <span className="game-thumb-initials">{plan.initials}</span>
    </span>
  )
}
