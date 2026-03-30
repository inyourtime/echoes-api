import { fastifyOauth2, type OAuth2Namespace } from '@fastify/oauth2'
import { definePlugin } from '#utils/factories'

declare module 'fastify' {
  interface FastifyInstance {
    googleOAuth2: OAuth2Namespace
  }
}

/**
 * Plugin for Google OAuth2
 *
 * @remarks
 * This plugin registers the Google OAuth2 plugin and sets up the necessary routes.
 */
const plugin = definePlugin(
  {
    name: 'oauth2',
  },
  async (app, { config }) => {
    await app.register(fastifyOauth2, {
      name: 'googleOAuth2',
      scope: ['profile', 'email'],
      credentials: {
        client: {
          id: config.oauth2.google.clientId,
          secret: config.oauth2.google.clientSecret,
        },
        auth: fastifyOauth2.GOOGLE_CONFIGURATION,
      },
      startRedirectPath: config.oauth2.google.loginPath,
      callbackUri: config.oauth2.google.callbackUri,
    })
  },
)

export default plugin
