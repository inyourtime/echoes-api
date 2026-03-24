import type { SwaggerOptions } from '@fastify/swagger'
import envSchema from 'env-schema'
import type { FastifyServerOptions } from 'fastify'
import Type, { type Static } from 'typebox'

export interface IConfig {
  host: string
  port: number
  openapi: SwaggerOptions
  fastifyInit: FastifyServerOptions
  oauth2: {
    google: {
      clientId: string
      clientSecret: string
      loginPath: string
      callbackUri: string
    }
  }
  mailer: {
    resendApiKey: string
  }
  jwt: {
    accessTokenSecret: string
    refreshTokenSecret: string
    accessTokenTTL: string // e.g., "15m", "1h", "30d"
    slidingTTLMs: number // milliseconds
    nbfGrace: string // e.g., "10s", "1m"
  }
  isCookieSecure: boolean
}

function getLoggerConfig(logLevel: string) {
  if (process.stdout.isTTY) {
    return {
      level: logLevel,
      transport: {
        // target: '@fastify/one-line-logger',
        target: 'pino-pretty',
      },
    }
  }

  return { level: logLevel }
}

const schema = Type.Object({
  PORT: Type.Number({ default: 3000 }),
  HOST: Type.String({ default: '0.0.0.0' }),
  POSTGRES_URL: Type.String(),
  LOG_LEVEL: Type.Union(
    [
      Type.Literal('trace'),
      Type.Literal('debug'),
      Type.Literal('info'),
      Type.Literal('warn'),
      Type.Literal('error'),
      Type.Literal('fatal'),
      Type.Literal('silent'),
    ],
    { default: 'info' },
  ),
  GOOGLE_CLIENT_ID: Type.String(),
  GOOGLE_CLIENT_SECRET: Type.String(),
  RESEND_API_KEY: Type.String(),
  JWT_ACCESS_TOKEN_SECRET: Type.String(),
  JWT_REFRESH_TOKEN_SECRET: Type.String(),
  JWT_ACCESS_TOKEN_TTL: Type.String({ default: '15m' }), // 15 minutes
  JWT_SLIDING_TTL_MS: Type.Number({ default: 30 * 24 * 60 * 60 * 1000 }), // 30 days in milliseconds
  JWT_NBF_GRACE: Type.String({ default: '10s' }), // 10 seconds
  IS_COOKIE_SECURE: Type.Boolean({ default: true }),
})

function getConfig() {
  const env = envSchema<Static<typeof schema>>({
    dotenv: false,
    data: process.env,
    schema,
  })

  const config: IConfig = {
    host: env.HOST,
    port: env.PORT,
    fastifyInit: {
      logger: getLoggerConfig(env.LOG_LEVEL),
      routerOptions: {
        ignoreTrailingSlash: true,
      },
      bodyLimit: 1048576, // 1MB
      connectionTimeout: 60000, // 1 minute
      genReqId: () => crypto.randomUUID(),
    },
    openapi: {
      openapi: {
        info: {
          title: 'Echoes API',
          description: 'API documentation for Echoes',
          version: '0.0.0',
        },
        tags: [
          {
            name: 'Auth',
            description: 'Authentication endpoints',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              description: 'Bearer token authentication',
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
      convertConstToEnum: false,
    },
    oauth2: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        loginPath: '/api/v1/auth/google',
        callbackUri: 'http://localhost:3000/api/v1/auth/google/callback',
      },
    },
    mailer: {
      resendApiKey: env.RESEND_API_KEY,
    },
    jwt: {
      accessTokenSecret: env.JWT_ACCESS_TOKEN_SECRET,
      refreshTokenSecret: env.JWT_REFRESH_TOKEN_SECRET,
      accessTokenTTL: env.JWT_ACCESS_TOKEN_TTL,
      slidingTTLMs: env.JWT_SLIDING_TTL_MS,
      nbfGrace: env.JWT_NBF_GRACE,
    },
    isCookieSecure: env.IS_COOKIE_SECURE,
  }

  return config
}

export default getConfig
