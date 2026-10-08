import { useEffect, useRef } from 'react'
import type { Award } from '../lib/award'
import { MedalRenderer } from '../lib/medal'

/* ─────────────────────────────────────────────────────────
 * STRIKE STORYBOARD
 *
 *    0ms   press cocked, room dims
 *   60ms   press drops (ease-in, heavy)
 *  240ms   contact: squash + shockwave + thunk
 *  320ms   emboss wave begins center → rim
 * 1020ms   wave reaches rim; relief complete
 * 1150ms   press retracts slowly
 * 1500ms   settle wobble → awarded
 * ───────────────────────────────────────────────────────── */
const STRIKE = {
  dropEnd: 240,
  embossStart: 320,
  embossEnd: 1020,
  retractEnd: 1600,
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const easeInCubic = (t: number) => t * t * t
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2

export type StagePhase = 'idle' | 'striking' | 'awarded'

interface Props {
  award: Award | null
  phase: StagePhase
  strikeKey: number // increments per strike
  flipNudge: number // increments to flip the medal to its other face
  onStrikeMoment?: () => void // fires at contact — sfx/vibrate hook
  reducedMotion: boolean
}

interface Mote { x: number; y: number; r: number; vx: number; vy: number; a: number }

export function MedalStage({ award, phase, strikeKey, flipNudge, onStrikeMoment, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const state = useRef({
    flip: 0,
    flipVel: 0,
    flipAnim: null as { from: number; to: number; t0: number } | null,
    sheenX: 0,
    sheenY: -0.4,
    sheenTX: 0,
    sheenTY: -0.4,
    dragging: false,
    dragPointer: -1,
    lastX: 0,
    lastT: 0,
    lastMoveT: 0,
    lastNudge: 0,
    struck: false,
    pressY: -1300, // bottom edge of the press head in centered canvas units; -1300 = offscreen
    shock: -1,
    squash: 1,
    emboss: 0,
    motes: [] as Mote[],
    idleT: 0,
    prevPhase: 'idle' as StagePhase,
    strikeT0: -1,
    contactFired: false,
  })

  // seed dust motes once
  useEffect(() => {
    const m: Mote[] = []
    for (let i = 0; i < 26; i++) {
      m.push({
        x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 1.4,
        vx: (Math.random() - 0.5) * 0.006, vy: -0.002 - Math.random() * 0.008,
        a: 0.05 + Math.random() * 0.12,
      })
    }
    state.current.motes = m
  }, [])

  // reduced motion: draw a single calm frame per state change, no loop
  useEffect(() => {
    if (!reducedMotion) return
    const canvas = canvasRef.current!
    const renderer = new MedalRenderer(1024)
    const ctx = canvas.getContext('2d')!
    const draw = () => {
      renderer.setAward(phase === 'idle' ? null : award)
      ctx.clearRect(0, 0, 1024, 1024)
      ctx.save()
      ctx.translate(512, 512)
      ctx.scale(0.74, 0.74)
      renderer.draw(ctx, {
        award: phase === 'idle' ? null : award,
        emboss: phase === 'idle' ? 0 : 1,
        flip: Math.PI * (flipNudge % 2),
        sheenX: 0,
        sheenY: -0.4,
      })
      ctx.restore()
    }
    draw()
    document.fonts.ready.then(draw)
  }, [reducedMotion, phase, award, strikeKey, flipNudge])

  useEffect(() => {
    if (reducedMotion) return
    const canvas = canvasRef.current!
    const renderer = new MedalRenderer(1024)
    const ctx = canvas.getContext('2d')!
    let raf = 0

    const loop = (now: number) => {
      const s = state.current
      const dt = Math.min(50, now - s.lastT || 16)
      s.lastT = now

      // strike timeline
      if (phase === 'striking') {
        if (s.prevPhase !== 'striking') {
          s.strikeT0 = now
          s.contactFired = false
          s.pressY = -1300
          s.emboss = 0
        }
        const t = now - s.strikeT0
        if (t < STRIKE.dropEnd) {
          s.pressY = -1300 + easeInCubic(t / STRIKE.dropEnd) * 1040
          s.squash = 1
        } else {
          if (!s.contactFired) {
            s.contactFired = true
            s.shock = 0
            onStrikeMoment?.()
          }
          s.pressY = -260
          const after = t - STRIKE.dropEnd
          s.squash = 1 - 0.03 * Math.exp(-after / 90) * Math.cos(after / 22)
        }
        if (t >= STRIKE.embossStart && t <= STRIKE.embossEnd) {
          s.emboss = easeInOutSine((t - STRIKE.embossStart) / (STRIKE.embossEnd - STRIKE.embossStart))
        } else if (t > STRIKE.embossEnd) {
          s.emboss = 1
        }
        if (t > STRIKE.embossEnd) {
          s.pressY = -260 - easeOutQuart(clamp01((t - STRIKE.embossEnd) / (STRIKE.retractEnd - STRIKE.embossEnd))) * 1040
        }
        if (s.shock >= 0) s.shock += dt / 700
        if (s.shock > 1) s.shock = -1
      } else {
        if (phase === 'awarded') s.emboss = Math.max(s.emboss, 1)
        s.pressY += (-1300 - s.pressY) * Math.min(1, dt / 300)
        s.squash += (1 - s.squash) * Math.min(1, dt / 200)
        s.shock = -1
      }
      s.prevPhase = phase

      // programmatic flip: ease exactly one half-turn to the other face
      if (flipNudge !== s.lastNudge) {
        s.lastNudge = flipNudge
        if (!s.dragging && phase !== 'idle') {
          const base = s.flip % (Math.PI * 2)
          s.flipAnim = { from: s.flip - base, to: s.flip - base + Math.PI, t0: now }
          s.flipVel = 0
        }
      }
      if (s.flipAnim && !s.dragging) {
        const t = clamp01((now - s.flipAnim.t0) / 550)
        s.flip = s.flipAnim.from + (s.flipAnim.to - s.flipAnim.from) * easeOutQuart(t)
        if (t >= 1) s.flipAnim = null
      }
      // spin physics
      if (!s.dragging && !s.flipAnim) {
        s.flip += s.flipVel * dt
        s.flipVel *= Math.pow(0.9985, dt)
        if (Math.abs(s.flipVel) < 0.00001) s.flipVel = 0
      }
      // sheen follows pointer with light damping
      const k = Math.min(1, dt / 140)
      s.sheenX += (s.sheenTX - s.sheenX) * k
      s.sheenY += (s.sheenTY - s.sheenY) * k
      s.idleT += dt

      // breathing
      const breathe = phase === 'idle' ? 1 + Math.sin(s.idleT / 2400) * 0.004 : 1
      const scale = breathe * s.squash
      const MEDAL_SCALE = 0.74 // medal drawn at 0.74 of canvas half-size, leaving a baize margin

      ctx.clearRect(0, 0, 1024, 1024)
      ctx.save()
      ctx.translate(512, 512)

      // shockwave ring on the baize
      if (s.shock >= 0) {
        const rr = 512 * (0.78 + s.shock * 0.55)
        ctx.strokeStyle = `rgba(233,205,120,${0.5 * (1 - s.shock)})`
        ctx.lineWidth = 10 * (1 - s.shock) + 2
        ctx.beginPath()
        ctx.arc(0, 0, rr, 0, Math.PI * 2)
        ctx.stroke()
      }

      // dust motes in the light cone (drawn under medal? over — subtle)
      for (const m of s.motes) {
        m.x += m.vx * dt / 16
        m.y += m.vy * dt / 16
        if (m.y < -0.05) { m.y = 1.05; m.x = Math.random() }
        if (m.x < -0.05) m.x = 1.05
        if (m.x > 1.05) m.x = -0.05
        const px = (m.x - 0.5) * 900
        const py = (m.y - 0.5) * 900
        const cone = Math.max(0, 1 - Math.abs(px) / 460) * Math.max(0, 1 - Math.abs(py) / 500)
        if (cone <= 0.01) continue
        ctx.fillStyle = `rgba(240,230,205,${(m.a * cone).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(px, py - 40, m.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // medal shadow on baize
      ctx.save()
      ctx.translate(0, 400)
      ctx.scale(1, 0.14)
      const shg = ctx.createRadialGradient(0, 0, 0, 0, 0, 420)
      shg.addColorStop(0, 'rgba(0,0,0,0.5)')
      shg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = shg
      ctx.fillRect(-420, -420, 840, 840)
      ctx.restore()

      ctx.save()
      ctx.scale(scale * MEDAL_SCALE, scale * MEDAL_SCALE)
      renderer.setAward(phase === 'idle' ? null : award)
      renderer.draw(ctx, {
        award: phase === 'idle' ? null : award,
        emboss: s.emboss,
        flip: s.flip,
        sheenX: s.sheenX,
        sheenY: s.sheenY,
      })
      ctx.restore()

      // press head descending from above; s.pressY is its bottom edge
      if (s.pressY > -1290) {
        const pw = 480, ph = 150
        ctx.save()
        ctx.translate(0, s.pressY - ph)
        const pg = ctx.createLinearGradient(-pw / 2, 0, pw / 2, 0)
        pg.addColorStop(0, '#3a2c12')
        pg.addColorStop(0.2, '#8a6d28')
        pg.addColorStop(0.5, '#d8b45a')
        pg.addColorStop(0.8, '#8a6d28')
        pg.addColorStop(1, '#2c220e')
        ctx.fillStyle = pg
        ctx.fillRect(-pw * 0.18, -320, pw * 0.36, 320)
        ctx.beginPath()
        ctx.roundRect(-pw / 2, 0, pw, ph, 14)
        ctx.fill()
        ctx.fillStyle = 'rgba(20,14,4,0.55)'
        ctx.beginPath()
        ctx.roundRect(-pw / 2, ph - 24, pw, 24, 8)
        ctx.fill()
        ctx.restore()
      }

      ctx.restore()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    document.fonts.ready.then(() => renderer.refreshFonts())
    return () => cancelAnimationFrame(raf)
  }, [phase, strikeKey, award, reducedMotion, onStrikeMoment, flipNudge])

  // pointer interaction: tilt sheen always; drag-spin when awarded
  useEffect(() => {
    const el = wrapRef.current!
    const s = state.current
    const toLocal = (e: PointerEvent) => {
      const b = el.getBoundingClientRect()
      return {
        x: ((e.clientX - b.left) / b.width) * 2 - 1,
        y: ((e.clientY - b.top) / b.height) * 2 - 1,
      }
    }
    const move = (e: PointerEvent) => {
      const p = toLocal(e)
      s.sheenTX = Math.max(-1, Math.min(1, p.x))
      s.sheenTY = Math.max(-1, Math.min(1, p.y))
      if (s.dragging && e.pointerId === s.dragPointer) {
        const dx = e.clientX - s.lastX
        const dt = Math.max(1, e.timeStamp - s.lastMoveT)
        s.lastX = e.clientX
        s.lastMoveT = e.timeStamp
        const dv = dx * 0.012
        s.flip += dv
        s.flipVel = dv / dt // per-ms, consistent with the rAF loop
      }
    }
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || s.dragging || reducedMotion) return
      const p = toLocal(e)
      if (Math.hypot(p.x, p.y) < 1.1 && phase === 'awarded') {
        s.dragging = true
        s.dragPointer = e.pointerId
        s.lastX = e.clientX
        s.lastMoveT = e.timeStamp
        s.flipVel = 0
        s.flipAnim = null
        el.setPointerCapture(e.pointerId)
      }
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== s.dragPointer) return
      s.dragging = false
      s.dragPointer = -1
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('lostpointercapture', up)
    return () => {
      s.dragging = false
      s.dragPointer = -1
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('lostpointercapture', up)
    }
  }, [phase, reducedMotion])

  const canvasLabel =
    phase === 'idle'
      ? 'A blank gold planchet waiting under the press'
      : award
        ? `A gold medal struck for ${award.recipient || 'the bearer'}`
        : 'The medal'

  return (
    <div ref={wrapRef} className="medal-stage">
      <canvas ref={canvasRef} width={1024} height={1024} role="img" aria-label={canvasLabel} />
    </div>
  )
}
