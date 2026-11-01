import { createHash, randomUUID } from 'node:crypto'

export const digest = value => createHash('sha256').update(value).digest('hex')

export function imageSize(data) {
  if (data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
  if (data[0] === 0xff && data[1] === 0xd8) {
    let at = 2
    while (at + 4 <= data.length) {
      if (data[at++] !== 0xff) break
      let marker = data[at++]
      while (marker === 0xff) marker = data[at++]
      if ([0xd8, 0xd9, 0x01].includes(marker) || marker >= 0xd0 && marker <= 0xd7) continue
      const length = data.readUInt16BE(at)
      if (length < 2 || at + length > data.length) break
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) return { width: data.readUInt16BE(at + 5), height: data.readUInt16BE(at + 3) }
      at += length
    }
  }
  throw new Error('Browser returned an invalid screenshot')
}

export async function capture(session, options = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    session.check()
    const page = session.page()
    if (!page) return null
    const epoch = session.epoch; const tabId = session.selectedTabId
    const viewport = page.viewportSize()
    const type = options.type ?? 'jpeg'
    const image = await page.screenshot({ type, ...(type === 'jpeg' ? { quality: 76 } : {}), ...options, fullPage: false, scale: 'css', timeout: 10_000 })
    session.check()
    if (epoch !== session.epoch || page !== session.page() || JSON.stringify(viewport) !== JSON.stringify(page.viewportSize())) continue
    const encoded = imageSize(image)
    if (encoded.width !== viewport.width || encoded.height !== viewport.height) throw new Error('Screenshot dimensions disagree with the active viewport; image was not delivered')
    return { image, tabId, epoch, viewport, capture: { id: randomUUID(), tabId, epoch, width: encoded.width, height: encoded.height, sha256: digest(image), capturedAt: new Date().toISOString() } }
  }
  throw new Error('Page changed during screenshot capture; retry with the current tab')
}

export async function observation(page) {
  if (!page) return ''
  const body = await page.locator('body').ariaSnapshot({ timeout: 3000 }).catch(() => '')
  return digest(JSON.stringify([page.url(), page.viewportSize(), body]))
}

export function validateExpectation(expected) {
  if (!expected || typeof expected !== 'object' || Array.isArray(expected) || Object.keys(expected).some(key => !['selector', 'text', 'visible', 'urlIncludes'].includes(key))) throw new Error('Invalid action expectation')
  for (const [field, limit] of [['selector', 1000], ['text', 2000], ['urlIncludes', 1000]]) if (expected[field] !== undefined && (typeof expected[field] !== 'string' || expected[field].length > limit)) throw new Error('Invalid action expectation value')
  if (expected.visible !== undefined && typeof expected.visible !== 'boolean') throw new Error('Expected visibility must be boolean')
  if ((expected.text !== undefined || expected.visible !== undefined) && !expected.selector) throw new Error('Text and visibility expectations require a selector')
  if (expected.text === undefined && expected.visible === undefined && expected.urlIncludes === undefined) throw new Error('An expectation needs at least one measurable condition')
}

export async function postcondition(page, expected) {
  if (!expected) return { status: 'unasserted' }
  validateExpectation(expected)
  if (!page) return { status: 'mismatch', compared: 0 }
  let compared = 0, matched = true
  if (expected.urlIncludes !== undefined) {
    if (typeof expected.urlIncludes !== 'string' || expected.urlIncludes.length > 1000) throw new Error('Invalid expected URL')
    compared++; matched &&= page.url().includes(expected.urlIncludes)
  }
  if (expected.selector !== undefined) {
    if (typeof expected.selector !== 'string' || expected.selector.length > 1000 || !expected.selector) throw new Error('Invalid expected selector')
    const locator = page.locator(expected.selector)
    if (expected.visible !== undefined) {
      if (typeof expected.visible !== 'boolean') throw new Error('Expected visibility must be boolean')
      compared++; matched = await locator.isVisible({ timeout: 3000 }) === expected.visible && matched
    }
    if (expected.text !== undefined) {
      if (typeof expected.text !== 'string' || expected.text.length > 2000) throw new Error('Invalid expected text')
      compared++; matched = (await locator.textContent({ timeout: 3000 }) ?? '').includes(expected.text) && matched
    }
  } else if (expected.text !== undefined || expected.visible !== undefined) throw new Error('Text and visibility expectations require a selector')
  if (!compared) throw new Error('An expectation needs at least one measurable condition')
  return { status: matched ? 'matched' : 'mismatch', compared }
}

export class BrowserTrace {
  constructor() { this.items = []; this.last = null; this.repeated = 0 }
  record({ action, actor, tabId, epoch, before, after, outcome, durationMs, signature }) {
    const repeated = signature && (outcome === 'error' || before === after)
    this.repeated = repeated && this.last === signature ? this.repeated + 1 : repeated ? 1 : 0
    this.last = signature
    const item = { id: randomUUID(), at: new Date().toISOString(), action, actor, tabId, epoch, outcome, durationMs: Math.round(durationMs), changed: before !== after, noProgress: this.repeated >= 3 }
    // Deliberately no URL, selector, entered text, page content, headers or errors.
    this.items.push(item)
    this.items = this.items.slice(-200)
    return item
  }
}
