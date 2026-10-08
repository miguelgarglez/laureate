// Regression checks for the codex review findings.
// node scripts/regress.mjs <url>
import { chromium } from 'playwright'

const [url] = process.argv.slice(2)
const browser = await chromium.launch()
const results = []
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`)

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

// 1. Infinity-date payload must not hang; bad hash → objection
await page.goto(`${url}#a=WyIiLCJ0ZXN0IiwicGVhY2UiLDEwMDAsIkluZmluaXR5LTAxLTAxIl0`, {
  waitUntil: 'networkidle',
})
await page.waitForTimeout(600)
check('infinity payload → objection', await page.locator('.objection').isVisible())

// 2. garbage hash → objection, then return to the mint
await page.goto(`${url}#a=garbage`)
await page.waitForTimeout(400)
check('garbage hash → objection', await page.locator('.objection').isVisible())
await page.click('.objection .slink')
await page.waitForTimeout(400)
check('return to mint shows docket', await page.locator('.docket').isVisible())

// 3. guide does not block the input
await page.evaluate(() => localStorage.removeItem('laureate.guide.v1'))
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await page.click('.ach-input')
await page.type('.ach-input', 'abc')
const achVal = await page.inputValue('.ach-input')
check('guide allows typing in input', achVal === 'abc', achVal)

// 4. mint → awarded; focus moved to diploma heading
await page.fill('.ach-input', 'testing $& sequences')
await page.click('.press')
await page.waitForTimeout(3200)
check('diploma visible', await page.locator('.diploma').isVisible())
const focused = await page.evaluate(() => document.activeElement?.className)
check('focus on diploma heading', String(focused).includes('dip-doc'), String(focused))
const cite = await page.locator('.dip-cite').textContent()
check('$& literal in citation', cite.includes('$&'), cite?.slice(0, 80))

// 5. permalink roundtrip on reload
const hash = await page.evaluate(() => location.hash)
await page.goto(url + hash, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
const cite2 = await page.locator('.dip-cite').textContent()
check('permalink restores award', cite2 === cite, cite2?.slice(0, 60))

// 6. hashchange while awarded → objection without reload
await page.evaluate(() => (location.hash = '#a=garbage'))
await page.waitForTimeout(500)
check('hashchange to garbage → objection', await page.locator('.objection').isVisible())

// 7. keyboard flip button reveals the back
await page.evaluate(() => (location.hash = ''))
await page.evaluate((h) => (location.hash = h), hash)
await page.waitForTimeout(900)
await page.click('.flip-btn')
await page.waitForTimeout(900)
const backVisible = await page.evaluate(() => {
  const c = document.querySelector('.medal-stage canvas')
  return c && c.width > 0 // just check the button ran without error; visual verified by shots
})
check('flip button present + runs', !!backVisible)

// 8. long-word card render doesn't crash / overflow logic runs
await page.goto(url, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('laureate.guide.v1', '1'))
await page.fill('.ach-input', 'a'.repeat(140))
await page.fill('.who-input', 'W'.repeat(40))
await page.click('.press')
await page.waitForTimeout(2600)
check('long input minted', await page.locator('.diploma').isVisible())

// 9. only-dots petition can't mint
await page.click('button:has-text("Mint another")')
await page.waitForTimeout(500)
await page.fill('.ach-input', '...')
const disabled = await page.locator('.press').isDisabled()
check('dots-only petition rejected', disabled)

console.log(results.join('\n'))
console.log(errors.length ? `PAGE ERRORS:\n${errors.join('\n')}` : 'no page errors')
await browser.close()
