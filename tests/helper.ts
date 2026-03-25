import type { IConfig } from '../src/config/index.ts'

export const mockConfig: IConfig = {
  host: 'localhost',
  port: 3000,
  openapi: {} as any,
  fastifyInit: {},
  oauth2: {
    google: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
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
    nbfGrace: '10s',
  },
  enableCookieSecure: false,
}
