const DATE = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
const DATETIME = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
})

/** "2026-09-27" -> "Sep 27, 2026". Dates are calendar dates, shown in UTC. */
export function formatDate(iso: string | null): string {
  if (!iso) return 'Unknown'
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  return Number.isNaN(d.getTime()) ? iso : DATE.format(d)
}

export function formatDateTime(iso: string): string {
  return DATETIME.format(new Date(iso))
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
