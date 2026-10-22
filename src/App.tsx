import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ASSETS, CURRENCIES, CRYPTOS, DISPLAY_CURRENCIES, SITE_NAME } from './config'
import type { Asset, ChartSnapshot, CryptoSnapshot, RateSnapshot } from './types'
import { compactNumber, dateTime, formatPrice, normalizeDisplayCurrency, pricePerUnit, usdToCurrency, type DisplayCurrency } from './lib/money'
import { useRemoteResource, useStoredState } from './lib/hooks'
import { useTheme } from './lib/useTheme'
import Icon, { type IconName } from './components/Icon'
import Sky from './components/Sky'
import PriceChart, { Sparkline } from './components/PriceChart'
import Converter from './components/Converter'
import DataDialog from './components/DataDialog'
import ThemeControl from './components/ThemeControl'
import CurrencyControl from './components/CurrencyControl'

type Filter = 'all' | 'currency' | 'crypto' | 'watchlist'
const FILTERS: { id: Filter; label: string; icon: IconName }[] = [
  { id: 'all', label: 'Overview', icon: 'grid' }, { id: 'currency', label: 'Currencies', icon: 'globe' },
  { id: 'crypto', label: 'Cryptocurrencies', icon: 'coin' }, { id: 'watchlist', label: 'Watchlist', icon: 'star' },
]

function AssetBadge({ asset, small = false }: { asset: Asset; small?: boolean }) {
  return <span className={`asset-badge ${small ? 'badge-small' : ''} ${asset.type}`} style={{ '--asset-color': asset.color } as CSSProperties}>{asset.symbol}</span>
}

function Change({ value }: { value: number | null | undefined }) {
  return value == null ? <span className="muted">—</span> : <span className={`change ${value >= 0 ? 'up' : 'down'}`}><span aria-hidden="true">{value >= 0 ? '↗' : '↘'}</span> {value >= 0 ? '+' : ''}{value.toFixed(2)}%</span>
}

export default function App() {
  const appearance = useTheme()
  const [storedCurrency, setDisplayCurrency] = useStoredState<DisplayCurrency>('prototype-crpt:display-currency', 'MNT')
  const displayCurrency = normalizeDisplayCurrency(storedCurrency)
  const quote = DISPLAY_CURRENCIES.find(c => c.code === displayCurrency)!
  const referenceCurrency = displayCurrency === 'USD' ? 'MNT' : 'USD'
  const reference = DISPLAY_CURRENCIES.find(c => c.code === referenceCurrency)!
  const fx = useRemoteResource<RateSnapshot>('/api/market?resource=rates', 'rates', 3600_000)
  const crypto = useRemoteResource<CryptoSnapshot>('/api/market?resource=crypto', 'crypto', 300_000)
  const [selectedCoin, setSelectedCoin] = useState('bitcoin')
  const [days, setDays] = useState(7)
  const chart = useRemoteResource<ChartSnapshot>(`/api/market?resource=chart&coin=${selectedCoin}&days=${days}`, `chart:${selectedCoin}:${days}`, 900_000)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('featured')
  const [storedWatchlist, setWatchlist] = useStoredState<string[]>('prototype-crpt:watchlist', ['USD', 'EUR', 'BTC'])
  const watchlist = Array.isArray(storedWatchlist) ? storedWatchlist.filter(c => ASSETS.some(a => a.code === c)) : []
  const [motion, setMotion] = useStoredState('prototype-crpt:motion', true)
  const [navOpen, setNavOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [now, setNow] = useState(new Date())
  const [convertRequest, setConvertRequest] = useState({ code: 'USD', to: displayCurrency, nonce: 0 })
  const searchRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDialogElement>(null)
  const coins = crypto.data?.coins ?? []
  const current = coins.find(c => c.id === selectedCoin)
  const currentAsset = CRYPTOS.find(c => c.id === selectedCoin)!
  const currentPrice = pricePerUnit(currentAsset.code, displayCurrency, fx.data, coins)
  const historyRate = pricePerUnit('USD', displayCurrency, fx.data, [])
  const historyNeedsFx = historyRate == null
  const displayedHistory = useMemo<[number, number][]>(() => historyRate == null ? [] : (chart.data?.points ?? []).flatMap(([time, price]) => {
    const value = price * historyRate
    return Number.isFinite(value) ? [[time, value] as [number, number]] : []
  }), [chart.data, historyRate])
  const forexStale = !!fx.data && (fx.fromCache || !!fx.data.stale || Date.now() - Date.parse(fx.data.updatedAt) > 48 * 3600_000)
  const cryptoStale = !!crypto.data && (crypto.fromCache || !!crypto.data.stale)
  const busy = fx.loading || crypto.loading
  const scrollBehavior: ScrollBehavior = motion && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant'

  useEffect(() => { document.documentElement.dataset.motion = motion ? 'on' : 'off' }, [motion])
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    if (navOpen && !menuRef.current?.open) menuRef.current?.showModal()
    if (!navOpen && menuRef.current?.open) menuRef.current?.close()
  }, [navOpen])
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '')) { event.preventDefault(); searchRef.current?.focus() }
      if (event.key === 'Escape') { setQuery(''); setNavOpen(false) }
    }
    document.addEventListener('keydown', shortcut)
    return () => document.removeEventListener('keydown', shortcut)
  }, [])

  function navigate(next: Filter) {
    setFilter(next); setQuery(''); setNavOpen(false)
    if (next === 'all') window.scrollTo({ top: 0, behavior: scrollBehavior })
    else document.getElementById('markets')?.scrollIntoView({ behavior: scrollBehavior, block: 'start' })
  }
  function chooseConversion(code: string) {
    setConvertRequest(previous => ({ code, to: displayCurrency, nonce: previous.nonce + 1 }))
    document.getElementById('converter')?.scrollIntoView({ behavior: scrollBehavior, block: 'center' })
  }
  function toggleWatch(code: string) { setWatchlist(watchlist.includes(code) ? watchlist.filter(c => c !== code) : [...watchlist, code]) }
  function refresh() { fx.reload(); crypto.reload(); chart.reload() }

  const visibleAssets = ASSETS.filter(a => (filter === 'all' || (filter === 'watchlist' ? watchlist.includes(a.code) : a.type === filter)) && `${a.code} ${a.name}`.toLowerCase().includes(query.toLowerCase().trim())).sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name)
    if (sort === 'featured') return 0
    const pa = pricePerUnit(a.code, displayCurrency, fx.data, coins), pb = pricePerUnit(b.code, displayCurrency, fx.data, coins)
    if (pa == null) return pb == null ? 0 : 1
    if (pb == null) return -1
    return sort === 'price-high' ? pb - pa : pa - pb
  })
  const navContent = <>
    <a href="#top" className="brand" onClick={() => navigate('all')} aria-label={`${SITE_NAME} home`}><span className="brand-mark"><Icon name="moon" size={24} /><i>✧</i></span><span>{SITE_NAME}<small>A different perspective.</small></span></a>
    <div className="nav-label">YOUR OBSERVATORY</div>
    <nav aria-label="Main navigation">{FILTERS.map(f => <button key={f.id} onClick={() => navigate(f.id)} className={`nav-link ${filter === f.id ? 'active' : ''}`} aria-current={filter === f.id ? 'page' : undefined}><Icon name={f.icon} size={19} />{f.label}{f.id === 'watchlist' ? <span className="nav-count">{watchlist.length}</span> : filter === f.id ? <span className="nav-dot" /> : null}</button>)}</nav>
    <div className="sidebar-note"><div className="tiny-orbit" aria-hidden="true"><i /><span /></div><span>GLOBAL PERSPECTIVE</span><p>Every currency.<br />A little closer to home.</p><div>Made for Mongolia <span>↗</span></div></div>
    <div className="sidebar-bottom"><ThemeControl {...appearance} /><button className="utility-link" onClick={() => setInfoOpen(true)}><Icon name="info" size={17} /> Data & sources <Icon name="arrowUp" size={14} /></button><button className="utility-link motion-button" onClick={() => setMotion(v => !v)} aria-pressed={!!motion}><Icon name={motion ? 'sparkles' : 'pause'} size={17} /> Ambient motion <span className={`toggle ${motion ? 'on' : ''}`} /></button><div className="sidebar-location"><span className="status-dot" />Ulaanbaatar, Mongolia<small>47.92° N &nbsp; 106.92° E</small></div></div>
  </>

  return <>
    <Sky />
    <a className="skip-link" href="#main">Skip to content</a>
    <aside className="sidebar">{navContent}</aside>
    <dialog className="mobile-nav" ref={menuRef} onClose={() => setNavOpen(false)} onClick={e => { if (e.target === e.currentTarget) setNavOpen(false) }} aria-label="Navigation"><button className="icon-button mobile-close" onClick={() => setNavOpen(false)} aria-label="Close menu"><Icon name="close" /></button>{navContent}</dialog>
    <div className="app-content" id="top">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-button menu-toggle" onClick={() => setNavOpen(true)} aria-label="Open menu"><Icon name="menu" /></button><span className="mobile-brand">{SITE_NAME}</span><span className="breadcrumb">Markets <span>/</span> <strong>{FILTERS.find(f => f.id === filter)?.label}</strong></span></div>
        <div className="topbar-actions"><label className="search-field"><Icon name="search" size={17} /><input ref={searchRef} value={query} onChange={e => { setQuery(e.target.value); document.getElementById('markets')?.scrollIntoView({ behavior: scrollBehavior, block: 'start' }) }} placeholder="Search assets…" aria-label="Search currencies and cryptocurrencies" /><kbd>/</kbd></label><button className="base-pill" onClick={() => document.getElementById('display-currency')?.focus()} aria-label={`Change display currency, currently ${displayCurrency}`}><span>{quote.symbol}</span> {displayCurrency}<Icon name="chevron" size={11} /></button><button className="icon-button refresh-button" onClick={refresh} disabled={busy} aria-label="Refresh market data" title="Refresh market data"><Icon name="refresh" size={18} className={busy ? 'spinning' : ''} /></button></div>
      </header>
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-text"><div className="section-eyebrow"><span className="small-star">✦</span> THE WORLD IN {displayCurrency === 'MNT' ? 'TÖGRÖG' : displayCurrency === 'USD' ? 'US DOLLARS' : 'EUROS'}</div><h1 id="hero-title">Global markets.<br /><em>Your local orbit.</em></h1><p>From the dollar to Bitcoin. A little perspective<br className="desktop-br" /> on a world that never stops moving.</p><div className="hero-dateline"><span className="status-dot" /> Ulaanbaatar <span className="dateline-separator">/</span> {new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ulaanbaatar', day: '2-digit', month: 'short', year: 'numeric' }).format(now)} <span className="dateline-separator">/</span> UTC+8</div></div>
          <div className="hero-cosmos" aria-hidden="true"><span className="cosmos-cross cross-one">✦</span><span className="cosmos-cross cross-two">+</span><span className="cosmos-cross cross-three">✧</span><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="planet"><span className="planet-texture" /></div><span className="orbit-satellite" /><span className="cosmos-caption">A SMALL WORLD.<br />ENDLESS POSSIBILITIES.</span><span className="cosmos-coordinates">☾ &nbsp; 01 / {displayCurrency}</span></div>
        </section>

        <section className="summary-grid" aria-label={`Featured prices in ${quote.name}`}>
          {['USD', 'EUR', 'CNY', 'BTC'].map((code, i) => {
            const asset = ASSETS.find(a => a.code === code)!
            const value = pricePerUnit(code, displayCurrency, fx.data, coins)
            const coin = coins.find(c => c.symbol.toUpperCase() === code)
            return <button className="summary-card reveal" style={{ animationDelay: `${i * 65}ms` }} key={code} onClick={() => chooseConversion(code)} aria-label={`Convert ${asset.name} to ${displayCurrency}`}><div className="summary-top"><AssetBadge asset={asset} small /><span>{asset.name}</span><Icon name="arrowUp" size={15} /></div><div className={`summary-price ${code === 'BTC' ? 'btc-price' : ''} ${formatPrice(value).length > 11 ? 'long-price' : ''}`}>{formatPrice(value)}<span>{quote.symbol}</span></div><div className="summary-bottom"><span>per 1 {code}</span>{asset.type === 'crypto' ? <Change value={coin?.change24h} /> : <span className="daily-tag">Daily reference</span>}</div></button>
          })}
        </section>

        {(fx.error || crypto.error || forexStale || cryptoStale) && <div className="data-notice" role="status"><Icon name="info" size={17} /><div>{fx.error && <p><strong>Currencies:</strong> {fx.data ? 'Showing saved rates. ' : ''}{fx.error}</p>}{crypto.error && <p><strong>Crypto:</strong> {crypto.data ? 'Showing saved prices. ' : ''}{crypto.error}</p>}{!fx.error && forexStale && <p>Currency rates are from a saved or older quote. Check the source time below.</p>}{!crypto.error && cryptoStale && <p>Crypto prices are from a saved or older quote. Check the source time below.</p>}</div><button className="text-button" onClick={refresh} disabled={busy}>Retry <Icon name="refresh" size={14} /></button></div>}

        <div className="dashboard-grid">
          <section className="panel orbit-panel reveal" aria-labelledby="chart-title">
            <div className="panel-heading"><div><div className="section-eyebrow"><Icon name="chart" size={14} /> MARKET ORBIT</div><h2 id="chart-title">A little market perspective.</h2></div><span className="soft-label"><span className="status-dot" /> {displayCurrency} view</span></div>
            <div className="chart-toolbar"><div className="coin-selector"><AssetBadge asset={currentAsset} small /><select value={selectedCoin} onChange={e => setSelectedCoin(e.target.value)} aria-label="Chart cryptocurrency">{CRYPTOS.map(c => <option value={c.id} key={c.id}>{c.name} · {c.code}</option>)}</select><Icon name="chevron" size={14} /></div><div className="range-tabs" aria-label="Chart period">{[1, 7, 30].map(d => <button key={d} aria-pressed={days === d} onClick={() => setDays(d)} className={days === d ? 'selected' : ''}>{d}D</button>)}</div></div>
            <div className="chart-price-row"><div className="chart-current-price"><span className="chart-value">{quote.symbol}{formatPrice(currentPrice)}</span><Change value={current?.change24h} /><span className="change-period">24h · USD</span></div><div className="chart-mnt">≈ {formatPrice(pricePerUnit(currentAsset.code, referenceCurrency, fx.data, coins))} <span>{referenceCurrency}</span></div></div>
            <PriceChart key={`${selectedCoin}-${days}-${displayCurrency}`} points={displayedHistory} currency={quote} loading={chart.loading || (historyNeedsFx && fx.loading)} error={historyNeedsFx ? 'An exchange rate is needed for this currency. Refresh market data or choose USD.' : chart.error} retry={historyNeedsFx ? refresh : chart.reload} />
            <div className="chart-stat-grid"><div><span>24H LOW</span><strong>{quote.symbol}{formatPrice(usdToCurrency(current?.low24hUsd, displayCurrency, fx.data))}</strong></div><div><span>24H HIGH</span><strong>{quote.symbol}{formatPrice(usdToCurrency(current?.high24hUsd, displayCurrency, fx.data))}</strong></div><div><span>MARKET CAP</span><strong>{quote.symbol}{compactNumber(usdToCurrency(current?.marketCapUsd, displayCurrency, fx.data))}</strong></div></div>
            {displayCurrency !== 'USD' && <p className="chart-fx-note">USD history converted to {displayCurrency} using the latest reference FX rate.</p>}
            <div className="chart-foot"><span>{chart.data ? chart.data.stale || chart.fromCache ? 'Saved history' : `Historical ${displayCurrency} prices` : chart.loading ? 'Loading history' : 'History unavailable'} · {days}-day view</span><span>CoinGecko <Icon name="sparkles" size={12} /></span></div>
          </section>
          <Converter fx={fx.data} coins={coins} request={convertRequest} displayCurrency={displayCurrency} forexStale={forexStale} cryptoStale={cryptoStale} />
        </div>

        <section className="panel markets-panel reveal" id="markets" aria-labelledby="markets-title">
          <div className="market-heading"><div><div className="section-eyebrow">A WORLD OF VALUE</div><h2 id="markets-title">Find your next point of view<span>.</span></h2></div><button className="text-button data-button" onClick={() => setInfoOpen(true)}>About the data <Icon name="info" size={15} /></button></div>
          <div className="market-controls"><div className="filter-tabs" aria-label="Asset filter">{FILTERS.map(f => <button key={f.id} onClick={() => setFilter(f.id)} className={filter === f.id ? 'selected' : ''} aria-pressed={filter === f.id}>{f.id === 'all' ? 'All assets' : f.id === 'crypto' ? 'Crypto' : f.label}{f.id === 'watchlist' && <span>{watchlist.length}</span>}</button>)}</div><label className="sort-control"><span className="sr-only">Sort assets</span><select value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Featured first</option><option value="name">Name A–Z</option><option value="price-high">Highest {displayCurrency} price</option><option value="price-low">Lowest {displayCurrency} price</option></select><Icon name="chevron" size={14} /></label></div>
          <div className="table-scroll"><table><thead><tr><th scope="col" className="star-column"><span className="sr-only">Favorite</span><Icon name="star" size={14} /></th><th scope="col">Asset</th><th scope="col" className="numeric">Price <span>{displayCurrency}</span></th><th scope="col" className="numeric usd-column">Price <span>{referenceCurrency}</span></th><th scope="col" className="numeric">24h change</th><th scope="col" className="trend-column">Last 7 days</th><th scope="col"><span className="sr-only">Convert</span></th></tr></thead><tbody>
            {visibleAssets.map(asset => {
              const coin = coins.find(c => c.id === asset.id)
              const price = pricePerUnit(asset.code, displayCurrency, fx.data, coins)
              const referencePrice = pricePerUnit(asset.code, referenceCurrency, fx.data, coins)
              const watched = watchlist.includes(asset.code)
              return <tr key={asset.code}><td className="star-column"><button className={`favorite-button ${watched ? 'is-favorite' : ''}`} onClick={() => toggleWatch(asset.code)} aria-pressed={watched} aria-label={`${watched ? 'Remove' : 'Add'} ${asset.name} ${watched ? 'from' : 'to'} watchlist`}><Icon name="star" size={16} /></button></td><td><button className="asset-cell" onClick={() => chooseConversion(asset.code)} aria-label={`Convert ${asset.name} to ${displayCurrency}`}><AssetBadge asset={asset} /><span><strong>{asset.name}</strong><small>{asset.code} <i>·</i> {asset.type === 'crypto' ? 'Crypto' : 'Currency'}</small></span></button></td><td className="numeric mnt-cell">{formatPrice(price)} <span>{quote.symbol}</span></td><td className="numeric usd-column">{reference.symbol}{formatPrice(referencePrice)}</td><td className="numeric">{asset.type === 'crypto' ? <Change value={coin?.change24h} /> : <span className="daily-reference">Daily reference</span>}</td><td className="trend-column">{asset.type === 'crypto' ? <Sparkline values={coin?.sparkline ?? []} /> : <span className="fx-trend">Daily quote <span>↔</span></span>}</td><td><button className="row-convert" onClick={() => chooseConversion(asset.code)} aria-label={`Open ${asset.code} converter`}><Icon name="arrowUp" size={16} /></button></td></tr>
            })}
            {!visibleAssets.length && <tr><td colSpan={7}><div className="empty-assets"><Icon name={filter === 'watchlist' ? 'star' : 'search'} size={26} /><h3>{filter === 'watchlist' && !query ? 'A few stars of your own.' : 'No assets in this orbit.'}</h3><p>{filter === 'watchlist' && !query ? 'Tap the star beside an asset to keep it in your watchlist.' : 'Try another name, currency code, or asset filter.'}</p><button className="text-button" onClick={() => { setQuery(''); setFilter('all') }}>Explore all assets <Icon name="arrow" size={14} /></button></div></td></tr>}
          </tbody></table></div>
          <div className="table-foot"><span>{visibleAssets.length} of {CURRENCIES.length + CRYPTOS.length} assets <i>·</i> All prices per 1 unit</span><span><Icon name="star" size={12} /> Your favorites stay in this browser</span></div>
        </section>

        <div className="source-strip"><div><span className={`status-dot ${fx.error || crypto.error || forexStale || cryptoStale ? 'dot-warning' : ''}`} />{busy ? 'Checking market sources' : fx.error || crypto.error || forexStale || cryptoStale ? 'Some quotes are unavailable or saved' : 'Connected to market sources'}</div><span>FX: {dateTime(fx.data?.updatedAt)} <i>·</i> Crypto: {dateTime(current?.updatedAt)} <i>·</i> UTC+8</span></div>
        <footer><a className="footer-brand" href="#top"><Icon name="moon" size={15} /> {SITE_NAME}</a><p>Global markets. A local perspective.</p><div><a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates By Exchange Rate API</a><span>·</span><a href="https://www.coingecko.com" target="_blank" rel="noreferrer">CoinGecko</a></div></footer>
      </main>
    </div>
    <CurrencyControl value={displayCurrency} onChange={setDisplayCurrency} />
    <DataDialog open={infoOpen} close={() => setInfoOpen(false)} />
  </>
}
