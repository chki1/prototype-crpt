export const THEME_STORAGE_KEY = 'prototype-crpt:appearance'
export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  return preference === 'system' ? systemDark ? 'dark' : 'light' : preference
}

export function nextThemePreference(preference: ThemePreference, resolved: ResolvedTheme, action: 'theme' | 'automatic'): ThemePreference {
  if (action === 'theme') return resolved === 'dark' ? 'light' : 'dark'
  return preference === 'system' ? resolved : 'system'
}
