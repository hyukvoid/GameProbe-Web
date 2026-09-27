// Local development database: an embedded Postgres (PGlite) served over the Postgres wire
// protocol, so the app uses the same driver and SQL locally as in production.
// Data is kept in .pglite/dev. Stop with Ctrl+C.
import { mkdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const port = Number(process.env.LOCAL_DB_PORT ?? 54329)
const dataDir = process.env.LOCAL_DB_DIR ?? '.pglite/dev'

await mkdir(dataDir, { recursive: true })
const db = await PGlite.create(dataDir)
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 10 })
await server.start()
console.log(`Local database ready: postgres://postgres:postgres@127.0.0.1:${port}/postgres`)

async function shutdown() {
  await server.stop()
  await db.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
