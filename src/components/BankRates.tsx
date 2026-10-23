import { useEffect, useState } from 'react'
import { BANKS, CURRENCIES } from '../config'
import type { BankChannel, BankId, BankSnapshot } from '../types'
import { dateTime, formatPrice, quoteDateLabel } from '../lib/money'
import { useRemoteResource } from '../lib/hooks'
import Icon from './Icon'

export default function BankRates({ refreshVersion, onTrack }: { refreshVersion: number; onTrack: (code: string) => void }) {
  const [bankId, setBankId] = useState<BankId>('golomt'), [channel, setChannel] = useState<BankChannel>('transfer')
  const bank = BANKS.find(b => b.id === bankId)!
  const remote = useRemoteResource<BankSnapshot>(`/api/market?resource=bank&bank=${bankId}`, `bank:${bankId}:v1`, 300_000)
  useEffect(() => { if (refreshVersion) remote.reload() }, [refreshVersion, remote.reload])
  const stale = remote.fromCache || remote.data?.stale || !!remote.error
  return <section className="panel bank-panel reveal" id="bank-rates" aria-labelledby="bank-rates-title">
    <div className="bank-heading"><div><div className="section-eyebrow"><Icon name="globe" size={14} /> BANK EXCHANGE DESK</div><h2 id="bank-rates-title">The buy side. The sell side.</h2><p>Each quote in MNT per 1 foreign unit.</p></div><a className="text-button" href={bank.url} target="_blank" rel="noreferrer">Official rates <Icon name="external" size={14} /></a></div>
    <div className="bank-controls"><div className="bank-tabs" aria-label="Choose bank">{BANKS.map(b => <button key={b.id} onClick={() => setBankId(b.id)} aria-pressed={b.id === bankId}><span className={`bank-monogram bank-${b.id}`}>{b.id === 'tdb' ? 'T' : 'G'}</span><span><strong>{b.shortName}</strong><small>{b.id === 'tdb' ? 'Худалдаа, хөгжлийн банк' : 'Голомт банк'}</small></span>{b.id === bankId && <Icon name="check" size={15} />}</button>)}</div><div className="pill-tabs" aria-label="Bank rate channel"><button aria-pressed={channel === 'transfer'} onClick={() => setChannel('transfer')}>Transfer · Бэлэн бус</button><button aria-pressed={channel === 'cash'} onClick={() => setChannel('cash')}>Cash · Бэлэн</button></div></div>
    <div className="bank-date"><span className={`status-dot ${stale && remote.data ? 'dot-warning' : ''}`} />{remote.loading ? `Checking ${bank.shortName}…` : remote.data ? `${stale ? 'Saved' : 'Rate date'} · ${quoteDateLabel(remote.data.quoteDate)} · Checked ${dateTime(remote.data.fetchedAt)} UTC+8` : 'Awaiting bank quotes'}<button className="text-button" disabled={remote.loading} onClick={remote.reload}><Icon name="refresh" size={13} /> Refresh</button></div>
    {remote.error && <div className="bank-error" role="status">{remote.data ? 'Showing this bank’s saved quotes. ' : ''}{remote.error}</div>}
    <div className="table-scroll"><table className="bank-table"><thead><tr><th scope="col">Currency</th><th scope="col" className="numeric">Bank buys <small>Авах · MNT</small></th><th scope="col" className="numeric">Bank sells <small>Зарах · MNT</small></th><th scope="col" className="numeric bank-spread">Spread <small>MNT</small></th><th scope="col"><span className="sr-only">View currency history</span></th></tr></thead><tbody>{CURRENCIES.map(asset => {
      const pair = remote.data?.quotes.find(q => q.code === asset.code)?.[channel]
      const spread = pair?.buy != null && pair.sell != null ? pair.sell - pair.buy : null
      return <tr key={asset.code}><td><div className="bank-asset"><span>{asset.symbol}</span><div><strong>{asset.code}</strong><small>{asset.name}</small></div></div></td><td className="numeric bank-buy">{formatPrice(pair?.buy)}</td><td className="numeric bank-sell">{formatPrice(pair?.sell)}</td><td className="numeric bank-spread">{formatPrice(spread)}</td><td><button className="row-convert" onClick={() => onTrack(asset.code)} aria-label={`View ${asset.code} in Market Orbit`}><Icon name="chart" size={16} /></button></td></tr>
    })}</tbody></table></div>
    <div className="bank-foot"><p>Bank buys: you sell foreign currency. Bank sells: you buy foreign currency. Actual transaction quotes and fees can differ.</p><p>Bank quotes stay separate from the official reference history in Market Orbit. Missing or zero provider values appear as —.</p></div>
  </section>
}
