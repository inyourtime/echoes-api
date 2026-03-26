import assert from 'node:assert/strict'
import test from 'node:test'
import { definePlugin, defineRoute } from '../../src/utils/factories.ts'

test('defineRoute should return plugin when only plugin is provided', () => {
  const mockPlugin = async () => {}

  const result = defineRoute(mockPlugin)

  assert.strictEqual(result, mockPlugin)
})

test('defineRoute should attach autoPrefix and autoConfig when options and plugin are provided', () => {
  const mockPlugin = async () => {}
  const options = {
    prefix: '/api/v1',
    tags: ['users', 'auth'],
  }

  const result = defineRoute(options, mockPlugin) as typeof mockPlugin & {
    autoPrefix: string
    autoConfig: object
  }

  assert.strictEqual(result, mockPlugin)
  assert.strictEqual(result.autoPrefix, '/api/v1')
  assert.deepStrictEqual(result.autoConfig, {
    preset: { tags: ['users', 'auth'] },
  })
})

test('defineRoute should work with only prefix option', () => {
  const mockPlugin = async () => {}
  const options = {
    prefix: '/test',
  }

  const result = defineRoute(options, mockPlugin) as typeof mockPlugin & {
    autoPrefix: string
    autoConfig: object
  }

  assert.strictEqual(result.autoPrefix, '/test')
  assert.deepStrictEqual(result.autoConfig, {
    preset: { tags: undefined },
  })
})

test('defineRoute should work with only tags option', () => {
  const mockPlugin = async () => {}
  const options = {
    tags: ['api'],
  }

  const result = defineRoute(options, mockPlugin) as typeof mockPlugin & {
    autoPrefix: string
    autoConfig: object
  }

  assert.strictEqual(result.autoPrefix, undefined)
  assert.deepStrictEqual(result.autoConfig, {
    preset: { tags: ['api'] },
  })
})

test('defineRoute should throw when options provided but plugin is undefined', () => {
  const options = {
    prefix: '/api',
  }

  assert.throws(
    () => defineRoute(options, undefined as any),
    /defineRoute requires a plugin when options are provided/,
  )
})

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

test('defineRoute should work with empty tags array', () => {
  const mockPlugin = async () => {}
  const options = {
    prefix: '/api',
    tags: [] as const,
  }

  const result = defineRoute(options, mockPlugin) as typeof mockPlugin & { autoConfig: object }

  assert.deepStrictEqual(result.autoConfig, {
    preset: { tags: [] },
  })
})
