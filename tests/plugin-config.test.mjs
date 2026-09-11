import assert from 'node:assert/strict'
import test from 'node:test'
import { Config } from '../src/config/plugin-config.mjs'

test('every mechanism defaults to disabled', () => {
  const config = Config({})
  assert.equal(config.actionFusion, false)
  assert.equal(config.observationPack, false)
  assert.equal(config.evidencePreservingReducer, false)
  assert.equal(config.onlineContextCompact, false)
  assert.equal(config.cacheWriteReadRatio, 12.5)
})

test('the reducer route stays unset unless configured', () => {
  const config = Config({})
  assert.equal(config.reducerProvider, undefined)
  assert.equal(config.reducerModel, undefined)
  assert.deepEqual(Config({ reducerProvider: 'p', reducerModel: 'm' }), {
    actionFusion: false,
    observationPack: false,
    evidencePreservingReducer: false,
    onlineContextCompact: false,
    cacheWriteReadRatio: 12.5,
    reducerProvider: 'p',
    reducerModel: 'm',
  })
})

test('invalid configuration fails instead of being silently corrected', () => {
  assert.throws(() => Config({ cacheWriteReadRatio: 'fast' }), /expected number/)
  assert.throws(() => Config({ actionFusion: 'yes' }), /expected boolean/)
})
