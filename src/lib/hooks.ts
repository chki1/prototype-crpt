import { useCallback, useEffect, useState } from 'react'

export function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) as T : initial } catch { return initial }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Private browsing can disallow storage. */ } }, [key, value])
  return [value, setValue] as const
}

type RemoteState<T> = { key: string; data: T | null; loading: boolean; error: string | null; fromCache: boolean }

function cached<T>(key: string): T | null {
  try {
    const raw = JSON.parse(localStorage.getItem(`prototype-crpt:data:${key}`) ?? 'null') as { data: T; storedAt: number } | null
    const bankQuote = (raw?.data as { rateType?: unknown } | undefined)?.rateType === 'bank-transfer-sell'
    const maxAge = key.startsWith('rates') ? bankQuote ? 86400_000 : 7 * 86400_000 : key === 'crypto' ? 3600_000 : 24 * 3600_000
    return raw && typeof raw === 'object' && Number.isFinite(raw.storedAt) && Date.now() - raw.storedAt < maxAge ? raw.data : null
  } catch { return null }
}

export function useRemoteResource<T>(url: string, key: string, refreshMs: number) {
  const [nonce, setNonce] = useState(0)
  const [state, setState] = useState<RemoteState<T>>(() => ({ key, data: cached<T>(key), loading: true, error: null, fromCache: true }))
  const reload = useCallback(() => setNonce(n => n + 1), [])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 17000)
    setState(previous => ({ key, data: previous.key === key ? previous.data : cached<T>(key), loading: true, error: null, fromCache: previous.key === key ? previous.fromCache : true }))
    async function run() {
      try {
        const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
        const data = await response.json() as T & { error?: string }
        if (!response.ok || data.error) throw new Error(data.error ?? 'Market data is unavailable.')
        if (!active) return
        try { localStorage.setItem(`prototype-crpt:data:${key}`, JSON.stringify({ data, storedAt: Date.now() })) } catch { /* Optional cache. */ }
        setState({ key, data, loading: false, error: null, fromCache: false })
      } catch (error) {
        if (active) setState(previous => ({ ...previous, loading: false, fromCache: previous.data != null, error: error instanceof Error && error.name !== 'AbortError' ? error.message : 'The request timed out. Check your connection and retry.' }))
      } finally { window.clearTimeout(timeout) }
    }
    void run()
    return () => { active = false; window.clearTimeout(timeout); controller.abort() }
  }, [url, key, nonce])
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') reload() }, refreshMs)
    return () => window.clearInterval(timer)
  }, [refreshMs, reload])
  return { ...(state.key === key ? state : { key, data: cached<T>(key), loading: true, error: null, fromCache: true }), reload }
}
