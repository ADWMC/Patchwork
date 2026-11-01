import assert from 'node:assert/strict'
import test from 'node:test'
import { setTimeout as wait } from 'node:timers/promises'
import { createElementInspector } from '../src/client/element-inspector.mjs'
import { BrowserAnnotations } from '../src/browser/annotations.mjs'
import { BrowserSession } from '../src/browser/session.mjs'
import { scopedAgent } from './helpers/agent.mjs'

const target = { tag: 'button', selector: 'button#light.control', role: '', name: '灯', box: { x: 10, y: 12, width: 80, height: 30 }, size: { width: 80, height: 30 }, padding: { top: 4, right: 8, bottom: 4, left: 8 }, frameBoundary: false }
const point = { frameId: 'current', tabId: 'tab', box: { x: 20, y: 20, width: 1, height: 1 } }
function fixture() {
  let revoked = false, captures = 0, reads = 0, evaluated = 0, changed = false
  const page = { viewportSize: () => ({ width: 400, height: 300 }), url: () => 'http://localhost/control', evaluate: async () => { evaluated++; return structuredClone(changed ? { ...target, box: { ...target.box, x: 22 } } : target) }, locator: () => ({ ariaSnapshot: async () => { reads++; return 'button: 灯' } }), screenshot: async ({ clip }) => {
    captures++; const image = Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(image); image.writeUInt32BE(clip.width,16); image.writeUInt32BE(clip.height,20); return image
  } }
  const session = { annotationGeneration: 0, epoch: 0, page: () => page, check: () => { if (revoked) throw new Error('revoked') }, validateFrame: args => { if (args.frameId !== 'current' || args.tabId !== 'tab') throw new Error('stale frame') } }
  return { page, session, annotations: new BrowserAnnotations(session), counts: () => ({ captures, reads, evaluated }), revoke: () => { revoked = true }, mutate: () => { changed = true } }
}

test('hover inspection is read-only, bounded, and does not create drafts or screenshots', async () => {
  const f = fixture(), result = await f.annotations.inspect(point)
  assert.equal(result.inspection.selector, target.selector)
  assert.equal(result.inspection.targetId.length, 64)
  assert.equal(result.frameId, 'current')
  assert.deepEqual(f.counts(), { captures: 0, reads: 0, evaluated: 1 })
  assert.equal(f.annotations.summaries(true).length, 0)
  assert.equal(f.session.epoch, 0)
  for (const args of [{ ...point, frameId: 'old' }, { ...point, tabId: 'foreign' }, { ...point, box: { x: 401, y: 0, width: 1, height: 1 } }]) await assert.rejects(f.annotations.inspect(args))
  assert.equal(f.counts().evaluated, 1)
})

test('hover completion rechecks navigation and authorization', async () => {
  for (const change of ['revoke', 'navigate']) {
    const f = fixture(), original = f.page.evaluate
    f.page.evaluate = async (...args) => { const result = await original(...args); if (change === 'revoke') f.revoke(); else f.session.epoch++; return result }
    await assert.rejects(f.annotations.inspect(point), /revoked|页面已变化/)
  }
})

test('click selects the inspected element and rejects changed geometry before or during capture', async () => {
  const f = fixture(), { inspection } = await f.annotations.inspect(point)
  const id = await f.annotations.pick({ ...point, kind: 'element', targetId: inspection.targetId })
  assert.equal(f.annotations.summaries(true)[0].id, id)
  assert.deepEqual(f.annotations.summaries(true)[0].box, target.box)
  assert.equal(f.annotations.summaries(true)[0].target.selector, target.selector)
  assert.equal(f.annotations.summaries().length, 0)
  f.mutate()
  await assert.rejects(f.annotations.pick({ ...point, kind: 'element', targetId: inspection.targetId }), /元素已变化/)
  const moving = fixture(), original = moving.page.screenshot
  moving.page.screenshot = async args => { const result = await original(args); moving.mutate(); return result }
  await assert.rejects(moving.annotations.pick({ ...point, kind: 'element' }), /页面已变化/)
  assert.equal(moving.annotations.summaries(true).length, 0)
})

test('inspection action is user-only and requires explicit browser takeover', async () => {
  const session = new BrowserSession(scopedAgent())
  try {
    await assert.rejects(session.action('agent', { action: 'inspectElement', ...point }), /requires the user panel/)
    await assert.rejects(session.action('user', { action: 'inspectElement', ...point }), /先接管/)
    assert.equal(session.trace.items.length, 0)
  } finally { await session.dispose() }
})

test('hover queue coalesces movement and never applies an obsolete response', async () => {
  const calls = [], changes = [], releases = []
  const picker = createElementInspector({ delay: 1, request: (point, signal) => new Promise(resolve => { calls.push({ point, signal }); releases.push(resolve) }), onChange: value => changes.push(value) })
  try {
    picker.inspect({ x: 1, y: 1 }); picker.inspect({ x: 2, y: 2 })
    await wait(15)
    assert.equal(calls.length, 1); assert.equal(calls[0].point.x, 2)
    picker.inspect({ x: 3, y: 3 }); picker.inspect({ x: 4, y: 4 })
    releases.shift()({ inspection: target }); await wait(15)
    assert.equal(changes.length, 0); assert.equal(calls.length, 2); assert.equal(calls[1].point.x, 4)
    releases.shift()({ inspection: target }); await wait(5)
    assert.equal(changes[0].point.x, 4)
    picker.inspect({ x: 5, y: 5 }); await wait(15); picker.clear()
    assert.equal(calls[2].signal.aborted, true)
    releases.shift()({ inspection: target }); await wait(5)
    assert.equal(changes.at(-1), null)
    const count = calls.length; picker.inspect({ x: 6, y: 6 }); picker.dispose(); await wait(5)
    assert.equal(calls.length, count)
  } finally { picker.dispose() }
})
