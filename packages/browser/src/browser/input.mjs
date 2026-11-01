import { digest } from './evidence.mjs'
import { INPUT_ACTIONS } from './session.mjs'

// Ordered, bounded, at-most-once input. Lost acknowledgements are never a reason
// to replay a click or form submission under another sequence number.
export class BrowserInput {
  constructor(session) { this.session = session; this.clients = new Map(); this.tail = Promise.resolve(); this.pending = 0 }
  send(envelope) {
    this.session.check()
    if (!envelope || !/^[a-zA-Z0-9-]{16,80}$/.test(envelope.inputId) || !Number.isSafeInteger(envelope.sequence) || envelope.sequence < 1 || !Array.isArray(envelope.events) || envelope.events.length < 1 || envelope.events.length > 32 || envelope.events.some(event => !INPUT_ACTIONS.has(event?.action))) return Promise.reject(new Error('Invalid input envelope'))
    if (this.pending >= 64) return Promise.reject(new Error('Input queue is full; wait for acknowledgement'))
    const queuedAt = performance.now(), signature = digest(JSON.stringify(envelope.events))
    this.pending++
    const work = async () => {
      this.session.check()
      let client = this.clients.get(envelope.inputId)
      if (!client) {
        if (envelope.sequence !== 1) throw new Error('Input connection expired; reconnect without replaying actions')
        if (this.clients.size >= 8) this.clients.delete(this.clients.keys().next().value)
        this.clients.set(envelope.inputId, client = { sequence: 0 })
      }
      if (envelope.sequence === client.sequence && signature === client.signature && client.ack) return client.ack
      if (envelope.sequence !== client.sequence + 1) throw new Error('Input sequence mismatch; reconnect without replaying actions')
      // Consume the sequence before any action: partial batches cannot be replayed.
      client.sequence = envelope.sequence; client.signature = signature; client.ack = null
      const queueMs = performance.now() - queuedAt
      let result, applied = 0
      try {
        for (const event of envelope.events) { result = await this.session.action('user', event, { lightweight: true }); applied++ }
      } catch (error) {
        await this.session.releaseInputs()
        client.ack = { inputOnly: true, inputId: envelope.inputId, sequence: envelope.sequence, applied, failed: true, reason: 'Input was interrupted; refresh the page state before continuing' }
        throw error
      }
      this.session.check()
      return client.ack = { ...result, inputId: envelope.inputId, sequence: envelope.sequence, applied, queueMs: Math.round(queueMs), durationMs: Math.round(performance.now() - queuedAt) }
    }
    const next = this.tail.then(work, work)
    this.tail = next.catch(() => {})
    return next.finally(() => { this.pending-- })
  }
}
