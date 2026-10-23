import { CRYPTOS } from '../config.js'
import type { Coin } from '../types.js'

export const LIVE_SOCKET_URL = 'wss://ws.kraken.com/v2'
export const LIVE_SYMBOLS = CRYPTOS.map(c => `${c.code}/USD`)
export const LAST_LIVE_MAX_AGE = 120_000
export type FeedStatus = 'connecting' | 'live' | 'reconnecting' | 'offline' | 'paused' | 'unsupported'
export type LiveQuote = { code: string; priceUsd: number; change24h: number | null; high24hUsd: number | null; low24hUsd: number | null; updatedAt: string; receivedAt: number }
export type FeedState = { status: FeedStatus; quotes: Record<string, LiveQuote>; activeSymbols: string[]; lastPriceAt: number | null; message: string | null }
export const initialFeedState = (): FeedState => ({ status: 'connecting', quotes: {}, activeSymbols: [], lastPriceAt: null, message: null })
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const positive = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0
const optional = (x: unknown) => typeof x === 'number' && Number.isFinite(x) ? x : null
const symbols = new Set(LIVE_SYMBOLS)

export function parseKrakenQuotes(message: unknown, time: number): LiveQuote[] {
  if (!object(message) || message.channel !== 'ticker' || !['snapshot', 'update'].includes(String(message.type)) || !Array.isArray(message.data)) return []
  return message.data.flatMap(row => {
    if (!object(row) || typeof row.symbol !== 'string' || !symbols.has(row.symbol) || !positive(row.last)
      || typeof row.timestamp !== 'string' || !Number.isFinite(Date.parse(row.timestamp)) || Date.parse(row.timestamp) > time + 60_000) return []
    return [{ code: row.symbol.split('/')[0], priceUsd: row.last, change24h: optional(row.change_pct), high24hUsd: positive(row.high) ? row.high : null,
      low24hUsd: positive(row.low) ? row.low : null, updatedAt: new Date(row.timestamp).toISOString(), receivedAt: time }]
  })
}

/** Prefer confirmed exchange prices; disconnected prices are explicitly stale and expire. */
export function mergeLiveCoins(reference: Coin[], state: FeedState, time: number, referenceStale = false): Coin[] {
  return CRYPTOS.flatMap<Coin>(asset => {
    const saved = reference.find(c => c.id === asset.id)
    const quote = state.quotes[asset.code]
    const live = state.status === 'live' && state.activeSymbols.includes(asset.code)
    const recent = quote && time >= quote.receivedAt && time - quote.receivedAt <= LAST_LIVE_MAX_AGE
    const prefer = quote && (live || recent) && (live || !saved || Date.parse(quote.updatedAt) >= Date.parse(saved.updatedAt))
    if (!prefer) return saved ? [{ ...saved, priceSource: 'CoinGecko' as const, live: false, stale: referenceStale || !!saved.stale }] : []
    return [{ id: asset.id!, symbol: asset.code.toLowerCase(), name: asset.name, priceUsd: quote.priceUsd, change24h: quote.change24h,
      high24hUsd: quote.high24hUsd, low24hUsd: quote.low24hUsd, marketCapUsd: saved?.marketCapUsd ?? null, volume24hUsd: saved?.volume24hUsd ?? null,
      sparkline: saved?.sparkline ?? [], updatedAt: quote.updatedAt, priceSource: 'Kraken' as const, live: !!live, stale: !live }]
  })
}

export interface SocketPort {
  readyState: number
  onopen: ((event: Event) => unknown) | null
  onmessage: ((event: MessageEvent) => unknown) | null
  onclose: ((event: CloseEvent) => unknown) | null
  onerror: ((event: Event) => unknown) | null
  send(data: string): void
  close(): void
}
type Timer = ReturnType<typeof setTimeout>
type Activity = 'active' | 'paused' | 'offline'
type Options = { makeSocket?: (url: string) => SocketPort; now?: () => number; setTimer?: (fn: () => void, ms: number) => Timer; clearTimer?: (timer: Timer) => void; random?: () => number }

export function createLiveFeed(onState: (state: FeedState) => void, options: Options = {}) {
  const now = options.now ?? Date.now
  const later = options.setTimer ?? setTimeout
  const cancel = options.clearTimer ?? clearTimeout
  const makeSocket = options.makeSocket ?? ((url: string) => new WebSocket(url))
  const random = options.random ?? Math.random
  let state = initialFeedState(), socket: SocketPort | null = null, running = false, activity: Activity = 'active'
  let attempts = 0, heardAt = 0
  let retryTimer: Timer | undefined, watchdog: Timer | undefined, publishTimer: Timer | undefined
  const emit = () => onState({ ...state, quotes: { ...state.quotes }, activeSymbols: [...state.activeSymbols] })
  const clear = (timer: Timer | undefined) => { if (timer !== undefined) cancel(timer) }

  function disconnect() {
    clear(retryTimer); clear(watchdog); clear(publishTimer)
    retryTimer = watchdog = publishTimer = undefined
    const previous = socket; socket = null
    if (previous) {
      previous.onopen = previous.onmessage = previous.onclose = previous.onerror = null
      try { previous.close() } catch { /* Already closed. */ }
    }
  }
  function retry(message = 'Reconnecting to the live price feed.') {
    disconnect()
    if (!running || activity !== 'active') return
    state = { ...state, status: 'reconnecting', activeSymbols: [], message }; emit()
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempts++, 5)) + Math.floor(random() * 250)
    retryTimer = later(connect, delay)
  }
  function checkConnection() {
    if (!running || !socket || activity !== 'active') return
    if (now() - heardAt >= 30_000) { retry('The live feed stopped responding. Reconnecting.'); return }
    watchdog = later(checkConnection, 10_000)
  }
  function publishSoon() {
    if (publishTimer !== undefined) return
    publishTimer = later(() => { publishTimer = undefined; if (running) emit() }, 200)
  }
  function connect() {
    retryTimer = undefined
    if (!running || activity !== 'active') return
    disconnect()
    state = { ...state, status: attempts ? 'reconnecting' : 'connecting', activeSymbols: [], message: null }; emit()
    if (!options.makeSocket && typeof WebSocket === 'undefined') { state = { ...state, status: 'unsupported', message: 'This browser does not support WebSocket.' }; emit(); return }
    let connection: SocketPort
    try { connection = makeSocket(LIVE_SOCKET_URL); socket = connection }
    catch { retry(); return }
    heardAt = now(); watchdog = later(checkConnection, 10_000)
    connection.onopen = () => {
      if (socket !== connection || !running) return
      heardAt = now()
      try { connection.send(JSON.stringify({ method: 'subscribe', params: { channel: 'ticker', symbol: LIVE_SYMBOLS, snapshot: true, event_trigger: 'trades' }, req_id: 1 })) }
      catch { retry() }
    }
    connection.onmessage = event => {
      if (socket !== connection || !running || typeof event.data !== 'string' || event.data.length > 100_000) return
      let message: unknown
      try { message = JSON.parse(event.data) } catch { return }
      if (!object(message)) return
      if (['ticker', 'heartbeat', 'status'].includes(String(message.channel)) || message.method === 'subscribe') heardAt = now()
      if (message.channel === 'status' && Array.isArray(message.data) && object(message.data[0]) && message.data[0].system !== 'online') { retry('The exchange is temporarily unavailable. Reconnecting.'); return }
      if (message.method === 'subscribe' && message.success === false) { state = { ...state, message: 'Some live pairs are unavailable; reference quotes are used where available.' }; emit(); return }
      const quotes = parseKrakenQuotes(message, now())
      let changed = false
      for (const quote of quotes) {
        const previous = state.quotes[quote.code]
        if (previous && Date.parse(previous.updatedAt) > Date.parse(quote.updatedAt)) continue
        state = { ...state, quotes: { ...state.quotes, [quote.code]: quote }, activeSymbols: [...new Set([...state.activeSymbols, quote.code])], lastPriceAt: quote.receivedAt }
        changed = true
      }
      if (!changed) return
      const first = state.status !== 'live'
      state = { ...state, status: 'live', message: state.activeSymbols.length === CRYPTOS.length ? null : state.message }; attempts = 0
      if (first) emit(); else publishSoon()
    }
    connection.onerror = () => { if (socket === connection && running) retry('The live feed connection failed. Reconnecting.') }
    connection.onclose = () => { if (socket === connection && running) retry() }
  }
  return {
    start(mode: Activity = 'active') { running = true; activity = mode; if (mode === 'active') connect(); else { state = { ...state, status: mode }; emit() } },
    setActivity(mode: Activity) {
      if (!running || mode === activity) return
      activity = mode; disconnect()
      if (mode === 'active') { attempts = 0; connect() }
      else { state = { ...state, status: mode, activeSymbols: [], message: mode === 'offline' ? 'Your device is offline.' : 'Live prices pause in hidden tabs.' }; emit() }
    },
    reconnect() { if (running && activity === 'active') { attempts = 0; disconnect(); connect() } },
    stop() { running = false; disconnect() },
  }
}
