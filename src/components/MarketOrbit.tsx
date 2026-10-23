import { useEffect, useMemo, useState } from 'react'
import { CONVERTER_ASSETS, MNT } from '../config'
import type { ChartSnapshot, Coin, FiatChartSnapshot, RateSnapshot } from '../types'
import { formatPrice, pricePerUnit, quoteDateLabel, usdToCurrency, compactNumber } from '../lib/money'
import { useRemoteResource } from '../lib/hooks'
import AssetPicker from './AssetPicker'
import PriceChart from './PriceChart'
import PriceTick from './PriceTick'
import Icon from './Icon'

export default function MarketOrbit({ fx, coins, displayCurrency, refreshVersion, selection, refreshQuotes }: { fx: RateSnapshot | null; coins: Coin[]; displayCurrency: string; refreshVersion: number; selection: { code: string; nonce: number }; refreshQuotes: () => void }) {
  const [code, setCode] = useState('USD'), [period, setPeriod] = useState(30)
  const asset = CONVERTER_ASSETS.find(a => a.code === code) ?? MNT
  const crypto = asset.type === 'crypto'
  const quote = CONVERTER_ASSETS.find(a => a.code === displayCurrency) ?? MNT
  const cryptoQuote = quote.type === 'crypto'
  const allowedPeriods = crypto ? [1, 7, 30] : [7, 30, 90]
  const days = allowedPeriods.includes(period) ? period : 30
  const historicalQuote = cryptoQuote ? 'USD' : displayCurrency
  const url = crypto ? `/api/market?resource=chart&coin=${asset.id}&days=${days}` : `/api/market?resource=fx-chart&currency=${code}&quote=${historicalQuote}&days=${days}`
  const key = crypto ? `chart:${asset.id}:${days}` : `fx-chart:${code}:${historicalQuote}:${days}`
  const chart = useRemoteResource<ChartSnapshot | FiatChartSnapshot>(url, key, crypto ? 900_000 : 3600_000)
  useEffect(() => { if (refreshVersion) chart.reload() }, [refreshVersion, chart.reload])
  useEffect(() => { if (selection.nonce) setCode(selection.code) }, [selection])
  const multiplier = code === displayCurrency ? 1 : crypto || cryptoQuote ? pricePerUnit('USD', displayCurrency, fx, coins) : 1
  const points = useMemo<[number, number][]>(() => multiplier == null ? [] : (chart.data?.points ?? []).flatMap(([time, price]) => {
    const value = code === displayCurrency ? 1 : price * multiplier
    return Number.isFinite(value) && value > 0 ? [[time, value] as [number, number]] : []
  }), [chart.data, multiplier, code, displayCurrency])
  const current = coins.find(c => c.symbol.toUpperCase() === code)
  const first = points[0]?.[1], last = points[points.length - 1]?.[1]
  const currentPrice = crypto ? pricePerUnit(code, displayCurrency, fx, coins) : last ?? pricePerUnit(code, displayCurrency, fx, coins)
  const change = crypto ? current?.change24h ?? null : first && last ? (last / first - 1) * 100 : null
  const values = points.map(p => p[1]), low = crypto ? usdToCurrency(current?.low24hUsd, displayCurrency, fx, coins) : values.length ? Math.min(...values) : null
  const high = crypto ? usdToCurrency(current?.high24hUsd, displayCurrency, fx, coins) : values.length ? Math.max(...values) : null
  const date = chart.data?.points.at(-1)?.[0]
  const quoteUnavailable = multiplier == null
  const label = crypto ? current?.live ? 'Live price' : current?.stale ? 'Saved price' : 'Reference quote' : 'Official daily history'
  return <section className="panel orbit-panel reveal" id="market-orbit" aria-labelledby="chart-title">
    <div className="panel-heading"><div><div className="section-eyebrow"><Icon name="chart" size={14} /> MARKET ORBIT</div><h2 id="chart-title">A little market perspective.</h2></div><span className="soft-label"><span className="status-dot" /> {displayCurrency} view</span></div>
    <div className="orbit-mode pill-tabs" aria-label="Market Orbit asset type"><button aria-pressed={!crypto} onClick={() => { setCode('USD'); setPeriod(30) }}><Icon name="globe" size={14} />Currencies</button><button aria-pressed={crypto} onClick={() => { setCode('BTC'); setPeriod(7) }}><Icon name="coin" size={14} />Crypto</button></div>
    <div className="chart-toolbar"><AssetPicker label="Market Orbit asset" value={code} onChange={setCode} options={CONVERTER_ASSETS.filter(a => a.type === asset.type)} /><div className="range-tabs" aria-label="Chart period">{allowedPeriods.map(d => <button key={d} aria-pressed={days === d} onClick={() => setPeriod(d)} className={days === d ? 'selected' : ''}>{d}D</button>)}</div></div>
    <div className="chart-price-row"><div className="chart-current-price"><span className="chart-value">{quote.symbol}<PriceTick value={currentPrice} /></span>{change != null && <span className={`change ${change >= 0 ? 'up' : 'down'}`}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>}<span className="change-period">{crypto ? '24h · USD' : `${days}D · ${displayCurrency}`}</span></div><div className="chart-mnt"><span className={`quote-source ${current?.live && crypto ? 'is-live' : ''}`}>{label}</span><span>1 {code} · {date && !crypto ? quoteDateLabel(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)) : displayCurrency}</span></div></div>
    <PriceChart key={`${code}:${days}:${displayCurrency}`} points={points} currency={quote} loading={chart.loading} error={quoteUnavailable ? `A current ${displayCurrency} conversion quote is unavailable. Try MNT or USD.` : chart.error} retry={quoteUnavailable ? refreshQuotes : chart.reload} daily={!crypto} />
    <div className="chart-stat-grid"><div><span>{crypto ? '24H LOW' : 'PERIOD LOW'}</span><strong>{quote.symbol}{formatPrice(low)}</strong></div><div><span>{crypto ? '24H HIGH' : 'PERIOD HIGH'}</span><strong>{quote.symbol}{formatPrice(high)}</strong></div><div><span>{crypto ? 'MARKET CAP' : 'PUBLISHED QUOTES'}</span><strong>{crypto ? `${quote.symbol}${compactNumber(usdToCurrency(current?.marketCapUsd, displayCurrency, fx, coins))}` : points.length || '—'}</strong></div></div>
    <p className="chart-fx-note">{code === displayCurrency ? `One ${code} always equals one ${code}.` : !crypto && !cryptoQuote ? 'Actual daily reference rates. Weekends and holidays may have no new quote. Bank buy/sell quotes are shown separately below.' : `Historical ${crypto ? 'crypto' : 'currency'} USD values converted with the latest ${displayCurrency} quote. This is a converted view, rather than historical ${displayCurrency} exchange rates.`}</p>
    <div className="chart-foot"><span>{chart.data?.stale || chart.fromCache ? 'Saved history' : chart.loading ? 'Loading history' : chart.data ? 'Published price history' : 'History unavailable'} · {days}-day view</span><span>{crypto ? 'Crypto' : 'Daily FX'} <Icon name="sparkles" size={12} /></span></div>
  </section>
}
