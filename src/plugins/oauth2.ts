import { fastifyOauth2, type OAuth2Namespace } from '@fastify/oauth2'
import { definePlugin } from '../utils/factories.ts'

declare module 'fastify' {
  interface FastifyInstance {
    googleOAuth2: OAuth2Namespace
    lineOAuth2: OAuth2Namespace
  }
}

/**
 * Plugin for OAuth2
 *
 * @remarks
 * This plugin registers the OAuth2 plugin and sets up the necessary routes.
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

    await app.register(fastifyOauth2, {
      name: 'lineOAuth2',
      scope: ['profile', 'openid', 'email'],
      credentials: {
        client: {
          id: config.oauth2.line.clientId,
          secret: config.oauth2.line.clientSecret,
        },
        auth: {
          tokenHost: config.oauth2.line.tokenHost,
          tokenPath: config.oauth2.line.tokenPath,
          authorizeHost: config.oauth2.line.authorizeHost,
          authorizePath: config.oauth2.line.authorizePath,
        },
      },
      startRedirectPath: config.oauth2.line.loginPath,
      callbackUri: config.oauth2.line.callbackUri,
    })
  },
)

export default plugin
