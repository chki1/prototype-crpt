import { CURRENCIES } from '../src/config.js'
import type { RateSnapshot } from '../src/types.js'
import { bankRequestUrl, mongoliaDate, parseBankRates } from './bank-of-mongolia.js'

// One commercial bank only. Never combine its cells with another provider.
export const FALLBACK_RATES_URL = 'https://www.tdbm.mn/mn/exchange-rates'
const DAY = 86400_000
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;|&#xA0;/gi, ' ').replace(/\s+/g, ' ').trim()
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1]

function positiveRate(value: string): number {
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(value)) throw new Error('Invalid bank rate')
  const result = Number(value.replaceAll(',', ''))
  if (!Number.isFinite(result) || result <= 0 || result > 1e12) throw new Error('Invalid bank rate')
  return result
}

export function parseFallbackRates(html: string, time: number): RateSnapshot {
  if (html.length > 2_000_000) throw new Error('Oversized bank response')
  const input = [...html.matchAll(/<input\b[^>]*>/gi)].find(m => attr(m[0], 'id') === 'edit-date')?.[0]
  const quoteDate = input && attr(input, 'value')
  if (!quoteDate || !/^\d{4}-\d{2}-\d{2}$/.test(quoteDate)) throw new Error('Missing bank date')
  const date = Date.parse(`${quoteDate}T00:00:00+08:00`)
  if (!Number.isFinite(date) || mongoliaDate(date) !== quoteDate || quoteDate > mongoliaDate(time) || time - date > 7 * DAY) throw new Error('Invalid or old bank date')
  const table = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].find(m => attr(m[0].split('>')[0], 'id') === 'edit-table')?.[0]
  if (!table) throw new Error('Missing bank table')
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => [...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c => text(c[1])))
  if (rows[0]?.join('|') !== 'Валют|Монгол банк|Бэлэн бус|Бэлэн' || rows[1]?.join('|') !== 'Авах|Зарах|Авах|Зарах') throw new Error('Bank columns changed')
  const mnt: Record<string, number> = {}
  for (const currency of CURRENCIES) {
    const matches = rows.filter(row => row[1] === currency.code)
    if (matches.length !== 1 || matches[0].length !== 8) throw new Error('Incomplete bank quote')
    const buy = positiveRate(matches[0][4]), sell = positiveRate(matches[0][5])
    if (buy > sell) throw new Error('Inverted bank spread')
    mnt[currency.code] = sell // The observed non-cash SELL column, per one foreign unit.
  }
  const rates: Record<string, number> = { MNT: mnt.USD, USD: 1 }
  for (const currency of CURRENCIES) rates[currency.code] = mnt.USD / mnt[currency.code]
  return { rates, quoteDate, updatedAt: new Date(date).toISOString(), fetchedAt: new Date(time).toISOString(), source: 'TDB', rateType: 'bank-transfer-sell' }
}

export async function loadFiatRates(fetcher: typeof fetch, now: () => number): Promise<RateSnapshot> {
  try {
    const response = await fetcher(bankRequestUrl(now()), { method: 'POST', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(9000) })
    if (!response.ok) throw new Error('Primary unavailable')
    const primary = parseBankRates(await response.json(), now())
    if (primary.stale) throw new Error('Primary quote is old')
    return primary
  } catch { /* Try the single configured bank after a failed or invalid primary quote. */ }
  const response = await fetcher(FALLBACK_RATES_URL, { headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(6000) })
  if (!response.ok) throw new Error('Fallback unavailable')
  return parseFallbackRates(await response.text(), now())
}
