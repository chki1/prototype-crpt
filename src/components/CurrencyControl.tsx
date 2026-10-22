import { DISPLAY_CURRENCIES } from '../config'
import { normalizeDisplayCurrency, type DisplayCurrency } from '../lib/money'
import Icon from './Icon'

export default function CurrencyControl({ value, onChange }: { value: DisplayCurrency; onChange: (value: DisplayCurrency) => void }) {
  return <div className="currency-control" title="Choose display currency">
    <select id="display-currency" value={value} onChange={event => onChange(normalizeDisplayCurrency(event.target.value))} aria-label="Display currency">
      {DISPLAY_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
    </select>
    <Icon name="chevron" size={11} />
    <span className="sr-only" role="status">Dashboard prices displayed in {value}.</span>
  </div>
}
