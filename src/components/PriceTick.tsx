import { useEffect, useRef, useState } from 'react'
import { formatPrice } from '../lib/money'

export default function PriceTick({ value }: { value: number | null | undefined }) {
  const previous = useRef(value)
  const [direction, setDirection] = useState('')
  useEffect(() => {
    const old = previous.current; previous.current = value
    if (old == null || value == null || old === value) { setDirection(''); return }
    setDirection(value > old ? 'price-up' : 'price-down')
    const timer = window.setTimeout(() => setDirection(''), 800)
    return () => window.clearTimeout(timer)
  }, [value])
  return <span key={value ?? 'empty'} className={`price-tick ${direction}`}>{formatPrice(value)}</span>
}
