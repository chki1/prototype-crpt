import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BANKS, CURRENCIES, CONVERTER_ASSETS } from '../src/config.js'
import { convertAmount, formatPrice, normalizeDisplayCurrency, pricePerUnit, usdToCurrency } from '../src/lib/money.js'
import { parseFiatHistory } from '../server/fiat-history.js'
import { GOLOMT_RATES_URL, parseGolomtQuotes, parseTdbQuotes } from '../server/bank-quotes.js'
import { FALLBACK_RATES_URL } from '../server/currency-fallback.js'
import { createMarketService } from '../server/market-service.js'
import type { Coin, RateSnapshot } from '../src/types.js'

// Deliberately synthetic fixtures; production never uses these values.
const now = Date.parse('2026-10-23T04:00:00Z')
const history = { success: true, data: [
  { RATE_DATE: '2026-10-22', USD: '3,600', EUR: '4,000', JPY: '24', KRW: '3' },
  { RATE_DATE: '2026-10-21', USD: '3,500', EUR: '3,800', JPY: '23', KRW: '2.8' },
] }
const golomt = { result: Object.fromEntries(CURRENCIES.map((a, i) => [a.code, { fixcurcode: a.code, varcurcode: 'MNT', mongolbank: { cvalue: 3500 - i }, cash_buy: { cvalue: 3490 - i, tvalue: 999 }, cash_sell: { cvalue: 3520 - i, tvalue: 999 }, non_cash_buy: { cvalue: 3495 - i, tvalue: 999 }, non_cash_sell: { cvalue: 3505 - i, tvalue: 999 } }])) }
function tdbHtml() {
  return `<input id="edit-date" value="2026-10-23"><table id="edit-table"><tr><td>Валют</td><td>Монгол банк</td><td>Бэлэн бус</td><td>Бэлэн</td></tr><tr><td>Авах</td><td>Зарах</td><td>Авах</td><td>Зарах</td></tr>${CURRENCIES.map(a => `<tr><td></td><td>${a.code}</td><td>${a.name}</td><td>3500</td><td>3499</td><td>3509</td><td>3490</td><td>3520</td></tr>`).join('')}</table>`
}

test('fiat Market Orbit uses each date’s actual FX cross rate, sorted by its published date', () => {
  const cross = parseFiatHistory(history, 'USD', 'EUR', 30, now)
  assert.equal(cross.points.length, 2)
  assert.equal(cross.points[0][1], 3500 / 3800)
  assert.equal(cross.points[1][1], .9)
  assert.ok(cross.points[0][0] < cross.points[1][0])
  assert.equal(parseFiatHistory(history, 'JPY', 'MNT', 7, now).points.at(-1)?.[1], 24)
  assert.equal(parseFiatHistory(history, 'KRW', 'MNT', 7, now).points.at(-1)?.[1], 3)
  assert.equal(parseFiatHistory(history, 'MNT', 'USD', 7, now).points.at(-1)?.[1], 1 / 3600)
  assert.deepEqual(parseFiatHistory(history, 'USD', 'USD', 7, now).points.map(p => p[1]), [1, 1])
})

test('currency history rejects unsupported pairs, invalid values, conflicting closes and insufficient dates', () => {
  assert.throws(() => parseFiatHistory(history, 'BTC', 'MNT', 7, now))
  assert.throws(() => parseFiatHistory(history, 'USD', 'MNT', 1, now))
  assert.throws(() => parseFiatHistory({ success: true, data: [history.data[0], { ...history.data[0], USD: '3601' }] }, 'USD', 'MNT', 7, now))
  for (const bad of [0, -1, Infinity, '3,00', 'invalid', 1e20]) assert.throws(() => parseFiatHistory({ success: true, data: history.data.map(row => ({ ...row, USD: bad })) }, 'USD', 'MNT', 7, now))
  assert.throws(() => parseFiatHistory({ success: true, data: [{ ...history.data[0], RATE_DATE: '2026-02-30' }, { ...history.data[1], RATE_DATE: '2026-10-24' }] }, 'USD', 'MNT', 7, now))
})

test('Golomt bank quotes preserve cash/transfer buy/sell fields and use cvalue rather than tvalue', () => {
  const snapshot = parseGolomtQuotes(golomt, '2026-10-23', now)
  assert.equal(snapshot.bankId, 'golomt')
  assert.equal(snapshot.quotes.length, CURRENCIES.length)
  assert.deepEqual(snapshot.quotes[0].cash, { buy: 3490, sell: 3520 })
  assert.deepEqual(snapshot.quotes[0].transfer, { buy: 3495, sell: 3505 })
  assert.equal(snapshot.quotes[0].referenceMnt, 3500)
  assert.equal(snapshot.sourceUrl, BANKS.find(b => b.id === 'golomt')?.url)
})

test('TDB preserves all four bank price columns and never labels an official rate as a bank bid', () => {
  const snapshot = parseTdbQuotes(tdbHtml(), now)
  assert.equal(snapshot.bankId, 'tdb')
  assert.deepEqual(snapshot.quotes[0].cash, { buy: 3490, sell: 3520 })
  assert.deepEqual(snapshot.quotes[0].transfer, { buy: 3499, sell: 3509 })
  assert.equal(snapshot.quotes[0].referenceMnt, 3500)
  const zero = tdbHtml().replace('<td>3490</td><td>3520</td>', '<td>0</td><td>0.00</td>')
  assert.deepEqual(parseTdbQuotes(zero, now).quotes[0].cash, { buy: null, sell: null })
})

test('wrong bank units, malformed spreads and unsupported dates fail validation', () => {
  const wrong = structuredClone(golomt)
  wrong.result.USD.varcurcode = 'USD'
  assert.throws(() => parseGolomtQuotes(wrong, '2026-10-23', now))
  const inverted = structuredClone(golomt)
  inverted.result.USD.non_cash_sell.cvalue = 3400
  assert.throws(() => parseGolomtQuotes(inverted, '2026-10-23', now))
  assert.throws(() => parseGolomtQuotes(golomt, '2026-10-24', now))
  assert.throws(() => parseGolomtQuotes(golomt, '2026-10-01', now))
  assert.throws(() => parseTdbQuotes(tdbHtml().replace('Бэлэн бус', 'Cash'), now))
})

test('bank API requests and caches each bank separately without substituting a successful bank', async () => {
  const calls: string[] = []
  let golomtFailed = false, clock = now
  const service = createMarketService(async url => {
    calls.push(String(url))
    if (String(url) === FALLBACK_RATES_URL) return new Response(tdbHtml())
    if (String(url).startsWith(GOLOMT_RATES_URL) && !golomtFailed) return Response.json(golomt)
    return new Response('Unavailable', { status: 503 })
  }, () => clock)
  const tdb = await service(new URLSearchParams('resource=bank&bank=tdb'))
  assert.equal('bankId' in tdb.body && tdb.body.bankId, 'tdb')
  const other = await service(new URLSearchParams('resource=bank&bank=golomt'))
  assert.equal('bankId' in other.body && other.body.bankId, 'golomt')
  await service(new URLSearchParams('resource=bank&bank=tdb'))
  assert.equal(calls.length, 2)
  golomtFailed = true; clock += 300_001
  const saved = await service(new URLSearchParams('resource=bank&bank=golomt'))
  assert.equal('bankId' in saved.body && saved.body.bankId, 'golomt')
  assert.equal('stale' in saved.body && saved.body.stale, true)
  assert.equal(calls.filter(url => url === FALLBACK_RATES_URL).length, 1)
})

test('currency history API cache separates the selected currency, quote and period', async () => {
  let calls = 0
  const service = createMarketService(async (_url, init) => { calls++; assert.equal(init?.method, 'POST'); return Response.json(history) }, () => now)
  const cross = await service(new URLSearchParams('resource=fx-chart&currency=USD&quote=EUR&days=30'))
  assert.equal(cross.status, 200)
  assert.equal('points' in cross.body && cross.body.points.at(-1)?.[1], .9)
  const mnt = await service(new URLSearchParams('resource=fx-chart&currency=USD&quote=MNT&days=30'))
  assert.equal('points' in mnt.body && mnt.body.points.at(-1)?.[1], 3600)
  await service(new URLSearchParams('resource=fx-chart&currency=USD&quote=EUR&days=30'))
  assert.equal(calls, 2)
})

test('new API allowlists reject arbitrary bank URLs and unsupported currency periods before fetch', async () => {
  let calls = 0
  const service = createMarketService(async () => { calls++; throw new Error('Unexpected fetch') })
  for (const query of ['resource=bank&bank=https://example.com', 'resource=fx-chart&currency=BTC&quote=MNT&days=30', 'resource=fx-chart&currency=USD&quote=BTC&days=30', 'resource=fx-chart&currency=USD&quote=MNT&days=365']) assert.equal((await service(new URLSearchParams(query))).status, 400)
  assert.equal(calls, 0)
})

test('all configured fiat and crypto display assets normalize safely, including small crypto denominators', () => {
  for (const asset of CONVERTER_ASSETS) assert.equal(normalizeDisplayCurrency(asset.code), asset.code)
  assert.equal(normalizeDisplayCurrency('UNKNOWN'), 'MNT')
  const fx: RateSnapshot = { source: 'Bank of Mongolia', rates: { MNT: 3500, USD: 1, EUR: .9 }, quoteDate: '2026-10-23', updatedAt: new Date(now).toISOString(), fetchedAt: new Date(now).toISOString() }
  const btc: Coin = { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', priceUsd: 70000, marketCapUsd: null, change24h: 0, volume24hUsd: null, high24hUsd: null, low24hUsd: null, sparkline: [], updatedAt: fx.updatedAt }
  assert.equal(pricePerUnit('USD', 'BTC', null, [btc]), 1 / 70000)
  assert.equal(pricePerUnit('MNT', 'BTC', fx, [btc]), 1 / (3500 * 70000))
  assert.equal(usdToCurrency(70000, 'BTC', null, [btc]), 1)
  assert.equal(convertAmount(1, 'BTC', 'BTC', null, []), 1)
  const small = pricePerUnit('MNT', 'BTC', fx, [btc])!
  assert.ok(Number(formatPrice(small).replaceAll(',', '')) > 0)
  assert.ok(Math.abs(convertAmount(convertAmount(100, 'MNT', 'BTC', fx, [btc])!, 'BTC', 'MNT', fx, [btc])! - 100) < 1e-9)
})
