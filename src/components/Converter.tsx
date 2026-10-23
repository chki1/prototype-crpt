import { useEffect, useRef, useState } from 'react'
import { CONVERTER_ASSETS } from '../config'
import { convertAmount, quoteDateLabel, rateLabel, formatNumber, type DisplayCurrency } from '../lib/money'
import type { Coin, RateSnapshot } from '../types'
import Icon from './Icon'

export default function Converter({ fx, coins, request, displayCurrency, forexStale, cryptoStale }: { fx: RateSnapshot | null; coins: Coin[]; request: { code: string; to: DisplayCurrency; nonce: number }; displayCurrency: DisplayCurrency; forexStale: boolean; cryptoStale: boolean }) {
  const [amount, setAmount] = useState('1')
  const [from, setFrom] = useState('USD')
  const [to, setTo] = useState<string>(displayCurrency)
  const [copyStatus, setCopyStatus] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!request.nonce) return
    setFrom(request.code); setTo(request.to); setAmount('1')
    inputRef.current?.focus({ preventScroll: true })
  }, [request])
  useEffect(() => { setTo(displayCurrency) }, [displayCurrency])
  useEffect(() => { setCopyStatus('') }, [amount, from, to])
  const valid = /^\d*\.?\d+$|^\d+\.$/.test(amount.trim()) && Number.isFinite(Number(amount)) && Number(amount) >= 0
  const result = valid ? convertAmount(Number(amount), from, to, fx, coins) : null
  const unit = convertAmount(1, from, to, fx, coins)
  const target = CONVERTER_ASSETS.find(a => a.code === to)!
  const usesCrypto = CONVERTER_ASSETS.some(a => (a.code === from || a.code === to) && a.type === 'crypto')
  const usesFx = CONVERTER_ASSETS.some(a => a.code !== 'USD' && (a.code === from || a.code === to) && a.type === 'currency')
  const selectedCrypto = coins.filter(c => c.symbol.toUpperCase() === from || c.symbol.toUpperCase() === to)
  const stale = from !== to && ((usesFx && forexStale) || (usesCrypto && selectedCrypto.some(c => c.stale ?? cryptoStale)))
  const decimals = target.type === 'crypto' ? 8 : 2
  const formatted = formatNumber(result, decimals)
  async function copy() {
    if (result == null) return
    try { await navigator.clipboard.writeText(`${result.toFixed(decimals)} ${to}`); setCopyStatus('Copied to clipboard') }
    catch { setCopyStatus('Select the result to copy it manually.') }
  }

  return <section className="panel converter" id="converter" aria-labelledby="converter-title">
    <div className="section-eyebrow"><Icon name="swap" size={15} /> CURRENCY CONVERTER</div>
    <h2 id="converter-title">A world of value.<br /><em>One simple conversion.</em></h2>
    <label className="input-label" htmlFor="amount">Amount</label>
    <div className={`amount-field ${amount && !valid ? 'invalid' : ''}`}>
      <input ref={inputRef} id="amount" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" autoComplete="off" spellCheck={false} aria-describedby="amount-help" aria-invalid={!!amount && !valid} />
      <span>{from}</span>
    </div>
    <div className="quick-amounts">{['1', '100', '1000'].map(n => <button key={n} onClick={() => setAmount(n)} className={amount === n ? 'selected' : ''}>{Number(n).toLocaleString('en-US')}</button>)}</div>
    <div className="conversion-pair">
      <label>From<select aria-label="Convert from" value={from} onChange={e => setFrom(e.target.value)}>{CONVERTER_ASSETS.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select><Icon name="chevron" size={15} /></label>
      <button className="swap-button" onClick={() => { setFrom(to); setTo(from) }} aria-label="Swap currencies"><Icon name="swap" size={16} /></button>
      <label>To<select aria-label="Convert to" value={to} onChange={e => setTo(e.target.value)}>{CONVERTER_ASSETS.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select><Icon name="chevron" size={15} /></label>
    </div>
    <div className="conversion-result" aria-live="off" aria-atomic="true">
      <div className="result-eyebrow"><span>You get approximately</span><span>{to}</span></div>
      <div className={`result-number ${formatted.length > 14 ? 'long' : ''}`}><span>{target.symbol}</span>{formatted}</div>
      <div className="conversion-unit">{unit != null ? `1 ${from} = ${formatNumber(unit, decimals)} ${to}` : 'Waiting for an exchange rate'}</div>
    </div>
    <p id="amount-help" className={`converter-hint ${amount && !valid ? 'warning-text' : ''}`}>{amount && !valid ? 'Enter a positive number or zero, using a decimal point.' : stale ? 'Using saved quotes. Refresh to check the latest rates.' : 'Indicative conversion using live crypto and the selected daily FX basis. Actual buy/sell offers can differ.'}</p>
    <button className="primary-button" onClick={copy} disabled={result == null}><Icon name={copyStatus === 'Copied to clipboard' ? 'check' : 'copy'} size={16} /> {copyStatus === 'Copied to clipboard' ? 'Copied' : 'Copy conversion'}<Icon name="arrow" size={17} /></button>
    <span className="copy-status" role="status">{copyStatus}</span>
    <div className="converter-foot"><span className="status-dot" /> {rateLabel(fx)} · {quoteDateLabel(fx?.quoteDate)}</div>
  </section>
}
