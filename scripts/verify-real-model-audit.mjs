#!/usr/bin/env node
import { resolve } from 'node:path'
import { verifyAuditDir, updateIndex } from './audit-lib.mjs'

const args = process.argv.slice(2)
const base = args.find(arg => !arg.startsWith('-')) ?? 'docs/checks/real-model'
const index = args.includes('--index')
const result = await verifyAuditDir(resolve(base))
if (index) await updateIndex(resolve(base))
console.log(JSON.stringify({ base, ...result }, null, 2))
process.exitCode = result.ok ? 0 : 1
