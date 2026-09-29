/**
 * Game identification media: a small code-side metadata layer, deliberately not a database
 * column and not a migration.
 *
 * Two distinct asset roles that are never interchangeable:
 * - `logo`: the small identifier (licensed logo/wordmark or a GameProbe tile) shown in
 *   list rows and page headers (48px lists, 128px headers).
 * - `artwork`: the larger representative image shown only in the game-page header.
 * A logo is never treated as artwork: `gameArtworkPlan` reads only `artwork`, so a
 * wordmark can never be enlarged into a stand-in for game art.
 *
 * All 15 catalog games carry both roles, so no current game normally renders the
 * initials fallback; initials remain only as the runtime-failure fallback and as the
 * generic fallback for unknown future games.
 *
 * Asset kinds:
 * - `licensed-original`     official press/media-kit asset, used under the publisher's
 *                           own press/editorial terms (sourceUrl required).
 * - `licensed-third-party`  reusable identification asset from Wikimedia Commons with
 *                           an explicit reusable license on its file page (sourceUrl
 *                           required).
 * - `gameprobe-original`    original visual drawn for this project: abstract,
 *                           game-associated geometry only - no third-party game art,
 *                           characters, logos or screenshots. sourceUrl is intentionally
 *                           absent; the rightsNote states project ownership.
 *
 * Rights policy: only commit an image whose reuse basis is documented here, with the
 * access date recorded. A second rights pass re-checked every missing game; where
 * credible official/licensed sources were exhausted and rights stayed unclear, the
 * game received a GameProbe original instead of an ambiguous third-party file.
 */

/** Where an asset sits on the rights ladder; drives provenance and credit tests. */
export type MediaAssetKind = 'licensed-original' | 'licensed-third-party' | 'gameprobe-original'

/** One image with its own provenance; logo and artwork each carry their own record. */
export type MediaAsset = {
  /** Local public path (`/...`, never remote). Remote URLs are never hotlinked. */
  src: string
  /** Rights tier of this asset. */
  kind: MediaAssetKind
  /** Descriptive alt text for the asset itself. */
  alt: string
  /** The page the terms live on. Required for licensed kinds; absent for originals. */
  sourceUrl?: string
  /** Why this asset may be used, including the date it was checked (YYYY-MM-DD). */
  rightsNote: string
  /** Optional object-position for a conservative crop within the frame. */
  objectPosition?: string
}

export type GameMedia = {
  slug: string
  /** Small identification visual for list rows and page headers (48/128px). */
  logo: MediaAsset
  /** Large representative artwork for the game-page header only (never in lists). */
  artwork: MediaAsset
}

/** Provenance sentence for every GameProbe-owned original. */
const GAMEPROBE_RIGHTS =
  'Original visual created for GameProbe; no third-party game artwork, characters, logos or screenshots used.'

/** GameProbe tiles additionally record why no third-party logo was used. */
const GAMEPROBE_TILE_RIGHTS =
  GAMEPROBE_RIGHTS +
  ' Custom identification tile drawn for this project after a second rights review found no reusable third-party logo (2026-09-29).'

/**
 * All 15 catalog games, in catalog-name order. Every entry has both a logo and an
 * artwork. Licensed assets record where their terms live (`sourceUrl`) and why they may
 * be used (`rightsNote`); GameProbe originals record project ownership instead.
 */
export const GAME_MEDIA: readonly GameMedia[] = [
  {
    slug: 'alien-isolation',
    logo: {
      src: '/games/alien-isolation.webp',
      kind: 'licensed-third-party',
      alt: 'Alien: Isolation',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Alien_Isolation_Logo.svg',
      rightsNote:
        'Alien: Isolation logo by Jesmar on Wikimedia Commons, licensed CC BY-SA 3.0 (the file page also tags it PD-textlogo); cropped and resized for a square tile and credited on the About page. Accessed 2026-09-29.',
    },
    artwork: {
      src: '/games/alien-isolation/gameprobe-cover.webp',
      kind: 'gameprobe-original',
      alt: 'Alien: Isolation — GameProbe original visual',
      rightsNote: GAMEPROBE_RIGHTS,
    },
  },
  {
    slug: 'brawlhalla',
    logo: {
      src: '/games/brawlhalla.webp',
      kind: 'licensed-third-party',
      alt: 'Brawlhalla',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Brawlhalla_Logo.png',
      rightsNote:
        'Brawlhalla logo (author: Blue Mammoth Games) on Wikimedia Commons, licensed CC BY-SA 4.0; trimmed and resized for a square tile and credited on the About page. Accessed 2026-09-29.',
    },
    artwork: {
      src: '/games/brawlhalla/gameprobe-cover.webp',
      kind: 'gameprobe-original',
      alt: 'Brawlhalla — GameProbe original visual',
      rightsNote: GAMEPROBE_RIGHTS,
    },
  },
  {
    slug: 'call-of-duty-mobile',
    logo: {
      src: '/games/call-of-duty-mobile.webp',
      kind: 'licensed-third-party',
      alt: 'Call of Duty: Mobile',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Call_of_Duty_Mobile_2023_logo.svg',
      rightsNote:
        'Call of Duty: Mobile logo from Wikimedia Commons, public domain text logo (PD-textlogo: below the threshold of originality), traced from the official Call of Duty website; trademark of Activision, used only to identify the game. Accessed 2026-09-29.',
    },
    artwork: {
      src: '/games/call-of-duty-mobile/gameprobe-cover.webp',
      kind: 'gameprobe-original',
      alt: 'Call of Duty: Mobile — GameProbe original visual',
      rightsNote: GAMEPROBE_RIGHTS,
    },
  },
  {
    slug: 'dead-cells',
    logo: {
      src: '/games/dead-cells.webp',
      kind: 'licensed-original',
      alt: 'Dead Cells',
      sourceUrl: 'https://motiontwin.com/presskit/81',
      rightsNote:
        'Dead Cells logo from the "Logo & Icon" section of Motion Twin’s official press kit, published for press and media use; © Motion Twin, used only to identify the game. Accessed 2026-09-29.',
    },
    artwork: {
      src: '/games/dead-cells/artwork.webp',
      kind: 'licensed-original',
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
      kind: 'licensed-original',
      alt: 'Diablo Immortal',
      sourceUrl: 'https://blizzard.gamespress.com/Diablo-Immortal',
      rightsNote:
        'Diablo Immortal logo from Blizzard’s official press center (Games Press); the platform’s use-of-assets terms allow using its PR material to support editorial content relating to the product, with photo credits required. © Blizzard Entertainment, credited on the About page. Accessed 2026-09-29.',
    },
    artwork: {
      src: '/games/diablo-immortal/artwork.webp',
      kind: 'licensed-original',
      alt: 'Diablo Immortal official key art',
      sourceUrl: 'https://blizzard.gamespress.com/Diablo-Immortal-Launch-Press-Kit',
      rightsNote:
        'Diablo Immortal key art (Immortal_Key_Art.jpg) from the launch press kit on Blizzard’s official press center (Games Press); the platform’s use-of-assets terms allow using its PR material to support editorial content relating to the product, with photo credits required. Resized to 960×540 and stored locally. © Blizzard Entertainment, credited on the About page. Accessed 2026-09-29.',
    },
  },
  {
    slug: 'fortnite',
    logo: {
      src: '/games/fortnite.webp',
      kind: 'licensed-third-party',
      alt: 'Fortnite',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:FortniteLogo.svg',
      rightsNote:
        'Fortnite wordmark from Wikimedia Commons, public domain text logo (PD-textlogo: below the threshold of originality), traced from Epic Games’ own site; trademark of Epic Games, used only to identify the game (Epic’s fan-content policy restricts any other use). Accessed 2026-09-29.',
    },
    artwork: {
      src: '/games/fortnite/gameprobe-cover.webp',
      kind: 'gameprobe-original',
      alt: 'Fortnite — GameProbe original visual',
      rightsNote: GAMEPROBE_RIGHTS,
    },
  },
  {
    slug: 'genshin-impact',
    logo: {
      src: '/games/genshin-impact.webp',
      kind: 'licensed-third-party',
      alt: 'Genshin Impact',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Genshin_Impact_wordmark.svg',
      rightsNote:
        'Genshin Impact wordmark from Wikimedia Commons, public domain text logo (PD-textlogo: below the threshold of originality); trademark of miHoYo/HoYoverse, used only to identify the game. Accessed 2026-09-29.',
    },
    artwork: {
      src: '/games/genshin-impact/gameprobe-cover.webp',
      kind: 'gameprobe-original',
      alt: 'Genshin Impact — GameProbe original visual',
      rightsNote: GAMEPROBE_RIGHTS,
    },
  },
  {
    slug: 'grid-autosport',
    logo: {
      src: '/games/grid-autosport/gameprobe-tile.webp',
      kind: 'gameprobe-original',
      alt: 'GRID Autosport — GameProbe original tile',
      rightsNote: GAMEPROBE_TILE_RIGHTS,
    },
    artwork: {
      src: '/games/grid-autosport/gameprobe-cover.webp',
      kind: 'gameprobe-original',
      alt: 'GRID Autosport — GameProbe original visual',
      rightsNote: GAMEPROBE_RIGHTS,
    },
  },
  {
    slug: 'honkai-star-rail',
    logo: {
      src: '/games/honkai-star-rail/gameprobe-tile.webp',
      kind: 'gameprobe-original',
      alt: 'Honkai: Star Rail — GameProbe original tile',
      rightsNote: GAMEPROBE_TILE_RIGHTS,
    },
    artwork: {
      src: '/games/honkai-star-rail/gameprobe-cover.webp',
      kind: 'gameprobe-original',
      alt: 'Honkai: Star Rail — GameProbe original visual',
      rightsNote: GAMEPROBE_RIGHTS,
    },
  },
  {
    slug: 'minecraft',
    logo: {
      src: '/games/minecraft.webp',
      kind: 'licensed-third-party',
      alt: 'Minecraft',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Minecraft_Logo-en.svg',
      rightsNote:
        'Minecraft logo (author: Mojang Studios, taken from Mojang’s published brand assets) on Wikimedia Commons, public domain text logo (PD-textlogo: below the threshold of originality in Sweden); trademark of Mojang/Microsoft, used only to identify the game. Accessed 2026-09-29.',
    },
    artwork: {
      src: '/games/minecraft/gameprobe-cover.webp',
      kind: 'gameprobe-original',
      alt: 'Minecraft — GameProbe original visual',
      rightsNote: GAMEPROBE_RIGHTS,
    },
  },
  {
    slug: 'roblox',
    logo: {
      src: '/games/roblox.webp',
      kind: 'licensed-third-party',
      alt: 'Roblox',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Roblox_Logo_2022.svg',
      rightsNote:
        'Roblox wordmark (author: Roblox Corporation) from Wikimedia Commons, public domain text logo (PD-textlogo: below the threshold of originality); trademark of Roblox Corporation, used only to identify the game. Accessed 2026-09-29.',
    },
    artwork: {
      src: '/games/roblox/gameprobe-cover.webp',
      kind: 'gameprobe-original',
      alt: 'Roblox — GameProbe original visual',
      rightsNote: GAMEPROBE_RIGHTS,
    },
  },
  {
    slug: 'stardew-valley',
    logo: {
      src: '/games/stardew-valley/gameprobe-tile.webp',
      kind: 'gameprobe-original',
      alt: 'Stardew Valley — GameProbe original tile',
      rightsNote: GAMEPROBE_TILE_RIGHTS,
    },
    artwork: {
      src: '/games/stardew-valley/gameprobe-cover.webp',
      kind: 'gameprobe-original',
      alt: 'Stardew Valley — GameProbe original visual',
      rightsNote: GAMEPROBE_RIGHTS,
    },
  },
  {
    slug: 'terraria',
    logo: {
      src: '/games/terraria/gameprobe-tile.webp',
      kind: 'gameprobe-original',
      alt: 'Terraria — GameProbe original tile',
      rightsNote: GAMEPROBE_TILE_RIGHTS,
    },
    artwork: {
      src: '/games/terraria/gameprobe-cover.webp',
      kind: 'gameprobe-original',
      alt: 'Terraria — GameProbe original visual',
      rightsNote: GAMEPROBE_RIGHTS,
    },
  },
  {
    slug: 'wuthering-waves',
    logo: {
      src: '/games/wuthering-waves.webp',
      kind: 'licensed-third-party',
      alt: 'Wuthering Waves',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Wuthering_Waves_logo.svg',
      rightsNote:
        'Wuthering Waves logo from Wikimedia Commons, public domain text logo (PD-textlogo: below the threshold of originality); trademark of Kuro Games, used only to identify the game. Accessed 2026-09-29.',
    },
    artwork: {
      src: '/games/wuthering-waves/gameprobe-cover.webp',
      kind: 'gameprobe-original',
      alt: 'Wuthering Waves — GameProbe original visual',
      rightsNote: GAMEPROBE_RIGHTS,
    },
  },
  {
    slug: 'zenless-zone-zero',
    logo: {
      src: '/games/zenless-zone-zero.webp',
      kind: 'licensed-third-party',
      alt: 'Zenless Zone Zero',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Zenless_Zone_Zero_wordmark.svg',
      rightsNote:
        'Zenless Zone Zero wordmark from Wikimedia Commons, public domain text logo (PD-textlogo: below the threshold of originality); trademark of miHoYo/HoYoverse, used only to identify the game. Accessed 2026-09-29.',
    },
    artwork: {
      src: '/games/zenless-zone-zero/gameprobe-cover.webp',
      kind: 'gameprobe-original',
      alt: 'Zenless Zone Zero — GameProbe original visual',
      rightsNote: GAMEPROBE_RIGHTS,
    },
  },
]

const BY_SLUG = new Map(GAME_MEDIA.map((m) => [m.slug, m]))

/** Generic fallback for an unknown future game: empty paths route to the initials tile. */
function unknownMedia(slug: string): GameMedia {
  const generic: MediaAsset = {
    src: '',
    kind: 'gameprobe-original',
    alt: '',
    rightsNote: 'No catalog entry: the locally generated initials tile is rendered instead.',
  }
  return { slug, logo: generic, artwork: generic }
}

/**
 * Media for a slug. An unknown slug still returns a bare entry with empty paths, so a
 * missing entry can never break rendering: the small visual falls back to initials and
 * no artwork region is planned at all.
 */
export function gameMedia(slug: string): GameMedia {
  return BY_SLUG.get(slug) ?? unknownMedia(slug)
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
 * What to render for one game's small identifier. The image path is used only when the
 * entry carries a non-empty *local* path (`/...`); a missing path, an empty path, a
 * remote URL (never hotlink third-party servers) or unknown metadata all fall back to
 * the initials tile - the runtime-failure and unknown-game fallback, never the normal
 * state of a catalog game. Nothing here can produce a broken image element.
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
 * become fake key art. An empty path, a missing alt or a remote URL all yield null: the
 * caller then renders no artwork region at all (the header collapses to text) rather
 * than a placeholder hero.
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
