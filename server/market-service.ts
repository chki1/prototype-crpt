import { CURRENCIES, CRYPTOS } from '../src/config.js'
import type { ChartSnapshot, Coin, CryptoSnapshot, RateSnapshot } from '../src/types.js'

type Snapshot = RateSnapshot | CryptoSnapshot | ChartSnapshot
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

  async function upstream(url: string): Promise<unknown> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    const key = process.env.COINGECKO_DEMO_API_KEY?.trim()
    if (url.startsWith('https://api.coingecko.com/') && key) headers['x-cg-demo-api-key'] = key
    const response = await fetcher(url, { headers, signal: AbortSignal.timeout(9000) })
    if (!response.ok) throw new Error(response.status === 429 ? 'RATE_LIMIT' : 'Provider unavailable')
    return response.json()
  }

  async function load(resource: string, id: string, days: number): Promise<Snapshot> {
    const fetchedAt = new Date(now()).toISOString()
    if (resource === 'rates') {
      const raw = await upstream('https://open.er-api.com/v6/latest/USD')
      if (!isObject(raw) || raw.result !== 'success' || raw.base_code !== 'USD' || !isObject(raw.rates)
        || !positive(raw.rates.MNT) || raw.rates.USD !== 1
        || !positive(raw.time_last_update_unix) || !positive(raw.time_next_update_unix)) {
        throw new Error('Invalid exchange rate response')
      }
      const rates: Record<string, number> = { MNT: raw.rates.MNT, USD: 1 }
      for (const asset of CURRENCIES) {
        const value = raw.rates[asset.code]
        if (positive(value)) rates[asset.code] = value
      }
      return {
        rates, updatedAt: new Date(raw.time_last_update_unix * 1000).toISOString(),
        nextUpdateAt: new Date(raw.time_next_update_unix * 1000).toISOString(),
        fetchedAt, source: 'ExchangeRate-API',
        stale: now() - raw.time_last_update_unix * 1000 > 48 * 3600_000,
      }
    }
    if (resource === 'crypto') {
      const ids = CRYPTOS.map(c => c.id).join(',')
      const raw = await upstream(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=true&price_change_percentage=24h`)
      if (!Array.isArray(raw)) throw new Error('Invalid crypto response')
      const coins: Coin[] = raw.filter(isObject).filter(c => typeof c.id === 'string' && ALLOWED_IDS.has(c.id) && positive(c.current_price)).map(c => ({
        id: String(c.id), symbol: String(c.symbol), name: String(c.name), priceUsd: c.current_price as number,
        change24h: optionalNumber(c.price_change_percentage_24h), marketCapUsd: optionalNumber(c.market_cap),
        volume24hUsd: optionalNumber(c.total_volume), high24hUsd: optionalNumber(c.high_24h), low24hUsd: optionalNumber(c.low_24h),
        sparkline: isObject(c.sparkline_in_7d) && Array.isArray(c.sparkline_in_7d.price) ? c.sparkline_in_7d.price.filter(positive) : [],
        updatedAt: isoTime(c.last_updated),
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
    if (!['rates', 'crypto', 'chart'].includes(resource) || (resource === 'chart' && (!ALLOWED_IDS.has(id) || ![1, 7, 30].includes(days)))) {
      return { status: 400, headers: basic, body: { error: 'Choose a supported market resource, coin, and period.' } }
    }
    const cacheKey = resource === 'chart' ? `chart:${id}:${days}` : resource
    const ttl = resource === 'rates' ? 3600_000 : resource === 'crypto' ? 300_000 : 900_000
    const old = cache.get(cacheKey)
    const goodHeaders = { ...basic, 'Cache-Control': `public, max-age=0, s-maxage=${Math.floor(ttl / 1000)}, stale-while-revalidate=60` }
    if (old && old.expiresAt > now()) return { status: 200, headers: { ...goodHeaders, 'Cache-Control': `public, max-age=0, s-maxage=${Math.max(1, Math.floor((old.expiresAt - now()) / 1000))}, stale-while-revalidate=60` }, body: old.data }
    try {
      let request = pending.get(cacheKey)
      if (!request) {
        request = load(resource, id, days)
        pending.set(cacheKey, request)
      }
      const data = await request
      let duration = ttl
      if ('nextUpdateAt' in data) duration = Math.max(60_000, Math.min(ttl, Date.parse(data.nextUpdateAt) - now()))
      cache.set(cacheKey, { data, expiresAt: now() + duration, storedAt: now() })
      return { status: 200, headers: { ...goodHeaders, 'Cache-Control': `public, max-age=0, s-maxage=${Math.floor(duration / 1000)}, stale-while-revalidate=60` }, body: data }
    } catch (error) {
      const maxAge = resource === 'rates' ? 48 * 3600_000 : resource === 'crypto' ? 3600_000 : 24 * 3600_000
      if (old && now() - old.storedAt < maxAge) return { status: 200, headers: { ...basic, 'Cache-Control': 'no-store' }, body: { ...old.data, stale: true } }
      return {
        status: 503, headers: { ...basic, 'Cache-Control': 'no-store', 'Retry-After': '60' },
        body: { error: error instanceof Error && error.message === 'RATE_LIMIT'
          ? 'The market provider is rate limiting requests. Try again shortly. A CoinGecko Demo key can improve crypto access.'
          : 'This data source is temporarily unavailable. Please try again shortly.' },
      }
    } finally { pending.delete(cacheKey) }
  }
}

export const marketService = createMarketService()
