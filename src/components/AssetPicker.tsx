import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { CONVERTER_ASSETS } from '../config'
import type { Asset } from '../types'
import Icon from './Icon'

type Props = { value: string; onChange: (code: string) => void; label: string; options?: Asset[]; compact?: boolean }
export default function AssetPicker({ value, onChange, label, options = CONVERTER_ASSETS, compact = false }: Props) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [category, setCategory] = useState('all')
  const dialog = useRef<HTMLDialogElement>(null), search = useRef<HTMLInputElement>(null), list = useRef<HTMLDivElement>(null)
  const titleId = useId(), selected = options.find(a => a.code === value) ?? options[0]
  const mixed = options.some(a => a.type === 'currency') && options.some(a => a.type === 'crypto')
  const visible = options.filter(a => (!mixed || category === 'all' || a.type === category) && `${a.code} ${a.name}`.toLowerCase().includes(query.trim().toLowerCase()))
  const quick = ['MNT', 'USD', 'EUR', 'BTC', 'ETH'].filter(code => options.some(a => a.code === code))
  useEffect(() => {
    if (open && !dialog.current?.open) { dialog.current?.showModal(); search.current?.focus() }
    if (!open && dialog.current?.open) dialog.current.close()
  }, [open])
  function choose(code: string) { onChange(code); setOpen(false) }
  function close() { setOpen(false); setQuery(''); setCategory('all') }
  return <div className={`asset-picker ${compact ? 'is-compact' : ''}`}>
    <button type="button" className="asset-picker-trigger" aria-label={`${label}: ${selected.code}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setQuery(''); setCategory('all'); setOpen(true) }}>
      <span className={`picker-symbol ${selected.type}`} style={{ '--asset-color': selected.color } as CSSProperties}>{selected.symbol}</span>
      <span className="picker-trigger-label"><strong>{selected.code}</strong>{!compact && <small>{selected.name}</small>}</span><Icon name="chevron" size={13} />
    </button>
    <dialog ref={dialog} className="asset-picker-dialog" aria-labelledby={titleId} onClose={close} onClick={event => { if (event.target === event.currentTarget) close() }}>
      <div className="picker-heading"><div><span className="section-eyebrow">YOUR NEXT ORBIT</span><h2 id={titleId}>{label}</h2></div><button className="icon-button" type="button" aria-label={`Close ${label}`} onClick={close}><Icon name="close" /></button></div>
      <label className="picker-search"><Icon name="search" size={19} /><input ref={search} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search a name or symbol" aria-label={`Search ${label.toLowerCase()}`} autoComplete="off" spellCheck={false} onKeyDown={event => {
        if (event.key === 'ArrowDown') { event.preventDefault(); list.current?.querySelector<HTMLButtonElement>('button')?.focus() }
        if (event.key === 'Enter' && visible.length) { event.preventDefault(); choose(visible[0].code) }
      }} /><kbd>esc</kbd></label>
      <div className="picker-quick" aria-label="Quick choices">{quick.map(code => <button type="button" key={code} onClick={() => choose(code)} className={code === value ? 'selected' : ''}>{code}</button>)}</div>
      {mixed && <div className="pill-tabs picker-categories" aria-label="Asset category">{[{ id: 'all', label: 'All assets' }, { id: 'currency', label: 'Currencies' }, { id: 'crypto', label: 'Crypto' }].map(c => <button type="button" key={c.id} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{c.label}</button>)}</div>}
      <div className="picker-results" ref={list} onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
        if (!buttons.length) return
        event.preventDefault()
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
        buttons[next]?.focus()
      }}>
        {visible.map(asset => <button type="button" key={asset.code} className={`picker-option ${value === asset.code ? 'selected' : ''}`} aria-pressed={value === asset.code} onClick={() => choose(asset.code)}><span className={`picker-symbol ${asset.type}`} style={{ '--asset-color': asset.color } as CSSProperties}>{asset.symbol}</span><span><strong>{asset.code}</strong><small>{asset.name}</small></span><span className="picker-kind">{asset.type === 'crypto' ? 'Crypto' : 'Currency'}</span>{value === asset.code && <Icon name="check" size={18} />}</button>)}
        {!visible.length && <div className="picker-empty"><Icon name="search" size={25} /><p>No assets found.</p><span>Try a currency code, such as USD or BTC.</span></div>}
      </div>
      <div className="picker-footer"><span>{visible.length} {visible.length === 1 ? 'asset' : 'assets'}</span><span>↑ ↓ to explore · Enter to choose</span></div>
    </dialog>
  </div>
}
