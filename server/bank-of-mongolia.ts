import { CURRENCIES } from '../src/config.js'
import type { RateSnapshot } from '../src/types.js'

export const BANK_RATES_URL = 'https://www.mongolbank.mn/mn/currency-rates/data'
export const BANK_SOURCE_URL = 'https://www.mongolbank.mn/mn/currency-rates'
const DAY = 86400_000
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)

export function mongoliaDate(time: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(time)
}

export function bankRequestUrl(time: number): string {
  const url = new URL(BANK_RATES_URL)
  // The Bank's own website sends a read-only POST with dates in the query string.
  url.search = new URLSearchParams({ startDate: mongoliaDate(time - 14 * DAY), endDate: mongoliaDate(time) }).toString()
  return url.toString()
}

function rate(value: unknown): number {
  if (typeof value === 'string' && /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(value.trim())) value = Number(value.replaceAll(',', ''))
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1e12) throw new Error('Invalid Bank of Mongolia rate')
  return value
}

export function parseBankRates(raw: unknown, time: number): RateSnapshot {
  if (!object(raw) || raw.success !== true || !Array.isArray(raw.data)) throw new Error('Bank of Mongolia data is unavailable')
  const today = mongoliaDate(time)
  const rows = raw.data.filter(object).filter(row => typeof row.RATE_DATE === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.RATE_DATE)
    && Number.isFinite(Date.parse(`${row.RATE_DATE}T00:00:00+08:00`)) && mongoliaDate(Date.parse(`${row.RATE_DATE}T00:00:00+08:00`)) === row.RATE_DATE && row.RATE_DATE <= today)
    .sort((a, b) => String(b.RATE_DATE).localeCompare(String(a.RATE_DATE)))
  const latest = rows[0]
  if (!latest) throw new Error('No dated Bank of Mongolia quote')
  const quoteDate = String(latest.RATE_DATE)
  const updatedAt = new Date(`${quoteDate}T00:00:00+08:00`).toISOString()
  const usdMnt = rate(latest.USD)
  const rates: Record<string, number> = { MNT: usdMnt, USD: 1 }
  for (const currency of CURRENCIES) rates[currency.code] = usdMnt / rate(latest[currency.code])
  return { rates, quoteDate, updatedAt, fetchedAt: new Date(time).toISOString(), source: 'Bank of Mongolia', rateType: 'reference', stale: time - Date.parse(updatedAt) > 7 * DAY }
}
