import { runJsonHook } from '../src/hook/hook-stdin.mjs'
import { buildStructureWarning } from '../src/structure/structure-warning.mjs'

await runJsonHook(async payload => ({
  ...(await buildStructureWarning(payload)),
  event: payload.event || null,
}))
