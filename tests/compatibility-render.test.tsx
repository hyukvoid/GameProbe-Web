import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ConnectionCompatibility, PhysicalControls } from '@/components/compatibility'
import { deriveCompatibility, type ClaimInput } from '@/lib/compatibility'

const FAMILY = 'family-dualsense'

function claim(p: Partial<ClaimInput>): ClaimInput {
  return {
    sourceId: 'source',
    sourceType: 'article',
    url: 'https://example.org/source',
    title: null,
    familyId: FAMILY,
    variantName: null,
    controllerAsWritten: null,
    connection: null,
    controllerMode: null,
    androidVersion: null,
    gameVersion: null,
    date: '2026-09-01',
    control: 'controller_support',
    result: 'works',
    statement: 'Stated.',
    isDemo: false,
    ...p,
  }
}

/** The markup of one connection record. */
function record(html: string, connection: string): string {
  const start = html.indexOf(`data-connection="${connection}"`)
  if (start < 0) throw new Error(`no ${connection} record`)
  const end = html.indexOf('data-connection=', start + 20)
  return html.slice(start, end < 0 ? undefined : end)
}

describe('ConnectionCompatibility markup', () => {
  const answer = deriveCompatibility({
    familyId: FAMILY,
    directTests: [],
    claims: [
      claim({
        sourceId: 'hoyoverse',
        sourceType: 'official',
        url: 'https://support.hoyoverse.com/controllers',
        controllerAsWritten: 'DualSense Wireless Controller',
        connection: 'bluetooth',
        androidVersion: '12.0',
        statement: 'Listed under “Android (via Bluetooth)” as supported, Android 12.0+.',
      }),
      claim({
        sourceId: 'androidpolice',
        url: 'https://www.androidpolice.com/genshin',
        familyId: null,
        connection: 'usb',
        statement: 'Bluetooth and USB connections are supported.',
      }),
      claim({ sourceId: 'game8', url: 'https://game8.co/genshin', connection: null, androidVersion: '12.0' }),
    ],
  })
  const html = renderToStaticMarkup(<ConnectionCompatibility answer={answer} familyName="DualSense" />)

  it('answers Bluetooth from the official, controller-specific source', () => {
    const bt = record(html, 'bluetooth')
    expect(bt).toContain('Officially reported supported')
    expect(bt).toContain('“DualSense Wireless Controller” as written')
    expect(bt).toContain('Android 12.0')
    expect(bt).toContain('Game version not stated')
    expect(bt).not.toContain('game8.co')
  })

  it('does not call USB supported because of a report that names no controller', () => {
    const usb = record(html, 'usb')
    expect(usb).toContain('No controller-specific evidence')
    expect(usb).not.toContain('Officially reported supported')
    expect(usb).not.toContain('Reported working')
    expect(usb).toContain('Controller not specified')
    expect(usb).toContain('not counted for DualSense')
  })

  it('keeps Dongle unknown and lists the connection-less report separately', () => {
    expect(record(html, 'dongle')).toContain('No controller-specific evidence')
    const unstated = record(html, 'not-stated')
    expect(unstated).toContain('Connection not stated')
    expect(unstated).toContain('game8.co')
  })
})

describe('development fixtures in the summary', () => {
  it('label fixture evidence, and only fixture evidence, as demo', () => {
    const answer = deriveCompatibility({
      familyId: FAMILY,
      directTests: [],
      claims: [
        claim({ sourceId: 'fixture', connection: 'bluetooth', isDemo: true }),
        claim({ sourceId: 'real', url: 'https://example.net/real', connection: 'usb' }),
      ],
    })
    expect(answer.connections.find((c) => c.connection === 'bluetooth')?.evidence[0].isDemo).toBe(true)
    const html = renderToStaticMarkup(<ConnectionCompatibility answer={answer} familyName="DualSense" />)
    expect(record(html, 'bluetooth')).toContain('(demo fixture)')
    expect(record(html, 'usb')).not.toContain('(demo fixture)')
  })
})

describe('PhysicalControls markup', () => {
  it('shows one concise line, and no invented result, when no control has evidence', () => {
    const html = renderToStaticMarkup(<PhysicalControls rows={[]} />)
    expect(html).toContain('No per-control test data yet.')
    for (const fabricated of ['Works', 'Broken', 'No data', 'Controller support', '<table']) {
      expect(html).not.toContain(fabricated)
    }
  })
})
