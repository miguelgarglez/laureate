// Viewport overflow check — the idle page must fit without scrolling.
// node scripts/viewport-check.mjs <url>
import { chromium } from 'playwright'

const [url] = process.argv.slice(2)
const SIZES = [
  [1024, 600], [1280, 720], [1366, 768], [1440, 900], [1920, 1080],
  [390, 844], [375, 667],
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
  const over = size.sw > size.cw + 1 || size.sh > size.ch + 1
  if (over) {
    fail++
    console.log(`OVERFLOW ${w}x${h} page ${size.sw}x${size.sh}`)
  } else {
    console.log(`ok ${w}x${h} page ${size.sw}x${size.sh}`)
  }
  await page.close()
}
await browser.close()
process.exit(fail ? 1 : 0)
