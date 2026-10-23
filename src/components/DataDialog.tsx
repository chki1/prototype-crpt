import { useEffect, useRef } from 'react'
import Icon from './Icon'

export default function DataDialog({ open, close }: { open: boolean; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (open && !ref.current?.open) ref.current?.showModal(); if (!open && ref.current?.open) ref.current?.close() }, [open])
  return <dialog ref={ref} className="data-dialog" onClose={close} onClick={event => { if (event.target === event.currentTarget) close() }} aria-labelledby="data-title">
    <div className="dialog-top"><span className="section-eyebrow">MARKET NOTES</span><button className="icon-button" onClick={close} aria-label="Close data information"><Icon name="close" /></button></div>
    <h2 id="data-title">Know your numbers.</h2>
    <p>Quotes show their rate type and date. If fresh data is unavailable, saved quotes are marked clearly and missing values stay empty.</p>
    <div className="source-block"><Icon name="globe" /><div><h3>Daily currency quotes</h3><p>Daily reference is the normal FX basis. If it is unavailable, one bank's non-cash sell rates are used for every currency together, labeled Bank sell. These are indicative conversions, including reverse and cross-currency calculations; actual buy/sell offers can differ. All prices are per one source unit.</p></div></div>
    <div className="source-block"><Icon name="coin" /><div><h3>Live cryptocurrency prices</h3><p>Price, USD-based 24-hour change and daily highs/lows update as exchange trades arrive. MNT and EUR values combine live USD prices with the displayed daily FX basis. A green Live label requires a confirmed connection. Disconnected prices are marked saved and expire after two minutes.</p></div></div>
    <div className="source-block"><Icon name="chart" /><div><h3>Historical prices</h3><p>Charts, seven-day trends and market capitalization are reference data and can differ from current live prices. MNT/EUR charts convert the whole USD series with the latest available FX quote, rather than historical daily FX rates.</p></div></div>
    <p className="source-note">Favorites, display currency, appearance and the motion setting are saved in this browser. The small Auto button glows green while appearance follows your system. Pressing the light/dark button turns Auto off. All displayed times use Ulaanbaatar time (UTC+8).</p>
    <p className="source-note">When enabled on the deployed site, Vercel Web Analytics records page views and Speed Insights measures page performance. Conversion amounts and watchlist choices are not sent as custom analytics events.</p>
    <button className="primary-button" onClick={close}>Back to the stars <Icon name="arrow" size={17} /></button>
  </dialog>
}
