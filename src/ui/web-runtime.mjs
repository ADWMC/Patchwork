import { randomBytes } from 'node:crypto'

// DSH can reload a plugin after a host settings change while the page stays open.
// Keep the page credential and bounded session receipts stable for this process.
// Nothing is persisted to disk or shared with another DSH process.
const key = Symbol.for('@patchwork/coding-agent/web-runtime/v1')
export const webRuntime = globalThis[key] ??= {
  token: randomBytes(16).toString('hex'),
  sessions: new Map(),
  routes: new Set(),
}
