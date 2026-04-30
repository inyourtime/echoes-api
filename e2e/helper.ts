import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { FastifyInstance } from 'fastify'
import { Pool } from 'pg'
import type { IConfig } from '../src/config/index.ts'
import { startTestDatabase } from './database.ts'

export type SentEmail = {
  email: string
  link: string
  type: 'password_reset' | 'verification'
}

function buildE2eConfig(): IConfig {
  return {
    host: 'localhost',
    port: 3000,
    openapi: {},
    fastifyInit: {
      logger: false,
    },
    firebase: {
      clientEmail: null,
      privateKey: null,
      projectId: null,
    },
    pgBoss: {
      enabled: false,
      onThisDayCron: '0 9 * * *',
      onThisDayTimezone: 'Asia/Bangkok',
    },
    oauth2: {
      google: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        loginPath: '/auth/google/login',
        callbackUri: '/auth/google/callback',
      },
      line: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tokenHost: 'https://api.line.me',
        tokenPath: '/oauth2/v2.1/token',
        authorizeHost: 'https://access.line.me',
        authorizePath: '/oauth2/v2.1/authorize',
        loginPath: '/auth/line/login',
        callbackUri: '/auth/line/callback',
      },
    },
    mailer: {
      resendApiKey: 'test-api-key',
    },
    jwt: {
      accessTokenSecret: 'test-access-secret-key-min-32-bytes-long!',
      refreshTokenSecret: 'test-refresh-secret-key-min-32-bytes-long!',
      accessTokenTTL: '15m',
      slidingTTLMs: 30 * 24 * 60 * 60 * 1000,
      nbfGrace: undefined as any,
    },
    enableCookieSecure: false,
    frontendUrl: 'http://localhost:3000',
    enableDbConnection: true,
  }
}

function isEpipe(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'EPIPE')
}

export async function applyMigrations(connectionString: string) {
  const pool = new Pool({ connectionString })
  const migrationDb = drizzle({ client: pool })

  try {
    await migrate(migrationDb, {
      migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)),
    })
  } finally {
    await pool.end()
  }
}

export async function buildE2eApp(testContext: TestContext): Promise<{
  app: FastifyInstance
  sentEmails: SentEmail[]
}> {
  const { connectionString, stop } = await startTestDatabase()
  await applyMigrations(connectionString)

  process.env.POSTGRES_URL = connectionString

  const config = buildE2eConfig()

  const { buildApp } = await import('../src/app.ts')
  const app = await buildApp(config)
  await app.ready()

  const sentEmails: SentEmail[] = []
  app.mailerService.deliverVerification = async (email, link) => {
    sentEmails.push({ email, link, type: 'verification' })
  }
  app.mailerService.deliverPasswordReset = async (email, link) => {
    sentEmails.push({ email, link, type: 'password_reset' })
  }

  testContext.after(async () => {
    let cleanupError: unknown

    try {
      await app.close()
    } catch (error) {
      if (!isEpipe(error)) cleanupError = error
    }

    try {
      await stop()
    } catch (error) {
      if (!isEpipe(error) && !cleanupError) cleanupError = error
    }

    if (cleanupError) {
      throw cleanupError
    }
  })

  return { app, sentEmails }
}

export function getCookieValue(response: { headers: Record<string, unknown> }, name: string) {
  const setCookie = response.headers['set-cookie']
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie]
  const cookie = cookies.find((value): value is string => {
    return typeof value === 'string' && value.startsWith(`${name}=`)
  })

  return cookie?.split(';')[0]?.slice(name.length + 1) ?? null
}
