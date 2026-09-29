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
 * All 15 catalog games, in catalog-name order. A game ships as `licensed-image` only when
 * a reuse basis was established (official press asset, or a Wikimedia Commons file page
 * with an explicit reusable license); everything else stays the placeholder tile. Every
 * real image records where it came from (`sourceUrl`) and why it may be used
 * (`rightsNote`), so the provenance lives next to the metadata it describes.
 */
export const GAME_MEDIA: readonly GameMedia[] = [
  {
    slug: 'alien-isolation',
    image: '/games/alien-isolation.webp',
    alt: 'Alien: Isolation',
    kind: 'licensed-image',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Alien_Isolation_Logo.svg',
    rightsNote:
      'Alien: Isolation logo by Jesmar on Wikimedia Commons, licensed CC BY-SA 3.0 (the file page also tags it PD-textlogo); cropped and resized for a square tile and credited on the About page. Accessed 2026-09-29.',
  },
  {
    slug: 'brawlhalla',
    image: '/games/brawlhalla.webp',
    alt: 'Brawlhalla',
    kind: 'licensed-image',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Brawlhalla_Logo.png',
    rightsNote:
      'Brawlhalla logo (author: Blue Mammoth Games) on Wikimedia Commons, licensed CC BY-SA 4.0; trimmed and resized for a square tile and credited on the About page. Accessed 2026-09-29.',
  },
  {
    slug: 'call-of-duty-mobile',
    image: '/games/call-of-duty-mobile.webp',
    alt: 'Call of Duty: Mobile',
    kind: 'licensed-image',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Call_of_Duty_Mobile_2023_logo.svg',
    rightsNote:
      'Call of Duty: Mobile logo from Wikimedia Commons, public domain text logo (PD-textlogo: below the threshold of originality), traced from the official Call of Duty website; trademark of Activision, used only to identify the game. Accessed 2026-09-29.',
  },
  {
    slug: 'dead-cells',
    image: '/games/dead-cells.webp',
    alt: 'Dead Cells',
    kind: 'licensed-image',
    sourceUrl: 'https://motiontwin.com/presskit/81',
    rightsNote:
      'Dead Cells logo from the "Logo & Icon" section of Motion Twin’s official press kit, published for press and media use; © Motion Twin, used only to identify the game. Accessed 2026-09-29.',
  },
  {
    slug: 'diablo-immortal',
    image: '/games/diablo-immortal.webp',
    alt: 'Diablo Immortal',
    kind: 'licensed-image',
    sourceUrl: 'https://blizzard.gamespress.com/Diablo-Immortal',
    rightsNote:
      'Diablo Immortal logo from Blizzard’s official press center (Games Press); the platform’s use-of-assets terms allow using its PR material to support editorial content relating to the product, with photo credits required. © Blizzard Entertainment, credited on the About page. Accessed 2026-09-29.',
  },
  {
    slug: 'fortnite',
    kind: 'placeholder',
    alt: '',
    rightsNote: PLACEHOLDER_RIGHTS,
  },
  {
    slug: 'genshin-impact',
    image: '/games/genshin-impact.webp',
    alt: 'Genshin Impact',
    kind: 'licensed-image',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Genshin_Impact_wordmark.svg',
    rightsNote:
      'Genshin Impact wordmark from Wikimedia Commons, public domain text logo (PD-textlogo: below the threshold of originality); trademark of miHoYo/HoYoverse, used only to identify the game. Accessed 2026-09-29.',
  },
  {
    slug: 'grid-autosport',
    kind: 'placeholder',
    alt: '',
    rightsNote: PLACEHOLDER_RIGHTS,
  },
  {
    slug: 'honkai-star-rail',
    kind: 'placeholder',
    alt: '',
    rightsNote: PLACEHOLDER_RIGHTS,
  },
  {
    slug: 'minecraft',
    image: '/games/minecraft.webp',
    alt: 'Minecraft',
    kind: 'licensed-image',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Minecraft_Logo-en.svg',
    rightsNote:
      'Minecraft logo (author: Mojang Studios, taken from Mojang’s published brand assets) on Wikimedia Commons, public domain text logo (PD-textlogo: below the threshold of originality in Sweden); trademark of Mojang/Microsoft, used only to identify the game. Accessed 2026-09-29.',
  },
  {
    slug: 'roblox',
    kind: 'placeholder',
    alt: '',
    rightsNote: PLACEHOLDER_RIGHTS,
  },
  {
    slug: 'stardew-valley',
    kind: 'placeholder',
    alt: '',
    rightsNote: PLACEHOLDER_RIGHTS,
  },
  {
    slug: 'terraria',
    kind: 'placeholder',
    alt: '',
    rightsNote: PLACEHOLDER_RIGHTS,
  },
  {
    slug: 'wuthering-waves',
    image: '/games/wuthering-waves.webp',
    alt: 'Wuthering Waves',
    kind: 'licensed-image',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Wuthering_Waves_logo.svg',
    rightsNote:
      'Wuthering Waves logo from Wikimedia Commons, public domain text logo (PD-textlogo: below the threshold of originality); trademark of Kuro Games, used only to identify the game. Accessed 2026-09-29.',
  },
  {
    slug: 'zenless-zone-zero',
    image: '/games/zenless-zone-zero.webp',
    alt: 'Zenless Zone Zero',
    kind: 'licensed-image',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Zenless_Zone_Zero_wordmark.svg',
    rightsNote:
      'Zenless Zone Zero wordmark from Wikimedia Commons, public domain text logo (PD-textlogo: below the threshold of originality); trademark of miHoYo/HoYoverse, used only to identify the game. Accessed 2026-09-29.',
  },
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
 * image with a non-empty *local* path (`/...`); a missing path, an empty path, a remote
 * URL (never hotlink third-party servers) or unknown metadata all fall back to the
 * placeholder tile. Nothing here can produce a broken image element.
 */
export function gameThumbPlan(media: GameMedia): GameThumbPlan {
  const local = media.image?.startsWith('/') && !media.image.startsWith('//')
  if (media.kind === 'licensed-image' && media.image && local) {
    return { kind: 'image', src: media.image, alt: media.alt }
  }
  return { kind: 'tile', initials: gameInitials(media.slug) }
}
