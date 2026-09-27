// Starts the built app against a fresh in-memory database for end-to-end tests.
// Used by playwright.config.ts. Requires `npm run build` first.
import { spawn } from 'node:child_process'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import postgres from 'postgres'
import { migrate } from './migrate.mjs'

const dbPort = Number(process.env.E2E_DB_PORT ?? 54339)
const appPort = Number(process.env.E2E_APP_PORT ?? 3210)

const pg = await PGlite.create()
const server = new PGLiteSocketServer({ db: pg, port: dbPort, host: '127.0.0.1', maxConnections: 10 })
await server.start()
const url = `postgres://postgres:postgres@127.0.0.1:${dbPort}/postgres`
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} })
await migrate(sql, () => {})
await sql.end()

const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(appPort)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: url,
    DATABASE_POOL_MAX: '1',
    ADMIN_PASSWORD: 'e2e-admin-password-0123',
    APP_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e',
    SHOW_DEMO_DATA: 'false',
  },
})

async function shutdown() {
  next.kill()
  await server.stop()
  await pg.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
next.on('exit', (code) => process.exit(code ?? 0))
