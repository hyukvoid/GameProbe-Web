/**
 * Game identification media: a small code-side metadata layer, deliberately not a database
 * column and not a migration.
 *
 * Two distinct asset roles that are never interchangeable:
 * - `logo`: the small identifier (wordmark/logo) shown in list rows and page headers.
 * - `artwork`: one larger representative image shown only in the game-page header.
 * A logo is never treated as artwork: `gameArtworkPlan` reads only `artwork`, so a
 * wordmark can never be enlarged into a stand-in for game art.
 *
 * Rights policy: only commit an image whose reuse basis is documented here (press/media
 * kit asset, explicit license, or an asset this project owns). Everything else uses the
 * locally generated placeholder tile below - game initials on a neutral background, no
 * copied logos, characters or artwork. A placeholder is a finished state, not an error.
 */

/** One rights-cleared image with its own provenance; logo and artwork each carry their own. */
export type MediaAsset = {
  /** Local public path (`/...`, never remote). Remote URLs are never hotlinked. */
  src: string
  /** Descriptive alt text for the asset itself. */
  alt: string
  /** The page the asset was taken from and where its reuse basis is stated. */
  sourceUrl: string
  /** Why this asset may be used, including the date it was checked (YYYY-MM-DD). */
  rightsNote: string
  /** Optional object-position for a conservative crop within the frame. */
  objectPosition?: string
}

export type GameMedia = {
  slug: string
  /** Small identification logo/wordmark for list rows and page headers (48/128px). */
  logo?: MediaAsset
  /** Large representative artwork for the game-page header only (never in lists). */
  artwork?: MediaAsset
  /**
   * Present when no logo asset exists: records why no third-party image is used and
   * that the locally generated initials tile is rendered instead.
   */
  placeholderNote?: string
}

/** Provenance for every placeholder tile; kept next to the metadata it describes. */
const PLACEHOLDER_RIGHTS =
  'Locally generated placeholder tile (game initials on a neutral background), created for this project. ' +
  'No third-party artwork, logos or store thumbnails are used.'

/**
 * All 15 catalog games, in catalog-name order. A game has a `logo` only when a reuse
 * basis was established (official press asset, or a Wikimedia Commons file page with an
 * explicit reusable license); everything else keeps the placeholder tile. Every real
 * asset records where it came from (`sourceUrl`) and why it may be used (`rightsNote`).
 */
export const GAME_MEDIA: readonly GameMedia[] = [
  {
    slug: 'alien-isolation',
    logo: {
      src: '/games/alien-isolation.webp',
      alt: 'Alien: Isolation',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Alien_Isolation_Logo.svg',
      rightsNote:
        'Alien: Isolation logo by Jesmar on Wikimedia Commons, licensed CC BY-SA 3.0 (the file page also tags it PD-textlogo); cropped and resized for a square tile and credited on the About page. Accessed 2026-09-29.',
    },
  },
  {
    slug: 'brawlhalla',
    logo: {
      src: '/games/brawlhalla.webp',
      alt: 'Brawlhalla',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Brawlhalla_Logo.png',
      rightsNote:
        'Brawlhalla logo (author: Blue Mammoth Games) on Wikimedia Commons, licensed CC BY-SA 4.0; trimmed and resized for a square tile and credited on the About page. Accessed 2026-09-29.',
    },
  },
  {
    slug: 'call-of-duty-mobile',
    logo: {
      src: '/games/call-of-duty-mobile.webp',
      alt: 'Call of Duty: Mobile',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Call_of_Duty_Mobile_2023_logo.svg',
      rightsNote:
        'Call of Duty: Mobile logo from Wikimedia Commons, public domain text logo (PD-textlogo: below the threshold of originality), traced from the official Call of Duty website; trademark of Activision, used only to identify the game. Accessed 2026-09-29.',
    },
  },
  {
    slug: 'dead-cells',
    logo: {
      src: '/games/dead-cells.webp',
      alt: 'Dead Cells',
      sourceUrl: 'https://motiontwin.com/presskit/81',
      rightsNote:
        'Dead Cells logo from the "Logo & Icon" section of Motion Twin’s official press kit, published for press and media use; © Motion Twin, used only to identify the game. Accessed 2026-09-29.',
    },
    artwork: {
      src: '/games/dead-cells/artwork.webp',
      alt: 'Dead Cells official key art',
      sourceUrl: 'https://motiontwin.com/presskit/81',
      rightsNote:
        'Dead Cells master key art from the Images section of Motion Twin’s official press kit, which is published for press use (the kit invites journalists to take original material and offers the key art source files); resized to 960×540 and stored locally. © Motion Twin, credited on the About page. Accessed 2026-09-29.',
    },
  },
  {
    slug: 'diablo-immortal',
    logo: {
      src: '/games/diablo-immortal.webp',
      alt: 'Diablo Immortal',
      sourceUrl: 'https://blizzard.gamespress.com/Diablo-Immortal',
      rightsNote:
        'Diablo Immortal logo from Blizzard’s official press center (Games Press); the platform’s use-of-assets terms allow using its PR material to support editorial content relating to the product, with photo credits required. © Blizzard Entertainment, credited on the About page. Accessed 2026-09-29.',
    },
    artwork: {
      src: '/games/diablo-immortal/artwork.webp',
      alt: 'Diablo Immortal official key art',
      sourceUrl: 'https://blizzard.gamespress.com/Diablo-Immortal-Launch-Press-Kit',
      rightsNote:
        'Diablo Immortal key art (Immortal_Key_Art.jpg) from the launch press kit on Blizzard’s official press center (Games Press); the platform’s use-of-assets terms allow using its PR material to support editorial content relating to the product, with photo credits required. Resized to 960×540 and stored locally. © Blizzard Entertainment, credited on the About page. Accessed 2026-09-29.',
    },
  },
  {
    slug: 'fortnite',
    placeholderNote: PLACEHOLDER_RIGHTS,
  },
  {
    slug: 'genshin-impact',
    logo: {
      src: '/games/genshin-impact.webp',
      alt: 'Genshin Impact',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Genshin_Impact_wordmark.svg',
      rightsNote:
        'Genshin Impact wordmark from Wikimedia Commons, public domain text logo (PD-textlogo: below the threshold of originality); trademark of miHoYo/HoYoverse, used only to identify the game. Accessed 2026-09-29.',
    },
  },
  {
    slug: 'grid-autosport',
    placeholderNote: PLACEHOLDER_RIGHTS,
  },
  {
    slug: 'honkai-star-rail',
    placeholderNote: PLACEHOLDER_RIGHTS,
  },
  {
    slug: 'minecraft',
    logo: {
      src: '/games/minecraft.webp',
      alt: 'Minecraft',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Minecraft_Logo-en.svg',
      rightsNote:
        'Minecraft logo (author: Mojang Studios, taken from Mojang’s published brand assets) on Wikimedia Commons, public domain text logo (PD-textlogo: below the threshold of originality in Sweden); trademark of Mojang/Microsoft, used only to identify the game. Accessed 2026-09-29.',
    },
  },
  {
    slug: 'roblox',
    placeholderNote: PLACEHOLDER_RIGHTS,
  },
  {
    slug: 'stardew-valley',
    placeholderNote: PLACEHOLDER_RIGHTS,
  },
  {
    slug: 'terraria',
    placeholderNote: PLACEHOLDER_RIGHTS,
  },
  {
    slug: 'wuthering-waves',
    logo: {
      src: '/games/wuthering-waves.webp',
      alt: 'Wuthering Waves',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Wuthering_Waves_logo.svg',
      rightsNote:
        'Wuthering Waves logo from Wikimedia Commons, public domain text logo (PD-textlogo: below the threshold of originality); trademark of Kuro Games, used only to identify the game. Accessed 2026-09-29.',
    },
  },
  {
    slug: 'zenless-zone-zero',
    logo: {
      src: '/games/zenless-zone-zero.webp',
      alt: 'Zenless Zone Zero',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Zenless_Zone_Zero_wordmark.svg',
      rightsNote:
        'Zenless Zone Zero wordmark from Wikimedia Commons, public domain text logo (PD-textlogo: below the threshold of originality); trademark of miHoYo/HoYoverse, used only to identify the game. Accessed 2026-09-29.',
    },
  },
]

const BY_SLUG = new Map(GAME_MEDIA.map((m) => [m.slug, m]))

/**
 * Media for a slug. An unknown slug still returns a bare entry, so a missing entry or a
 * missing asset can never break rendering.
 */
export function gameMedia(slug: string): GameMedia {
  return BY_SLUG.get(slug) ?? { slug }
}

/** Only a single-slash path may be rendered: remote URLs are never hotlinked. */
function isLocalPath(src?: string): src is string {
  return !!src && src.startsWith('/') && !src.startsWith('//')
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
 * What to render for one game's small identifier. A logo image is used only when the
 * entry carries a non-empty *local* path (`/...`); a missing path, an empty path, a remote
 * URL (never hotlink third-party servers) or unknown metadata all fall back to the
 * placeholder tile. Nothing here can produce a broken image element.
 */
export function gameThumbPlan(media: GameMedia): GameThumbPlan {
  if (media.logo && isLocalPath(media.logo.src)) {
    return { kind: 'image', src: media.logo.src, alt: media.logo.alt }
  }
  return { kind: 'tile', initials: gameInitials(media.slug) }
}

/** Fixed pixel size of every artwork file; kept next to the assets that use it. */
export const ARTWORK_WIDTH = 960
export const ARTWORK_HEIGHT = 540

export type GameArtworkPlan = {
  src: string
  alt: string
  width: number
  height: number
  objectPosition?: string
}

/**
 * Large artwork for the game-page header, or null when there is none. Artwork is read
 * only from `media.artwork` - never inferred from the logo path - so a wordmark cannot
 * become fake key art. Missing metadata, an empty path, a missing alt or a remote URL
 * all yield null: the caller then renders no artwork region at all (the header collapses
 * to text) rather than a placeholder hero.
 */
export function gameArtworkPlan(media: GameMedia): GameArtworkPlan | null {
  const art = media.artwork
  if (!art || !isLocalPath(art.src) || !art.alt) return null
  return {
    src: art.src,
    alt: art.alt,
    width: ARTWORK_WIDTH,
    height: ARTWORK_HEIGHT,
    objectPosition: art.objectPosition,
  }
}
