import { join } from 'node:path'
import fastifyAutoload from '@fastify/autoload'
import fastifySensible from '@fastify/sensible'
import Fastify from 'fastify'
import Type from 'typebox'
import type { IConfig } from './config/index.ts'
import type { TypeBoxTypeProvider } from './utils/type-provider.ts'

export async function buildApp(config: IConfig) {
  const app = Fastify(config.fastifyInit).withTypeProvider<TypeBoxTypeProvider>()

  app.register(fastifySensible)

  app.register(fastifyAutoload, {
    dir: join(import.meta.dirname, 'plugins'),
    forceESM: true,
    options: { config },
  })

  // health check
  app.get(
    '/health',
    {
      schema: {
        response: {
          200: Type.Object({
            status: Type.String(),
          }),
        },
      },
    },
    async () => {
      return { status: 'OK' }
    },
  )

  app.register(fastifyAutoload, {
    dir: join(import.meta.dirname, 'routes'),
    forceESM: true,
    dirNameRoutePrefix: false,
    options: { prefix: '/api/v1', config },
  })

  return app
}
