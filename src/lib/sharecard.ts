// The share card: a 1200×630 rendered PNG composing the struck medal,
// parchment citation and serial. Reused for the OG image (via ?og mode).

import type { Award } from './award'
import { CATEGORIES, citation, ceremonyDate } from './award'
import { MedalRenderer } from './medal'

export const CARD_W = 1200
export const CARD_H = 630

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ')
  let line = ''
  let yy = y
  for (const w of words) {
    const try_ = line ? line + ' ' + w : w
    if (ctx.measureText(try_).width > maxW && line) {
      ctx.fillText(line, x, yy)
      yy += lh
      line = w
    } else {
      line = try_
    }
  }
  if (line) ctx.fillText(line, x, yy)
  return yy + lh
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

  ctx.font = 'italic 26px "EB Garamond", serif'
  ctx.fillStyle = '#241d12'
  const who = award.recipient || 'the bearer'
  const text = `Hereby conferred upon ${who} the ${new Date(award.dateISO).getFullYear()} Prize in ${CATEGORIES[award.category].label}, ${citation(award)}.`
  const end = wrap(ctx, text, x, 240, CARD_W - x - 90, 38)

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
