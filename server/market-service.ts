import { CRYPTOS } from '../src/config.js'
import { loadFiatRates } from './currency-fallback.js'
import { loadBankQuotes } from './bank-quotes.js'
import { FIAT_CODES, loadFiatHistory } from './fiat-history.js'
import type { BankId, BankSnapshot, ChartSnapshot, Coin, CryptoSnapshot, FiatChartSnapshot, RateSnapshot } from '../src/types.js'

type Snapshot = RateSnapshot | CryptoSnapshot | ChartSnapshot | FiatChartSnapshot | BankSnapshot
type ApiResult = { status: number; headers: Record<string, string>; body: Snapshot | { error: string } }
type Entry = { data: Snapshot; expiresAt: number; storedAt: number }
const ALLOWED_IDS = new Set(CRYPTOS.map(c => c.id))
const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const positive = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0
const optionalNumber = (x: unknown) => typeof x === 'number' && Number.isFinite(x) ? x : null

function isoTime(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Invalid provider timestamp')
  return new Date(value).toISOString()
}

export function createMarketService(fetcher: typeof fetch = fetch, now: () => number = Date.now) {
  const cache = new Map<string, Entry>()
  const pending = new Map<string, Promise<Snapshot>>()

  async function upstream(url: string, method = 'GET'): Promise<unknown> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    const key = process.env.COINGECKO_DEMO_API_KEY?.trim()
    if (url.startsWith('https://api.coingecko.com/') && key) headers['x-cg-demo-api-key'] = key
    const response = await fetcher(url, { method, headers, signal: AbortSignal.timeout(9000) })
    if (!response.ok) throw new Error(response.status === 429 ? 'RATE_LIMIT' : 'Provider unavailable')
    return response.json()
  }

  async function load(resource: string, id: string, days: number, currency: string, quote: string, bank: BankId): Promise<Snapshot> {
    const fetchedAt = new Date(now()).toISOString()
    if (resource === 'rates') {
      return loadFiatRates(fetcher, now)
    }
    if (resource === 'bank') return loadBankQuotes(fetcher, now, bank)
    if (resource === 'fx-chart') return loadFiatHistory(fetcher, now, currency, quote, days)
    if (resource === 'crypto') {
      const ids = CRYPTOS.map(c => c.id).join(',')
      const raw = await upstream(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=true&price_change_percentage=24h`)
      if (!Array.isArray(raw)) throw new Error('Invalid crypto response')
      const coins: Coin[] = raw.filter(isObject).filter(c => typeof c.id === 'string' && ALLOWED_IDS.has(c.id) && positive(c.current_price)).map(c => ({
        id: String(c.id), symbol: String(c.symbol), name: String(c.name), priceUsd: c.current_price as number,
        change24h: optionalNumber(c.price_change_percentage_24h), marketCapUsd: optionalNumber(c.market_cap),
        volume24hUsd: optionalNumber(c.total_volume), high24hUsd: optionalNumber(c.high_24h), low24hUsd: optionalNumber(c.low_24h),
        sparkline: isObject(c.sparkline_in_7d) && Array.isArray(c.sparkline_in_7d.price) ? c.sparkline_in_7d.price.filter(positive) : [],
        updatedAt: isoTime(c.last_updated), priceSource: 'CoinGecko',
      }))
      if (!coins.length) throw new Error('No valid crypto quotes')
      return { coins, fetchedAt, source: 'CoinGecko', stale: coins.some(c => now() - Date.parse(c.updatedAt) > 3600_000) }
    }
    const raw = await upstream(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`)
    if (!isObject(raw) || !Array.isArray(raw.prices)) throw new Error('Invalid chart response')
    const points: [number, number][] = raw.prices.filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && positive(p[0]) && positive(p[1])).sort((a, b) => a[0] - b[0])
    if (points.length < 2) throw new Error('No chart history')
    return { coinId: id, days, points, fetchedAt, source: 'CoinGecko', stale: now() - points[points.length - 1][0] > 6 * 3600_000 }
  }

  return async (params: URLSearchParams, method = 'GET'): Promise<ApiResult> => {
    const basic = { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }
    if (method !== 'GET') return { status: 405, headers: { ...basic, Allow: 'GET' }, body: { error: 'Only GET requests are supported.' } }
    const resource = params.get('resource') ?? ''
    const id = params.get('coin') ?? 'bitcoin'
    const days = Number(params.get('days') ?? '7')
    const currency = params.get('currency') ?? 'USD', quote = params.get('quote') ?? 'MNT', bank = params.get('bank') ?? 'tdb'
    if (!['rates', 'crypto', 'chart', 'fx-chart', 'bank'].includes(resource)
      || (resource === 'chart' && (!ALLOWED_IDS.has(id) || ![1, 7, 30].includes(days)))
      || (resource === 'fx-chart' && (!FIAT_CODES.has(currency) || !FIAT_CODES.has(quote) || ![7, 30, 90].includes(days)))
      || (resource === 'bank' && !['tdb', 'golomt'].includes(bank))) {
      return { status: 400, headers: basic, body: { error: 'Choose a supported market resource, coin, and period.' } }
    }
    const cacheKey = resource === 'chart' ? `chart:${id}:${days}` : resource === 'fx-chart' ? `fx-chart:${currency}:${quote}:${days}` : resource === 'bank' ? `bank:${bank}` : resource
    const ttl = ['rates', 'fx-chart'].includes(resource) ? 3600_000 : ['crypto', 'bank'].includes(resource) ? 300_000 : 900_000
    const old = cache.get(cacheKey)
    const goodHeaders = { ...basic, 'Cache-Control': `public, max-age=0, s-maxage=${Math.floor(ttl / 1000)}, stale-while-revalidate=60` }
    if (old && old.expiresAt > now()) return { status: 200, headers: { ...goodHeaders, 'Cache-Control': `public, max-age=0, s-maxage=${Math.max(1, Math.floor((old.expiresAt - now()) / 1000))}, stale-while-revalidate=60` }, body: old.data }
    try {
      let request = pending.get(cacheKey)
      if (!request) {
        request = load(resource, id, days, currency, quote, bank as BankId)
        pending.set(cacheKey, request)
      }
      const data = await request
      const duration = resource === 'rates' && 'rateType' in data && data.rateType === 'bank-transfer-sell' ? 900_000 : ttl
      cache.set(cacheKey, { data, expiresAt: now() + duration, storedAt: now() })
      return { status: 200, headers: { ...goodHeaders, 'Cache-Control': `public, max-age=0, s-maxage=${Math.floor(duration / 1000)}, stale-while-revalidate=60` }, body: data }
    } catch (error) {
      // Log a bounded diagnostic, without exposing provider payloads or API keys.
      const reason = error instanceof Error && error.message === 'RATE_LIMIT' ? 'rate limited'
        : error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'timed out'
        : error instanceof SyntaxError ? 'invalid JSON' : 'request or data validation failed'
      console.warn(`[market-api] ${resource}: ${reason}`)
      const maxAge = resource === 'rates' ? old && 'rateType' in old.data && old.data.rateType === 'bank-transfer-sell' ? 86400_000 : 7 * 86400_000 : ['crypto', 'bank'].includes(resource) ? 3600_000 : 24 * 3600_000
      if (old && now() - old.storedAt < maxAge) return { status: 200, headers: { ...basic, 'Cache-Control': 'no-store' }, body: { ...old.data, stale: true } }
      return {
        status: 503, headers: { ...basic, 'Cache-Control': 'no-store', 'Retry-After': '60' },
        body: { error: resource === 'rates' ? 'Currency rates are temporarily unavailable. Please retry shortly.' : resource === 'bank' ? 'Quotes for this bank are temporarily unavailable. Please retry shortly.' : resource === 'fx-chart' ? 'Published currency history is temporarily unavailable. Please retry shortly.' : error instanceof Error && error.message === 'RATE_LIMIT'
          ? 'The market provider is rate limiting requests. Try again shortly. A CoinGecko Demo key can improve crypto access.'
          : 'This data source is temporarily unavailable. Please try again shortly.' },
      }
    } finally { pending.delete(cacheKey) }
  }
}

export const marketService = createMarketService()
