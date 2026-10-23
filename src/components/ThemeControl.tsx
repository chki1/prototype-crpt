import { useId } from 'react'
import { nextThemePreference, type ResolvedTheme, type ThemePreference } from '../lib/theme'
import Icon from './Icon'

export default function ThemeControl({ preference, resolved, selectTheme }: { preference: ThemePreference; resolved: ResolvedTheme; selectTheme: (mode: ThemePreference) => void }) {
  const id = useId()
  const automatic = preference === 'system'
  return <section className="appearance-control" aria-labelledby={id}>
    <div className="appearance-heading"><span id={id}>Appearance</span><span>{preference === 'system' ? `Auto · ${resolved}` : resolved}</span></div>
    <div className="appearance-buttons">
      <button type="button" className="appearance-toggle" onClick={() => selectTheme(nextThemePreference(preference, resolved, 'theme'))} aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`} title="Switch light/dark mode and turn automatic mode off"><Icon name={resolved === 'dark' ? 'moon' : 'sun'} size={17} /><span>{resolved === 'dark' ? 'Dark' : 'Light'} mode</span></button>
      <button type="button" className={`appearance-auto ${automatic ? 'is-active' : ''}`} onClick={() => selectTheme(nextThemePreference(preference, resolved, 'automatic'))} aria-label="Automatic appearance" aria-pressed={automatic} title={automatic ? 'Automatic on: follows your system. Click to turn off.' : 'Automatic off. Click to follow your system.'}><span className="auto-light" aria-hidden="true" /><span>Auto</span></button>
    </div>
  </section>
}
