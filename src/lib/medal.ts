// Procedural medal rendering. Two offscreen faces (front = committee relief,
// back = recipient engraving), composited by drawMedal with emboss reveal,
// flip-spin and lamplight sheen. Pure canvas — no images, no assets.

import { CATEGORIES, citation, awardYear, roman } from './award'
import type { Award } from './award'

const GOLD_HI = '#eccf7d'
const GOLD = '#c9a227'
const GOLD_MID = '#a8851f'
const GOLD_LO = '#6e5510'
const GOLD_DEEP = '#4a3809'

export interface MedalSpec {
  award: Award | null // null = unstruck blank
  emboss: number // 0..1 relief reveal
  flip: number // radians about the vertical axis; 0 = front
  sheenX: number // -1..1, pointer-driven
  sheenY: number
}

function arc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
}

// ---------- relief pieces ----------

function rimLegend(ctx: CanvasRenderingContext2D, r: number, text: string) {
  // text on a circular path, top half
  const n = text.length
  const radius = r * 0.78
  const spread = Math.PI * 1.5
  const start = -Math.PI / 2 - spread / 2
  for (let i = 0; i < n; i++) {
    const a = start + (i / (n - 1)) * spread
    ctx.save()
    ctx.translate(Math.cos(a) * radius, Math.sin(a) * radius)
    ctx.rotate(a + Math.PI / 2)
    ctx.fillText(text[i], 0, 0)
    ctx.restore()
  }
}

function laurel(ctx: CanvasRenderingContext2D, r: number) {
  // two symmetric branches hugging the lower rim: a stem arc, then
  // paired pointed leaves that tilt along the branch tangent
  const rr = r * 0.62
  for (const side of [-1, 1]) {
    ctx.lineWidth = r * 0.012
    ctx.beginPath()
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      const a = Math.PI * (0.16 + 0.52 * t)
      const x = side * Math.sin(a) * rr
      const y = Math.cos(a) * rr
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    for (let i = 0; i < 9; i++) {
      const t = i / 8
      const a = Math.PI * (0.19 + 0.46 * t)
      const x = side * Math.sin(a) * rr
      const y = Math.cos(a) * rr
      const theta = Math.atan2(-Math.sin(a), side * Math.cos(a))
      const leafLen = r * (0.15 - t * 0.03)
      const leafW = r * 0.028
      for (const tilt of [-0.55, 0.55]) {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(theta + tilt)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.quadraticCurveTo(leafLen * 0.55, -leafW, leafLen, 0)
        ctx.quadraticCurveTo(leafLen * 0.55, leafW, 0, 0)
        ctx.fill()
        ctx.restore()
      }
    }
    // berry cluster at the base
    arc(ctx, side * Math.sin(Math.PI * 0.15) * rr, Math.cos(Math.PI * 0.15) * rr, r * 0.02)
    ctx.fill()
  }
}

export function emblem(ctx: CanvasRenderingContext2D, r: number, kind: string) {
  const s = r * 0.46
  ctx.lineWidth = r * 0.032
  ctx.lineCap = 'round'
  ctx.save()
  ctx.translate(0, -r * 0.04)
  switch (kind) {
    case 'atom': {
      for (const rot of [0, Math.PI / 3, -Math.PI / 3]) {
        ctx.save()
        ctx.rotate(rot)
        ctx.beginPath()
        ctx.ellipse(0, 0, s, s * 0.38, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
      arc(ctx, 0, 0, r * 0.07)
      ctx.fill()
      break
    }
    case 'flask': {
      // conical flask
      ctx.beginPath()
      ctx.moveTo(-s * 0.14, -s * 0.62)
      ctx.lineTo(-s * 0.14, -s * 0.1)
      ctx.lineTo(-s * 0.52, s * 0.5)
      ctx.quadraticCurveTo(-s * 0.58, s * 0.62, -s * 0.44, s * 0.62)
      ctx.lineTo(s * 0.44, s * 0.62)
      ctx.quadraticCurveTo(s * 0.58, s * 0.62, s * 0.52, s * 0.5)
      ctx.lineTo(s * 0.14, -s * 0.1)
      ctx.lineTo(s * 0.14, -s * 0.62)
      ctx.closePath()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-s * 0.34, s * 0.18)
      ctx.lineTo(s * 0.34, s * 0.18)
      ctx.stroke()
      for (const [bx, by, br] of [[-0.1, 0.36, 0.05], [0.08, 0.44, 0.04], [0, 0.3, 0.033]]) {
        arc(ctx, bx * s, by * s, br * s)
        ctx.fill()
      }
      break
    }
    case 'staff': {
      // rod of asclepius, simplified: staff + sine serpent
      ctx.beginPath()
      ctx.moveTo(0, -s * 0.6)
      ctx.lineTo(0, s * 0.6)
      ctx.stroke()
      arc(ctx, 0, -s * 0.66, s * 0.07)
      ctx.fill()
      ctx.beginPath()
      for (let i = 0; i <= 40; i++) {
        const t = i / 40
        const y = -s * 0.5 + t * s * 1.1
        const x = Math.sin(t * Math.PI * 3) * s * 0.2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      break
    }
    case 'book': {
      // open book: two page wedges
      ctx.beginPath()
      ctx.moveTo(0, -s * 0.34)
      ctx.quadraticCurveTo(-s * 0.4, -s * 0.56, -s * 0.62, -s * 0.28)
      ctx.lineTo(-s * 0.62, s * 0.3)
      ctx.quadraticCurveTo(-s * 0.4, s * 0.06, 0, s * 0.26)
      ctx.closePath()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, -s * 0.34)
      ctx.quadraticCurveTo(s * 0.4, -s * 0.56, s * 0.62, -s * 0.28)
      ctx.lineTo(s * 0.62, s * 0.3)
      ctx.quadraticCurveTo(s * 0.4, s * 0.06, 0, s * 0.26)
      ctx.closePath()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, -s * 0.34)
      ctx.lineTo(0, s * 0.26)
      ctx.stroke()
      for (const dy of [-0.32, -0.16, 0]) {
        ctx.beginPath()
        ctx.moveTo(-s * 0.5, dy * s + s * 0.02)
        ctx.quadraticCurveTo(-s * 0.3, dy * s - s * 0.06, -s * 0.1, dy * s)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(s * 0.1, dy * s)
        ctx.quadraticCurveTo(s * 0.3, dy * s - s * 0.06, s * 0.5, dy * s + s * 0.02)
        ctx.stroke()
      }
      break
    }
    case 'olive': {
      ctx.beginPath()
      ctx.moveTo(-s * 0.35, s * 0.55)
      ctx.quadraticCurveTo(-s * 0.1, -s * 0.1, s * 0.25, -s * 0.55)
      ctx.stroke()
      for (const t of [0.15, 0.4, 0.65, 0.9]) {
        const x = -s * 0.35 + (s * 0.6) * t + Math.sin(t * 3) * s * 0.06
        const y = s * 0.55 - s * 1.1 * t
        for (const side of [-1, 1]) {
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(side * 0.7 + t)
          ctx.beginPath()
          ctx.ellipse(side * s * 0.09, 0, s * 0.13, s * 0.045, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }
      arc(ctx, s * 0.02, s * 0.12, s * 0.09)
      ctx.fill()
      arc(ctx, s * 0.2, -s * 0.06, s * 0.07)
      ctx.fill()
      break
    }
    case 'coins': {
      for (let i = 0; i < 3; i++) {
        const y = s * 0.4 - i * s * 0.3
        ctx.beginPath()
        ctx.ellipse(0, y, s * 0.5, s * 0.17, 0, 0, Math.PI * 2)
        ctx.stroke()
        if (i === 2) {
          ctx.beginPath()
          ctx.ellipse(0, y, s * 0.36, s * 0.11, 0, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      break
    }
  }
  ctx.restore()
}

// ---------- face rendering ----------

function drawRelief(
  ctx: CanvasRenderingContext2D,
  r: number,
  draw: (c: CanvasRenderingContext2D) => void,
) {
  // struck relief = dark body + bright edge toward the light
  ctx.save()
  ctx.translate(r * 0.006, r * 0.006)
  ctx.fillStyle = ctx.strokeStyle = GOLD_HI
  draw(ctx)
  ctx.restore()
  ctx.save()
  ctx.translate(-r * 0.004, -r * 0.004)
  ctx.fillStyle = ctx.strokeStyle = GOLD_DEEP
  draw(ctx)
  ctx.restore()
  ctx.fillStyle = ctx.strokeStyle = GOLD_MID
  draw(ctx)
}

function renderFront(award: Award, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const r = size / 2
  ctx.translate(r, r)

  // medal body
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r)
  g.addColorStop(0, '#f2dd9a')
  g.addColorStop(0.55, GOLD)
  g.addColorStop(0.9, GOLD_MID)
  g.addColorStop(1, GOLD_LO)
  ctx.fillStyle = g
  arc(ctx, 0, 0, r)
  ctx.fill()

  // beaded rim
  ctx.strokeStyle = GOLD_LO
  ctx.lineWidth = size * 0.008
  arc(ctx, 0, 0, r * 0.94)
  ctx.stroke()
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2
    arc(ctx, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, size * 0.006)
    ctx.fillStyle = GOLD_LO
    ctx.fill()
  }
  arc(ctx, 0, 0, r * 0.86)
  ctx.stroke()

  const { emblem: emb } = CATEGORIES[award.category]
  ctx.font = `${size * 0.058}px "IM Fell English SC", serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  drawRelief(ctx, r, (c2) => {
    rimLegend(c2, r, 'THE COMMITTEE FOR EXTREMELY SPECIFIC ACHIEVEMENT')
    laurel(c2, r)
    emblem(c2, r, emb)
  })

  // bottom legend
  ctx.font = `${size * 0.05}px "IM Fell English SC", serif`
  ctx.fillStyle = GOLD_DEEP
  ctx.fillText(`· ${roman(awardYear(award.dateISO))} ·`, 0, r * 0.78)

  return c
}

function renderBack(award: Award, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const r = size / 2
  ctx.translate(r, r)

  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r)
  g.addColorStop(0, '#e8d28a')
  g.addColorStop(0.6, '#b58f22')
  g.addColorStop(1, GOLD_LO)
  ctx.fillStyle = g
  arc(ctx, 0, 0, r)
  ctx.fill()
  ctx.strokeStyle = GOLD_LO
  ctx.lineWidth = size * 0.008
  arc(ctx, 0, 0, r * 0.94)
  ctx.stroke()
  arc(ctx, 0, 0, r * 0.86)
  ctx.stroke()

  ctx.fillStyle = GOLD_DEEP
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${size * 0.06}px "IM Fell English SC", serif`
  ctx.fillText('AWARDED TO', 0, -r * 0.34)
  ctx.font = `italic ${size * 0.085}px "EB Garamond", serif`
  const who = award.recipient || 'the bearer'
  const whoFit = Math.min(1, (r * 0.78) / ctx.measureText(who).width)
  ctx.font = `italic ${size * 0.085 * whoFit}px "EB Garamond", serif`
  ctx.fillText(who.length > 34 ? who.slice(0, 34) + '…' : who, 0, -r * 0.14)
  ctx.strokeStyle = GOLD_DEEP
  ctx.lineWidth = size * 0.004
  ctx.beginPath()
  ctx.moveTo(-r * 0.4, r * 0.04)
  ctx.lineTo(r * 0.4, r * 0.04)
  ctx.stroke()
  ctx.font = `${size * 0.052}px "IM Fell English SC", serif`
  const year = award.dateISO.slice(0, 4)
  ctx.fillText(`No. ${award.serial} · ${year}`, 0, r * 0.22)
  ctx.fillStyle = GOLD_DEEP
  laurel(ctx, r * 0.9)
  return c
}

// ---------- composite ----------

export class MedalRenderer {
  private front: HTMLCanvasElement | null = null
  private back: HTMLCanvasElement | null = null
  private key = ''
  private size: number

  constructor(size: number) {
    this.size = size
  }

  setAward(award: Award | null) {
    const k = award ? JSON.stringify(award) + document.fonts.status : 'blank'
    if (k !== this.key) {
      this.key = k
      this.front = award ? renderFront(award, this.size) : null
      this.back = award ? renderBack(award, this.size) : null
    }
  }

  refreshFonts() {
    this.key = ''
  }

  // Draws the medal centered at the current origin (caller positions).
  draw(ctx: CanvasRenderingContext2D, spec: Omit<MedalSpec, 'flip'> & { flip: number }) {
    const size = this.size
    const r = size / 2
    ctx.save()

    const cosF = Math.cos(spec.flip)
    const facing = Math.abs(cosF)
    const showBack = cosF < 0
    const face = showBack ? this.back : this.front

    if (facing < 0.06) {
      // edge-on: a dark ridged sliver
      const w = Math.max(r * 0.05, r * facing * 2)
      const eg = ctx.createLinearGradient(-w, 0, w, 0)
      eg.addColorStop(0, GOLD_DEEP)
      eg.addColorStop(0.5, GOLD_HI)
      eg.addColorStop(1, GOLD_DEEP)
      ctx.fillStyle = eg
      ctx.beginPath()
      ctx.ellipse(0, 0, w, r, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      return
    }

    // edge thickness: a dark elliptical rim band just wider than the face
    const edgeT = r * 0.055 + r * facing * 0.01
    const eg2 = ctx.createLinearGradient(-(r * facing + edgeT), 0, r * facing + edgeT, 0)
    eg2.addColorStop(0, '#4d3a0c')
    eg2.addColorStop(0.5, '#8a6d1e')
    eg2.addColorStop(1, '#4d3a0c')
    ctx.fillStyle = eg2
    ctx.beginPath()
    ctx.ellipse(0, 0, r * facing + edgeT, r, 0, 0, Math.PI * 2)
    ctx.fill()
    // faint ridges on the milled edge
    ctx.save()
    ctx.strokeStyle = 'rgba(30,22,5,0.35)'
    ctx.lineWidth = size * 0.004
    ctx.beginPath()
    ctx.ellipse(0, 0, r * facing + edgeT * 0.72, r * 0.99, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    ctx.scale(facing, 1)

    if (!face || spec.emboss < 1) {
      // base disc — a machined blank: flatter highlight, faint turning grooves
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r)
      g.addColorStop(0, '#e6cd83')
      g.addColorStop(0.55, GOLD)
      g.addColorStop(0.9, GOLD_MID)
      g.addColorStop(1, GOLD_LO)
      ctx.fillStyle = g
      arc(ctx, 0, 0, r)
      ctx.fill()
      ctx.strokeStyle = GOLD_LO
      ctx.lineWidth = size * 0.008
      arc(ctx, 0, 0, r * 0.94)
      ctx.stroke()
      if (!face) {
        ctx.strokeStyle = 'rgba(110, 85, 16, 0.22)'
        ctx.lineWidth = size * 0.003
        for (const rr of [0.5, 0.62, 0.74]) {
          arc(ctx, 0, 0, r * rr)
          ctx.stroke()
        }
      }
    }

    if (face) {
      if (spec.emboss >= 1) {
        ctx.drawImage(face, -r, -r, size, size)
      } else if (spec.emboss > 0) {
        // reveal relief inside the emboss wavefront
        ctx.save()
        ctx.beginPath()
        arc(ctx, 0, 0, r * spec.emboss)
        ctx.clip()
        ctx.drawImage(face, -r, -r, size, size)
        ctx.restore()
        // wavefront ring: bright stamp line + a pressure shadow just inside
        const wf = r * spec.emboss
        const wg = ctx.createRadialGradient(0, 0, Math.max(0.01, wf - r * 0.05), 0, 0, wf + r * 0.02)
        wg.addColorStop(0, 'rgba(74,56,9,0)')
        wg.addColorStop(0.55, 'rgba(74,56,9,0.35)')
        wg.addColorStop(0.8, 'rgba(236,207,125,0.9)')
        wg.addColorStop(1, 'rgba(236,207,125,0)')
        ctx.fillStyle = wg
        ctx.beginPath()
        ctx.arc(0, 0, wf + r * 0.02, 0, Math.PI * 2)
        ctx.arc(0, 0, Math.max(0.01, wf - r * 0.05), 0, Math.PI * 2)
        ctx.fill('evenodd')
      }
    }

    // sheen: directional light band driven by pointer / flip
    const sx = spec.sheenX * r * 0.9 - Math.sin(spec.flip) * r * 0.3
    const sy = spec.sheenY * r * 0.9
    const sg = ctx.createLinearGradient(sx - r, sy - r, sx + r, sy + r)
    sg.addColorStop(0, 'rgba(255,246,214,0)')
    sg.addColorStop(0.42, 'rgba(255,246,214,0.0)')
    sg.addColorStop(0.5, 'rgba(255,246,214,0.38)')
    sg.addColorStop(0.58, 'rgba(255,246,214,0.0)')
    sg.addColorStop(1, 'rgba(255,246,214,0)')
    ctx.save()
    ctx.beginPath()
    arc(ctx, 0, 0, r)
    ctx.clip()
    ctx.fillStyle = sg
    ctx.fillRect(-r, -r, size, size)
    // gentle vignette keeps the rim dark
    const vg = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(30,20,4,0.32)')
    ctx.fillStyle = vg
    ctx.fillRect(-r, -r, size, size)
    ctx.restore()

    ctx.restore()
  }
}

export function medalShareText(award: Award): string {
  const c = citation(award)
  const who = award.recipient || 'the bearer'
  return `The Committee for Extremely Specific Achievement has conferred upon ${who} the ${awardYear(award.dateISO)} Prize in ${CATEGORIES[award.category].label}, ${c}. Medal No. ${award.serial}.`
}
