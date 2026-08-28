import { runJsonHook } from '../src/hook-stdin.mjs'

await runJsonHook(payload => ({
  ok: true,
  event: payload.event || null,
}))
