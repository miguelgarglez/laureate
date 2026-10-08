import { useEffect, useRef } from 'react'
import type { Award, Category } from '../lib/award'
import { CATEGORIES } from '../lib/award'
import { MedalRenderer, emblem } from '../lib/medal'

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
  dwellEnd: 1240, // the die holds the face for a beat before releasing
  retractEnd: 1800,
}
const DIE_SEAT = 368 // die face-plate lands on the flat planchet's surface
const DIE_PARK = 200 // ram parked: die head hovers just above the blank
const FLAT_Y = 370 // the planchet lies flat in the anvil slot
const FLAT_TILT = 0.34 // squash factor: a coin lying on the bed, seen at an angle

const MEDAL_Y = 70 // medal centre below canvas centre, leaving room for the ribbon
const MEDAL_SCALE = 0.74 // press scale: planchet sits inside the tooling with baize margin
const AWARD_SCALE = 0.88 // display scale: the struck medal fills the stage for inspection
const RIBBON_TOP = -560 // canvas units; ribbon runs off the top edge of frame

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const easeInCubic = (t: number) => t * t * t
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4)
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2

export type StagePhase = 'idle' | 'striking' | 'awarded'

interface Props {
  award: Award | null
  category: Category // selected field — engraved on the die face in idle
  phase: StagePhase
  strikeKey: number // increments per strike
  flipNudge: number // increments to flip the medal to its other face
  onStrikeMoment?: () => void // fires at contact — sfx/vibrate hook
  onFirstFlip?: () => void // first manual flip/drag — retires the hint
  reducedMotion: boolean
}

interface Mote { x: number; y: number; r: number; vx: number; vy: number; a: number }
interface Speckle { x: number; y: number; len: number; rot: number; a: number }

function drawRibbon(ctx: CanvasRenderingContext2D, t: number, flip: number, attachY: number) {
  // ribbon lowers into frame once the award is struck; it twists with the medal
  const drop = (1 - easeOutQuart(clamp01(t))) * -1400
  const skew = Math.sin(flip) * 0.35
  const squeeze = 1 - Math.abs(Math.sin(flip)) * 0.25
  ctx.save()
  ctx.translate(0, attachY)
  ctx.translate(0, drop)
  ctx.rotate(Math.sin(clamp01(t) * Math.PI * 2.4) * 0.05 * (1 - clamp01(t))) // pendulum settle
  ctx.globalAlpha = 0.3 + 0.7 * clamp01(t * 3) // fades in as it lowers
  ctx.transform(1, 0, skew, 1, 0, 0)
  ctx.scale(squeeze, 1)
  const topW = 168
  const botW = 104
  const h = RIBBON_TOP - attachY // negative: ribbon reaches up from the attach point
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
  // the ribbon climbs into darkness, not into a hard edge
  const fade = ctx.createLinearGradient(0, h - 20, 0, h + 150)
  fade.addColorStop(0, 'rgba(6,9,7,0.95)')
  fade.addColorStop(1, 'rgba(6,9,7,0)')
  ctx.fillStyle = fade
  ctx.fillRect(-topW / 2 - 20, h - 20, topW + 40, 170)
  // fold shadow where the ribbon meets the medal
  const fold = ctx.createLinearGradient(0, -26, 0, 0)
  fold.addColorStop(0, 'rgba(0,0,0,0)')
  fold.addColorStop(1, 'rgba(0,0,0,0.4)')
  ctx.fillStyle = fold
  ctx.fillRect(-botW / 2, -26, botW, 26)
  ctx.restore()
}

export function MedalStage({ award, category, phase, strikeKey, flipNudge, onStrikeMoment, onFirstFlip, reducedMotion }: Props) {
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
    downX: 0,
    downT: 0,
    lastNudge: 0,
    pressY: -1400, // bottom edge of the die in centered canvas units; -1400 = offscreen
    shock: -1,
    squash: 1,
    emboss: 0,
    flash: -1, // contact light pulse behind the medal
    bedKick: 0, // anvil recoil on contact
    sweep: -1, // light sweep across the finished relief
    sweepDone: false,
    medalScale: MEDAL_SCALE,
    tilt: FLAT_TILT, // 1 = face-on, FLAT_TILT = lying on the bed
    medalY: FLAT_Y,
    ribbonFlip: 0, // the ribbon follows the medal's spin on a delay
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
      const ms = phase === 'awarded' ? AWARD_SCALE : MEDAL_SCALE
      const tilt = phase === 'awarded' ? 1 : FLAT_TILT
      const my = phase === 'awarded' ? MEDAL_Y : FLAT_Y
      if (phase === 'awarded') drawRibbon(ctx, 1, Math.PI * (flipNudge % 2), MEDAL_Y - 512 * ms)
      ctx.translate(0, my)
      ctx.scale(ms, ms * tilt)
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
          s.sweep = -1
          s.sweepDone = false
          flipFired.current = false
        }
        const t = now - s.strikeT0
        if (t > STRIKE.embossEnd && s.sweep < 0 && !s.sweepDone) {
          s.sweep = 0
          s.sweepDone = true
        }
        if (t < STRIKE.dropStart) {
          // anticipation: the ram cocks a touch higher, shuddering under load
          s.pressY = DIE_PARK - easeInCubic(clamp01(t / STRIKE.dropStart)) * 80
          s.squash = 1
        } else if (t < STRIKE.dropEnd) {
          s.pressY = DIE_PARK - 80 + easeInCubic((t - STRIKE.dropStart) / (STRIKE.dropEnd - STRIKE.dropStart)) * (DIE_SEAT - DIE_PARK + 80)
        } else {
          if (!s.contactFired) {
            s.contactFired = true
            s.shock = 0
            s.flash = 0
            s.bedKick = 1
            onStrikeMoment?.()
          }
          s.pressY = DIE_SEAT
          const after = t - STRIKE.dropEnd
          s.squash = 1 - 0.03 * Math.exp(-after / 90) * Math.cos(after / 22)
        }
        if (t >= STRIKE.embossStart && t <= STRIKE.embossEnd) {
          s.emboss = easeInOutSine((t - STRIKE.embossStart) / (STRIKE.embossEnd - STRIKE.embossStart))
        } else if (t > STRIKE.embossEnd) {
          s.emboss = 1
        }
        if (t > STRIKE.dwellEnd) {
          // the ram returns to its parked hover
          s.pressY = DIE_SEAT - easeOutQuart(clamp01((t - STRIKE.dwellEnd) / (STRIKE.retractEnd - STRIKE.dwellEnd))) * (DIE_SEAT - DIE_PARK)
        }
        if (s.flash >= 0) s.flash += dt / 380
        if (s.flash > 1) s.flash = -1
        s.bedKick *= Math.pow(0.994, dt)
        if (s.shock >= 0) s.shock += dt / 700
        if (s.shock > 1) s.shock = -1
        if (s.sweep >= 0) s.sweep += dt / 700
        if (s.sweep > 1) s.sweep = -1
      } else {
        if (phase === 'awarded') {
          s.emboss = Math.max(s.emboss, 1)
          if (s.prevPhase !== 'awarded') s.awardedT0 = now
        }
        s.pressY += (-1400 - s.pressY) * Math.min(1, dt / 300)
        s.squash += (1 - s.squash) * Math.min(1, dt / 200)
        s.shock = -1
        // strike transients keep decaying after the phase ends — a cancelled
        // or completed ceremony must never leave a frozen layer
        if (s.flash >= 0) { s.flash += dt / 380; if (s.flash > 1) s.flash = -1 }
        s.bedKick *= Math.pow(0.994, dt)
        if (s.bedKick < 0.005) s.bedKick = 0
        if (s.sweep >= 0) { s.sweep += dt / 700; if (s.sweep > 1) s.sweep = -1 }
      }
      s.prevPhase = phase

      // programmatic flip: ease to the next half-turn — alternates faces on every nudge
      if (flipNudge !== s.lastNudge) {
        s.lastNudge = flipNudge
        if (!s.dragging && phase !== 'idle' && flipNudge > 0) {
          const next = Math.floor(s.flip / Math.PI + 0.5) * Math.PI + Math.PI
          s.flipAnim = { from: s.flip, to: next, t0: now }
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
      // the ribbon lags the medal's spin like a hanging cloth
      s.ribbonFlip += (s.flip - s.ribbonFlip) * Math.min(1, dt / 320)
      // display scale once struck — the medal fills the stage for inspection
      const targetScale = phase === 'awarded' ? AWARD_SCALE : MEDAL_SCALE
      s.medalScale += (targetScale - s.medalScale) * Math.min(1, dt / 350)
      // the struck medal lifts off the bed and turns to face the visitor
      const tiltT = phase === 'awarded' ? 1 : FLAT_TILT
      const medalYT = phase === 'awarded' ? MEDAL_Y : FLAT_Y
      s.tilt += (tiltT - s.tilt) * Math.min(1, dt / 380)
      s.medalY += (medalYT - s.medalY) * Math.min(1, dt / 380)

      // at rest the ram hovers just above the work, breathing faintly;
      // once awarded it retracts behind the beam so the medal lifts clear
      if (phase === 'idle') s.pressY = DIE_PARK + Math.sin(s.idleT / 900) * 2
      else if (phase === 'awarded') s.pressY += (-500 - s.pressY) * Math.min(1, dt / 400)

      // breathing
      const scale = phase === 'idle' ? 1 + Math.sin(s.idleT / 2400) * 0.004 : 1

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

      // shockwave ring out of the anvil — decays before the canvas edge
      if (s.shock >= 0) {
        ctx.save()
        ctx.translate(0, s.medalY + 30)
        ctx.scale(1, 0.4)
        const rr = 512 * (0.72 + s.shock * 0.18)
        ctx.strokeStyle = `rgba(233,205,120,${(0.5 * (1 - s.shock)).toFixed(3)})`
        ctx.lineWidth = 10 * (1 - s.shock) + 2
        ctx.beginPath()
        ctx.arc(0, 0, rr, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }

      // anticipation light: forge-glow pools on the bed as the ram commits
      if (phase === 'striking') {
        const t2 = now - s.strikeT0
        const glow = t2 < STRIKE.dropEnd
          ? clamp01(t2 / STRIKE.dropEnd)
          : Math.max(0, 1 - (t2 - STRIKE.dropEnd) / 800)
        if (glow > 0) {
          const gg = ctx.createRadialGradient(0, FLAT_Y - 60, 10, 0, FLAT_Y - 60, 340)
          gg.addColorStop(0, `rgba(255,200,110,${(0.22 * glow).toFixed(3)})`)
          gg.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = gg
          ctx.fillRect(-380, FLAT_Y - 380, 760, 560)
        }
      }

      // contact flash: a pulse of forge-light over the work surface
      if (s.flash >= 0) {
        const fg = ctx.createRadialGradient(0, s.medalY - 120, 10, 0, s.medalY - 120, 520)
        fg.addColorStop(0, `rgba(255,232,170,${(0.55 * (1 - s.flash)).toFixed(3)})`)
        fg.addColorStop(0.5, `rgba(233,190,90,${(0.22 * (1 - s.flash)).toFixed(3)})`)
        fg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = fg
        ctx.fillRect(-512, -512, 1024, 1024)
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

      // the press frame: two steel columns and a crosshead beam
      ctx.save()
      const frame = ctx.createLinearGradient(-460, 0, 460, 0)
      frame.addColorStop(0, 'rgba(24,25,28,0.9)')
      frame.addColorStop(0.15, 'rgba(74,79,88,0.88)')
      frame.addColorStop(0.5, 'rgba(122,128,140,0.85)')
      frame.addColorStop(0.85, 'rgba(74,79,88,0.88)')
      frame.addColorStop(1, 'rgba(24,25,28,0.9)')
      ctx.fillStyle = frame
      ctx.fillRect(-462, -512, 58, 880) // left column
      ctx.fillRect(404, -512, 58, 880) // right column
      // a lighter edge on the column faces so the silhouette reads
      ctx.fillStyle = 'rgba(140,146,158,0.3)'
      ctx.fillRect(-404, -512, 6, 880)
      ctx.fillRect(398, -512, 6, 880)
      // column cap plates where they meet the bed
      ctx.fillStyle = 'rgba(14,15,17,0.9)'
      ctx.fillRect(-474, 328, 82, 40)
      ctx.fillRect(392, 328, 82, 40)
      // crosshead beam overhead — the ribbon later drapes over it
      ctx.fillStyle = frame
      ctx.fillRect(-474, -512, 948, 96)
      const beamLip = ctx.createLinearGradient(0, -512, 0, -416)
      beamLip.addColorStop(0, 'rgba(140,146,158,0.35)')
      beamLip.addColorStop(0.6, 'rgba(0,0,0,0)')
      beamLip.addColorStop(1, 'rgba(0,0,0,0.4)')
      ctx.fillStyle = beamLip
      ctx.fillRect(-474, -512, 948, 96)
      ctx.restore()

      // the anvil: a solid iron collar with a visible front edge, recoiling on impact
      const kick = s.bedKick * 14
      ctx.save()
      ctx.translate(0, MEDAL_Y + 352 + kick)
      // skirt — the anvil's front face, giving the bed thickness
      ctx.save()
      ctx.translate(0, 26)
      ctx.scale(1, 0.2)
      const sk = ctx.createLinearGradient(0, -200, 0, 460)
      sk.addColorStop(0, 'rgba(38,40,44,0.95)')
      sk.addColorStop(0.4, 'rgba(20,21,24,0.9)')
      sk.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = sk
      ctx.beginPath()
      ctx.arc(0, 0, 460, 0, Math.PI)
      ctx.fill()
      ctx.restore()
      ctx.scale(1, 0.2)
      // top face — cool iron, lighter where the light falls
      const bg = ctx.createRadialGradient(0, -60, 60, 0, -30, 480)
      bg.addColorStop(0, 'rgba(64,66,72,0.9)')
      bg.addColorStop(0.62, 'rgba(34,35,39,0.92)')
      bg.addColorStop(0.86, 'rgba(20,21,24,0.95)')
      bg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = bg
      ctx.beginPath()
      ctx.arc(0, 0, 470, 0, Math.PI * 2)
      ctx.fill()
      // machined rim catching the light along its upper edge
      const rim = ctx.createLinearGradient(0, -120, 0, 60)
      rim.addColorStop(0, 'rgba(190,200,214,0.55)')
      rim.addColorStop(0.45, 'rgba(110,116,128,0.3)')
      rim.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.strokeStyle = rim
      ctx.lineWidth = 30
      ctx.beginPath()
      ctx.arc(0, 6, 402, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      // medal shadow on baize
      ctx.save()
      ctx.translate(0, Math.min(470, s.medalY + 512 * s.medalScale * s.tilt + 10))
      ctx.scale(1, 0.14)
      const shg = ctx.createRadialGradient(0, 0, 0, 0, 0, 420)
      shg.addColorStop(0, 'rgba(0,0,0,0.5)')
      shg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = shg
      ctx.fillRect(-420, -420, 840, 840)
      ctx.restore()

      // ribbon drapes over the crosshead and twists with the medal
      if (phase === 'awarded' && s.awardedT0 > 0) {
        drawRibbon(ctx, (now - s.awardedT0) / 650, s.ribbonFlip, s.medalY - 512 * s.medalScale * s.tilt + 30)
      }

      ctx.save()
      ctx.translate(0, s.medalY)
      ctx.scale(scale * s.medalScale, scale * s.medalScale * s.tilt * s.squash)
      renderer.setAward(phase === 'idle' ? null : award)
      renderer.draw(ctx, {
        award: phase === 'idle' ? null : award,
        emboss: s.emboss,
        flip: s.flip,
        sheenX: s.sheenX,
        sheenY: s.sheenY,
      })
      ctx.restore()

      // anvil lip: the planchet sits INSIDE the die bed, not on top of it.
      // fades out as the medal tilts up — it may only ever hide metal behind the bed
      const lipA = clamp01((0.62 - s.tilt) / 0.22)
      if (lipA > 0) {
        ctx.save()
        ctx.globalAlpha = lipA
        ctx.translate(0, s.medalY + 95 + kick)
        ctx.scale(1, 0.16)
        const lip = ctx.createLinearGradient(0, -90, 0, 90)
        lip.addColorStop(0, 'rgba(10,11,13,0)')
        lip.addColorStop(0.35, 'rgba(10,11,13,0.9)')
        lip.addColorStop(0.62, 'rgba(60,64,70,0.75)')
        lip.addColorStop(0.78, 'rgba(30,32,36,0.9)')
        lip.addColorStop(1, 'rgba(10,11,13,0.4)')
        ctx.fillStyle = lip
        ctx.beginPath()
        ctx.arc(0, 0, 512 * s.medalScale * 0.94, 0.15, Math.PI - 0.15)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }

      // a light sweep rolls over the finished relief
      if (s.sweep >= 0) {
        ctx.save()
        ctx.translate(0, s.medalY)
        ctx.scale(1, s.tilt)
        const mr = 512 * s.medalScale
        ctx.beginPath()
        ctx.arc(0, 0, mr, 0, Math.PI * 2)
        ctx.clip()
        ctx.rotate(-0.35)
        const bx = (-1.3 + 2.6 * s.sweep) * mr
        const bnd = ctx.createLinearGradient(bx - mr * 0.3, 0, bx + mr * 0.3, 0)
        bnd.addColorStop(0, 'rgba(255,246,214,0)')
        bnd.addColorStop(0.5, `rgba(255,246,214,${(0.4 * (1 - s.sweep)).toFixed(3)})`)
        bnd.addColorStop(1, 'rgba(255,246,214,0)')
        ctx.fillStyle = bnd
        ctx.fillRect(bx - mr * 0.3, -mr, mr * 0.6, mr * 2)
        ctx.restore()
      }

      // the die head hangs below the crosshead — cool tool steel
      if (s.pressY > -1390) {
        const pw = 640, ph = 168
        ctx.save()
        ctx.translate(0, s.pressY - ph) // s.pressY is canvas coords
        const pg = ctx.createLinearGradient(-pw / 2, 0, pw / 2, 0)
        pg.addColorStop(0, '#1e2023')
        pg.addColorStop(0.2, '#4a4e55')
        pg.addColorStop(0.5, '#8b919c')
        pg.addColorStop(0.8, '#4a4e55')
        pg.addColorStop(1, '#141518')
        ctx.fillStyle = pg
        // shaft rising into the crosshead
        ctx.fillRect(-pw * 0.18, -800, pw * 0.36, 800)
        // die head with a slight bevel — wide enough to cover the blank's face
        ctx.beginPath()
        ctx.roundRect(-pw / 2, 0, pw, ph, 14)
        ctx.fill()
        // darker face-plate — the working surface that meets the planchet
        const fg2 = ctx.createLinearGradient(0, ph - 26, 0, ph)
        fg2.addColorStop(0, 'rgba(12,13,15,0.0)')
        fg2.addColorStop(1, 'rgba(12,13,15,0.85)')
        ctx.fillStyle = fg2
        ctx.beginPath()
        ctx.roundRect(-pw / 2, ph - 26, pw, 26, 10)
        ctx.fill()
        // the engraved boss on the die's face — the same mark it strikes
        ctx.save()
        ctx.translate(0, ph / 2)
        const boss = ctx.createRadialGradient(-14, -18, 6, 0, 0, 72)
        boss.addColorStop(0, '#5a5f68')
        boss.addColorStop(0.7, '#33363c')
        boss.addColorStop(1, '#1b1d20')
        ctx.fillStyle = boss
        ctx.beginPath()
        ctx.arc(0, 0, 68, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(10,11,13,0.85)'
        ctx.lineWidth = 5
        ctx.stroke()
        ctx.strokeStyle = 'rgba(190,196,206,0.3)'
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.arc(0, 0, 61, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = ctx.fillStyle = 'rgba(8,9,11,0.85)'
        emblem(ctx, 38, CATEGORIES[category].emblem)
        ctx.strokeStyle = ctx.fillStyle = 'rgba(200,206,216,0.28)'
        ctx.translate(0, -2)
        emblem(ctx, 38, CATEGORIES[category].emblem)
        ctx.restore()
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
  }, [phase, strikeKey, award, category, reducedMotion, onStrikeMoment, onFirstFlip, flipNudge])

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
        s.downX = e.clientX
        s.downT = e.timeStamp
        s.flipVel = 0
        s.flipAnim = null
        el.setPointerCapture(e.pointerId)
      }
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== s.dragPointer) return
      s.dragging = false
      s.dragPointer = -1
      // a tap with no drag turns the medal to its other face
      const moved = Math.abs(e.clientX - s.downX)
      if (moved < 6 && e.timeStamp - s.downT < 450 && phase === 'awarded') {
        const next = Math.floor(s.flip / Math.PI + 0.5) * Math.PI + Math.PI
        s.flipAnim = { from: s.flip, to: next, t0: performance.now() }
        s.flipVel = 0
        if (!flipFired.current) { flipFired.current = true; onFirstFlip?.() }
      }
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
