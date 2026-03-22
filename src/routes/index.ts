import { defineRoute } from '../utils/factories.ts'

const route = defineRoute({
  prefix: '/test',
  tags: ['health'],
  plugin: async (fastify, opts) => {
    fastify.get('/', async (request, reply) => {
      // return fastify.userService.create({ name: 'test', email: 'test' })
    })
  },
})

export default route
