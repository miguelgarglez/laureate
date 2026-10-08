// The share card: a 1200×630 rendered PNG composing the struck medal,
// parchment citation and serial. Reused for the OG image (via ?og mode).

import type { Award } from './award'
import { CATEGORIES, citation, ceremonyDate, awardYear } from './award'
import { MedalRenderer } from './medal'

export const CARD_W = 1200
export const CARD_H = 630

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lh: number,
  maxY = Infinity,
): number {
  // split words; a single word wider than maxW is broken by character
  const words = text.split(' ')
  const pieces: string[] = []
  for (const w of words) {
    if (ctx.measureText(w).width <= maxW) {
      pieces.push(w)
      continue
    }
    let cur = ''
    for (const ch of w) {
      if (ctx.measureText(cur + ch).width > maxW && cur) {
        pieces.push(cur)
        cur = ch
      } else cur += ch
    }
    if (cur) pieces.push(cur)
  }
  let line = ''
  let yy = y
  const flush = () => {
    ctx.fillText(line, x, yy)
    yy += lh
    line = ''
  }
  for (const p of pieces) {
    const try_ = line ? line + ' ' + p : p
    if (ctx.measureText(try_).width > maxW && line) {
      flush()
      if (yy > maxY) return yy
      line = p
    } else {
      line = try_
    }
  }
  if (line) flush()
  return yy
}

export function renderCard(award: Award): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = CARD_W
  c.height = CARD_H
  const ctx = c.getContext('2d')!

  // baize ground + parchment sheet
  ctx.fillStyle = '#0b120e'
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  const pg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H)
  pg.addColorStop(0, '#f4ecd6')
  pg.addColorStop(1, '#e6d9b8')
  ctx.fillStyle = pg
  ctx.fillRect(40, 40, CARD_W - 80, CARD_H - 80)
  ctx.strokeStyle = '#8e2b2b'
  ctx.lineWidth = 2
  ctx.strokeRect(56, 56, CARD_W - 112, CARD_H - 112)

  // medal left
  const mr = new MedalRenderer(560)
  mr.setAward(award)
  ctx.save()
  ctx.translate(300, 315)
  ctx.scale(0.78, 0.78)
  mr.draw(ctx, { award, emboss: 1, flip: 0, sheenX: -0.3, sheenY: -0.5 })
  ctx.restore()

  // text right
  const x = 560
  ctx.fillStyle = '#191510'
  ctx.textAlign = 'left'
  ctx.font = '34px "IM Fell English SC", serif'
  ctx.fillText('Laureate', x, 130)
  ctx.font = 'italic 19px "IM Fell English", serif'
  ctx.fillStyle = '#5a4a2e'
  ctx.fillText('The Committee for Extremely Specific Achievement', x, 162)

  ctx.strokeStyle = '#191510'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, 190)
  ctx.lineTo(CARD_W - 90, 190)
  ctx.stroke()

  ctx.fillStyle = '#241d12'
  const who = award.recipient || 'the bearer'
  const text = `Hereby conferred upon ${who} the ${awardYear(award.dateISO)} Prize in ${CATEGORIES[award.category].label}, ${citation(award)}.`
  // shrink the citation until it fits the reserved column height
  const citeMaxW = CARD_W - x - 90
  const citeBottom = 440
  // measure lines per candidate size, then draw once at the size that fits
  let size = 26
  for (; size >= 16; size -= 2) {
    ctx.font = `italic ${size}px "EB Garamond", serif`
    let lines = 0
    let line = ''
    const words = text.split(' ')
    const measure = (t: string) => ctx.measureText(t).width
    const pieces: string[] = []
    for (const w of words) {
      if (measure(w) <= citeMaxW) pieces.push(w)
      else {
        let cur = ''
        for (const ch of w) {
          if (measure(cur + ch) > citeMaxW && cur) { pieces.push(cur); cur = ch }
          else cur += ch
        }
        if (cur) pieces.push(cur)
      }
    }
    for (const p of pieces) {
      const t = line ? line + ' ' + p : p
      if (measure(t) > citeMaxW && line) { lines++; line = p } else line = t
    }
    if (line) lines++
    if (240 + lines * (size + 12) <= citeBottom) break
  }
  size = Math.max(size, 16)
  ctx.font = `italic ${size}px "EB Garamond", serif`
  const lh = size + 12
  const end = wrap(ctx, text, x, 240, citeMaxW, lh, citeBottom + lh)

  ctx.font = '17px "IM Fell English SC", serif'
  ctx.fillStyle = '#5a4a2e'
  ctx.fillText(
    `Medal No. ${award.serial} · Given under seal, ${ceremonyDate(award.dateISO)}`,
    x,
    Math.max(end + 30, 470),
    CARD_W - x - 220,
  )

  // wax seal
  ctx.save()
  ctx.translate(CARD_W - 150, 505)
  const wg = ctx.createRadialGradient(-6, -8, 4, 0, 0, 42)
  wg.addColorStop(0, '#b04545')
  wg.addColorStop(0.6, '#8e2b2b')
  wg.addColorStop(1, '#5e1a1c')
  ctx.fillStyle = wg
  ctx.beginPath()
  ctx.arc(0, 0, 42, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#5e1a1c'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, 30, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#e8c9b0'
  ctx.font = '20px "IM Fell English SC", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('LC', 0, 1)
  ctx.restore()

  return c
}

export async function downloadCard(award: Award) {
  const blob = await new Promise<Blob | null>((res) => renderCard(award).toBlob(res, 'image/png'))
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `laureate-medal-${award.serial}.png`
  a.click()
  URL.revokeObjectURL(url)
}
