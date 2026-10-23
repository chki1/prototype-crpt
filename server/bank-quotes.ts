import { BANKS, CURRENCIES } from '../src/config.js'
import type { BankId, BankPair, BankSnapshot } from '../src/types.js'
import { mongoliaDate } from './bank-of-mongolia.js'
import { FALLBACK_RATES_URL, readTdbTable } from './currency-fallback.js'

export const GOLOMT_RATES_URL = 'https://www.golomtbank.com/api/exchange/'
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
function rate(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || value === 0 || value === '0' || value === '0.00') return null
  if (typeof value === 'string' && /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(value.trim())) value = Number(value.replaceAll(',', ''))
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1e12) throw new Error('Invalid bank quote')
  return value
}
function pair(buy: unknown, sell: unknown): BankPair {
  const result = { buy: rate(buy), sell: rate(sell) }
  if (result.buy != null && result.sell != null && result.buy > result.sell) throw new Error('Invalid bank spread')
  return result
}
function metadata(bankId: BankId, quoteDate: string, time: number) {
  const bank = BANKS.find(b => b.id === bankId)!
  return { bankId, bankName: bank.name, sourceUrl: bank.url, quoteDate, fetchedAt: new Date(time).toISOString() }
}

export function parseTdbQuotes(html: string, time: number): BankSnapshot {
  const { quoteDate, rows } = readTdbTable(html, time)
  const quotes = CURRENCIES.flatMap(asset => {
    const matches = rows.filter(row => row[1] === asset.code)
    if (!matches.length) return []
    if (matches.length !== 1 || matches[0].length !== 8) throw new Error('Bank table changed')
    const row = matches[0]
    return [{ code: asset.code, referenceMnt: rate(row[3]), transfer: pair(row[4], row[5]), cash: pair(row[6], row[7]) }]
  })
  if (!quotes.some(q => q.code === 'USD' && q.transfer.buy && q.transfer.sell)) throw new Error('No dated bank quotes')
  return { ...metadata('tdb', quoteDate, time), quotes }
}

export function parseGolomtQuotes(raw: unknown, quoteDate: string, time: number): BankSnapshot {
  const timestamp = Date.parse(`${quoteDate}T00:00:00+08:00`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(quoteDate) || !Number.isFinite(timestamp) || mongoliaDate(timestamp) !== quoteDate || quoteDate > mongoliaDate(time) || time - timestamp > 7 * 86400_000) throw new Error('Invalid bank date')
  if (!object(raw) || !object(raw.result)) throw new Error('Invalid bank response')
  const rows = raw.result
  const quotes = CURRENCIES.flatMap(asset => {
    const row = rows[asset.code]
    if (row === undefined) return []
    if (!object(row) || row.fixcurcode !== asset.code || row.varcurcode !== 'MNT') throw new Error('Wrong currency unit')
    // The bank's public page uses cvalue for the displayed rate. tvalue is a distinct field.
    const cell = (key: string) => object(row[key]) ? row[key].cvalue : undefined
    return [{ code: asset.code, referenceMnt: rate(cell('mongolbank')), transfer: pair(cell('non_cash_buy'), cell('non_cash_sell')), cash: pair(cell('cash_buy'), cell('cash_sell')) }]
  })
  if (!quotes.some(q => q.code === 'USD' && q.transfer.buy && q.transfer.sell)) throw new Error('No dated bank quotes')
  return { ...metadata('golomt', quoteDate, time), quotes }
}

export async function loadBankQuotes(fetcher: typeof fetch, now: () => number, bank: BankId): Promise<BankSnapshot> {
  const quoteDate = mongoliaDate(now())
  const url = bank === 'tdb' ? FALLBACK_RATES_URL : `${GOLOMT_RATES_URL}?date=${quoteDate.replaceAll('-', '')}`
  const response = await fetcher(url, { headers: { Accept: bank === 'tdb' ? 'text/html' : 'application/json' }, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error('Bank quotes unavailable')
  return bank === 'tdb' ? parseTdbQuotes(await response.text(), now()) : parseGolomtQuotes(await response.json(), quoteDate, now())
}
