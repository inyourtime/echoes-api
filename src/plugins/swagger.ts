import fastifySwagger from '@fastify/swagger'
import fastifyApiReference from '@scalar/fastify-api-reference'
import { definePlugin } from '../utils/factories.ts'

/**
 * Plugin for Swagger documentation
 *
 * @remarks
 * This plugin registers the Swagger documentation plugin
 */
const plugin = definePlugin({
  name: 'documentation',
  plugin: async (app, { config }) => {
    await app.register(fastifySwagger, config.openapi)

    await app.register(fastifyApiReference, {
      routePrefix: '/docs',
      logLevel: 'silent',
      configuration: {
        agent: {
          disabled: true,
        },
      },
    })
  },
})

export default plugin
