import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLiveFeed, initialFeedState, LAST_LIVE_MAX_AGE, LIVE_SOCKET_URL, LIVE_SYMBOLS, mergeLiveCoins, parseKrakenQuotes, type FeedState, type SocketPort } from '../src/lib/live-feed.js'
import { bankRequestUrl, mongoliaDate, parseBankRates } from '../server/bank-of-mongolia.js'
import { CURRENCIES } from '../src/config.js'
import { mntPerUnit, pricePerUnit } from '../src/lib/money.js'
import { nextThemePreference, resolveTheme, type ThemePreference } from '../src/lib/theme.js'

const instant = Date.parse('2026-10-23T00:00:00Z')
const ticker = (price = 67000, time = instant, symbol = 'BTC/USD') => ({ channel: 'ticker', type: 'update', data: [{ symbol, last: price, change_pct: 1.2, low: 65000, high: 68000, timestamp: new Date(time).toISOString() }] })

// Test values only; never used as a production price fallback.
const bankRow = (date = '2026-10-22') => ({ RATE_DATE: date, ...Object.fromEntries(CURRENCIES.map(c => [c.code, '1,000.00'])), USD: '3,500.00', EUR: '4,000.00', JPY: '23.45', KRW: '2.72' })

test('BoM closing quotes retain their date and per-one-unit MNT amounts', () => {
  const data = parseBankRates({ success: true, data: [bankRow(), { ...bankRow('2026-10-21'), USD: '3,400.00' }] }, instant)
  assert.equal(data.source, 'Bank of Mongolia')
  assert.equal(data.quoteDate, '2026-10-22')
  assert.equal(data.rates.MNT, 3500)
  assert.equal(mntPerUnit('USD', data, []), 3500)
  assert.equal(mntPerUnit('EUR', data, []), 4000)
  assert.ok(Math.abs(mntPerUnit('JPY', data, [])! - 23.45) < 1e-9)
  assert.ok(Math.abs(mntPerUnit('KRW', data, [])! - 2.72) < 1e-9)
  assert.equal(pricePerUnit('USD', 'EUR', data, []), .875)
})

test('BoM requests use Ulaanbaatar calendar dates, including around UTC midnight', () => {
  const time = Date.parse('2026-10-22T17:00:00Z')
  assert.equal(mongoliaDate(time), '2026-10-23')
  const url = new URL(bankRequestUrl(time))
  assert.equal(url.origin, 'https://www.mongolbank.mn')
  assert.equal(url.pathname, '/mn/currency-rates/data')
  assert.equal(url.searchParams.get('endDate'), '2026-10-23')
  assert.equal(url.searchParams.get('startDate'), '2026-10-09')
})

test('BoM validation rejects invalid dates, malformed comma groups, missing and zero prices', () => {
  for (const row of [{ ...bankRow(), USD: '3,50.00' }, { ...bankRow(), USD: '0' }, { ...bankRow(), EUR: '' }, { ...bankRow(), JPY: Infinity }, bankRow('2026-02-31'), bankRow('2026-10-24')]) {
    assert.throws(() => parseBankRates({ success: true, data: [row] }, instant))
  }
  assert.throws(() => parseBankRates({ success: false, data: 'No results' }, instant))
  assert.throws(() => parseBankRates({ success: true, data: [] }, instant))
  assert.equal(parseBankRates({ success: true, data: [bankRow('2026-10-01')] }, instant).stale, true)
})

test('ticker parsing accepts only known USD pairs and valid timestamped positive prices', () => {
  const [quote] = parseKrakenQuotes(ticker(), instant)
  assert.equal(quote.code, 'BTC')
  assert.equal(quote.priceUsd, 67000)
  assert.equal(quote.high24hUsd, 68000)
  assert.equal(quote.receivedAt, instant)
  for (const packet of [ticker(0), ticker(-1), ticker(NaN), ticker(Infinity), ticker(67000, instant, 'BTC/USDT'), ticker(67000, instant, 'UNKNOWN/USD'), ticker(67000, instant + 120_000), { channel: 'ticker', type: 'update', data: [{ symbol: 'BTC/USD', last: 67000, timestamp: 'wrong' }] }, { channel: 'book', data: [] }]) assert.deepEqual(parseKrakenQuotes(packet, instant), [])
})

test('live quotes override reference prices, drive conversions, and disconnected values expire', () => {
  const quotes = { BTC: parseKrakenQuotes(ticker(), instant)[0] }
  const live: FeedState = { ...initialFeedState(), status: 'live', quotes, activeSymbols: ['BTC'] }
  const coins = mergeLiveCoins([], live, instant)
  assert.equal(coins[0].live, true)
  assert.equal(coins[0].priceSource, 'Kraken')
  assert.equal(pricePerUnit('BTC', 'USD', null, coins), 67000)
  assert.equal(pricePerUnit('BTC', 'MNT', parseBankRates({ success: true, data: [bankRow()] }, instant), coins), 234500000)
  const dropped = { ...live, status: 'reconnecting' as const, activeSymbols: [] }
  assert.equal(mergeLiveCoins([], dropped, instant + 1000)[0].stale, true)
  assert.equal(mergeLiveCoins([], dropped, instant + 1000)[0].live, false)
  assert.deepEqual(mergeLiveCoins([], dropped, instant + LAST_LIVE_MAX_AGE + 1), [])
  const reference = { ...coins[0], priceUsd: 66000, updatedAt: new Date(instant - 1000).toISOString() }
  assert.equal(mergeLiveCoins([reference], dropped, instant + LAST_LIVE_MAX_AGE + 1)[0].priceSource, 'CoinGecko')
})

class FakeSocket implements SocketPort {
  readyState = 0
  onopen: SocketPort['onopen'] = null
  onmessage: SocketPort['onmessage'] = null
  onclose: SocketPort['onclose'] = null
  onerror: SocketPort['onerror'] = null
  sent: string[] = []
  closes = 0
  send(data: string) { this.sent.push(data) }
  close() { this.closes++; this.readyState = 3; this.onclose?.(new Event('close') as CloseEvent) }
  open() { this.readyState = 1; this.onopen?.(new Event('open')) }
  message(value: unknown) { this.onmessage?.(new MessageEvent('message', { data: typeof value === 'string' ? value : JSON.stringify(value) })) }
}

function harness() {
  let time = instant, id = 0
  const tasks = new Map<number, { at: number; fn: () => void }>()
  const sockets: FakeSocket[] = [], states: FeedState[] = []
  const feed = createLiveFeed(s => states.push(s), {
    now: () => time, random: () => 0,
    makeSocket(url) { assert.equal(url, LIVE_SOCKET_URL); const socket = new FakeSocket(); sockets.push(socket); return socket },
    setTimer(fn, ms) { const key = ++id; tasks.set(key, { at: time + ms, fn }); return key as unknown as ReturnType<typeof setTimeout> },
    clearTimer(key) { tasks.delete(key as unknown as number) },
  })
  function advance(ms: number) {
    const target = time + ms
    for (let guard = 0; guard < 1000; guard++) {
      const next = [...tasks.entries()].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      tasks.delete(next[0]); time = next[1].at; next[1].fn()
    }
    time = target
  }
  return { feed, sockets, states, advance, tasks, latest: () => states.at(-1)!, time: () => time }
}

test('one socket subscribes to all USD pairs, coalesces ticks, and ignores malformed or older messages', () => {
  const h = harness(); h.feed.start(); assert.equal(h.sockets.length, 1)
  const socket = h.sockets[0]; socket.open()
  const request = JSON.parse(socket.sent[0])
  assert.deepEqual(request.params.symbol, LIVE_SYMBOLS)
  assert.equal(request.params.snapshot, true)
  socket.message(ticker()); assert.equal(h.latest().status, 'live')
  const count = h.states.length
  socket.message('{bad json'); socket.message(ticker(66000, instant - 1000))
  assert.equal(h.states.length, count)
  socket.message(ticker(67001, instant + 1)); socket.message(ticker(67002, instant + 2))
  assert.equal(h.latest().quotes.BTC.priceUsd, 67000)
  h.advance(200)
  assert.equal(h.states.length, count + 1)
  assert.equal(h.latest().quotes.BTC.priceUsd, 67002)
  h.feed.stop(); assert.equal(h.tasks.size, 0)
})

test('closed connections reconnect with a fresh subscription; stopped sockets cannot update or reconnect', () => {
  const h = harness(); h.feed.start(); h.sockets[0].open(); h.sockets[0].message(ticker())
  h.sockets[0].close()
  assert.equal(h.latest().status, 'reconnecting')
  assert.deepEqual(h.latest().activeSymbols, [])
  h.advance(999); assert.equal(h.sockets.length, 1)
  h.advance(1); assert.equal(h.sockets.length, 2)
  h.sockets[1].open(); assert.equal(JSON.parse(h.sockets[1].sent[0]).params.snapshot, true)
  h.sockets[1].message(ticker(67010, h.time())); assert.equal(h.latest().status, 'live')
  const updates = h.states.length
  h.feed.stop(); h.sockets[1].message(ticker(99999)); h.advance(60000)
  assert.equal(h.states.length, updates); assert.equal(h.sockets.length, 2); assert.equal(h.tasks.size, 0)
})

test('heartbeat watchdog reconnects silent connections and offline/hidden modes suspend reconnecting', () => {
  const h = harness(); h.feed.start(); h.sockets[0].open()
  h.advance(30000); assert.equal(h.latest().status, 'reconnecting')
  h.advance(1000); assert.equal(h.sockets.length, 2)
  h.feed.setActivity('offline'); assert.equal(h.latest().status, 'offline')
  h.advance(60000); assert.equal(h.sockets.length, 2)
  h.feed.setActivity('active'); assert.equal(h.sockets.length, 3)
  h.feed.setActivity('paused'); assert.equal(h.latest().status, 'paused')
  h.advance(60000); assert.equal(h.sockets.length, 3)
  h.feed.stop(); assert.equal(h.tasks.size, 0)
})

test('manual theme toggle turns Auto off, Auto resumes the system, and disabling Auto freezes the current theme', () => {
  let preference: ThemePreference = 'system'
  let resolved = resolveTheme(preference, true)
  preference = nextThemePreference(preference, resolved, 'theme')
  assert.equal(preference, 'light'); assert.equal(resolveTheme(preference, true), 'light')
  preference = nextThemePreference(preference, 'light', 'automatic')
  assert.equal(preference, 'system'); assert.equal(resolveTheme(preference, true), 'dark')
  preference = nextThemePreference(preference, 'dark', 'automatic')
  assert.equal(preference, 'dark'); assert.equal(resolveTheme(preference, false), 'dark')
  assert.equal(nextThemePreference('system', 'light', 'theme'), 'dark')
})
