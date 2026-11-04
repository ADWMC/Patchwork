import assert from 'node:assert/strict'
import test from 'node:test'
import { executeTool, usesBatchToolExecution } from '../src/util/tool-execute.mjs'

test('single-call DSH registries receive the original call unchanged', async () => {
  const call = { name: 'pwsh', arguments: { command: 'exit 0' }, callId: 'rc5-1', agent: { id: 'a' } }
  const tools = { execute: async input => input === call ? 'same' : 'different' }
  assert.equal(usesBatchToolExecution(tools), false)
  assert.equal(await executeTool(tools, call), 'same')
})

test('batch DSH registries receive one raw call and return its settled result', async () => {
  let received
  const result = { value: { exitCode: 0 }, isError: false, content: [] }
  const tools = {
    selectExecutor() {},
    execute: async input => {
      received = input
      return { results: [{ callId: 'alpha-1', result }], additionalContexts: [], concluded: false }
    },
  }
  const signal = new AbortController().signal
  assert.equal(usesBatchToolExecution(tools), true)
  assert.equal(await executeTool(tools, { name: 'pwsh', arguments: { command: 'exit 0' }, callId: 'alpha-1', agent: { id: 'a' }, signal }), result)
  assert.deepEqual(received.calls, [{ id: 'alpha-1', name: 'pwsh', arguments: '{"command":"exit 0"}' }])
  assert.equal(received.signal, signal)
  assert.deepEqual(received.agent, { id: 'a' })
})
