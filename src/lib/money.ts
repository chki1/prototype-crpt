import type { Coin, RateSnapshot } from '../types'

/** Quotes are normalized to the MNT value of exactly ONE source unit. */
export function mntPerUnit(code: string, fx: RateSnapshot | null, coins: Coin[]): number | null {
  if (code === 'MNT') return 1
  const mnt = fx?.rates.MNT
  if (mnt == null || !Number.isFinite(mnt) || mnt <= 0) return null
  const fiat = fx?.rates[code]
  if (fiat != null && Number.isFinite(fiat) && fiat > 0) return mnt / fiat
  const coin = coins.find(c => c.symbol.toUpperCase() === code)
  return coin && Number.isFinite(coin.priceUsd) && coin.priceUsd > 0 ? coin.priceUsd * mnt : null
}

export function convertAmount(amount: number, from: string, to: string, fx: RateSnapshot | null, coins: Coin[]): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null
  if (from === to) return amount
  const source = mntPerUnit(from, fx, coins)
  const target = mntPerUnit(to, fx, coins)
  if (source == null || target == null) return null
  const result = amount * (source / target)
  return Number.isFinite(result) ? result : null
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
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
