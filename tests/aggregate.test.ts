import { describe, expect, it } from 'vitest'
import { conditionDifferences, describeCounts, isIssue, needsVerification, summarizeControl, type EvidenceItem } from '@/lib/aggregate'

let n = 0
function item(partial: Partial<EvidenceItem>): EvidenceItem {
  return {
    kind: 'direct',
    control: 'triggers',
    result: 'works',
    origin: `o${n++}`,
    connection: null,
    gameVersion: null,
    variant: null,
    androidVersion: null,
    date: null,
    ...partial,
  }
}

describe('summarizeControl', () => {
  it('reports no data when nothing was observed', () => {
    const s = summarizeControl('menu', [item({ control: 'triggers' })])
    expect(s.state).toBe('no_data')
    expect(s.direct).toEqual({ works: 0, broken: 0 })
  })

  it('keeps disagreeing direct tests as conflicting and lists the differing conditions', () => {
    const s = summarizeControl('triggers', [
      item({ result: 'works', connection: 'usb', gameVersion: '2.8.1' }),
      item({ result: 'works', connection: 'usb', gameVersion: '2.8.1' }),
      item({ result: 'broken', connection: 'bluetooth', gameVersion: '2.8.1' }),
    ])
    expect(s.state).toBe('conflicting')
    expect(s.direct).toEqual({ works: 2, broken: 1 })
    expect(s.differences).toEqual([{ dimension: 'connection', works: ['USB cable'], broken: ['Bluetooth'] }])
    expect(isIssue(s)).toBe(true)
    // Listed once, as a known issue, rather than again under Needs verification.
    expect(needsVerification(s)).toBe(false)
  })

  it('shows unknown conditions as Unknown rather than dropping them', () => {
    const d = conditionDifferences([
      item({ result: 'works', connection: 'usb' }),
      item({ result: 'broken', connection: null }),
    ])
    expect(d[0]).toEqual({ dimension: 'connection', works: ['USB cable'], broken: ['Unknown'] })
  })

  it('reports no differing conditions when conflicting tests share the same setup', () => {
    const s = summarizeControl('triggers', [
      item({ result: 'works', connection: 'bluetooth' }),
      item({ result: 'broken', connection: 'bluetooth' }),
    ])
    expect(s.state).toBe('conflicting')
    expect(s.differences).toEqual([])
  })

  it('never lets external reports override direct tests, but flags the disagreement', () => {
    const s = summarizeControl('triggers', [
      item({ kind: 'direct', result: 'works' }),
      item({ kind: 'external', result: 'broken', origin: 'src-1' }),
    ])
    expect(s.state).toBe('works')
    expect(s.external).toEqual({ works: 0, broken: 1 })
    expect(s.externalDisagrees).toBe(true)
    expect(isIssue(s)).toBe(true)
  })

  it('uses a reported_* state when only external reports exist', () => {
    const only = summarizeControl('triggers', [item({ kind: 'external', result: 'broken' })])
    expect(only.state).toBe('reported_broken')
    expect(needsVerification(only)).toBe(true)
    const both = summarizeControl('triggers', [
      item({ kind: 'external', result: 'broken' }),
      item({ kind: 'external', result: 'works' }),
    ])
    expect(both.state).toBe('reported_conflicting')
  })

  it('counts one external source once even if it appears twice', () => {
    const s = summarizeControl('triggers', [
      item({ kind: 'external', result: 'broken', origin: 'same-source' }),
      item({ kind: 'external', result: 'broken', origin: 'same-source' }),
    ])
    expect(s.external.broken).toBe(1)
  })

  it('tracks the most recent date', () => {
    const s = summarizeControl('triggers', [item({ date: '2026-09-01' }), item({ date: '2026-09-24' }), item({})])
    expect(s.lastDate).toBe('2026-09-24')
  })
})

describe('describeCounts', () => {
  it('writes counts literally', () => {
    expect(describeCounts({ works: 0, broken: 0 }, 'direct')).toBe('No direct tests')
    expect(describeCounts({ works: 1, broken: 0 }, 'direct')).toBe('1 direct test: works')
    expect(describeCounts({ works: 2, broken: 1 }, 'direct')).toBe('3 direct tests: 2 works, 1 broken')
    expect(describeCounts({ works: 0, broken: 2 }, 'external')).toBe('2 external reports: broken')
  })
})
