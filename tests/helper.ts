import type { IConfig } from '../src/config/index.ts'

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
