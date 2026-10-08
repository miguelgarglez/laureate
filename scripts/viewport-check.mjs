// Viewport check — the idle page must never overflow horizontally, and must
// fit vertically where height permits; very short mobile pages may scroll
// (the ceremony scrolls the press into view on mint).
// node scripts/viewport-check.mjs <url>
import { chromium } from 'playwright'

const [url] = process.argv.slice(2)
const SIZES = [
  [1024, 600], [1280, 720], [1366, 768], [1440, 900], [1920, 1080],
  [390, 844], [375, 667], [320, 568],
]
const browser = await chromium.launch()
let fail = 0
for (const [w, h] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const size = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    sh: document.documentElement.scrollHeight,
    cw: document.documentElement.clientWidth,
    ch: document.documentElement.clientHeight,
  }))
  const overX = size.sw > size.cw + 1
  const overY = size.sh > size.ch + 1
  // short mobile is allowed vertical scroll; everything else must fit
  const scrollable = w <= 400 && h <= 700
  if (overX || (overY && !scrollable)) {
    fail++
    console.log(`OVERFLOW ${w}x${h} page ${size.sw}x${size.sh}`)
  } else {
    console.log(`ok ${w}x${h} page ${size.sw}x${size.sh}${overY ? ' (scrolls)' : ''}`)
  }
  await page.close()
}
await browser.close()
process.exit(fail ? 1 : 0)
