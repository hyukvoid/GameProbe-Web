import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CombinationResult, CompatibilityByGame } from '@/components/search'
import type { CombinationEvidenceStatus, CombinationSearchResult, ControllerFamily, Game } from '@/lib/data/public'

// Search reports evidence availability, never a compatibility verdict: no "Compatible",
// no "Verified", no scores. The combination page owns the actual answer.

const GENSHIN: Game = { id: 'game-genshin', slug: 'genshin-impact', name: 'Genshin Impact', aliases: ['Genshin'] }
const WUTHERING: Game = { id: 'game-wuthering', slug: 'wuthering-waves', name: 'Wuthering Waves', aliases: ['WuWa'] }
const HONKAI: Game = { id: 'game-honkai', slug: 'honkai-star-rail', name: 'Honkai: Star Rail', aliases: [] }

const DUALSENSE: ControllerFamily = {
  id: 'family-dualsense',
  slug: 'sony-dualsense',
  manufacturer: 'Sony',
  name: 'DualSense',
  variants: [],
}

function result(
  status: CombinationEvidenceStatus,
  game: Game = GENSHIN,
  patch: Partial<CombinationSearchResult> = {},
): CombinationSearchResult {
  return {
    game,
    family: DUALSENSE,
    status,
    directTests: 0,
    published: { officialSources: 0, otherSources: 0 },
    verificationSources: 0,
    gameWideContext: { publishedSources: 0, verificationSources: 0 },
    lastControllerEvidenceDate: null,
    ...patch,
  }
}

const FORBIDDEN = /Compatible|Unsupported|Verified|Confirmed compatible|Proven|Trust score|Confidence|Likely compatible/i

describe('combination result markup', () => {
  it('16. evidence-backed combination says "Compatibility evidence available"', () => {
    const html = renderToStaticMarkup(
      <CombinationResult
        result={result('evidence_available', GENSHIN, {
          published: { officialSources: 1, otherSources: 1 },
          lastControllerEvidenceDate: '2025-09-17',
        })}
      />,
    )
    expect(html).toContain('DualSense in Genshin Impact')
    expect(html).toContain('Compatibility evidence available')
    expect(html).toContain('Direct tests: 0')
    expect(html).toContain('Official sources: 1')
    expect(html).toContain('Other reviewed sources: 1')
    expect(html).toContain('Last evidence: Sep 17, 2025')
    expect(html).toContain('Open compatibility')
    expect(html).toContain('href="/games/genshin-impact/sony-dualsense"')
    expect(html).not.toContain('No controller-specific evidence')
    expect(html).not.toMatch(FORBIDDEN)
  })

  it('17. empty combination visibly says "No controller-specific evidence"', () => {
    const html = renderToStaticMarkup(<CombinationResult result={result('no_controller_evidence', WUTHERING)} />)
    expect(html).toContain('DualSense in Wuthering Waves')
    expect(html).toContain('No controller-specific evidence')
    expect(html).not.toContain('Compatibility evidence available')
    expect(html).not.toMatch(FORBIDDEN)
    // The combination stays reachable.
    expect(html).toContain('href="/games/wuthering-waves/sony-dualsense"')
  })

  it('18. needs-verification-only combination says "Needs verification"', () => {
    const html = renderToStaticMarkup(
      <CombinationResult result={result('needs_verification', HONKAI, { verificationSources: 1 })} />,
    )
    expect(html).toContain('Needs verification')
    expect(html).toContain('1 reviewed report needs a direct test')
    expect(html).toContain('Direct tests: 0')
    expect(html).not.toContain('Compatibility evidence available')
    expect(html).not.toMatch(FORBIDDEN)
  })

  it('18b. the verification line is plural when several reports wait', () => {
    const html = renderToStaticMarkup(
      <CombinationResult result={result('needs_verification', HONKAI, { verificationSources: 2 })} />,
    )
    expect(html).toContain('2 reviewed reports need a direct test')
  })

  it('19. game-wide-only context never renders as compatibility evidence', () => {
    const html = renderToStaticMarkup(
      <CombinationResult
        result={result('no_controller_evidence', WUTHERING, {
          gameWideContext: { publishedSources: 1, verificationSources: 1 },
        })}
      />,
    )
    expect(html).toContain('No controller-specific evidence')
    expect(html).toContain('Game-wide report exists; controller not specified')
    expect(html).not.toContain('Compatibility evidence available')
    expect(html).not.toContain('Official sources')
    expect(html).not.toContain('Direct tests:')
    expect(html).not.toMatch(FORBIDDEN)
  })

  it('19b. no game-wide line when the game has no controller-unspecified report', () => {
    const html = renderToStaticMarkup(<CombinationResult result={result('no_controller_evidence', WUTHERING)} />)
    expect(html).not.toContain('Game-wide report exists')
  })
})

describe('controller "Compatibility by game" markup', () => {
  const html = renderToStaticMarkup(
    <CompatibilityByGame
      family={DUALSENSE}
      rows={[
        { game: GENSHIN, status: 'evidence_available' },
        { game: WUTHERING, status: 'no_controller_evidence' },
        { game: HONKAI, status: 'needs_verification' },
      ]}
    />,
  )

  it('20. every game keeps its link and shows its own status', () => {
    expect(html).toContain('href="/games/genshin-impact/sony-dualsense"')
    expect(html).toContain('href="/games/wuthering-waves/sony-dualsense"')
    expect(html).toContain('href="/games/honkai-star-rail/sony-dualsense"')
    expect(html).toContain('Genshin Impact')
    expect(html.indexOf('Compatibility evidence available')).toBeLessThan(html.indexOf('No controller-specific evidence'))
    expect(html).toContain('No controller-specific evidence')
    expect(html).toContain('Needs verification')
    expect(html).not.toMatch(FORBIDDEN)
  })

  it('20b. one status line per game, so coverage is not implied to be equal', () => {
    expect(html.match(/Compatibility evidence available/g)).toHaveLength(1)
    expect(html.match(/No controller-specific evidence/g)).toHaveLength(1)
    expect(html.match(/Needs verification/g)).toHaveLength(1)
  })
})
