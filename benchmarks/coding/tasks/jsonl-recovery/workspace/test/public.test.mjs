import assert from 'node:assert/strict'
import test from 'node:test'
import { parseJsonl } from '../src/jsonl.mjs'

test('parses complete records', () => assert.deepEqual(parseJsonl('{"a":1}\n{"b":2}\n'), [{ a: 1 }, { b: 2 }]))
