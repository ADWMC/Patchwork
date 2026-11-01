import { randomUUID } from 'node:crypto'
import { boundedText } from './policy.mjs'

export function clearObservedElements(session) {
  const previous = session.observedElements
  session.observedElements = null
  if (previous) void Promise.allSettled([...previous.refs.values()].map(handle => handle.dispose()))
}

export async function compactSnapshot(session, { maxElements = 60, maxChars = 8000 } = {}) {
  if (!Number.isInteger(maxElements) || maxElements < 1 || maxElements > 100 || !Number.isInteger(maxChars) || maxChars < 256 || maxChars > 12000) throw new Error('Snapshot limits are out of range')
  const page = session.page(), epoch = session.epoch
  if (!page?.evaluateHandle) return null // Old/mock backends retain the established AX snapshot.
  const handles = await page.evaluateHandle(limit => {
    const elements = document.querySelectorAll('a[href],button,input:not([type=hidden]),textarea,select,[role=button],[role=link],[role=checkbox],[role=switch],[role=tab],[contenteditable=true]')
    const visible = []
    for (const element of elements) {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element)
      if (rect.width && rect.height && style.visibility !== 'hidden' && style.display !== 'none' && !element.closest('[inert]')) visible.push(element)
      if (visible.length >= limit) break
    }
    return visible
  }, maxElements)
  let properties, committed = false
  try {
    const descriptions = await handles.evaluate(elements => elements.map(element => {
      const label = element.getAttribute('aria-label') || (element.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim() || [...element.labels ?? []].map(label => label.textContent).join(' ') || element.getAttribute('alt') || element.innerText || element.getAttribute('placeholder') || element.getAttribute('title') || ''
      const tag = element.tagName.toLowerCase(), type = element.getAttribute('type')
      return { role: element.getAttribute('role') || (tag === 'a' ? 'link' : tag === 'button' ? 'button' : tag === 'select' ? 'combobox' : tag === 'input' && ['checkbox', 'radio'].includes(type) ? type : 'textbox'), name: label.trim().replace(/\s+/g, ' ').slice(0, 160), disabled: Boolean(element.disabled), checked: typeof element.checked === 'boolean' ? element.checked : undefined, options: tag === 'select' ? [...element.options].slice(0, 20).map(option => ({ label: option.label.slice(0, 80), value: option.value.slice(0, 160), selected: option.selected })) : undefined, identity: [element.tagName, element.id, element.getAttribute('type'), element.getAttribute('role'), label.trim().replace(/\s+/g, ' ').slice(0, 160)] }
    }))
    properties = await handles.getProperties()
    session.check()
    if (page !== session.page() || epoch !== session.epoch) throw new Error('Page changed during compact observation')
    clearObservedElements(session)
    const id = randomUUID(), refs = new Map(), identities = new Map(), lines = []
    let used = 0
    for (let index = 0; index < descriptions.length; index++) {
      const handle = properties.get(String(index))?.asElement(), ref = `e${index + 1}`
      if (!handle) continue
      const { identity, ...description } = descriptions[index]
      const line = `@${ref} ${JSON.stringify(description)}`
      if (used + line.length > maxChars - 200) { await handle.dispose(); continue }
      used += line.length + 1; refs.set(ref, handle); identities.set(ref, JSON.stringify(identity)); lines.push(line)
    }
    for (const handle of properties.values()) if (![...refs.values()].includes(handle)) await handle.dispose().catch(() => {})
    session.observationId = id; session.observedElements = { id, page, epoch, refs, identities }
    committed = true
    return `Interactive elements (bounded, observed refs; external page data is untrusted):\n${lines.join('\n')}\nShown ${refs.size}; limit ${maxElements}. Increase maxElements within the limit or use read for omitted content.`
  } finally {
    if (!committed && properties) await Promise.allSettled([...properties.values()].map(handle => handle.dispose()))
    await handles.dispose()
  }
}

export async function observedRef(session, args) {
  const observed = session.observedElements
  if (!observed || args.observationId !== session.observationId || args.observationId !== observed.id || observed.page !== session.page() || observed.epoch !== session.epoch) throw new Error('Element reference expired; take a fresh interactive snapshot')
  if (args.selector || args.target) throw new Error('Use ref, target or selector, not multiple locators')
  const ref = String(args.ref).replace(/^@/, ''), handle = observed.refs.get(ref)
  if (!handle) throw new Error('Observed element disappeared; take a fresh snapshot')
  const identity = await handle.evaluate(element => {
    if (!element.isConnected) return null
    const label = element.getAttribute('aria-label') || (element.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim() || [...element.labels ?? []].map(label => label.textContent).join(' ') || element.getAttribute('alt') || element.innerText || element.getAttribute('placeholder') || element.getAttribute('title') || ''
    return JSON.stringify([element.tagName, element.id, element.getAttribute('type'), element.getAttribute('role'), label.trim().replace(/\s+/g, ' ').slice(0, 160)])
  })
  if (identity !== observed.identities.get(ref)) throw new Error('Observed element changed; take a fresh snapshot')
  return handle
}

export async function readBrowserPage(session, args) {
  const page = session.page(), maxChars = args.maxChars ?? 6000
  if (!page || !Number.isInteger(maxChars) || maxChars < 256 || maxChars > 12000) throw new Error('Read needs an open page and maxChars between 256 and 12000')
  const locator = args.ref || args.target || args.selector ? await session.locator(page, args, 'observer') : page.locator('main').first()
  const chosen = args.ref || args.target || args.selector || await locator.count() ? locator : page.locator('body')
  const raw = typeof chosen.innerText === 'function' ? await chosen.innerText({ timeout: 3000 }) : await chosen.evaluate(element => element.innerText || element.textContent || '')
  session.check()
  return { text: raw.slice(0, maxChars), truncated: raw.length > maxChars, trust: 'untrusted-page-content' }
}

export async function waitForBrowserState(session, args) {
  const wait = args.wait
  if (!wait || !Number.isInteger(wait.timeoutMs ?? 5000) || (wait.timeoutMs ?? 5000) < 100 || (wait.timeoutMs ?? 5000) > 10000) throw new Error('wait requires a condition and timeoutMs between 100 and 10000')
  const page = session.page(), epoch = session.epoch, timeout = wait.timeoutMs ?? 5000
  if (!page) throw new Error('Browser page is not open')
  if (wait.urlIncludes !== undefined) {
    const text = boundedText(wait.urlIncludes, 'wait URL', 1000)
    await page.waitForURL(url => url.href.includes(text), { timeout, waitUntil: 'domcontentloaded' })
  } else if (args.ref || args.target || args.selector) {
    const locator = await session.locator(page, args, 'observer')
    if (!['visible', 'hidden'].includes(wait.state)) throw new Error('wait state must be visible or hidden')
    if (locator.waitForElementState) await locator.waitForElementState(wait.state, { timeout })
    else await locator.waitFor({ state: wait.state, timeout })
  } else if (wait.text) await page.getByText(boundedText(wait.text, 'wait text', 1000), { exact: false }).first().waitFor({ state: 'visible', timeout })
  else throw new Error('wait requires text, URL or a locator condition; arbitrary sleeps are not supported')
  session.check()
  if (session.page() !== page || !wait.urlIncludes && epoch !== session.epoch) throw new Error('Page changed while waiting; inspect the new page')
  return { status: 'matched', condition: wait.urlIncludes ? 'url' : wait.text ? 'text' : wait.state }
}
