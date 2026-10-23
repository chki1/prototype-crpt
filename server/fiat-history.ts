import { CURRENCIES } from '../src/config.js'
import type { FiatChartSnapshot } from '../src/types.js'
import { bankRequestUrl, mongoliaDate } from './bank-of-mongolia.js'

export const FIAT_CODES = new Set(['MNT', ...CURRENCIES.map(c => c.code)])
const DAY = 86400_000
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const amount = (x: unknown) => {
  if (typeof x === 'string' && /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(x.trim())) x = Number(x.replaceAll(',', ''))
  return typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= 1e12 ? x : null
}

export function parseFiatHistory(raw: unknown, code: string, quote: string, days: number, time: number): FiatChartSnapshot {
  if (!FIAT_CODES.has(code) || !FIAT_CODES.has(quote) || ![7, 30, 90].includes(days)) throw new Error('Unsupported currency history')
  if (!object(raw) || raw.success !== true || !Array.isArray(raw.data)) throw new Error('Invalid currency history')
  const first = mongoliaDate(time - days * DAY), last = mongoliaDate(time)
  const points = new Map<number, number>()
  for (const row of raw.data) {
    if (!object(row) || typeof row.RATE_DATE !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.RATE_DATE) || row.RATE_DATE < first || row.RATE_DATE > last) continue
    const timestamp = Date.parse(`${row.RATE_DATE}T00:00:00+08:00`)
    if (!Number.isFinite(timestamp) || mongoliaDate(timestamp) !== row.RATE_DATE) continue
    const numerator = code === 'MNT' ? 1 : amount(row[code]), denominator = quote === 'MNT' ? 1 : amount(row[quote])
    if (numerator == null || denominator == null) continue
    const price = numerator / denominator
    if (Number.isFinite(price) && price > 0) {
      if (points.has(timestamp) && points.get(timestamp) !== price) throw new Error('Conflicting daily closes')
      points.set(timestamp, price)
    }
  }
  const ordered = [...points.entries()].sort((a, b) => a[0] - b[0])
  if (ordered.length < 2) throw new Error('Not enough published currency history')
  return { assetCode: code, quoteCode: quote, days, points: ordered, fetchedAt: new Date(time).toISOString(), source: 'Bank of Mongolia', stale: time - ordered[ordered.length - 1][0] > 7 * DAY }
}

export async function loadFiatHistory(fetcher: typeof fetch, now: () => number, code: string, quote: string, days: number) {
  const response = await fetcher(bankRequestUrl(now(), days + 1), { method: 'POST', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) })
  if (!response.ok) throw new Error('Currency history is temporarily unavailable')
  return parseFiatHistory(await response.json(), code, quote, days, now())
}
