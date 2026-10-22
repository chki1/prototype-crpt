import { useEffect, useRef } from 'react'
import Icon from './Icon'

export default function DataDialog({ open, close }: { open: boolean; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (open && !ref.current?.open) ref.current?.showModal(); if (!open && ref.current?.open) ref.current?.close() }, [open])
  return <dialog ref={ref} className="data-dialog" onClose={close} onClick={event => { if (event.target === event.currentTarget) close() }} aria-labelledby="data-title">
    <div className="dialog-top"><span className="section-eyebrow">A LITTLE TRANSPARENCY</span><button className="icon-button" onClick={close} aria-label="Close data sources"><Icon name="close" /></button></div>
    <h2 id="data-title">Know your numbers.</h2>
    <p>Every displayed quote comes from a market provider. If a source is unavailable, we show a saved quote with a notice, or leave the value empty.</p>
    <div className="source-block"><Icon name="globe" /><div><h3>World currencies</h3><p>Reference rates by ExchangeRate-API, updated once per day. The page checks for updates hourly. Quotes compare one source unit with your selected MNT, USD or EUR display currency using USD-based reference rates.</p><a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates By Exchange Rate API <Icon name="external" size={13} /></a></div></div>
    <div className="source-block"><Icon name="coin" /><div><h3>Cryptocurrencies</h3><p>Prices, 24-hour change and historical USD charts by CoinGecko. Prices refresh every five minutes while this tab is visible. The MNT and EUR views convert USD quotes and history using the latest daily reference FX rate. The 24-hour percentage changes are measured in USD.</p><a href="https://www.coingecko.com/en/api" target="_blank" rel="noreferrer">Data provided by CoinGecko <Icon name="external" size={13} /></a></div></div>
    <p className="source-note">Currency quotes are indicative reference rates, not a bank's buy/sell offer or official Bank of Mongolia rates. Favorites, display currency, appearance and the motion setting are saved in this browser. System appearance follows your device automatically. All displayed times use Ulaanbaatar time (UTC+8).</p>
    <p className="source-note">When enabled on the deployed site, Vercel Web Analytics records page views and Speed Insights measures page performance. Conversion amounts and watchlist choices are not sent as custom analytics events.</p>
    <button className="primary-button" onClick={close}>Back to the stars <Icon name="arrow" size={17} /></button>
  </dialog>
}
