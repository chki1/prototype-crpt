import type { Asset } from './types.js'

// Change branding here. Display names may contain spaces; npm/repo names use hyphens.
export const SITE_NAME = 'prototype crpt'

export const CURRENCIES: Asset[] = [
  { code: 'USD', name: 'US Dollar', type: 'currency', symbol: '$', color: '#bad9bd' },
  { code: 'EUR', name: 'Euro', type: 'currency', symbol: '€', color: '#aabcf3' },
  { code: 'CNY', name: 'Chinese Yuan', type: 'currency', symbol: '¥', color: '#f1b4a9' },
  { code: 'JPY', name: 'Japanese Yen', type: 'currency', symbol: '¥', color: '#ebc5cf' },
  { code: 'KRW', name: 'South Korean Won', type: 'currency', symbol: '₩', color: '#c2c7ef' },
  { code: 'GBP', name: 'British Pound', type: 'currency', symbol: '£', color: '#d1b6ec' },
  { code: 'RUB', name: 'Russian Ruble', type: 'currency', symbol: '₽', color: '#a9d3e4' },
  { code: 'AUD', name: 'Australian Dollar', type: 'currency', symbol: 'A$', color: '#c0d4a8' },
  { code: 'CAD', name: 'Canadian Dollar', type: 'currency', symbol: 'C$', color: '#ecbeb9' },
  { code: 'CHF', name: 'Swiss Franc', type: 'currency', symbol: 'Fr', color: '#e5c69f' },
  { code: 'SGD', name: 'Singapore Dollar', type: 'currency', symbol: 'S$', color: '#c2d6d0' },
  { code: 'HKD', name: 'Hong Kong Dollar', type: 'currency', symbol: 'HK$', color: '#d6bdab' },
]

export const CRYPTOS: Asset[] = [
  { id: 'bitcoin', code: 'BTC', name: 'Bitcoin', type: 'crypto', symbol: '₿', color: '#edb16e' },
  { id: 'ethereum', code: 'ETH', name: 'Ethereum', type: 'crypto', symbol: 'Ξ', color: '#b7b0ee' },
  { id: 'solana', code: 'SOL', name: 'Solana', type: 'crypto', symbol: '◎', color: '#93d8cb' },
  { id: 'tether', code: 'USDT', name: 'Tether', type: 'crypto', symbol: '₮', color: '#89cdb6' },
  { id: 'binancecoin', code: 'BNB', name: 'BNB', type: 'crypto', symbol: '◇', color: '#e9d28a' },
  { id: 'ripple', code: 'XRP', name: 'XRP', type: 'crypto', symbol: 'X', color: '#d6dce8' },
  { id: 'dogecoin', code: 'DOGE', name: 'Dogecoin', type: 'crypto', symbol: 'Ð', color: '#d2bb86' },
  { id: 'cardano', code: 'ADA', name: 'Cardano', type: 'crypto', symbol: '₳', color: '#98b9ed' },
  { id: 'chainlink', code: 'LINK', name: 'Chainlink', type: 'crypto', symbol: '⬡', color: '#9faef1' },
  { id: 'avalanche-2', code: 'AVAX', name: 'Avalanche', type: 'crypto', symbol: '▲', color: '#e7aaa9' },
]

export const MNT: Asset = { code: 'MNT', name: 'Mongolian Tögrög', type: 'currency', symbol: '₮', color: '#d9ccaa' }
export const DISPLAY_CURRENCIES = [MNT, ...CURRENCIES.filter(a => a.code === 'USD' || a.code === 'EUR')]
export const ASSETS = [...CURRENCIES, ...CRYPTOS]
export const CONVERTER_ASSETS = [MNT, ...ASSETS]
