import { normalizeDisplayCurrency, type DisplayCurrency } from '../lib/money'
import AssetPicker from './AssetPicker'

export default function CurrencyControl({ value, onChange }: { value: DisplayCurrency; onChange: (value: DisplayCurrency) => void }) {
  return <div className="currency-control" title="Choose display asset">
    <AssetPicker value={value} onChange={code => onChange(normalizeDisplayCurrency(code))} label="Display currency" compact />
    <span className="sr-only" role="status">Dashboard prices displayed in {value}.</span>
  </div>
}
