import fastifyCookie from '@fastify/cookie'
import { definePlugin } from '#utils/factories'

declare module 'fastify' {
  interface FastifyInstance {
    getCookieOptions: (expires?: Date) => CookieOptions
  }
}

export interface CookieOptions {
  httpOnly: boolean
  secure: boolean
  sameSite: 'strict' | 'lax'
  path: string
  expires?: Date
}

const plugin = definePlugin(
  {
    name: 'cookie',
  },
  async (app, { config }) => {
    await app.register(fastifyCookie, {
      hook: 'onRequest',
    })

    function getCookieOptions(expires?: Date): CookieOptions {
      return {
        httpOnly: true,
        secure: config.enableCookieSecure, // HTTPS only in production
        sameSite: 'lax',
        path: '/',
        ...(expires ? { expires } : {}),
      }
    }

    app.decorate('getCookieOptions', getCookieOptions)
  },
)

export default plugin
