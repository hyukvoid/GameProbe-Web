import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EmptyTests } from '@/components/evidence'

// GameProbe reviews submitted direct tests but does not independently verify them.
// "Verified" wording for direct tests would claim otherwise.

const VERIFIED_TESTS = /verified (direct )?tests?/i

async function uiFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await uiFiles(full)))
    else if (/\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

describe('direct-test wording', () => {
  it('renders the empty state without "verified" wording', () => {
    const html = renderToStaticMarkup(<EmptyTests />)
    expect(html).toContain('No direct tests yet.')
    expect(html).not.toMatch(VERIFIED_TESTS)
  })

  it('has no "verified test" wording anywhere in the public UI source', async () => {
    const root = path.join(import.meta.dirname, '..', 'src')
    const files = [...(await uiFiles(path.join(root, 'app'))), ...(await uiFiles(path.join(root, 'components')))]
    expect(files.length).toBeGreaterThan(10)
    const offenders: string[] = []
    for (const file of files) {
      const text = await readFile(file, 'utf8')
      if (VERIFIED_TESTS.test(text)) offenders.push(path.relative(root, file))
    }
    expect(offenders).toEqual([])
  })
})
