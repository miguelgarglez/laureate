import { useEffect, useRef, useState } from 'react'
import { CATEGORY_ORDER, CATEGORIES, GHOST_EXAMPLES } from '../lib/award'
import type { Category } from '../lib/award'
import { tick } from '../lib/sfx'

interface Props {
  recipient: string
  achievement: string
  category: Category
  setRecipient: (v: string) => void
  setAchievement: (v: string) => void
  setCategory: (c: Category) => void
  onMint: () => void
  busy: boolean
  soundOn: boolean
}

export function CommitteeForm(p: Props) {
  const [ghost, setGhost] = useState(0)
  const ghostTimer = useRef<number>(0)
  useEffect(() => {
    ghostTimer.current = window.setInterval(() => setGhost((g) => (g + 1) % GHOST_EXAMPLES.length), 4200)
    return () => clearInterval(ghostTimer.current)
  }, [])

  const ready = p.achievement.trim().length >= 3

  return (
    <form
      className="docket"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready && !p.busy) p.onMint()
      }}
    >
      <label className="field" data-guide="achievement">
        <span className="field-tag">The achievement</span>
        <input
          className="ach-input"
          value={p.achievement}
          onChange={(e) => p.setAchievement(e.target.value)}
          placeholder={`for ${GHOST_EXAMPLES[ghost]}`}
          maxLength={140}
          autoComplete="off"
          enterKeyHint="done"
        />
      </label>
      <label className="field field-who">
        <span className="field-tag">Conferred upon</span>
        <input
          className="who-input"
          value={p.recipient}
          onChange={(e) => p.setRecipient(e.target.value)}
          placeholder="the bearer"
          maxLength={40}
          autoComplete="off"
        />
      </label>
      <fieldset className="seal-field" data-guide="category">
        <legend className="field-tag">The field of merit</legend>
        <div className="seal-row">
          {CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              className={`seal ${p.category === c ? 'seal-on' : ''}`}
              aria-pressed={p.category === c}
              title={`${CATEGORIES[c].label} — ${CATEGORIES[c].motto}`}
              onClick={() => {
                p.setCategory(c)
                tick(p.soundOn)
              }}
            >
              <span className="seal-face">{CATEGORIES[c].label}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <button className="press" data-guide="mint" type="submit" disabled={!ready || p.busy}>
        <span className="press-face">Mint the medal</span>
      </button>
      {!ready && <p className="hint">The Committee requires an achievement — a few words will do.</p>}
    </form>
  )
}
