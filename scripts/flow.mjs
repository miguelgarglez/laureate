// Interaction test: full mint flow, screenshots + console errors.
// node scripts/flow.mjs <url> <outdir>
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const [url, outdir = '/tmp/laureate-flow'] = process.argv.slice(2)
mkdirSync(outdir, { recursive: true })
const errors = []
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)

// guide visible → skip
await page.screenshot({ path: `${outdir}/1-guide.png` })
await page.click('.guide-skip')
await page.waitForTimeout(400)

// fill the petition
await page.fill('.ach-input', 'debugging production by closing the laptop')
await page.fill('.who-input', 'M. García')
await page.screenshot({ path: `${outdir}/2-filled.png` })

// mint — catch the strike mid-flight
await page.click('.press')
await page.waitForTimeout(700)
await page.screenshot({ path: `${outdir}/3-strike.png` })
await page.waitForTimeout(1600)
await page.screenshot({ path: `${outdir}/4-awarded.png` })
await page.waitForTimeout(1200)
await page.screenshot({ path: `${outdir}/5-diploma.png` })

// drag the medal
const box = await page.locator('.medal-stage').boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.mouse.move(box.x + box.width / 2 + 220, box.y + box.height / 2, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(900)
await page.screenshot({ path: `${outdir}/6-flip.png` })

const hash = await page.evaluate(() => location.hash)

// permalink reload restores the award
await page.goto(url, { waitUntil: 'networkidle' })
await page.evaluate((h) => (location.hash = h), hash)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1400)
await page.screenshot({ path: `${outdir}/7-permalink.png` })

// bad hash
await page.goto(`${url}#a=garbage`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.screenshot({ path: `${outdir}/8-objection.png` })

// mobile awarded
await page.setViewportSize({ width: 375, height: 720 })
await page.evaluate((h) => (location.hash = h), hash)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1400)
await page.screenshot({ path: `${outdir}/9-mobile-awarded.png` })

// OG mode
await page.setViewportSize({ width: 1200, height: 630 })
await page.goto(`${url}?og`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1600)
await page.screenshot({ path: `${outdir}/10-og.png` })

await browser.close()
console.log('done.', errors.length ? `CONSOLE ERRORS:\n${errors.join('\n')}` : 'no console errors')
