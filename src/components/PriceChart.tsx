import { useId, useMemo, useState } from 'react'
import { formatPrice } from '../lib/money'
import type { Asset } from '../types'
import Icon from './Icon'

export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="muted small">Not available</span>
  const min = Math.min(...values), range = Math.max(...values) - min || 1
  const points = values.map((value, index) => `${index / (values.length - 1) * 100},${29 - (value - min) / range * 26}`).join(' ')
  return <svg className={`sparkline ${values[values.length - 1] >= values[0] ? 'up' : 'down'}`} viewBox="0 0 100 32" role="img" aria-label="Price trend over the last seven days"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
}

export default function PriceChart({ points, currency, loading, error, retry }: { points: [number, number][]; currency: Asset; loading: boolean; error: string | null; retry: () => void }) {
  const id = useId().replace(/:/g, '')
  const [hover, setHover] = useState<number | null>(null)
  const chart = useMemo(() => {
    if (points.length < 2) return null
    const values = points.map(p => p[1])
    const rawMin = Math.min(...values), rawMax = Math.max(...values)
    const padding = (rawMax - rawMin || rawMax * 0.01) * 0.18
    const min = rawMin - padding, max = rawMax + padding
    const t0 = points[0][0], t1 = points[points.length - 1][0]
    const x = (t: number) => 12 + (t - t0) / (t1 - t0 || 1) * 674
    const y = (v: number) => 214 - (v - min) / (max - min || 1) * 192
    const stride = Math.max(1, Math.ceil(points.length / 420))
    const sampled = points.filter((_, i) => i % stride === 0 || i === points.length - 1)
    const line = sampled.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(2)},${y(p[1]).toFixed(2)}`).join(' ')
    return { min, max, x, y, line, area: `${line} L686,224 L12,224 Z`, t0, t1, rawMin, rawMax }
  }, [points])
  const selected = hover == null ? null : points[Math.min(points.length - 1, Math.max(0, hover))]
  const timeLabel = (value: number, withTime = false) => new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ulaanbaatar', day: '2-digit', month: 'short', ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(value)

  if (!chart) return <div className={`chart-empty ${loading ? 'is-loading' : ''}`} role="status">
    <Icon name={loading ? 'sparkles' : 'chart'} size={30} />
    <p>{loading ? 'Gathering a little market history…' : 'Price history is taking a moment.'}</p>
    <span>{loading ? 'Loading historical prices' : error ?? 'Historical data is unavailable for this asset.'}</span>
    {!loading && <button className="text-button" onClick={retry}>Try again <Icon name="refresh" size={14} /></button>}
  </div>

  return <div className="price-chart">
    {error && <div className="chart-cache-note">Saved history · current history could not be refreshed</div>}
    <div className="chart-canvas">
      <svg className="large-chart" viewBox="0 0 770 250" role="img" aria-label={`${currency.code} price history. Low ${formatPrice(chart.rawMin)} ${currency.code}; high ${formatPrice(chart.rawMax)} ${currency.code}. Use arrow keys to inspect points.`}
        tabIndex={0} onPointerLeave={() => setHover(null)} onBlur={() => setHover(null)}
        onPointerMove={event => {
          const rect = event.currentTarget.getBoundingClientRect()
          const fraction = Math.max(0, Math.min(1, ((event.clientX - rect.left) / rect.width * 770 - 12) / 674))
          const target = chart.t0 + fraction * (chart.t1 - chart.t0)
          let closest = 0
          for (let i = 1; i < points.length; i++) if (Math.abs(points[i][0] - target) < Math.abs(points[closest][0] - target)) closest = i
          setHover(closest)
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); setHover(i => Math.max(0, Math.min(points.length - 1, (i ?? points.length - 1) + (event.key === 'ArrowRight' ? 1 : -1)))) }
          if (event.key === 'Escape') setHover(null)
        }}>
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-fill)" stopOpacity="0.24" /><stop offset="100%" stopColor="var(--chart-fill)" stopOpacity="0" /></linearGradient>
          <linearGradient id={`line-${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="var(--chart-start)" /><stop offset="55%" stopColor="var(--chart-middle)" /><stop offset="100%" stopColor="var(--chart-end)" /></linearGradient>
        </defs>
        {[0, 1, 2, 3].map(i => { const value = chart.min + (chart.max - chart.min) * i / 3; const y = chart.y(value); return <g key={i}><line x1="12" y1={y} x2="687" y2={y} stroke="var(--chart-grid)" strokeDasharray="3 5" /><text x="704" y={y + 4} className="chart-axis">{new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}</text></g> })}
        <path d={chart.area} fill={`url(#area-${id})`} />
        <path className="chart-line" d={chart.line} fill="none" stroke={`url(#line-${id})`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="686" cy={chart.y(points[points.length - 1][1])} r="4" fill="var(--chart-end)" className="chart-endpoint" />
        {[0, 1, 2, 3, 4].map(i => { const t = chart.t0 + (chart.t1 - chart.t0) * i / 4; return <text key={i} x={12 + 674 * i / 4} y="245" textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'} className="chart-axis">{timeLabel(t)}</text> })}
        {selected && <g><line x1={chart.x(selected[0])} y1="14" x2={chart.x(selected[0])} y2="224" stroke="var(--chart-end)" strokeOpacity="0.4" strokeDasharray="4 4" /><circle cx={chart.x(selected[0])} cy={chart.y(selected[1])} r="5" fill="var(--chart-end)" stroke="var(--opaque-panel)" strokeWidth="2" /></g>}
      </svg>
      {selected && <div className="chart-tooltip" style={{ left: `${Math.max(10, Math.min(78, chart.x(selected[0]) / 770 * 100))}%` }}><span>{timeLabel(selected[0], true)} · UTC+8</span><strong>{currency.symbol}{formatPrice(selected[1])} {currency.code}</strong></div>}
    </div>
    <span className="sr-only" aria-live="polite">{selected ? `${timeLabel(selected[0], true)}: ${formatPrice(selected[1])} ${currency.code}` : ''}</span>
  </div>
}
