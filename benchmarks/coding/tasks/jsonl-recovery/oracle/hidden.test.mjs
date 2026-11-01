import assert from 'node:assert/strict'
import test from 'node:test'
import { parseJsonl } from '../src/jsonl.mjs'

test('keeps complete records before a truncated final line', () => assert.deepEqual(parseJsonl('{"a":1}\n{"b":'), [{ a: 1 }]))
test('rejects a malformed middle line', () => assert.throws(() => parseJsonl('{"a":1}\nnope\n{"b":2}\n'), /INVALID_JSONL/))
