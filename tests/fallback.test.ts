import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CURRENCIES } from '../src/config.js'
import { convertAmount, rateLabel } from '../src/lib/money.js'
import { FALLBACK_RATES_URL, loadFiatRates, parseFallbackRates } from '../server/currency-fallback.js'
import { createMarketService } from '../server/market-service.js'

// Synthetic quotes for failure and conversion checks; never used by the app.
const time = Date.parse('2026-10-23T02:00:00Z')
const values: Record<string, number> = { USD: 3600, EUR: 4000, CNY: 500, JPY: 24, KRW: 3, GBP: 4800, RUB: 45, AUD: 2500, CAD: 2600, CHF: 4400, SGD: 2800, HKD: 460 }
const primary = { success: true, data: [{ RATE_DATE: '2026-10-22', ...values }] }
function bankHtml() {
  const rows = CURRENCIES.map(c => `<tr><td><img src="unused"></td><td>${c.code}</td><td>${c.name}</td><td>1</td><td>${values[c.code] - .5}</td><td>${values[c.code]}</td><td>1</td><td>9999</td></tr>`).join('')
  return `<input type="date" value="2026-10-23" id="edit-date"><table id="edit-table"><tr><td>Валют</td><td>Монгол банк</td><td>Бэлэн бус</td><td>Бэлэн</td></tr><tr><td>Авах</td><td>Зарах</td><td>Авах</td><td>Зарах</td></tr>${rows}</table>`
}

test('one-bank fallback selects non-cash SELL, preserves the date, and normalizes per one unit', () => {
  const fx = parseFallbackRates(bankHtml(), time)
  assert.equal(fx.source, 'TDB')
  assert.equal(fx.rateType, 'bank-transfer-sell')
  assert.equal(fx.quoteDate, '2026-10-23')
  assert.equal(fx.rates.MNT, 3600)
  assert.equal(convertAmount(1, 'EUR', 'MNT', fx, []), 4000)
  assert.equal(convertAmount(1, 'JPY', 'MNT', fx, []), 24)
  assert.equal(convertAmount(1, 'KRW', 'MNT', fx, []), 3)
  assert.equal(rateLabel(fx), 'Bank sell')
  assert.equal(rateLabel(null), 'Daily reference')
})

test('bank fallback rejects missing cells, duplicate currencies, wrong columns, invalid dates and spreads', () => {
  const html = bankHtml()
  for (const broken of [
    html.replace('<td>EUR</td>', '<td>NONE</td>'),
    html.replace('</table>', `${html.match(/<tr><td><img[\s\S]*?<\/tr>/)![0]}</table>`),
    html.replace('Бэлэн бус', 'Бэлэн'),
    html.replace('<td>4000</td>', '<td>0</td>'),
    html.replace('<td>4000</td>', '<td>3,00.00</td>'),
    html.replace('<td>4000</td>', '<td>3990</td>'),
    html.replace('2026-10-23', '2026-10-24'),
    html.replace('2026-10-23', '2026-02-30'),
    html.replace('2026-10-23', '2026-10-01'),
  ]) assert.throws(() => parseFallbackRates(broken, time))
})

test('a healthy primary response never requests a commercial bank', async () => {
  const calls: string[] = []
  const fx = await loadFiatRates(async (url, init) => { calls.push(String(url)); assert.equal(init?.method, 'POST'); return Response.json(primary) }, () => time)
  assert.equal(fx.source, 'Bank of Mongolia')
  assert.equal(fx.rateType, 'reference')
  assert.equal(calls.length, 1)
})

test('primary network, HTTP, validation and old-quote failures each use only the one configured bank', async () => {
  for (const failure of ['network', 'http', 'invalid', 'old']) {
    const calls: string[] = []
    const fx = await loadFiatRates(async (url, init) => {
      calls.push(String(url))
      if (calls.length === 1) {
        if (failure === 'network') throw new Error('Offline')
        if (failure === 'http') return new Response('Limited', { status: 429 })
        return Response.json(failure === 'old' ? { ...primary, data: [{ ...values, RATE_DATE: '2026-10-01' }] } : { success: false })
      }
      assert.equal(String(url), FALLBACK_RATES_URL)
      assert.equal(init?.headers && (init.headers as Record<string, string>).Accept, 'text/html')
      return new Response(bankHtml())
    }, () => time)
    assert.equal(fx.source, 'TDB')
    assert.equal(calls.length, 2)
  }
})

test('API coalesces fallback requests, caches for 15 minutes, then returns to a recovered primary', async () => {
  let now = time, recovered = false, calls = 0
  const service = createMarketService(async url => {
    calls++
    return String(url) === FALLBACK_RATES_URL ? new Response(bankHtml()) : recovered ? Response.json(primary) : new Response('Unavailable', { status: 503 })
  }, () => now)
  const params = new URLSearchParams('resource=rates&feed=auto-v1')
  const results = await Promise.all([service(params), service(params)])
  assert.equal(calls, 2)
  assert.ok(results.every(r => r.status === 200 && 'source' in r.body && r.body.source === 'TDB'))
  assert.match(results[0].headers['Cache-Control'], /s-maxage=900/)
  await service(params)
  assert.equal(calls, 2)
  recovered = true; now += 900_001
  const latest = await service(params)
  assert.equal(calls, 3)
  assert.equal('source' in latest.body && latest.body.source, 'Bank of Mongolia')
})

test('both providers failing returns unavailable without fabricated rates or public bank names', async () => {
  const service = createMarketService(async () => new Response('Unavailable', { status: 503 }), () => time)
  const result = await service(new URLSearchParams('resource=rates'))
  assert.equal(result.status, 503)
  assert.equal('rates' in result.body, false)
  assert.deepEqual(result.body, { error: 'Currency rates are temporarily unavailable. Please retry shortly.' })
})

test('an expired fallback is saved only for a day if both upstreams fail', async () => {
  let now = time, failed = false
  const service = createMarketService(async url => String(url) === FALLBACK_RATES_URL && !failed ? new Response(bankHtml()) : new Response('Unavailable', { status: 503 }), () => now)
  const params = new URLSearchParams('resource=rates')
  assert.equal((await service(params)).status, 200)
  failed = true; now += 900_001
  const saved = await service(params)
  assert.equal(saved.status, 200)
  assert.equal('stale' in saved.body && saved.body.stale, true)
  now += 86400_000
  assert.equal((await service(params)).status, 503)
})
