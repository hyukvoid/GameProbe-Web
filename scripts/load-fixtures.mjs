// Load development fixtures (db/fixtures/dev.sql). Every fixture row has is_demo = true
// and is hidden unless SHOW_DEMO_DATA=true. Refuses to run against non-local databases.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}
const host = new URL(url).hostname
if (!['127.0.0.1', 'localhost', '::1'].includes(host) || process.env.NODE_ENV === 'production') {
  console.error(`Refusing to load development fixtures into ${host}. Fixtures are for local databases only.`)
  process.exit(1)
}

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'fixtures', 'dev.sql')
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} })
try {
  await sql.begin(async (tx) => {
    await tx.unsafe(await readFile(file, 'utf8'))
  })
  console.log('Loaded development fixtures. Start the app with SHOW_DEMO_DATA=true to see them.')
} catch (err) {
  console.error(err.message)
  process.exitCode = 1
} finally {
  await sql.end()
}
