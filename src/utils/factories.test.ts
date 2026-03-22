import assert from 'node:assert/strict'
import test from 'node:test'
import Fastify from 'fastify'
import type { IConfig } from '../config/index.ts'
import { definePlugin, defineRoute } from './factories.ts'

test('defineRoute attaches prefix and tags config', () => {
  const plugin = async () => {}

  const route = defineRoute({
    prefix: '/users',
    tags: ['user'],
    plugin,
  })

  assert.equal(route, plugin)
  assert.equal(route.autoPrefix, '/users')

  assert.deepEqual(route.autoConfig, {
    preset: { tags: ['user'] },
  })
})

test('definePlugin registers correctly in fastify', async () => {
  const app = Fastify()

  let called = false

  const plugin = definePlugin({
    name: 'testPlugin',
    plugin: async (fastify) => {
      called = true
      fastify.decorate('hello', 'world')
    },
  })

  await app.register(plugin, { config: {} as IConfig })
  await app.ready()

  assert.equal(called, true)
  // @ts-expect-error
  assert.equal(app.hello, 'world')

  await app.close()
})
