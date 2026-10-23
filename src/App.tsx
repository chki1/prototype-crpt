import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ASSETS, CURRENCIES, CRYPTOS, DISPLAY_CURRENCIES, SITE_NAME } from './config'
import type { Asset, CryptoSnapshot, RateSnapshot } from './types'
import { formatPrice, quoteDateLabel, rateLabel, quoteTime, normalizeDisplayCurrency, pricePerUnit, type DisplayCurrency } from './lib/money'
import { useRemoteResource, useStoredState } from './lib/hooks'
import { useTheme } from './lib/useTheme'
import { useLivePrices } from './lib/useLivePrices'
import Icon, { type IconName } from './components/Icon'
import Sky from './components/Sky'
import { Sparkline } from './components/PriceChart'
import MarketOrbit from './components/MarketOrbit'
import BankRates from './components/BankRates'
import Converter from './components/Converter'
import DataDialog from './components/DataDialog'
import ThemeControl from './components/ThemeControl'
import CurrencyControl from './components/CurrencyControl'
import PriceTick from './components/PriceTick'

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
  const fx = useRemoteResource<RateSnapshot>('/api/market?resource=rates&feed=auto-v1', 'rates:auto-v1', 900_000)
  const crypto = useRemoteResource<CryptoSnapshot>('/api/market?resource=crypto', 'crypto', 300_000)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [orbitSelection, setOrbitSelection] = useState({ code: 'USD', nonce: 0 })
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
  const referenceCoins = useMemo(() => crypto.data?.coins ?? [], [crypto.data])
  const live = useLivePrices(referenceCoins, crypto.fromCache || !!crypto.data?.stale || !!crypto.error)
  const coins = live.coins
  const liveCount = coins.filter(c => c.live).length
  const liveLabel = { connecting: 'Connecting live prices', live: 'Live crypto', reconnecting: 'Reconnecting', offline: 'Offline', paused: 'Live paused', unsupported: 'Reference prices' }[live.status]
  const referenceError = !!crypto.error && liveCount < CRYPTOS.length
  const forexStale = !!fx.data && (fx.fromCache || !!fx.data.stale || Date.now() - Date.parse(fx.data.updatedAt) > (fx.data.rateType === 'bank-transfer-sell' ? 86400_000 : 7 * 86400_000))
  const cryptoStale = coins.some(c => c.stale)
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
    if (next === 'currency' || next === 'crypto') setOrbitSelection(previous => ({ code: next === 'crypto' ? 'BTC' : 'USD', nonce: previous.nonce + 1 }))
    if (next === 'all') window.scrollTo({ top: 0, behavior: scrollBehavior })
    else document.getElementById('markets')?.scrollIntoView({ behavior: scrollBehavior, block: 'start' })
  }
  function chooseConversion(code: string) {
    setOrbitSelection(previous => ({ code, nonce: previous.nonce + 1 }))
    setConvertRequest(previous => ({ code, to: displayCurrency, nonce: previous.nonce + 1 }))
    document.getElementById('converter')?.scrollIntoView({ behavior: scrollBehavior, block: 'center' })
  }
  function toggleWatch(code: string) { setWatchlist(watchlist.includes(code) ? watchlist.filter(c => c !== code) : [...watchlist, code]) }
  function refresh() { fx.reload(); crypto.reload(); setRefreshVersion(value => value + 1); live.reconnect() }
  function trackCurrency(code: string) { setOrbitSelection(previous => ({ code, nonce: previous.nonce + 1 })); document.getElementById('market-orbit')?.scrollIntoView({ behavior: scrollBehavior, block: 'start' }) }

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
        <div className="topbar-actions"><label className="search-field"><Icon name="search" size={17} /><input ref={searchRef} value={query} onChange={e => { setQuery(e.target.value); document.getElementById('markets')?.scrollIntoView({ behavior: scrollBehavior, block: 'start' }) }} placeholder="Search assets…" aria-label="Search currencies and cryptocurrencies" /><kbd>/</kbd></label><CurrencyControl value={displayCurrency} onChange={setDisplayCurrency} /><button className="icon-button refresh-button" onClick={refresh} disabled={busy} aria-label="Refresh market data" title="Refresh market data"><Icon name="refresh" size={18} className={busy ? 'spinning' : ''} /></button></div>
      </header>
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-text"><div className="section-eyebrow"><span className="small-star">✦</span> THE WORLD IN {displayCurrency === 'MNT' ? 'TÖGRÖG' : quote.name.toUpperCase()}</div><h1 id="hero-title">Global markets.<br /><em>Your local orbit.</em></h1><p>From the dollar to Bitcoin. A little perspective<br className="desktop-br" /> on a world that never stops moving.</p><div className="hero-dateline"><span className="status-dot" /> Ulaanbaatar <span className="dateline-separator">/</span> {new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ulaanbaatar', day: '2-digit', month: 'short', year: 'numeric' }).format(now)} <span className="dateline-separator">/</span> UTC+8</div></div>
          <div className="hero-cosmos" aria-hidden="true"><span className="cosmos-cross cross-one">✦</span><span className="cosmos-cross cross-two">+</span><span className="cosmos-cross cross-three">✧</span><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="planet"><span className="planet-texture" /></div><span className="orbit-satellite" /><span className="cosmos-caption">A SMALL WORLD.<br />ENDLESS POSSIBILITIES.</span><span className="cosmos-coordinates">☾ &nbsp; 01 / {displayCurrency}</span></div>
        </section>

        <div className="live-feed-bar"><div className={`live-feed-state ${live.status === 'live' ? 'is-live' : ''}`} role="status"><span className="feed-light" />{liveLabel}{live.status === 'live' && <small>{liveCount}/{CRYPTOS.length} pairs</small>}</div><span>{fx.data ? `${rateLabel(fx.data)} · ${quoteDateLabel(fx.data.quoteDate)}` : 'Currency rates'}{live.lastPriceAt && <> <i>·</i> Tick {quoteTime(new Date(live.lastPriceAt).toISOString())} UTC+8</>}</span></div>
        {live.message && <p className="live-feed-note">{live.message}</p>}

        <section className="summary-grid" aria-label={`Featured prices in ${quote.name}`}>
          {['USD', 'EUR', 'CNY', 'BTC'].map((code, i) => {
            const asset = ASSETS.find(a => a.code === code)!
            const value = pricePerUnit(code, displayCurrency, fx.data, coins)
            const coin = coins.find(c => c.symbol.toUpperCase() === code)
            return <button className="summary-card reveal" style={{ animationDelay: `${i * 65}ms` }} key={code} onClick={() => chooseConversion(code)} aria-label={`Convert ${asset.name} to ${displayCurrency}`}><div className="summary-top"><AssetBadge asset={asset} small /><span>{asset.name}</span><Icon name="arrowUp" size={15} /></div><div className={`summary-price ${code === 'BTC' ? 'btc-price' : ''} ${formatPrice(value).length > 11 ? 'long-price' : ''}`}><PriceTick value={value} /><span className="price-symbol">{quote.symbol}</span></div><div className="summary-bottom"><span>per 1 {code}</span>{asset.type === 'crypto' ? <Change value={coin?.change24h} /> : <span className="daily-tag">{rateLabel(fx.data)}</span>}</div></button>
          })}
        </section>

        {(fx.error || referenceError || forexStale || cryptoStale) && <div className="data-notice" role="status"><Icon name="info" size={17} /><div>{fx.error && <p><strong>Currencies:</strong> {fx.data ? 'Showing saved rates. ' : ''}{fx.error}</p>}{referenceError && <p><strong>Crypto reference data:</strong> {coins.length ? 'Showing available or saved quotes. ' : ''}{crypto.error}</p>}{!fx.error && forexStale && <p>Currency rates are from a saved or older quote. Check the quote time below.</p>}{!referenceError && cryptoStale && <p>Some crypto prices are saved or waiting for live updates. Check the quote time below.</p>}</div><button className="text-button" onClick={refresh} disabled={busy}>Retry <Icon name="refresh" size={14} /></button></div>}

        <div className="dashboard-grid">
          <MarketOrbit fx={fx.data} coins={coins} displayCurrency={displayCurrency} refreshVersion={refreshVersion} selection={orbitSelection} refreshQuotes={refresh} />
          <Converter fx={fx.data} coins={coins} request={convertRequest} displayCurrency={displayCurrency} forexStale={forexStale} cryptoStale={cryptoStale} />
        </div>

        <BankRates refreshVersion={refreshVersion} onTrack={trackCurrency} />

        <section className="panel markets-panel reveal" id="markets" aria-labelledby="markets-title">
          <div className="market-heading"><div><div className="section-eyebrow">A WORLD OF VALUE</div><h2 id="markets-title">Find your next point of view<span>.</span></h2></div><button className="text-button data-button" onClick={() => setInfoOpen(true)}>About the data <Icon name="info" size={15} /></button></div>
          <div className="market-controls"><div className="filter-tabs" aria-label="Asset filter">{FILTERS.map(f => <button key={f.id} onClick={() => setFilter(f.id)} className={filter === f.id ? 'selected' : ''} aria-pressed={filter === f.id}>{f.id === 'all' ? 'All assets' : f.id === 'crypto' ? 'Crypto' : f.label}{f.id === 'watchlist' && <span>{watchlist.length}</span>}</button>)}</div><label className="sort-control"><span className="sr-only">Sort assets</span><select value={sort} onChange={e => setSort(e.target.value)}><option value="featured">Featured first</option><option value="name">Name A–Z</option><option value="price-high">Highest {displayCurrency} price</option><option value="price-low">Lowest {displayCurrency} price</option></select><Icon name="chevron" size={14} /></label></div>
          <div className="table-scroll"><table><thead><tr><th scope="col" className="star-column"><span className="sr-only">Favorite</span><Icon name="star" size={14} /></th><th scope="col">Asset</th><th scope="col" className="numeric">Price <span>{displayCurrency}</span></th><th scope="col" className="numeric usd-column">Price <span>{referenceCurrency}</span></th><th scope="col" className="numeric">24h change</th><th scope="col" className="trend-column">Last 7 days</th><th scope="col"><span className="sr-only">Convert</span></th></tr></thead><tbody>
            {visibleAssets.map(asset => {
              const coin = coins.find(c => c.id === asset.id)
              const price = pricePerUnit(asset.code, displayCurrency, fx.data, coins)
              const referencePrice = pricePerUnit(asset.code, referenceCurrency, fx.data, coins)
              const watched = watchlist.includes(asset.code)
              return <tr key={asset.code}><td className="star-column"><button className={`favorite-button ${watched ? 'is-favorite' : ''}`} onClick={() => toggleWatch(asset.code)} aria-pressed={watched} aria-label={`${watched ? 'Remove' : 'Add'} ${asset.name} ${watched ? 'from' : 'to'} watchlist`}><Icon name="star" size={16} /></button></td><td><button className="asset-cell" onClick={() => chooseConversion(asset.code)} aria-label={`Convert ${asset.name} to ${displayCurrency}`}><AssetBadge asset={asset} /><span><strong>{asset.name}</strong><small>{asset.code} <i>·</i> {asset.type === 'crypto' ? <span className={coin?.live ? 'live-asset-label' : ''}>{coin?.live ? 'Live' : coin?.priceSource === 'Kraken' ? 'Last live' : 'Reference'}</span> : rateLabel(fx.data)}</small></span></button></td><td className="numeric mnt-cell"><PriceTick value={price} /> <span className="price-symbol">{quote.symbol}</span></td><td className="numeric usd-column">{reference.symbol}<PriceTick value={referencePrice} /></td><td className="numeric">{asset.type === 'crypto' ? <Change value={coin?.change24h} /> : <span className="daily-reference">{rateLabel(fx.data)}</span>}</td><td className="trend-column">{asset.type === 'crypto' ? <Sparkline values={coin?.sparkline ?? []} /> : <span className="fx-trend">Daily quote <span>↔</span></span>}</td><td><button className="row-convert" onClick={() => chooseConversion(asset.code)} aria-label={`Open ${asset.code} converter`}><Icon name="arrowUp" size={16} /></button></td></tr>
            })}
            {!visibleAssets.length && <tr><td colSpan={7}><div className="empty-assets"><Icon name={filter === 'watchlist' ? 'star' : 'search'} size={26} /><h3>{filter === 'watchlist' && !query ? 'A few stars of your own.' : 'No assets in this orbit.'}</h3><p>{filter === 'watchlist' && !query ? 'Tap the star beside an asset to keep it in your watchlist.' : 'Try another name, currency code, or asset filter.'}</p><button className="text-button" onClick={() => { setQuery(''); setFilter('all') }}>Explore all assets <Icon name="arrow" size={14} /></button></div></td></tr>}
          </tbody></table></div>
          <div className="table-foot"><span>{visibleAssets.length} of {CURRENCIES.length + CRYPTOS.length} assets <i>·</i> All prices per 1 unit</span><span><Icon name="star" size={12} /> Your favorites stay in this browser</span></div>
        </section>

        <div className="source-strip"><div><span className={`status-dot ${fx.error || forexStale || live.status !== 'live' ? 'dot-warning' : ''}`} />{live.status === 'live' ? `${liveCount} crypto pairs streaming` : liveLabel}</div><span>{rateLabel(fx.data)}: {quoteDateLabel(fx.data?.quoteDate)} <i>·</i> Crypto: {quoteTime(live.lastPriceAt ? new Date(live.lastPriceAt).toISOString() : undefined)} <i>·</i> UTC+8</span></div>
        <footer><a className="footer-brand" href="#top"><Icon name="moon" size={15} /> {SITE_NAME}</a><p>Global markets. A local perspective.</p><div><button className="text-button" onClick={() => setInfoOpen(true)}>About the data</button><span>·</span><a href="https://www.coingecko.com/en/api" target="_blank" rel="noreferrer">Historical data powered by CoinGecko API</a></div></footer>
      </main>
    </div>
    <DataDialog open={infoOpen} close={() => setInfoOpen(false)} />
  </>
}
