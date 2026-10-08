import { useCallback, useEffect, useRef, useState } from 'react'
import { decodeAward, encodeAward, mint } from './lib/award'
import type { Award, Category } from './lib/award'
import { MedalStage } from './components/MedalStage'
import type { StagePhase } from './components/MedalStage'
import { CommitteeForm } from './components/CommitteeForm'
import { Diploma } from './components/Diploma'
import { ShareBar } from './components/ShareBar'
import { renderCard } from './lib/sharecard'
import { shimmer, thunk } from './lib/sfx'

const STRIKE_MS = 2150

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
  const [hintDone, setHintDone] = useState(false)
  const [soundOn, setSoundOn] = useState(soundPref)
  const [reduced, setReduced] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const stageRef = useRef<HTMLDivElement>(null)
  const sideRef = useRef<HTMLDivElement>(null)
  const flipFrom = useRef<DOMRect | null>(null)
  const ghostFrom = useRef<DOMRect | null>(null)
  const ceremonyTimer = useRef<number>(0)
  // one ceremony at a time: a generation counter rejects orphan callbacks,
  // and a synchronous ref blocks a second submit in the same event turn
  const ceremonyGen = useRef(0)
  const mintBusy = useRef(false)
  const [pending, setPending] = useState(false)
  // the petition lingers as an inert ghost under the unfurling diploma —
  // the paperwork transforms, it never teleports
  const [paperGone, setPaperGone] = useState(() => !!award)

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
      ceremonyGen.current++
      mintBusy.current = false
      setPending(false)
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
        setPaperGone(true)
      } else {
        setAward(null)
        setPhase('idle')
        setBadHash(true)
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(
    () => () => {
      ceremonyGen.current++
      clearTimeout(ceremonyTimer.current)
    },
    [],
  )

  // FLIP the medal when the layout shifts on award — all viewports
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

  // move focus to the outcome once the diploma has actually unfurled,
  // and retire the petition ghost once the paper reveal covers it
  useEffect(() => {
    if (phase !== 'awarded') return
    // pin the ghost to the diploma's exact box, seed its clip variables,
    // and travel it from the petition's measured rect to that box
    const raf = requestAnimationFrame(() => {
      const dip = sideRef.current?.querySelector<HTMLElement>('.diploma')
      const ghost = sideRef.current?.querySelector<HTMLElement>('.docket-ghost')
      if (dip && ghost && sideRef.current) {
        ghost.style.left = `${dip.offsetLeft}px`
        ghost.style.width = `${dip.offsetWidth}px`
        sideRef.current.style.setProperty('--dip-h', `${dip.offsetHeight}px`)
        sideRef.current.style.setProperty('--ghost-h', `${ghost.offsetHeight}px`)
        sideRef.current.style.setProperty(
          '--ghost-clip',
          `${Math.max(0, ghost.offsetHeight - dip.offsetHeight)}px`,
        )
      }
      const from = ghostFrom.current
      ghostFrom.current = null
      if (ghost && from && !reduced) {
        const now = ghost.getBoundingClientRect()
        const dx = from.left + from.width / 2 - (now.left + now.width / 2)
        const dy = from.top + from.height / 2 - (now.top + now.height / 2)
        const sx = from.width / now.width
        const sy = from.height / now.height
        ghost.style.transformOrigin = '50% 50%'
        ghost.style.transition = 'none'
        ghost.style.transform = `translate(${dx}px,${dy}px) scale(${sx},${sy})`
        requestAnimationFrame(() => {
          ghost.style.transition = 'transform 480ms cubic-bezier(0.32, 0.72, 0, 1)'
          ghost.style.transform = 'none'
        })
      }
    })
    const focusT = setTimeout(
      () =>
        document
          .querySelector<HTMLElement>('[data-focus="diploma"]')
          ?.focus({ preventScroll: true }),
      reduced ? 60 : 1300,
    )
    const ghostT = setTimeout(() => setPaperGone(true), reduced ? 300 : 1500)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(focusT)
      clearTimeout(ghostT)
    }
  }, [phase, award, reduced])

  const onMint = useCallback(() => {
    if (mintBusy.current) return
    mintBusy.current = true
    setPending(true)
    const gen = ++ceremonyGen.current
    const a = mint({ recipient, achievement, category })
    setAward(a)
    setFlipNudge(0)
    setHintDone(false)
    setPaperGone(false)
    history.replaceState(null, '', '#a=' + encodeAward(a))
    // on short screens the mint button sits below the press — bring the whole
    // machine into view before the strike, or the visitor misses it
    const stage = stageRef.current
    const offscreen = !!stage && stage.getBoundingClientRect().top < 8
    const delay = offscreen ? (reduced ? 0 : 620) : 0
    if (offscreen) stage.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    ceremonyTimer.current = window.setTimeout(() => {
      if (gen !== ceremonyGen.current) return
      setPhase('striking')
      setStrikeKey((k) => k + 1)
      ceremonyTimer.current = window.setTimeout(() => {
        if (gen !== ceremonyGen.current) return
        mintBusy.current = false
        setPending(false)
        flipFrom.current = stageRef.current?.getBoundingClientRect() ?? null
        // the petition must not teleport: remember its screen rect so the
        // ghost can hold that position and travel into the diploma slot
        ghostFrom.current =
          document.querySelector<HTMLElement>('.petition')?.getBoundingClientRect() ?? null
        setPhase('awarded')
        shimmer(soundPref())
      }, reduced ? 300 : STRIKE_MS)
    }, delay)
  }, [recipient, achievement, category, reduced])

  const onFlipRequest = useCallback(() => setFlipNudge((n) => n + 1), [])

  const onContact = useCallback(() => {
    thunk(soundPref())
    try {
      navigator.vibrate?.(30)
    } catch { /* unsupported */ }
  }, [])

  // stable identity: an inline callback would rebind the stage's pointer
  // listeners mid-drag and cancel the first interaction it reports
  const onFirstFlip = useCallback(() => setHintDone(true), [])

  const onReset = useCallback(() => {
    ceremonyGen.current++
    mintBusy.current = false
    setPending(false)
    clearTimeout(ceremonyTimer.current)
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
        <p className="sub">
          Award someone a gold medal for something gloriously minor.
        </p>
      </header>

      <p className="vh" aria-live="polite">
        {statusText}
      </p>

      <main className="main">
        <div className="stage-col" ref={stageRef}>
          <MedalStage
            award={award}
            category={award?.category ?? category}
            phase={phase}
            strikeKey={strikeKey}
            flipNudge={flipNudge}
            onStrikeMoment={onContact}
            onFirstFlip={onFirstFlip}
            onFlipRequest={onFlipRequest}
            reducedMotion={reduced}
          />
          {phase === 'awarded' && (
            <div className="stage-hints">
              {!hintDone && !reduced && (
                <p className="drag-hint">It spins — drag it.</p>
              )}
              <button
                className="flip-btn"
                onClick={() => setFlipNudge((n) => n + 1)}
              >
                turn it over
              </button>
            </div>
          )}
        </div>

        <div className="side-col" ref={sideRef}>
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
            <>
              {!paperGone && (
                <div className="docket-ghost" inert aria-hidden="true">
                  <div className="docket-ghost-paper">
                    <CommitteeForm
                      recipient={recipient}
                      achievement={achievement}
                      category={category}
                      setRecipient={setRecipient}
                      setAchievement={setAchievement}
                      setCategory={setCategory}
                      onMint={onMint}
                      onToggleSound={toggleSound}
                      busy
                      soundOn={soundOn}
                    />
                  </div>
                </div>
              )}
              <Diploma award={award} animate={!reduced} />
            </>
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
                onToggleSound={toggleSound}
                busy={pending || phase === 'striking'}
                soundOn={soundOn}
              />
            )
          )}
          {phase === 'awarded' && award && <ShareBar award={award} onReset={onReset} />}
        </div>
      </main>
    </div>
  )
}
