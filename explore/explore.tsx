import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/im-fell-english-sc'
import '@fontsource/im-fell-english'
import '@fontsource/im-fell-english/400-italic.css'
import '@fontsource/eb-garamond'
import '@fontsource/eb-garamond/400-italic.css'
import { CATEGORY_ORDER, CATEGORIES, mint } from '../src/lib/award'
import type { Category, Award } from '../src/lib/award'
import { MedalStage } from '../src/components/MedalStage'
import type { StagePhase } from '../src/components/MedalStage'
import './explore.css'

function Docket({
  achievement, setAchievement, category, setCategory, onMint, phase,
}: {
  achievement: string; setAchievement: (v: string) => void
  category: Category; setCategory: (c: Category) => void
  onMint: () => void; phase: StagePhase
}) {
  return (
    <div className="docket">
      <input
        className="ach-input"
        placeholder="for exemplary silence in a meeting that could have been an email"
        value={achievement}
        onChange={(e) => setAchievement(e.target.value)}
      />
      <div className="seal-row">
        {CATEGORY_ORDER.map((c) => (
          <button
            key={c}
            className={`seal ${category === c ? 'seal-on' : ''}`}
            onClick={() => setCategory(c)}
            title={`${CATEGORIES[c].label} — ${CATEGORIES[c].motto}`}
          >
            {CATEGORIES[c].label}
          </button>
        ))}
      </div>
      <button className="press" disabled={!achievement.trim() || phase === 'striking'} onClick={onMint}>
        MINT
      </button>
    </div>
  )
}

function Variant({ v }: { v: string }) {
  const [achievement, setAchievement] = useState('')
  const [category, setCategory] = useState<Category>('peace')
  const [phase, setPhase] = useState<StagePhase>('idle')
  const [award, setAward] = useState<Award | null>(null)
  const [strikeKey, setStrikeKey] = useState(0)

  const onMint = () => {
    setAward(mint({ recipient: '', achievement, category }))
    setPhase('striking')
    setStrikeKey((k) => k + 1)
    setTimeout(() => setPhase('awarded'), 1700)
  }

  const docket = (
    <Docket
      achievement={achievement}
      setAchievement={setAchievement}
      category={category}
      setCategory={setCategory}
      onMint={onMint}
      phase={phase}
    />
  )

  if (v === 'b') {
    // The Vault — alcove left, dossier right
    return (
      <div className="scene scene-b">
        <div className="alcove">
          <div className="arch" />
          <MedalStage award={award} phase={phase} strikeKey={strikeKey} reducedMotion={false} />
        </div>
        <div className="dossier">
          <h1>Laureate</h1>
          <p className="sub">The Committee for Extremely Specific Achievement</p>
          {docket}
        </div>
      </div>
    )
  }
  if (v === 'c') {
    // The Desk — medal hangs on a ribbon above a parchment act
    return (
      <div className="scene scene-c">
        <div className="hang">
          <div className="ribbon" />
          <div className="hang-medal">
            <MedalStage award={award} phase={phase} strikeKey={strikeKey} reducedMotion={false} />
          </div>
        </div>
        <div className="act">
          <h1>Laureate</h1>
          <p className="sub">The Committee for Extremely Specific Achievement</p>
          {docket}
        </div>
      </div>
    )
  }
  // A — The Mint: centered stack
  return (
    <div className="scene scene-a">
      <header className="masthead">
        <h1>Laureate</h1>
        <p className="sub">The Committee for Extremely Specific Achievement</p>
      </header>
      <div className="stage-wrap">
        <MedalStage award={award} phase={phase} strikeKey={strikeKey} reducedMotion={false} />
      </div>
      {docket}
    </div>
  )
}

const v = new URLSearchParams(location.search).get('v') || 'a'
createRoot(document.getElementById('root')!).render(<Variant v={v} />)
