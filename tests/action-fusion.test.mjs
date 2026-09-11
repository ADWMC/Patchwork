import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFusedDefinition, extendParameters, thenRunBlocks } from '../src/mechanisms/action-fusion/fused-tool.mjs'
import { hashFile, targetUnchanged } from '../src/mechanisms/action-fusion/mutation-guard.mjs'
import { withFileQueue } from '../src/mechanisms/action-fusion/file-queue.mjs'
import { registerActionFusion } from '../src/mechanisms/action-fusion/index.mjs'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function nativeWriteTool({ onExecute } = {}) {
  return {
    name: 'write',
    description: 'Write a file.',
    parameters: {
      type: 'object',
      properties: { file_path: { type: 'string' }, content: { type: 'string' } },
      required: ['file_path', 'content'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: `wrote:${value}` }],
    },
    async execute(args) {
      if (onExecute) await onExecute(args)
      return `ok:${args.file_path}`
    },
  }
}

const EXEC = { callId: 'call-1', rootCallId: 'call-1', token: Symbol('token'), name: 'write', arguments: {} }

test('then_run is added without becoming required', () => {
  const original = nativeWriteTool()
  const parameters = extendParameters(original.parameters)

  assert.deepEqual(parameters.required, ['file_path', 'content'])
  assert.deepEqual(parameters.properties.then_run.required, ['command'])
  assert.equal(parameters.properties.then_run.properties.command.type, 'string')
  assert.equal(original.parameters.properties.then_run, undefined)
})

test('a call without then_run follows the native path exactly', async () => {
  const definition = createFusedDefinition({ original: nativeWriteTool(), runThenRun: () => assert.fail('must not run') })
  const value = await definition.execute({ file_path: 'a.txt', content: 'x' }, EXEC)

  assert.deepEqual(value, { mutation: 'ok:a.txt' })
  assert.deepEqual(definition.output.render({}, value), [{ type: 'text', text: 'wrote:ok:a.txt' }])
})

test('a call with then_run reports mutation then command output', async () => {
  const definition = createFusedDefinition({
    original: nativeWriteTool(),
    runThenRun: async ({ command, filePath }) => {
      assert.equal(filePath, 'a.txt')
      return { status: 'succeeded', command, output: `ran ${command}` }
    },
  })
  const value = await definition.execute({ file_path: 'a.txt', content: 'x', then_run: { command: 'pytest -q' } }, EXEC)

  assert.equal(value.mutation, 'ok:a.txt')
  assert.equal(value.thenRun.status, 'succeeded')
  const blocks = definition.output.render({}, value)
  assert.equal(blocks[0].text, 'wrote:ok:a.txt')
  assert.match(blocks[1].text, /^\[then_run:succeeded\]/)
  assert.match(blocks[1].text, /ran pytest -q/)
})

test('only the native value is handed to the native presentation projection', () => {
  const seen = []
  const original = nativeWriteTool()
  original.output.presentationMeta = (_args, value) => {
    seen.push(value)
    return { kind: 'diff' }
  }
  const definition = createFusedDefinition({ original, runThenRun: async () => ({ status: 'succeeded', command: 'c' }) })

  assert.deepEqual(definition.output.presentationMeta({}, { mutation: 'M', thenRun: { status: 'succeeded' } }), { kind: 'diff' })
  assert.deepEqual(seen, ['M'])
})

test('skipped and failed follow-up commands are both visible to the model', () => {
  assert.match(thenRunBlocks({ status: 'skipped', command: 'c', reason: 'target-changed' })[0].text, /\[then_run:skipped\]/)
  assert.match(thenRunBlocks({ status: 'skipped', command: 'c', reason: 'target-changed' })[0].text, /target-changed/)
  assert.match(thenRunBlocks({ status: 'failed', command: 'c', output: 'boom' })[0].text, /boom/)
  assert.deepEqual(thenRunBlocks(undefined), [])
})

test('fused calls to one file never interleave', async () => {
  const order = []
  const original = nativeWriteTool({
    onExecute: async args => {
      order.push(`mutation:${args.tag}:start`)
      await sleep(5)
      order.push(`mutation:${args.tag}:end`)
    },
  })
  const definition = createFusedDefinition({
    original,
    runThenRun: async ({ command }) => {
      order.push(`command:${command}`)
      await sleep(1)
      return { status: 'succeeded', command }
    },
  })

  const call = tag =>
    definition.execute(
      { file_path: 'same.txt', content: 'x', tag, then_run: { command: `c${tag}` } },
      EXEC,
    )
  await Promise.all([call(1), call(2)])

  assert.deepEqual(order, [
    'mutation:1:start',
    'mutation:1:end',
    'command:c1',
    'mutation:2:start',
    'mutation:2:end',
    'command:c2',
  ])
})

test('different files are not serialized against each other', async () => {
  const started = []
  const task = label => withFileQueue(label, async () => {
    started.push(label)
    await sleep(5)
  })
  await Promise.all([task('a.txt'), task('b.txt')])
  assert.deepEqual(started.sort(), ['a.txt', 'b.txt'])
})

test('the guard only blocks on an observed content change', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'patchwork-guard-'))
  const file = join(dir, 'target.txt')
  await writeFile(file, 'one')

  const before = await hashFile(file)
  assert.equal(await targetUnchanged(file, before), true)

  await writeFile(file, 'two')
  assert.equal(await targetUnchanged(file, before), false)

  assert.equal(await hashFile(join(dir, 'missing.txt')), undefined)
  assert.equal(await targetUnchanged(join(dir, 'missing.txt'), undefined), true)
})

test('registration shadows write/edit in the agent scope only', () => {
  const listeners = new Map()
  registerActionFusion({ on: (event, listener) => listeners.set(event, listener) })
  assert.equal(typeof listeners.get('agent/created'), 'function')

  const registered = []
  const dispatched = []
  const native = nativeWriteTool()
  const tools = {
    get: (name, scope) => {
      assert.equal(scope, agent)
      if (name === 'write') return native
      if (name === 'pwsh') return { name: 'pwsh' }
      return undefined
    },
    register: definition => registered.push(definition),
    execute: async input => {
      dispatched.push(input)
      return { isError: false, content: [{ type: 'text', text: `ran ${input.arguments.command}` }] }
    },
  }
  const agent = { ctx: { tools } }
  listeners.get('agent/created')({ agent })

  assert.equal(registered.length, 1)
  assert.equal(registered[0].name, 'write')
  assert.equal(registered[0].parameters.properties.then_run.required[0], 'command')
})

test('a missing shell tool leaves the native tools untouched', () => {
  const warnings = []
  const original = console.warn
  console.warn = message => warnings.push(message)
  try {
    const listeners = new Map()
    registerActionFusion({ on: (event, listener) => listeners.set(event, listener) })
    const registered = []
    const agent = {
      ctx: {
        tools: {
          get: name => (name === 'write' ? nativeWriteTool() : undefined),
          register: definition => registered.push(definition),
        },
      },
    }
    listeners.get('agent/created')({ agent })
    assert.deepEqual(registered, [])
    assert.match(warnings[0], /no shell tool/)
  } finally {
    console.warn = original
  }
})
