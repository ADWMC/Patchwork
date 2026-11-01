import test from 'node:test'
import assert from 'node:assert/strict'
import { reducibleLog } from '../src/mechanisms/evidence-preserving-reducer/candidate.mjs'
import { buildRequest } from '../src/mechanisms/evidence-preserving-reducer/receipt.mjs'

for (const secret of ['password=synthetic', 'Cookie: session=synthetic', 'Authorization: Bearer synthetic', '{"nested":{"token":"synthetic"}}', '-----BEGIN PRIVATE KEY-----\nsynthetic\n-----END PRIVATE KEY-----']) {
  test(`EPR refuses sensitive diagnostic input: ${secret.split(/[=:]/)[0]}`, () => {
    const body = `test output\n${'ok\n'.repeat(1800)}${secret}`
    assert.equal(reducibleLog({ name: 'pwsh', arguments: { command: 'npm test' } }, { content: [{ type: 'text', text: body }] }).reason, 'likely-secret')
    assert.throws(() => buildRequest({ command: 'npm test', body, sourceHash: 'synthetic', isError: false }), /EPR_SENSITIVE_INPUT/)
  })
}
