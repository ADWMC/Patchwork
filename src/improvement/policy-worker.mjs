import { readFile, writeFile } from 'node:fs/promises'
import { POLICY_DEFAULTS, policyOutputs, validatePolicyPatch } from './policy.mjs'
const input = JSON.parse(await readFile(process.argv[2], 'utf8'))
const patch = input.patch ? validatePolicyPatch(input.object, input.patch) : null
if (input.patch && !patch) throw new Error('invalid candidate patch')
const policy = { ...POLICY_DEFAULTS, ...(patch ? { [patch.setting]: patch.value } : {}) }
// The case corpus is owned by the runner, never supplied by the model.
const tuning = ['task-present', 'task-absent'], heldOut = ['restored-task', 'ordinary-session']
const outputs = [...tuning, ...heldOut].map(id => ({ id, output: policyOutputs(id === 'ordinary-session' ? POLICY_DEFAULTS : policy, { hasTask: ['task-present', 'restored-task'].includes(id) }) }))
const checks = outputs.every(item => item.output.recallLimit >= 1 && item.output.recallLimit <= 5 && typeof item.output.requireCrossCheck === 'boolean')
  && outputs.find(item => item.id === 'ordinary-session').output.deliveryReminder === ''
  && outputs.find(item => item.id === 'task-absent').output.deliveryReminder === ''
await writeFile(process.argv[3], JSON.stringify({ mode: 'policy-contract', tuning, heldOut, outputs, checks }), { flag: 'wx', mode: 0o600 })
if (!checks) process.exitCode = 1
