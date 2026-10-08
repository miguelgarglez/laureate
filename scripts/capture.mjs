// Capture OG image + doc screenshots from the running preview.
// node scripts/capture.mjs <url>
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const [url] = process.argv.slice(2)
mkdirSync('docs', { recursive: true })
const browser = await chromium.launch()

// OG: the ?og canvas is exactly 1200×630
const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await og.goto(`${url}?og`, { waitUntil: 'networkidle' })
await og.waitForTimeout(1800)
await og.screenshot({ path: 'public/og.png' })
await og.close()
console.log('wrote public/og.png')

// hero docs shot: awarded state on desktop
const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 })
await p.goto(url, { waitUntil: 'networkidle' })
await p.evaluate(() => localStorage.setItem('laureate.guide.v1', '1'))
await p.reload({ waitUntil: 'networkidle' })
await p.fill('.ach-input', 'debugging production by closing the laptop')
await p.fill('.who-input', 'M. García')
await p.click('.press')
await p.waitForTimeout(4200)
await p.screenshot({ path: 'docs/hero.png' })

// strike mid-flight
await p.click('.slink-dim') // mint another
await p.waitForTimeout(600)
await p.fill('.ach-input', 'remembering the password on the first try')
await p.click('.press')
await p.waitForTimeout(650)
await p.screenshot({ path: 'docs/strike.png' })
await browser.close()
console.log('wrote docs/hero.png docs/strike.png')
