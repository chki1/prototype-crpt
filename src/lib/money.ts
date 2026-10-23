import type { Coin, RateSnapshot } from '../types'

export type DisplayCurrency = 'MNT' | 'USD' | 'EUR'

export function normalizeDisplayCurrency(value: unknown): DisplayCurrency {
  return value === 'USD' || value === 'EUR' ? value : 'MNT'
}

function positive(value: number | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0
}

/** The quote currency value of exactly ONE source unit, using USD-based rates. */
export function pricePerUnit(code: string, quote: string, fx: RateSnapshot | null, coins: Coin[]): number | null {
  if (code === quote) return 1
  const sourceRate = code === 'USD' ? 1 : fx?.rates[code]
  const targetRate = quote === 'USD' ? 1 : fx?.rates[quote]
  const sourcePrice = coins.find(c => c.symbol.toUpperCase() === code)?.priceUsd
  const targetPrice = coins.find(c => c.symbol.toUpperCase() === quote)?.priceUsd
  let result: number
  if (positive(sourceRate) && positive(targetRate)) result = targetRate / sourceRate
  else if (positive(sourcePrice) && positive(targetRate)) result = sourcePrice * targetRate
  else if (positive(sourceRate) && positive(targetPrice)) result = 1 / (sourceRate * targetPrice)
  else if (positive(sourcePrice) && positive(targetPrice)) result = sourcePrice / targetPrice
  else return null
  return Number.isFinite(result) && result > 0 ? result : null
}

export function mntPerUnit(code: string, fx: RateSnapshot | null, coins: Coin[]): number | null {
  return pricePerUnit(code, 'MNT', fx, coins)
}

export function usdToCurrency(value: number | null | undefined, quote: DisplayCurrency, fx: RateSnapshot | null): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null
  const rate = pricePerUnit('USD', quote, fx, [])
  if (rate == null) return null
  const result = value * rate
  return Number.isFinite(result) ? result : null
}

export function convertAmount(amount: number, from: string, to: string, fx: RateSnapshot | null, coins: Coin[]): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null
  if (from === to) return amount
  const unit = pricePerUnit(from, to, fx, coins)
  if (unit == null) return null
  const result = amount * unit
  return Number.isFinite(result) ? result : null
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
}

export function formatPrice(value: number | null | undefined): string {
  return formatNumber(value, value != null && value > 0 && value < 1 ? 4 : 2)
}

export function compactNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

export function dateTime(value: string | undefined, date = true): string {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Awaiting data'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ulaanbaatar', ...(date ? { day: '2-digit', month: 'short' } : {}),
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

export function quoteDateLabel(value: string | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Awaiting quote'
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ulaanbaatar', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00+08:00`))
}

export function rateLabel(fx: RateSnapshot | null | undefined): string {
  return fx?.rateType === 'bank-transfer-sell' ? 'Bank sell' : 'Daily reference'
}

export function quoteTime(value: string | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Awaiting price'
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ulaanbaatar', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value))
}
