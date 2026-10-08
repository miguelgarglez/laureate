import { useEffect, useRef, useState } from 'react'
import { CATEGORY_ORDER, CATEGORIES, GHOST_EXAMPLES, petitionOk } from '../lib/award'
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
  onToggleSound: () => void
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

  const ready = petitionOk(p.achievement)

  return (
    <form
      className="docket petition"
      aria-label="Petition to the Committee"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready && !p.busy) p.onMint()
      }}
    >
      <p className="petition-head">
        <span>Petition to the Committee</span>
      </p>
      <label className="field" data-guide="achievement">
        <span className="field-tag">The achievement</span>
        <input
          className="ach-input"
          value={p.achievement}
          onChange={(e) => p.setAchievement(e.target.value)}
          placeholder="name the deed"
          maxLength={140}
          autoComplete="off"
          enterKeyHint="done"
        />
      </label>
      <p className={`petition-note ${p.achievement ? 'note-hidden' : ''}`} aria-hidden={!!p.achievement}>
        e.g.{' '}
        <button
          type="button"
          className="note-example"
          tabIndex={p.achievement ? -1 : 0}
          onClick={() => p.setAchievement(GHOST_EXAMPLES[ghost])}
        >
          “{GHOST_EXAMPLES[ghost]}”
        </button>
      </p>
      <label className="field field-who">
        <span className="field-tag">Conferred upon — or leave blank for the bearer</span>
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
        <div className="seal-grid">
          {CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              className={`seal-cell ${p.category === c ? 'seal-on' : ''}`}
              aria-pressed={p.category === c}
              title={`${CATEGORIES[c].label} — ${CATEGORIES[c].motto}`}
              onClick={() => {
                p.setCategory(c)
                tick(p.soundOn)
              }}
            >
              <span className="seal">
                <span className="seal-face">{CATEGORIES[c].label.slice(0, 2)}</span>
              </span>
              <span className="seal-name">{CATEGORIES[c].label}</span>
            </button>
          ))}
        </div>
        <p className="seal-explainer">
          <span className="seal-motto">{CATEGORIES[p.category].motto}.</span>
          <span className="seal-why"> The field is engraved on the die and struck into the medal.</span>
        </p>
      </fieldset>
      <button className="press" data-guide="mint" type="submit" disabled={!ready || p.busy}>
        <span className="press-face">Mint the medal</span>
      </button>
      <button type="button" className="docket-sound" onClick={p.onToggleSound} aria-pressed={p.soundOn}>
        Sound: {p.soundOn ? 'on' : 'off'}
      </button>
      {!ready && p.achievement.length > 0 && (
        <p className="hint">A few more words — the Committee requires a real deed.</p>
      )}
    </form>
  )
}
