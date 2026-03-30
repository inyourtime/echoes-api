import type { FastifyRequest } from 'fastify'
import { definePlugin } from '#utils/factories'
import type { AccessTokenPayload } from './token.ts'

const kUser = Symbol('user:context')

declare module 'fastify' {
  interface FastifyRequest {
    [kUser]: AccessTokenPayload | null
    getUser(): AccessTokenPayload
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
  interface FastifyContextConfig {
    auth?: boolean
  }
}

const plugin = definePlugin(
  {
    name: 'auth',
    dependencies: ['token-service'],
  },
  async (app) => {
    app.decorateRequest(kUser, null)

    app.decorate('authenticate', async (req) => {
      const authHeader = req.headers.authorization

      if (!authHeader) {
        throw app.httpErrors.unauthorized()
      }

      const [scheme, token] = authHeader.split(' ')

      if (scheme !== 'Bearer' || !token) {
        throw app.httpErrors.unauthorized()
      }

      try {
        req[kUser] = app.tokenService.verifyAccessToken(token)
      } catch {
        throw app.httpErrors.unauthorized()
      }
    })

    app.decorateRequest('getUser', function (this: FastifyRequest) {
      if (!this[kUser]) {
        throw app.httpErrors.unauthorized('Not authenticated')
      }
      return this[kUser]
    })
  },
)

export default plugin
