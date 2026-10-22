import { DISPLAY_CURRENCIES } from '../config'
import { normalizeDisplayCurrency, type DisplayCurrency } from '../lib/money'
import Icon from './Icon'

export default function CurrencyControl({ value, onChange }: { value: DisplayCurrency; onChange: (value: DisplayCurrency) => void }) {
  const currency = DISPLAY_CURRENCIES.find(c => c.code === value)!
  return <div className="currency-control">
    <span className="currency-control-icon" aria-hidden="true">{currency.symbol}</span>
    <label className="currency-control-copy" htmlFor="display-currency"><span>Display currency</span><small>{currency.name}</small></label>
    <div className="currency-control-select">
      <select id="display-currency" value={value} onChange={event => onChange(normalizeDisplayCurrency(event.target.value))} aria-label="Display currency">
        {DISPLAY_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
      </select>
      <Icon name="chevron" size={13} />
    </div>
    <span className="sr-only" role="status">Dashboard prices displayed in {value}.</span>
  </div>
}
