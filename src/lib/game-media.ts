/**
 * Game identification media: a small code-side metadata layer, deliberately not a database
 * column and not a migration.
 *
 * Rights policy: only commit an image whose reuse basis is documented here (press/media
 * kit asset, explicit license, or an asset this project owns). Everything else uses the
 * locally generated placeholder tile below - game initials on a neutral background, no
 * copied logos, characters or artwork. A placeholder is a finished state, not an error.
 */

export type GameMedia = {
  slug: string
  /** Public path of a rights-cleared image. Absent: render the placeholder tile. */
  image?: string
  alt: string
  kind: 'licensed-image' | 'placeholder'
  /** Where the image and its reuse basis come from. Required alongside `image`. */
  sourceUrl?: string
  rightsNote?: string
}

/** Provenance shared by every placeholder tile; kept next to the metadata it describes. */
const PLACEHOLDER_RIGHTS =
  'Locally generated placeholder tile (game initials on a neutral background), created for this project. ' +
  'No third-party artwork, logos or store thumbnails are used.'

/**
 * All 15 catalog games, in catalog-name order. No game has a rights-cleared image yet,
 * so every entry ships as the placeholder tile; add `image` plus `sourceUrl`/`rightsNote`
 * only when the reuse basis is clear.
 */
export const GAME_MEDIA: readonly GameMedia[] = [
  { slug: 'alien-isolation', kind: 'placeholder', alt: '', rightsNote: PLACEHOLDER_RIGHTS },
  { slug: 'brawlhalla', kind: 'placeholder', alt: '', rightsNote: PLACEHOLDER_RIGHTS },
  { slug: 'call-of-duty-mobile', kind: 'placeholder', alt: '', rightsNote: PLACEHOLDER_RIGHTS },
  { slug: 'dead-cells', kind: 'placeholder', alt: '', rightsNote: PLACEHOLDER_RIGHTS },
  { slug: 'diablo-immortal', kind: 'placeholder', alt: '', rightsNote: PLACEHOLDER_RIGHTS },
  { slug: 'fortnite', kind: 'placeholder', alt: '', rightsNote: PLACEHOLDER_RIGHTS },
  { slug: 'genshin-impact', kind: 'placeholder', alt: '', rightsNote: PLACEHOLDER_RIGHTS },
  { slug: 'grid-autosport', kind: 'placeholder', alt: '', rightsNote: PLACEHOLDER_RIGHTS },
  { slug: 'honkai-star-rail', kind: 'placeholder', alt: '', rightsNote: PLACEHOLDER_RIGHTS },
  { slug: 'minecraft', kind: 'placeholder', alt: '', rightsNote: PLACEHOLDER_RIGHTS },
  { slug: 'roblox', kind: 'placeholder', alt: '', rightsNote: PLACEHOLDER_RIGHTS },
  { slug: 'stardew-valley', kind: 'placeholder', alt: '', rightsNote: PLACEHOLDER_RIGHTS },
  { slug: 'terraria', kind: 'placeholder', alt: '', rightsNote: PLACEHOLDER_RIGHTS },
  { slug: 'wuthering-waves', kind: 'placeholder', alt: '', rightsNote: PLACEHOLDER_RIGHTS },
  { slug: 'zenless-zone-zero', kind: 'placeholder', alt: '', rightsNote: PLACEHOLDER_RIGHTS },
]

const BY_SLUG = new Map(GAME_MEDIA.map((m) => [m.slug, m]))

/**
 * Media for a slug. An unknown slug still returns a placeholder, so a missing entry or a
 * missing asset can never break rendering.
 */
export function gameMedia(slug: string): GameMedia {
  return BY_SLUG.get(slug) ?? { slug, kind: 'placeholder', alt: '' }
}

/** Up to three letters from the slug's words; short filler words ("of") are skipped. */
export function gameInitials(slug: string): string {
  const words = slug.split(/[^a-z0-9]+/).filter(Boolean)
  const letters = words.filter((w) => w.length > 2).map((w) => w[0].toUpperCase())
  const picked = (letters.length > 0 ? letters : words.map((w) => w[0]?.toUpperCase() ?? '?')).slice(0, 3)
  const joined = picked.join('')
  // One letter (e.g. "fortnite" -> F) reads as a stray character; take a second letter.
  if (joined.length === 1 && words[0]) return `${joined}${words[0][1]?.toUpperCase() ?? ''}`
  return joined
}

export type GameThumbPlan =
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'tile'; initials: string }

/**
 * What to render for one game. An image is used only when the media entry is a licensed
 * image with a non-empty path; a missing path, an empty path or unknown metadata all fall
 * back to the placeholder tile. Nothing here can produce a broken image element.
 */
export function gameThumbPlan(media: GameMedia): GameThumbPlan {
  if (media.kind === 'licensed-image' && media.image) {
    return { kind: 'image', src: media.image, alt: media.alt }
  }
  return { kind: 'tile', initials: gameInitials(media.slug) }
}
