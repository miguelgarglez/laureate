import { useCallback, useEffect, useRef, useState } from 'react'
import { decodeAward, encodeAward, mint } from './lib/award'
import type { Award, Category } from './lib/award'
import { MedalStage } from './components/MedalStage'
import type { StagePhase } from './components/MedalStage'
import { CommitteeForm } from './components/CommitteeForm'
import { Diploma } from './components/Diploma'
import { ShareBar } from './components/ShareBar'
import { Guide } from './components/Guide'
import { guideSeen, markGuideSeen } from './lib/guide'
import { renderCard } from './lib/sharecard'
import { shimmer, thunk } from './lib/sfx'

const STRIKE_MS = 1700

const soundPref = () => {
  try {
    return localStorage.getItem('laureate.sound') === '1'
  } catch {
    return false
  }
}

function OgMode() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let cancelled = false
    const el = ref.current!
    document.fonts.ready.then(() => {
      if (cancelled) return
      const award = mint({
        recipient: 'the bearer',
        achievement: 'exemplary silence in a meeting that could have been an email',
        category: 'peace',
        dateISO: '2026-10-08',
      })
      const card = renderCard(award)
      card.style.width = '1200px'
      card.style.height = '630px'
      el.appendChild(card)
    })
    return () => {
      cancelled = true
      el.innerHTML = ''
    }
  }, [])
  return <div ref={ref} style={{ width: 1200, height: 630 }} />
}

export default function App() {
  const [award, setAward] = useState<Award | null>(() =>
    location.hash.startsWith('#a=') ? decodeAward(location.hash) : null,
  )
  const [phase, setPhase] = useState<StagePhase>(award ? 'awarded' : 'idle')
  const [badHash, setBadHash] = useState(
    () => location.hash.startsWith('#a=') && !decodeAward(location.hash),
  )
  const [recipient, setRecipient] = useState('')
  const [achievement, setAchievement] = useState('')
  const [category, setCategory] = useState<Category>('peace')
  const [strikeKey, setStrikeKey] = useState(0)
  const [flipNudge, setFlipNudge] = useState(0)
  const [soundOn, setSoundOn] = useState(soundPref)
  const [showGuide, setShowGuide] = useState(() => !guideSeen())
  const [reduced, setReduced] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const stageRef = useRef<HTMLDivElement>(null)
  const flipFrom = useRef<DOMRect | null>(null)
  const ceremonyTimer = useRef<number>(0)

  // OG render mode (?og) — used by the capture script only
  const og = new URLSearchParams(location.search).has('og')

  // live motion preference
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // hash navigation: follow permalink changes without a reload
  useEffect(() => {
    const onHash = () => {
      clearTimeout(ceremonyTimer.current)
      if (!location.hash.startsWith('#a=')) {
        setBadHash(false)
        setAward(null)
        setPhase('idle')
        return
      }
      const a = decodeAward(location.hash)
      if (a) {
        flipFrom.current = stageRef.current?.getBoundingClientRect() ?? null
        setAward(a)
        setPhase('awarded')
        setBadHash(false)
      } else {
        setAward(null)
        setPhase('idle')
        setBadHash(true)
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => () => clearTimeout(ceremonyTimer.current), [])

  // FLIP the medal when the layout swaps columns on award
  useEffect(() => {
    const el = stageRef.current
    if (!el || !flipFrom.current || reduced) return
    const now = el.getBoundingClientRect()
    const from = flipFrom.current
    flipFrom.current = null
    const dx = from.left + from.width / 2 - (now.left + now.width / 2)
    const dy = from.top + from.height / 2 - (now.top + now.height / 2)
    const s = from.width / now.width
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < 0.01) return
    el.style.transition = 'none'
    el.style.transform = `translate(${dx}px,${dy}px) scale(${s})`
    requestAnimationFrame(() => {
      el.style.transition = 'transform 620ms cubic-bezier(0.32, 0.72, 0, 1)'
      el.style.transform = 'none'
    })
  }, [phase, award, reduced])

  // move focus to the outcome when the ceremony completes
  useEffect(() => {
    if (phase !== 'awarded') return
    const t = setTimeout(
      () => document.querySelector<HTMLElement>('[data-focus="diploma"]')?.focus(),
      reduced ? 60 : 900,
    )
    return () => clearTimeout(t)
  }, [phase, award, reduced])

  const onMint = useCallback(() => {
    if (phase === 'striking') return
    const a = mint({ recipient, achievement, category })
    setAward(a)
    setPhase('striking')
    setStrikeKey((k) => k + 1)
    setFlipNudge(0)
    history.replaceState(null, '', '#a=' + encodeAward(a))
    setShowGuide(false)
    markGuideSeen()
    ceremonyTimer.current = window.setTimeout(() => {
      flipFrom.current = stageRef.current?.getBoundingClientRect() ?? null
      setPhase('awarded')
      shimmer(soundPref())
    }, reduced ? 300 : STRIKE_MS)
  }, [phase, recipient, achievement, category, reduced])

  const onContact = useCallback(() => {
    thunk(soundPref())
    try {
      navigator.vibrate?.(30)
    } catch { /* unsupported */ }
  }, [])

  const onReset = useCallback(() => {
    flipFrom.current = stageRef.current?.getBoundingClientRect() ?? null
    setPhase('idle')
    setAward(null)
    setAchievement('')
    setFlipNudge(0)
    history.replaceState(null, '', location.pathname)
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.ach-input')?.focus())
  }, [])

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    try {
      localStorage.setItem('laureate.sound', next ? '1' : '0')
    } catch { /* private */ }
  }

  const guideStep = showGuide ? (achievement.trim().length >= 3 ? 1 : 0) : 2

  const statusText =
    phase === 'striking'
      ? 'The press is striking your medal.'
      : phase === 'awarded' && award
        ? 'The medal is struck. Your diploma is ready.'
        : ''

  if (og) return <OgMode />

  return (
    <div className={`scene phase-${phase}`}>
      <header className="masthead">
        <h1>Laureate</h1>
        <p className="sub">The Committee for Extremely Specific Achievement</p>
      </header>

      <p className="vh" aria-live="polite">
        {statusText}
      </p>

      <main className="main">
        <div className="stage-col" ref={stageRef}>
          <div className={`ribbon-drop ${phase === 'awarded' ? 'ribbon-on' : ''}`} aria-hidden="true" />
          <MedalStage
            award={award}
            phase={phase}
            strikeKey={strikeKey}
            flipNudge={flipNudge}
            onStrikeMoment={onContact}
            reducedMotion={reduced}
          />
          {phase === 'awarded' && (
            <div className="stage-hints">
              {!reduced && <p className="drag-hint">The medal takes a spin — drag it.</p>}
              <button
                className="slink slink-dim flip-btn"
                onClick={() => setFlipNudge((n) => n + 1)}
              >
                Turn it over
              </button>
            </div>
          )}
        </div>

        <div className="side-col">
          {badHash && (
            <div className="objection" role="alert">
              <p className="obj-title">The Committee found no record of that award.</p>
              <p>
                The link appears to be mis-struck.{' '}
                <button
                  className="slink"
                  onClick={() => {
                    history.replaceState(null, '', location.pathname)
                    setBadHash(false)
                  }}
                >
                  Return to the mint
                </button>
              </p>
            </div>
          )}

          {phase === 'awarded' && award ? (
            <Diploma award={award} animate={!reduced} />
          ) : (
            !badHash && (
              <CommitteeForm
                recipient={recipient}
                achievement={achievement}
                category={category}
                setRecipient={setRecipient}
                setAchievement={setAchievement}
                setCategory={setCategory}
                onMint={onMint}
                busy={phase === 'striking'}
                soundOn={soundOn}
              />
            )
          )}
          {phase === 'awarded' && award && <ShareBar award={award} onReset={onReset} />}
        </div>
      </main>

      <footer className="foot">
        <span>Struck locally — no committee was contacted.</span>
      </footer>

      <div className="foot-utils">
        <button
          className="util"
          onClick={toggleSound}
          aria-pressed={soundOn}
          title={soundOn ? 'Sound off' : 'Sound on'}
        >
          {soundOn ? 'Sound on' : 'Sound off'}
        </button>
        <button
          className="util"
          onClick={() => setShowGuide(true)}
          title="Replay the first steps"
        >
          ?
        </button>
      </div>

      {guideStep < 2 && !badHash && (
        <Guide
          step={guideStep as 0 | 1}
          onSkip={() => {
            setShowGuide(false)
            markGuideSeen()
          }}
        />
      )}
    </div>
  )
}
