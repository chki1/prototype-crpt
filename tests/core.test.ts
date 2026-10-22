import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { convertAmount, mntPerUnit } from '../src/lib/money.js'
import { createMarketService } from '../server/market-service.js'
import type { Coin, RateSnapshot } from '../src/types.js'
import { normalizeThemePreference, resolveTheme } from '../src/lib/theme.js'

// Synthetic values belong only in tests; the application has no fabricated price fallback.
const fx: RateSnapshot = {
  source: 'ExchangeRate-API', rates: { USD: 1, MNT: 3500, CNY: 7, EUR: .9, JPY: 150, KRW: 1300 },
  updatedAt: '2026-10-22T00:00:00Z', nextUpdateAt: '2026-10-23T00:00:00Z', fetchedAt: '2026-10-22T00:00:00Z',
}
const bitcoin: Coin = { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', priceUsd: 67000, change24h: 1.2, marketCapUsd: null, volume24hUsd: null, high24hUsd: null, low24hUsd: null, sparkline: [], updatedAt: fx.updatedAt }

test('USD and cross rates represent one unit in MNT', () => {
  assert.equal(mntPerUnit('USD', fx, []), 3500)
  assert.equal(mntPerUnit('CNY', fx, []), 500)
  assert.equal(mntPerUnit('EUR', fx, []), 3500 / .9)
  assert.equal(mntPerUnit('JPY', fx, []), 3500 / 150)
  assert.equal(mntPerUnit('MNT', null, []), 1)
})

test('conversion handles reverse direction, cross currency, crypto, and round trips', () => {
  assert.equal(convertAmount(1, 'USD', 'MNT', fx, []), 3500)
  assert.equal(convertAmount(3500, 'MNT', 'USD', fx, []), 1)
  assert.equal(convertAmount(100, 'CNY', 'MNT', fx, []), 50000)
  assert.equal(convertAmount(1, 'BTC', 'MNT', fx, [bitcoin]), 234500000)
  assert.equal(convertAmount(1, 'BTC', 'USD', fx, [bitcoin]), 67000)
  const euros = convertAmount(123.45, 'USD', 'EUR', fx, [])!
  assert.ok(Math.abs(convertAmount(euros, 'EUR', 'USD', fx, [])! - 123.45) < 1e-10)
})

test('unavailable or invalid rates never produce NaN, Infinity, or invented quotes', () => {
  assert.equal(convertAmount(0, 'USD', 'MNT', fx, []), 0)
  assert.equal(convertAmount(-1, 'USD', 'MNT', fx, []), null)
  assert.equal(convertAmount(Infinity, 'USD', 'MNT', fx, []), null)
  assert.equal(convertAmount(NaN, 'USD', 'MNT', fx, []), null)
  assert.equal(convertAmount(1, 'USD', 'MNT', null, []), null)
  assert.equal(mntPerUnit('BTC', fx, []), null)
  assert.equal(mntPerUnit('UNKNOWN', fx, []), null)
  assert.equal(mntPerUnit('USD', { ...fx, rates: { MNT: 0, USD: 1 } }, []), null)
})

test('API rejects unsupported resources and arbitrary coin URLs before making a network request', async () => {
  let calls = 0
  const service = createMarketService(async () => { calls++; throw new Error('Not expected') })
  assert.equal((await service(new URLSearchParams('resource=nope'))).status, 400)
  assert.equal((await service(new URLSearchParams('resource=chart&coin=https://example.com&days=7'))).status, 400)
  assert.equal((await service(new URLSearchParams('resource=chart&coin=bitcoin&days=365'))).status, 400)
  assert.equal((await service(new URLSearchParams('resource=rates'), 'POST')).status, 405)
  assert.equal(calls, 0)
})

function providerRates() {
  return { result: 'success', base_code: 'USD', rates: fx.rates, time_last_update_unix: Date.parse(fx.updatedAt) / 1000, time_next_update_unix: Date.parse(fx.nextUpdateAt) / 1000 }
}

test('API coalesces concurrent requests and caches successful data', async () => {
  let calls = 0
  const service = createMarketService(async () => { calls++; await Promise.resolve(); return Response.json(providerRates()) }, () => Date.parse(fx.updatedAt))
  const params = new URLSearchParams('resource=rates')
  const results = await Promise.all([service(params), service(params), service(params)])
  assert.ok(results.every(r => r.status === 200 && 'rates' in r.body && r.body.rates.MNT === 3500))
  await service(params)
  assert.equal(calls, 1)
})

test('API clearly marks a cached fallback when an expired quote cannot refresh', async () => {
  let instant = Date.parse(fx.updatedAt), calls = 0
  const service = createMarketService(async () => { calls++; if (calls > 1) return new Response('Limited', { status: 429 }); return Response.json(providerRates()) }, () => instant)
  const params = new URLSearchParams('resource=rates')
  assert.equal((await service(params)).status, 200)
  instant += 3600_001
  const fallback = await service(params)
  assert.equal(fallback.status, 200)
  assert.equal('stale' in fallback.body && fallback.body.stale, true)
  assert.equal(fallback.headers['Cache-Control'], 'no-store')
})

test('API refuses malformed provider data and returns an honest unavailable state', async () => {
  const service = createMarketService(async () => Response.json({ ...providerRates(), rates: { MNT: 0 } }))
  const response = await service(new URLSearchParams('resource=rates'))
  assert.equal(response.status, 503)
  assert.ok('error' in response.body)
  assert.equal(response.headers['Cache-Control'], 'no-store')
})

test('chart responses preserve actual timestamps, sort points, and reject nonfinite prices', async () => {
  const service = createMarketService(async () => Response.json({ prices: [[3000, 12], [1000, 10], [2000, null], [4000, -1]] }), () => 5000)
  const response = await service(new URLSearchParams('resource=chart&coin=bitcoin&days=7'))
  assert.equal(response.status, 200)
  assert.ok('points' in response.body)
  if ('points' in response.body) assert.deepEqual(response.body.points, [[1000, 10], [3000, 12]])
})

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const appearanceInit = html.match(/<script id="appearance-init">([\s\S]*?)<\/script>/)?.[1]
assert.ok(appearanceInit, 'The first-paint appearance bootstrap must exist')

function firstPaint(saved: string | null, systemDark: boolean, storageBlocked = false) {
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> }
  const meta: Record<string, string> = {}
  runInNewContext(appearanceInit!, {
    localStorage: { getItem() { if (storageBlocked) throw new Error('Storage blocked'); return saved } },
    window: { matchMedia() { return { matches: systemDark } } },
    document: { documentElement: root, querySelector() { return { setAttribute(name: string, value: string) { meta[name] = value } } } },
  })
  return { ...root, meta }
}

test('first paint follows the system without a saved override and sets native control colors', () => {
  const light = firstPaint(null, false), dark = firstPaint(null, true)
  assert.equal(light.dataset.appearance, 'system')
  assert.equal(light.dataset.theme, 'light')
  assert.equal(light.style.colorScheme, 'light')
  assert.equal(light.meta.content, '#edf0f8')
  assert.equal(dark.dataset.theme, 'dark')
  assert.equal(dark.style.colorScheme, 'dark')
  assert.equal(dark.meta.content, '#0b0c17')
})

test('a manual choice survives reload and takes priority over the device theme', () => {
  assert.equal(firstPaint(JSON.stringify('dark'), false).dataset.theme, 'dark')
  assert.equal(firstPaint(JSON.stringify('light'), true).dataset.theme, 'light')
  assert.equal(resolveTheme('system', false), 'light')
  assert.equal(resolveTheme('system', true), 'dark')
  assert.equal(resolveTheme('light', true), 'light')
  assert.equal(resolveTheme('dark', false), 'dark')
})

test('malformed, unsupported, or blocked appearance storage safely falls back to the system', () => {
  for (const invalid of ['not-json', JSON.stringify('blue'), JSON.stringify({ theme: 'dark' })]) {
    assert.equal(firstPaint(invalid, true).dataset.theme, 'dark')
    assert.equal(firstPaint(invalid, true).dataset.appearance, 'system')
  }
  assert.equal(firstPaint(null, false, true).dataset.theme, 'light')
  assert.equal(normalizeThemePreference('unknown'), 'system')
  assert.equal(normalizeThemePreference(null), 'system')
})
