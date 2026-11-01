import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { BrowserSession } from '../src/browser/session.mjs'
import { BrowserInput } from '../src/browser/input.mjs'
import { createInputQueue } from '../src/client/input-queue.mjs'
import { scopedAgent } from './helpers/agent.mjs'

function fixture() {
  const calls = [], page = Object.assign(new EventEmitter(), {
    url: () => 'https://example.com/', viewportSize: () => ({ width: 1280, height: 800 }),
    keyboard: { insertText: async value => calls.push(['text', value]), press: async value => calls.push(['key', value]), down: async value => calls.push(['keydown', value]), up: async value => calls.push(['keyup', value]) },
    mouse: { move: async (x, y) => calls.push(['move', x, y]), down: async value => calls.push(['down', value]), up: async value => calls.push(['up', value]), wheel: async (x, y) => calls.push(['wheel', x, y]) },
    evaluate: async () => true, evaluateHandle: async () => ({ dispose: async () => {} }),
    locator: () => { throw new Error('User input must not read the accessibility tree') },
  })
  const session = new BrowserSession(scopedAgent())
  session.context = {}; session.tabs.set('tab', { id: 'tab', page }); session.selectedTabId = 'tab'
  session.frames.set('frame', { epoch: 0, tabId: 'tab' }); session.frameToken = 'frame'; session.focusId = 'focus'
  session.status = () => { throw new Error('User input must not read full status') }
  const event = fields => ({ frameId: 'frame', tabId: 'tab', focusId: session.focusId, ...fields })
  return { session, calls, page, event }
}

test('direct input skips AX/status, preserves the stream and invalidates Agent observations', async () => {
  const f = fixture(); let stops = 0
  f.session.stopStream = () => { stops++ }; f.session.observationId = 'previous-observation'
  for (const action of [f.event({ action: 'type', value: '你好' }), f.event({ action: 'scroll', deltaX: 12, deltaY: 200 })]) {
    const ack = await f.session.action('user', action, { lightweight: true })
    assert.equal(ack.inputOnly, true)
  }
  assert.equal(stops, 0); assert.equal(f.session.epoch, 0); assert.equal(f.session.observationId, null)
  assert.deepEqual(f.calls, [['text', '你好'], ['wheel', 12, 200]])
  f.session.invalidate(); assert.equal(stops, 1)
  await assert.rejects(f.session.action('user', f.event({ action: 'type', value: 'stale' }), { lightweight: true }), /画面已变化/)
})

test('pointer state supports dragging/double clicks and releases held inputs on invalidation', async () => {
  const f = fixture()
  for (const phase of ['down', 'move', 'up', 'down', 'up']) await f.session.action('user', f.event({ action: 'pointer', phase, x: 10, y: 20 }), { lightweight: true })
  assert.equal(f.calls.filter(x => x[0] === 'down')[1][1].clickCount, 2)
  await f.session.action('user', f.event({ action: 'pointer', phase: 'down', x: 10, y: 20 }), { lightweight: true })
  await f.session.action('user', f.event({ action: 'keyState', phase: 'down', value: 'Control' }), { lightweight: true })
  await assert.rejects(f.session.action('user', f.event({ action: 'keyState', phase: 'down', value: 'c' }), { lightweight: true }), /剪贴板/)
  f.session.invalidate(); await f.session.inputRelease
  assert.ok(f.calls.some(x => x[0] === 'keyup' && x[1] === 'Control')); assert.equal(f.session.pressedButtons.size, 0)
  await assert.rejects(f.session.action('agent', f.event({ action: 'pointer', phase: 'down', x: 1, y: 2 })), /用户接管|Pointer input/)
})

test('input sequence deduplication prevents replay, rejects gaps and consumes partial failures', async () => {
  const f = fixture(), input = new BrowserInput(f.session), inputId = 'input-connection-12345678'
  const envelope = { inputId, sequence: 1, events: [f.event({ action: 'type', value: 'once' })] }
  const first = await input.send(envelope), again = await input.send(envelope)
  assert.deepEqual(again, first); assert.equal(f.calls.length, 1)
  await assert.rejects(input.send({ ...envelope, sequence: 3 }), /sequence mismatch/)
  await assert.rejects(input.send({ ...envelope, sequence: 2, events: [f.event({ action: 'type', value: 'applied' }), f.event({ action: 'type', value: '' })] }), /value/)
  const failed = await input.send({ ...envelope, sequence: 2, events: [f.event({ action: 'type', value: 'applied' }), f.event({ action: 'type', value: '' })] })
  assert.equal(failed.failed, true); assert.equal(failed.applied, 1); assert.equal(f.calls.length, 2)
})

test('client queue coalesces text, scroll and pointer moves without dropping ordered boundaries', async () => {
  const sent = [], identity = () => ({ frameId: 'frame', tabId: 'tab', focusId: 'focus' })
  const queue = createInputQueue({ identity, send: async envelope => { sent.push(envelope); return { sequence: envelope.sequence, focusId: 'focus' } } })
  const event = fields => ({ ...identity(), ...fields })
  await Promise.all([
    queue.push(event({ action: 'type', value: 'a' })), queue.push(event({ action: 'type', value: 'b' })),
    queue.push(event({ action: 'scroll', deltaX: 1, deltaY: 100 })), queue.push(event({ action: 'scroll', deltaX: 2, deltaY: 50 })),
    queue.push(event({ action: 'pointer', phase: 'move', x: 1, y: 2 })), queue.push(event({ action: 'pointer', phase: 'move', x: 8, y: 9 })),
    queue.push(event({ action: 'pointer', phase: 'up', x: 8, y: 9 })),
  ])
  assert.equal(sent.length, 4); assert.equal(sent[0].events[0].value, 'ab'); assert.equal(sent[1].events[0].deltaY, 150)
  assert.equal(sent[2].events[0].x, 8); assert.equal(sent[3].events[0].phase, 'up'); queue.close()
})

test('closing the client rejects waiting input and never replays an unknown outcome', async () => {
  let finish
  const queue = createInputQueue({ identity: () => ({ frameId: 'frame', tabId: 'tab' }), schedule: callback => setTimeout(callback, 0), send: () => new Promise(resolve => { finish = resolve }) })
  const pending = queue.push({ action: 'type', value: 'one', frameId: 'frame', tabId: 'tab' })
  const rejected = assert.rejects(pending, /closed/)
  await new Promise(resolve => setTimeout(resolve, 10)); queue.close(); await rejected
  finish({ sequence: 1 }); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(queue.pending, 0)
})

test('user takeover cancels retrieval during policy/DNS/robots work before a context is created', async () => {
  const f=fixture();let policySignal
  const reading=f.session.readPublic({url:'https://example.com/',authorizeTarget:(_url,_document,signal)=>{policySignal=signal;return new Promise(()=>{})}})
  const rejected=assert.rejects(reading,/cancelled|interrupted/)
  await new Promise(resolve=>setImmediate(resolve))
  assert.ok(policySignal)
  const result=await f.session.action('user',f.event({action:'scroll',deltaX:0,deltaY:30}),{lightweight:true})
  await rejected
  assert.equal(policySignal.aborted,true);assert.equal(result.inputOnly,true);assert.equal(f.session.pendingResourceAction,0)
})

test('explicit control changes revoke observed refs and focus without invalidating displayed coordinates or stream', async()=>{
  const f=fixture();let stopped=0
  f.session.stopStream=()=>stopped++;f.session.observationId='observed'
  f.session.status=async()=>({control:f.session.control})
  await f.session.action('user',{action:'control',control:'user'})
  assert.equal(stopped,0);assert.equal(f.session.epoch,0);assert.equal(f.session.observationId,null);assert.equal(f.session.focusId,null)
  assert.doesNotThrow(()=>f.session.validateFrame({frameId:'frame',tabId:'tab'}))
})
