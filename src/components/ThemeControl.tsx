import { useId, useRef } from 'react'
import type { ResolvedTheme, ThemePreference } from '../lib/theme'
import Icon, { type IconName } from './Icon'

const choices: { value: ThemePreference; label: string; icon: IconName }[] = [
  { value: 'system', label: 'System', icon: 'display' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
]

export default function ThemeControl({ preference, resolved, selectTheme }: { preference: ThemePreference; resolved: ResolvedTheme; selectTheme: (mode: ThemePreference) => void }) {
  const id = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  return <section className="appearance-control" aria-labelledby={id}>
    <div className="appearance-heading"><span id={id}>Appearance</span><span>{preference === 'system' ? `Auto · ${resolved}` : resolved}</span></div>
    <div className="appearance-segments" role="radiogroup" aria-label="Color appearance">
      {choices.map((choice, index) => <button key={choice.value} ref={node => { refs.current[index] = node }} type="button" role="radio" aria-checked={preference === choice.value} aria-label={`${choice.label} appearance`} tabIndex={preference === choice.value ? 0 : -1} onClick={() => selectTheme(choice.value)}
        onKeyDown={event => {
          let next = index
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % choices.length
          else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + choices.length - 1) % choices.length
          else if (event.key === 'Home') next = 0
          else if (event.key === 'End') next = choices.length - 1
          else return
          event.preventDefault(); selectTheme(choices[next].value); refs.current[next]?.focus()
        }}><Icon name={choice.icon} size={15} /><span>{choice.label}</span></button>)}
    </div>
  </section>
}
