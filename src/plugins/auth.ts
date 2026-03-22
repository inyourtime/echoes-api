import { definePlugin } from '../utils/factories.ts'
import type { AccessTokenPayload } from './token.ts'

declare module 'fastify' {
  interface FastifyRequest {
    user: AccessTokenPayload | null
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

const plugin = definePlugin({
  name: 'auth',
  dependencies: ['token-service'],
  plugin: async (app) => {
    app.decorateRequest('user', null)

    app.decorate('authenticate', async (req, reply) => {
      const token = req.headers.authorization?.split(' ')[1]
      if (!token) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      try {
        req.user = app.tokenService.verifyAccessToken(token)
      } catch {
        return reply.status(401).send({ error: 'Unauthorized' })
      }
    })
  },
})

export default plugin
