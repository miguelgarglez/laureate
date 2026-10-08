// Screenshot helper: node scripts/shots.mjs <url> <out-prefix> [actions]
// Actions is a JS snippet run with `page` in scope before the final shot.
import { chromium, webkit, firefox } from 'playwright'

const [url, prefix = 'shot', engine = 'chromium'] = process.argv.slice(2)
const b = { chromium, webkit, firefox }[engine]
const browser = await b.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(1600)
await page.screenshot({ path: `${prefix}-1440.png` })
await page.setViewportSize({ width: 375, height: 720 })
await page.waitForTimeout(800)
await page.screenshot({ path: `${prefix}-375.png` })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await browser.close()
console.log(`wrote ${prefix}-1440.png ${prefix}-375.png`, errors.length ? `errors: ${errors}` : '')
