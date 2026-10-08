import { useEffect, useLayoutEffect, useState } from 'react'

// Two-step learn-by-doing guide. Spotlights the real controls and waits
// for the actual action — no timer advances it. Skippable, remembered in
// localStorage, replayable from the "?" button.

interface Props {
  step: 0 | 1 | 2 // 0=typing, 1=ready to mint, 2=done
  onSkip: () => void
}

const COPY = [
  'State the achievement. The Committee is listening.',
  'When the words are worthy, mint.',
]

export function Guide({ step, onSkip }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const targetSel = step === 0 ? '[data-guide="achievement"]' : '[data-guide="mint"]'

  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector(targetSel)
      if (el) setRect(el.getBoundingClientRect())
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [targetSel, step])

  // re-measure while elements settle
  useEffect(() => {
    const t = setInterval(() => {
      const el = document.querySelector(targetSel)
      if (el) setRect(el.getBoundingClientRect())
    }, 250)
    return () => clearInterval(t)
  }, [targetSel])

  if (step > 1 || !rect) return null

  const pad = 10
  const hole = {
    left: rect.left - pad,
    top: rect.top - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  }
  const captionBelow = hole.top + hole.height + 18 + 90 < window.innerHeight
  const captionStyle: React.CSSProperties = captionBelow
    ? { top: hole.top + hole.height + 16, left: Math.max(16, Math.min(hole.left, window.innerWidth - 320)) }
    : { top: hole.top - 96, left: Math.max(16, Math.min(hole.left, window.innerWidth - 320)) }

  return (
    <div className="guide" role="dialog" aria-label="First steps">
      <div
        className="guide-shade"
        style={{
          clipPath: `polygon(evenodd, 0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
            ${hole.left}px ${hole.top}px, ${hole.left}px ${hole.top + hole.height}px,
            ${hole.left + hole.width}px ${hole.top + hole.height}px, ${hole.left + hole.width}px ${hole.top}px,
            ${hole.left}px ${hole.top}px)`,
        }}
      />
      <div className="guide-ring" style={hole} />
      <div className="guide-card" style={captionStyle}>
        <p>{COPY[step]}</p>
        <button className="guide-skip" onClick={onSkip}>
          Skip the ceremony
        </button>
      </div>
    </div>
  )
}
