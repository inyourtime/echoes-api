import assert from 'node:assert/strict'
import test from 'node:test'
import { definePlugin } from '../../src/utils/factories.ts'

test('definePlugin should return wrapped plugin when only plugin is provided', async () => {
  const mockPlugin = async () => {}

  const result = definePlugin(mockPlugin)

  assert.strictEqual(typeof result, 'function')
})

test('definePlugin should apply options when provided', async () => {
  const mockPlugin = async () => {}
  const options = {
    name: 'test-plugin',
    dependencies: ['dependency1', 'dependency2'],
    encapsulate: true,
  }

  const result = definePlugin(options, mockPlugin)

  assert.strictEqual(typeof result, 'function')
})

test('definePlugin should throw when options provided but plugin is undefined', () => {
  const options = {
    name: 'test-plugin',
  }

  assert.throws(
    () => definePlugin(options, undefined as any),
    /definePlugin requires a plugin when options are provided/,
  )
})

test('definePlugin should work with empty options', () => {
  const mockPlugin = async () => {}
  const options = {}

  const result = definePlugin(options, mockPlugin)

  assert.strictEqual(typeof result, 'function')
})
