import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Coin } from '../types'
import { createLiveFeed, initialFeedState, mergeLiveCoins } from './live-feed'

export function useLivePrices(reference: Coin[], referenceStale: boolean) {
  const [feed, setFeed] = useState(initialFeedState)
  const [clock, setClock] = useState(Date.now)
  const controller = useRef<ReturnType<typeof createLiveFeed> | null>(null)
  useEffect(() => {
    const current = createLiveFeed(setFeed)
    controller.current = current
    const activity = () => navigator.onLine === false ? 'offline' as const : document.visibilityState === 'hidden' ? 'paused' as const : 'active' as const
    const changed = () => { current.setActivity(activity()); setClock(Date.now()) }
    current.start(activity())
    document.addEventListener('visibilitychange', changed)
    window.addEventListener('online', changed); window.addEventListener('offline', changed)
    const timer = window.setInterval(() => setClock(Date.now()), 5000)
    return () => { current.stop(); controller.current = null; window.clearInterval(timer); document.removeEventListener('visibilitychange', changed); window.removeEventListener('online', changed); window.removeEventListener('offline', changed) }
  }, [])
  const coins = useMemo(() => mergeLiveCoins(reference, feed, Math.max(clock, Date.now()), referenceStale), [reference, feed, clock, referenceStale])
  const reconnect = useCallback(() => controller.current?.reconnect(), [])
  return { ...feed, coins, reconnect }
}
