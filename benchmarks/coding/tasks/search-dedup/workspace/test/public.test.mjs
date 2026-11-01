import assert from 'node:assert/strict'
import test from 'node:test'
import { dedupeSources } from '../src/dedupe.mjs'

test('removes exact duplicate URLs and keeps first source', () => assert.deepEqual(dedupeSources([{ url: 'https://a.test/x', title: 'first' }, { url: 'https://a.test/x', title: 'second' }]), [{ url: 'https://a.test/x', title: 'first' }]))
