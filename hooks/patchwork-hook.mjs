import { runJsonHook } from '../src/hook-stdin.mjs'
import { inspectStructure } from '../src/structure-hook.mjs'

await runJsonHook(async payload => ({
  ...(await inspectStructure(payload)),
  event: payload.event || null,
}))
