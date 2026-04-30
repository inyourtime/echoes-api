import type { TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { FastifyInstance } from 'fastify'
import { Pool } from 'pg'
import type { IConfig } from '../src/config/index.ts'
import { mockConfig } from '../tests/helper.ts'
import { startTestDatabase } from './database.ts'

export type SentEmail = {
  email: string
  link: string
  type: 'password_reset' | 'verification'
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

  const config: IConfig = {
    ...mockConfig,
    enableDbConnection: true,
    fastifyInit: {
      ...mockConfig.fastifyInit,
      logger: false,
    },
    pgBoss: {
      ...mockConfig.pgBoss,
      enabled: false,
    },
  }

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
    await app.close()
    await stop()
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
