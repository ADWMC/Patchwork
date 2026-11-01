import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { chromium } from 'playwright-core'
const [html, output] = process.argv.slice(2)
if (!html || !output) throw new Error('usage: node validate-home-control.mjs <html> <output-dir>')
await mkdir(output, { recursive: true })

const report = { errors: [], externalRequests: [], checks: {} }
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ids = ['livingLight', 'studyLight', 'fan', 'purifier']
const sw = (page, id) => page.locator(`#switch-${id}`)
const state = async page => ({
  count: await page.locator('#active-count').textContent(),
  switches: Object.fromEntries(await Promise.all(ids.map(async id => [id, await sw(page, id).getAttribute('aria-checked')]))),
  living: await page.locator('#brightness-livingLight').inputValue(),
  study: await page.locator('#brightness-studyLight').inputValue(),
  speed: await page.locator('input[name="fan-speed"]:checked').inputValue(),
})

async function open(viewport, mobile = false) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.setDefaultTimeout(6000)
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()) })
  page.on('request', request => { if (/^https?:/i.test(request.url())) report.externalRequests.push(request.url()) })
  await page.goto(pathToFileURL(html).href)
  return { page, context }
}

try {
  const { page, context } = await open({ width: 1440, height: 900 })
  assert.equal(await page.locator('article.card').count(), 4)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  assert.equal((await state(page)).count, '2')
  await page.screenshot({ path: join(output, 'desktop.png') })
  report.checks.desktop = true

  const brightness = page.locator('#brightness-livingLight')
  await brightness.focus()
  await brightness.press('End')
  assert.equal(await brightness.inputValue(), '100')
  await sw(page, 'livingLight').click()
  assert.equal(await brightness.isDisabled(), true)
  await sw(page, 'livingLight').click()
  assert.equal(await brightness.inputValue(), '100')
  report.checks.brightnessRetention = true

  await sw(page, 'studyLight').click()
  await sw(page, 'fan').click()
  await page.locator('label.speed').nth(2).click()
  await sw(page, 'fan').click()
  assert.equal(await page.locator('#speed-high').isDisabled(), true)
  await sw(page, 'fan').click()
  assert.equal(await page.locator('#speed-high').isChecked(), true)
  report.checks.fanRetention = true

  const beforeAway = await state(page)
  await page.locator('#away-switch').click()
  assert.equal((await state(page)).count, '0')
  for (const id of ids) assert.equal(await sw(page, id).isDisabled(), true)
  assert.equal(await page.locator('#all-off').isDisabled(), true)
  assert.equal(await page.locator('#restore-defaults').isDisabled(), true)
  await page.screenshot({ path: join(output, 'away.png') })
  await page.reload()
  assert.equal(await page.locator('#away-switch').getAttribute('aria-checked'), 'true')
  await page.locator('#away-switch').click()
  assert.deepEqual(await state(page), beforeAway)
  report.checks.awayRestoreAfterRefresh = true

  await page.locator('#all-off').click()
  assert.equal((await state(page)).count, '0')
  await page.reload()
  assert.equal((await state(page)).count, '0')
  await page.locator('#restore-defaults').click()
  assert.equal((await state(page)).count, '2')
  report.checks.allOffAndReset = true

  for (let i = 0; i < 20 && !(await sw(page, 'purifier').evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab')
  assert.equal(await sw(page, 'purifier').evaluate(el => el === document.activeElement), true)
  const focus = await sw(page, 'purifier').evaluate(el => ({ outline: getComputedStyle(el).outlineStyle, shadow: getComputedStyle(el).boxShadow }))
  assert.ok(focus.outline !== 'none' || focus.shadow !== 'none')
  await page.keyboard.press('Space')
  assert.equal(await sw(page, 'purifier').getAttribute('aria-checked'), 'false')
  report.checks.keyboard = true
  await context.close()

  const mobile = await open({ width: 390, height: 844 }, true)
  assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  for (const id of ids) assert.equal(await sw(mobile.page, id).isVisible(), true)
  await mobile.page.screenshot({ path: join(output, 'mobile.png') })
  await mobile.page.screenshot({ path: join(output, 'mobile-full.png'), fullPage: true })
  await sw(mobile.page, 'livingLight').click()
  assert.equal(await sw(mobile.page, 'livingLight').getAttribute('aria-checked'), 'false')
  report.checks.mobile = true
  await mobile.context.close()

  assert.deepEqual(report.errors, [])
  assert.deepEqual(report.externalRequests, [])
  report.checks.offline = true
} finally {
  await browser.close()
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2))
}

console.log(JSON.stringify(report))
