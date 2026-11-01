import { nativeSessionApi } from '../logging/session-log.mjs'
import { initialSuperagent, restoreSuperagent, SUPERAGENT_RECORD } from './state.mjs'

export function restoreController(owner) {
  const session = owner.session, end = session.seq ?? 0
  for (let i = end - 1; i >= Math.max(0, end - 10000); i--) {
    const event = session.eventAt?.(i)
    if (event?.type !== SUPERAGENT_RECORD || event.ignorable !== true) continue
    if (event.data.workspace !== session.header.cwd) throw new Error('superagent workspace changed; recovery required')
    return restoreSuperagent(event.data, session.header.id)
  }
  if (end >= 10000) throw new Error('superagent history scan limit reached; recovery required')
  return initialSuperagent(session.header.id)
}

/** The durable intent precedes child creation. A missing persistence service fails closed. */
export async function persistController(owner, state) {
  const api = nativeSessionApi(owner.session)
  const sessions = owner.ctx.get('sessions')
  if (!api || typeof sessions?.flush !== 'function') throw new Error('superagent requires native Session persistence')
  const data = structuredClone(state)
  data.workspace = owner.session.header.cwd
  if (Buffer.byteLength(JSON.stringify(data)) > 262144) throw new Error('superagent checkpoint exceeds 256 KiB')
  api.appendPluginRecord(owner.session, SUPERAGENT_RECORD, data)
  await sessions.flush(owner.session)
}
