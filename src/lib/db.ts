import 'server-only'
import postgres, { type Sql } from 'postgres'

export type { Sql }

const globalForDb = globalThis as unknown as { gameprobeSql?: Sql }

/**
 * Server-side Postgres client. The app never talks to the database from the browser and
 * never uses a Supabase API key; it connects with DATABASE_URL from the server only.
 */
export function db(): Sql {
  if (!globalForDb.gameprobeSql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set. See .env.example.')
    globalForDb.gameprobeSql = postgres(url, {
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      // Required for Supabase's transaction pooler; harmless elsewhere.
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
    })
  }
  return globalForDb.gameprobeSql
}

/** Development fixtures are hidden unless explicitly enabled. */
export function includeDemoData(): boolean {
  return process.env.SHOW_DEMO_DATA === 'true'
}
