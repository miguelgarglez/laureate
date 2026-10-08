// Record a ~15s first-run session for the design reviewer.
// node scripts/record.mjs <url> <out.webm>
import { chromium } from 'playwright'

const [url, out] = process.argv.slice(2)
const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: '/tmp/laureate-video-src', size: { width: 1280, height: 800 } },
})
const page = await ctx.newPage()
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.click('.guide-skip')
await page.fill('.ach-input', 'debugging production by closing the laptop')
await page.waitForTimeout(400)
await page.fill('.who-input', 'M. García')
await page.click('.seal[title^="Literature"]')
await page.waitForTimeout(500)
await page.click('.press')
await page.waitForTimeout(4200)
const box = await page.locator('.medal-stage').boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.mouse.move(box.x + box.width / 2 - 260, box.y + box.height / 2, { steps: 14 })
await page.mouse.up()
await page.waitForTimeout(2500)
await ctx.close()
await browser.close()
console.log('video dir: /tmp/laureate-video-src', out || '')
