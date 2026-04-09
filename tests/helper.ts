import type { FastifyInstance } from 'fastify'
import type { InjectOptions, Response as InjectResponse } from 'light-my-request'
import type { IConfig } from '../src/config/index.ts'

const youtubeMusicBootstrapHtml = `<script>ytcfg.set({"INNERTUBE_API_KEY":"test-api-key","INNERTUBE_API_VERSION":"v1","INNERTUBE_CLIENT_NAME":"WEB_REMIX","INNERTUBE_CLIENT_VERSION":"1.20250401.01.00","GL":"US","HL":"en"});</script>`
const originalFetch = globalThis.fetch.bind(globalThis)

globalThis.fetch = async (input, init) => {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

  if (url === 'https://music.youtube.com/') {
    return new Response(youtubeMusicBootstrapHtml, {
      status: 200,
      headers: {
        'content-type': 'text/html',
      },
    })
  }

  return originalFetch(input, init)
}

export const mockConfig: IConfig = {
  host: 'localhost',
  port: 3000,
  openapi: {} as any,
  fastifyInit: {
    logger: false,
  },
  oauth2: {
    google: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      loginPath: '/auth/google/login',
      callbackUri: '/auth/google/callback',
    },
  },
  mailer: {
    resendApiKey: 'test-api-key',
  },
  jwt: {
    accessTokenSecret: 'test-access-secret-key-min-32-bytes-long!',
    refreshTokenSecret: 'test-refresh-secret-key-min-32-bytes-long!',
    accessTokenTTL: '15m',
    slidingTTLMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    nbfGrace: undefined as any,
  },
  enableCookieSecure: false,
  frontendUrl: 'http://localhost:3000',
  enableDbConnection: false,
}

export async function buildTestApp() {
  process.env.POSTGRES_URL = 'postgres://test:test@localhost:5432/test'

  const { buildApp } = await import('../src/app.ts')
  const app = await buildApp(mockConfig)
  await app.ready()

  return app
}

type AccessTokenUser = {
  id: string
  email: string
  tokenVersion: number
}

type InjectWithAccessTokenOptions = Omit<InjectOptions, 'method' | 'url' | 'headers'> & {
  method: NonNullable<InjectOptions['method']>
  url: string
  headers?: Record<string, string>
}

export async function injectWithAccessToken(
  app: FastifyInstance,
  options: InjectWithAccessTokenOptions,
  user: AccessTokenUser,
): Promise<InjectResponse> {
  const { accessToken } = app.tokenService.issueTokenPair({
    user,
    family: 'family-uuid-123',
  })

  return app.inject({
    ...options,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  }) as Promise<InjectResponse>
}
