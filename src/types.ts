export type Asset = {
  code: string
  name: string
  type: 'currency' | 'crypto'
  symbol: string
  color: string
  id?: string
}

export type RateSnapshot = {
  rates: Record<string, number>
  updatedAt: string
  quoteDate: string
  fetchedAt: string
  source: 'Bank of Mongolia' | 'TDB'
  rateType?: 'reference' | 'bank-transfer-sell'
  stale?: boolean
}

export type Coin = {
  id: string
  symbol: string
  name: string
  priceUsd: number
  change24h: number | null
  marketCapUsd: number | null
  volume24hUsd: number | null
  high24hUsd: number | null
  low24hUsd: number | null
  sparkline: number[]
  updatedAt: string
  priceSource?: 'Kraken' | 'CoinGecko'
  live?: boolean
  stale?: boolean
}

export type CryptoSnapshot = {
  coins: Coin[]
  fetchedAt: string
  source: 'CoinGecko'
  stale?: boolean
}

export type ChartSnapshot = {
  coinId: string
  days: number
  points: [number, number][]
  fetchedAt: string
  source: 'CoinGecko'
  stale?: boolean
}
