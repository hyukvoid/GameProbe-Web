import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import postgres, { type Sql } from 'postgres'
import { migrate } from '../../scripts/migrate.mjs'

export type TestDb = { sql: Sql; pg: PGlite; port: number; close: () => Promise<void> }

/**
 * A fresh in-memory Postgres per test file, migrated with the real migrations and reached
 * through the same driver the app uses.
 */
export async function createTestDb(opts: { supabaseRoles?: boolean } = {}): Promise<TestDb> {
  const pg = await PGlite.create()
  if (opts.supabaseRoles) {
    // Simulate Supabase's API roles, which receive default table privileges.
    await pg.exec(`
      create role anon nologin;
      create role authenticated nologin;
      alter default privileges in schema public grant all on tables to anon, authenticated;
      grant usage on schema public to anon, authenticated;
    `)
  }
  const server = new PGLiteSocketServer({ db: pg, port: 0, host: '127.0.0.1', maxConnections: 4 })
  await server.start()
  const port = Number(String(server.getServerConn()).split(':').pop())
  const sql = postgres({
    host: '127.0.0.1',
    port,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    // PGlite serves one session; a single pipelined connection keeps protocol messages ordered.
    max: 1,
    prepare: false,
    onnotice: () => {},
  })
  await migrate(sql, () => {})
  return {
    sql,
    pg,
    port,
    close: async () => {
      await sql.end()
      await server.stop()
      await pg.close()
    },
  }
}

export async function loadFixtures(sql: Sql): Promise<void> {
  const file = path.join(import.meta.dirname, '..', '..', 'db', 'fixtures', 'dev.sql')
  const body = await readFile(file, 'utf8')
  await sql.begin(async (tx) => {
    await tx.unsafe(body)
  })
}

export function form(values: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(values)) f.set(k, v)
  return f
}

export async function ids(sql: Sql) {
  const games = await sql<{ id: string; slug: string }[]>`select id::text, slug from games`
  const families = await sql<{ id: string; slug: string }[]>`select id::text, slug from controller_families`
  const variants = await sql<{ id: string; slug: string; family_id: string }[]>`
    select id::text, slug, family_id::text from controller_variants`
  const by = <T extends { slug: string }>(rows: T[]) => (slug: string) => {
    const r = rows.find((x) => x.slug === slug)
    if (!r) throw new Error(`missing ${slug}`)
    return r
  }
  return { game: by(games), family: by(families), variant: by(variants) }
}
