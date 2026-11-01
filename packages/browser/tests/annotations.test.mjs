import assert from 'node:assert/strict'
import test from 'node:test'
import { BrowserAnnotations, selectionBox } from '../src/browser/annotations.mjs'

function fixture() {
  let tree = 'button: 灯', revoked = false
  const page = { viewportSize: () => ({ width: 400, height: 300 }), url: () => 'http://localhost/control', locator: () => ({ ariaSnapshot: async () => tree }), screenshot: async ({ clip }) => {
    const image = Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(image); image.writeUInt32BE(clip.width,16);image.writeUInt32BE(clip.height,20);return image
  } }
  const session = { annotationGeneration: 0, epoch: 0, page: () => page, check: () => { if (revoked) throw new Error('revoked') }, validateFrame: args => { if (args.frameId !== 'current') throw new Error('stale frame') } }
  return { session, page, annotations: new BrowserAnnotations(session), change: () => { tree = 'button: changed' }, revoke: () => { revoked = true } }
}
const region = { kind: 'region', frameId: 'current', box: { x: 10, y: 12, width: 80, height: 70 } }

test('annotation geometry rejects nonfinite, outside and empty selections', () => {
  for (const box of [{x:NaN,y:0,width:3,height:3},{x:-1,y:0,width:3,height:3},{x:99,y:0,width:3,height:3},{x:0,y:0,width:0,height:3}]) assert.throws(()=>selectionBox({box},{width:100,height:100}))
  assert.deepEqual(selectionBox({box:{x:.5,y:2.5,width:4,height:3}},{width:100,height:100}),{x:0,y:2,width:5,height:4})
})
test('drafts and images remain hidden until explicit, atomic user submission', async () => {
  const { annotations }=fixture(), id=await annotations.pick(region)
  assert.equal(annotations.summaries().length,0); assert.equal(annotations.summaries(true).length,1)
  assert.throws(()=>annotations.image(id),/not submitted/)
  await assert.rejects(annotations.submit([{id,note:'修改间距'},{id:'foreign',note:'不应泄露'}]))
  assert.equal(annotations.summaries().length,0)
  await annotations.submit([{id,note:' 修改间距 '}])
  assert.equal(annotations.summaries()[0].note,'修改间距');assert.ok(annotations.image(id).length)
  const other=fixture().annotations;assert.throws(()=>other.image(id),/not submitted/)
})
test('page mutation, generation changes and stale frames reject annotations', async () => {
  const f=fixture(),id=await f.annotations.pick(region)
  f.change();await assert.rejects(f.annotations.submit([{id,note:'修改'}]),/过期/)
  f.session.annotationGeneration++;assert.equal(f.annotations.summaries(true)[0].stale,true)
  await assert.rejects(f.annotations.pick({...region,frameId:'old'}),/stale/)
  f.annotations.remove(id);assert.equal(f.annotations.summaries(true).length,0)
})
test('revocation during capture cannot repopulate cleared annotation storage', async () => {
  const f=fixture()
  const screenshot=f.page.screenshot
  f.page.screenshot=async args=>{const image=await screenshot(args);f.annotations.clear();f.revoke();return image}
  await assert.rejects(f.annotations.pick(region),/revoked/)
  assert.equal(f.annotations.items.size,0)
})
