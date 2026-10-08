import { useEffect, useRef } from 'react'
import type { Award } from '../lib/award'
import { MedalRenderer } from '../lib/medal'

/* ─────────────────────────────────────────────────────────
 * STRIKE STORYBOARD
 *
 *    0ms   die cocked in the dark above the bed, room dims
 *  110ms   die drops (ease-in, heavy)
 *  330ms   contact: squash + shockwave + thunk
 *  420ms   emboss wave begins center → rim
 * 1080ms   wave reaches rim; relief complete
 * 1150ms   die retreats, heavier and slower than it fell
 * 1600ms   settle wobble → awarded; ribbon slides down
 * ───────────────────────────────────────────────────────── */
const STRIKE = {
  dropStart: 110,
  dropEnd: 330,
  embossStart: 420,
  embossEnd: 1080,
  retractEnd: 1650,
}

const MEDAL_Y = 70 // medal centre below canvas centre, leaving room for the ribbon
const MEDAL_SCALE = 0.74 // medal drawn at 0.74 of canvas half-size, leaving a baize margin
const RIBBON_TOP = -560 // canvas units; ribbon runs off the top edge of frame

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
  onFirstFlip?: () => void // first manual flip/drag — retires the hint
  reducedMotion: boolean
}

interface Mote { x: number; y: number; r: number; vx: number; vy: number; a: number }
interface Speckle { x: number; y: number; len: number; rot: number; a: number }

function drawRibbon(ctx: CanvasRenderingContext2D, t: number, flip: number) {
  // ribbon hangs into frame once the award is struck; it twists with the medal
  const drop = (1 - easeOutQuart(clamp01(t))) * -1400
  const skew = Math.sin(flip) * 0.35
  const squeeze = 1 - Math.abs(Math.sin(flip)) * 0.25
  ctx.save()
  ctx.translate(0, MEDAL_Y - 268) // attach where the medal's scaled top edge sits
  ctx.translate(0, drop)
  ctx.transform(1, 0, skew, 1, 0, 0)
  ctx.scale(squeeze, 1)
  const topW = 168
  const botW = 104
  const h = RIBBON_TOP - (MEDAL_Y - 268) // negative: ribbon reaches up from the attach point
  ctx.beginPath()
  ctx.moveTo(-botW / 2, 0)
  ctx.lineTo(botW / 2, 0)
  ctx.lineTo(topW / 2, h)
  ctx.lineTo(-topW / 2, h)
  ctx.closePath()
  ctx.clip()
  // Nobel-ish grosgrain: cream / blue / red stripes
  const stripes: [string, number, number][] = [
    ['#8e2b2b', -84, -52],
    ['#e8ddc4', -52, -20],
    ['#1c3a6e', -20, 20],
    ['#8e2b2b', 20, 52],
    ['#e8ddc4', 52, 84],
  ]
  ctx.fillStyle = '#8e2b2b'
  ctx.fillRect(-topW / 2 - 20, h - 20, topW + 40, -h + 30)
  for (const [col, x0, x1] of stripes) {
    ctx.fillStyle = col
    ctx.fillRect(x0, h - 20, x1 - x0, -h + 30)
  }
  // weave shadow
  const sh = ctx.createLinearGradient(0, h, 0, 0)
  sh.addColorStop(0, 'rgba(0,0,0,0.28)')
  sh.addColorStop(0.5, 'rgba(0,0,0,0)')
  sh.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = sh
  ctx.fillRect(-topW / 2 - 20, h - 20, topW + 40, -h + 30)
  // fold shadow where the ribbon meets the medal
  const fold = ctx.createLinearGradient(0, -26, 0, 0)
  fold.addColorStop(0, 'rgba(0,0,0,0)')
  fold.addColorStop(1, 'rgba(0,0,0,0.4)')
  ctx.fillStyle = fold
  ctx.fillRect(-botW / 2, -26, botW, 26)
  ctx.restore()
}

export function MedalStage({ award, phase, strikeKey, flipNudge, onStrikeMoment, onFirstFlip, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const flipFired = useRef(false)
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
    pressY: -1400, // bottom edge of the die in centered canvas units; -1400 = offscreen
    shock: -1,
    squash: 1,
    emboss: 0,
    motes: [] as Mote[],
    speckle: [] as Speckle[],
    idleT: 0,
    prevPhase: 'idle' as StagePhase,
    strikeT0: -1,
    contactFired: false,
    awardedT0: -1,
  })

  // seed dust motes + baize speckle once
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
    const sp: Speckle[] = []
    for (let i = 0; i < 150; i++) {
      sp.push({
        x: Math.random() * 1024 - 512,
        y: Math.random() * 1024 - 512,
        len: 3 + Math.random() * 7,
        rot: Math.random() * Math.PI,
        a: 0.02 + Math.random() * 0.05,
      })
    }
    state.current.speckle = sp
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
      if (phase === 'awarded') drawRibbon(ctx, 1, Math.PI * (flipNudge % 2))
      ctx.translate(0, MEDAL_Y)
      ctx.scale(MEDAL_SCALE, MEDAL_SCALE)
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
          s.pressY = -1400
          s.emboss = 0
          s.flip = 0
          s.flipVel = 0
          s.flipAnim = null
          s.awardedT0 = -1
        }
        const t = now - s.strikeT0
        if (t < STRIKE.dropStart) {
          // anticipation: the die shudders at the top of its stroke
          s.pressY = -1400 + Math.sin(t / 9) * 6
          s.squash = 1
        } else if (t < STRIKE.dropEnd) {
          s.pressY = -1400 + easeInCubic((t - STRIKE.dropStart) / (STRIKE.dropEnd - STRIKE.dropStart)) * 1100
        } else {
          if (!s.contactFired) {
            s.contactFired = true
            s.shock = 0
            onStrikeMoment?.()
          }
          s.pressY = -300 // die seated on the planchet's top edge
          const after = t - STRIKE.dropEnd
          s.squash = 1 - 0.03 * Math.exp(-after / 90) * Math.cos(after / 22)
        }
        if (t >= STRIKE.embossStart && t <= STRIKE.embossEnd) {
          s.emboss = easeInOutSine((t - STRIKE.embossStart) / (STRIKE.embossEnd - STRIKE.embossStart))
        } else if (t > STRIKE.embossEnd) {
          s.emboss = 1
        }
        if (t > STRIKE.embossEnd) {
          // heavier, slower retreat than the drop
          s.pressY = -300 - easeOutQuart(clamp01((t - STRIKE.embossEnd) / (STRIKE.retractEnd - STRIKE.embossEnd))) * 1100
        }
        if (s.shock >= 0) s.shock += dt / 700
        if (s.shock > 1) s.shock = -1
      } else {
        if (phase === 'awarded') {
          s.emboss = Math.max(s.emboss, 1)
          if (s.prevPhase !== 'awarded') s.awardedT0 = now
        }
        s.pressY += (-1400 - s.pressY) * Math.min(1, dt / 300)
        s.squash += (1 - s.squash) * Math.min(1, dt / 200)
        s.shock = -1
      }
      s.prevPhase = phase

      // programmatic flip: ease exactly one half-turn to the other face
      if (flipNudge !== s.lastNudge) {
        s.lastNudge = flipNudge
        if (!s.dragging && phase !== 'idle' && flipNudge > 0) {
          const base = s.flip % (Math.PI * 2)
          s.flipAnim = { from: s.flip, to: s.flip - base + Math.PI, t0: now }
          s.flipVel = 0
          if (!flipFired.current) { flipFired.current = true; onFirstFlip?.() }
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
        // at rest, settle gently to the nearest face
        if (phase === 'awarded' && Math.abs(s.flipVel) < 0.0006) {
          const face = Math.round(s.flip / Math.PI) * Math.PI
          const d = face - s.flip
          if (Math.abs(d) > 0.0008) s.flip += d * Math.min(1, dt / 160)
        }
      }
      // sheen follows pointer with light damping
      const k = Math.min(1, dt / 140)
      s.sheenX += (s.sheenTX - s.sheenX) * k
      s.sheenY += (s.sheenTY - s.sheenY) * k
      s.idleT += dt

      // breathing
      const breathe = phase === 'idle' ? 1 + Math.sin(s.idleT / 2400) * 0.004 : 1
      const scale = breathe * s.squash

      ctx.clearRect(0, 0, 1024, 1024)
      ctx.save()
      ctx.translate(512, 512)

      // baize weave: faint static speckle
      for (const p of s.speckle) {
        ctx.strokeStyle = `rgba(240,230,205,${p.a.toFixed(3)})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x + Math.cos(p.rot) * p.len, p.y + Math.sin(p.rot) * p.len)
        ctx.stroke()
      }

      // shockwave ring on the baize — decays before the canvas edge
      if (s.shock >= 0) {
        const rr = 512 * (0.72 + s.shock * 0.18)
        ctx.strokeStyle = `rgba(233,205,120,${(0.5 * (1 - s.shock)).toFixed(3)})`
        ctx.lineWidth = 10 * (1 - s.shock) + 2
        ctx.beginPath()
        ctx.arc(0, MEDAL_Y, rr, 0, Math.PI * 2)
        ctx.stroke()
      }

      // dust motes in the light cone
      for (const m of s.motes) {
        m.x += m.vx * dt / 16
        m.y += m.vy * dt / 16
        if (m.y < -0.05) { m.y = 1.05; m.x = Math.random() }
        if (m.x < -0.05) m.x = 1.05
        if (m.x > 1.05) m.x = -0.05
        const px = (m.x - 0.5) * 900
        const py = (m.y - 0.5) * 900
        const cone = Math.max(0, 1 - Math.abs(px) / 460) * Math.max(0, 1 - Math.abs(py - 0.1) / 500)
        if (cone <= 0.01) continue
        ctx.fillStyle = `rgba(240,230,205,${(m.a * cone).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(px, py - 40, m.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // the anvil bed: a solid iron collar the planchet rests in
      ctx.save()
      ctx.translate(0, MEDAL_Y + 352)
      ctx.scale(1, 0.2)
      // bed face
      const bg = ctx.createRadialGradient(0, -60, 60, 0, -30, 480)
      bg.addColorStop(0, 'rgba(46,38,22,0.9)')
      bg.addColorStop(0.62, 'rgba(24,20,12,0.92)')
      bg.addColorStop(0.86, 'rgba(14,12,7,0.95)')
      bg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = bg
      ctx.beginPath()
      ctx.arc(0, 0, 470, 0, Math.PI * 2)
      ctx.fill()
      // machined rim catching the light along its upper edge
      const rim = ctx.createLinearGradient(0, -120, 0, 60)
      rim.addColorStop(0, 'rgba(216,180,90,0.5)')
      rim.addColorStop(0.45, 'rgba(140,110,50,0.28)')
      rim.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.strokeStyle = rim
      ctx.lineWidth = 30
      ctx.beginPath()
      ctx.arc(0, 6, 402, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      // medal shadow on baize
      ctx.save()
      ctx.translate(0, MEDAL_Y + 392)
      ctx.scale(1, 0.14)
      const shg = ctx.createRadialGradient(0, 0, 0, 0, 0, 420)
      shg.addColorStop(0, 'rgba(0,0,0,0.5)')
      shg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = shg
      ctx.fillRect(-420, -420, 840, 840)
      ctx.restore()

      // ribbon hangs into frame once the award lands
      if (phase === 'awarded' && s.awardedT0 > 0) {
        drawRibbon(ctx, (now - s.awardedT0) / 650, s.flip)
      }

      ctx.save()
      ctx.translate(0, MEDAL_Y)
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

      // the die descends out of the dark at the top of the frame
      if (s.pressY > -1390) {
        const pw = 480, ph = 150
        ctx.save()
        ctx.translate(0, s.pressY - ph) // s.pressY is canvas coords
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
        // darkness above: the die emerges from shadow, never clipped
        const vg = ctx.createLinearGradient(0, -512, 0, -300)
        vg.addColorStop(0, 'rgba(6,9,7,0.92)')
        vg.addColorStop(1, 'rgba(6,9,7,0)')
        ctx.fillStyle = vg
        ctx.fillRect(-512, -512, 1024, 230)
      }

      ctx.restore()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    document.fonts.ready.then(() => renderer.refreshFonts())
    return () => cancelAnimationFrame(raf)
  }, [phase, strikeKey, award, reducedMotion, onStrikeMoment, onFirstFlip, flipNudge])

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
        if (Math.abs(dx) > 2 && !flipFired.current) {
          flipFired.current = true
          onFirstFlip?.()
        }
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
  }, [phase, reducedMotion, onFirstFlip])

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
