import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { normalizeThemePreference, resolveTheme, THEME_STORAGE_KEY, type ThemePreference } from './theme'

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    try { return normalizeThemePreference(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) ?? 'null')) }
    catch { return 'system' }
  })
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const resolved = resolveTheme(preference, systemDark)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const changed = () => setSystemDark(media.matches)
    changed()
    media.addEventListener('change', changed)
    const sync = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return
      try { setPreference(normalizeThemePreference(JSON.parse(event.newValue ?? 'null'))) }
      catch { setPreference('system') }
    }
    window.addEventListener('storage', sync)
    return () => { media.removeEventListener('change', changed); window.removeEventListener('storage', sync) }
  }, [])

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolved
    root.dataset.appearance = preference
    root.style.colorScheme = resolved
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0b0c17' : '#edf0f8')
  }, [preference, resolved])

  const selectTheme = useCallback((next: ThemePreference) => {
    setPreference(next)
    try { localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(next)) } catch { /* The theme still works when storage is unavailable. */ }
  }, [])

  return { preference, resolved, selectTheme }
}
