// Apply db/migrations/*.sql in order. Each file runs once, inside a transaction.
// Usage: DATABASE_URL=... npm run db:migrate
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations')

export async function migrate(sql, log = console.log) {
  await sql.unsafe(`
    create table if not exists gameprobe_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    );
    alter table gameprobe_migrations enable row level security;
  `)
  const applied = new Set((await sql`select version from gameprobe_migrations`).map((r) => r.version))
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    if (applied.has(file)) continue
    const body = await readFile(path.join(dir, file), 'utf8')
    await sql.begin(async (tx) => {
      await tx.unsafe(body)
      await tx`insert into gameprobe_migrations (version) values (${file})`
    })
    log(`applied ${file}`)
  }
  log(applied.size === files.length ? 'database is up to date' : 'migrations complete')
}

if (process.argv[1]?.endsWith('migrate.mjs')) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} })
  try {
    await migrate(sql)
  } catch (err) {
    console.error(err.message)
    process.exitCode = 1
  } finally {
    await sql.end()
  }
}
